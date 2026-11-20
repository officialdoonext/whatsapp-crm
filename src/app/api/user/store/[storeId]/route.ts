import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/flows/admin-client';
import { computeStoreStatus } from '@/lib/commerce/store-status';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ storeId: string }> }
) {
  try {
    const { storeId } = await params;
    if (!storeId) {
      return NextResponse.json({ error: 'Store ID is required' }, { status: 400 });
    }

    const admin = supabaseAdmin();

    // 1. Fetch store
    const { data: store, error: storeError } = await admin
      .from('stores')
      .select('*')
      .eq('id', storeId)
      .maybeSingle();

    if (storeError) {
      return NextResponse.json({ error: storeError.message }, { status: 500 });
    }

    if (!store) {
      return NextResponse.json({ error: 'Store not found or no longer active' }, { status: 404 });
    }

    // 2. Check Expiry Date
    let isExpired = false;
    if (store.expiry_date) {
      const expiry = new Date(store.expiry_date).getTime();
      if (Date.now() > expiry) {
        isExpired = true;
      }
    }

    // 3. Compute live status (Online/Offline)
    const status = computeStoreStatus(store);

    // 4. Fetch categories for this account
    const { data: categories } = await admin
      .from('commerce_categories')
      .select('id, name, slug, description')
      .eq('account_id', store.account_id)
      .eq('is_active', true)
      .order('name', { ascending: true });

    // 5. Fetch active products for this store's account
    const { data: products, error: prodError } = await admin
      .from('store_products')
      .select('*')
      .eq('account_id', store.account_id)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    // 6. Sanitize payment config to expose only active, valid methods
    const rawPg = (store.payment_gateway_config || {}) as Record<string, any>;
    const codEnabled = Boolean(rawPg.cod?.enabled);

    let onlineEnabled = false;
    let onlineProvider: 'razorpay' | 'cashfree' | 'phonepe' | null = null;
    let onlineKeyId = '';
    let onlineAppId = '';
    let onlineMerchantId = '';
    let onlineEnv = 'production';

    if (rawPg.online?.enabled) {
      const p = rawPg.online.provider;
      if (p === 'razorpay' && rawPg.online.razorpay?.key_id?.trim()) {
        onlineEnabled = true;
        onlineProvider = 'razorpay';
        onlineKeyId = rawPg.online.razorpay.key_id.trim();
      } else if (p === 'cashfree' && rawPg.online.cashfree?.app_id?.trim()) {
        onlineEnabled = true;
        onlineProvider = 'cashfree';
        onlineAppId = rawPg.online.cashfree.app_id.trim();
        onlineEnv = rawPg.online.cashfree.env || 'sandbox';
      } else if (p === 'phonepe' && rawPg.online.phonepe?.merchant_id?.trim()) {
        onlineEnabled = true;
        onlineProvider = 'phonepe';
        onlineMerchantId = rawPg.online.phonepe.merchant_id.trim();
        onlineEnv = rawPg.online.phonepe.env || 'uat';
      }
    } else {
      if (rawPg.razorpay?.enabled && rawPg.razorpay?.key_id?.trim()) {
        onlineEnabled = true;
        onlineProvider = 'razorpay';
        onlineKeyId = rawPg.razorpay.key_id.trim();
      } else if (rawPg.cashfree?.enabled && rawPg.cashfree?.app_id?.trim()) {
        onlineEnabled = true;
        onlineProvider = 'cashfree';
        onlineAppId = rawPg.cashfree.app_id.trim();
        onlineEnv = rawPg.cashfree.env || 'sandbox';
      } else if (rawPg.phonepe?.enabled && rawPg.phonepe?.merchant_id?.trim()) {
        onlineEnabled = true;
        onlineProvider = 'phonepe';
        onlineMerchantId = rawPg.phonepe.merchant_id.trim();
        onlineEnv = rawPg.phonepe.env || 'uat';
      }
    }

    const publicPaymentConfig = {
      cod: {
        enabled: codEnabled,
        min_order_value: rawPg.cod?.min_order_value || 0,
      },
      online: {
        enabled: onlineEnabled,
        provider: onlineProvider,
        key_id: onlineKeyId,
        app_id: onlineAppId,
        merchant_id: onlineMerchantId,
        env: onlineEnv,
      },
      hasAnyPaymentConfigured: codEnabled || onlineEnabled,
    };

    return NextResponse.json({
      store: {
        id: store.id,
        account_id: store.account_id,
        name: store.name,
        mobile_number: store.mobile_number,
        address: store.address,
        logo_url: store.logo_url,
        opening_time: store.opening_time,
        closing_time: store.closing_time,
        working_days: store.working_days,
        expiry_date: store.expiry_date,
      },
      isExpired,
      status,
      categories: categories || [],
      products: products || [],
      paymentConfig: publicPaymentConfig,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
