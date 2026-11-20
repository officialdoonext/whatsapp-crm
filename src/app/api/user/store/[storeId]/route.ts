import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/flows/admin-client';
import { computeStoreStatus } from '@/lib/commerce/store-status';

// In-Memory TTL Cache to avoid repeated Supabase queries and reduce egress + log ingestion
interface CacheEntry {
  data: any;
  expiresAt: number;
}
const storeCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 60 * 1000; // 60 seconds TTL

// Clean up expired entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of storeCache.entries()) {
    if (now > entry.expiresAt) {
      storeCache.delete(key);
    }
  }
}, 5 * 60 * 1000).unref?.();

export async function GET(
  request: Request,
  { params }: { params: Promise<{ storeId: string }> }
) {
  try {
    const { storeId } = await params;
    if (!storeId) {
      return NextResponse.json({ error: 'Store ID is required' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const page = Math.max(parseInt(searchParams.get('page') || '1', 10), 1);
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '24', 10), 1), 100);
    const category = searchParams.get('category')?.trim() || '';
    const search = searchParams.get('search')?.trim() || '';

    // Cache key incorporates store ID and filter/pagination arguments
    const cacheKey = `${storeId}:${page}:${limit}:${category}:${search}`;
    const cached = storeCache.get(cacheKey);
    if (cached && Date.now() < cached.expiresAt) {
      const cachedResponse = NextResponse.json(cached.data);
      cachedResponse.headers.set(
        'Cache-Control',
        'public, max-age=60, s-maxage=60, stale-while-revalidate=300'
      );
      cachedResponse.headers.set('X-Store-Cache', 'HIT');
      return cachedResponse;
    }

    const admin = supabaseAdmin();

    // 1. Fetch only required store fields instead of SELECT *
    const { data: store, error: storeError } = await admin
      .from('stores')
      .select('id, account_id, name, mobile_number, address, logo_url, opening_time, closing_time, working_days, manual_override, expiry_date, payment_gateway_config')
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

    // 4. Fetch categories for this account (only required fields)
    const { data: categories } = await admin
      .from('commerce_categories')
      .select('id, name, slug, description')
      .eq('account_id', store.account_id)
      .eq('is_active', true)
      .order('name', { ascending: true });

    // 5. Fetch active products with pagination and only customer-facing fields
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let prodQuery = admin
      .from('store_products')
      .select(
        'id, name, short_code, description, category, food_type, list_price, sale_price, images, image_url, variants_config, is_active',
        { count: 'exact' }
      )
      .eq('account_id', store.account_id)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (category && category !== 'all') {
      prodQuery = prodQuery.ilike('category', `%${category}%`);
    }

    if (search) {
      prodQuery = prodQuery.or(`name.ilike.%${search}%,short_code.ilike.%${search}%`);
    }

    const { data: products, count: prodCount } = await prodQuery;

    // 6. Sanitize payment config to expose only active, valid public credentials
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

    const totalProducts = prodCount ?? (products?.length || 0);
    const totalPages = Math.ceil(totalProducts / limit) || 1;

    const payload = {
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
      pagination: {
        total: totalProducts,
        page,
        totalPages,
        hasMore: page < totalPages,
      },
      paymentConfig: publicPaymentConfig,
    };

    // Store in-memory cache for 60 seconds
    storeCache.set(cacheKey, {
      data: payload,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });

    const response = NextResponse.json(payload);
    response.headers.set(
      'Cache-Control',
      'public, max-age=60, s-maxage=60, stale-while-revalidate=300'
    );
    response.headers.set('X-Store-Cache', 'MISS');
    return response;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
