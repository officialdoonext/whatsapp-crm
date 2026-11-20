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
      .from('commerce_variants')
      .select('*', { count: 'exact' })
      .eq('account_id', accountId)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (search) {
      query = query.ilike('label', `%${search}%`);
    }

    const { data, count, error } = await query;

    if (error) {
      if (error.code === '42P01') {
        return NextResponse.json({
          variants: [],
          total: 0,
          page,
          limit,
          totalPages: 1,
          tableMissing: true,
          message: 'Table commerce_variants does not exist yet. Please run migration 057.',
        });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const total = count ?? (data?.length || 0);
    const totalPages = Math.max(Math.ceil(total / limit), 1);

    return NextResponse.json({
      variants: data || [],
      total,
      page,
      limit,
      totalPages,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch variants';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { supabase, accountId } = await requireRole('agent');
    const body = await request.json();

    const label = typeof body?.label === 'string' ? body.label.trim() : '';
    const description = typeof body?.description === 'string' ? body.description.trim() : null;
    let options: string[] = [];
    if (Array.isArray(body?.options)) {
      options = body.options.map((opt: unknown) => String(opt).trim()).filter(Boolean);
    } else if (typeof body?.options === 'string') {
      options = body.options.split(',').map((opt: string) => opt.trim()).filter(Boolean);
    }

    if (!label) {
      return NextResponse.json({ error: 'Variant label is required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('commerce_variants')
      .insert({
        account_id: accountId,
        label,
        options,
        description,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'A variant with this label already exists' },
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

    return NextResponse.json({ variant: data }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create variant';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { supabase, accountId } = await requireRole('agent');
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Variant ID is required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('commerce_variants')
      .delete()
      .eq('id', id)
      .eq('account_id', accountId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete variant';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
