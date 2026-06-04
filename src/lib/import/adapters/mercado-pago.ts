// ─── Mercado Pago adapter ─────────────────────────────────────────────────────
//
// Parses the text extracted from a Mercado Pago account statement PDF.
//
// Document structure (5-column table, multi-page):
//   Data | Descrição | ID da operação | Valor | Saldo
//
// After PDF text extraction, each transaction appears as a block:
//
//   DD/MM/YYYY
//   [description line(s) — may span across page boundaries]
//   [ID — run of ≥12 digits on its own line, immediately before Valor]
//   R$ [-]X.XXX,XX    ← Valor (signed: negative = outflow)
//   R$ X.XXX,XX       ← Saldo (always positive running balance)
//
// CRITICAL BUGS this adapter fixes:
//   1. The previous flow (Cloud Function) would pick the Saldo as the amount
//      because it comes LAST and looks like the "main" value.
//      Fix: always take the FIRST of the two consecutive R$ lines.
//   2. Sign must come from the Valor line ("R$ -X" = saída), NOT from the
//      description text. A "Transferência enviada IFOOD R$ 18,75" is actually
//      POSITIVE if the Valor line says "R$ 18,75" (it's an income/refund).
//   3. CPFs/CNPJs in descriptions look like IDs.
//      Fix: anchor on "digits immediately before R$ line", not "first long number".
//
// Page noise removed:
//   - Column header lines (repeated per page)
//   - Page number lines ("N/25")
//   - Summary/resumo block at the top
//   - Legal footer text

import type { RawLine, BankHeader } from "../types";
import { parseBRCentavos } from "../normalize";

export const SLUG = "mercado-pago";

// ─── Detection ────────────────────────────────────────────────────────────────

// These strings reliably identify a Mercado Pago statement.
const DETECTION_TOKENS = [
  /mercado\s*pago/i,
  /conta\s+mercado\s+pago/i,
  /mp\s*conta/i,
];

export function isMercadoPago(text: string, filename = ""): boolean {
  const haystack = (text.slice(0, 2000) + " " + filename)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
  return DETECTION_TOKENS.some((p) => p.test(haystack));
}

// ─── Header extraction ────────────────────────────────────────────────────────

export function extractMPHeader(text: string): BankHeader {
  // "Saldo inicial R$ 25,04" or "saldo inicial: R$25,04"
  const initMatch = text.match(
    /saldo\s+inicial[:\s]*R?\$?\s*([\d.,]+)/i,
  );
  // "Saldo final R$ 16,81"
  const finalMatch = text.match(
    /saldo\s+final[:\s]*R?\$?\s*([\d.,]+)/i,
  );

  return {
    sourceLabel: "Mercado Pago",
    initialBalanceCents: initMatch
      ? parseBRCentavos(initMatch[1])
      : undefined,
    finalBalanceCents: finalMatch
      ? parseBRCentavos(finalMatch[1])
      : undefined,
  };
}

// ─── Record parsing ───────────────────────────────────────────────────────────
//
// Real pdfjs output lays out each transaction as a single "anchor line":
//   "DD-MM-YYYY [inline desc] [ID] R$ valor R$ saldo"
// Long PIX descriptions add lines BEFORE the anchor (they don't fit inline).
// The two trailing R$ are always [valor, saldo]; the ID is the trailing run of
// ≥12 digits in the inline middle (CPFs in descriptions sit further left, so the
// trailing-run anchor avoids mistaking them for the ID).
//
// KEEP IN SYNC with functions/src/index.ts (tryMercadoPagoDeterministic).

const MP_ANCHOR = /^(\d{2}-\d{2}-\d{4})\s+(.*?)\s+R\$\s*([-−]?[\d.]+,\d{2})\s+R\$\s*([-−]?[\d.]+,\d{2})\s*$/;
const MP_NOISE = /^(data\s+descri|detalhe dos|extrato de|saldo (inicial|final)|entradas:|saidas:|periodo|cpf\/cnpj|\d+\/\d+$)/i;
const MP_ID_TAIL = /(\d{12,})\s*$/;

export function parseMPText(rawText: string): { lines: RawLine[]; header: BankHeader } {
  const header = extractMPHeader(rawText);
  const rawLines = rawText.split("\n").map((l) => l.trim());

  const records: RawLine[] = [];
  let descBuf: string[] = [];

  for (const line of rawLines) {
    if (!line) continue;

    const m = line.match(MP_ANCHOR);
    if (!m) {
      // Non-anchor line: a candidate description line, unless it's document
      // chrome (header, column titles, summary). Keep only the most recent few
      // so leftover header lines never bleed into the first transaction.
      const norm = line.normalize("NFD").replace(/[̀-ͯ]/g, "");
      if (!MP_NOISE.test(norm)) {
        descBuf.push(line);
        if (descBuf.length > 4) descBuf.shift();
      } else {
        descBuf = [];
      }
      continue;
    }

    const [, date, middle, valor, saldo] = m;

    // Split the operation ID (trailing 12+ digits) from the inline description.
    let inlineDesc = middle;
    let id: string | undefined;
    const idm = middle.match(MP_ID_TAIL);
    if (idm) { id = idm[1]; inlineDesc = middle.slice(0, idm.index).trim(); }

    // Description = buffered lines (they precede the anchor) + inline remainder.
    const description = [...descBuf, inlineDesc].join(" ").replace(/\s{2,}/g, " ").trim();

    records.push({ date, description, valorRaw: `R$ ${valor}`, saldoRaw: `R$ ${saldo}`, id });
    descBuf = [];
  }

  return { lines: records, header };
}
