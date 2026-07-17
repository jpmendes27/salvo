// ─── Classification layer ─────────────────────────────────────────────────────
//
// Converts a NormalizedLine into one of: ENTRADA | SAIDA | IGNORAR
//
// Default rule:
//   valueCents > 0  → ENTRADA
//   valueCents < 0  → SAIDA
//   valueCents == 0 → IGNORAR (zero-amount is never a real transaction)
//
// IGNORAR overrides (per-bank config): internal movements that don't
// represent real income or spending. They are kept in the pipeline output
// (for future storage) but excluded from the user's financial summary.
//
// Note on "Reembolso" and "Estorno" in Mercado Pago:
//   These are internal MP accounting entries for reversed/refunded
//   operations — they cancel out a previous movement and don't represent
//   new real income. Mark as IGNORAR so they don't inflate the balance.

import type { NormalizedLine, ClassifiedLine, Classification } from "./types";
import { MP_IGNORE_PATTERNS } from "../shared/mp-ignore";

// Patterns keyed by bank slug. Applied to the normalised description
// (lowercase, NFD-stripped) BEFORE the sign-based default. Fonte da verdade
// compartilhada com o servidor (classifyServer) — ver src/lib/shared/mp-ignore.ts.
const IGNORE_PATTERNS: Record<string, RegExp[]> = {
  "mercado-pago": MP_IGNORE_PATTERNS,
};

// Common zero-value patterns (all banks)
const ZERO_PATTERNS: RegExp[] = [
  /saldo\s+(anterior|inicial|atual|final)/i,
  /saldo\s+restante/i,
  /total\s+a\s+pagar/i,
  /pagamento\s+minimo/i,
  /limite\s+disponiv/i,
];

function shouldIgnore(description: string, bankSlug: string): boolean {
  const d = description.normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
  const bankPatterns = IGNORE_PATTERNS[bankSlug] ?? [];
  return (
    bankPatterns.some((p) => p.test(d)) ||
    ZERO_PATTERNS.some((p) => p.test(d))
  );
}

export function classifyLine(
  line: NormalizedLine,
  bankSlug: string,
): ClassifiedLine {
  let classification: Classification;

  if (line.valueCents === 0) {
    classification = "IGNORAR";
  } else if (shouldIgnore(line.description, bankSlug)) {
    classification = "IGNORAR";
  } else {
    classification = line.valueCents > 0 ? "ENTRADA" : "SAIDA";
  }

  return { ...line, classification };
}

// Convenience: classify an entire array of lines.
export function classifyLines(
  lines: NormalizedLine[],
  bankSlug: string,
): ClassifiedLine[] {
  return lines.map((l) => classifyLine(l, bankSlug));
}
