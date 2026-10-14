"use client";

import Image from "next/image";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Download,
  Smartphone,
  CheckCircle2,
  Share,
  PlusSquare,
  UsersRound,
  Loader2,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageInner />
    </Suspense>
  );
}

function LoginPageInner() {
  const searchParams = useSearchParams();
  const inviteToken = searchParams.get("invite");
  const t = useTranslations("LoginPage");
  const linkError = searchParams.get("error");
  const linkErrorMessage =
    linkError === "link_expired"
      ? t("linkExpired")
      : linkError === "link_invalid"
        ? t("linkInvalid")
        : null;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  // PWA Installation state
  const [isStandalone, setIsStandalone] = useState(false);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [iosModalOpen, setIosModalOpen] = useState(false);

  useEffect(() => {
    // Check if already running in standalone PWA mode
    const checkStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsStandalone(checkStandalone);

    // Check iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIosDevice);

    if (window.__pwaPrompt) {
      setIsInstallable(true);
    }

    const onPromptAvailable = () => {
      setIsInstallable(true);
    };

    const onAppInstalled = () => {
      setIsStandalone(true);
      setIsInstallable(false);
      window.__pwaPrompt = null;
    };

    window.addEventListener("pwa-prompt-available", onPromptAvailable);
    window.addEventListener("appinstalled", onAppInstalled);

    return () => {
      window.removeEventListener("pwa-prompt-available", onPromptAvailable);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    // 1. If native prompt event is ready, prompt immediately
    if (window.__pwaPrompt) {
      const promptEvent = window.__pwaPrompt;
      try {
        await promptEvent.prompt();
        const choiceResult = await promptEvent.userChoice;
        if (choiceResult && choiceResult.outcome === "accepted") {
          setIsStandalone(true);
          setIsInstallable(false);
        }
      } catch (err) {
        console.error("Install prompt error:", err);
      }
      window.__pwaPrompt = null;
      return;
    }

    // 2. If on iOS (Safari doesn't support programmatic beforeinstallprompt)
    if (isIOS) {
      setIosModalOpen(true);
      return;
    }

    // 3. For Windows & Android: If event is still buffering, wait up to 1.5s and prompt immediately
    let waited = 0;
    const interval = setInterval(async () => {
      waited += 150;
      if (window.__pwaPrompt) {
        clearInterval(interval);
        const p = window.__pwaPrompt;
        window.__pwaPrompt = null;
        try {
          await p.prompt();
          const choice = await p.userChoice;
          if (choice && choice.outcome === "accepted") {
            setIsStandalone(true);
            setIsInstallable(false);
          }
        } catch (e) {
          console.error("Install prompt error:", e);
        }
      } else if (waited >= 1200) {
        clearInterval(interval);
        toast.info("Click the install icon in your browser address bar to install WACRM.");
      }
    }, 150);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    const destination = inviteToken
      ? `/join/${encodeURIComponent(inviteToken)}`
      : "/dashboard";
    window.location.href = destination;
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background px-4 py-8">
      {/* Background radial gradient glow for premium feel */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] rounded-full bg-emerald-500/5 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Main Auth Card with clean, undistorted layout */}
        <div className="rounded-2xl border border-border/80 bg-card/95 p-6 sm:p-8 shadow-xl shadow-black/5 dark:shadow-black/25 backdrop-blur-sm">
          {/* Header section */}
          <div className="flex flex-col items-center text-center space-y-3 pb-6 border-b border-border/60">
            {inviteToken ? (
              <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 border border-primary/20">
                <UsersRound className="size-7 text-primary" />
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
                {inviteToken ? t("titleAccept") : t("titleWelcome")}
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground">
                {inviteToken ? t("descAccept") : t("descWelcome")}
              </p>
            </div>
          </div>

          {/* Form section */}
          <form onSubmit={handleLogin} className="mt-6 flex flex-col gap-4">
            {linkErrorMessage && !error && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3.5 py-2.5 text-xs sm:text-sm text-amber-300">
                {linkErrorMessage}
              </div>
            )}
            {error && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-xs sm:text-sm text-red-400">
                {error}
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email" className="text-xs font-medium text-muted-foreground">
                {t("emailLabel")}
              </Label>
              <Input
                id="email"
                type="email"
                placeholder={t("emailPlaceholder")}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-10 rounded-lg border-border/80 bg-muted/30 px-3.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus-visible:border-emerald-500 focus-visible:ring-emerald-500/20"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-xs font-medium text-muted-foreground">
                  {t("passwordLabel")}
                </Label>
                <Link
                  href="/forgot-password"
                  className="text-xs text-emerald-600 hover:text-emerald-500 dark:text-emerald-400"
                >
                  {t("forgotPassword")}
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                placeholder={t("passwordPlaceholder")}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="h-10 rounded-lg border-border/80 bg-muted/30 px-3.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus-visible:border-emerald-500 focus-visible:ring-emerald-500/20"
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="mt-2 h-10 w-full rounded-lg bg-emerald-600 font-medium text-white hover:bg-emerald-500 disabled:opacity-50 transition-colors cursor-pointer shadow-sm active:scale-[0.99]"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="size-4 animate-spin" />
                  {t("signingIn")}
                </span>
              ) : (
                t("signIn")
              )}
            </Button>
          </form>

          {/* Create account link */}
          <p className="mt-5 text-center text-xs text-muted-foreground">
            {t("noAccount")}{" "}
            <Link
              href={
                inviteToken
                  ? `/signup?invite=${encodeURIComponent(inviteToken)}`
                  : "/signup"
              }
              className="font-medium text-emerald-600 hover:text-emerald-500 dark:text-emerald-400"
            >
              {t("createAccount")}
            </Link>
          </p>

          {/* PWA Install Button Section */}
          <div className="mt-6 pt-5 border-t border-border/60">
            {isStandalone ? (
              <div className="flex items-center justify-center gap-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 py-2 px-3 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="size-4 text-emerald-500" />
                <span>WACRM is installed on this device</span>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 rounded-xl bg-muted/30 border border-border/70 p-3">
                <div className="flex items-center gap-2.5 text-left">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    <Smartphone className="size-4" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-foreground leading-tight">Install WACRM App</p>
                    <p className="text-[11px] text-muted-foreground leading-tight">Fast access & instant alerts</p>
                  </div>
                </div>

                <Button
                  type="button"
                  onClick={handleInstallClick}
                  className="w-full sm:w-auto h-8 px-3.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs transition-all active:scale-95 shrink-0"
                >
                  <Download className="size-3.5 mr-1.5" />
                  Install App
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* iOS Safari Install Guide Dialog */}
      <Dialog open={iosModalOpen} onOpenChange={setIosModalOpen}>
        <DialogContent className="max-w-xs sm:max-w-sm rounded-2xl bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold flex items-center gap-2 text-foreground">
              <Smartphone className="size-5 text-emerald-500" />
              Install on iPhone or iPad
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground pt-1">
              Follow these two quick steps in Safari to install WACRM on your home screen:
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div className="flex items-start gap-3 rounded-lg border border-border/80 bg-muted/40 p-2.5">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 font-bold text-emerald-500 text-xs">
                1
              </span>
              <p className="text-foreground">
                Tap the <span className="font-semibold text-emerald-500 inline-flex items-center gap-1"><Share className="size-3.5 inline" /> Share</span> button at the bottom of Safari.
              </p>
            </div>

            <div className="flex items-start gap-3 rounded-lg border border-border/80 bg-muted/40 p-2.5">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 font-bold text-emerald-500 text-xs">
                2
              </span>
              <p className="text-foreground">
                Scroll down and select <span className="font-semibold text-emerald-500 inline-flex items-center gap-1"><PlusSquare className="size-3.5 inline" /> Add to Home Screen</span>.
              </p>
            </div>
          </div>

          <Button
            type="button"
            onClick={() => setIosModalOpen(false)}
            className="w-full h-9 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium"
          >
            Got it
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
