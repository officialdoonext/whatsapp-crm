import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/account';
import { sendOrderStageNotification } from '@/lib/commerce/store-notifications';
import type { StoreOrder, StoreOrderStage } from '@/types';

export async function GET(request: Request) {
  try {
    const { supabase, accountId } = await requireRole('viewer');
    const { searchParams } = new URL(request.url);

    const page = Math.max(parseInt(searchParams.get('page') || '1', 10), 1);
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '24', 10), 1), 100);
    const status = searchParams.get('status')?.trim();
    const search = searchParams.get('search')?.trim();

    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabase
      .from('store_orders')
      .select('*', { count: 'exact' })
      .eq('account_id', accountId)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (status && status !== 'all') {
      query = query.eq('order_status', status);
    }

    if (search) {
      query = query.or(
        `order_number.ilike.%${search}%,customer_name.ilike.%${search}%,customer_mobile.ilike.%${search}%`
      );
    }

    const { data, count, error } = await query;

    if (error) {
      if (error.code === '42P01') {
        return NextResponse.json({ orders: [], total: 0, page: 1, totalPages: 1 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const total = count ?? (data?.length || 0);
    const totalPages = Math.ceil(total / limit) || 1;

    return NextResponse.json({
      orders: data || [],
      total,
      page,
      totalPages,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const { supabase, accountId } = await requireRole('agent');
    const body = await request.json();

    const { id, order_status, note } = body;
    if (!id || !order_status) {
      return NextResponse.json({ error: 'Order ID and order status are required' }, { status: 400 });
    }

    // 1. Fetch current order
    const { data: existing, error: findError } = await supabase
      .from('store_orders')
      .select('*')
      .eq('id', id)
      .eq('account_id', accountId)
      .single();

    if (findError || !existing) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const previousStatus = existing.order_status;
    const newStatus = order_status as StoreOrderStage;

    // Build updated timeline
    const timeline = Array.isArray(existing.status_timeline) ? [...existing.status_timeline] : [];
    if (newStatus !== previousStatus) {
      timeline.push({
        status: newStatus,
        timestamp: new Date().toISOString(),
        note: note || `Status updated to ${newStatus}`,
      });
    }

    const updates: Record<string, unknown> = {
      order_status: newStatus,
      status_timeline: timeline,
      updated_at: new Date().toISOString(),
    };

    // If marked delivered, update payment status to paid if it was pending
    if (newStatus === 'delivered' && existing.payment_status === 'pending') {
      updates.payment_status = 'paid';
    }

    const { data: updated, error: updateError } = await supabase
      .from('store_orders')
      .update(updates)
      .eq('id', id)
      .eq('account_id', accountId)
      .select('*')
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // 2. Dispatch WhatsApp notification if status changed
    let notificationResult = null;
    if (newStatus !== previousStatus) {
      try {
        notificationResult = await sendOrderStageNotification(updated as StoreOrder, newStatus, note);
      } catch (err) {
        console.warn('Failed to send WhatsApp stage notification:', err);
      }
    }

    return NextResponse.json({
      order: updated,
      notification: notificationResult,
      message: `Order status updated to ${newStatus}`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
