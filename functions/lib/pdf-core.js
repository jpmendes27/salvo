"use strict";
// ─── Pure import-core (no firebase-functions / firebase-admin deps) ──────────
//
// Extraction, the deterministic Mercado Pago adapter, the reconciliation gate,
// and classification — the parts that must behave IDENTICALLY in production and
// in the local validator. Because this module has zero Cloud Functions side
// effects, the validator can import the COMPILED version and run the exact same
// code processImportJob runs. No re-implementation, no drift.
Object.defineProperty(exports, "__esModule", { value: true });
exports.IMPORT_CATEGORIES = void 0;
exports.extractPdfTextServer = extractPdfTextServer;
exports.parseBRCentavosSrv = parseBRCentavosSrv;
exports.parseBRDateSrv = parseBRDateSrv;
exports.tryMercadoPagoGeometric = tryMercadoPagoGeometric;
exports.reconcileServer = reconcileServer;
exports.reconcileParsed = reconcileParsed;
exports.classifyServer = classifyServer;
exports.buildCategorySystemPrompt = buildCategorySystemPrompt;
exports.buildCategoryUserMessage = buildCategoryUserMessage;
exports.parseCategoryCodes = parseCategoryCodes;
// ─── Server-side PDF text extraction (pdfjs in Node, no worker) ──────────────
// pdfjs-dist v5 ships ESM only. The runtime dynamic import below is wrapped in
// new Function so TypeScript (module: commonjs) doesn't down-level it to
// require(), which would fail on the ESM-only module.
const importEsm = new Function("s", "return import(s)");
async function extractPdfTextServer(buffer) {
    const pdfjs = await importEsm("pdfjs-dist/legacy/build/pdf.mjs");
    const doc = await pdfjs.getDocument({
        data: new Uint8Array(buffer),
        useSystemFonts: true,
        isEvalSupported: false,
    }).promise;
    const pageTexts = [];
    for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
        const page = await doc.getPage(pageNum);
        const content = await page.getTextContent();
        const rowMap = new Map();
        for (const item of content.items) {
            if (!item.str || !item.str.trim() || !item.transform)
                continue;
            const y = Math.round(item.transform[5]);
            const x = item.transform[4];
            if (!rowMap.has(y))
                rowMap.set(y, []);
            rowMap.get(y).push({ x, text: item.str });
        }
        const rows = [...rowMap.entries()]
            .sort((a, b) => b[0] - a[0])
            .map(([, items]) => items.sort((a, b) => a.x - b.x).map((i) => i.text).join("  ").trim())
            .filter(Boolean);
        pageTexts.push(rows.join("\n"));
    }
    return pageTexts.join("\n");
}
// ─── Deterministic Mercado Pago adapter (zero API cost) ──────────────────────
// KEEP IN SYNC with src/lib/import/adapters/mercado-pago.ts (anchor-line format).
function parseBRCentavosSrv(raw) {
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
function parseBRDateSrv(raw) {
    const f = raw.trim().match(/^(\d{1,2})[/\-](\d{1,2})[/\-](\d{2,4})$/);
    if (!f)
        return null;
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
function isGeomNoise(s) {
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
async function tryMercadoPagoGeometric(buffer) {
    const pdfjs = await importEsm("pdfjs-dist/legacy/build/pdf.mjs");
    const doc = await pdfjs.getDocument({
        data: new Uint8Array(buffer),
        useSystemFonts: true,
        isEvalSupported: false,
    }).promise;
    let initialBalance;
    let finalBalance;
    const transactions = [];
    let carryDown = []; // description lines from the bottom of the prev page
    for (let p = 1; p <= doc.numPages; p++) {
        const page = await doc.getPage(p);
        const content = await page.getTextContent();
        const items = content.items
            .filter((i) => i.str && i.str.trim() && i.transform)
            .map((i) => ({
            x: Math.round(i.transform[4]),
            y: Math.round(i.transform[5] * 10) / 10,
            s: i.str.trim(),
        }));
        // Header balances (initial = first seen; final = last seen across pages).
        const pageText = items.map((i) => i.s).join(" ");
        const im = pageText.match(/saldo\s+inicial[:\s]*R?\$?\s*([\d.,]+)/i);
        const fm = pageText.match(/saldo\s+final[:\s]*R?\$?\s*([\d.,]+)/i);
        if (im && initialBalance === undefined)
            initialBalance = parseBRCentavosSrv(im[1]) / 100;
        if (fm)
            finalBalance = parseBRCentavosSrv(fm[1]) / 100;
        // Build visual lines (group items by exact Y); keep only anchor lines and
        // left-column description lines; drop page chrome.
        const byY = new Map();
        for (const it of items) {
            if (!byY.has(it.y))
                byY.set(it.y, []);
            byY.get(it.y).push(it);
        }
        const lines = [...byY.entries()]
            .map(([y, its]) => {
            const sorted = its.sort((a, b) => a.x - b.x);
            const joined = sorted.map((i) => i.s).join("  ");
            const leftText = sorted.filter((i) => i.x >= DESC_XMIN && i.x < DESC_XMAX).map((i) => i.s).join(" ");
            return { y, joined, leftText, isAnchor: MP_ANCHOR.test(joined) };
        })
            .filter((l) => (l.isAnchor || l.leftText) && !isGeomNoise(l.leftText) && !isGeomNoise(l.joined))
            .sort((a, b) => b.y - a.y);
        // Cluster by vertical gap.
        const clusters = [];
        let cur = [];
        for (let i = 0; i < lines.length; i++) {
            if (i > 0 && lines[i - 1].y - lines[i].y > MP_GAP_SPLIT) {
                clusters.push(cur);
                cur = [];
            }
            cur.push(lines[i]);
        }
        if (cur.length)
            clusters.push(cur);
        let firstAnchorDone = false;
        for (let c = 0; c < clusters.length; c++) {
            const cl = clusters[c];
            const anchor = cl.find((l) => l.isAnchor);
            if (anchor) {
                const m = anchor.joined.match(MP_ANCHOR);
                const date = parseBRDateSrv(m[1]);
                if (!date)
                    continue;
                let descLines = cl.filter((l) => !l.isAnchor && l.leftText).sort((a, b) => b.y - a.y).map((l) => l.leftText);
                // First transaction on the page inherits the previous page's trailing
                // orphan description (its "above" line spilled onto the previous page).
                if (!firstAnchorDone && carryDown.length) {
                    descLines = [...carryDown, ...descLines];
                    carryDown = [];
                }
                firstAnchorDone = true;
                let description = descLines.join(" ").replace(/\s{2,}/g, " ").trim();
                if (!description)
                    description = "Mercado Pago"; // never empty (survives the gate filter)
                const valueCents = parseBRCentavosSrv(m[3]);
                const balanceCents = parseBRCentavosSrv(m[4]);
                transactions.push({
                    date,
                    description,
                    amount: Math.abs(valueCents) / 100,
                    type: valueCents >= 0 ? "income" : "expense",
                    balance: balanceCents / 100,
                });
            }
            else if (c === clusters.length - 1) {
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
function reconcileServer(txs, initialBalanceCents, finalBalanceCents, toleranceCents = 2) {
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
    const inferredInitial = txs[0].balanceCents !== undefined ? txs[0].balanceCents - txs[0].signedCents : undefined;
    const initial = initialBalanceCents ?? inferredInitial;
    if (initial === undefined)
        return { ok: false, validated: false, suspectIndices: [], reason: "saldo inicial não encontrado" };
    let running = initial;
    const suspectIndices = [];
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
function reconcileParsed(parsed) {
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
function classifyServer(description, signedCents, bankSlug, claudeClassification) {
    if (signedCents === 0)
        return "IGNORAR";
    const norm = description.normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
    if (bankSlug === "mercado-pago" && MP_IGNORE_PATTERNS.some((p) => p.test(norm))) {
        return "IGNORAR";
    }
    if (claudeClassification === "IGNORAR")
        return "IGNORAR";
    return signedCents > 0 ? "ENTRADA" : "SAIDA";
}
// ─── Category enrichment (separate batched Claude pass) ──────────────────────
// Pure helpers (prompt + parse). The call itself lives in index.ts, so this
// module stays free of the Anthropic SDK and the local validator can drive its
// own Sonnet-vs-Haiku comparison.
exports.IMPORT_CATEGORIES = [
    "Alimentacao", "Mercado", "Transporte", "Carro", "CartaoCredito",
    "Assinaturas", "Saude", "Varejo", "Educacao", "Moradia", "Contas",
    "Seguros", "Taxas", "Emprestimos", "Doacoes", "Transferencias",
    "Hospedagem", "Viagem", "Lazer", "Recebimentos", "Outros",
];
function buildCategorySystemPrompt() {
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
function buildCategoryUserMessage(descriptions) {
    return "Categorize cada descrição:\n\n" +
        descriptions.map((d, i) => `${i}: ${d}`).join("\n");
}
// Parse the model's JSON into a code per index. Anything missing or invalid
// becomes "Outros" — never throws, so a malformed response degrades gracefully.
function parseCategoryCodes(rawText, count) {
    const valid = new Set(exports.IMPORT_CATEGORIES);
    let obj = {};
    try {
        const s = rawText.indexOf("{"), e = rawText.lastIndexOf("}");
        if (s !== -1 && e > s)
            obj = JSON.parse(rawText.slice(s, e + 1));
    }
    catch { /* degrade to all-Outros */ }
    const out = [];
    for (let i = 0; i < count; i++) {
        const code = obj[String(i)];
        out.push(typeof code === "string" && valid.has(code) ? code : "Outros");
    }
    return out;
}
//# sourceMappingURL=pdf-core.js.map