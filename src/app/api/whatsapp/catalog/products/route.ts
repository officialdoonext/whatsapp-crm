import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth/account'
import { decrypt } from '@/lib/whatsapp/encryption'
import { createMetaCatalogProduct } from '@/lib/whatsapp/meta-catalog'

export async function GET(request: Request) {
  try {
    const { supabase, accountId } = await requireRole('viewer')
    const { searchParams } = new URL(request.url)

    const search = searchParams.get('q')?.trim()
    const category = searchParams.get('category')?.trim()
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '50', 10), 1), 200)

    let query = supabase
      .from('commerce_products')
      .select('*')
      .eq('account_id', accountId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (search) {
      query = query.or(`name.ilike.%${search}%,retailer_id.ilike.%${search}%,description.ilike.%${search}%`)
    }

    if (category) {
      query = query.eq('category', category)
    }

    const { data: products, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      products: products || [],
      count: products?.length || 0,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch products'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const { supabase, accountId } = await requireRole('agent')

    const body = await request.json()
    const {
      retailer_id,
      name,
      description,
      price,
      currency = 'USD',
      image_url,
      url,
      availability = 'in stock',
      category,
      sync_to_meta = true,
    } = body

    if (!retailer_id || !name || price === undefined) {
      return NextResponse.json(
        { error: 'Product SKU (retailer_id), name, and price are required.' },
        { status: 400 }
      )
    }

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
        { error: 'No Meta Commerce Catalog ID configured. Go to Settings → Catalog & Payments.' },
        { status: 400 }
      )
    }

    const numPrice = Number(price) || 0
    let metaWarning: string | null = null

    // If requested, attempt to upload product directly to Meta Commerce Catalog
    if (sync_to_meta) {
      const accessToken = decrypt(config.access_token)
      try {
        await createMetaCatalogProduct({
          catalogId: config.catalog_id,
          accessToken,
          product: {
            retailer_id,
            name,
            description,
            price: numPrice,
            currency,
            image_url,
            url,
            availability,
            category,
          },
        })
      } catch (metaErr) {
        const msg = metaErr instanceof Error ? metaErr.message : 'Meta upload failed'
        const isPermission =
          msg.includes('catalog_management') ||
          msg.includes('Unsupported get request') ||
          msg.includes('permission')

        if (isPermission) {
          metaWarning =
            "Product saved in local catalog! Note: To also sync products to Meta Catalog via API, grant 'catalog_management' permission to your System User token in Meta Business Suite."
        } else {
          return NextResponse.json(
            { error: `Failed to create product in Meta Catalog: ${msg}` },
            { status: 400 }
          )
        }
      }
    }

    // Upsert into local commerce_products
    const { data: product, error: insertErr } = await supabase
      .from('commerce_products')
      .upsert(
        {
          account_id: accountId,
          catalog_id: config.catalog_id,
          retailer_id,
          name,
          description: description || null,
          price: numPrice,
          currency: currency.toUpperCase(),
          image_url: image_url || null,
          url: url || null,
          availability,
          category: category || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'account_id,retailer_id' }
      )
      .select('*')
      .single()

    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      product,
      warning: metaWarning,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create product'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

