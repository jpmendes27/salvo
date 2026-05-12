type GtagFn = (...args: unknown[]) => void;

function gtag(...args: unknown[]) {
  if (typeof window === "undefined") return;
  const w = window as Window & { gtag?: GtagFn; dataLayer?: unknown[] };
  if (typeof w.gtag === "function") w.gtag(...args);
}

export function track(event: string, params?: Record<string, unknown>) {
  gtag("event", event, params ?? {});
}
