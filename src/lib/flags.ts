// ─── Feature flags ───────────────────────────────────────────────────────────
//
// Simple allowlist-based gating. The credit-card feature (UI + fatura routing)
// is visible ONLY to the emails below until it's rolled out to everyone.

import type { User } from "firebase/auth";

const CARDS_ALLOWLIST = [
  "jpmendesdasilva27@gmail.com",
];

export function isCardsEnabled(user: User | null | undefined): boolean {
  const email = user?.email?.toLowerCase();
  return !!email && CARDS_ALLOWLIST.includes(email);
}
