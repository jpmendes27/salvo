type GtagFn = (...args: unknown[]) => void;

function gtag(...args: unknown[]) {
  if (typeof window === "undefined") return;
  try {
    const w = window as Window & { gtag?: GtagFn; dataLayer?: unknown[] };
    if (typeof w.gtag === "function") w.gtag(...args);
  } catch { /* analytics must never break the app (WebView/storage restrictions) */ }
}

export function track(event: string, params?: Record<string, unknown>) {
  gtag("event", event, params ?? {});
}
