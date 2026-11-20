import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/flows/admin-client';
import { sendOrderStageNotification } from '@/lib/commerce/store-notifications';
import type { StoreOrder } from '@/types';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      store_id,
      customer_name,
      customer_mobile,
      delivery_address,
      items,
      subtotal,
      discount_amount = 0,
      coupon_code = null,
      tax_amount = 0,
      delivery_fee = 0,
      total_amount,
      payment_method = 'cod',
      payment_details = {},
      notes = '',
    } = body;

    // Validation
    if (!store_id) {
      return NextResponse.json({ error: 'Store ID is required' }, { status: 400 });
    }

    const trimmedName = typeof customer_name === 'string' ? customer_name.trim() : '';
    const trimmedMobile = typeof customer_mobile === 'string' ? customer_mobile.trim() : '';

    if (!trimmedName) {
      return NextResponse.json({ error: 'Customer Name is required' }, { status: 400 });
    }

    if (!trimmedMobile) {
      return NextResponse.json({ error: 'Customer Mobile Number is required' }, { status: 400 });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Your cart is empty. Please add items.' }, { status: 400 });
    }

    if (!delivery_address || !delivery_address.streetAddress) {
      return NextResponse.json({ error: 'Delivery address is required' }, { status: 400 });
    }

    const admin = supabaseAdmin();

    // 1. Fetch store to ensure valid and get account_id & payment config
    const { data: store, error: storeError } = await admin
      .from('stores')
      .select('id, account_id, name, is_online, manual_override, expiry_date, payment_gateway_config')
      .eq('id', store_id)
      .maybeSingle();

    if (storeError || !store) {
      return NextResponse.json({ error: 'Store not found or no longer active' }, { status: 404 });
    }

    const pgConfig = (store.payment_gateway_config || {}) as Record<string, any>;
    const codEnabled = Boolean(pgConfig.cod?.enabled);
    const hasOnline = Boolean(
      (pgConfig.online?.enabled && pgConfig.online?.provider) ||
      (pgConfig.razorpay?.enabled && pgConfig.razorpay?.key_id) ||
      (pgConfig.cashfree?.enabled && pgConfig.cashfree?.app_id) ||
      (pgConfig.phonepe?.enabled && pgConfig.phonepe?.merchant_id)
    );

    if (!codEnabled && !hasOnline) {
      return NextResponse.json({
        error: 'This store has not configured or enabled any payment methods. Orders cannot be accepted.'
      }, { status: 400 });
    }

    if (payment_method === 'cod') {
      if (!codEnabled) {
        return NextResponse.json({ error: 'Cash on Delivery is not enabled for this store.' }, { status: 400 });
      }
    } else if (payment_method === 'online' || payment_method === 'razorpay' || payment_method === 'cashfree' || payment_method === 'phonepe') {
      if (!hasOnline) {
        return NextResponse.json({ error: 'Online payment is not configured for this store.' }, { status: 400 });
      }
      const hasValidPaymentProof =
        payment_details &&
        (payment_details.payment_id ||
          payment_details.razorpay_payment_id ||
          payment_details.cf_order_id ||
          payment_details.order_id);

      if (!hasValidPaymentProof) {
        return NextResponse.json({ error: 'Online payment transaction was not completed or verified.' }, { status: 400 });
      }

      // Ensure normalized payment_id
      payment_details.payment_id =
        payment_details.payment_id ||
        payment_details.razorpay_payment_id ||
        payment_details.cf_order_id ||
        payment_details.order_id;
    } else {
      return NextResponse.json({ error: 'Invalid payment method selected.' }, { status: 400 });
    }

    // 2. Generate unique order number: ORD-XXXXXX
    const randomSuffix = Math.floor(100000 + Math.random() * 900000);
    const orderNumber = `ORD-${randomSuffix}`;

    const paymentStatus = payment_method === 'cod' ? 'pending' : 'paid';

    const newOrderData = {
      order_number: orderNumber,
      account_id: store.account_id,
      store_id: store.id,
      customer_name: trimmedName,
      customer_mobile: trimmedMobile,
      delivery_address,
      items,
      subtotal: parseFloat(subtotal) || 0,
      discount_amount: parseFloat(discount_amount) || 0,
      coupon_code: coupon_code || null,
      tax_amount: parseFloat(tax_amount) || 0,
      delivery_fee: parseFloat(delivery_fee) || 0,
      total_amount: parseFloat(total_amount) || 0,
      payment_method,
      payment_status: paymentStatus,
      payment_details,
      order_status: 'created',
      status_timeline: [
        {
          status: 'created',
          timestamp: new Date().toISOString(),
          note: 'Order placed by customer via store link',
        },
      ],
      notes: typeof notes === 'string' ? notes.trim() : null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data: createdOrder, error: insertError } = await admin
      .from('store_orders')
      .insert(newOrderData)
      .select('*')
      .single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    // 3. Send automated WhatsApp Order Confirmed notification
    try {
      await sendOrderStageNotification(createdOrder as StoreOrder, 'created');
    } catch (notifErr) {
      console.warn('Failed to send order created WhatsApp notification:', notifErr);
    }

    return NextResponse.json({
      success: true,
      order: createdOrder,
      message: 'Order placed successfully!',
    }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
