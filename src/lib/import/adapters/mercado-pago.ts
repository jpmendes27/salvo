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

// ─── Noise removal ────────────────────────────────────────────────────────────

const NOISE_PATTERNS: RegExp[] = [
  // Column headers repeated on each page
  /^Data\s+Descri[cç][aã]o\s+ID\s+da\s+opera[cç][aã]o\s+Valor\s+Saldo\s*$/im,
  /^Data\s+Descri[cç][aã]o.*Valor\s+Saldo\s*$/im,
  // Page numbers "1/25", "25/25"
  /^\d{1,3}\/\d{1,3}\s*$/m,
  // Section headers like "Resumo", "Extrato de conta", "Movimentações"
  /^Resumo\s*$/im,
  /^Extrato\s+de\s+conta\s*$/im,
  /^Movimenta[cç][oõ]es\s*$/im,
  // Legal footer boilerplate
  /^Mercado\s+Pago\s+Institui[cç][aã]o\s+de\s+Pagamento/im,
  /^CNPJ[\s:]/im,
  // Horizontal rules made of dashes/underscores
  /^[-_]{5,}\s*$/m,
];

function cleanText(raw: string): string {
  let t = raw;
  for (const p of NOISE_PATTERNS) {
    t = t.replace(new RegExp(p.source, p.flags.includes("m") ? p.flags : p.flags + "m"), "");
  }
  // Collapse runs of blank lines into a single blank line
  t = t.replace(/\n{3,}/g, "\n\n");
  return t;
}

// ─── Record parsing ───────────────────────────────────────────────────────────

// Matches a date at the start of a line: DD/MM/YYYY
const DATE_RE = /^(\d{2}\/\d{2}\/\d{4})\s*$/;

// Matches an R$ value line, optionally signed:
//   "R$ 0,01"  "R$ -1.234,56"  "R$ 1.234.567,89"
const R_LINE_RE = /^R\$\s*([-−]?[\d.]+,\d{2})\s*$/;

// Matches a bare money amount without R$ prefix (fallback for some extractions)
const AMOUNT_ONLY_RE = /^[-−]?[\d.]+,\d{2}\s*$/;

// Matches an operation ID: run of ≥12 digits on its own line.
// Must NOT be immediately followed by another all-digit line (that would be
// a CPF/CNPJ embedded in a description, not the actual ID).
const ID_RE = /^\d{12,}\s*$/;

function isRLine(line: string): boolean {
  return R_LINE_RE.test(line) || AMOUNT_ONLY_RE.test(line);
}

function extractRValue(line: string): string {
  // Normalise to "R$ VALUE" so parseBRCentavos can handle it
  const m = line.match(R_LINE_RE);
  if (m) return `R$ ${m[1]}`;
  return `R$ ${line.trim()}`;
}

export function parseMPText(rawText: string): { lines: RawLine[]; header: BankHeader } {
  const header = extractMPHeader(rawText);
  const text = cleanText(rawText);
  const rawLines = text.split("\n").map((l) => l.trim());

  const records: RawLine[] = [];
  let i = 0;

  while (i < rawLines.length) {
    // Find start of next record: a line that is ONLY a DD/MM/YYYY date
    if (!DATE_RE.test(rawLines[i])) { i++; continue; }

    const date = rawLines[i].trim();
    i++;

    // Collect content lines until we find the Valor+Saldo pair
    const contentLines: string[] = [];
    let id: string | undefined;
    let valorRaw: string | undefined;
    let saldoRaw: string | undefined;

    while (i < rawLines.length) {
      const line = rawLines[i];

      // Empty line: skip but don't break (description can span blank lines
      // within a page-break region)
      if (!line) { i++; continue; }

      // New date line = start of next record: stop collecting for this record
      if (DATE_RE.test(line)) break;

      // Check for the Valor+Saldo pair:
      // Current line is R$ AND next non-empty line is also R$
      if (isRLine(line)) {
        // Peek at next non-empty line
        let j = i + 1;
        while (j < rawLines.length && !rawLines[j]) j++;

        if (j < rawLines.length && isRLine(rawLines[j])) {
          // Found Valor + Saldo
          valorRaw = extractRValue(line);
          saldoRaw = extractRValue(rawLines[j]);
          i = j + 1;
          break;
        }
      }

      // Check if this is the operation ID:
      // All digits (≥12), and the NEXT non-empty line is an R$ line.
      if (ID_RE.test(line)) {
        let j = i + 1;
        while (j < rawLines.length && !rawLines[j]) j++;
        if (j < rawLines.length && isRLine(rawLines[j])) {
          // Confirm it's an ID (not a CPF in description) by checking the
          // line AFTER the R$ is also R$ (the Saldo line)
          let k = j + 1;
          while (k < rawLines.length && !rawLines[k]) k++;
          if (k < rawLines.length && isRLine(rawLines[k])) {
            id = line.trim();
            i++;
            // Consume Valor + Saldo
            valorRaw = extractRValue(rawLines[j]);
            saldoRaw = extractRValue(rawLines[k]);
            i = k + 1;
            break;
          }
        }
      }

      contentLines.push(line);
      i++;
    }

    // Only emit a record if we successfully captured both Valor and Saldo
    if (!valorRaw || !saldoRaw) continue;

    // Description = all content lines joined, with whitespace collapsed.
    // IDs, R$ values, and CPFs that ended up here are left in for now —
    // the description normalizer will collapse whitespace but won't strip numbers.
    // (CPFs are a normal part of Pix descriptions, e.g. "João Silva 123.456.789-00".)
    const description = contentLines
      .filter((l) => l && !R_LINE_RE.test(l) && !AMOUNT_ONLY_RE.test(l))
      .join(" ")
      .replace(/\s{2,}/g, " ")
      .trim();

    records.push({ date, description, valorRaw, saldoRaw, id });
  }

  return { lines: records, header };
}
