"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

const GA_ID = process.env.NEXT_PUBLIC_GA_ID;

// Fires gtag('config') on every client-side navigation so GA4 records a page_view
// for SPA route changes (Next.js App Router uses history.pushState, not full reloads).
// Skips the initial mount because the inline gtag('config') in <head> already fired it.
export function AnalyticsTracker() {
  const pathname = usePathname();
  const mounted = useRef(false);

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    if (!GA_ID || typeof window === "undefined") return;
    try {
      const w = window as Window & { gtag?: (...args: unknown[]) => void };
      if (typeof w.gtag === "function") {
        w.gtag("config", GA_ID, {
          page_path: pathname,
          page_title: document.title,
          page_location: window.location.href,
        });
      }
    } catch { /* analytics must never break the app */ }
  }, [pathname]);

  return null;
}
