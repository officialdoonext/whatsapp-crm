// ============================================================
// Standalone WhatsApp CRM Background Job Worker Runner
//
// Can be executed independently of Next.js:
//   npm run worker
//   node --env-file=.env.local dist/workers/index.js
// ============================================================

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

// Default worker instance
export const worker = new QueueWorker({
  workerId: `wacrm-worker-${process.pid}`,
  concurrency: 15,
  pollIntervalMs: 200,
  emptyBackoffMs: 1000,
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
  const { data: config, error: configErr } = await db
    .from('whatsapp_config')
    .select('*')
    .eq('account_id', payload.accountId)
    .single();

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

  const { data: config } = await db
    .from('whatsapp_config')
    .select('access_token')
    .eq('account_id', payload.accountId)
    .single();

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
  void worker.start();
}

