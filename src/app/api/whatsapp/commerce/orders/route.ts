import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth/account'

export async function GET(request: Request) {
  try {
    const { supabase, accountId } = await requireRole('viewer')
    const { searchParams } = new URL(request.url)

    const status = searchParams.get('status')
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '50', 10), 1), 200)

    let query = supabase
      .from('commerce_orders')
      .select('*, contact:contacts(id, name, phone, email, avatar_url)')
      .eq('account_id', accountId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (status && status !== 'all') {
      query = query.eq('status', status)
    }

    const { data: orders, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Compute metrics
    const { data: allOrders } = await supabase
      .from('commerce_orders')
      .select('status, total_amount, currency')
      .eq('account_id', accountId)

    let totalRevenue = 0
    let pendingCount = 0
    let paidCount = 0

    if (allOrders) {
      for (const ord of allOrders) {
        if (ord.status === 'paid' || ord.status === 'completed') {
          totalRevenue += Number(ord.total_amount || 0)
          paidCount++
        } else if (ord.status === 'pending') {
          pendingCount++
        }
      }
    }

    return NextResponse.json({
      orders: orders || [],
      count: orders?.length || 0,
      metrics: {
        totalRevenue,
        pendingCount,
        paidCount,
        totalOrders: allOrders?.length || 0,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch orders'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

