// ─── Feature flags ───────────────────────────────────────────────────────────
//
// Simple allowlist-based gating. The credit-card feature (UI + fatura routing)
// is visible ONLY to the emails below until it's rolled out to everyone.

import type { User } from "firebase/auth";

// Match is by EXACT email (lowercased), not uid. Firebase Auth treats a
// "+tag" alias as a DISTINCT account with its own email string, so each alias
// needs its own entry here — the +demo line is NOT covered by the principal.
const CARDS_ALLOWLIST = [
  "jpmendesdasilva27@gmail.com",       // conta principal
  "jpmendesdasilva27+demo@gmail.com",  // conta de teste (DEMO)
];

export function isCardsEnabled(user: User | null | undefined): boolean {
  const email = user?.email?.trim().toLowerCase();
  return !!email && CARDS_ALLOWLIST.includes(email);
}
