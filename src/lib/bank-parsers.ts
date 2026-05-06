import type { ParsedTransaction } from "./parsers";
import { categorizeTransaction } from "./parsers";

// ─── Date / value utilities ────────────────────────────────────────────────────

const PT_MONTHS: Record<string, string> = {
  jan: "01", fev: "02", mar: "03", abr: "04", mai: "05", jun: "06",
  jul: "07", ago: "08", set: "09", out: "10", nov: "11", dez: "12"
};

export function parsePTDate(str: string, refYear?: number): string | null {
  const s = str.trim();
  const yr = refYear ?? new Date().getFullYear();

  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  const dmy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;

  const dm = s.match(/^(\d{1,2})[\/\-](\d{1,2})$/);
  if (dm) return `${yr}-${dm[2].padStart(2, "0")}-${dm[1].padStart(2, "0")}`;

  const dpt = s.match(/^(\d{1,2})\s+([a-zA-ZÀ-ÿ]{3,4})(?:\s+(\d{4}))?$/);
  if (dpt) {
    const mo = PT_MONTHS[dpt[2].toLowerCase().slice(0, 3)];
    if (!mo) return null;
    const y = dpt[3] ? parseInt(dpt[3]) : yr;
    return `${y}-${mo}-${dpt[1].padStart(2, "0")}`;
  }

  return null;
}

export function parseBRValue(str: string): number {
  const s = str.trim().replace(/^R?\$\s*/, "").replace(/\s/g, "");
  if (!s) return NaN;

  // BR: 1.234,56
  if (/^-?[\d.]+,\d{1,2}$/.test(s))
    return parseFloat(s.replace(/\./g, "").replace(",", "."));

  // US: 1,234.56
  if (/^-?[\d,]+\.\d{1,2}$/.test(s))
    return parseFloat(s.replace(/,/g, ""));

  return parseFloat(s.replace(",", "."));
}

// ─── Stop-line filter ─────────────────────────────────────────────────────────

const STOP_PATTERNS = [
  // Saldos e carry-overs (não são transações reais)
  /saldo\s*(anterior|atual|disponiv|total|restante|em\s*atraso|em\s*aberto)/i,
  /saldo\s+restante/i,
  /saldo\s+em\s+(atraso|aberto)/i,
  /fatura\s+anterior/i,
  /saldo\s+anterior/i,
  // Pagamentos do cartão (entradas contábeis da fatura, não renda real)
  /pagamento\s*(efetuado|realizado|recebido|de\s*fatura)/i,
  /^pagamento\s+em\s+\d/i,
  // Créditos e estornos contábeis da fatura
  /^credito\s+de\s+atraso/i,
  /^encerramento\s+de\s+(divida|conta)/i,
  // Totais e meta-linhas
  /total\s*(de\s*)?(saidas|entradas|transacoes|compras|cartoes)/i,
  /total\s+a\s+pagar/i,
  /pagamento\s+minimo/i,
  /limite\s*(disponiv|de\s*cred)/i,
  /proxima\s*fatura/i,
  /fechamento\s*da\s*proxima/i,
  /^encargos/i,
  /^vencimento/i,
  /^\s*\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}\s*$/,
];

function isStop(line: string): boolean {
  const n = line.normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
  return STOP_PATTERNS.some((p) => p.test(n));
}

// Exportada para filtrar output do Claude com as mesmas regras
export function isStopDescription(desc: string): boolean {
  return isStop(desc);
}

// ─── Result builder ───────────────────────────────────────────────────────────

function tx(
  date: string,
  description: string,
  amount: number,
  type: "income" | "expense"
): ParsedTransaction {
  const desc = description.trim();
  const abs = Math.abs(amount);
  return {
    type,
    description: desc,
    amount: abs,
    date,
    monthKey: date.slice(0, 7),
    category: categorizeTransaction(desc, type),
    dedupKey: `${date}|${desc.toLowerCase()}|${abs.toFixed(2)}`
  };
}

// ─── Bank detection ────────────────────────────────────────────────────────────

export function detectBank(
  text: string,
  filename: string
): "nubank" | "picpay" | "afinz" | "generic" {
  const t = (text + filename).toLowerCase();
  if (t.includes("nubank")) return "nubank";
  if (t.includes("picpay")) return "picpay";
  if (t.includes("afinz")) return "afinz";
  return "generic";
}

// ─── Nubank fatura ─────────────────────────────────────────────────────────────
// Each line: "03 JAN  Mercado Pão de Açúcar  150,00"

const FATURA_LINE = /^(\d{1,2}\s+[A-Za-zÀ-ÿ]{3,4})\s{2,}(.+?)\s{2,}([\d.]+,\d{2})\s*$/;
const FATURA_LINE_LOOSE = /^(\d{1,2}\s+[A-Za-zÀ-ÿ]{3,4})\s+(.+?)\s+([\d.]+,\d{2})\s*$/;

function parseNubankFatura(lines: string[], refYear?: number): ParsedTransaction[] {
  const out: ParsedTransaction[] = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || isStop(line)) continue;

    const m = line.match(FATURA_LINE) ?? line.match(FATURA_LINE_LOOSE);
    if (!m) continue;

    const date = parsePTDate(m[1], refYear);
    if (!date) continue;

    const amount = parseBRValue(m[3]);
    if (isNaN(amount) || amount === 0) continue;

    const desc = m[2].trim();
    if (isStop(desc)) continue;
    out.push(tx(date, desc, amount, "expense"));
  }
  return out;
}

// ─── Nubank extrato (current account) ─────────────────────────────────────────
// Multi-line blocks: description, optional sub-description, amount, date
// Then the date appears at end of block.

const INCOME_RE = /pix\s+recebido|transferencia\s+recebida|estorno|devolucao|salario|deposito|reembolso|rendimento/i;
const EXPENSE_RE = /pix\s+enviado|transferencia\s+enviada|pagamento|compra\s+no|debito|saque|tarifa/i;
const VALUE_RE = /^R?\$?\s*([\d.]+,\d{2})$/;
const DATE_ONLY_RE = /^(\d{1,2}\s+[A-Za-zÀ-ÿ]{3,4}(?:\s+\d{4})?)$/;

function parseNubankExtrato(text: string, refYear?: number): ParsedTransaction[] {
  const out: ParsedTransaction[] = [];
  const lines = text.split(/\n/);
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].trim();

    // Skip empties and stop lines
    if (!line || isStop(line)) { i++; continue; }

    // Look for a value line within the next 4 lines
    const valueIdx = lines
      .slice(i + 1, i + 5)
      .findIndex((l) => VALUE_RE.test(l.trim()));

    if (valueIdx === -1) { i++; continue; }

    const absIdx = i + 1 + valueIdx;
    const amount = parseBRValue(lines[absIdx].trim().replace(VALUE_RE, "$1"));
    if (isNaN(amount) || amount === 0) { i++; continue; }

    // Collect description lines between current and value
    const descLines = lines
      .slice(i, absIdx)
      .map((l) => l.trim())
      .filter((l) => l && !isStop(l));

    if (!descLines.length) { i = absIdx + 1; continue; }

    // Look for date after the value line
    let date: string | null = null;
    if (absIdx + 1 < lines.length) {
      const nextLine = lines[absIdx + 1].trim();
      if (DATE_ONLY_RE.test(nextLine)) {
        date = parsePTDate(nextLine, refYear);
      }
    }

    // Also check if the first desc line starts with a date
    if (!date) {
      const firstDate = descLines[0].match(/^(\d{1,2}\s+[A-Za-zÀ-ÿ]{3,4}(?:\s+\d{4})?)\s+(.*)/);
      if (firstDate) {
        date = parsePTDate(firstDate[1], refYear);
        descLines[0] = firstDate[2];
      }
    }

    if (!date) { i = absIdx + 1; continue; }

    const desc = descLines.join(" ").trim();
    if (!desc || isStop(desc)) { i = absIdx + 1; continue; }

    const normDesc = desc.normalize("NFD").replace(/[̀-ͯ]/g, "");
    const type: "income" | "expense" = INCOME_RE.test(normDesc) ? "income" : "expense";

    out.push(tx(date, desc, amount, type));
    i = absIdx + 1;
  }

  return out;
}

// ─── Generic / PicPay / Afinz parser ──────────────────────────────────────────

const GENERIC_PATTERNS = [
  // DD/MM/YYYY  description  amount
  /^(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})\s{2,}(.+?)\s{2,}(-?[\d.,]+)\s*$/,
  // DD/MM  description  amount
  /^(\d{1,2}[\/\-]\d{1,2})\s{2,}(.+?)\s{2,}(-?[\d.,]+)\s*$/,
  // DD MMM  description  amount
  /^(\d{1,2}\s+[A-Za-zÀ-ÿ]{3,4})\s{2,}(.+?)\s{2,}([\d.]+,\d{2})\s*$/,
  // Loose: DD/MM/YYYY description amount
  /^(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})\s+(.+?)\s+(-?[\d.,]+)\s*$/,
  // Loose: DD MMM description amount
  /^(\d{1,2}\s+[A-Za-zÀ-ÿ]{3,4})\s+(.+?)\s+([\d.]+,\d{2})\s*$/,
];

function parseGeneric(
  lines: string[],
  bank: "picpay" | "afinz" | "generic",
  refYear?: number
): ParsedTransaction[] {
  const out: ParsedTransaction[] = [];

  for (const raw of lines) {
    const line = raw.trim();
    if (!line || isStop(line)) continue;

    for (const pat of GENERIC_PATTERNS) {
      const m = line.match(pat);
      if (!m) continue;

      const date = parsePTDate(m[1], refYear);
      if (!date) break;

      const amount = parseBRValue(m[3]);
      if (isNaN(amount) || amount === 0) break;

      const desc = m[2].trim();
      const normDesc = desc.normalize("NFD").replace(/[̀-ͯ]/g, "");

      let type: "income" | "expense";
      if (bank === "picpay") {
        type = INCOME_RE.test(normDesc) ? "income" : "expense";
      } else if (bank === "afinz") {
        // CREDITO (not loan-related) → income
        type =
          /credito/i.test(normDesc) && !/emprestimo|financiamento/i.test(normDesc)
            ? "income"
            : amount < 0
            ? "income"
            : "expense";
      } else {
        type = amount < 0 ? "income" : "expense";
      }

      out.push(tx(date, desc, Math.abs(amount), type));
      break;
    }
  }

  return out;
}

// ─── Main entry point ──────────────────────────────────────────────────────────

export interface ParseBankTextOptions {
  filename?: string;
  refYear?: number;
}

export interface ParseBankTextResult {
  transactions: ParsedTransaction[];
  sourceLabel: string;
}

// Extrai o ano do documento a partir de datas completas no cabeçalho da fatura
function detectDocumentYear(text: string): number | undefined {
  // "Vencimento: 10-12-2025", "Fechamento: 04/12/2025", "10/12/2025"
  const m =
    text.match(/(?:vencimento|fechamento|emiss[aã]o|compet[eê]ncia)[^\d\n]{0,20}\d{1,2}[-\/]\d{1,2}[-\/](20\d{2})/i) ??
    text.match(/\b\d{1,2}[-\/]\d{1,2}[-\/](20[2-9]\d)\b/);
  if (m) return parseInt(m[1]);
  return undefined;
}

// Extrai o último bloco de 4 dígitos de cartão mascarado ("•••• 3640", "**** 3640")
function detectCardSuffix(text: string): string | null {
  const m = text.match(/[•·\*\.]{2,4}\s*(\d{4})/);
  return m ? m[1] : null;
}

function buildSourceLabel(bank: string, text: string, filename: string, isFatura: boolean): string {
  const cardSuffix = detectCardSuffix(text);

  if (bank === "nubank") {
    if (isFatura) return cardSuffix ? `Nubank •••• ${cardSuffix}` : "Nubank Fatura";
    return "Nubank Conta";
  }
  if (bank === "picpay") return "PicPay";
  if (bank === "afinz") return cardSuffix ? `Afinz •••• ${cardSuffix}` : "Afinz";

  // Genérico: tenta extrair do filename
  const base = filename.replace(/\.[^.]+$/, "").replace(/[-_]/g, " ").trim();
  return base.slice(0, 32) || "Importação";
}

export function parseBankText(
  text: string,
  opts: ParseBankTextOptions = {}
): ParseBankTextResult {
  const { filename = "" } = opts;
  const refYear = opts.refYear ?? detectDocumentYear(text);
  const bank = detectBank(text, filename);
  const lines = text.split(/\n/);
  const isFatura = /fatura|cartao|cartão/i.test(text);

  let results: ParsedTransaction[];

  if (bank === "nubank") {
    if (isFatura) {
      results = parseNubankFatura(lines, refYear);
      if (results.length < 3) results = parseNubankExtrato(text, refYear);
    } else {
      results = parseNubankExtrato(text, refYear);
      if (results.length < 3) results = parseNubankFatura(lines, refYear);
    }
  } else {
    results = parseGeneric(lines, bank as "picpay" | "afinz" | "generic", refYear);
  }

  const sourceLabel = buildSourceLabel(bank, text, filename, isFatura);

  // Deduplica e injeta sourceLabel
  const seen = new Set<string>();
  const transactions = results
    .filter((r) => {
      if (seen.has(r.dedupKey)) return false;
      seen.add(r.dedupKey);
      return true;
    })
    .map((r) => ({ ...r, sourceLabel }));

  return { transactions, sourceLabel };
}
