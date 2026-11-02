"use client";

import Image from "next/image";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  KeyRound,
  CheckCircle2,
  ArrowLeft,
  Loader2,
  Mail,
  Eye,
  EyeOff,
  RotateCw,
} from "lucide-react";

type Step = "request" | "verify" | "success";

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ForgotPasswordInner />
    </Suspense>
  );
}

function ForgotPasswordInner() {
  const t = useTranslations("ForgotPasswordPage");
  const searchParams = useSearchParams();

  const queryEmail = searchParams.get("email") || "";
  const queryCode = searchParams.get("code") || "";

  const [step, setStep] = useState<Step>(queryCode ? "verify" : "request");
  const [email, setEmail] = useState(queryEmail);
  const [code, setCode] = useState(queryCode);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const interval = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [resendCooldown]);

  // If URL params change or arrive, sync them
  useEffect(() => {
    if (queryEmail && !email) setEmail(queryEmail);
    if (queryCode && !code) {
      setCode(queryCode);
      setStep("verify");
    }
  }, [queryEmail, queryCode, email, code]);

  // Step 1: Request 6-digit code via email
  const handleRequestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfoMessage(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes("@")) {
      setError("Please enter a valid email address.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: cleanEmail }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Failed to send verification code.");
      }

      setStep("verify");
      setResendCooldown(60);
      setInfoMessage(`We've sent a 6-digit verification code to ${cleanEmail}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send verification code.");
    } finally {
      setLoading(false);
    }
  };

  // Resend code handler
  const handleResendCode = async () => {
    if (resendCooldown > 0 || loading) return;
    setError(null);
    setInfoMessage(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/forgot-password/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Failed to resend verification code.");
      }

      setResendCooldown(60);
      setInfoMessage("A fresh verification code has been dispatched to your email.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to resend code.");
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify code and set new password
  const handleVerifyAndReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanCode = code.trim();
    if (!cleanCode || cleanCode.length !== 6) {
      setError(t("codeRequired"));
      return;
    }

    if (password.length < 6) {
      setError(t("passwordTooShort"));
      return;
    }

    if (password !== confirmPassword) {
      setError(t("passwordsMismatch"));
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password/verify-and-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          code: cleanCode,
          newPassword: password,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Failed to reset password. Please verify the code.");
      }

      setStep("success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background px-4 py-8">
      {/* Background radial gradient glow for consistency with /login */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] rounded-full bg-emerald-500/5 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        <div className="rounded-2xl border border-border/80 bg-card/95 p-6 sm:p-8 shadow-xl shadow-black/5 dark:shadow-black/25 backdrop-blur-sm">
          {/* Header section */}
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
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                {step === "request"
                  ? t("title")
                  : step === "verify"
                    ? t("step2Title")
                    : t("successTitle")}
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground">
                {step === "request"
                  ? t("desc")
                  : step === "verify"
                    ? t("step2Desc", { email })
                    : t("successDesc")}
              </p>
            </div>
          </div>

          {/* Form Content */}
          <div className="mt-6">
            {error && (
              <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-xs sm:text-sm text-red-400">
                {error}
              </div>
            )}

            {infoMessage && (
              <div className="mb-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2.5 text-xs sm:text-sm text-emerald-400">
                {infoMessage}
              </div>
            )}

            {/* STEP 1: Request Code */}
            {step === "request" && (
              <form onSubmit={handleRequestCode} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="email" className="text-xs font-medium text-muted-foreground">
                    {t("emailLabel")}
                  </Label>
                  <div className="relative">
                    <Input
                      id="email"
                      type="email"
                      placeholder={t("emailPlaceholder")}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      autoFocus
                      className="h-10 rounded-lg border-border/80 bg-muted/30 pl-3.5 pr-10 text-sm text-foreground placeholder:text-muted-foreground/60 focus-visible:border-emerald-500 focus-visible:ring-emerald-500/20"
                    />
                    <Mail className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="mt-2 h-10 w-full rounded-lg bg-emerald-600 font-medium text-white hover:bg-emerald-500 disabled:opacity-50 transition-colors cursor-pointer shadow-sm active:scale-[0.99]"
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="size-4 animate-spin" />
                      {t("sending")}
                    </span>
                  ) : (
                    t("sendLink")
                  )}
                </Button>

                <Link
                  href="/login"
                  className="mt-4 flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ArrowLeft className="size-3.5" />
                  {t("backToSignIn")}
                </Link>
              </form>
            )}

            {/* STEP 2: Verify Code and Set New Password */}
            {step === "verify" && (
              <form onSubmit={handleVerifyAndReset} className="flex flex-col gap-4">
                {/* 6-Digit Code */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="code" className="text-xs font-medium text-muted-foreground">
                      {t("codeLabel")}
                    </Label>
                    <button
                      type="button"
                      onClick={() => setStep("request")}
                      className="text-xs text-emerald-600 hover:text-emerald-500 dark:text-emerald-400 cursor-pointer"
                    >
                      {t("changeEmail")}
                    </button>
                  </div>
                  <Input
                    id="code"
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder={t("codePlaceholder")}
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    required
                    autoFocus
                    className="h-11 rounded-lg border-border/80 bg-muted/30 px-3.5 text-center font-mono text-lg font-bold tracking-[0.4em] text-foreground placeholder:tracking-normal placeholder:font-normal placeholder:text-muted-foreground/60 focus-visible:border-emerald-500 focus-visible:ring-emerald-500/20"
                  />
                </div>

                {/* New Password */}
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="password" className="text-xs font-medium text-muted-foreground">
                    {t("newPasswordLabel")}
                  </Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder={t("newPasswordPlaceholder")}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      autoComplete="new-password"
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

                {/* Confirm New Password */}
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
                      placeholder={t("confirmPasswordPlaceholder")}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      autoComplete="new-password"
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
                  disabled={loading}
                  className="mt-2 h-10 w-full rounded-lg bg-emerald-600 font-medium text-white hover:bg-emerald-500 disabled:opacity-50 transition-colors cursor-pointer shadow-sm active:scale-[0.99]"
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="size-4 animate-spin" />
                      {t("resettingBtn")}
                    </span>
                  ) : (
                    t("resetPasswordBtn")
                  )}
                </Button>

                {/* Resend & Navigation */}
                <div className="mt-2 flex items-center justify-between text-xs">
                  <button
                    type="button"
                    onClick={handleResendCode}
                    disabled={resendCooldown > 0 || loading}
                    className="inline-flex items-center gap-1.5 text-emerald-600 hover:text-emerald-500 dark:text-emerald-400 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed transition-colors"
                  >
                    <RotateCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
                    {resendCooldown > 0
                      ? t("resendCodeIn", { seconds: resendCooldown })
                      : t("resendCode")}
                  </button>

                  <Link
                    href="/login"
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {t("backToSignIn")}
                  </Link>
                </div>
              </form>
            )}

            {/* STEP 3: Success State */}
            {step === "success" && (
              <div className="flex flex-col items-center text-center space-y-5 py-2">
                <div className="flex size-14 items-center justify-center rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
                  <CheckCircle2 className="size-8 text-emerald-500" />
                </div>

                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">
                    You can now use your newly configured password to sign in to your dashboard.
                  </p>
                </div>

                <Link href="/login" className="w-full">
                  <Button className="h-10 w-full rounded-lg bg-emerald-600 font-medium text-white hover:bg-emerald-500 transition-colors cursor-pointer shadow-sm active:scale-[0.99]">
                    {t("signInBtn")}
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
