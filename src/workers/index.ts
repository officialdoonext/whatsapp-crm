// ============================================================
// Standalone WhatsApp CRM Background Job Worker Runner
//
// Can be executed independently of Next.js:
//   npm run worker
//   node --env-file=.env.local dist/worker.mjs
// ============================================================

// Polyfill global WebSocket for Node < 22 environments.
// SupabaseClient eagerly instantiates RealtimeClient in its constructor, which
// throws "Node.js 20 detected without native WebSocket support" even though
// the worker only uses PostgreSQL REST/RPC operations.
if (typeof globalThis.WebSocket === 'undefined') {
  class StubWebSocket {
    static readonly CONNECTING = 0;
    static readonly OPEN = 1;
    static readonly CLOSING = 2;
    static readonly CLOSED = 3;
    readonly CONNECTING = 0;
    readonly OPEN = 1;
    readonly CLOSING = 2;
    readonly CLOSED = 3;
    readonly readyState = 3;
    readonly url = '';
    readonly protocol = '';
    onopen = null;
    onmessage = null;
    onclose = null;
    onerror = null;
    constructor() {}
    close() {}
    send() {}
    addEventListener() {}
    removeEventListener() {}
  }
  globalThis.WebSocket = StubWebSocket as unknown as typeof WebSocket;
}

// Attempt loading local env files if present (Node.js 20.6+)
const loadEnv = (process as unknown as { loadEnvFile?: (path?: string) => void }).loadEnvFile;
if (typeof loadEnv === 'function') {
  for (const envFile of ['.env.local', '.env']) {
    try {
      loadEnv(envFile);
      break;
    } catch {
      // Ignored if file does not exist
    }
  }
}

import { QueueWorker } from '@/lib/queue/worker';
import type {
  JobRow,
  OutboundMessageJobPayload,
  BroadcastRecipientJobPayload,
  AutomationTriggerJobPayload,
  DelayedAutomationStepJobPayload,
  WebhookEventJobPayload,
  AiAutoReplyJobPayload,
  MediaMirrorJobPayload,
} from '@/lib/queue/types';

const concurrency = process.env.WORKER_CONCURRENCY
  ? parseInt(process.env.WORKER_CONCURRENCY, 10)
  : 15;
const pollIntervalMs = process.env.WORKER_POLL_INTERVAL_MS
  ? parseInt(process.env.WORKER_POLL_INTERVAL_MS, 10)
  : 200;
const emptyBackoffMs = process.env.WORKER_EMPTY_BACKOFF_MS
  ? parseInt(process.env.WORKER_EMPTY_BACKOFF_MS, 10)
  : 1000;

// Default worker instance
export const worker = new QueueWorker({
  workerId: `wacrm-worker-${process.pid}`,
  concurrency: isNaN(concurrency) ? 15 : concurrency,
  pollIntervalMs: isNaN(pollIntervalMs) ? 200 : pollIntervalMs,
  emptyBackoffMs: isNaN(emptyBackoffMs) ? 1000 : emptyBackoffMs,
});

// Register job processors
worker.registerHandler<OutboundMessageJobPayload>('outbound_message', async (job) => {
  // Imported dynamically to prevent circular dependencies at startup
  const { sendMessageToConversation } = await import('@/lib/whatsapp/send-message');
  const { supabaseAdmin } = await import('@/lib/automations/admin-client');
  const db = supabaseAdmin();
  const payload = job.payload;

  await sendMessageToConversation(db, payload.accountId, {
    conversationId: payload.conversationId,
    messageType: payload.messageType,
    contentText: payload.contentText,
    mediaUrl: payload.mediaUrl,
    filename: payload.filename,
    templateName: payload.templateName,
    templateLanguage: payload.templateLanguage,
    templateParams: payload.templateParams,
    templateMessageParams: payload.templateMessageParams,
    interactivePayload: payload.interactivePayload as never,
    replyToMessageId: payload.replyToMessageId,
  });
});

worker.registerHandler<BroadcastRecipientJobPayload>('broadcast_recipient', async (job) => {
  const { sendTemplateMessage } = await import('@/lib/whatsapp/meta-api');
  const { decrypt } = await import('@/lib/whatsapp/encryption');
  const { resolveTemplateRow } = await import('@/lib/whatsapp/template-body');
  const { phoneVariants, isRecipientNotAllowedError } = await import('@/lib/whatsapp/phone-utils');
  const { supabaseAdmin } = await import('@/lib/automations/admin-client');
  const db = supabaseAdmin();
  const payload = job.payload;

  // Load WhatsApp config for tenant
  let { data: config, error: configErr } = await db
    .from('whatsapp_config')
    .select('*')
    .eq('account_id', payload.accountId)
    .maybeSingle();

  if (!config) {
    const { data: fallback } = await db
      .from('whatsapp_config')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (fallback) {
      console.warn('[queue-worker] Falling back to primary whatsapp_config row for account:', payload.accountId);
      config = fallback;
    }
  }

  if (configErr || !config) {
    throw new Error(`WhatsApp not configured for account ${payload.accountId}`);
  }

  const accessToken = decrypt(config.access_token);
  const resolvedTemplate = await resolveTemplateRow(
    db,
    payload.accountId,
    payload.templateName,
    payload.templateLanguage
  );

  const variants = phoneVariants(payload.phone);
  let sentMessageId: string | null = null;
  let lastError: string | null = null;

  for (const variant of variants) {
    try {
      const result = await sendTemplateMessage({
        phoneNumberId: config.phone_number_id,
        accessToken,
        to: variant,
        templateName: payload.templateName,
        language: resolvedTemplate.language,
        template: resolvedTemplate.row ?? undefined,
        messageParams: payload.messageParams as never,
        params: payload.params,
      });
      sentMessageId = result.messageId;
      lastError = null;
      break;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      lastError = msg;
      if (!isRecipientNotAllowedError(msg)) break;
    }
  }

  if (sentMessageId) {
    await db
      .from('broadcast_recipients')
      .update({
        status: 'sent',
        sent_at: new Date().toISOString(),
        whatsapp_message_id: sentMessageId,
        error_message: null,
      })
      .eq('id', payload.recipientRowId);
  } else {
    await db
      .from('broadcast_recipients')
      .update({
        status: 'failed',
        error_message: lastError || 'Meta delivery error',
      })
      .eq('id', payload.recipientRowId);
    throw new Error(lastError || 'Failed to deliver broadcast message');
  }
});

worker.registerHandler<AutomationTriggerJobPayload>('automation_trigger', async (job) => {
  const { runAutomationsForTrigger } = await import('@/lib/automations/engine');
  await runAutomationsForTrigger({
    accountId: job.payload.accountId,
    triggerType: job.payload.triggerType as never,
    contactId: job.payload.contactId,
    context: job.payload.context,
  });
});

worker.registerHandler<DelayedAutomationStepJobPayload>('delayed_automation_step', async (job) => {
  const { resumePendingExecution } = await import('@/lib/automations/engine');
  const { supabaseAdmin } = await import('@/lib/automations/admin-client');
  const db = supabaseAdmin();

  const { data: pending, error } = await db
    .from('automation_pending_executions')
    .select('*')
    .eq('id', job.payload.pendingExecutionId)
    .single();

  if (error || !pending) {
    throw new Error(`Pending execution ${job.payload.pendingExecutionId} not found`);
  }

  await resumePendingExecution({
    id: pending.id,
    automation_id: pending.automation_id,
    account_id: pending.account_id,
    user_id: pending.user_id,
    contact_id: pending.contact_id,
    log_id: pending.log_id,
    parent_step_id: pending.parent_step_id,
    branch: pending.branch,
    next_step_position: pending.next_step_position,
    context: pending.context ?? {},
  });
});

worker.registerHandler<WebhookEventJobPayload>('webhook_event', async (job) => {
  const { processRawWebhookPayload } = await import('@/lib/whatsapp/webhook-processor');
  await processRawWebhookPayload(job.payload.rawBody);
});

worker.registerHandler<AiAutoReplyJobPayload>('ai_auto_reply', async (job) => {
  const { dispatchInboundToAiReply } = await import('@/lib/ai/auto-reply');
  await dispatchInboundToAiReply({
    accountId: job.payload.accountId,
    conversationId: job.payload.conversationId,
    contactId: job.payload.contactId,
    configOwnerUserId: job.payload.userId ?? '',
    inboundMessageId: job.payload.inboundMessageId,
  });
});

worker.registerHandler<MediaMirrorJobPayload>('media_mirror', async (job) => {
  const { mirrorInboundMedia } = await import('@/lib/whatsapp/mirror-inbound-media');
  const { decrypt } = await import('@/lib/whatsapp/encryption');
  const { supabaseAdmin } = await import('@/lib/automations/admin-client');
  const db = supabaseAdmin();
  const payload = job.payload;

  let { data: config } = await db
    .from('whatsapp_config')
    .select('access_token')
    .eq('account_id', payload.accountId)
    .maybeSingle();

  if (!config) {
    const { data: fallback } = await db
      .from('whatsapp_config')
      .select('access_token')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (fallback) config = fallback;
  }

  if (!config) return;
  const accessToken = decrypt(config.access_token);

  const mirroredUrl = await mirrorInboundMedia({
    storage: db.storage,
    accountId: payload.accountId,
    mediaId: payload.mediaId,
    downloadUrl: payload.downloadUrl,
    accessToken,
    mimeType: payload.mimeType,
    fileSize: payload.fileSize,
    fileName: payload.fileName,
    messageTimestamp: payload.messageTimestamp,
  });

  if (mirroredUrl && payload.messageId) {
    await db
      .from('messages')
      .update({ media_url: mirroredUrl })
      .eq('id', payload.messageId);
  }
});

// Auto-start if executed directly from CLI / runner
if (
  process.argv[1]?.endsWith('workers/index.ts') ||
  process.argv[1]?.endsWith('workers/index.js') ||
  process.argv[1]?.endsWith('worker.mjs') ||
  process.argv[1]?.includes('worker')
) {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error(
      '\n[queue-worker] ⚠️  CONFIGURATION WARNING: Required environment variables are missing!\n' +
        `  - Supabase URL (NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL): ${supabaseUrl ? 'OK' : 'MISSING'}\n` +
        `  - Supabase Service Role Key (SUPABASE_SERVICE_ROLE_KEY): ${serviceRoleKey ? 'OK' : 'MISSING'}\n` +
        `  - WhatsApp Encryption Key (ENCRYPTION_KEY): ${process.env.ENCRYPTION_KEY ? 'OK' : 'MISSING'}\n\n` +
        '-> If deploying on Railway, Coolify, or Docker:\n' +
        '   Ensure these variables are added to the "queue-worker" service / container.\n' +
        '   (In Railway: go to Project -> "queue-worker" service -> "Variables" tab and add them)\n'
    );
  }

  void worker.start();
}

