export type ParsedTransaction = {
  type: "income" | "expense";
  description: string;
  amount: number;
  date: string;
  monthKey: string;
  category: string;
  dedupKey: string;
  sourceLabel?: string;
  source?: "account" | "card";
  internal?: boolean;
};

// ─── 19 categorias fixas ─────────────────────────────────────────────────────

export const CATEGORIES = [
  "Alimentacao",
  "Mercado",
  "Transporte",
  "Carro",
  "CartaoCredito",
  "Assinaturas",
  "Saude",
  "Varejo",
  "Educacao",
  "Moradia",
  "Contas",
  "Seguros",
  "Taxas",
  "Emprestimos",
  "Doacoes",
  "Transferencias",
  "Hospedagem",
  "Viagem",
  "Lazer",
  "Recebimentos",
  "Outros"
] as const;

export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABELS: Record<Category, string> = {
  Alimentacao:    "Alimentação",
  Mercado:        "Mercado",
  Transporte:     "Transporte",
  Carro:          "Carro",
  CartaoCredito:  "Cartão de Crédito",
  Assinaturas:    "Assinaturas",
  Saude:          "Saúde",
  Varejo:         "Varejo",
  Educacao:       "Educação",
  Moradia:        "Moradia",
  Contas:         "Contas",
  Seguros:        "Seguros",
  Taxas:          "Taxas",
  Emprestimos:    "Empréstimos",
  Doacoes:        "Doações",
  Transferencias: "Transferências",
  Hospedagem:     "Hospedagem",
  Viagem:         "Viagem",
  Lazer:          "Lazer",
  Recebimentos:   "Recebimentos",
  Outros:         "Outros"
};

export { CATEGORY_COLORS } from "@/lib/categories";

// ─── Categorização + movimento interno (fonte da verdade compartilhada) ───────
// O keyword-map, o categorizador e isInternalTransfer VIVEM em src/lib/shared/ —
// cliente e servidor usam a MESMA definição. Aqui só re-exportamos pra API deste
// módulo seguir igual (home/page.tsx importa daqui).
import { categorizeTransaction, guessCategory } from "./shared/categorize-keyword";
import { isInternalTransfer } from "./shared/internal-transfer";
export { categorizeTransaction, guessCategory, isInternalTransfer };

// ─── Parsers de arquivo ───────────────────────────────────────────────────────

function parseDate(raw: string): string | null {
  const d8 = raw.match(/^(\d{4})(\d{2})(\d{2})/);
  if (d8) return `${d8[1]}-${d8[2]}-${d8[3]}`;
  const dmy = raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  return null;
}

function monthKeyFromDate(date: string): string {
  return date.slice(0, 7);
}

function makeDedupKey(date: string, description: string, amount: number): string {
  return `${date}|${description.toLowerCase().trim()}|${Math.abs(amount).toFixed(2)}`;
}

function parseBRNumber(raw: string): number {
  const negative = raw.trim().startsWith("-");
  // Strip tudo que não é dígito, ponto ou vírgula (lida com "R$Â ", NBSP, etc.)
  const digits = raw.replace(/[^0-9,.]/g, "");
  if (!digits) return NaN;
  const num = /^[\d.]+,\d{1,2}$/.test(digits)
    ? parseFloat(digits.replace(/\./g, "").replace(",", "."))
    : parseFloat(digits.replace(",", "."));
  return negative ? -num : num;
}

export function detectCardSuffix(text: string): string | null {
  const m = text.match(
    /(?:[•·*.]{2,4}[\s-]?(\d{4}))|(?:final[\s:]+(\d{4}))|(?:terminad[ao]\s+em\s+(\d{4}))/i
  );
  return m ? (m[1] || m[2] || m[3]) : null;
}

const COMPE_BANKS: Record<string, string> = {
  "001": "Banco do Brasil", "033": "Santander",     "041": "Banrisul",
  "070": "BRB",             "077": "Inter",          "104": "Caixa",
  "208": "BTG Pactual",     "212": "Banco Original", "237": "Bradesco",
  "260": "Nubank",          "290": "PagBank",        "323": "Mercado Pago",
  "336": "C6 Bank",         "341": "Itaú",           "380": "PicPay",
  "422": "Safra",           "637": "Sofisa",         "655": "Votorantim",
  "735": "Neon",            "748": "Sicredi",        "756": "Sicoob",
};

const ISPB_BANKS: Record<string, string> = {
  "00000000": "Banco do Brasil", "00360305": "Caixa",
  "00416968": "Inter",           "18236120": "Nubank",
  "31872495": "C6 Bank",         "60701190": "Itaú",
  "60746948": "Bradesco",        "90400888": "Santander",
  "22896431": "PicPay",          "10573521": "Mercado Pago",
};

const LABEL_ALIASES: [RegExp, string][] = [
  [/^nu\b/i, "Nubank"],   [/^nub\b/i, "Nubank"],
  [/^bb\b/i, "Banco do Brasil"], [/^cef\b/i, "Caixa"],
  [/^pag\b/i, "PagBank"],
];

export function normalizeSourceLabel(label: string): string {
  let s = label
    .replace(/\b\d{2}[A-ZÁÉÍÓÚÇ]{3}\d{4}\b/gi, "")
    .replace(/\b\d{8}\b/g, "")
    .replace(/\b\d{4}-\d{2}-\d{2}\b/g, "")
    .replace(/\b(extrato|fatura|statement|export|download)\b/gi, "")
    .replace(/[•·*]{2,4}/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  for (const [pattern, name] of LABEL_ALIASES) {
    if (pattern.test(s)) { s = s.replace(pattern, name).trim(); break; }
  }

  const suffixMatch = label.match(/[•·*]{2,}\s*(\d{4})/);
  if (suffixMatch) {
    s = s.replace(/\b\d{4}\b/, "").replace(/\s{2,}/g, " ").trim();
    if (!/^Cartão/i.test(s)) s = `Cartão ${s}`;
    s = `${s} ${suffixMatch[1]}`.trim();
  }

  return s || "Importação";
}

export function sourceLabelFromFilename(filename: string): string {
  const base = filename.replace(/\.[^.]+$/, "").replace(/[-_]/g, " ").trim();
  const lower = base.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

  if (lower.includes("nubank"))    return "Nubank";
  if (lower.includes("picpay"))    return "PicPay";
  if (lower.includes("afinz"))     return "Afinz";
  if (lower.includes("inter"))     return "Inter";
  if (lower.includes("itau"))      return "Itaú";
  if (lower.includes("bradesco"))  return "Bradesco";
  if (lower.includes("santander")) return "Santander";
  if (lower.includes("caixa"))     return "Caixa";
  if (lower.includes("bb") || lower.includes("banco do brasil")) return "Banco do Brasil";
  if (lower.includes("c6"))        return "C6 Bank";
  if (/\bxp\b/.test(lower))        return "XP";
  if (lower.includes("noh"))       return "Noh";

  return normalizeSourceLabel(base) || "Importação";
}

// Split de uma linha CSV que RESPEITA aspas (RFC 4180). Sem isso, um campo citado
// que contém o próprio delimitador — ex.: o Valor BR `"R$ 17.995,78"` num arquivo
// separado por vírgula — é partido no meio ("R$ 17.995" | "78"), e o valor chega
// mutilado no parseBRNumber (17.995 em vez de 17995,78). Aspas duplas escapadas ("")
// viram uma aspa literal. Preserva sinal e NBSP dentro do campo.
function splitCsvLine(line: string, delimiter: string): string[] {
  const out: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { field += '"'; i++; } // "" escapado
      else inQuotes = !inQuotes;
    } else if (ch === delimiter && !inQuotes) {
      out.push(field);
      field = "";
    } else {
      field += ch;
    }
  }
  out.push(field);
  // trim + tira aspas simples residuais (as duplas já foram consumidas pelo parser).
  return out.map((c) => c.trim().replace(/^'|'$/g, ""));
}

export function parseCSV(text: string, filename = ""): ParsedTransaction[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];

  const delimiter = lines[0].includes(";") ? ";" : ",";
  const rows = lines.map((l) => splitCsvLine(l, delimiter));

  const norm = (s: string) =>
    s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
  const header = rows[0].map(norm);

  const dateCol = header.findIndex((h) =>
    h === "data" || h === "date" ||
    h.includes("data lan") || h.includes("data mov") ||
    h.includes("data transac") || h.includes("data pagto") ||
    h.includes("data compra") || h.includes("data vencto")
  );
  // Aceita também headers com encoding quebrado (ex: "DescriÃ§Ã£o" da NOH)
  const descCol = header.findIndex((h) =>
    h.includes("historico") || h.includes("descricao") || h.includes("descri") ||
    h.includes("lancamento") || h.includes("detalhes") ||
    h.includes("estabelecimento") || h.includes("titulo") ||
    h === "description" || h === "memo" || h === "nome"
  );
  // Coluna de tipo textual: "Entrada" / "Saída" (NOH, outros)
  const tipoCol = header.findIndex((h) => h === "tipo" || h === "type" || h === "natureza");

  // Coluna única de valor (Nubank, Inter, etc.)
  const valueCol = header.findIndex((h) =>
    h === "valor" || h === "value" || h === "amount" || h.includes("quantia")
  );

  // Colunas separadas de crédito e débito (Itaú, Bradesco, Santander, etc.)
  const creditCol = header.findIndex((h) =>
    (h.includes("credito") || h.includes("entrada") || h.includes("credit")) &&
    !h.includes("debito")
  );
  const debitCol = header.findIndex((h) =>
    (h.includes("debito") || h.includes("saida") || h.includes("debit")) &&
    !h.includes("credito")
  );
  const hasSeparateCols = creditCol !== -1 && debitCol !== -1;

  if (dateCol === -1) throw new Error(`Coluna de data não encontrada. Colunas detectadas: ${rows[0].join(", ")}`);
  if (valueCol === -1 && !hasSeparateCols) throw new Error(`Coluna de valor não encontrada. Colunas detectadas: ${rows[0].join(", ")}`);

  const result: ParsedTransaction[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row.length < 2) continue;

    const rawDate = (row[dateCol] || "").trim();
    const rawDesc = descCol >= 0 ? (row[descCol] || "").trim() : "Sem descricao";
    const date = parseDate(rawDate);
    if (!date) continue;

    let amount: number;
    let type: "income" | "expense";

    if (hasSeparateCols) {
      const credit = parseBRNumber((row[creditCol] || "").trim());
      const debit = parseBRNumber((row[debitCol] || "").trim());
      if (!isNaN(credit) && credit > 0) {
        amount = credit;
        type = "income";
      } else if (!isNaN(debit) && debit > 0) {
        amount = debit;
        type = "expense";
      } else {
        continue;
      }
    } else {
      const rawValue = (row[valueCol] || "").trim();
      amount = parseBRNumber(rawValue);
      if (isNaN(amount) || amount === 0) continue;
      if (tipoCol >= 0 && amount > 0) {
        // Usa coluna "Tipo" para desambiguar quando valor é sempre positivo
        const rawTipo = (row[tipoCol] || "").toLowerCase();
        type = rawTipo.includes("sa") ? "expense" : "income"; // "saída"/"saida"
      } else {
        type = amount < 0 ? "expense" : "income";
      }
      amount = Math.abs(amount);
    }

    result.push({
      type,
      description: rawDesc,
      amount,
      date,
      monthKey: monthKeyFromDate(date),
      category: categorizeTransaction(rawDesc, type),
      dedupKey: makeDedupKey(date, rawDesc, amount),
      sourceLabel: sourceLabelFromFilename(filename),
      // Movimento interno: real no ledger, mas neutro no score (igual ao servidor).
      ...(isInternalTransfer(rawDesc) ? { internal: true } : {})
    });
  }

  return result;
}

export function parseOFX(text: string, filename = ""): ParsedTransaction[] {
  const result: ParsedTransaction[] = [];

  // Resolve banco a partir de FID (COMPE = 3 dígitos, ISPB = 8 dígitos) ou ORG
  const fidMatch  = text.match(/<FID>\s*(\d+)/i);
  const orgMatch  = text.match(/<ORG>\s*([^<\n\r]+)/i);
  const acctMatch = text.match(/<ACCTTYPE>\s*([^<\n\r]+)/i);

  let bankFromFid: string | null = null;
  if (fidMatch) {
    const fid = fidMatch[1].trim();
    bankFromFid = fid.length === 8
      ? (ISPB_BANKS[fid] ?? null)
      : (COMPE_BANKS[fid.padStart(3, "0")] ?? null);
  }
  const bankFromOrg = orgMatch ? orgMatch[1].trim() : null;
  const bankName    = bankFromFid ?? bankFromOrg ?? null;
  const isCredit    = /credit/i.test(acctMatch?.[1] ?? "");
  const cardSuffix  = detectCardSuffix(text);

  let ofxSourceLabel: string;
  if (bankName) {
    ofxSourceLabel = isCredit
      ? (cardSuffix ? `Cartão ${bankName} ${cardSuffix}` : `Cartão ${bankName}`)
      : bankName;
  } else {
    ofxSourceLabel = sourceLabelFromFilename(filename);
  }

  const extractField = (block: string, tag: string): string =>
    block.match(new RegExp(`<${tag}>([^<\n\r]+)`, "i"))?.[1]?.trim() ?? "";

  const xmlBlocks = text.match(/<STMTTRN>[\s\S]*?<\/STMTTRN>/gi) ?? [];
  if (xmlBlocks.length > 0) {
    for (const block of xmlBlocks) {
      const dtposted = extractField(block, "DTPOSTED");
      const trnamt = extractField(block, "TRNAMT");
      const memo = extractField(block, "MEMO");
      const name = extractField(block, "NAME");

      const date = parseDate(dtposted);
      if (!date) continue;
      const amount = parseFloat(trnamt);
      if (isNaN(amount)) continue;

      const description = memo || name || "Transacao";
      const type = amount < 0 ? "expense" : "income";
      result.push({
        type,
        description,
        amount: Math.abs(amount),
        date,
        monthKey: monthKeyFromDate(date),
        category: categorizeTransaction(description, type),
        dedupKey: makeDedupKey(date, description, amount),
        sourceLabel: ofxSourceLabel,
        ...(isInternalTransfer(description) ? { internal: true } : {})
      });
    }
    return result;
  }

  const sgmlParts = text.split(/\n?<STMTTRN>/i).slice(1);
  for (const block of sgmlParts) {
    const dtposted = block.match(/DTPOSTED>([\d.T:+\-\[\]]+)/i)?.[1]?.trim() ?? "";
    const trnamt = block.match(/TRNAMT>([-\d.]+)/i)?.[1]?.trim() ?? "";
    const memo = block.match(/MEMO>([^\n\r<]+)/i)?.[1]?.trim() ?? "";
    const name = block.match(/NAME>([^\n\r<]+)/i)?.[1]?.trim() ?? "";

    const date = parseDate(dtposted);
    if (!date) continue;
    const amount = parseFloat(trnamt);
    if (isNaN(amount)) continue;

    const description = memo || name || "Transacao";
    const type = amount < 0 ? "expense" : "income";
    result.push({
      type,
      description,
      amount: Math.abs(amount),
      date,
      monthKey: monthKeyFromDate(date),
      category: categorizeTransaction(description, type),
      dedupKey: makeDedupKey(date, description, amount),
      sourceLabel: ofxSourceLabel,
      ...(isInternalTransfer(description) ? { internal: true } : {})
    });
  }

  return result;
}

export async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1] ?? result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
