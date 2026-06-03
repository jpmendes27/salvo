// ─── Shared normalization layer ───────────────────────────────────────────────
//
// Bank-agnostic. Converts raw strings produced by adapters into typed,
// arithmetic-safe values. All monetary amounts are SIGNED INTEGER CENTAVOS.
//
// Rule: never do arithmetic on floats. 1000 cents + 50 cents = 1050 cents.
// Convert to float ONLY at the boundary where the rest of the app reads it.

import type { RawLine, NormalizedLine } from "./types";

const PT_MONTHS: Record<string, string> = {
  jan: "01", fev: "02", mar: "03", abr: "04", mai: "05", jun: "06",
  jul: "07", ago: "08", set: "09", out: "10", nov: "11", dez: "12",
};

// parseBRCentavos("R$ -1.000,50") → -100050
// parseBRCentavos("R$ 1.000,50")  → 100050
// parseBRCentavos("-18,75")       → -1875
// parseBRCentavos("0,01")         → 1
export function parseBRCentavos(raw: string): number {
  // Strip whitespace and R$ prefix (any position, with or without space)
  let s = raw.replace(/\s/g, "").replace(/R\$/gi, "").trim();

  // Capture sign before stripping it
  const negative = s.startsWith("-") || s.startsWith("−");
  s = s.replace(/^[-−+]/, "").trim();

  // BR format: digits with optional thousand-dot separator, comma decimal
  // e.g. "1.234,56" or "234,56" or "1.234.567,89"
  const brMatch = s.match(/^([\d.]+),(\d{1,2})$/);
  if (brMatch) {
    const intPart = brMatch[1].replace(/\./g, ""); // remove thousand separators
    const decPart = brMatch[2].padEnd(2, "0");
    const cents = parseInt(intPart, 10) * 100 + parseInt(decPart, 10);
    return negative ? -cents : cents;
  }

  // US format: digits with optional comma separator, dot decimal
  const usMatch = s.match(/^([\d,]+)\.(\d{1,2})$/);
  if (usMatch) {
    const intPart = usMatch[1].replace(/,/g, "");
    const decPart = usMatch[2].padEnd(2, "0");
    const cents = parseInt(intPart, 10) * 100 + parseInt(decPart, 10);
    return negative ? -cents : cents;
  }

  // Integer only (no decimal)
  const intMatch = s.match(/^[\d.]+$/);
  if (intMatch) {
    const intPart = s.replace(/\./g, "").replace(/,/g, "");
    const cents = parseInt(intPart, 10) * 100;
    return negative ? -cents : cents;
  }

  return 0; // unparseable
}

// Convert integer centavos back to positive float for legacy compatibility.
// Pipeline output only — never use inside pipeline arithmetic.
export function centsToFloat(cents: number): number {
  return Math.abs(cents) / 100;
}

// parseBRDate("01/01/2025") → "2025-01-01"
// parseBRDate("01/01/25")   → "2025-01-01"  (assumes 20xx)
// parseBRDate("01 jan")     → "YYYY-01-01"  with refYear fallback
export function parseBRDate(raw: string, refYear?: number): string | null {
  const s = raw.trim();
  const yr = refYear ?? new Date().getFullYear();

  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  // DD/MM/YYYY or DD/MM/YYYY
  const full = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (full) {
    const year = full[3].length === 2 ? 2000 + parseInt(full[3]) : parseInt(full[3]);
    return `${year}-${full[2].padStart(2, "0")}-${full[1].padStart(2, "0")}`;
  }

  // DD/MM (no year)
  const dm = s.match(/^(\d{1,2})[\/\-](\d{1,2})$/);
  if (dm) return `${yr}-${dm[2].padStart(2, "0")}-${dm[1].padStart(2, "0")}`;

  // DD Jan [YYYY] or DD Janeiro [YYYY]
  const dpt = s.match(/^(\d{1,2})\s+([A-Za-zÀ-ÿ]{3,})(?:\s+(\d{4}))?$/);
  if (dpt) {
    const mo = PT_MONTHS[dpt[2].toLowerCase().slice(0, 3)];
    if (!mo) return null;
    const y = dpt[3] ? parseInt(dpt[3]) : yr;
    return `${y}-${mo}-${dpt[1].padStart(2, "0")}`;
  }

  return null;
}

// Collapse multiple whitespace, trim, strip non-printable chars.
export function normalizeDescription(raw: string): string {
  return raw.replace(/[\r\n\t]+/g, " ").replace(/\s{2,}/g, " ").trim();
}

// Normalize a RawLine into a NormalizedLine.
// Returns null if the date is unparseable (record should be skipped).
export function normalizeLine(
  raw: RawLine,
  refYear?: number,
): NormalizedLine | null {
  const date = parseBRDate(raw.date, refYear);
  if (!date) return null;

  const valueCents = parseBRCentavos(raw.valorRaw);
  const balanceCents = raw.saldoRaw !== undefined
    ? parseBRCentavos(raw.saldoRaw)
    : undefined;

  return {
    date,
    description: normalizeDescription(raw.description),
    valueCents,
    balanceCents,
    id: raw.id,
  };
}
