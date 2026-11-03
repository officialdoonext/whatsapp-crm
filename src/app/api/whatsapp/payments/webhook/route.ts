import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

let _adminClient: any = null
function supabaseAdmin() {
  if (!_adminClient) {
    _adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
  }
  return _adminClient
}

export async function POST(request: Request) {
  try {
    const rawBody = await request.text()
    let event: Record<string, any>
    try {
      event = JSON.parse(rawBody)
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    let orderReference: string | null = null
    let transactionId: string | null = null
    let provider = 'unknown'

    // Razorpay Webhook format
    if (event.event?.startsWith('payment_link.') || event.event?.startsWith('payment.')) {
      provider = 'razorpay'
      const paymentEntity = event.payload?.payment_link?.entity || event.payload?.payment?.entity
      orderReference = paymentEntity?.reference_id || null
      transactionId = paymentEntity?.id || null
    }

    // Stripe Webhook format
    if (event.type === 'checkout.session.completed') {
      provider = 'stripe'
      const session = event.data?.object
      orderReference = session?.client_reference_id || null
      transactionId = session?.id || null
    }

    if (!orderReference) {
      // Event acknowledged without matching reference
      return NextResponse.json({ status: 'ignored_no_reference' }, { status: 200 })
    }

    // Look up and mark order as paid
    const { data: order, error: findErr } = await supabaseAdmin()
      .from('commerce_orders')
      .select('id, conversation_id, total_amount, currency')
      .eq('order_reference', orderReference)
      .maybeSingle()

    if (findErr || !order) {
      console.warn('[payment-webhook] Order not found for reference:', orderReference)
      return NextResponse.json({ status: 'order_not_found' }, { status: 200 })
    }

    await supabaseAdmin()
      .from('commerce_orders')
      .update({
        status: 'paid',
        payment_id: transactionId,
        payment_provider: provider,
        paid_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', order.id)

    // Notify conversation if conversation_id is present
    if (order.conversation_id) {
      await supabaseAdmin()
        .from('messages')
        .insert({
          conversation_id: order.conversation_id,
          sender_type: 'bot',
          content_type: 'text',
          content_text: `✅ Payment of ${order.currency} ${Number(
            order.total_amount
          ).toFixed(2)} received for Order #${orderReference}!`,
          status: 'delivered',
        })
    }

    return NextResponse.json({ status: 'success', order_id: order.id }, { status: 200 })
  } catch (error) {
    console.error('[payment-webhook] Processing error:', error)
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }
}

