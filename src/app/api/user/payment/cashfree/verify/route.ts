import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/flows/admin-client';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { storeId, orderId } = body;

    if (!storeId || !orderId) {
      return NextResponse.json({ error: 'Store ID and Order ID are required' }, { status: 400 });
    }

    const admin = supabaseAdmin();
    const { data: store, error: storeError } = await admin
      .from('stores')
      .select('id, name, payment_gateway_config')
      .eq('id', storeId)
      .maybeSingle();

    if (storeError || !store) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    }

    const rawPg = (store.payment_gateway_config || {}) as Record<string, any>;
    const cfAppId = (rawPg.online?.cashfree?.app_id || rawPg.cashfree?.app_id || '').trim();
    const cfSecretKey = (rawPg.online?.cashfree?.secret_key || rawPg.cashfree?.secret_key || '').trim();
    const cfEnv = (rawPg.online?.cashfree?.env || rawPg.cashfree?.env || 'sandbox').trim().toLowerCase();

    if (!cfAppId || !cfSecretKey) {
      return NextResponse.json({ error: 'Cashfree credentials not configured' }, { status: 400 });
    }

    const baseUrl =
      cfEnv === 'production'
        ? 'https://api.cashfree.com/pg'
        : 'https://sandbox.cashfree.com/pg';

    const cfRes = await fetch(`${baseUrl}/orders/${encodeURIComponent(orderId)}`, {
      method: 'GET',
      headers: {
        'x-client-id': cfAppId,
        'x-client-secret': cfSecretKey,
        'x-api-version': '2023-08-01',
      },
    });

    const cfData = await cfRes.json();

    if (!cfRes.ok) {
      return NextResponse.json(
        { error: cfData.message || 'Failed to verify Cashfree order status' },
        { status: cfRes.status }
      );
    }

    const isPaid = cfData.order_status === 'PAID';

    return NextResponse.json({
      paid: isPaid,
      orderStatus: cfData.order_status,
      orderId: cfData.order_id,
      cfOrderId: cfData.cf_order_id,
      paymentAmount: cfData.order_amount,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
