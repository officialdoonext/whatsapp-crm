// ============================================================
// Queue types & job definitions for WhatsApp CRM
// ============================================================

export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';

export type QueueName =
  | 'messages'      // Outbound WhatsApp messages
  | 'broadcasts'    // High-volume broadcast recipients
  | 'webhooks'      // Inbound Meta webhooks & public webhook dispatches
  | 'automations'   // Automation triggers & delayed workflow steps
  | 'ai'            // AI auto-replies & embeddings
  | 'media';        // Media mirroring & asset syncing

export type JobType =
  | 'outbound_message'
  | 'broadcast_recipient'
  | 'automation_trigger'
  | 'delayed_automation_step'
  | 'webhook_event'
  | 'ai_auto_reply'
  | 'media_mirror';

export interface BaseJobPayload {
  accountId: string;
  userId?: string;
  [key: string]: unknown;
}

export interface OutboundMessageJobPayload extends BaseJobPayload {
  conversationId: string;
  messageType: string;
  contentText?: string | null;
  mediaUrl?: string | null;
  filename?: string | null;
  templateName?: string | null;
  templateLanguage?: string | null;
  templateParams?: string[];
  templateMessageParams?: unknown;
  interactivePayload?: unknown;
  replyToMessageId?: string | null;
}

export interface BroadcastRecipientJobPayload extends BaseJobPayload {
  broadcastId: string;
  recipientRowId: string;
  phone: string;
  templateName: string;
  templateLanguage: string;
  params: string[];
  messageParams?: unknown;
}

export interface AutomationTriggerJobPayload extends BaseJobPayload {
  triggerType: string;
  contactId?: string | null;
  context?: Record<string, unknown>;
}

export interface DelayedAutomationStepJobPayload extends BaseJobPayload {
  pendingExecutionId: string;
}

export interface WebhookEventJobPayload {
  rawBody: string;
  signature?: string | null;
  receivedAt: string;
  eventId?: string;
}

export interface AiAutoReplyJobPayload extends BaseJobPayload {
  conversationId: string;
  contactId: string;
  inboundMessageId?: string;
  inboundText: string;
}

export interface MediaMirrorJobPayload extends BaseJobPayload {
  mediaId: string;
  downloadUrl: string;
  mimeType?: string | null;
  fileSize?: number | null;
  fileName?: string | null;
  messageTimestamp?: string | number | null;
  conversationId?: string;
  messageId?: string;
}

export type JobPayloadMap = {
  outbound_message: OutboundMessageJobPayload;
  broadcast_recipient: BroadcastRecipientJobPayload;
  automation_trigger: AutomationTriggerJobPayload;
  delayed_automation_step: DelayedAutomationStepJobPayload;
  webhook_event: WebhookEventJobPayload;
  ai_auto_reply: AiAutoReplyJobPayload;
  media_mirror: MediaMirrorJobPayload;
};

export interface JobRow<T = Record<string, unknown>> {
  id: string;
  account_id: string | null;
  queue_name: QueueName;
  job_type: JobType;
  priority: number;
  payload: T;
  status: JobStatus;
  attempts: number;
  max_attempts: number;
  run_at: string;
  locked_at: string | null;
  locked_by: string | null;
  idempotency_key: string | null;
  error_message: string | null;
  last_error: Record<string, unknown> | null;
  webhook_received_at: string | null;
  enqueued_at: string;
  claimed_at: string | null;
  execution_started_at: string | null;
  execution_completed_at: string | null;
  meta_accepted_at: string | null;
  timings: Record<string, number | string>;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export interface EnqueueJobOptions<K extends JobType = JobType> {
  accountId?: string | null;
  queueName: QueueName;
  jobType: K;
  priority?: number; // 1 = highest / instant, 3 = normal, 5 = background
  payload: JobPayloadMap[K] | Record<string, unknown>;
  idempotencyKey?: string | null;
  runAt?: Date | string;
  maxAttempts?: number;
  webhookReceivedAt?: Date | string;
}

export interface JobResult {
  success: boolean;
  error?: string;
  data?: unknown;
}

export type JobHandler<T = unknown> = (job: JobRow<T>) => Promise<void | JobResult>;

