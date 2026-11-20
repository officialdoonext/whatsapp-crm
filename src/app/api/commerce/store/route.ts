import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/account';
import { computeStoreStatus } from '@/lib/commerce/store-status';

export async function GET() {
  try {
    const { supabase, accountId } = await requireRole('viewer');

    const { data: store, error } = await supabase
      .from('stores')
      .select('*')
      .eq('account_id', accountId)
      .maybeSingle();

    if (error) {
      if (error.code === '42P01') {
        // Table not created yet
        return NextResponse.json({
          store: null,
          tableMissing: true,
          message: 'Stores table is not yet migrated.',
        });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!store) {
      return NextResponse.json({ store: null });
    }

    const status = computeStoreStatus(store);

    return NextResponse.json({
      store: {
        ...store,
        is_open_now: status.isOpen,
        status_label: status.statusLabel,
        status_description: status.statusDescription,
      },
    });
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
      name,
      mobile_number,
      address,
      logo_url,
      opening_time = '09:00',
      closing_time = '22:00',
      working_days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
      manual_override = 'auto',
      metadata = {},
    } = body;

    // Validation
    const trimmedName = typeof name === 'string' ? name.trim() : '';
    const trimmedMobile = typeof mobile_number === 'string' ? mobile_number.trim() : '';

    if (!trimmedName) {
      return NextResponse.json({ error: 'Store name is required' }, { status: 400 });
    }

    if (!trimmedMobile) {
      return NextResponse.json({ error: 'Mobile number is required' }, { status: 400 });
    }

    // Constraint: Only one store can be added per account
    const { data: existingStore, error: checkError } = await supabase
      .from('stores')
      .select('id, name')
      .eq('account_id', accountId)
      .maybeSingle();

    if (checkError && checkError.code !== '42P01') {
      return NextResponse.json({ error: checkError.message }, { status: 500 });
    }

    if (existingStore) {
      return NextResponse.json(
        { error: `A store "${existingStore.name}" already exists for this account. Only one store is allowed.` },
        { status: 409 }
      );
    }

    const status = computeStoreStatus({
      manual_override,
      opening_time,
      closing_time,
      working_days,
    });

    const newRecord = {
      account_id: accountId,
      name: trimmedName,
      mobile_number: trimmedMobile,
      address: typeof address === 'string' ? address.trim() : null,
      logo_url: typeof logo_url === 'string' ? logo_url.trim() : null,
      is_online: status.isOpen,
      manual_override,
      opening_time,
      closing_time,
      working_days,
      metadata,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data: inserted, error: insertError } = await supabase
      .from('stores')
      .insert(newRecord)
      .select('*')
      .single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({
      store: {
        ...inserted,
        is_open_now: status.isOpen,
        status_label: status.statusLabel,
        status_description: status.statusDescription,
      },
      message: 'Store created successfully',
    }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const { supabase, accountId } = await requireRole('agent');
    const body = await request.json();

    const {
      name,
      mobile_number,
      address,
      logo_url,
      opening_time,
      closing_time,
      working_days,
      manual_override,
      metadata,
    } = body;

    // Verify existing store
    const { data: existing, error: findError } = await supabase
      .from('stores')
      .select('*')
      .eq('account_id', accountId)
      .maybeSingle();

    if (findError) {
      return NextResponse.json({ error: findError.message }, { status: 500 });
    }

    if (!existing) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    }

    const updatedOpeningTime = opening_time ?? existing.opening_time;
    const updatedClosingTime = closing_time ?? existing.closing_time;
    const updatedWorkingDays = working_days ?? existing.working_days;
    const updatedOverride = manual_override ?? existing.manual_override;

    const status = computeStoreStatus({
      manual_override: updatedOverride,
      opening_time: updatedOpeningTime,
      closing_time: updatedClosingTime,
      working_days: updatedWorkingDays,
    });

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
      is_online: status.isOpen,
    };

    if (typeof name === 'string' && name.trim()) {
      updates.name = name.trim();
    }
    if (typeof mobile_number === 'string' && mobile_number.trim()) {
      updates.mobile_number = mobile_number.trim();
    }
    if (address !== undefined) {
      updates.address = typeof address === 'string' ? address.trim() : null;
    }
    if (logo_url !== undefined) {
      updates.logo_url = typeof logo_url === 'string' ? logo_url.trim() : null;
    }
    if (opening_time !== undefined) {
      updates.opening_time = updatedOpeningTime;
    }
    if (closing_time !== undefined) {
      updates.closing_time = updatedClosingTime;
    }
    if (working_days !== undefined) {
      updates.working_days = updatedWorkingDays;
    }
    if (manual_override !== undefined) {
      updates.manual_override = updatedOverride;
    }
    if (metadata !== undefined) {
      updates.metadata = { ...(existing.metadata || {}), ...metadata };
    }

    const { data: updated, error: updateError } = await supabase
      .from('stores')
      .update(updates)
      .eq('id', existing.id)
      .eq('account_id', accountId)
      .select('*')
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({
      store: {
        ...updated,
        is_open_now: status.isOpen,
        status_label: status.statusLabel,
        status_description: status.statusDescription,
      },
      message: 'Store profile updated successfully',
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
