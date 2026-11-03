import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth/account'
import { createOrderPayment } from '@/lib/commerce/payment-service'
import { sendMessageToConversation } from '@/lib/whatsapp/send-message'
import type { PaymentProvider, CommerceOrder } from '@/types'

export async function POST(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const params = await props.params
    const orderId = params.id
    const { supabase, accountId } = await requireRole('agent')

    // Load order
    const { data: order, error: orderErr } = await supabase
      .from('commerce_orders')
      .select('*, contact:contacts(id, name, phone, email)')
      .eq('id', orderId)
      .eq('account_id', accountId)
      .single()

    if (orderErr || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    // Load whatsapp config to get payment provider and credentials
    const { data: config, error: configErr } = await supabase
      .from('whatsapp_config')
      .select('payment_provider, payment_config, phone_number_id, access_token')
      .eq('account_id', accountId)
      .single()

    if (configErr || !config) {
      return NextResponse.json(
        { error: 'WhatsApp is not configured for this account.' },
        { status: 400 }
      )
    }

    const provider: PaymentProvider = config.payment_provider || 'manual'
    const paymentConfig = config.payment_config || {}

    // Generate payment link/info using payment service
    const payment = await createOrderPayment({
      provider,
      paymentConfig,
      order: order as CommerceOrder,
      customerPhone: order.contact?.phone,
      customerName: order.contact?.name,
    })

    // Update order with payment link and provider
    await supabase
      .from('commerce_orders')
      .update({
        payment_provider: provider,
        payment_link_url: payment.paymentUrl,
        payment_id: payment.paymentId || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId)

    // If order has an active conversation, optionally send payment link into WhatsApp!
    let sentMessageId: string | null = null
    if (order.conversation_id) {
      const bodyText = `🧾 Payment Request for Order #${order.order_reference}\nTotal: ${order.currency} ${Number(
        order.total_amount
      ).toFixed(2)}\n\n👉 Complete your payment here: ${payment.paymentUrl}`

      try {
        const sendResult = await sendMessageToConversation(supabase, accountId, {
          conversationId: order.conversation_id,
          messageType: 'text',
          contentText: bodyText,
        })
        sentMessageId = sendResult.messageId
      } catch (sendErr) {
        console.warn('[pay-link] Failed to send payment link message to WhatsApp:', sendErr)
      }
    }

    return NextResponse.json({
      success: true,
      payment_url: payment.paymentUrl,
      payment_id: payment.paymentId,
      provider,
      sent_to_whatsapp: !!sentMessageId,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to generate payment link'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

