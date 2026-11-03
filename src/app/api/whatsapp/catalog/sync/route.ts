import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth/account'
import { decrypt } from '@/lib/whatsapp/encryption'
import { fetchMetaCatalogProducts } from '@/lib/whatsapp/meta-catalog'

export async function POST() {
  try {
    const { supabase, accountId } = await requireRole('agent')

    // Load whatsapp config
    const { data: config, error: configErr } = await supabase
      .from('whatsapp_config')
      .select('*')
      .eq('account_id', accountId)
      .single()

    if (configErr || !config) {
      return NextResponse.json(
        { error: 'WhatsApp is not configured for this account.' },
        { status: 400 }
      )
    }

    if (!config.catalog_id) {
      return NextResponse.json(
        { error: 'No Meta Catalog ID configured. Go to Settings → Catalog & Payments.' },
        { status: 400 }
      )
    }

    const accessToken = decrypt(config.access_token)

    // Fetch products from Meta Commerce Catalog
    const metaProducts = await fetchMetaCatalogProducts({
      catalogId: config.catalog_id,
      accessToken,
      limit: 150,
    })

    if (!metaProducts || metaProducts.length === 0) {
      return NextResponse.json({
        synced: 0,
        message: 'No products found in this Meta Commerce Catalog.',
      })
    }

    // Upsert into commerce_products table
    const rowsToUpsert = metaProducts.map((p) => {
      // Parse price safely: Meta returns string formatted price (e.g. "$19.99" or "19.99" or "1999")
      let parsedPrice = 0
      if (typeof p.price === 'string') {
        const clean = p.price.replace(/[^0-9.]/g, '')
        parsedPrice = parseFloat(clean) || 0
      } else if (typeof p.price === 'number') {
        parsedPrice = p.price
      }

      return {
        account_id: accountId,
        catalog_id: config.catalog_id,
        retailer_id: p.retailer_id || p.id,
        name: p.name || 'Unnamed Product',
        description: p.description || null,
        price: parsedPrice,
        currency: (p.currency || 'USD').toUpperCase(),
        image_url: p.image_url || null,
        url: p.url || null,
        availability: p.availability === 'out of stock' ? 'out of stock' : 'in stock',
        category: p.category || null,
        updated_at: new Date().toISOString(),
      }
    })

    const { error: upsertErr } = await supabase
      .from('commerce_products')
      .upsert(rowsToUpsert, {
        onConflict: 'account_id,retailer_id',
      })

    if (upsertErr) {
      return NextResponse.json(
        { error: `Database sync error: ${upsertErr.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      synced: rowsToUpsert.length,
      message: `Successfully synchronized ${rowsToUpsert.length} products from Meta Catalog.`,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Sync failed'
    const isPermission =
      message.includes('catalog_management') ||
      message.includes('Unsupported get request') ||
      message.includes('permission')
    return NextResponse.json(
      {
        error: message,
        requiresCatalogPermission: isPermission,
      },
      { status: 400 }
    )
  }
}

