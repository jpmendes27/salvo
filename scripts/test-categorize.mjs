#!/usr/bin/env node
/**
 * test-categorize.mjs — measures the deterministic-first cascade and compares
 * Sonnet vs Haiku on the RESIDUE, using the EXACT production helpers from
 * functions/lib/pdf-core.js.
 *
 * Build first:  cd functions && npx tsc
 * Run:          ANTHROPIC_API_KEY=sk-... node scripts/test-categorize.mjs "/path/extrato.pdf"
 *
 * Shows how many rows each free layer (direction rule, merchant seed) resolves,
 * the residue size (deduped by merchant key = Claude calls on a cold cache),
 * and Sonnet vs Haiku on that residue. Aggregates only — never prints text.
 */
import fs from "node:fs";
import { createRequire } from "node:module";

const KEY = process.env.ANTHROPIC_API_KEY;
const pdfPath = process.argv[2];
if (!KEY || !pdfPath) { console.error("uso: ANTHROPIC_API_KEY=sk-... node scripts/test-categorize.mjs <pdf>"); process.exit(1); }

const require = createRequire(new URL("../functions/lib/", import.meta.url));
const core = require("./pdf-core.js");

const parsed = await core.tryMercadoPagoGeometric(fs.readFileSync(pdfPath));
if (!parsed) { console.error("adapter não reconheceu o PDF"); process.exit(1); }
const descs = parsed.transactions.map((t) => t.description);

// ── cascade on a COLD cache ──
let byRule = 0, bySeed = 0;
const residueDescByKey = new Map();
for (const d of descs) {
  if (core.directionRule(d)) { byRule++; continue; }
  if (core.seedLookup(d)) { bySeed++; continue; }
  const key = core.normalizeMerchantKey(d);
  if (key && !residueDescByKey.has(key)) residueDescByKey.set(key, d);
}
const residueKeys = [...residueDescByKey.keys()];
const repDesc = [...residueDescByKey.values()];

console.log(`total transações: ${descs.length}`);
console.log(`  regra de direção (grátis): ${byRule}`);
console.log(`  seed de comerciantes (grátis): ${bySeed}`);
console.log(`  resíduo → Claude (cache fria): ${residueKeys.length} merchants únicos`);
console.log(`  → ${(100 * (byRule + bySeed) / descs.length).toFixed(0)}% resolvido SEM Claude na 1ª vez; 100% na 2ª (cache)\n`);

async function categorize(model) {
  const t0 = Date.now();
  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": KEY, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model, max_tokens: 8192, temperature: 0, system: core.buildCategorySystemPrompt(), messages: [{ role: "user", content: core.buildCategoryUserMessage(repDesc) }] }),
  });
  if (!resp.ok) throw new Error(`API ${resp.status}: ${(await resp.text()).slice(0, 200)}`);
  const data = await resp.json();
  const raw = data.content.find((b) => b.type === "text")?.text ?? "";
  return { codes: core.parseCategoryCodes(raw, repDesc.length), ms: Date.now() - t0, out: data.usage?.output_tokens ?? 0 };
}
function report(name, codes) {
  const dist = {};
  for (const c of codes) dist[c] = (dist[c] || 0) + 1;
  const outros = dist["Outros"] || 0;
  console.log(`── ${name} (resíduo de ${codes.length}) ──`);
  console.log(`  Outros: ${outros}/${codes.length} (${(100 * outros / codes.length).toFixed(1)}%)`);
  console.log("  distribuição:", Object.entries(dist).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}:${v}`).join("  "));
}

if (residueKeys.length === 0) { console.log("resíduo vazio — nada pro Claude!"); process.exit(0); }

try {
  const s = await categorize("claude-sonnet-4-6");
  console.log(`Sonnet: ${(s.ms / 1000).toFixed(1)}s · ${s.out} tokens`); report("SONNET 4.6", s.codes);
  const h = await categorize("claude-haiku-4-5-20251001");
  console.log(`\nHaiku: ${(h.ms / 1000).toFixed(1)}s · ${h.out} tokens`); report("HAIKU 4.5", h.codes);
  let same = 0; for (let i = 0; i < residueKeys.length; i++) if (s.codes[i] === h.codes[i]) same++;
  console.log(`\nconcordância: ${same}/${residueKeys.length} (${(100 * same / residueKeys.length).toFixed(1)}%)`);
} catch (e) { console.error("ERRO:", e.message); process.exit(1); }
