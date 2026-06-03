// ─── Reconciliation layer ─────────────────────────────────────────────────────
//
// Validates that the sum of extracted values matches what the bank document
// claims. Two strategies:
//
//   balance-column: each line carries a running balance.
//     Invariant: balance[n] === balance[n-1] + value[n]
//     Anchored at the initial balance from the document header.
//
//   totals: no per-line balance, but the document header has total
//     entradas/saídas or final balance. Validate sum(values) against that.
//
// Amounts are signed integer CENTAVOS throughout.

import type { NormalizedLine, BankHeader, ReconciliationResult } from "./types";

// Two-cent tolerance: covers floating-point round-trip errors in source PDFs.
const DEFAULT_TOLERANCE_CENTS = 2;

// Strategy 1 — per-line balance column
// MP, some Nubank estrato, Santander PDF, etc.
export function reconcileWithBalanceColumn(
  lines: NormalizedLine[],
  header: BankHeader,
  toleranceCents = DEFAULT_TOLERANCE_CENTS,
): ReconciliationResult {
  const suspectIndices: number[] = [];

  if (lines.length === 0) {
    return { ok: true, method: "balance-column", toleranceCents, diffCents: 0, suspectIndices: [] };
  }

  // Anchor: initial balance from header, or the balance before the first line.
  // balance[n] = balance[n-1] + value[n]
  // → balance before first line = lines[0].balanceCents - lines[0].valueCents
  const inferredInitial =
    lines[0].balanceCents !== undefined
      ? lines[0].balanceCents - lines[0].valueCents
      : undefined;

  const initialBalance =
    header.initialBalanceCents !== undefined
      ? header.initialBalanceCents
      : inferredInitial;

  if (initialBalance === undefined) {
    // Cannot anchor — downgrade to totals strategy
    return reconcileWithTotals(lines, header, toleranceCents);
  }

  let running = initialBalance;
  let maxDiff = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    running += line.valueCents;

    if (line.balanceCents !== undefined) {
      const diff = Math.abs(running - line.balanceCents);
      if (diff > toleranceCents) {
        suspectIndices.push(i);
        // Correct running total using the authoritative balance from the document
        // so subsequent lines are not cascaded-wrong.
        running = line.balanceCents;
        if (diff > maxDiff) maxDiff = diff;
      }
    }
  }

  // Final balance check
  const finalBalance = header.finalBalanceCents;
  const finalDiff = finalBalance !== undefined ? Math.abs(running - finalBalance) : 0;
  if (finalBalance !== undefined && finalDiff > toleranceCents) {
    maxDiff = Math.max(maxDiff, finalDiff);
  }

  return {
    ok: suspectIndices.length === 0 && finalDiff <= toleranceCents,
    method: "balance-column",
    toleranceCents,
    diffCents: maxDiff,
    suspectIndices,
  };
}

// Strategy 2 — header totals (no per-line balance)
// CSV from Nubank, OFX, any format without saldo column.
export function reconcileWithTotals(
  lines: NormalizedLine[],
  header: BankHeader,
  toleranceCents = DEFAULT_TOLERANCE_CENTS,
): ReconciliationResult {
  const noInfo: ReconciliationResult = {
    ok: true,
    method: "none",
    toleranceCents,
    diffCents: 0,
    suspectIndices: [],
  };

  const sumCents = lines.reduce((s, l) => s + l.valueCents, 0);

  // Try: sum == totalEntradas - totalSaidas
  if (
    header.totalEntradasCents !== undefined &&
    header.totalSaidasCents !== undefined
  ) {
    const expected = header.totalEntradasCents - header.totalSaidasCents;
    const diff = Math.abs(sumCents - expected);
    return {
      ok: diff <= toleranceCents,
      method: "totals",
      toleranceCents,
      diffCents: diff,
      suspectIndices: [],
    };
  }

  // Try: sum == finalBalance - initialBalance
  if (
    header.finalBalanceCents !== undefined &&
    header.initialBalanceCents !== undefined
  ) {
    const expected = header.finalBalanceCents - header.initialBalanceCents;
    const diff = Math.abs(sumCents - expected);
    return {
      ok: diff <= toleranceCents,
      method: "totals",
      toleranceCents,
      diffCents: diff,
      suspectIndices: [],
    };
  }

  return noInfo;
}
