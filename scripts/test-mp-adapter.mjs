#!/usr/bin/env node
/**
 * test-mp-adapter.mjs — reproduces PRODUCTION extraction EXACTLY.
 *
 * Imports the COMPILED pdf-core module (functions/lib/pdf-core.js) — the very
 * same code processImportJob runs — instead of re-implementing it. So whatever
 * the deployed function does (extract, adapt, reconcile) happens here too, and a
 * production FAIL reproduces locally.
 *
 * Build first:  cd functions && npx tsc
 * Run:          node scripts/test-mp-adapter.mjs "/path/extrato.pdf"
 *
 * DIAGNÓSTICO: prints ONLY counts and the reconciliation break point.
 * NEVER prints the extracted text (it has third-party CPFs).
 */
import fs from "node:fs";
import { createRequire } from "node:module";

const pdfPath = process.argv[2];
if (!pdfPath) { console.error("uso: node scripts/test-mp-adapter.mjs <extrato.pdf>"); process.exit(1); }

// Import the compiled production module. createRequire lets this ESM script load
// the CommonJS build and resolve its pdfjs dependency from functions/node_modules.
const require = createRequire(new URL("../functions/lib/", import.meta.url));
const core = require("./pdf-core.js");

const buffer = fs.readFileSync(pdfPath);
const ok = (b) => (b ? "✓" : "✗");

(async () => {
  // ── Stage 1: extraction (the exact production extractPdfTextServer) ──
  const text = await core.extractPdfTextServer(buffer);
  const lines = text.split("\n");
  console.log("─── EXTRAÇÃO (produção) ───");
  console.log(`  chars: ${text.length} · linhas: ${lines.length}`);
  const anchorLike = lines.filter((l) => /^\d{2}-\d{2}-\d{4}\b.*R\$.*R\$/.test(l.trim())).length;
  const anyDate = lines.filter((l) => /\d{2}[-/]\d{2}[-/]\d{4}/.test(l)).length;
  const anyRS = lines.filter((l) => /R\$/.test(l)).length;
  console.log(`  linhas com data: ${anyDate} · linhas com R$: ${anyRS} · linhas-âncora (data…R$…R$): ${anchorLike}`);
  console.log(`  ${ok(core.isMercadoPagoSrv(text))} detectado como Mercado Pago`);

  // ── Stage 2: deterministic adapter ──
  const parsed = core.tryMercadoPagoDeterministic(text);
  console.log("\n─── ADAPTER DETERMINÍSTICO ───");
  if (parsed === null) {
    console.log("  ✗ retornou NULL (não reconheceu / <3 transações)");
    console.log(`  → DIAGNÓSTICO: padrão não casou (âncoras por heurística: ${anchorLike})`);
  } else {
    const n = parsed.transactions?.length ?? 0;
    console.log(`  transações: ${n}`);
    console.log(`  saldo inicial: ${parsed.initialBalance} · saldo final: ${parsed.finalBalance}`);

    // ── Stage 3: reconciliation gate (the exact production reconcileParsed) ──
    const rec = core.reconcileParsed(parsed);
    console.log("\n─── PORTÃO DE RECONCILIAÇÃO ───");
    console.log(`  ${ok(rec.ok)} reconcile = ${rec.ok ? "OK" : `FAIL — ${rec.reason}`}`);
    if (!rec.ok && rec.suspectIndices.length) {
      const first = rec.suspectIndices.find((i) => i >= 0);
      console.log(`  ponto de quebra: índice ${first} de ${n} (1ª descontinuidade de saldo)`);
      console.log(`  linhas suspeitas: ${rec.suspectIndices.filter((i) => i >= 0).length}`);
    }
  }
})().catch((e) => { console.error("ERRO:", e.message); process.exit(1); });
