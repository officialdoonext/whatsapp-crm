// ============================================================
// Standalone WhatsApp CRM Background Job Worker Runner
//
// Can be executed independently of Next.js:
//   npm run worker
//   node --env-file=.env.local dist/worker.mjs
// ============================================================

// 1. MUST be the very first import so globalThis.WebSocket is guaranteed
// to be polyfilled before any ESM @supabase/* module evaluates.
import './websocket-polyfill';

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
  QueueName,
  OutboundMessageJobPayload,
  BroadcastRecipientJobPayload,
  AutomationTriggerJobPayload,
  DelayedAutomationStepJobPayload,
  WebhookEventJobPayload,
  AiAutoReplyJobPayload,
  MediaMirrorJobPayload,
} from '@/lib/queue/types';

/**
 * Register all domain job handlers onto a worker instance.
 */
function registerAllHandlers(w: QueueWorker): QueueWorker {
  w.registerHandler<OutboundMessageJobPayload>('outbound_message', async (job) => {
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

  w.registerHandler<BroadcastRecipientJobPayload>('broadcast_recipient', async (job) => {
    const { sendTemplateMessage } = await import('@/lib/whatsapp/meta-api');
    const { getCachedWhatsAppConfig } = await import('@/lib/whatsapp/config-cache');
    const { resolveTemplateRow } = await import('@/lib/whatsapp/template-body');
    const { phoneVariants, isRecipientNotAllowedError } = await import('@/lib/whatsapp/phone-utils');
    const { supabaseAdmin } = await import('@/lib/automations/admin-client');
    const db = supabaseAdmin();
    const payload = job.payload;

    // Fast in-memory cached WhatsApp config (eliminates repeated DB queries per recipient)
    const config = await getCachedWhatsAppConfig(db, payload.accountId);
    if (!config) {
      throw new Error(`WhatsApp not configured for account ${payload.accountId}`);
    }

    const accessToken = config.accessToken;
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
          phoneNumberId: config.phoneNumberId,
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

  w.registerHandler<AutomationTriggerJobPayload>('automation_trigger', async (job) => {
    const { runAutomationsForTrigger } = await import('@/lib/automations/engine');
    await runAutomationsForTrigger({
      accountId: job.payload.accountId,
      triggerType: job.payload.triggerType as never,
      contactId: job.payload.contactId,
      context: job.payload.context,
    });
  });

  w.registerHandler<DelayedAutomationStepJobPayload>('delayed_automation_step', async (job) => {
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

  w.registerHandler<WebhookEventJobPayload>('webhook_event', async (job) => {
    const { processRawWebhookPayload } = await import('@/lib/whatsapp/webhook-processor');
    await processRawWebhookPayload(job.payload.rawBody);
  });

  w.registerHandler<AiAutoReplyJobPayload>('ai_auto_reply', async (job) => {
    const { dispatchInboundToAiReply } = await import('@/lib/ai/auto-reply');
    await dispatchInboundToAiReply({
      accountId: job.payload.accountId,
      conversationId: job.payload.conversationId,
      contactId: job.payload.contactId,
      configOwnerUserId: job.payload.userId ?? '',
      inboundMessageId: job.payload.inboundMessageId,
    });
  });

  w.registerHandler<MediaMirrorJobPayload>('media_mirror', async (job) => {
    const { mirrorInboundMedia } = await import('@/lib/whatsapp/mirror-inbound-media');
    const { getCachedWhatsAppConfig } = await import('@/lib/whatsapp/config-cache');
    const { supabaseAdmin } = await import('@/lib/automations/admin-client');
    const db = supabaseAdmin();
    const payload = job.payload;

    const config = await getCachedWhatsAppConfig(db, payload.accountId);
    if (!config) return;

    const mirroredUrl = await mirrorInboundMedia({
      storage: db.storage,
      accountId: payload.accountId,
      mediaId: payload.mediaId,
      downloadUrl: payload.downloadUrl,
      accessToken: config.accessToken,
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

  return w;
}

// ------------------------------------------------------------
// Worker Topology: Single Dedicated Service or Multi-Pool Mode
// ------------------------------------------------------------
const envQueues = process.env.WORKER_QUEUES
  ? (process.env.WORKER_QUEUES.split(',').map((q) => q.trim()) as QueueName[])
  : undefined;

const customConcurrency = process.env.WORKER_CONCURRENCY
  ? parseInt(process.env.WORKER_CONCURRENCY, 10)
  : undefined;

export const workers: QueueWorker[] = [];

if (envQueues && envQueues.length > 0) {
  // Mode A: Explicitly assigned queue subset (e.g. dedicated Railway worker service)
  const isMessageQueue = envQueues.includes('messages');
  const w = new QueueWorker({
    workerId: `wacrm-${envQueues.join('-')}-${process.pid}`,
    queues: envQueues,
    concurrency: customConcurrency ?? (isMessageQueue ? 10 : 5),
    pollIntervalMs: isMessageQueue ? 50 : 100,
    emptyBackoffMs: isMessageQueue ? 200 : 500,
  });
  registerAllHandlers(w);
  workers.push(w);
} else {
  // Mode B: Unified runner with dedicated worker pools to prevent starvation
  // High-priority instant message pool (never blocked by broadcasts)
  const messageWorker = new QueueWorker({
    workerId: `wacrm-messages-${process.pid}`,
    queues: ['messages'],
    concurrency: customConcurrency ?? 10,
    pollIntervalMs: 50,
    emptyBackoffMs: 200,
  });
  registerAllHandlers(messageWorker);
  workers.push(messageWorker);

  // Automations & workflow steps pool
  const automationWorker = new QueueWorker({
    workerId: `wacrm-automations-${process.pid}`,
    queues: ['automations'],
    concurrency: 5,
    pollIntervalMs: 50,
    emptyBackoffMs: 250,
  });
  registerAllHandlers(automationWorker);
  workers.push(automationWorker);

  // AI auto-reply pool
  const aiWorker = new QueueWorker({
    workerId: `wacrm-ai-${process.pid}`,
    queues: ['ai'],
    concurrency: 3,
    pollIntervalMs: 100,
    emptyBackoffMs: 500,
  });
  registerAllHandlers(aiWorker);
  workers.push(aiWorker);

  // Broadcast campaigns pool (isolated so 50k bulk sends never delay incoming customer replies)
  const broadcastWorker = new QueueWorker({
    workerId: `wacrm-broadcasts-${process.pid}`,
    queues: ['broadcasts'],
    concurrency: 5,
    pollIntervalMs: 100,
    emptyBackoffMs: 500,
  });
  registerAllHandlers(broadcastWorker);
  workers.push(broadcastWorker);

  // Webhook dispatches & media mirroring
  const backgroundWorker = new QueueWorker({
    workerId: `wacrm-background-${process.pid}`,
    queues: ['webhooks', 'media'],
    concurrency: 4,
    pollIntervalMs: 150,
    emptyBackoffMs: 800,
  });
  registerAllHandlers(backgroundWorker);
  workers.push(backgroundWorker);
}

// Single worker export for backward compatibility
export const worker = workers[0];

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
        `  - WhatsApp Encryption Key (ENCRYPTION_KEY): ${process.env.ENCRYPTION_KEY ? 'OK' : 'MISSING'}\n\n`
    );
  }

  console.log(`[queue-worker] Starting ${workers.length} active worker pools...`);
  for (const w of workers) {
    void w.start();
  }
}
