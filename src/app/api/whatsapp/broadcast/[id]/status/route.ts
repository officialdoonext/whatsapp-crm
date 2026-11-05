import { NextResponse } from 'next/server';
import { requireRole, toErrorResponse } from '@/lib/auth/account';
import { supabaseAdmin } from '@/lib/flows/admin-client';
import { getT } from '@/lib/i18n/translate';

const t = getT('Api');

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { supabase, accountId } = await requireRole('agent');
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const action = body?.action as 'pause' | 'cancel' | undefined;

    if (!action || !['pause', 'cancel'].includes(action)) {
      return NextResponse.json(
        { error: 'Action must be "pause" or "cancel"' },
        { status: 400 }
      );
    }

    const { data: broadcast, error: fetchError } = await supabase
      .from('broadcasts')
      .select('id, status')
      .eq('id', id)
      .eq('account_id', accountId)
      .maybeSingle();

    if (fetchError || !broadcast) {
      return NextResponse.json(
        { error: 'Broadcast not found' },
        { status: 404 }
      );
    }

    const admin = supabaseAdmin();

    if (action === 'pause') {
      if (broadcast.status !== 'sending') {
        return NextResponse.json(
          { error: `Cannot pause a broadcast with status "${broadcast.status}"` },
          { status: 400 }
        );
      }

      await admin
        .from('broadcasts')
        .update({ status: 'paused', updated_at: new Date().toISOString() })
        .eq('id', id);

      return NextResponse.json({
        success: true,
        broadcast_id: id,
        status: 'paused',
      });
    }

    if (action === 'cancel') {
      if (['sent', 'cancelled'].includes(broadcast.status)) {
        return NextResponse.json(
          { error: `Broadcast is already ${broadcast.status}` },
          { status: 400 }
        );
      }

      await admin
        .from('broadcasts')
        .update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .eq('id', id);

      // Cancel remaining pending recipients
      await admin
        .from('broadcast_recipients')
        .update({
          status: 'failed',
          error_message: 'Campaign cancelled by user',
          updated_at: new Date().toISOString(),
        })
        .eq('broadcast_id', id)
        .eq('status', 'pending');

      return NextResponse.json({
        success: true,
        broadcast_id: id,
        status: 'cancelled',
      });
    }

    return NextResponse.json({ error: 'Unsupported action' }, { status: 400 });
  } catch (error) {
    console.error('Error updating broadcast status:', error);
    return toErrorResponse(error);
  }
}

