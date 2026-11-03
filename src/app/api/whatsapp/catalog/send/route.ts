import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth/account'
import { checkRateLimit, rateLimitResponse, RATE_LIMITS } from '@/lib/rate-limit'
import { sendMessageToConversation, SendMessageError } from '@/lib/whatsapp/send-message'
import type { InteractiveMessagePayload } from '@/types'

export async function POST(request: Request) {
  try {
    const { supabase, accountId, userId } = await requireRole('agent')

    const limit = checkRateLimit(`send:${userId}`, RATE_LIMITS.send)
    if (!limit.success) {
      return rateLimitResponse(limit)
    }

    const body = await request.json()
    const {
      conversation_id,
      catalog_kind, // 'product' | 'product_list' | 'catalog_message'
      product_retailer_id,
      product_name,
      product_price,
      product_currency,
      sections,
      header_text,
      body_text,
      footer_text,
    } = body

    if (!conversation_id) {
      return NextResponse.json(
        { error: 'conversation_id is required' },
        { status: 400 }
      )
    }

    // Load whatsapp config to get catalog_id
    const { data: config, error: configErr } = await supabase
      .from('whatsapp_config')
      .select('catalog_id')
      .eq('account_id', accountId)
      .single()

    if (configErr || !config?.catalog_id) {
      return NextResponse.json(
        { error: 'No Meta Catalog ID configured. Go to Settings → Catalog & Payments.' },
        { status: 400 }
      )
    }

    let interactivePayload: InteractiveMessagePayload

    if (catalog_kind === 'product') {
      if (!product_retailer_id) {
        return NextResponse.json(
          { error: 'product_retailer_id is required for single product message' },
          { status: 400 }
        )
      }
      interactivePayload = {
        kind: 'product',
        catalog_id: config.catalog_id,
        product_retailer_id,
        product_name: product_name || undefined,
        product_price: product_price !== undefined ? Number(product_price) : undefined,
        product_currency: product_currency || undefined,
        body: body_text || undefined,
        footer: footer_text || undefined,
      }
    } else if (catalog_kind === 'product_list') {
      if (!Array.isArray(sections) || sections.length === 0) {
        return NextResponse.json(
          { error: 'sections array with product_retailer_ids is required for product list' },
          { status: 400 }
        )
      }
      interactivePayload = {
        kind: 'product_list',
        catalog_id: config.catalog_id,
        header: header_text || 'Featured Collection',
        body: body_text || 'Select an item to view details and order',
        footer: footer_text || undefined,
        sections,
      }
    } else if (catalog_kind === 'catalog_message') {
      interactivePayload = {
        kind: 'catalog_message',
        body: body_text || 'Explore our full product catalog directly on WhatsApp!',
        footer: footer_text || undefined,
        thumbnail_product_retailer_id: product_retailer_id || undefined,
      }
    } else {
      return NextResponse.json(
        { error: `Invalid catalog_kind "${catalog_kind}". Expected product, product_list, or catalog_message.` },
        { status: 400 }
      )
    }

    const result = await sendMessageToConversation(supabase, accountId, {
      conversationId: conversation_id,
      messageType: 'interactive',
      interactivePayload,
    })

    return NextResponse.json({
      success: true,
      message_id: result.messageId,
      whatsapp_message_id: result.whatsappMessageId,
    })
  } catch (error) {
    if (error instanceof SendMessageError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    const message = error instanceof Error ? error.message : 'Failed to send catalog message'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

