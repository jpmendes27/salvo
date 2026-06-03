// ─── Import pipeline orchestrator ────────────────────────────────────────────
//
// Five-stage pipeline:
//   1. Detect format
//   2. Adapt  → RawLine[]
//   3. Normalize → NormalizedLine[]
//   4. Reconcile → ReconciliationResult
//   5. Classify → ClassifiedLine[]
//
// Returns PipelineResult. Callers convert ClassifiedLine[] to ParsedTransaction[]
// by filtering IGNORAR and applying categorization.

import type { RawLine, NormalizedLine, BankHeader, PipelineResult } from "./types";
import { normalizeLine } from "./normalize";
import { reconcileWithBalanceColumn, reconcileWithTotals } from "./reconcile";
import { classifyLines } from "./classify";
import { isMercadoPago, parseMPText, SLUG as MP_SLUG } from "./adapters/mercado-pago";

// ─── Format detection ─────────────────────────────────────────────────────────

type KnownFormat = "mercado-pago" | "unknown";

function detectFormat(text: string, filename: string): KnownFormat {
  if (isMercadoPago(text, filename)) return "mercado-pago";
  return "unknown";
}

// ─── Adapter dispatch ─────────────────────────────────────────────────────────

function adapt(
  text: string,
  filename: string,
  format: KnownFormat,
): { rawLines: RawLine[]; header: BankHeader } {
  switch (format) {
    case "mercado-pago": {
      const { lines, header } = parseMPText(text);
      return { rawLines: lines, header };
    }
    default:
      return { rawLines: [], header: { sourceLabel: "Importação" } };
  }
}

// ─── Main pipeline ────────────────────────────────────────────────────────────

export function runPipeline(
  text: string,
  filename = "",
  refYear?: number,
): PipelineResult {
  const format = detectFormat(text, filename);
  const warnings: string[] = [];

  if (format === "unknown") {
    return {
      sourceLabel: "Importação",
      lines: [],
      ignoredCount: 0,
      reconciliation: {
        ok: true,
        method: "none",
        toleranceCents: 2,
        diffCents: 0,
        suspectIndices: [],
      },
      warnings: ["Formato não reconhecido pelo pipeline."],
    };
  }

  // Stage 2 — Adapt
  const { rawLines, header } = adapt(text, filename, format);

  // Stage 3 — Normalize
  const normalized: NormalizedLine[] = [];
  let skipCount = 0;
  for (const raw of rawLines) {
    const n = normalizeLine(raw, refYear);
    if (!n) { skipCount++; continue; }
    normalized.push(n);
  }
  if (skipCount > 0) {
    warnings.push(`${skipCount} linha(s) ignoradas por data inválida.`);
  }

  // Stage 4 — Reconcile
  // Use balance-column strategy for formats that have it; totals otherwise.
  const hasBalanceColumn = normalized.some((l) => l.balanceCents !== undefined);
  const reconciliation = hasBalanceColumn
    ? reconcileWithBalanceColumn(normalized, header)
    : reconcileWithTotals(normalized, header);

  if (!reconciliation.ok) {
    const msg = reconciliation.method === "balance-column"
      ? `Reconciliação: ${reconciliation.suspectIndices.length} linha(s) não batem com o saldo. Diferença máxima: ${reconciliation.diffCents} centavos.`
      : `Reconciliação: soma não fecha com o cabeçalho. Diferença: ${reconciliation.diffCents} centavos.`;
    warnings.push(msg);
    console.warn(`[salvo:import:pipeline] ${msg}`);
  }

  // Stage 5 — Classify
  const bankSlug = format === "mercado-pago" ? MP_SLUG : "generic";
  const classified = classifyLines(normalized, bankSlug);
  const ignoredCount = classified.filter((l) => l.classification === "IGNORAR").length;

  return {
    sourceLabel: header.sourceLabel,
    lines: classified,
    ignoredCount,
    reconciliation,
    warnings,
  };
}

// ─── Convert pipeline output to ParsedTransaction[] ──────────────────────────
// Bridges the pipeline to the existing ParsedTransaction type expected by
// the rest of the app. IGNORAR lines are excluded.

import type { ParsedTransaction } from "../parsers";
import { categorizeTransaction } from "../parsers";
import { centsToFloat } from "./normalize";

export function pipelineResultToTransactions(
  result: PipelineResult,
  sourceLabel?: string,
): ParsedTransaction[] {
  const label = sourceLabel ?? result.sourceLabel;

  return result.lines
    .filter((l) => l.classification !== "IGNORAR")
    .map((l): ParsedTransaction => {
      const type = l.classification === "ENTRADA" ? "income" : "expense";
      const amount = centsToFloat(l.valueCents); // always positive
      const desc = l.description;
      return {
        type,
        description: desc,
        amount,
        date: l.date,
        monthKey: l.date.slice(0, 7),
        category: categorizeTransaction(desc, type),
        dedupKey: `${l.date}|${desc.toLowerCase()}|${amount.toFixed(2)}`,
        sourceLabel: label,
        source: /cartão|fatura|card/i.test(label) ? "card" : "account",
      };
    });
}
