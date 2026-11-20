import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/account';

export async function GET(request: Request) {
  try {
    const { supabase, accountId } = await requireRole('viewer');
    const { searchParams } = new URL(request.url);

    const page = Math.max(parseInt(searchParams.get('page') || '1', 10), 1);
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '24', 10), 1), 100);
    const search = searchParams.get('search')?.trim() || '';

    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabase
      .from('commerce_categories')
      .select('*', { count: 'exact' })
      .eq('account_id', accountId)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (search) {
      query = query.ilike('name', `%${search}%`);
    }

    const { data, count, error } = await query;

    if (error) {
      // If table does not exist yet, return clean empty state without crashing
      if (error.code === '42P01') {
        return NextResponse.json({
          categories: [],
          total: 0,
          page,
          limit,
          totalPages: 1,
          tableMissing: true,
          message: 'Table commerce_categories does not exist yet. Please run migration 057.',
        });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const total = count ?? (data?.length || 0);
    const totalPages = Math.max(Math.ceil(total / limit), 1);

    return NextResponse.json({
      categories: data || [],
      total,
      page,
      limit,
      totalPages,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch categories';
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
      return NextResponse.json({ error: 'Category name is required' }, { status: 400 });
    }

    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    const { data, error } = await supabase
      .from('commerce_categories')
      .insert({
        account_id: accountId,
        name,
        description,
        slug,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'A category with this name already exists' },
          { status: 409 }
        );
      }
      if (error.code === '42P01') {
        return NextResponse.json(
          { error: 'Database table missing: Please run migration 057_commerce_categories_and_variants.sql' },
          { status: 500 }
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ category: data }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create category';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { supabase, accountId } = await requireRole('agent');
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Category ID is required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('commerce_categories')
      .delete()
      .eq('id', id)
      .eq('account_id', accountId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete category';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
