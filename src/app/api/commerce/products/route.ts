import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/account';

export async function GET(request: Request) {
  try {
    const { supabase, accountId } = await requireRole('viewer');
    const { searchParams } = new URL(request.url);

    const page = Math.max(parseInt(searchParams.get('page') || '1', 10), 1);
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '24', 10), 1), 100);
    const search = searchParams.get('search')?.trim() || '';
    const foodType = searchParams.get('food_type')?.trim() || '';

    const from = (page - 1) * limit;
    const to = from + limit - 1;

    // 1. Primary: query dedicated store_products table
    let query = supabase
      .from('store_products')
      .select('*', { count: 'exact' })
      .eq('account_id', accountId)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (search) {
      query = query.or(`name.ilike.%${search}%,short_code.ilike.%${search}%`);
    }

    if (foodType && foodType !== 'all') {
      query = query.eq('food_type', foodType);
    }

    const { data, count, error } = await query;

    // 2. If store_products table doesn't exist yet, query only non-catalog items
    if (error && error.code === '42P01') {
      let fallbackQuery = supabase
        .from('commerce_products')
        .select('*', { count: 'exact' })
        .eq('account_id', accountId)
        .eq('catalog_id', 'default') // Exclude all Meta catalog products!
        .order('created_at', { ascending: false })
        .range(from, to);

      if (search) {
        fallbackQuery = fallbackQuery.or(`name.ilike.%${search}%,retailer_id.ilike.%${search}%`);
      }

      if (foodType && foodType !== 'all') {
        fallbackQuery = fallbackQuery.eq('food_type', foodType);
      }

      const { data: fbData, count: fbCount, error: fbErr } = await fallbackQuery;
      if (fbErr) {
        return NextResponse.json({ error: fbErr.message }, { status: 500 });
      }

      const fbTotal = fbCount ?? (fbData?.length || 0);
      return NextResponse.json({
        products: fbData || [],
        total: fbTotal,
        page,
        limit,
        totalPages: Math.max(Math.ceil(fbTotal / limit), 1),
      });
    }

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const total = count ?? (data?.length || 0);
    const totalPages = Math.max(Math.ceil(total / limit), 1);

    return NextResponse.json({
      products: data || [],
      total,
      page,
      limit,
      totalPages,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch store products';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { supabase, accountId } = await requireRole('agent');
    const body = await request.json();

    const {
      name,
      short_code,
      description,
      list_price,
      sale_price,
      food_type = 'others',
      tax_config = { inclusive: true },
      variants_config = [],
      nutrition_table = [],
      images = [],
      category,
    } = body;

    const trimmedName = typeof name === 'string' ? name.trim() : '';
    if (!trimmedName) {
      return NextResponse.json({ error: 'Product name is required' }, { status: 400 });
    }

    const trimmedShortCode = typeof short_code === 'string' && short_code.trim()
      ? short_code.trim()
      : `SKU-${Date.now().toString(36).toUpperCase()}`;

    const numListPrice = Number(list_price) || 0;
    const numSalePrice = Number(sale_price) || numListPrice;
    const primaryImage = Array.isArray(images) && images.length > 0 ? images[0] : null;

    const payload = {
      account_id: accountId,
      name: trimmedName,
      short_code: trimmedShortCode,
      description: description?.trim() || null,
      list_price: numListPrice,
      sale_price: numSalePrice,
      image_url: primaryImage,
      images: Array.isArray(images) ? images : [],
      food_type,
      tax_config,
      variants_config,
      nutrition_table,
      category: category || null,
      is_active: true,
      metadata: {
        short_code: trimmedShortCode,
        food_type,
        list_price: numListPrice,
        sale_price: numSalePrice,
        tax_config,
        variants: variants_config,
        nutrition_table,
        images,
      },
      updated_at: new Date().toISOString(),
    };

    // 1. Try insert into store_products
    const { data, error } = await supabase
      .from('store_products')
      .insert(payload)
      .select()
      .single();

    // 2. Fallback to commerce_products with catalog_id = 'default' if table missing
    if (error && error.code === '42P01') {
      const fbPayload = {
        ...payload,
        catalog_id: 'default',
        retailer_id: trimmedShortCode,
        price: numSalePrice,
        currency: 'INR',
        availability: 'in stock',
      };

      const { data: fbData, error: fbErr } = await supabase
        .from('commerce_products')
        .upsert(fbPayload, { onConflict: 'account_id,retailer_id' })
        .select()
        .single();

      if (fbErr) {
        return NextResponse.json({ error: fbErr.message }, { status: 500 });
      }

      return NextResponse.json({ product: fbData }, { status: 201 });
    }

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ product: data }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to save product';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const { supabase, accountId } = await requireRole('agent');
    const body = await request.json();

    const {
      id,
      name,
      short_code,
      description,
      list_price,
      sale_price,
      food_type = 'others',
      tax_config = { inclusive: true },
      variants_config = [],
      nutrition_table = [],
      images = [],
      category,
      is_active = true,
    } = body;

    if (!id) {
      return NextResponse.json({ error: 'Product ID is required for update' }, { status: 400 });
    }

    const trimmedName = typeof name === 'string' ? name.trim() : '';
    if (!trimmedName) {
      return NextResponse.json({ error: 'Product name is required' }, { status: 400 });
    }

    const numListPrice = Number(list_price) || 0;
    const numSalePrice = Number(sale_price) || numListPrice;
    const primaryImage = Array.isArray(images) && images.length > 0 ? images[0] : null;

    const payload = {
      name: trimmedName,
      short_code: short_code?.trim() || null,
      description: description?.trim() || null,
      list_price: numListPrice,
      sale_price: numSalePrice,
      image_url: primaryImage,
      images: Array.isArray(images) ? images : [],
      food_type,
      tax_config,
      variants_config,
      nutrition_table,
      category: category || null,
      is_active,
      metadata: {
        short_code,
        food_type,
        list_price: numListPrice,
        sale_price: numSalePrice,
        tax_config,
        variants: variants_config,
        nutrition_table,
        images,
      },
      updated_at: new Date().toISOString(),
    };

    // 1. Try update store_products
    const { data, error } = await supabase
      .from('store_products')
      .update(payload)
      .eq('id', id)
      .eq('account_id', accountId)
      .select()
      .single();

    // 2. Fallback update if store_products doesn't exist
    if (error && error.code === '42P01') {
      const { data: fbData, error: fbErr } = await supabase
        .from('commerce_products')
        .update({
          ...payload,
          price: numSalePrice,
        })
        .eq('id', id)
        .eq('account_id', accountId)
        .select()
        .single();

      if (fbErr) {
        return NextResponse.json({ error: fbErr.message }, { status: 500 });
      }

      return NextResponse.json({ product: fbData });
    }

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ product: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update product';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { supabase, accountId } = await requireRole('agent');
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Product ID is required' }, { status: 400 });
    }

    // Try delete from store_products
    const { error } = await supabase
      .from('store_products')
      .delete()
      .eq('id', id)
      .eq('account_id', accountId);

    if (error && error.code === '42P01') {
      // Fallback
      await supabase
        .from('commerce_products')
        .delete()
        .eq('id', id)
        .eq('account_id', accountId);
    } else if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete product';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
