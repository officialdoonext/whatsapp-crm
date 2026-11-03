"use client";

import { List, Reply, ShoppingBag, CreditCard, ExternalLink, Package } from "lucide-react";
import { cn } from "@/lib/utils";
import type { InteractiveMessagePayload } from "@/lib/whatsapp/interactive";

export interface InteractivePreviewLabels {
  body?: string;
  button?: string;
  menu?: string;
}

export function InteractivePreview({
  payload,
  className,
  labels,
}: {
  payload: InteractiveMessagePayload;
  className?: string;
  labels?: InteractivePreviewLabels;
}) {
  const bodyLabel = labels?.body ?? "Message body…";
  const buttonLabel = labels?.button ?? "Button";
  const menuLabel = labels?.menu ?? "Menu";

  if (payload.kind === "product") {
    return (
      <div
        className={cn(
          "w-full max-w-[280px] overflow-hidden rounded-xl bg-card text-foreground shadow-sm ring-1 ring-border",
          className
        )}
      >
        {payload.product_image_url && (
          <div className="relative aspect-video w-full overflow-hidden bg-muted">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={payload.product_image_url}
              alt={payload.product_name || "Product"}
              className="h-full w-full object-cover"
            />
          </div>
        )}
        <div className="p-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            <ShoppingBag className="h-3.5 w-3.5" />
            <span>Product</span>
          </div>
          <h4 className="mt-1 font-semibold text-foreground">
            {payload.product_name || payload.product_retailer_id}
          </h4>
          {payload.product_price !== undefined && (
            <p className="mt-0.5 text-sm font-bold text-primary">
              {payload.product_currency || "USD"} {payload.product_price.toFixed(2)}
            </p>
          )}
          {payload.body && (
            <p className="mt-2 text-xs text-muted-foreground whitespace-pre-wrap">
              {payload.body}
            </p>
          )}
          {payload.footer && (
            <p className="mt-1.5 text-[10px] text-muted-foreground">
              {payload.footer}
            </p>
          )}
        </div>
        <div className="border-t border-border bg-muted/40 p-2 text-center text-xs font-medium text-primary">
          <span className="inline-flex items-center gap-1">
            <ExternalLink className="h-3 w-3" />
            View in WhatsApp Catalog
          </span>
        </div>
      </div>
    );
  }

  if (payload.kind === "product_list") {
    const totalItems = payload.sections.reduce(
      (sum, s) => sum + s.product_retailer_ids.length,
      0
    );
    return (
      <div
        className={cn(
          "w-full max-w-[280px] overflow-hidden rounded-xl bg-card text-foreground shadow-sm ring-1 ring-border",
          className
        )}
      >
        <div className="border-b border-border bg-emerald-500/10 p-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            <Package className="h-3.5 w-3.5" />
            <span>Product Collection</span>
          </div>
          <h4 className="mt-1 font-bold text-foreground">{payload.header}</h4>
        </div>
        <div className="p-3">
          <p className="text-xs text-muted-foreground whitespace-pre-wrap">
            {payload.body}
          </p>
          <div className="mt-3 space-y-1.5">
            {payload.sections.map((sec, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between rounded-lg bg-muted/50 px-2 py-1.5 text-xs"
              >
                <span className="font-medium text-foreground">{sec.title}</span>
                <span className="text-[11px] text-muted-foreground">
                  {sec.product_retailer_ids.length} items
                </span>
              </div>
            ))}
          </div>
          {payload.footer && (
            <p className="mt-2 text-[10px] text-muted-foreground">
              {payload.footer}
            </p>
          )}
        </div>
        <div className="border-t border-border bg-muted/40 p-2 text-center text-xs font-semibold text-primary">
          View items ({totalItems})
        </div>
      </div>
    );
  }

  if (payload.kind === "catalog_message") {
    return (
      <div
        className={cn(
          "w-full max-w-[280px] overflow-hidden rounded-xl bg-card text-foreground shadow-sm ring-1 ring-border",
          className
        )}
      >
        <div className="p-3.5">
          <div className="flex items-center gap-2 text-primary font-semibold text-xs">
            <ShoppingBag className="h-4 w-4" />
            <span>WhatsApp Catalog</span>
          </div>
          <p className="mt-2 text-xs text-muted-foreground whitespace-pre-wrap">
            {payload.body}
          </p>
          {payload.footer && (
            <p className="mt-1.5 text-[10px] text-muted-foreground">
              {payload.footer}
            </p>
          )}
        </div>
        <div className="border-t border-border bg-muted/40 p-2 text-center text-xs font-semibold text-primary">
          <span className="inline-flex items-center gap-1">
            <ExternalLink className="h-3 w-3" />
            View catalog
          </span>
        </div>
      </div>
    );
  }

  if (payload.kind === "order_details") {
    return (
      <div
        className={cn(
          "w-full max-w-[290px] overflow-hidden rounded-xl bg-card text-foreground shadow-sm ring-1 ring-border",
          className
        )}
      >
        <div className="border-b border-border bg-primary/10 p-3">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs font-semibold text-primary">
              <CreditCard className="h-3.5 w-3.5" />
              Review & Pay
            </span>
            <span className="text-[11px] font-mono text-muted-foreground">
              #{payload.reference_id}
            </span>
          </div>
        </div>
        <div className="p-3">
          {payload.body && (
            <p className="mb-2 text-xs text-muted-foreground">{payload.body}</p>
          )}
          <div className="space-y-1.5 divide-y divide-border/60">
            {payload.items.map((item, idx) => (
              <div key={idx} className="flex justify-between pt-1.5 text-xs">
                <span className="text-foreground">
                  {item.quantity}x {item.name}
                </span>
                <span className="font-medium text-foreground">
                  {payload.currency} {item.amount.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-3 flex justify-between border-t border-border pt-2 text-xs font-bold text-foreground">
            <span>Total Amount</span>
            <span className="text-primary">
              {payload.currency} {payload.total_amount.toFixed(2)}
            </span>
          </div>
        </div>
        <div className="border-t border-border bg-primary p-2 text-center text-xs font-semibold text-primary-foreground">
          Review and Pay
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "w-full max-w-[260px] overflow-hidden rounded-lg bg-card text-foreground shadow-sm ring-1 ring-border",
        className
      )}
    >
      <div className="px-3 py-2">
        {payload.header ? (
          <p className="mb-1 break-words text-sm font-semibold">
            {payload.header}
          </p>
        ) : null}
        <p className="whitespace-pre-wrap break-words text-sm">
          {payload.body || (
            <span className="text-muted-foreground">{bodyLabel}</span>
          )}
        </p>
        {payload.footer ? (
          <p className="mt-1 break-words text-[11px] text-muted-foreground">
            {payload.footer}
          </p>
        ) : null}
      </div>

      {payload.kind === "buttons" ? (
        <div className="flex flex-col border-t border-border">
          {payload.buttons.map((b, i) => (
            <button
              key={b.id || i}
              type="button"
              disabled
              className="flex items-center justify-center gap-1.5 border-t border-border py-2 text-sm font-medium text-primary first:border-t-0"
            >
              <Reply className="h-3.5 w-3.5" />
              <span className="truncate">{b.title || buttonLabel}</span>
            </button>
          ))}
        </div>
      ) : (
        <button
          type="button"
          disabled
          className="flex w-full items-center justify-center gap-1.5 border-t border-border py-2 text-sm font-medium text-primary"
        >
          <List className="h-3.5 w-3.5" />
          <span className="truncate">{payload.button_label || menuLabel}</span>
        </button>
      )}
    </div>
  );
}
