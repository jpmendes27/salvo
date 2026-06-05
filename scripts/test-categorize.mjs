#!/usr/bin/env node
/**
 * test-categorize.mjs — compares Sonnet vs Haiku on the categorization pass,
 * using the EXACT production prompt/parse from functions/lib/pdf-core.js.
 *
 * Build first:  cd functions && npx tsc
 * Run:          ANTHROPIC_API_KEY=sk-... node scripts/test-categorize.mjs "/path/extrato.pdf"
 *
 * Shows, per model: time, % "Outros" (lower = better coverage), and the category
 * distribution. Then the agreement rate between the two. Aggregates only — never
 * prints descriptions (third-party names/CPFs).
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
// the transactions that would actually be saved (skip clear internals)
const descs = parsed.transactions.map((t) => t.description);
const unique = [...new Set(descs)];
console.log(`descrições: ${descs.length} total · ${unique.length} únicas (dedup)\n`);

async function categorize(model) {
  const t0 = Date.now();
  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": KEY, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model, max_tokens: 8192, temperature: 0, system: core.buildCategorySystemPrompt(), messages: [{ role: "user", content: core.buildCategoryUserMessage(unique) }] }),
  });
  if (!resp.ok) throw new Error(`API ${resp.status}: ${(await resp.text()).slice(0, 200)}`);
  const data = await resp.json();
  const raw = data.content.find((b) => b.type === "text")?.text ?? "";
  const codes = core.parseCategoryCodes(raw, unique.length);
  return { codes, ms: Date.now() - t0, outTokens: data.usage?.output_tokens ?? 0 };
}

function report(name, codes) {
  const dist = {};
  for (const c of codes) dist[c] = (dist[c] || 0) + 1;
  const outros = dist["Outros"] || 0;
  console.log(`── ${name} ──`);
  console.log(`  Outros: ${outros}/${codes.length} (${(100 * outros / codes.length).toFixed(1)}%) ${outros / codes.length < 0.25 ? "✓ boa cobertura" : "⚠ muito Outros"}`);
  console.log("  distribuição:", Object.entries(dist).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}:${v}`).join("  "));
}

try {
  console.log("Sonnet...");
  const s = await categorize("claude-sonnet-4-6");
  console.log(`  tempo: ${(s.ms / 1000).toFixed(1)}s · output tokens: ${s.outTokens}`);
  report("SONNET 4.6", s.codes);

  console.log("\nHaiku...");
  const h = await categorize("claude-haiku-4-5-20251001");
  console.log(`  tempo: ${(h.ms / 1000).toFixed(1)}s · output tokens: ${h.outTokens}`);
  report("HAIKU 4.5", h.codes);

  // agreement
  let same = 0;
  for (let i = 0; i < unique.length; i++) if (s.codes[i] === h.codes[i]) same++;
  console.log(`\n── concordância Sonnet vs Haiku ──`);
  console.log(`  ${same}/${unique.length} (${(100 * same / unique.length).toFixed(1)}%) iguais`);
} catch (e) {
  console.error("ERRO:", e.message);
  process.exit(1);
}
