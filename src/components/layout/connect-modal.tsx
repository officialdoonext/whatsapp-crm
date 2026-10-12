"use client";

import Link from "next/link";
import { MessageSquare, Plug, ExternalLink, CheckCircle2, ShieldCheck, ArrowRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button, buttonVariants } from "@/components/ui/button";

interface ConnectModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ConnectModal({ open, onOpenChange }: ConnectModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-card border-border">
        <DialogHeader>
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
              <Plug className="size-4.5" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold text-foreground">
                Connect & Integrations
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Manage your WhatsApp Cloud API connection and webhooks
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-3 pt-2">
          {/* Status block */}
          <div className="rounded-lg border border-border bg-muted/30 p-3.5 space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-foreground flex items-center gap-2">
                <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                WhatsApp Cloud API
              </span>
              <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                Active
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Official Meta Graph API connection for messaging, media, templates, and webhooks.
            </p>
          </div>

          <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-2">
            <div className="flex items-center gap-2 text-xs font-medium text-foreground">
              <ShieldCheck className="size-4 text-emerald-500" />
              <span>Security & Encryption</span>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Access tokens and business secrets are protected with AES-256-GCM encryption.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 pt-2 border-t border-border mt-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-xs text-muted-foreground"
          >
            Close
          </Button>
          <Link
            href="/settings?tab=whatsapp"
            onClick={() => onOpenChange(false)}
            className={buttonVariants({
              size: "sm",
              className: "bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1.5",
            })}
          >
            Configure Settings
            <ArrowRight className="size-3.5" />
          </Link>
        </div>
      </DialogContent>
    </Dialog>
  );
}
