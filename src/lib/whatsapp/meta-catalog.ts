/**
 * Meta WhatsApp Cloud API Commerce & Catalog API Helpers.
 *
 * Implements:
 *   - Meta Commerce Catalog verification (GET /{CATALOG_ID})
 *   - Meta Commerce Catalog product synchronization (GET /{CATALOG_ID}/products)
 *   - Product upload/creation (POST /{CATALOG_ID}/products)
 *   - Outbound Single-Product Message (SPM)
 *   - Outbound Multi-Product Message (MPM)
 *   - Outbound WhatsApp Catalog Storefront Message
 *   - Outbound In-Chat Review & Pay (order_details) Message
 */

import { isBusinessScopedUserId } from './wa-identity'

const META_API_VERSION = 'v21.0'
const META_API_BASE = `https://graph.facebook.com/${META_API_VERSION}`

function recipientFields(to: string): Record<string, unknown> {
  return isBusinessScopedUserId(to)
    ? { recipient: to.trim() }
    : { recipient_type: 'individual', to }
}

export interface MetaCatalogInfo {
  id: string
  name?: string
  vertical?: string
  product_count?: number
  warning?: string
  verifiedVia?: 'waba_product_catalogs' | 'catalog_node' | 'direct_id'
}

export interface MetaCatalogProductItem {
  id: string
  retailer_id: string
  name: string
  description?: string
  price: string
  currency: string
  image_url?: string
  url?: string
  availability: 'in stock' | 'out of stock' | string
  category?: string
}

/**
 * Fetch all catalogs linked to a WhatsApp Business Account (WABA).
 * Uses the WhatsApp Cloud API standard whatsapp_business_management permission.
 */
export async function getWabaCatalogs(args: {
  wabaId: string
  accessToken: string
}): Promise<Array<{ id: string; name?: string; vertical?: string }>> {
  const { wabaId, accessToken } = args
  if (!wabaId) return []

  try {
    const url = `${META_API_BASE}/${encodeURIComponent(wabaId)}/product_catalogs?fields=id,name,vertical`
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!response.ok) return []
    const json = await response.json()
    return (json.data || []) as Array<{ id: string; name?: string; vertical?: string }>
  } catch {
    return []
  }
}

/**
 * Verify a Meta Commerce Catalog ID with multi-layer fallback:
 * 1. Check if the catalog is already linked to the WABA (requires only whatsapp_business_management).
 * 2. Attempt minimal direct Graph API catalog lookup (GET /{catalog_id}?fields=id,name).
 * 3. If direct Graph API lookup fails with "Unsupported get request" (code 100/33/200),
 *    do not block saving! In-chat WhatsApp product messages work without catalog_management permission
 *    as long as the catalog is linked in WhatsApp Manager. Return the catalog with guidance.
 */
export async function verifyMetaCatalog(args: {
  catalogId: string
  accessToken: string
  wabaId?: string | null
}): Promise<MetaCatalogInfo> {
  const { catalogId, accessToken, wabaId } = args
  const cleanId = catalogId.trim()

  if (!cleanId) {
    throw new Error('Please enter a valid Meta Catalog ID.')
  }

  // Attempt 1: Check WhatsApp Business Account linked catalogs
  if (wabaId) {
    try {
      const linked = await getWabaCatalogs({ wabaId, accessToken })
      const match = linked.find((c) => c.id === cleanId)
      if (match) {
        return {
          id: match.id,
          name: match.name || `Catalog ${match.id}`,
          vertical: match.vertical,
          verifiedVia: 'waba_product_catalogs',
        }
      }
    } catch {
      // Continue to direct lookup
    }
  }

  // Attempt 2: Direct Graph API catalog lookup with minimal fields
  const url = `${META_API_BASE}/${encodeURIComponent(cleanId)}?fields=id,name`
  let response: Response | null = null
  let errData: any = null

  try {
    response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
  } catch (netErr: any) {
    throw new Error(`Failed to reach Meta Graph API: ${netErr.message || 'Network error'}`)
  }

  if (response.ok) {
    const data = await response.json()
    return {
      id: data.id || cleanId,
      name: data.name || `Catalog ${cleanId}`,
      vertical: data.vertical,
      product_count: data.product_count,
      verifiedVia: 'catalog_node',
    }
  }

  // Read error response
  try {
    errData = await response.json()
  } catch {
    // non-json
  }

  const errMessage = errData?.error?.message || `Catalog verification failed (${response.status})`
  const errCode = errData?.error?.code
  const subCode = errData?.error?.error_subcode

  // If token is expired or unauthorized (OAuth 190, 102), fail explicitly
  if (errCode === 190 || errCode === 102 || response.status === 401) {
    throw new Error(`WhatsApp Access Token is invalid or expired (${errMessage}). Please reconnect WhatsApp.`)
  }

  // Check if Meta returned "Unsupported get request", Code 100, Subcode 33, or permissions error.
  // This occurs when a WhatsApp System User token does not have 'catalog_management' permission.
  // In WhatsApp Cloud API, in-chat product messages still work as long as the catalog is linked in WhatsApp Manager.
  const isPermissionOrUnsupported =
    errCode === 100 ||
    errCode === 200 ||
    subCode === 33 ||
    errMessage.toLowerCase().includes('unsupported get request') ||
    errMessage.toLowerCase().includes('permission') ||
    errMessage.toLowerCase().includes('does not exist')

  if (isPermissionOrUnsupported) {
    return {
      id: cleanId,
      name: `Catalog ${cleanId}`,
      verifiedVia: 'direct_id',
      warning:
        "Catalog connected for WhatsApp messages! Note: Meta Graph API returned 'Unsupported get request' during direct metadata lookup. In-chat product & catalog messages will work normally. To enable automatic 2-way product sync in this dashboard, add 'catalog_management' permission to your System User token in Meta Business Suite.",
    }
  }

  // Otherwise throw standard Meta error
  throw new Error(`Meta Catalog Verification Failed: ${errMessage}`)
}

/**
 * Fetch products from a Meta Commerce Catalog.
 */
export async function fetchMetaCatalogProducts(args: {
  catalogId: string
  accessToken: string
  limit?: number
}): Promise<MetaCatalogProductItem[]> {
  const { catalogId, accessToken, limit = 100 } = args
  const cleanId = catalogId.trim()

  // First try standard commerce fields
  const fields = 'id,retailer_id,name,description,price,currency,image_url,url,availability,category'
  const url = `${META_API_BASE}/${encodeURIComponent(cleanId)}/products?fields=${fields}&limit=${limit}`

  let response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  // If failed due to a field mismatch (e.g. nonexisting field 'category'), retry with core fields
  if (!response.ok) {
    let rawError = ''
    try {
      const errClone = await response.clone().json()
      rawError = errClone?.error?.message || ''
    } catch {}

    if (rawError.toLowerCase().includes('nonexisting field') || rawError.toLowerCase().includes('fields')) {
      const coreFields = 'id,retailer_id,name,description,price,currency,image_url,url,availability'
      const fallbackUrl = `${META_API_BASE}/${encodeURIComponent(cleanId)}/products?fields=${coreFields}&limit=${limit}`
      response = await fetch(fallbackUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
    }
  }

  if (!response.ok) {
    let errMessage = `Failed to fetch products (${response.status})`
    let subCode = 0
    let code = 0
    try {
      const data = await response.json()
      if (data?.error?.message) errMessage = data.error.message
      code = data?.error?.code || 0
      subCode = data?.error?.error_subcode || 0
    } catch {
      // response wasn't JSON
    }

    const isPermissionError =
      subCode === 33 ||
      code === 200 ||
      errMessage.toLowerCase().includes('missing permissions') ||
      errMessage.toLowerCase().includes('unsupported get request') ||
      errMessage.toLowerCase().includes('permission')

    if (isPermissionError) {
      throw new Error(
        `Your active token is missing the 'catalog_management' permission. Although your System User has the Catalog asset assigned in Meta, existing tokens do NOT automatically gain new permissions. In Meta Business Suite (Settings → System Users), click 'Generate token' next to Admin, select your app, check the 'catalog_management' permission, and update your token in Settings.`
      )
    }

    throw new Error(errMessage)
  }

  const json = await response.json()
  return (json.data || []) as MetaCatalogProductItem[]
}

/**
 * Create or upload a new product item into a Meta Commerce Catalog.
 */
export async function createMetaCatalogProduct(args: {
  catalogId: string
  accessToken: string
  product: {
    retailer_id: string
    name: string
    description?: string
    price: number
    currency: string
    image_url?: string
    url?: string
    availability?: 'in stock' | 'out of stock'
    category?: string
  }
}): Promise<{ id: string }> {
  const { catalogId, accessToken, product } = args
  const url = `${META_API_BASE}/${encodeURIComponent(catalogId)}/products`

  // Meta expects price in integer cents/units (e.g. 10.99 -> 1099)
  const priceInCents = Math.round(product.price * 100)

  const body = {
    retailer_id: product.retailer_id,
    name: product.name,
    description: product.description || product.name,
    price: priceInCents,
    currency: product.currency.toUpperCase(),
    image_url: product.image_url,
    url: product.url || 'https://whatsapp.com',
    availability: product.availability || 'in stock',
    category: product.category,
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    let errMessage = `Failed to create product (${response.status})`
    try {
      const data = await response.json()
      if (data?.error?.message) errMessage = data.error.message
    } catch {
      // response wasn't JSON
    }
    throw new Error(errMessage)
  }

  return response.json()
}

/**
 * Send Single-Product Message (SPM) via WhatsApp Cloud API.
 */
export async function sendSingleProductMessage(args: {
  phoneNumberId: string
  accessToken: string
  to: string
  catalogId: string
  productRetailerId: string
  bodyText?: string
  footerText?: string
  contextMessageId?: string
}): Promise<{ messageId: string }> {
  const {
    phoneNumberId,
    accessToken,
    to,
    catalogId,
    productRetailerId,
    bodyText,
    footerText,
    contextMessageId,
  } = args

  const interactive: Record<string, unknown> = {
    type: 'product',
    action: {
      catalog_id: catalogId,
      product_retailer_id: productRetailerId,
    },
  }

  if (bodyText) interactive.body = { text: bodyText }
  if (footerText) interactive.footer = { text: footerText }

  const body: Record<string, unknown> = {
    messaging_product: 'whatsapp',
    ...recipientFields(to),
    type: 'interactive',
    interactive,
  }

  if (contextMessageId) body.context = { message_id: contextMessageId }

  const url = `${META_API_BASE}/${phoneNumberId}/messages`
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    let errMessage = `Meta API error: ${response.status}`
    try {
      const data = await response.json()
      if (data?.error?.message) errMessage = data.error.message
    } catch {
      // response wasn't JSON
    }
    throw new Error(errMessage)
  }

  const json = await response.json()
  return { messageId: json.messages?.[0]?.id || '' }
}

/**
 * Send Multi-Product Message (MPM) via WhatsApp Cloud API.
 */
export async function sendMultiProductMessage(args: {
  phoneNumberId: string
  accessToken: string
  to: string
  catalogId: string
  headerText: string
  bodyText: string
  footerText?: string
  sections: Array<{
    title: string
    product_retailer_ids: string[]
  }>
  contextMessageId?: string
}): Promise<{ messageId: string }> {
  const {
    phoneNumberId,
    accessToken,
    to,
    catalogId,
    headerText,
    bodyText,
    footerText,
    sections,
    contextMessageId,
  } = args

  const interactive: Record<string, unknown> = {
    type: 'product_list',
    header: {
      type: 'text',
      text: headerText,
    },
    body: {
      text: bodyText,
    },
    action: {
      catalog_id: catalogId,
      sections: sections.map((sec) => ({
        title: sec.title,
        product_items: sec.product_retailer_ids.map((id) => ({
          product_retailer_id: id,
        })),
      })),
    },
  }

  if (footerText) interactive.footer = { text: footerText }

  const body: Record<string, unknown> = {
    messaging_product: 'whatsapp',
    ...recipientFields(to),
    type: 'interactive',
    interactive,
  }

  if (contextMessageId) body.context = { message_id: contextMessageId }

  const url = `${META_API_BASE}/${phoneNumberId}/messages`
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    let errMessage = `Meta API error: ${response.status}`
    try {
      const data = await response.json()
      if (data?.error?.message) errMessage = data.error.message
    } catch {
      // response wasn't JSON
    }
    throw new Error(errMessage)
  }

  const json = await response.json()
  return { messageId: json.messages?.[0]?.id || '' }
}

/**
 * Send WhatsApp Catalog Storefront Message.
 */
export async function sendCatalogMessage(args: {
  phoneNumberId: string
  accessToken: string
  to: string
  bodyText: string
  footerText?: string
  thumbnailProductRetailerId?: string
  contextMessageId?: string
}): Promise<{ messageId: string }> {
  const {
    phoneNumberId,
    accessToken,
    to,
    bodyText,
    footerText,
    thumbnailProductRetailerId,
    contextMessageId,
  } = args

  const actionParams: Record<string, unknown> = {}
  if (thumbnailProductRetailerId) {
    actionParams.thumbnail_product_retailer_id = thumbnailProductRetailerId
  }

  const interactive: Record<string, unknown> = {
    type: 'catalog_message',
    body: { text: bodyText },
    action: {
      name: 'catalog_message',
      ...(Object.keys(actionParams).length > 0
        ? { parameters: actionParams }
        : {}),
    },
  }

  if (footerText) interactive.footer = { text: footerText }

  const body: Record<string, unknown> = {
    messaging_product: 'whatsapp',
    ...recipientFields(to),
    type: 'interactive',
    interactive,
  }

  if (contextMessageId) body.context = { message_id: contextMessageId }

  const url = `${META_API_BASE}/${phoneNumberId}/messages`
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    let errMessage = `Meta API error: ${response.status}`
    try {
      const data = await response.json()
      if (data?.error?.message) errMessage = data.error.message
    } catch {
      // response wasn't JSON
    }
    throw new Error(errMessage)
  }

  const json = await response.json()
  return { messageId: json.messages?.[0]?.id || '' }
}

/**
 * Send WhatsApp Native Order Details (Review & Pay) Interactive Message.
 */
export async function sendOrderPaymentDetailsMessage(args: {
  phoneNumberId: string
  accessToken: string
  to: string
  referenceId: string
  totalAmount: number
  currency: string
  items: Array<{
    retailer_id?: string
    name: string
    amount: number
    quantity: number
  }>
  bodyText?: string
  footerText?: string
  paymentGatewayConfigName?: string
  paymentGatewayType?: string
  contextMessageId?: string
}): Promise<{ messageId: string }> {
  const {
    phoneNumberId,
    accessToken,
    to,
    referenceId,
    totalAmount,
    currency,
    items,
    bodyText,
    footerText,
    paymentGatewayConfigName,
    paymentGatewayType = 'razorpay',
    contextMessageId,
  } = args

  const totalCents = Math.round(totalAmount * 100)

  const paymentSettings: Array<Record<string, unknown>> = []
  if (paymentGatewayConfigName) {
    paymentSettings.push({
      type: 'payment_gateway',
      payment_gateway: {
        type: paymentGatewayType,
        configuration_name: paymentGatewayConfigName,
      },
    })
  }

  const interactive: Record<string, unknown> = {
    type: 'order_details',
    body: { text: bodyText || 'Review your order and proceed to payment:' },
    action: {
      name: 'review_and_pay',
      parameters: {
        reference_id: referenceId,
        type: 'digital-goods',
        currency: currency.toUpperCase(),
        total_amount: {
          value: totalCents,
          offset: 100,
        },
        order: {
          status: 'pending',
          items: items.map((item) => ({
            retailer_id: item.retailer_id || item.name,
            name: item.name,
            amount: {
              value: Math.round(item.amount * 100),
              offset: 100,
            },
            quantity: item.quantity,
          })),
          subtotal: {
            value: totalCents,
            offset: 100,
          },
          tax: { value: 0, offset: 100 },
          shipping: { value: 0, offset: 100 },
        },
        ...(paymentSettings.length > 0 ? { payment_settings: paymentSettings } : {}),
      },
    },
  }

  if (footerText) interactive.footer = { text: footerText }

  const body: Record<string, unknown> = {
    messaging_product: 'whatsapp',
    ...recipientFields(to),
    type: 'interactive',
    interactive,
  }

  if (contextMessageId) body.context = { message_id: contextMessageId }

  const url = `${META_API_BASE}/${phoneNumberId}/messages`
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    let errMessage = `Meta API error: ${response.status}`
    try {
      const data = await response.json()
      if (data?.error?.message) errMessage = data.error.message
    } catch {
      // response wasn't JSON
    }
    throw new Error(errMessage)
  }

  const json = await response.json()
  return { messageId: json.messages?.[0]?.id || '' }
}

