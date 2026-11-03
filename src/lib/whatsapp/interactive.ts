// ============================================================
// Interactive message payload — shared shape + validation.
//
// The persisted, round-trippable representation of a WhatsApp
// interactive message (reply buttons, list, single product, multi-product,
// catalog link, or order review & pay). This is the single
// source of truth used by:
//   - the inbox composer + automation builders,
//   - the send-message core + automation engine (send + persist),
//   - the message bubble + preview (render),
//   - quick replies (store an interactive snippet).
// ============================================================

import { INTERACTIVE_LIMITS } from './meta-api'

export interface InteractiveButton {
  /** Stable id echoed back in the webhook when tapped. */
  id: string
  /** Visible label (≤ 20 chars per Meta). */
  title: string
}

export interface InteractiveButtonsPayload {
  kind: 'buttons'
  /** Body text shown above the buttons (≤ 1024 chars). */
  body: string
  /** Optional plain-text header (≤ 60 chars). */
  header?: string
  /** Optional grey footer line (≤ 60 chars). */
  footer?: string
  /** 1–3 buttons. */
  buttons: InteractiveButton[]
}

export interface InteractiveListRow {
  /** Stable id echoed back in the webhook when selected. */
  id: string
  /** Row title (≤ 24 chars per Meta). */
  title: string
  /** Optional secondary line (≤ 72 chars). */
  description?: string
}

export interface InteractiveListSection {
  /** Optional section header shown above its rows. */
  title?: string
  rows: InteractiveListRow[]
}

export interface InteractiveListPayload {
  kind: 'list'
  body: string
  header?: string
  footer?: string
  /** Label of the tap-to-expand button on the message bubble (≤ 20 chars). */
  button_label: string
  /** 1–10 rows TOTAL across all sections. */
  sections: InteractiveListSection[]
}

export interface InteractiveProductPayload {
  kind: 'product'
  body: string
  header?: string
  footer?: string
  catalog_id: string
  product_retailer_id: string
  product_name?: string
  product_price?: number
  product_currency?: string
  product_image_url?: string
}

export interface InteractiveProductListSection {
  title: string
  product_retailer_ids: string[]
}

export interface InteractiveProductListPayload {
  kind: 'product_list'
  header: string
  body: string
  footer?: string
  catalog_id: string
  sections: InteractiveProductListSection[]
}

export interface InteractiveCatalogPayload {
  kind: 'catalog_message'
  body: string
  header?: string
  footer?: string
  thumbnail_product_retailer_id?: string
}

export interface InteractiveOrderDetailsPayload {
  kind: 'order_details'
  body: string
  header?: string
  footer?: string
  reference_id: string
  currency: string
  total_amount: number
  items: Array<{
    retailer_id?: string
    name: string
    amount: number
    quantity: number
  }>
  payment_settings?: {
    type?: string
    payment_gateway?: {
      type: string
      configuration_name?: string
    }
    payment_link?: string
  }
}

export type InteractiveMessagePayload =
  | InteractiveButtonsPayload
  | InteractiveListPayload
  | InteractiveProductPayload
  | InteractiveProductListPayload
  | InteractiveCatalogPayload
  | InteractiveOrderDetailsPayload

export type InteractiveValidation =
  | { ok: true }
  | { ok: false; error: string }

function ok(): InteractiveValidation {
  return { ok: true }
}
function fail(error: string): InteractiveValidation {
  return { ok: false, error }
}

function validateHeaderFooter(
  header: string | undefined,
  footer: string | undefined,
): InteractiveValidation {
  if (header && header.length > INTERACTIVE_LIMITS.headerTextMaxLength) {
    return fail(
      `Header exceeds the ${INTERACTIVE_LIMITS.headerTextMaxLength}-character limit.`,
    )
  }
  if (footer && footer.length > INTERACTIVE_LIMITS.footerMaxLength) {
    return fail(
      `Footer exceeds the ${INTERACTIVE_LIMITS.footerMaxLength}-character limit.`,
    )
  }
  return ok()
}

/**
 * Validate an interactive payload against Meta's hard limits + our
 * structural rules.
 */
export function validateInteractivePayload(
  payload: unknown,
): InteractiveValidation {
  if (!payload || typeof payload !== 'object') {
    return fail('Interactive message payload is required.')
  }
  const p = payload as Partial<InteractiveMessagePayload>

  if (p.kind === 'product') {
    const prod = p as InteractiveProductPayload
    if (!prod.catalog_id?.trim()) return fail('Catalog ID is required.')
    if (!prod.product_retailer_id?.trim()) return fail('Product SKU / Retailer ID is required.')
    return ok()
  }

  if (p.kind === 'product_list') {
    const list = p as InteractiveProductListPayload
    if (!list.catalog_id?.trim()) return fail('Catalog ID is required.')
    if (!list.header?.trim()) return fail('Header text is required for product list.')
    if (!list.body?.trim()) return fail('Body text is required for product list.')
    if (!Array.isArray(list.sections) || list.sections.length === 0) {
      return fail('At least one product section is required.')
    }
    let totalItems = 0
    for (const sec of list.sections) {
      if (!sec.title?.trim()) return fail('Section title is required.')
      if (!Array.isArray(sec.product_retailer_ids) || sec.product_retailer_ids.length === 0) {
        return fail(`Section "${sec.title}" has no products.`)
      }
      totalItems += sec.product_retailer_ids.length
    }
    if (totalItems > 30) return fail('A product list allows at most 30 products in total.')
    return ok()
  }

  if (p.kind === 'catalog_message') {
    const cat = p as InteractiveCatalogPayload
    if (!cat.body?.trim()) return fail('Body text is required for catalog message.')
    return ok()
  }

  if (p.kind === 'order_details') {
    const ord = p as InteractiveOrderDetailsPayload
    if (!ord.reference_id?.trim()) return fail('Order reference ID is required.')
    if (!ord.currency?.trim()) return fail('Currency is required.')
    if (typeof ord.total_amount !== 'number') return fail('Total amount is required.')
    return ok()
  }

  if (typeof p.body !== 'string' || p.body.trim() === '') {
    return fail('Interactive message body text is required.')
  }
  if (p.body.length > INTERACTIVE_LIMITS.bodyMaxLength) {
    return fail(
      `Body text exceeds the ${INTERACTIVE_LIMITS.bodyMaxLength}-character limit.`,
    )
  }
  const hf = validateHeaderFooter(p.header, p.footer)
  if (!hf.ok) return hf

  if (p.kind === 'buttons') {
    const buttons = (p as InteractiveButtonsPayload).buttons
    if (!Array.isArray(buttons) || buttons.length < 1) {
      return fail('Add at least one reply button.')
    }
    if (buttons.length > INTERACTIVE_LIMITS.maxButtons) {
      return fail(
        `A reply-button message allows at most ${INTERACTIVE_LIMITS.maxButtons} buttons.`,
      )
    }
    const seen = new Set<string>()
    for (const b of buttons) {
      if (!b || typeof b.id !== 'string' || b.id.trim() === '') {
        return fail('Every button needs an id.')
      }
      if (seen.has(b.id)) {
        return fail(`Duplicate button id "${b.id}".`)
      }
      seen.add(b.id)
      if (typeof b.title !== 'string' || b.title.trim() === '') {
        return fail('Every button needs a label.')
      }
      if (b.title.length > INTERACTIVE_LIMITS.buttonTitleMaxLength) {
        return fail(
          `Button label "${b.title}" exceeds the ${INTERACTIVE_LIMITS.buttonTitleMaxLength}-character limit.`,
        )
      }
    }
    return ok()
  }

  if (p.kind === 'list') {
    const list = p as InteractiveListPayload
    if (
      typeof list.button_label !== 'string' ||
      list.button_label.trim() === ''
    ) {
      return fail('The list needs a button label.')
    }
    if (list.button_label.length > INTERACTIVE_LIMITS.buttonTitleMaxLength) {
      return fail(
        `List button label exceeds the ${INTERACTIVE_LIMITS.buttonTitleMaxLength}-character limit.`,
      )
    }
    if (!Array.isArray(list.sections) || list.sections.length < 1) {
      return fail('Add at least one list section.')
    }
    if (list.sections.length > INTERACTIVE_LIMITS.maxListSections) {
      return fail(
        `A list allows at most ${INTERACTIVE_LIMITS.maxListSections} sections.`,
      )
    }
    const seen = new Set<string>()
    let total = 0
    for (const section of list.sections) {
      if (!section || !Array.isArray(section.rows)) {
        return fail('Every list section needs rows.')
      }
      for (const row of section.rows) {
        total++
        if (!row || typeof row.id !== 'string' || row.id.trim() === '') {
          return fail('Every list row needs an id.')
        }
        if (seen.has(row.id)) {
          return fail(`Duplicate list row id "${row.id}".`)
        }
        seen.add(row.id)
        if (typeof row.title !== 'string' || row.title.trim() === '') {
          return fail('Every list row needs a title.')
        }
        if (row.title.length > INTERACTIVE_LIMITS.listRowTitleMaxLength) {
          return fail(
            `List row title "${row.title}" exceeds the ${INTERACTIVE_LIMITS.listRowTitleMaxLength}-character limit.`,
          )
        }
        if (
          row.description &&
          row.description.length >
            INTERACTIVE_LIMITS.listRowDescriptionMaxLength
        ) {
          return fail(
            `List row description exceeds the ${INTERACTIVE_LIMITS.listRowDescriptionMaxLength}-character limit.`,
          )
        }
      }
    }
    if (total < 1) return fail('Add at least one list row.')
    if (total > INTERACTIVE_LIMITS.maxListRowsTotal) {
      return fail(
        `A list allows at most ${INTERACTIVE_LIMITS.maxListRowsTotal} rows in total.`,
      )
    }
    return ok()
  }

  return fail('Interactive message must be buttons, list, product, product list, or catalog message.')
}

/**
 * Short single-line summary used for `conversations.last_message_text`
 * and quick-reply list rows — the body, trimmed, or a sensible fallback.
 */
export function interactivePayloadPreviewText(
  payload: InteractiveMessagePayload,
): string {
  if (payload.kind === 'product') {
    return payload.product_name ? `🛍️ Product: ${payload.product_name}` : '🛍️ Product'
  }
  if (payload.kind === 'product_list') {
    return `🛍️ Collection: ${payload.header || 'Products'}`
  }
  if (payload.kind === 'catalog_message') {
    return '🏪 WhatsApp Catalog'
  }
  if (payload.kind === 'order_details') {
    return `🧾 Payment Request: ${payload.reference_id}`
  }
  const body = payload.body?.trim()
  if (body) return body
  return payload.kind === 'buttons' ? '[buttons]' : '[list]'
}
