// ─── Pure import-core (no firebase-functions / firebase-admin deps) ──────────
//
// Extraction, the deterministic Mercado Pago adapter, the reconciliation gate,
// and classification — the parts that must behave IDENTICALLY in production and
// in the local validator. Because this module has zero Cloud Functions side
// effects, the validator can import the COMPILED version and run the exact same
// code processImportJob runs. No re-implementation, no drift.

export type ParsedClaudeResponse = {
  sourceLabel?: string;
  initialBalance?: number;
  finalBalance?: number;
  transactions?: Array<{
    date: string;
    description: string;
    amount: number;           // always positive
    type: "income" | "expense";
    category?: string;
    classification?: "ENTRADA" | "SAIDA" | "IGNORAR";
    balance?: number;         // running balance after this tx (from Saldo column)
  }>;
};

// ─── Server-side PDF text extraction (pdfjs in Node, no worker) ──────────────
// pdfjs-dist v5 ships ESM only. The runtime dynamic import below is wrapped in
// new Function so TypeScript (module: commonjs) doesn't down-level it to
// require(), which would fail on the ESM-only module.
const importEsm = new Function("s", "return import(s)") as (s: string) => Promise<{
  getDocument: (opts: unknown) => { promise: Promise<PdfDoc> };
}>;
type PdfDoc = {
  numPages: number;
  getPage: (n: number) => Promise<{
    getTextContent: () => Promise<{ items: Array<{ str?: string; transform?: number[] }> }>;
  }>;
};

export async function extractPdfTextServer(buffer: Buffer): Promise<string> {
  const pdfjs = await importEsm("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(buffer),
    useSystemFonts: true,
    isEvalSupported: false,
  }).promise;

  const pageTexts: string[] = [];
  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    const page = await doc.getPage(pageNum);
    const content = await page.getTextContent();
    const rowMap = new Map<number, Array<{ x: number; text: string }>>();
    for (const item of content.items) {
      if (!item.str || !item.str.trim() || !item.transform) continue;
      const y = Math.round(item.transform[5]);
      const x = item.transform[4];
      if (!rowMap.has(y)) rowMap.set(y, []);
      rowMap.get(y)!.push({ x, text: item.str });
    }
    const rows = [...rowMap.entries()]
      .sort((a, b) => b[0] - a[0])
      .map(([, items]) =>
        items.sort((a, b) => a.x - b.x).map((i) => i.text).join("  ").trim()
      )
      .filter(Boolean);
    pageTexts.push(rows.join("\n"));
  }
  return pageTexts.join("\n");
}

// ─── Deterministic Mercado Pago adapter (zero API cost) ──────────────────────
// KEEP IN SYNC with src/lib/import/adapters/mercado-pago.ts (anchor-line format).

export function parseBRCentavosSrv(raw: string): number {
  let s = raw.replace(/\s/g, "").replace(/R\$/gi, "").trim();
  const neg = s.startsWith("-") || s.startsWith("−");
  s = s.replace(/^[-−+]/, "").trim();
  const br = s.match(/^([\d.]+),(\d{1,2})$/);
  if (br) {
    const cents = parseInt(br[1].replace(/\./g, ""), 10) * 100 + parseInt(br[2].padEnd(2, "0"), 10);
    return neg ? -cents : cents;
  }
  return 0;
}

export function parseBRDateSrv(raw: string): string | null {
  const f = raw.trim().match(/^(\d{1,2})[/\-](\d{1,2})[/\-](\d{2,4})$/);
  if (!f) return null;
  const y = f[3].length === 2 ? 2000 + parseInt(f[3], 10) : parseInt(f[3], 10);
  return `${y}-${f[2].padStart(2, "0")}-${f[1].padStart(2, "0")}`;
}

const MP_DETECT = /mercado\s*pago|mp\s*conta/i;
const MP_ANCHOR = /^(\d{2}-\d{2}-\d{4})\s+(.*?)\s+R\$\s*([-−]?[\d.]+,\d{2})\s+R\$\s*([-−]?[\d.]+,\d{2})\s*$/;
// Page-break chrome (column header repeated atop each page, page numbers like
// "12/25"): SKIP without resetting the description buffer — a transaction's
// description can straddle a page break, with its anchor line landing on the
// next page after this chrome. Resetting here was dropping those descriptions.
const MP_NOISE_SKIP = /^(data\s+descri|\d+\/\d+\s*$)/i;
// Document-header chrome (holder name area, CPF, period, totals, section title):
// RESET the buffer so none of it bleeds into the first transaction's description.
const MP_NOISE_RESET = /^(detalhe dos|extrato de|saldo\s+(inicial|final)|entradas:|saidas:|periodo|cpf\/cnpj)/i;
const MP_ID_TAIL = /(\d{12,})\s*$/;

export function isMercadoPagoSrv(text: string): boolean {
  return MP_DETECT.test(text.slice(0, 2000).normalize("NFD").replace(/[̀-ͯ]/g, ""));
}

export function tryMercadoPagoDeterministic(rawText: string): ParsedClaudeResponse | null {
  // Detect by CONTENT (the anchor-line pattern + header balances), NOT by a
  // "Mercado Pago" string: the statement header opens with "EXTRATO DE CONTA" and
  // the holder's name and often doesn't mention the bank in the first lines, so a
  // string check misses it (this was the production bug — fell back to Claude).
  // The anchor format (DD-MM-YYYY … ID R$valor R$saldo) plus header balances is
  // specific enough; the reconciliation gate downstream rejects any false
  // positive, so a wrong guess can never surface bad data — it just goes to Claude.
  const initM = rawText.match(/saldo\s+inicial[:\s]*R?\$?\s*([\d.,]+)/i);
  const finM = rawText.match(/saldo\s+final[:\s]*R?\$?\s*([\d.,]+)/i);
  const initialBalance = initM ? parseBRCentavosSrv(initM[1]) / 100 : undefined;
  const finalBalance = finM ? parseBRCentavosSrv(finM[1]) / 100 : undefined;

  const lines = rawText.split("\n").map((l) => l.trim());
  const transactions: NonNullable<ParsedClaudeResponse["transactions"]> = [];
  let descBuf: string[] = [];

  for (const line of lines) {
    if (!line) continue;
    const m = line.match(MP_ANCHOR);
    if (!m) {
      const norm = line.normalize("NFD").replace(/[̀-ͯ]/g, "");
      if (MP_NOISE_SKIP.test(norm)) {
        // page-break chrome — ignore but keep the buffered description
      } else if (MP_NOISE_RESET.test(norm)) {
        descBuf = [];
      } else {
        descBuf.push(line);
        if (descBuf.length > 4) descBuf.shift();
      }
      continue;
    }
    const [, dateRaw, middle, valorRaw, saldoRaw] = m;
    const date = parseBRDateSrv(dateRaw);
    if (!date) { descBuf = []; continue; }

    let inlineDesc = middle;
    const idm = middle.match(MP_ID_TAIL);
    if (idm) inlineDesc = middle.slice(0, idm.index).trim();
    let description = [...descBuf, inlineDesc].join(" ").replace(/\s{2,}/g, " ").trim();

    // Conserto 1 — never emit an empty description: a tx the gate's filter would
    // drop (and thus break the chain, contradicting the adapter's own reconcile).
    // Fall back to the operation ID so the row survives the filter and the adapter
    // and gate reconcile the EXACT same set.
    if (!description) description = idm ? `Mercado Pago ${idm[1]}` : "Mercado Pago";

    const valueCents = parseBRCentavosSrv(valorRaw);
    const balanceCents = parseBRCentavosSrv(saldoRaw);
    transactions.push({
      date,
      description,
      amount: Math.abs(valueCents) / 100,
      type: valueCents >= 0 ? "income" : "expense",
      balance: balanceCents / 100,
    });
    descBuf = [];
  }

  // Recognized only with enough anchor-format rows AND the header balances the
  // gate needs. Otherwise → let Claude handle it.
  if (transactions.length < 3 || initialBalance === undefined || finalBalance === undefined) {
    return null;
  }

  return { sourceLabel: "Mercado Pago", initialBalance, finalBalance, transactions };
}

// ─── Reconciliation gate ──────────────────────────────────────────────────────
// Passes ONLY when it actually validated completeness (txs present, final
// balance known, chain/sum closes at final). Anything it can't validate → ok:false.
export function reconcileServer(
  txs: Array<{ signedCents: number; balanceCents?: number }>,
  initialBalanceCents?: number,
  finalBalanceCents?: number,
  toleranceCents = 2
): { ok: boolean; validated: boolean; suspectIndices: number[]; reason?: string } {
  if (txs.length === 0)
    return { ok: false, validated: false, suspectIndices: [], reason: "nenhuma transação extraída" };

  if (finalBalanceCents === undefined)
    return { ok: false, validated: false, suspectIndices: [], reason: "saldo final não encontrado no documento" };

  const hasBalance = txs.some((t) => t.balanceCents !== undefined);

  if (!hasBalance) {
    if (initialBalanceCents === undefined)
      return { ok: false, validated: false, suspectIndices: [], reason: "saldo inicial não encontrado" };
    const sumCents = txs.reduce((s, t) => s + t.signedCents, 0);
    const ok = Math.abs(sumCents - (finalBalanceCents - initialBalanceCents)) <= toleranceCents;
    return { ok, validated: true, suspectIndices: ok ? [] : [-1], reason: ok ? undefined : "soma dos valores não bate com os saldos" };
  }

  const inferredInitial =
    txs[0].balanceCents !== undefined ? txs[0].balanceCents - txs[0].signedCents : undefined;
  const initial = initialBalanceCents ?? inferredInitial;
  if (initial === undefined)
    return { ok: false, validated: false, suspectIndices: [], reason: "saldo inicial não encontrado" };

  let running = initial;
  const suspectIndices: number[] = [];
  for (let i = 0; i < txs.length; i++) {
    running += txs[i].signedCents;
    const bc = txs[i].balanceCents;
    if (bc !== undefined && Math.abs(running - bc) > toleranceCents) {
      suspectIndices.push(i);
      running = bc;
    }
  }

  const finalOk = Math.abs(running - finalBalanceCents) <= toleranceCents;
  const ok = suspectIndices.length === 0 && finalOk;
  return { ok, validated: true, suspectIndices, reason: ok ? undefined : "cadeia de saldo não fecha no saldo final" };
}

export function reconcileParsed(parsed: ParsedClaudeResponse): { ok: boolean; validated: boolean; suspectIndices: number[]; reason?: string } {
  const txs = (parsed.transactions ?? []).map((t) => ({
    signedCents: Math.round((t.type === "income" ? t.amount : -t.amount) * 100),
    balanceCents: t.balance != null ? Math.round(t.balance * 100) : undefined,
  }));
  const initC = parsed.initialBalance != null ? Math.round(parsed.initialBalance * 100) : undefined;
  const finC = parsed.finalBalance != null ? Math.round(parsed.finalBalance * 100) : undefined;
  return reconcileServer(txs, initC, finC);
}

// ─── Server-side classification ───────────────────────────────────────────────
// KEEP IN SYNC with src/lib/import/classify.ts
const MP_IGNORE_PATTERNS = [
  /dinheiro\s+reservado/i,
  /dinheiro\s+retirado/i,
  /^reembolso\b/i,
  /^estorno\b/i,
];

export function classifyServer(
  description: string,
  signedCents: number,
  bankSlug: string,
  claudeClassification?: "ENTRADA" | "SAIDA" | "IGNORAR"
): "ENTRADA" | "SAIDA" | "IGNORAR" {
  if (signedCents === 0) return "IGNORAR";

  const norm = description.normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

  if (bankSlug === "mercado-pago" && MP_IGNORE_PATTERNS.some((p) => p.test(norm))) {
    return "IGNORAR";
  }

  if (claudeClassification === "IGNORAR") return "IGNORAR";

  return signedCents > 0 ? "ENTRADA" : "SAIDA";
}
