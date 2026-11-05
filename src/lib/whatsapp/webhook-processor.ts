// ============================================================
// Asynchronous Webhook Event Processor
// ============================================================

/**
 * Process a raw incoming WhatsApp webhook payload from the background queue.
 */
export async function processRawWebhookPayload(rawBody: string): Promise<void> {
  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch (err) {
    console.error('[webhook-processor] Failed to parse JSON raw body:', err);
    return;
  }

  try {
    const { processWebhook } = await import('@/app/api/whatsapp/webhook/route');
    await processWebhook(body as never);
  } catch (err) {
    console.error('[webhook-processor] Error executing processWebhook:', err);
    throw err;
  }
}
