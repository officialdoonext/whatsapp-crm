import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth/account'
import { decrypt, encrypt, isLegacyFormat } from '@/lib/whatsapp/encryption'
import { verifyMetaCatalog, getWabaCatalogs } from '@/lib/whatsapp/meta-catalog'

const MASKED = '••••••••••••••••'

export async function GET() {
  try {
    const { supabase, accountId } = await requireRole('viewer')

    const { data: config, error } = await supabase
      .from('whatsapp_config')
      .select(
        'waba_id, access_token, catalog_id, catalog_name, catalog_connected_at, payment_provider, payment_config, auto_create_payment_link, status'
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
        linked_catalogs: [],
      })
    }

    // Try to discover catalogs linked to this WhatsApp Business Account
    let linkedCatalogs: Array<{ id: string; name?: string; vertical?: string }> = []
    let tokenInfo: {
      scopes: string[]
      has_catalog_management: boolean
      has_whatsapp: boolean
    } | null = null

    if (config.access_token) {
      try {
        const token = decrypt(config.access_token)

        // Inspect token permissions
        const permRes = await fetch('https://graph.facebook.com/v21.0/me/permissions', {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (permRes.ok) {
          const permData = await permRes.json()
          const grantedScopes: string[] = (permData.data || [])
            .filter((p: any) => p.status === 'granted')
            .map((p: any) => p.permission as string)

          tokenInfo = {
            scopes: grantedScopes,
            has_catalog_management: grantedScopes.includes('catalog_management'),
            has_whatsapp:
              grantedScopes.includes('whatsapp_business_messaging') ||
              grantedScopes.includes('whatsapp_business_management'),
          }
        }

        // Discover WABA linked catalogs
        if (config.waba_id) {
          linkedCatalogs = await getWabaCatalogs({
            wabaId: config.waba_id,
            accessToken: token,
          })
        }
      } catch {
        // silent fallback
      }
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
      linked_catalogs: linkedCatalogs,
      token_info: tokenInfo,
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
      new_access_token,
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

    let accessToken = decrypt(existing.access_token)
    let tokenUpdated = false

    // If user provided a newly generated System User access token
    if (new_access_token && typeof new_access_token === 'string' && new_access_token.trim()) {
      const cleanToken = new_access_token.trim()
      const meRes = await fetch('https://graph.facebook.com/v21.0/me?fields=id,name', {
        headers: { Authorization: `Bearer ${cleanToken}` },
      })
      if (!meRes.ok) {
        let err = 'Invalid Meta Access Token'
        try {
          const d = await meRes.json()
          if (d?.error?.message) err = d.error.message
        } catch {}
        return NextResponse.json({ error: `Meta rejected new token: ${err}` }, { status: 400 })
      }
      accessToken = cleanToken
      tokenUpdated = true
    }

    let catalogName = existing.catalog_name || null
    let catalogConnectedAt = existing.catalog_connected_at || null
    let warningMessage: string | null = null

    // If catalog_id is provided and test requested or changed
    if (catalog_id && (test_catalog || catalog_id !== existing.catalog_id)) {
      try {
        const metaCatalog = await verifyMetaCatalog({
          catalogId: catalog_id.trim(),
          accessToken,
          wabaId: existing.waba_id || null,
        })
        catalogName = metaCatalog.name || `Catalog ${catalog_id.trim()}`
        catalogConnectedAt = new Date().toISOString()
        if (metaCatalog.warning) {
          warningMessage = metaCatalog.warning
        }
      } catch (catErr) {
        const msg = catErr instanceof Error ? catErr.message : 'Catalog verification failed'
        if (msg.includes('OAuth') || msg.includes('token') || msg.includes('Session has expired')) {
          return NextResponse.json(
            { error: `WhatsApp Access Token error: ${msg}. Please reconnect WhatsApp in Settings.` },
            { status: 400 }
          )
        }
        // Save catalog ID anyway with helpful guidance rather than blocking
        catalogName = `Catalog ${catalog_id.trim()}`
        catalogConnectedAt = new Date().toISOString()
        warningMessage = `Catalog ID saved! Note: Meta Graph API returned '${msg}'. In-chat WhatsApp product messages will work once the catalog is linked to your WhatsApp Business Account. For direct 2-way product sync in this dashboard, grant 'catalog_management' permission to your System User in Meta Business Suite.`
      }
    } else if (catalog_id && !existing.catalog_connected_at) {
      catalogConnectedAt = new Date().toISOString()
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
      ...(tokenUpdated ? { access_token: encrypt(accessToken) } : {}),
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
      warning: warningMessage,
      token_updated: tokenUpdated,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to save commerce config'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

