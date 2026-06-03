// ─── Import pipeline types ────────────────────────────────────────────────────
//
// Data flows through five stages:
//   RawLine  →  NormalizedLine  →  ClassifiedLine  →  ParsedTransaction
//              (adapter)          (normalize)         (classify+reconcile)
//
// Amounts are kept as signed integer CENTAVOS throughout the pipeline.
// Negative = outflow (SAIDA). Positive = inflow (ENTRADA).
// Only at the final output step do we convert to the legacy positive float
// that the rest of the app expects in ParsedTransaction.amount.

export type RawLine = {
  date: string;          // raw date string as it appeared in the document
  description: string;   // cleaned: no IDs, no R$ values, collapsed whitespace
  valorRaw: string;      // e.g. "R$ -1.000,50" or "1.000,50"
  saldoRaw?: string;     // running balance if present, e.g. "R$ 2.500,00"
  id?: string;           // operation ID if the format has one
};

export type NormalizedLine = {
  date: string;          // ISO YYYY-MM-DD
  description: string;   // trimmed, single-space
  valueCents: number;    // signed integer centavos: -150050 = R$-1.500,50
  balanceCents?: number; // signed integer centavos (unsigned in practice)
  id?: string;
};

export type Classification = "ENTRADA" | "SAIDA" | "IGNORAR";

export type ClassifiedLine = NormalizedLine & {
  classification: Classification;
};

export type BankHeader = {
  sourceLabel: string;
  initialBalanceCents?: number;
  finalBalanceCents?: number;
  totalEntradasCents?: number;  // from document summary if available
  totalSaidasCents?: number;
};

export type ReconciliationResult = {
  ok: boolean;
  method: "balance-column" | "totals" | "none";
  toleranceCents: number;
  diffCents: number;       // signed residual; 0 = perfect
  suspectIndices: number[]; // indices of lines that broke the invariant
};

// Return value of the full pipeline. IGNORAR lines are excluded from
// transactions — they are counted but not saved (can be stored later when
// a dedicated field is added to the Firestore schema).
export type PipelineResult = {
  sourceLabel: string;
  lines: ClassifiedLine[];          // ALL lines (ENTRADA + SAIDA + IGNORAR)
  ignoredCount: number;
  reconciliation: ReconciliationResult;
  warnings: string[];
};
