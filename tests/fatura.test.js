/* tests/fatura.test.js — suíte de completude de fatura (rodar: npm run test:fatura)
 *
 * Gate por VALOR (não por contagem): Σ débitos do período (líquido de créditos) ==
 * total de novas despesas IMPRESSO (±R$0,10). Fatura em atraso/rotativo → nao_verificavel
 * (detectado por lançamentos reais, não pelo boilerplate de rodapé). Estados nunca bloqueiam.
 *
 * Faturas reais em tests/fixtures/{nubank-pago,nubank-atraso,itau}.pdf (PII, gitignored).
 * A extração via Claude é CONGELADA em <name>.parsed.json (1ª rodada precisa ANTHROPIC_API_KEY).
 */
const fs = require("node:fs");
const path = require("node:path");
const FUNC = path.join(__dirname, "..", "functions");
const {
  extractPdfTextServer, buildFaturaSystemPrompt, parseFaturaJson,
  parseFaturaNovasDespesas, sumPeriodDebitsCents, checkFaturaCompleteness, detectFaturaAtraso,
} = require(path.join(FUNC, "lib", "pdf-core.js"));

const FIX = path.join(__dirname, "fixtures");
const out = [];
const add = (line, pass) => out.push({ line, pass });
const brl = (c) => (c / 100).toFixed(2);

async function extractFatura(name, text) {
  const frozen = path.join(FIX, `${name}.parsed.json`);
  if (fs.existsSync(frozen)) return JSON.parse(fs.readFileSync(frozen, "utf8"));
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  const Anthropic = require(path.join(FUNC, "node_modules", "@anthropic-ai", "sdk")).default;
  const client = new Anthropic({ apiKey: key, maxRetries: 2 });
  const msg = await client.messages.create({
    model: "claude-sonnet-4-6", max_tokens: 8192,
    system: buildFaturaSystemPrompt(),
    messages: [{ role: "user", content: `Fatura:\n\n${text.slice(0, 120000)}` }],
  });
  const raw = msg.content.find((b) => b.type === "text")?.text ?? "";
  const f = parseFaturaJson(raw);
  const parsed = { lancamentos: f?.lancamentos ?? [], totals: f?.totals ?? {} };
  fs.writeFileSync(frozen, JSON.stringify(parsed, null, 2)); // congela (gitignored)
  return parsed;
}

async function load(name) {
  const file = path.join(FIX, `${name}.pdf`);
  if (!fs.existsSync(file)) return null;
  const text = await extractPdfTextServer(fs.readFileSync(file));
  const f = await extractFatura(name, text);
  return f ? { text, ...f } : { text, missingKey: true };
}

async function caseLimpa(name, header) {
  const d = await load(name);
  if (!d) { add(`${header}\n  fixture ausente (${name}.pdf)`, false); return; }
  if (d.missingKey) { add(`${header}\n  leitura PULADA (sem ANTHROPIC_API_KEY e sem congelado)`, false); return; }
  const anchor = parseFaturaNovasDespesas(d.text);
  const atraso = detectFaturaAtraso(d.lancamentos, d.totals, d.text);
  const sum = sumPeriodDebitsCents(d.lancamentos);
  const leitura = anchor != null && Math.abs(anchor - sum) <= 10;
  const res = checkFaturaCompleteness(d.lancamentos, anchor, atraso);
  const pass = !atraso && leitura && res.state === "verificado";
  add(
    `${header}\n  leitura da fatura: ${leitura ? "completa ✅" : `incompleta (soma ${brl(sum)} vs novas despesas ${anchor != null ? brl(anchor) : "?"}) ❌`}` +
    `\n  checagem: ${res.state === "verificado" ? "conferido ✅" : `${res.state} ❌`}`,
    pass
  );
}

async function caseAtraso(name, header) {
  const d = await load(name);
  if (!d) { add(`${header}\n  fixture ausente (${name}.pdf)`, false); return; }
  if (d.missingKey) { add(`${header}\n  leitura PULADA (sem ANTHROPIC_API_KEY e sem congelado)`, false); return; }
  const anchor = parseFaturaNovasDespesas(d.text);
  const atraso = detectFaturaAtraso(d.lancamentos, d.totals, d.text);
  const res = checkFaturaCompleteness(d.lancamentos, anchor, atraso);
  const pass = atraso && res.state === "nao_verificavel";
  add(
    `${header}\n  detectada como atraso/rotativo ${atraso ? "✅" : "❌"}` +
    `\n  checagem: ${res.state === "nao_verificavel" ? "não verificável, sem alarme ✅" : `${res.state} ❌`}`,
    pass
  );
}

function caseSinteticos() {
  const base = [
    { date: "2026-05-01", description: "Compra A", amount: 100.0, kind: "compra" },
    { date: "2026-05-02", description: "IOF de compra", amount: 2.5, kind: "compra" },
    { date: "2026-05-03", description: "Estorno parcial", amount: 10.0, kind: "credito" },
    { date: "2026-05-04", description: "Pagamento recebido", amount: 50.0, kind: "pagamento" },
  ];
  const anchor = sumPeriodDebitsCents(base); // 100 + 2,50 − 10 = 92,50 (pagamento ignorado)
  const completa = checkFaturaCompleteness(base, anchor, false);
  const faltando = checkFaturaCompleteness(base.filter((l) => l.description !== "Compra A"), anchor, false);
  const semTotal = checkFaturaCompleteness(base, null, false);
  const okC = completa.state === "verificado";
  const okF = faltando.state === "nao_conferido" && (faltando.deltaCents ?? 0) > 0;
  const okS = semTotal.state === "nao_verificavel";
  add(
    `SINTÉTICOS\n  fatura completa → conferido ${okC ? "✅" : `❌ (${completa.state})`}` +
    `\n  faltando 1 lançamento → alerta honesto ${okF ? "✅" : `❌ (${faltando.state})`}` +
    `\n  sem total declarado → sem alarme ${okS ? "✅" : `❌ (${semTotal.state})`}`,
    okC && okF && okS
  );
}

(async () => {
  await caseLimpa("nubank-pago", "NUBANK (paga em dia)");
  await caseAtraso("nubank-atraso", "NUBANK (em atraso)");
  await caseLimpa("itau", "ITAÚ");
  caseSinteticos();

  console.log("");
  for (const r of out) console.log(r.line);
  const passed = out.filter((r) => r.pass).length;
  console.log(`\nPLACAR: ${passed} de ${out.length} passou`);
  process.exit(passed === out.length ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
