/**
 * Multi-Gateway Payment Orchestration for WhatsApp Commerce.
 *
 * Supports:
 *   1. Razorpay Payment Links API (https://api.razorpay.com/v1/payment_links)
 *   2. Stripe Checkout Sessions API (https://api.stripe.com/v1/checkout/sessions)
 *   3. UPI Instant Pay Deep Link (upi://pay) & Dynamic QR Code
 *   4. WhatsApp In-Chat Review & Pay (order_details)
 */

import type { PaymentConfig, PaymentProvider, CommerceOrder } from '@/types'

export interface CreatePaymentResult {
  provider: PaymentProvider
  paymentUrl: string
  paymentId?: string
  paymentQrUrl?: string
  status: 'created' | 'pending'
}

/**
 * Generate a Razorpay Payment Link.
 */
export async function createRazorpayLink(args: {
  keyId: string
  keySecret: string
  amount: number
  currency: string
  orderReference: string
  description?: string
  customer?: {
    name?: string
    contact?: string
  }
}): Promise<{ paymentId: string; shortUrl: string }> {
  const { keyId, keySecret, amount, currency, orderReference, description, customer } = args

  // Razorpay expects amount in the smallest currency sub-unit (e.g., paise for INR / cents for USD)
  const amountSubunits = Math.round(amount * 100)
  const authHeader = `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`

  const payload: Record<string, unknown> = {
    amount: amountSubunits,
    currency: currency.toUpperCase(),
    accept_partial: false,
    reference_id: orderReference,
    description: description || `Payment for Order #${orderReference}`,
    notify: {
      sms: false,
      email: false,
    },
    reminder_enable: true,
  }

  if (customer?.name || customer?.contact) {
    payload.customer = {
      ...(customer.name ? { name: customer.name } : {}),
      ...(customer.contact ? { contact: customer.contact } : {}),
    }
  }

  const response = await fetch('https://api.razorpay.com/v1/payment_links', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: authHeader,
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    let errMsg = `Razorpay error (${response.status})`
    try {
      const data = await response.json()
      if (data?.error?.description) errMsg = data.error.description
    } catch {
      // ignore
    }
    throw new Error(errMsg)
  }

  const json = await response.json()
  return {
    paymentId: json.id,
    shortUrl: json.short_url,
  }
}

/**
 * Generate a Stripe Checkout Session.
 */
export async function createStripeSession(args: {
  secretKey: string
  amount: number
  currency: string
  orderReference: string
  description?: string
  successUrl?: string
  cancelUrl?: string
}): Promise<{ sessionId: string; url: string }> {
  const { secretKey, amount, currency, orderReference, description, successUrl, cancelUrl } = args

  const amountCents = Math.round(amount * 100)
  const params = new URLSearchParams()
  params.append('payment_method_types[]', 'card')
  params.append('mode', 'payment')
  params.append('client_reference_id', orderReference)
  params.append('line_items[0][price_data][currency]', currency.toLowerCase())
  params.append('line_items[0][price_data][product_data][name]', `Order #${orderReference}`)
  if (description) {
    params.append('line_items[0][price_data][product_data][description]', description)
  }
  params.append('line_items[0][price_data][unit_amount]', String(amountCents))
  params.append('line_items[0][quantity]', '1')
  params.append(
    'success_url',
    successUrl || `https://checkout.stripe.com/success?ref=${encodeURIComponent(orderReference)}`
  )
  params.append(
    'cancel_url',
    cancelUrl || `https://checkout.stripe.com/cancel?ref=${encodeURIComponent(orderReference)}`
  )

  const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Bearer ${secretKey}`,
    },
    body: params.toString(),
  })

  if (!response.ok) {
    let errMsg = `Stripe error (${response.status})`
    try {
      const data = await response.json()
      if (data?.error?.message) errMsg = data.error.message
    } catch {
      // ignore
    }
    throw new Error(errMsg)
  }

  const json = await response.json()
  return {
    sessionId: json.id,
    url: json.url,
  }
}

/**
 * Generate a UPI Deep Link and QR Code URL.
 */
export function generateUpiLink(args: {
  upiId: string
  merchantName: string
  amount: number
  currency?: string
  orderReference: string
}): { upiUri: string; qrUrl: string } {
  const { upiId, merchantName, amount, currency = 'INR', orderReference } = args
  const formattedAmount = amount.toFixed(2)

  const upiUri = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(
    merchantName
  )}&am=${formattedAmount}&cu=${encodeURIComponent(currency)}&tn=${encodeURIComponent(
    `Order ${orderReference}`
  )}`

  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(
    upiUri
  )}`

  return { upiUri, qrUrl }
}

/**
 * Main payment orchestrator for generating customer checkout links.
 */
export async function createOrderPayment(args: {
  provider: PaymentProvider
  paymentConfig: PaymentConfig
  order: CommerceOrder
  customerPhone?: string
  customerName?: string
}): Promise<CreatePaymentResult> {
  const { provider, paymentConfig, order, customerPhone, customerName } = args

  if (provider === 'razorpay') {
    const rzp = paymentConfig.razorpay
    if (!rzp?.key_id || !rzp?.key_secret) {
      throw new Error('Razorpay Key ID and Secret are not configured in Settings → Catalog & Payments.')
    }
    const result = await createRazorpayLink({
      keyId: rzp.key_id,
      keySecret: rzp.key_secret,
      amount: order.total_amount,
      currency: order.currency || 'INR',
      orderReference: order.order_reference,
      description: `Payment for WhatsApp Order #${order.order_reference}`,
      customer: {
        name: customerName,
        contact: customerPhone,
      },
    })
    return {
      provider: 'razorpay',
      paymentUrl: result.shortUrl,
      paymentId: result.paymentId,
      status: 'created',
    }
  }

  if (provider === 'stripe') {
    const strp = paymentConfig.stripe
    if (!strp?.secret_key) {
      throw new Error('Stripe Secret Key is not configured in Settings → Catalog & Payments.')
    }
    const result = await createStripeSession({
      secretKey: strp.secret_key,
      amount: order.total_amount,
      currency: order.currency || 'USD',
      orderReference: order.order_reference,
      description: `Payment for WhatsApp Order #${order.order_reference}`,
    })
    return {
      provider: 'stripe',
      paymentUrl: result.url,
      paymentId: result.sessionId,
      status: 'created',
    }
  }

  if (provider === 'upi_manual') {
    const upi = paymentConfig.upi_manual
    if (!upi?.upi_id) {
      throw new Error('UPI ID is not configured in Settings → Catalog & Payments.')
    }
    const result = generateUpiLink({
      upiId: upi.upi_id,
      merchantName: upi.merchant_name || 'Store',
      amount: order.total_amount,
      currency: order.currency || 'INR',
      orderReference: order.order_reference,
    })
    return {
      provider: 'upi_manual',
      paymentUrl: result.upiUri,
      paymentQrUrl: result.qrUrl,
      status: 'created',
    }
  }

  // Fallback to manual link
  return {
    provider: 'manual',
    paymentUrl: `Payment instructions for Order #${order.order_reference} totaling ${order.currency} ${order.total_amount}`,
    status: 'pending',
  }
}

