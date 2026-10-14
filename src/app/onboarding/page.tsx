"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  PhoneCall,
  MessageCircle,
  RefreshCw,
  ShieldAlert,
  Clock,
  LogOut,
  CheckCircle2,
  ArrowRight,
  UserCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import {
  ADMIN_CONTACT_PHONE,
  ADMIN_CONTACT_PHONE_INTL,
  buildCallAdminUrl,
  buildWhatsAppAdminUrl,
  type BlockReason,
} from "@/lib/auth/user-status";

interface AccountStatusState {
  loading: boolean;
  isAllowed: boolean;
  status: string;
  expiryDate: string | null;
  email: string | null;
  reason: BlockReason | null;
  message: string;
}

export default function OnboardingPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      }
    >
      <OnboardingContent />
    </Suspense>
  );
}

function OnboardingContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const supabase = createClient();

  const queryReason = searchParams.get("reason") as BlockReason | null;
  const queryEmail = searchParams.get("email");

  const [state, setState] = useState<AccountStatusState>({
    loading: true,
    isAllowed: false,
    status: queryReason === "expired" ? "expired" : "inactive",
    expiryDate: null,
    email: queryEmail || null,
    reason: queryReason || "inactive",
    message: "",
  });

  const [checking, setChecking] = useState(false);
  const [justActivated, setJustActivated] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      setChecking(true);
      const res = await fetch("/api/account/status", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setState((prev) => ({
          ...prev,
          loading: false,
          isAllowed: !!data.isAllowed,
          status: data.status || prev.status,
          expiryDate: data.expiryDate,
          email: data.email || prev.email,
          reason: data.reason || prev.reason,
          message: data.message || "",
        }));

        if (data.isAllowed) {
          setJustActivated(true);
          window.location.href = "/dashboard";
        }
      } else {
        setState((prev) => ({ ...prev, loading: false }));
      }
    } catch (err) {
      console.error("Failed to check status:", err);
      setState((prev) => ({ ...prev, loading: false }));
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
    } finally {
      window.location.href = "/login";
    }
  };

  const isExpired = state.reason === "expired" || state.status === "expired";
  const userEmail = state.email || queryEmail || "";
  const whatsAppUrl = buildWhatsAppAdminUrl(userEmail);
  const callUrl = buildCallAdminUrl();

  const formattedExpiry = state.expiryDate
    ? new Date(state.expiryDate).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-background px-4 py-12 selection:bg-primary/20">
      {/* Background radial glow */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-primary/5 blur-3xl" />
      </div>

      <div className="relative w-full max-w-lg">
        {/* Main Card */}
        <div className="overflow-hidden rounded-2xl border border-border/80 bg-card/95 shadow-2xl shadow-black/10 backdrop-blur-md">
          {/* Header Banner */}
          <div className="relative p-6 sm:p-8 border-b border-border/60 text-center flex flex-col items-center">
            {/* Logo */}
            <div className="flex items-center gap-2 mb-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 overflow-hidden border border-primary/20">
                <Image
                  src="/logo.png"
                  alt="GrowNext Logo"
                  width={36}
                  height={36}
                  className="object-contain"
                  priority
                />
              </div>
              <span className="font-semibold text-xl tracking-tight text-foreground">
                GrowNext CRM
              </span>
            </div>

            {/* Status Icon */}
            {justActivated ? (
              <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 shadow-inner">
                <CheckCircle2 className="h-8 w-8 animate-pulse" />
              </div>
            ) : isExpired ? (
              <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500 border border-amber-500/20 shadow-inner">
                <Clock className="h-8 w-8" />
              </div>
            ) : (
              <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-500 border border-rose-500/20 shadow-inner">
                <ShieldAlert className="h-8 w-8" />
              </div>
            )}

            {/* Title */}
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {justActivated
                ? "Account Activated!"
                : isExpired
                ? "Subscription Expired"
                : "Account Inactive"}
            </h1>

            {/* Subtitle / Reason */}
            <p className="mt-2 text-sm text-muted-foreground max-w-md">
              {justActivated
                ? "Your account has been activated by the administrator. You may now enter the CRM."
                : isExpired
                ? formattedExpiry
                  ? `Your CRM subscription expired on ${formattedExpiry}. Access to all CRM workflows has been paused.`
                  : "Your CRM subscription period has ended. Access to all CRM workflows has been paused."
                : "Your account is currently inactive. In order to access the CRM, an administrator must activate your account."}
            </p>

            {/* User Account Pill */}
            {userEmail && (
              <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-border bg-muted/60 px-3 py-1 text-xs font-medium text-foreground">
                <UserCheck className="h-3.5 w-3.5 text-muted-foreground" />
                <span>{userEmail}</span>
                <span className="text-muted-foreground">•</span>
                <span className="capitalize font-semibold text-primary">
                  {justActivated ? "Active" : state.status}
                </span>
              </div>
            )}
          </div>

          {/* Action Body */}
          <div className="p-6 sm:p-8 space-y-6">
            {justActivated ? (
              <div className="space-y-4">
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 text-center">
                  <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                    Everything is ready! Click below to proceed to your dashboard.
                  </p>
                </div>
                <Button
                  onClick={() => router.push("/dashboard")}
                  className="w-full h-11 text-base font-semibold shadow-md bg-emerald-600 hover:bg-emerald-500 text-white"
                >
                  Enter CRM Dashboard
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            ) : (
              <>
                <div className="rounded-xl border border-border/80 bg-muted/30 p-4 text-xs sm:text-sm text-muted-foreground space-y-1">
                  <p className="font-medium text-foreground">
                    How to get your account activated:
                  </p>
                  <p>
                    Please contact the administrator via phone call or WhatsApp to request activation for your account.
                  </p>
                </div>

                {/* Primary Contact Buttons */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* WhatsApp Option with prebuilt message */}
                  <a
                    href={whatsAppUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full inline-block"
                  >
                    <Button
                      type="button"
                      variant="default"
                      className="w-full h-12 text-sm font-semibold bg-[#25D366] hover:bg-[#20ba59] text-white shadow-md gap-2"
                    >
                      <MessageCircle className="h-5 w-5 fill-current" />
                      <span>WhatsApp Admin</span>
                    </Button>
                  </a>

                  {/* Phone Call Option */}
                  <a href={callUrl} className="w-full inline-block">
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full h-12 text-sm font-semibold border-primary/30 text-primary hover:bg-primary/10 gap-2"
                    >
                      <PhoneCall className="h-5 w-5" />
                      <span>Call {ADMIN_CONTACT_PHONE}</span>
                    </Button>
                  </a>
                </div>

                {/* Verification & Refresh Status */}
                <div className="pt-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={fetchStatus}
                    disabled={checking}
                    className="w-full text-xs text-muted-foreground hover:text-foreground gap-2 h-9"
                  >
                    <RefreshCw
                      className={`h-3.5 w-3.5 ${checking ? "animate-spin" : ""}`}
                    />
                    <span>
                      {checking
                        ? "Checking status with server..."
                        : "Already activated? Check Status"}
                    </span>
                  </Button>
                </div>
              </>
            )}

            {/* Footer Navigation */}
            <div className="border-t border-border/60 pt-4 flex items-center justify-between text-xs text-muted-foreground">
              <Link
                href="/login"
                className="hover:text-foreground transition-colors"
              >
                ← Back to Login
              </Link>

              <button
                type="button"
                onClick={handleSignOut}
                className="inline-flex items-center gap-1.5 hover:text-destructive transition-colors"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>

        {/* Support Help Text */}
        <p className="mt-6 text-center text-xs text-muted-foreground">
          GrowNext Security &bull; Administrator Hotline:{" "}
          <a
            href={callUrl}
            className="font-medium underline hover:text-foreground"
          >
            {ADMIN_CONTACT_PHONE_INTL}
          </a>
        </p>
      </div>
    </div>
  );
}
