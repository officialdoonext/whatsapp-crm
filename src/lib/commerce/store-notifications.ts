import { supabaseAdmin } from '@/lib/flows/admin-client';
import { sendTemplateMessage, sendTextMessage } from '@/lib/whatsapp/meta-api';
import { decrypt, isLegacyFormat } from '@/lib/whatsapp/encryption';
import type { StoreOrder, StoreOrderStage } from '@/types';

export interface SendOrderNotificationResult {
  sent: boolean;
  templateName?: string;
  error?: string;
}

export async function sendOrderStageNotification(
  order: StoreOrder,
  stage: StoreOrderStage,
  customNote?: string
): Promise<SendOrderNotificationResult> {
  try {
    const admin = supabaseAdmin();

    // 1. Fetch store's configured notification templates
    const { data: store, error: storeErr } = await admin
      .from('stores')
      .select('name, notification_templates')
      .eq('id', order.store_id)
      .maybeSingle();

    if (storeErr || !store) {
      return { sent: false, error: 'Store not found' };
    }

    const templateName = store.notification_templates?.[stage];
    if (!templateName || typeof templateName !== 'string' || !templateName.trim()) {
      return { sent: false, error: `No WhatsApp template configured for stage "${stage}"` };
    }

    // 2. Fetch account's WhatsApp config
    const { data: config, error: configErr } = await admin
      .from('whatsapp_config')
      .select('*')
      .eq('user_id', order.account_id)
      .maybeSingle();

    if (configErr || !config || !config.access_token || !config.phone_number_id) {
      return { sent: false, error: 'WhatsApp is not connected for this store account' };
    }

    // Decrypt access token if needed
    let token = config.access_token;
    try {
      if (token && (token.includes(':') || isLegacyFormat(token))) {
        token = decrypt(token);
      }
    } catch {
      // use raw token if decrypt fails
    }

    // Clean customer phone number
    const cleanedTo = order.customer_mobile.replace(/[^0-9]/g, '');
    if (!cleanedTo || cleanedTo.length < 10) {
      return { sent: false, error: 'Invalid customer phone number' };
    }

    // Human-readable stage title
    const stageTitles: Record<StoreOrderStage, string> = {
      created: 'Order Confirmed',
      preparing: 'Preparation in Progress',
      packing: 'Packing in Progress',
      packaged: 'Package Done & Ready',
      on_the_way: 'Out for Delivery',
      delivered: 'Delivered',
      cancelled: 'Cancelled',
    };

    // Body parameters: [customer_name, order_number, total_amount, stage_title, store_name]
    const bodyParams = [
      order.customer_name || 'Valued Customer',
      order.order_number,
      `₹${order.total_amount.toFixed(2)}`,
      stageTitles[stage] || stage,
      store.name || 'Store',
    ];

    try {
      await sendTemplateMessage({
        phoneNumberId: config.phone_number_id,
        accessToken: token,
        to: cleanedTo,
        templateName: templateName.trim(),
        language: 'en_US',
        params: bodyParams,
      });

      return { sent: true, templateName };
    } catch (sendErr) {
      // If template fails, attempt fallback text message if in 24hr window
      const errMsg = sendErr instanceof Error ? sendErr.message : 'Meta template send failed';
      console.warn(`[Store Notification] Template send failed for order ${order.order_number}:`, errMsg);

      try {
        const fallbackText = `Hi ${order.customer_name}, update on your order #${order.order_number} from ${store.name}:\nStatus: ${stageTitles[stage] || stage}\nTotal: ₹${order.total_amount.toFixed(2)}${customNote ? `\nNote: ${customNote}` : ''}\nThank you!`;
        await sendTextMessage({
          phoneNumberId: config.phone_number_id,
          accessToken: token,
          to: cleanedTo,
          text: fallbackText,
        });
        return { sent: true, templateName: `${templateName} (Fallback Text)` };
      } catch {
        return { sent: false, templateName, error: errMsg };
      }
    }
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown error sending notification';
    return { sent: false, error };
  }
}
