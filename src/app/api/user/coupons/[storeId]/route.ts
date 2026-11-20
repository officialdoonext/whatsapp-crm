import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/flows/admin-client';

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

    // 1. Fetch store's account_id
    const { data: store, error: storeError } = await admin
      .from('stores')
      .select('account_id')
      .eq('id', storeId)
      .maybeSingle();

    if (storeError || !store) {
      return NextResponse.json({ coupons: [] });
    }

    // 2. Fetch active coupons
    const nowIso = new Date().toISOString();
    const { data: coupons, error: couponError } = await admin
      .from('store_coupons')
      .select('id, code, coupon_type, discount_type, discount_value, min_order_value, max_discount, applicable_product_ids, applicable_category_ids, valid_until, description')
      .eq('account_id', store.account_id)
      .eq('is_active', true)
      .or(`valid_until.is.null,valid_until.gte.${nowIso}`)
      .order('min_order_value', { ascending: true });

    if (couponError) {
      return NextResponse.json({ coupons: [] });
    }

    return NextResponse.json({ coupons: coupons || [] });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
