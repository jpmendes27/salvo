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
  // Balance checkpoints declared by the document at a coarser granularity than
  // per-line (e.g. Itaú "SALDO DO DIA"). NEVER transactions — used only to
  // reconcile by day. Empty/absent when the bank shows per-line balance (MP).
  balanceCheckpoints?: Array<{ date: string; balance: number }>;
};

// ─── Credit-card statement (fatura) types ────────────────────────────────────

export type FaturaLancamento = {
  date: string;             // YYYY-MM-DD
  description: string;
  amount: number;           // always positive
  kind: "compra" | "pagamento" | "credito"; // purchase / payment / credit-refund
  parcela?: { atual: number; total: number };
};

export type ParsedFatura = {
  card: {
    bank: string;
    name?: string;
    last4?: string;
    limitTotal?: number;
    limitUsado?: number;
    limitDisponivel?: number;
    closingDay?: number;
    dueDay?: number;
  };
  period?: string;          // YYYY-MM of this statement
  vencimento?: string;      // YYYY-MM-DD
  totals: {
    saldoAnterior?: number;
    totalDespesas?: number;
    totalPagamentos?: number;
    totalCreditos?: number;
    totalAPagar?: number;   // saldo desta fatura
  };
  historico?: Array<{ period: string; total: number }>;
  lancamentos: FaturaLancamento[];
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

// Anchor line (joined left-to-right): "DD-MM-YYYY  ID  R$ valor  R$ saldo".
const MP_ANCHOR = /^(\d{2}-\d{2}-\d{4})\s+(.*?)\s+R\$\s*([-−]?[\d.]+,\d{2})\s+R\$\s*([-−]?[\d.]+,\d{2})\s*$/;
// The description sits in the left column (X ≈ 89). Data is at X ≈ 41, the ID at
// X ≈ 198, so [70, 190) isolates the description column.
const DESC_XMIN = 70, DESC_XMAX = 190;
// Page chrome that is never part of a description (column header, page numbers,
// document header lines, legal footer).
const MP_GEOM_NOISE = /^(data\s+descri|detalhe dos|extrato de|saldo\s+(inicial|final)|entradas:|saidas:|periodo|cpf\/cnpj|mercado\s+pago institu|\d+\/\d+\s*$)/i;
// A transaction's description and its anchor form a tight vertical cluster: gaps
// WITHIN a transaction are ≤12, gaps BETWEEN transactions are ≥23 (measured: the
// 13–22 range is empty). So a gap > 17 marks a transaction boundary. This is far
// more robust than a fixed Y-band: descriptions have 2 OR 3 lines, above AND
// below the anchor, with anchor spacing that varies by description length.
const MP_GAP_SPLIT = 17;

type RawItem = { x: number; y: number; s: string };
type GLine = { y: number; joined: string; leftText: string; isAnchor: boolean };

function isGeomNoise(s: string): boolean {
  return MP_GEOM_NOISE.test(s.normalize("NFD").replace(/[̀-ͯ]/g, ""));
}

// GEOMETRIC Mercado Pago extraction. Works on raw pdfjs item coordinates, not on
// flattened text, because the description is a 2D layout (a column beside the
// anchor, on rows above AND below it) that line-order flattening scrambles.
// Strategy: group items into visual lines, cluster lines by vertical gap (each
// cluster = one transaction: an anchor + its description lines), and CARRY a
// page's trailing orphan-description cluster onto the first transaction of the
// next page (handles transactions whose anchor sits at the top of a page while
// their first description line is at the bottom of the previous one).
// Detects by CONTENT (anchor rows + header balances), not a bank-name string;
// the reconciliation gate downstream rejects any false positive.
export async function tryMercadoPagoGeometric(buffer: Buffer): Promise<ParsedClaudeResponse | null> {
  const pdfjs = await importEsm("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(buffer),
    useSystemFonts: true,
    isEvalSupported: false,
  }).promise;

  let initialBalance: number | undefined;
  let finalBalance: number | undefined;
  const transactions: NonNullable<ParsedClaudeResponse["transactions"]> = [];
  let carryDown: string[] = []; // description lines from the bottom of the prev page

  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    const items: RawItem[] = content.items
      .filter((i) => i.str && i.str.trim() && i.transform)
      .map((i) => ({
        x: Math.round(i.transform![4]),
        y: Math.round(i.transform![5] * 10) / 10,
        s: i.str!.trim(),
      }));

    // Header balances (initial = first seen; final = last seen across pages).
    const pageText = items.map((i) => i.s).join(" ");
    const im = pageText.match(/saldo\s+inicial[:\s]*R?\$?\s*([\d.,]+)/i);
    const fm = pageText.match(/saldo\s+final[:\s]*R?\$?\s*([\d.,]+)/i);
    if (im && initialBalance === undefined) initialBalance = parseBRCentavosSrv(im[1]) / 100;
    if (fm) finalBalance = parseBRCentavosSrv(fm[1]) / 100;

    // Build visual lines (group items by exact Y); keep only anchor lines and
    // left-column description lines; drop page chrome.
    const byY = new Map<number, RawItem[]>();
    for (const it of items) {
      if (!byY.has(it.y)) byY.set(it.y, []);
      byY.get(it.y)!.push(it);
    }
    const lines: GLine[] = [...byY.entries()]
      .map(([y, its]) => {
        const sorted = its.sort((a, b) => a.x - b.x);
        const joined = sorted.map((i) => i.s).join("  ");
        const leftText = sorted.filter((i) => i.x >= DESC_XMIN && i.x < DESC_XMAX).map((i) => i.s).join(" ");
        return { y, joined, leftText, isAnchor: MP_ANCHOR.test(joined) };
      })
      .filter((l) => (l.isAnchor || l.leftText) && !isGeomNoise(l.leftText) && !isGeomNoise(l.joined))
      .sort((a, b) => b.y - a.y);

    // Cluster by vertical gap.
    const clusters: GLine[][] = [];
    let cur: GLine[] = [];
    for (let i = 0; i < lines.length; i++) {
      if (i > 0 && lines[i - 1].y - lines[i].y > MP_GAP_SPLIT) { clusters.push(cur); cur = []; }
      cur.push(lines[i]);
    }
    if (cur.length) clusters.push(cur);

    let firstAnchorDone = false;
    for (let c = 0; c < clusters.length; c++) {
      const cl = clusters[c];
      const anchor = cl.find((l) => l.isAnchor);
      if (anchor) {
        const m = anchor.joined.match(MP_ANCHOR)!;
        const date = parseBRDateSrv(m[1]);
        if (!date) continue;
        let descLines = cl.filter((l) => !l.isAnchor && l.leftText).sort((a, b) => b.y - a.y).map((l) => l.leftText);
        // First transaction on the page inherits the previous page's trailing
        // orphan description (its "above" line spilled onto the previous page).
        if (!firstAnchorDone && carryDown.length) { descLines = [...carryDown, ...descLines]; carryDown = []; }
        firstAnchorDone = true;
        let description = descLines.join(" ").replace(/\s{2,}/g, " ").trim();
        if (!description) description = "Mercado Pago"; // never empty (survives the gate filter)
        const valueCents = parseBRCentavosSrv(m[3]);
        const balanceCents = parseBRCentavosSrv(m[4]);
        transactions.push({
          date,
          description,
          amount: Math.abs(valueCents) / 100,
          type: valueCents >= 0 ? "income" : "expense",
          balance: balanceCents / 100,
        });
      } else if (c === clusters.length - 1) {
        // Last cluster on the page with no anchor = the "above" description of the
        // first transaction on the NEXT page. Carry it over.
        carryDown = cl.filter((l) => l.leftText).sort((a, b) => b.y - a.y).map((l) => l.leftText);
      }
    }
  }

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

// ─── Reconciliation CASCADE (by checkpoint granularity) ───────────────────────
// Reconcile against whatever granularity the document itself declares, in
// integer cents. Passes if ANY applicable granularity closes:
//   1. line   — balance on (almost) every tx line (Mercado Pago). Strict.
//   2. day    — balance only on day checkpoints (e.g. Itaú "SALDO DO DIA").
//   3. totals — balance only in the header (initial + Σ = final).
// "none" only when nothing applicable closes (or there's no balance to anchor).
// Never blocks — the caller decides verificado vs nao_conferido from `ok`.
export type LedgerVerification = {
  mode: "line" | "day" | "totals" | "none";
  ok: boolean;
  readBalanceCents?: number;     // initial + Σ movimentos
  declaredBalanceCents?: number; // saldo final declarado (header ou último checkpoint)
  deltaCents?: number;           // declared - read (o que faltou), quando ambos conhecidos
};

export function reconcileLedger(
  txs: Array<{ date: string; signedCents: number; balanceCents?: number }>,
  checkpoints: Array<{ date: string; balanceCents: number }>,
  initialBalanceCents?: number,
  finalBalanceCents?: number
): LedgerVerification {
  const EXACT = 0; // checkpoint sums are computed — devem bater ao centavo
  const readTotal = txs.reduce((s, t) => s + t.signedCents, 0);

  const readBalanceCents = initialBalanceCents !== undefined ? initialBalanceCents + readTotal : undefined;
  const declaredBalanceCents =
    finalBalanceCents !== undefined
      ? finalBalanceCents
      : checkpoints.length
      ? [...checkpoints].sort((a, b) => a.date.localeCompare(b.date))[checkpoints.length - 1].balanceCents
      : undefined;
  const deltaCents =
    declaredBalanceCents !== undefined && readBalanceCents !== undefined
      ? declaredBalanceCents - readBalanceCents
      : undefined;
  const base = { readBalanceCents, declaredBalanceCents, deltaCents };

  // 1 — LINE chain (MP). Reuse the strict per-line reconciler (unchanged).
  const withBalance = txs.filter((t) => t.balanceCents !== undefined).length;
  if (txs.length > 0 && withBalance >= Math.ceil(txs.length * 0.8)) {
    const r = reconcileServer(
      txs.map((t) => ({ signedCents: t.signedCents, balanceCents: t.balanceCents })),
      initialBalanceCents,
      finalBalanceCents
    );
    if (r.ok) return { mode: "line", ok: true, ...base };
  }

  // 2 — DAY chain. Walk checkpoints chronologically; running balance after each
  // day's transactions must equal that day's declared balance.
  if (checkpoints.length > 0) {
    const cps = [...checkpoints].sort((a, b) => a.date.localeCompare(b.date));
    const sortedTx = [...txs].sort((a, b) => a.date.localeCompare(b.date));
    let start = initialBalanceCents;
    if (start === undefined) {
      // No header anchor: infer the opening from the first checkpoint minus its
      // day's transactions (the first checkpoint then sets the baseline).
      const firstDaySum = sortedTx.filter((t) => t.date <= cps[0].date).reduce((s, t) => s + t.signedCents, 0);
      start = cps[0].balanceCents - firstDaySum;
    }
    let running = start;
    let ti = 0;
    let dayOk = true;
    for (const cp of cps) {
      while (ti < sortedTx.length && sortedTx[ti].date <= cp.date) { running += sortedTx[ti].signedCents; ti++; }
      if (Math.abs(running - cp.balanceCents) > EXACT) { dayOk = false; break; }
    }
    if (dayOk) {
      while (ti < sortedTx.length) { running += sortedTx[ti].signedCents; ti++; }
      const finalOk = finalBalanceCents === undefined || Math.abs(running - finalBalanceCents) <= EXACT;
      if (finalOk) return { mode: "day", ok: true, ...base };
    }
  }

  // 3 — TOTALS (header only): initial + Σ == final.
  if (initialBalanceCents !== undefined && finalBalanceCents !== undefined) {
    if (Math.abs(initialBalanceCents + readTotal - finalBalanceCents) <= EXACT) {
      return { mode: "totals", ok: true, ...base };
    }
  }

  return { mode: "none", ok: false, ...base };
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

// ─── Category enrichment (separate batched Claude pass) ──────────────────────
// Pure helpers (prompt + parse). The call itself lives in index.ts, so this
// module stays free of the Anthropic SDK and the local validator can drive its
// own Sonnet-vs-Haiku comparison.

export const IMPORT_CATEGORIES = [
  "Alimentacao", "Mercado", "Transporte", "Carro", "CartaoCredito",
  "Assinaturas", "Saude", "Varejo", "Educacao", "Moradia", "Contas",
  "Seguros", "Taxas", "Emprestimos", "Doacoes", "Transferencias",
  "Hospedagem", "Viagem", "Lazer", "Recebimentos", "Outros",
] as const;

export function buildCategorySystemPrompt(): string {
  return `Você categoriza transações financeiras brasileiras. Para cada descrição, escolha UMA destas 21 categorias e responda com o CÓDIGO EXATO (sem acento, como escrito):

Alimentacao, Mercado, Transporte, Carro, CartaoCredito, Assinaturas, Saude, Varejo, Educacao, Moradia, Contas, Seguros, Taxas, Emprestimos, Doacoes, Transferencias, Hospedagem, Viagem, Lazer, Recebimentos, Outros

Guia (exemplos):
- Alimentacao: restaurante, lanchonete, padaria, bar, delivery. "CAPRICHOS DO TRIGO" → Alimentacao; "IFOOD" → Alimentacao; "RESTAURANTE X" → Alimentacao.
- Mercado: supermercado, hortifruti, atacado, mercearia.
- Transporte: Uber, 99, táxi, ônibus, metrô, BRT.
- Carro: combustível, posto, oficina, pneu, pedágio, estacionamento. "POSTO IPIRANGA" → Carro; "auto posto" → Carro.
- Saude: farmácia, drogaria, médico, hospital, clínica, plano de saúde, exame.
- Assinaturas: Netflix, Spotify, streaming, software, academia (Gympass/Wellhub).
- Varejo: lojas, e-commerce, magazine, shopping, roupas, eletrônicos.
- Educacao: escola, faculdade, curso, livraria.
- Moradia: aluguel, condomínio, IPTU.
- Contas: luz, água, gás, internet, telefone.
- Seguros, Taxas (IOF, tarifa, juros, multa), Emprestimos, Doacoes, Hospedagem, Viagem, Lazer: conforme o nome.
- Recebimentos: dinheiro que ENTROU — salário, rendimento, "Pix recebido" de pessoa, depósito. "Pix recebido FABIANA" → Recebimentos; "Rendimentos" → Recebimentos.
- Transferencias: "Pix enviado" para pessoa, TED, transferência entre contas. "Pix enviado JOAO" → Transferencias.
- Outros: quando não encaixa com confiança em nenhuma acima.

Você receberá uma lista numerada (índice: descrição). Responda SOMENTE um JSON {"0":"Codigo","1":"Codigo",...} com um código por índice. Nada além do JSON.`;
}

export function buildCategoryUserMessage(descriptions: string[]): string {
  return "Categorize cada descrição:\n\n" +
    descriptions.map((d, i) => `${i}: ${d}`).join("\n");
}

// Parse the model's JSON into a code per index. Anything missing or invalid
// becomes "Outros" — never throws, so a malformed response degrades gracefully.
export function parseCategoryCodes(rawText: string, count: number): string[] {
  const valid = new Set<string>(IMPORT_CATEGORIES);
  let obj: Record<string, unknown> = {};
  try {
    const s = rawText.indexOf("{"), e = rawText.lastIndexOf("}");
    if (s !== -1 && e > s) obj = JSON.parse(rawText.slice(s, e + 1));
  } catch { /* degrade to all-Outros */ }
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    const code = obj[String(i)];
    out.push(typeof code === "string" && valid.has(code) ? code : "Outros");
  }
  return out;
}

// ─── Deterministic-first categorization (free layers before Claude) ──────────

function normDesc(d: string): string {
  return d.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

// Layer 1 — direction rule (free): the transaction TYPE decides the category,
// regardless of the counterparty's name. Person-to-person Pix is resolved here,
// so it never hits the merchant cache.
export function directionRule(description: string): string | null {
  const n = normDesc(description);
  if (/\brendimento/.test(n)) return "Recebimentos";
  if (/pix\s+recebido|transferencia\s+recebida|dep[oó]sito\s+recebido|ted\s+recebid|doc\s+recebid|sal[aá]rio/.test(n)) return "Recebimentos";
  if (/pix\s+enviado|transferencia\s+enviada|ted\s+enviad|doc\s+enviad/.test(n)) return "Transferencias";
  return null;
}

// Layer 2 — hardcoded BR merchant seed (free): substring match over the
// normalized description. Covers the common merchants so the first import of a
// new user already resolves most rows without Claude.
const MERCHANT_SEED: Array<[RegExp, string]> = [
  [/\bifood\b|\brappi\b|\baiqfome\b|\buber\s?eats\b|\bjames delivery\b/, "Alimentacao"],
  [/\bmc\s?donalds?\b|\bburger king\b|\bbk\b|\bsubway\b|\bhabib|\bbobs\b|\boutback\b|\bspoleto\b|\bgiraffas\b|\bkfc\b|\bpizza hut\b|\bdivino fogao\b|\bmadero\b/, "Alimentacao"],
  [/\bstarbucks\b|\bcacau show\b|\bkopenhagen\b|\bsorveteria\b|\bpadaria\b|\bconfeitaria\b|\bcafeteria\b|\bcafe\b|\bacai\b/, "Alimentacao"],
  [/\batacadao\b|\bassai\b|\bcarrefour\b|\bpao de acucar\b|\bwalmart\b|\bmakro\b|\bsam.?s club\b|\btenda atacado\b|\bbig bompreco\b|\bsupermercado\b|\bhortifruti\b|\bmercado\b|\bmercearia\b|\bsacolao\b/, "Mercado"],
  [/\bdia\b|\bextra\b|\bguanabara\b|\bprezunic\b|\bzona sul\b|\bmundial\b|\bsonda\b|\bcondor\b|\bmuffato\b|\bangeloni\b/, "Mercado"],
  [/\btim\b|\bvivo\b|\bclaro\b|\boi\b|\bnextel\b/, "Contas"],
  [/\benel\b|\bcpfl\b|\bcemig\b|\bcoelba\b|\blight\b|\bsabesp\b|\bcomgas\b|\bcedae\b|\bcopasa\b|\bsaneago\b|\benergisa\b|\bequatorial\b|\bneoenergia\b/, "Contas"],
  [/\bshell\b|\bipiranga\b|\bpetrobras\b|\bbr distribuidora\b|\bauto posto\b|\bposto\b|\bcombustivel\b|\bgasolina\b|\bsem parar\b|\bveloe\b|\bconectcar\b|\bpedagio\b|\bestacionamento\b/, "Carro"],
  [/\buber\b|\b99\s?(pop|taxi)?\b|\bcabify\b|\btaxi\b|\bmetro\b|\bonibus\b|\bbilhete unico\b|\bbom\b/, "Transporte"],
  [/\bnetflix\b|\bspotify\b|\bdisney\b|\bhbo\b|\bmax\b|\bamazon prime\b|\byoutube premium\b|\bdeezer\b|\bgloboplay\b|\bparamount\b|\bapple\.?com\b|\bgoogle\b|\bchatgpt\b|\bopenai\b|\badobe\b|\bcanva\b/, "Assinaturas"],
  [/\bgympass\b|\bwellhub\b|\btotalpass\b|\bsmart\s?fit\b|\bacademia\b|\bcinema\b|\bcinemark\b|\bsympla\b|\beventim\b|\bingresso\b/, "Lazer"],
  [/\bamazon\b|\bmercado livre\b|\bmercadolivre\b|\bmercado pago\b|\bshopee\b|\baliexpress\b|\bshein\b|\bmagazine luiza\b|\bmagalu\b|\bcasas bahia\b|\bamericanas\b|\brenner\b|\briachuelo\b|\bcentauro\b|\bnetshoes\b|\bleroy\b|\bkalunga\b/, "Varejo"],
  [/\bdrogaria\b|\bdroga raia\b|\bdrogasil\b|\bpacheco\b|\bpague menos\b|\bfarmacia\b|\bultrafarma\b|\bpanvel\b|\bhospital\b|\bclinica\b|\blaboratorio\b|\bunimed\b|\bhapvida\b|\bamil\b/, "Saude"],
  [/\biof\b|\btarifa\b|\banuidade\b|\bjuros\b|\bmulta\b|\bencargo\b/, "Taxas"],
  [/\baluguel\b|\bcondominio\b|\biptu\b|\bimobiliaria\b/, "Moradia"],
];

export function seedLookup(description: string): string | null {
  const n = normDesc(description);
  for (const [re, cat] of MERCHANT_SEED) if (re.test(n)) return cat;
  return null;
}

// Cache key — the normalized merchant "core". Strips transaction-type prefixes,
// corporate suffixes, domains, IDs/CNPJ and digits, then keeps the first few
// significant words. "Pagamento com QR Pix IFOOD.COM AGENCIA 123456" and
// "IFOOD.COM 789" both reduce to "ifood". Returns "" when nothing meaningful
// remains (e.g. a bare number) — caller skips caching those.
export function normalizeMerchantKey(description: string): string {
  let s = " " + normDesc(description) + " ";
  s = s.replace(/\b(pagamento com qr pix|pagamento com pix|compra no debito|compra no credito|compra com cartao|pagamento de boleto|pagamento|compra|pix|transferencia|ted|doc|qr|debito|credito|recarga de celular|recarga|saque|deposito)\b/g, " ");
  s = s.replace(/\b(ltda|me|eireli|s\/?a|epp|mei|comercio|servicos|tecnologia|industria)\b/g, " ");
  s = s.replace(/\.com(\.br)?|www\.?/g, " ");
  s = s.replace(/\b(agencia|filial|matriz)\b/g, " ");
  s = s.replace(/[0-9]+/g, " ");
  s = s.replace(/[^a-z ]/g, " ");
  s = s.replace(/\s+/g, " ").trim();
  const words = s.split(" ").filter((w) => w.length >= 3);
  return words.slice(0, 3).join(" ");
}

// ─── Credit-card statement (fatura) detection, parsing prompt, and gate ──────

// Markers that distinguish a credit-card statement from a bank account extrato.
// Two or more present ⇒ treat as a fatura and route to the card pipeline.
const FATURA_MARKERS: RegExp[] = [
  /pagamento\s+m[ií]nimo/i,
  /vencimento/i,
  /saldo\s+anterior/i,
  /saldo\s+desta\s+fatura/i,
  /limite\s+(total|utilizado|disponiv|de\s+cr[eé]dito)/i,
  /anuidade/i,
  /\bcet\b|custo\s+efetivo\s+total/i,
  /rotativo/i,
  /fatura/i,
  /\b\d{4}\s+\*{2,}\s*\*{2,}\s+\d{4}\b|\bxxxx\s+xxxx/i, // masked card
];

export function isCreditCardStatement(text: string): boolean {
  const t = text.slice(0, 4000).normalize("NFD").replace(/[̀-ͯ]/g, "");
  let hits = 0;
  for (const m of FATURA_MARKERS) if (m.test(t)) { hits++; if (hits >= 2) return true; }
  return false;
}

export function buildFaturaSystemPrompt(): string {
  return `Você extrai dados de uma FATURA de cartão de crédito brasileira. Retorne SOMENTE um JSON válido neste formato:

{
  "card": { "bank": "string", "name": "string|null", "last4": "string|null", "limitTotal": number|null, "limitUsado": number|null, "limitDisponivel": number|null, "closingDay": number|null, "dueDay": number|null },
  "period": "YYYY-MM|null",
  "vencimento": "YYYY-MM-DD|null",
  "totals": { "saldoAnterior": number|null, "totalDespesas": number|null, "totalPagamentos": number|null, "totalCreditos": number|null, "totalAPagar": number|null },
  "historico": [ { "period": "YYYY-MM", "total": number } ],
  "lancamentos": [ { "date": "YYYY-MM-DD", "description": "string", "amount": number, "kind": "compra|pagamento|credito", "parcela": { "atual": number, "total": number }|null } ]
}

REGRAS:
- "bank": emissor do cartão (Nubank, Itaú, Bradesco, C6, Inter, etc.). "name": apelido do cartão se houver ("Nubank Gold", "Itaú Click").
- "last4": últimos 4 dígitos do cartão mascarado (XXXX XXXX XXXX 1234 → "1234").
- Limites e saldos: valor numérico exato, SEM símbolo de moeda (ex: 2500.00, não "R$ 2.500,00"). null se ausente.
- closingDay/dueDay: só o dia (número 1–31).
- "period": mês de referência da fatura (YYYY-MM). "vencimento": data de vencimento (YYYY-MM-DD).
- totals: SaldoAnterior, TotalDespesas (soma das compras), TotalPagamentos (pagamentos recebidos), TotalCreditos (estornos/créditos), TotalAPagar (saldo desta fatura). Use os valores IMPRESSOS na fatura. null se não houver.
- "historico": tabela de faturas anteriores (mês → total), se a fatura listar. [] se não houver.
- "lancamentos": TODOS os lançamentos:
  • "compra": uma compra (amount positivo). Se parcelada (ex "PARC 03/10", "3/10"), preencha parcela { atual, total }; senão parcela=null.
  • "pagamento": pagamento da fatura recebido (amount positivo).
  • "credito": estorno/crédito/reembolso (amount positivo).
- "amount" SEMPRE positivo. "date" ISO YYYY-MM-DD.
- "description": texto do estabelecimento, limpo (sem o "PARC X/Y", que vai em parcela).
- Retorne APENAS o JSON puro, sem markdown, sem texto extra.`;
}

export function parseFaturaJson(rawText: string): ParsedFatura | null {
  let obj: unknown;
  try {
    const s = rawText.indexOf("{"), e = rawText.lastIndexOf("}");
    if (s === -1 || e <= s) return null;
    obj = JSON.parse(rawText.slice(s, e + 1));
  } catch { return null; }
  const o = obj as Partial<ParsedFatura>;
  if (!o || typeof o !== "object" || !o.card || !Array.isArray(o.lancamentos)) return null;
  // Coerce lancamentos defensively.
  const lancamentos: FaturaLancamento[] = o.lancamentos
    .filter((l): l is FaturaLancamento => !!l && typeof l.amount === "number" && !!l.date && !!l.description)
    .map((l) => ({
      date: l.date,
      description: String(l.description).trim(),
      amount: Math.abs(l.amount),
      kind: l.kind === "pagamento" || l.kind === "credito" ? l.kind : "compra",
      parcela: l.parcela && typeof l.parcela.atual === "number" && typeof l.parcela.total === "number"
        ? { atual: l.parcela.atual, total: l.parcela.total }
        : undefined,
    }));
  return {
    card: o.card,
    period: o.period ?? undefined,
    vencimento: o.vencimento ?? undefined,
    totals: o.totals ?? {},
    historico: Array.isArray(o.historico) ? o.historico : [],
    lancamentos,
  };
}

// ─── Fatura gate — reconciliation by TOTALS (not a balance chain) ────────────
// SaldoAnterior + TotalDespesas − TotalPagamentos − TotalCreditos = SaldoDestaFatura.
// All four are printed on the statement. Doesn't reconcile → blocked (failed),
// never a partial import. Does NOT reuse the account extrato's balance chain.
export function reconcileFatura(
  totals: ParsedFatura["totals"],
  toleranceCents = 2
): { ok: boolean; reason?: string } {
  const { saldoAnterior, totalDespesas, totalPagamentos, totalCreditos, totalAPagar } = totals;
  if (totalAPagar === undefined)
    return { ok: false, reason: "saldo desta fatura não encontrado" };
  if (saldoAnterior === undefined && totalDespesas === undefined)
    return { ok: false, reason: "totais insuficientes para validar a fatura" };
  const c = (v: number | undefined) => Math.round((v ?? 0) * 100);
  const expected = c(saldoAnterior) + c(totalDespesas) - c(totalPagamentos) - c(totalCreditos);
  const diff = Math.abs(expected - c(totalAPagar));
  return diff <= toleranceCents
    ? { ok: true }
    : { ok: false, reason: `totais não fecham (diferença de ${(diff / 100).toFixed(2)})` };
}
