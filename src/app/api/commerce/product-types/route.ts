import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/account';

const DEFAULT_PRODUCT_TYPES = [
  { id: 'type-veg', name: 'Veg', description: 'Vegetarian food items', is_active: true, created_at: new Date().toISOString() },
  { id: 'type-nonveg', name: 'Non-Veg', description: 'Non-vegetarian food items', is_active: true, created_at: new Date().toISOString() },
  { id: 'type-general', name: 'General', description: 'Standard products and retail goods', is_active: true, created_at: new Date().toISOString() },
  { id: 'type-beverages', name: 'Beverages', description: 'Drinks, juices, and liquid items', is_active: true, created_at: new Date().toISOString() },
];

export async function GET(request: Request) {
  try {
    const { supabase, accountId } = await requireRole('viewer');
    const { searchParams } = new URL(request.url);

    const page = Math.max(parseInt(searchParams.get('page') || '1', 10), 1);
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '50', 10), 1), 100);
    const search = searchParams.get('search')?.trim() || '';

    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabase
      .from('commerce_product_types')
      .select('*', { count: 'exact' })
      .eq('account_id', accountId)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (search) {
      query = query.ilike('name', `%${search}%`);
    }

    const { data, count, error } = await query;

    if (error) {
      // If table does not exist yet in Supabase, return graceful default types
      if (error.code === '42P01') {
        const filtered = search
          ? DEFAULT_PRODUCT_TYPES.filter((t) => t.name.toLowerCase().includes(search.toLowerCase()))
          : DEFAULT_PRODUCT_TYPES;
        return NextResponse.json({
          productTypes: filtered,
          total: filtered.length,
          page,
          limit,
          totalPages: 1,
          tableMissing: true,
          message: 'Table commerce_product_types does not exist yet. Migration 062 provided.',
        });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const total = count ?? (data?.length || 0);
    const totalPages = Math.max(Math.ceil(total / limit), 1);

    return NextResponse.json({
      productTypes: data || [],
      total,
      page,
      limit,
      totalPages,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch product types';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { supabase, accountId } = await requireRole('agent');
    const body = await request.json();

    const name = typeof body?.name === 'string' ? body.name.trim() : '';
    const description = typeof body?.description === 'string' ? body.description.trim() : null;

    if (!name) {
      return NextResponse.json({ error: 'Product type name is required' }, { status: 400 });
    }

    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    const { data, error } = await supabase
      .from('commerce_product_types')
      .insert({
        account_id: accountId,
        name,
        description,
        slug,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'A product type with this name already exists' },
          { status: 409 }
        );
      }
      if (error.code === '42P01') {
        return NextResponse.json(
          { error: 'Database table missing: Please run migration 062_commerce_product_types.sql in Supabase SQL editor.' },
          { status: 500 }
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ productType: data }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create product type';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const { supabase, accountId } = await requireRole('agent');
    const body = await request.json();

    const id = body?.id;
    const name = typeof body?.name === 'string' ? body.name.trim() : '';
    const description = typeof body?.description === 'string' ? body.description.trim() : null;

    if (!id) {
      return NextResponse.json({ error: 'Product type ID is required' }, { status: 400 });
    }
    if (!name) {
      return NextResponse.json({ error: 'Product type name is required' }, { status: 400 });
    }

    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    const { data, error } = await supabase
      .from('commerce_product_types')
      .update({
        name,
        description,
        slug,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('account_id', accountId)
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'A product type with this name already exists' },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ productType: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update product type';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { supabase, accountId } = await requireRole('agent');
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Product type ID is required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('commerce_product_types')
      .delete()
      .eq('id', id)
      .eq('account_id', accountId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete product type';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
