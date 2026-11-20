import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/account';

export async function GET(request: Request) {
  try {
    const { supabase, accountId } = await requireRole('viewer');
    const { searchParams } = new URL(request.url);

    const type = searchParams.get('type');
    const search = searchParams.get('search')?.trim();

    let query = supabase
      .from('store_coupons')
      .select('*')
      .eq('account_id', accountId)
      .order('created_at', { ascending: false });

    if (type && (type === 'order' || type === 'product')) {
      query = query.eq('coupon_type', type);
    }

    if (search) {
      query = query.or(`code.ilike.%${search}%,description.ilike.%${search}%`);
    }

    const { data, error } = await query;

    if (error) {
      if (error.code === '42P01') {
        return NextResponse.json({ coupons: [] });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ coupons: data || [] });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { supabase, accountId } = await requireRole('agent');
    const body = await request.json();

    const {
      code,
      coupon_type = 'order',
      discount_type = 'flat',
      discount_value = 0,
      min_order_value = 0,
      max_discount = null,
      applicable_product_ids = [],
      applicable_category_ids = [],
      valid_from = new Date().toISOString(),
      valid_until = null,
      usage_limit = null,
      is_active = true,
      description = '',
    } = body;

    const trimmedCode = typeof code === 'string' ? code.trim().toUpperCase() : '';
    if (!trimmedCode) {
      return NextResponse.json({ error: 'Coupon code is required' }, { status: 400 });
    }

    const numericDiscount = parseFloat(discount_value) || 0;
    if (numericDiscount <= 0) {
      return NextResponse.json({ error: 'Discount value must be greater than 0' }, { status: 400 });
    }

    const newRecord = {
      account_id: accountId,
      code: trimmedCode,
      coupon_type,
      discount_type,
      discount_value: numericDiscount,
      min_order_value: parseFloat(min_order_value) || 0,
      max_discount: max_discount ? parseFloat(max_discount) : null,
      applicable_product_ids: Array.isArray(applicable_product_ids) ? applicable_product_ids : [],
      applicable_category_ids: Array.isArray(applicable_category_ids) ? applicable_category_ids : [],
      valid_from,
      valid_until: valid_until || null,
      usage_limit: usage_limit ? parseInt(usage_limit, 10) : null,
      used_count: 0,
      is_active: Boolean(is_active),
      description: typeof description === 'string' ? description.trim() : null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('store_coupons')
      .insert(newRecord)
      .select('*')
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: `Coupon "${trimmedCode}" already exists.` }, { status: 409 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ coupon: data, message: 'Coupon created successfully' }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const { supabase, accountId } = await requireRole('agent');
    const body = await request.json();

    const { id, ...updates } = body;
    if (!id) {
      return NextResponse.json({ error: 'Coupon ID is required' }, { status: 400 });
    }

    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (updates.code) updatePayload.code = updates.code.trim().toUpperCase();
    if (updates.coupon_type) updatePayload.coupon_type = updates.coupon_type;
    if (updates.discount_type) updatePayload.discount_type = updates.discount_type;
    if (updates.discount_value !== undefined) updatePayload.discount_value = parseFloat(updates.discount_value) || 0;
    if (updates.min_order_value !== undefined) updatePayload.min_order_value = parseFloat(updates.min_order_value) || 0;
    if (updates.max_discount !== undefined) updatePayload.max_discount = updates.max_discount ? parseFloat(updates.max_discount) : null;
    if (updates.applicable_product_ids !== undefined) updatePayload.applicable_product_ids = updates.applicable_product_ids;
    if (updates.applicable_category_ids !== undefined) updatePayload.applicable_category_ids = updates.applicable_category_ids;
    if (updates.valid_until !== undefined) updatePayload.valid_until = updates.valid_until || null;
    if (updates.usage_limit !== undefined) updatePayload.usage_limit = updates.usage_limit ? parseInt(updates.usage_limit, 10) : null;
    if (updates.is_active !== undefined) updatePayload.is_active = Boolean(updates.is_active);
    if (updates.description !== undefined) updatePayload.description = updates.description;

    const { data, error } = await supabase
      .from('store_coupons')
      .update(updatePayload)
      .eq('id', id)
      .eq('account_id', accountId)
      .select('*')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ coupon: data, message: 'Coupon updated successfully' });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { supabase, accountId } = await requireRole('agent');
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Coupon ID is required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('store_coupons')
      .delete()
      .eq('id', id)
      .eq('account_id', accountId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ message: 'Coupon deleted successfully' });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
