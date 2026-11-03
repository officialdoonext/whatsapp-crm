import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth/account'
import { decrypt, encrypt, isLegacyFormat } from '@/lib/whatsapp/encryption'
import { verifyMetaCatalog } from '@/lib/whatsapp/meta-catalog'

const MASKED = '••••••••••••••••'

export async function GET() {
  try {
    const { supabase, accountId } = await requireRole('viewer')

    const { data: config, error } = await supabase
      .from('whatsapp_config')
      .select(
        'catalog_id, catalog_name, catalog_connected_at, payment_provider, payment_config, auto_create_payment_link, status'
      )
      .eq('account_id', accountId)
      .maybeSingle()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!config) {
      return NextResponse.json({
        catalog_id: null,
        catalog_name: null,
        catalog_connected_at: null,
        payment_provider: 'manual',
        payment_config: {},
        auto_create_payment_link: false,
      })
    }

    // Mask sensitive payment secrets
    const paymentConfig = { ...(config.payment_config || {}) }
    if (paymentConfig.razorpay?.key_secret) {
      paymentConfig.razorpay = {
        ...paymentConfig.razorpay,
        key_secret: MASKED,
      }
    }
    if (paymentConfig.stripe?.secret_key) {
      paymentConfig.stripe = {
        ...paymentConfig.stripe,
        secret_key: MASKED,
      }
    }

    return NextResponse.json({
      catalog_id: config.catalog_id || null,
      catalog_name: config.catalog_name || null,
      catalog_connected_at: config.catalog_connected_at || null,
      payment_provider: config.payment_provider || 'manual',
      payment_config: paymentConfig,
      auto_create_payment_link: !!config.auto_create_payment_link,
      is_whatsapp_connected: config.status === 'connected',
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch commerce config'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const { supabase, accountId } = await requireRole('admin')

    const body = await request.json()
    const {
      catalog_id,
      payment_provider,
      payment_config,
      auto_create_payment_link,
      test_catalog,
    } = body

    // Load active WhatsApp config to get access_token
    const { data: existing, error: fetchErr } = await supabase
      .from('whatsapp_config')
      .select('*')
      .eq('account_id', accountId)
      .maybeSingle()

    if (fetchErr || !existing) {
      return NextResponse.json(
        { error: 'Please connect WhatsApp first before configuring Catalog & Payments.' },
        { status: 400 }
      )
    }

    const accessToken = decrypt(existing.access_token)
    let catalogName = existing.catalog_name || null
    let catalogConnectedAt = existing.catalog_connected_at || null

    // If catalog_id is provided and test requested or changed
    if (catalog_id && (test_catalog || catalog_id !== existing.catalog_id)) {
      try {
        const metaCatalog = await verifyMetaCatalog({
          catalogId: catalog_id.trim(),
          accessToken,
        })
        catalogName = metaCatalog.name || `Catalog ${catalog_id}`
        catalogConnectedAt = new Date().toISOString()
      } catch (catErr) {
        const msg = catErr instanceof Error ? catErr.message : 'Catalog verification failed'
        return NextResponse.json(
          { error: `Meta Catalog Verification Failed: ${msg}` },
          { status: 400 }
        )
      }
    }

    // Merge payment config preserving masked secrets
    const mergedPaymentConfig = { ...(existing.payment_config || {}) }
    if (payment_config) {
      if (payment_config.razorpay) {
        mergedPaymentConfig.razorpay = {
          key_id: payment_config.razorpay.key_id,
          key_secret:
            payment_config.razorpay.key_secret === MASKED
              ? existing.payment_config?.razorpay?.key_secret
              : payment_config.razorpay.key_secret,
        }
      }
      if (payment_config.stripe) {
        mergedPaymentConfig.stripe = {
          publishable_key: payment_config.stripe.publishable_key,
          secret_key:
            payment_config.stripe.secret_key === MASKED
              ? existing.payment_config?.stripe?.secret_key
              : payment_config.stripe.secret_key,
        }
      }
      if (payment_config.whatsapp_pay) {
        mergedPaymentConfig.whatsapp_pay = payment_config.whatsapp_pay
      }
      if (payment_config.upi_manual) {
        mergedPaymentConfig.upi_manual = payment_config.upi_manual
      }
    }

    const updates: Record<string, unknown> = {
      catalog_id: catalog_id !== undefined ? (catalog_id ? catalog_id.trim() : null) : existing.catalog_id,
      catalog_name: catalogName,
      catalog_connected_at: catalogConnectedAt,
      payment_provider: payment_provider || existing.payment_provider || 'manual',
      payment_config: mergedPaymentConfig,
      auto_create_payment_link:
        auto_create_payment_link !== undefined
          ? !!auto_create_payment_link
          : existing.auto_create_payment_link,
      updated_at: new Date().toISOString(),
    }

    const { error: updateErr } = await supabase
      .from('whatsapp_config')
      .update(updates)
      .eq('account_id', accountId)

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      catalog_id: updates.catalog_id,
      catalog_name: updates.catalog_name,
      catalog_connected_at: updates.catalog_connected_at,
      payment_provider: updates.payment_provider,
      auto_create_payment_link: updates.auto_create_payment_link,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to save commerce config'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

