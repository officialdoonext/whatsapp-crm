import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/flows/admin-client';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { storeId, amount, customerName, customerMobile, customerEmail } = body;

    if (!storeId) {
      return NextResponse.json({ error: 'Store ID is required' }, { status: 400 });
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return NextResponse.json({ error: 'Valid payment amount is required' }, { status: 400 });
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
      return NextResponse.json(
        {
          error:
            'Cashfree App ID and Secret Key are not configured. Please save your Cashfree credentials in Store Settings -> Payment Gateways.',
        },
        { status: 400 }
      );
    }

    const baseUrl =
      cfEnv === 'production'
        ? 'https://api.cashfree.com/pg'
        : 'https://sandbox.cashfree.com/pg';

    const cleanMobile = (customerMobile || '').replace(/\D/g, '').slice(-10);
    const validMobile = cleanMobile.length === 10 ? cleanMobile : '9999999999';
    const cleanCustomerId = `cust_${validMobile}_${Date.now().toString().slice(-4)}`;
    const cleanEmail =
      customerEmail && customerEmail.includes('@')
        ? customerEmail.trim()
        : `cust_${validMobile}@example.com`;

    // Order ID format required by Cashfree (alphanumeric and underscore, max 45 chars)
    const orderId = `ORD_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;

    const origin = request.headers.get('origin') || '';
    const cfPayload = {
      order_id: orderId,
      order_amount: Math.round(numAmount * 100) / 100,
      order_currency: 'INR',
      customer_details: {
        customer_id: cleanCustomerId,
        customer_name: (customerName || 'Customer').trim().slice(0, 50),
        customer_phone: validMobile,
        customer_email: cleanEmail,
      },
      order_meta: {
        return_url: `${origin}/user/${storeId}?cf_order_id={order_id}`,
      },
    };

    const cfRes = await fetch(`${baseUrl}/orders`, {
      method: 'POST',
      headers: {
        'x-client-id': cfAppId,
        'x-client-secret': cfSecretKey,
        'x-api-version': '2023-08-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(cfPayload),
    });

    const cfData = await cfRes.json();

    if (!cfRes.ok || !cfData.payment_session_id) {
      const errorMsg =
        cfData.message ||
        cfData.error ||
        `Cashfree authentication failed (${cfRes.status})`;
      console.error('[Cashfree Session Error]:', cfData);
      return NextResponse.json(
        {
          error: `${errorMsg}. Please check that your Cashfree App ID and Secret Key match the environment (${cfEnv}).`,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      paymentSessionId: cfData.payment_session_id,
      orderId: cfData.order_id,
      cfOrderId: cfData.cf_order_id,
      env: cfEnv,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
