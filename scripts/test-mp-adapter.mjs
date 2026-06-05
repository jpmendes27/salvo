#!/usr/bin/env node
/**
 * test-mp-adapter.mjs — reproduces PRODUCTION extraction EXACTLY.
 *
 * Imports the COMPILED pdf-core module (functions/lib/pdf-core.js) — the very
 * same code processImportJob runs — so a production result reproduces locally.
 *
 * Build first:  cd functions && npx tsc
 * Run:          node scripts/test-mp-adapter.mjs "/path/extrato.pdf"
 *
 * Prints counts, the reconciliation result, IGNORAR/entradas/saídas, and a
 * MASKED sample of descriptions. NEVER the real text (third-party CPFs).
 */
import fs from "node:fs";
import { createRequire } from "node:module";

const pdfPath = process.argv[2];
if (!pdfPath) { console.error("uso: node scripts/test-mp-adapter.mjs <extrato.pdf>"); process.exit(1); }

const require = createRequire(new URL("../functions/lib/", import.meta.url));
const core = require("./pdf-core.js");
const buffer = fs.readFileSync(pdfPath);
const ok = (b) => (b ? "✓" : "✗");
const mask = (s) => s.replace(/[A-Za-zÀ-ÿ]/g, "x").replace(/[0-9]/g, "#");

(async () => {
  const parsed = await core.tryMercadoPagoGeometric(buffer);
  if (!parsed) { console.log("✗ adapter retornou NULL (não reconheceu)"); return; }

  const n = parsed.transactions.length;
  console.log("─── ADAPTER GEOMÉTRICO (código de produção) ───");
  console.log(`${ok(n === 304)} transações: ${n}`);
  console.log(`${ok(parsed.initialBalance === 25.04 && parsed.finalBalance === 16.81)} saldos: ${parsed.initialBalance} → ${parsed.finalBalance}`);

  const rec = core.reconcileParsed(parsed);
  console.log(`${ok(rec.ok)} PORTÃO reconcile = ${rec.ok ? "OK" : `FAIL — ${rec.reason}`}`);
  const empty = parsed.transactions.filter((t) => !t.description).length;
  console.log(`${ok(empty === 0)} descrições vazias: ${empty}`);

  // ── side effects ──
  const slug = "mercado-pago";
  let ignorar = 0, entradas = 0, saidas = 0;
  for (const t of parsed.transactions) {
    const signed = Math.round((t.type === "income" ? t.amount : -t.amount) * 100);
    const c = core.classifyServer(t.description, signed, slug);
    if (c === "IGNORAR") ignorar++;
    else if (c === "ENTRADA") entradas += t.amount;
    else saidas += t.amount;
  }
  console.log("\n─── EFEITOS COLATERAIS ───");
  console.log(`  IGNORAR: ${ignorar} (esperado ~157)`);
  console.log(`  Entradas reais: R$ ${entradas.toFixed(2)} (esperado ~7K, não ~13K)`);
  console.log(`  Saídas reais: R$ ${saidas.toFixed(2)}`);
  // any "reservado/retirado" leaking into non-IGNORAR?
  const leak = parsed.transactions.filter((t) => {
    const signed = Math.round((t.type === "income" ? t.amount : -t.amount) * 100);
    const c = core.classifyServer(t.description, signed, slug);
    return c !== "IGNORAR" && /reservad|retirad/i.test(t.description);
  }).length;
  console.log(`  ${ok(leak === 0)} "reservado/retirado" vazando pras entradas/saídas: ${leak}`);

  console.log("\n─── amostra de descrições (mascaradas) ───");
  [0, 2, 24, 100, 175, 253, 300].forEach((i) => {
    if (parsed.transactions[i]) console.log(`  #${i}: ${mask(parsed.transactions[i].description).slice(0, 48)}`);
  });
})().catch((e) => { console.error("ERRO:", e.message); process.exit(1); });
