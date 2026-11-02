"use client";

// ============================================================
// /reset-password — the form the password-reset email leads to.
//
// Supports two paths:
// 1. Direct OTP link: /reset-password?email=...&code=...
//    Verifies the 6-digit code via /api/auth/forgot-password/verify-and-reset
//    and updates the user's password directly via the admin client.
// 2. Supabase PKCE / session callback:
//    Lands here with an authenticated recovery session and updates via
//    supabase.auth.updateUser({ password }).
// ============================================================

import Image from "next/image";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CheckCircle2,
  KeyRound,
  Loader2,
  MailX,
  Eye,
  EyeOff,
} from "lucide-react";

type Status = "checking" | "ready" | "expired" | "done";

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordInner />
    </Suspense>
  );
}

function ResetPasswordInner() {
  const t = useTranslations("ResetPasswordPage");
  const searchParams = useSearchParams();
  const supabase = createClient();

  const queryEmail = searchParams.get("email") || "";
  const queryCode = searchParams.get("code") || "";

  const [status, setStatus] = useState<Status>("checking");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // If arriving with email & code in query params, it's immediately ready
    if (queryEmail && queryCode) {
      setStatus("ready");
      return;
    }

    let cancelled = false;
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!cancelled) setStatus(user ? "ready" : "expired");
    });
    return () => {
      cancelled = true;
    };
  }, [supabase, queryEmail, queryCode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError(t("passwordsMismatch"));
      return;
    }

    if (password.length < 6) {
      setError(t("passwordTooShort"));
      return;
    }

    // Path 1: Direct OTP Code verification
    if (queryEmail && queryCode) {
      setSaving(true);
      try {
        const res = await fetch("/api/auth/forgot-password/verify-and-reset", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: queryEmail.trim().toLowerCase(),
            code: queryCode.trim(),
            newPassword: password,
          }),
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(data.error || "Failed to update password. Code may have expired.");
          setSaving(false);
          return;
        }

        setSaving(false);
        setStatus("done");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to reset password.");
        setSaving(false);
      }
      return;
    }

    // Path 2: Supabase active recovery session
    setSaving(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setSaving(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setStatus("done");
  };

  if (status === "checking") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin text-emerald-500" />
          {t("checking")}
        </div>
      </div>
    );
  }

  if (status === "expired") {
    return (
      <div className="relative flex min-h-screen items-center justify-center bg-background px-4 py-8">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] rounded-full bg-emerald-500/5 blur-3xl" />
        </div>

        <div className="relative w-full max-w-md">
          <div className="rounded-2xl border border-border/80 bg-card/95 p-6 sm:p-8 shadow-xl shadow-black/5 dark:shadow-black/25 backdrop-blur-sm">
            <div className="flex flex-col items-center text-center space-y-3 pb-6 border-b border-border/60">
              <div className="flex size-14 items-center justify-center rounded-2xl bg-amber-500/10 border border-amber-500/20">
                <MailX className="size-7 text-amber-500" />
              </div>
              <div className="space-y-1">
                <h1 className="text-2xl font-bold tracking-tight text-foreground">
                  {t("expiredTitle")}
                </h1>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  {t("expiredDesc")}
                </p>
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-3">
              <Link href="/forgot-password">
                <Button className="h-10 w-full rounded-lg bg-emerald-600 font-medium text-white hover:bg-emerald-500 transition-colors shadow-sm cursor-pointer">
                  {t("requestNewLink")}
                </Button>
              </Link>
              <Link href="/login">
                <Button
                  variant="outline"
                  className="h-10 w-full rounded-lg border-border text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
                >
                  {t("backToSignIn")}
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (status === "done") {
    return (
      <div className="relative flex min-h-screen items-center justify-center bg-background px-4 py-8">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] rounded-full bg-emerald-500/5 blur-3xl" />
        </div>

        <div className="relative w-full max-w-md">
          <div className="rounded-2xl border border-border/80 bg-card/95 p-6 sm:p-8 shadow-xl shadow-black/5 dark:shadow-black/25 backdrop-blur-sm">
            <div className="flex flex-col items-center text-center space-y-3 pb-6 border-b border-border/60">
              <div className="flex size-14 items-center justify-center rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
                <CheckCircle2 className="size-7 text-emerald-500" />
              </div>
              <div className="space-y-1">
                <h1 className="text-2xl font-bold tracking-tight text-foreground">
                  {t("successTitle")}
                </h1>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  {t("successDesc")}
                </p>
              </div>
            </div>

            <div className="mt-6">
              <Button
                className="h-10 w-full rounded-lg bg-emerald-600 font-medium text-white hover:bg-emerald-500 transition-colors cursor-pointer shadow-sm"
                onClick={() => {
                  window.location.href = "/login";
                }}
              >
                {t("backToSignIn")}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] rounded-full bg-emerald-500/5 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        <div className="rounded-2xl border border-border/80 bg-card/95 p-6 sm:p-8 shadow-xl shadow-black/5 dark:shadow-black/25 backdrop-blur-sm">
          <div className="flex flex-col items-center text-center space-y-3 pb-6 border-b border-border/60">
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
            <div className="space-y-1">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">{t("title")}</h1>
              <p className="text-xs sm:text-sm text-muted-foreground">
                {queryEmail ? (
                  <span>
                    Setting new password for{" "}
                    <strong className="text-foreground">{queryEmail}</strong>
                  </span>
                ) : (
                  t("desc")
                )}
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
            {error && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-xs sm:text-sm text-red-400">
                {error}
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password" className="text-xs font-medium text-muted-foreground">
                {t("passwordLabel")}
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder={t("passwordPlaceholder")}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoFocus
                  className="h-10 rounded-lg border-border/80 bg-muted/30 pl-3.5 pr-10 text-sm text-foreground placeholder:text-muted-foreground/60 focus-visible:border-emerald-500 focus-visible:ring-emerald-500/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none transition-colors cursor-pointer"
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label
                htmlFor="confirmPassword"
                className="text-xs font-medium text-muted-foreground"
              >
                {t("confirmPasswordLabel")}
              </Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder={t("confirmPasswordPlaceholder")}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="h-10 rounded-lg border-border/80 bg-muted/30 pl-3.5 pr-10 text-sm text-foreground placeholder:text-muted-foreground/60 focus-visible:border-emerald-500 focus-visible:ring-emerald-500/20"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none transition-colors cursor-pointer"
                >
                  {showConfirmPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={saving}
              className="mt-2 h-10 w-full rounded-lg bg-emerald-600 font-medium text-white hover:bg-emerald-500 disabled:opacity-50 transition-colors cursor-pointer shadow-sm active:scale-[0.99]"
            >
              {saving ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="size-4 animate-spin" />
                  {t("saving")}
                </span>
              ) : (
                t("submit")
              )}
            </Button>

            <Link
              href="/login"
              className="mt-3 text-center text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {t("backToSignIn")}
            </Link>
          </form>
        </div>
      </div>
    </div>
  );
}
