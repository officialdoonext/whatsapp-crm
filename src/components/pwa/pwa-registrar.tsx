"use client";

import { useEffect } from "react";

declare global {
  interface Window {
    __pwaPrompt?: any;
  }
}

export function PwaRegistrar() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    // 1. Capture beforeinstallprompt globally so any component can trigger install
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      window.__pwaPrompt = e;
      window.dispatchEvent(new CustomEvent("pwa-prompt-available"));
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);

    // 2. Register Service Worker with cache disabled for SW script
    navigator.serviceWorker
      .register("/sw.js", { updateViaCache: "none" })
      .then((registration) => {
        // Immediate update check
        registration.update().catch(() => {});

        // On new update found
        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener("statechange", () => {
              if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
                // New deployment ready — tell worker to skip waiting
                newWorker.postMessage({ type: "SKIP_WAITING" });
              }
            });
          }
        });

        // Periodic background update checks every 60 seconds
        const intervalId = window.setInterval(() => {
          registration.update().catch(() => {});
        }, 60 * 1000);

        // Check for updates when user returns to the app
        const handleVisibilityChange = () => {
          if (document.visibilityState === "visible") {
            registration.update().catch(() => {});
          }
        };

        document.addEventListener("visibilitychange", handleVisibilityChange);

        return () => {
          window.clearInterval(intervalId);
          document.removeEventListener("visibilitychange", handleVisibilityChange);
        };
      })
      .catch((err) => {
        console.warn("[PWA] Service worker registration failed:", err);
      });

    // 3. Auto-update: When new service worker activates (e.g. after new deployment), reload
    let refreshing = false;
    const handleControllerChange = () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange);
    };
  }, []);

  return null;
}
