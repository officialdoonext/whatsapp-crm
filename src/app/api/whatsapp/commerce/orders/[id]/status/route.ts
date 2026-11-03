import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth/account'

const VALID_STATUSES = ['pending', 'processing', 'paid', 'completed', 'cancelled'] as const

export async function PATCH(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const params = await props.params
    const orderId = params.id
    const { supabase, accountId } = await requireRole('agent')

    const body = await request.json()
    const { status } = body

    if (!status || !VALID_STATUSES.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` },
        { status: 400 }
      )
    }

    const updates: Record<string, unknown> = {
      status,
      updated_at: new Date().toISOString(),
    }

    if (status === 'paid' || status === 'completed') {
      updates.paid_at = new Date().toISOString()
    }

    const { data: order, error } = await supabase
      .from('commerce_orders')
      .update(updates)
      .eq('id', orderId)
      .eq('account_id', accountId)
      .select('*')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      order,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update order status'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

