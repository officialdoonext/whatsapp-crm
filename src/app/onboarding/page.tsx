"use client";

import { Suspense, useEffect, useState, useCallback, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  PhoneCall,
  Clock,
  LogOut,
  CheckCircle2,
  ArrowRight,
  ShieldAlert,
  Loader2,
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

function WhatsAppIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
    </svg>
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
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);

  const fetchStatus = useCallback(async (isBackground = false) => {
    try {
      if (!isBackground) setChecking(true);
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
          // Redirect immediately to dashboard
          setTimeout(() => {
            window.location.href = "/dashboard";
          }, 600);
        }
      } else {
        setState((prev) => ({ ...prev, loading: false }));
      }
    } catch (err) {
      console.error("Failed to check status:", err);
      setState((prev) => ({ ...prev, loading: false }));
    } finally {
      if (!isBackground) setChecking(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();

    // Background auto-polling every 6s so the moment admin activates them,
    // the UI immediately confirms and enters the CRM automatically!
    pollTimerRef.current = setInterval(() => {
      fetchStatus(true);
    }, 6000);

    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
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
        month: "short",
        day: "numeric",
      })
    : null;

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background px-4 py-8">
      {/* Background radial gradient glow for premium feel matching Login */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] rounded-full bg-emerald-500/5 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Main Card with exact same styling, border, and shadows as Login page */}
        <div className="rounded-2xl border border-border/80 bg-card/95 p-6 sm:p-8 shadow-xl shadow-black/5 dark:shadow-black/25 backdrop-blur-sm">
          
          {/* Header section matching Login */}
          <div className="flex flex-col items-center text-center space-y-3 pb-6 border-b border-border/60">
            {justActivated ? (
              <div className="flex size-16 items-center justify-center rounded-2xl bg-emerald-500/10 border border-emerald-500/20 shadow-2xs">
                <CheckCircle2 className="size-8 text-emerald-500" />
              </div>
            ) : isExpired ? (
              <div className="flex size-16 items-center justify-center rounded-2xl bg-amber-500/10 border border-amber-500/20 shadow-2xs">
                <Clock className="size-8 text-amber-500" />
              </div>
            ) : (
              <div className="flex size-16 items-center justify-center rounded-2xl bg-muted/40 border border-border/80 p-2 shadow-2xs">
                <Image
                  src="/logo.png"
                  alt="WACRM Logo"
                  width={56}
                  height={56}
                  className="size-12 object-contain"
                  priority
                />
              </div>
            )}

            <div className="space-y-1">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                {justActivated
                  ? "Account Activated!"
                  : isExpired
                  ? "Subscription Expired"
                  : "Account Inactive"}
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground max-w-xs mx-auto">
                {justActivated
                  ? "Your account is active. Redirecting to your dashboard..."
                  : isExpired
                  ? formattedExpiry
                    ? `Your account subscription expired on ${formattedExpiry}. Please contact administrator to renew.`
                    : "Your account subscription period has expired. Please contact administrator to renew."
                  : "Your account is currently inactive. In order to access the CRM, an administrator must activate your account."}
              </p>
            </div>

            {/* User email badge */}
            {userEmail && (
              <div className="inline-flex items-center gap-2 rounded-full border border-border/80 bg-muted/30 px-3 py-1 text-xs font-medium text-foreground">
                <span className={`size-1.5 rounded-full ${justActivated ? "bg-emerald-500" : isExpired ? "bg-amber-500" : "bg-rose-500"}`} />
                <span className="truncate max-w-[200px]">{userEmail}</span>
                <span className="text-muted-foreground/60">•</span>
                <span className={`capitalize font-semibold ${justActivated ? "text-emerald-500" : isExpired ? "text-amber-500" : "text-rose-500"}`}>
                  {justActivated ? "Active" : state.status}
                </span>
              </div>
            )}
          </div>

          {/* Body Section */}
          <div className="mt-6 flex flex-col gap-4">
            {justActivated ? (
              <Button
                type="button"
                onClick={() => router.push("/dashboard")}
                className="mt-2 h-10 w-full rounded-lg bg-emerald-600 font-medium text-white hover:bg-emerald-500 transition-colors cursor-pointer shadow-sm active:scale-[0.99] flex items-center justify-center gap-2"
              >
                <span>Enter CRM Dashboard</span>
                <ArrowRight className="size-4" />
              </Button>
            ) : (
              <>
                {/* Notice Info Box */}
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3.5 py-3 text-xs sm:text-sm text-foreground space-y-1">
                  <p className="font-semibold text-foreground text-xs sm:text-sm">
                    How to get your account activated:
                  </p>
                  <p className="text-muted-foreground text-xs leading-relaxed">
                    Please contact the administrator via phone call or WhatsApp to request activation for your account.
                  </p>
                </div>

                {/* WhatsApp Button */}
                <a
                  href={whatsAppUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full inline-block"
                >
                  <Button
                    type="button"
                    className="h-10 w-full rounded-lg bg-emerald-600 font-medium text-white hover:bg-emerald-500 transition-colors cursor-pointer shadow-sm active:scale-[0.99] flex items-center justify-center gap-2"
                  >
                    <WhatsAppIcon className="size-4 fill-white shrink-0" />
                    <span>WhatsApp Administrator</span>
                  </Button>
                </a>

                {/* Phone Call Button */}
                <a href={callUrl} className="w-full inline-block">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-10 w-full rounded-lg border-border/80 bg-muted/30 text-foreground hover:bg-muted font-medium transition-colors shadow-2xs flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <PhoneCall className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span>Call to {ADMIN_CONTACT_PHONE}</span>
                  </Button>
                </a>

                {/* Check Status Button */}
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => fetchStatus(false)}
                  disabled={checking}
                  className="h-9 w-full text-xs text-muted-foreground hover:text-foreground gap-2 cursor-pointer"
                >
                  {checking ? (
                    <Loader2 className="size-3.5 animate-spin text-emerald-500" />
                  ) : (
                    <span className="size-2 rounded-full bg-emerald-500" />
                  )}
                  <span>
                    {checking
                      ? "Checking status with server..."
                      : "Already activated? Check Status"}
                  </span>
                </Button>
              </>
            )}

            {/* Footer Navigation matching Login */}
            <div className="mt-2 pt-4 border-t border-border/60 flex items-center justify-between text-xs text-muted-foreground">
              <Link
                href="/login"
                className="font-medium text-emerald-600 hover:text-emerald-500 dark:text-emerald-400 transition-colors"
              >
                ← Back to Login
              </Link>

              <button
                type="button"
                onClick={handleSignOut}
                className="inline-flex items-center gap-1.5 hover:text-destructive cursor-pointer transition-colors"
              >
                <LogOut className="size-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer Support Info */}
        <p className="mt-5 text-center text-xs text-muted-foreground">
          GrowNext Security &bull; Administrator Hotline:{" "}
          <a
            href={callUrl}
            className="font-medium text-emerald-600 hover:text-emerald-500 dark:text-emerald-400 underline"
          >
            {ADMIN_CONTACT_PHONE_INTL}
          </a>
        </p>
      </div>
    </div>
  );
}
