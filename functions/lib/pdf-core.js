"use strict";
// ─── Pure import-core (no firebase-functions / firebase-admin deps) ──────────
//
// Extraction, the deterministic Mercado Pago adapter, the reconciliation gate,
// and classification — the parts that must behave IDENTICALLY in production and
// in the local validator. Because this module has zero Cloud Functions side
// effects, the validator can import the COMPILED version and run the exact same
// code processImportJob runs. No re-implementation, no drift.
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractPdfTextServer = extractPdfTextServer;
exports.parseBRCentavosSrv = parseBRCentavosSrv;
exports.parseBRDateSrv = parseBRDateSrv;
exports.tryMercadoPagoGeometric = tryMercadoPagoGeometric;
exports.reconcileServer = reconcileServer;
exports.reconcileParsed = reconcileParsed;
exports.classifyServer = classifyServer;
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
// A transaction's description spans TWO text lines — one just ABOVE its anchor
// (Y ≈ anchorY + 7) and one just BELOW (Y ≈ anchorY − 5). The next transaction's
// description is ~23 away, so a ±12 Y-band captures this transaction's lines and
// nothing else. This is the fix for the leak: the line BELOW the anchor was being
// attributed to the NEXT transaction by any line-order parser.
const Y_BAND = 12;
// GEOMETRIC Mercado Pago extraction. Works on raw pdfjs item coordinates, not on
// flattened text, because the description is a 2D layout (a column beside the
// anchor, on rows above AND below it) that line-order flattening scrambles.
// Detects by CONTENT (anchor rows + header balances), not a bank-name string.
// The reconciliation gate downstream rejects any false positive.
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
        // Group items into visual lines by exact Y.
        const byY = new Map();
        for (const it of items) {
            if (!byY.has(it.y))
                byY.set(it.y, []);
            byY.get(it.y).push(it);
        }
        const lines = [...byY.entries()]
            .map(([y, its]) => ({ y, joined: its.sort((a, b) => a.x - b.x).map((i) => i.s).join("  ") }))
            .sort((a, b) => b.y - a.y);
        for (const line of lines) {
            const m = line.joined.match(MP_ANCHOR);
            if (!m)
                continue;
            const [, dateRaw, , valorRaw, saldoRaw] = m;
            const date = parseBRDateSrv(dateRaw);
            if (!date)
                continue;
            // Description = left-column items within the anchor's Y-band (above + below),
            // grouped by Y (top-to-bottom), each row's words ordered left-to-right.
            const descByY = new Map();
            for (const it of items) {
                if (it.x >= DESC_XMIN && it.x < DESC_XMAX && it.y !== line.y && Math.abs(it.y - line.y) <= Y_BAND) {
                    if (!descByY.has(it.y))
                        descByY.set(it.y, []);
                    descByY.get(it.y).push(it);
                }
            }
            let description = [...descByY.entries()]
                .sort((a, b) => b[0] - a[0])
                .map(([, its]) => its.sort((a, b) => a.x - b.x).map((i) => i.s).join(" "))
                .join(" ")
                .replace(/\s{2,}/g, " ")
                .trim();
            if (!description)
                description = "Mercado Pago"; // never empty (survives the gate filter)
            const valueCents = parseBRCentavosSrv(valorRaw);
            const balanceCents = parseBRCentavosSrv(saldoRaw);
            transactions.push({
                date,
                description,
                amount: Math.abs(valueCents) / 100,
                type: valueCents >= 0 ? "income" : "expense",
                balance: balanceCents / 100,
            });
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
//# sourceMappingURL=pdf-core.js.map