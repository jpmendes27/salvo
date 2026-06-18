/* tests/extrato.test.js — auditoria de completude do extrato (rodar: npm run test:extrato)
 *
 * Duas âncoras de fluxo, bank-agnostic: SUBTOTAL por dia (Nubank, por sinal) e SALDO DO DIA
 * (Itaú, por líquido entre saldos consecutivos). Casos com faturas reais em
 * tests/fixtures/{itau-extrato,nubank-extrato}.pdf (PII, gitignored); extração via Claude
 * CONGELADA em <name>.extrato.json (1ª rodada precisa ANTHROPIC_API_KEY).
 */
const fs = require("node:fs");
const path = require("node:path");
const FUNC = path.join(__dirname, "..", "functions");
process.env.FIREBASE_CONFIG = process.env.FIREBASE_CONFIG || JSON.stringify({ projectId: "b", storageBucket: "b.appspot.com" });
process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || "b";
const { extractPdfTextServer, auditExtratoCompleteness, auditByBalance } = require(path.join(FUNC, "lib", "pdf-core.js"));
const { buildSystemPrompt } = require(path.join(FUNC, "lib", "index.js"));

const FIX = path.join(__dirname, "fixtures");
const out = [];
const add = (line, pass) => out.push({ line, pass });

async function extractExtrato(name, text) {
  const frozen = path.join(FIX, `${name}.extrato.json`);
  if (fs.existsSync(frozen)) return JSON.parse(fs.readFileSync(frozen, "utf8"));
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  const Anthropic = require(path.join(FUNC, "node_modules", "@anthropic-ai", "sdk")).default;
  const client = new Anthropic({ apiKey: key, maxRetries: 2 });
  const msg = await client.messages.create({
    model: "claude-sonnet-4-6", max_tokens: 16384,
    system: buildSystemPrompt(),
    messages: [{ role: "user", content: `Extrato:\n\n${text.slice(0, 120000)}` }],
  });
  const raw = msg.content.find((b) => b.type === "text")?.text ?? "";
  const i = raw.indexOf("{"), e = raw.lastIndexOf("}");
  const o = JSON.parse(raw.slice(i, e + 1));
  const parsed = { transactions: o.transactions ?? [], balanceCheckpoints: o.balanceCheckpoints ?? [], initialBalance: o.initialBalance ?? null };
  fs.writeFileSync(frozen, JSON.stringify(parsed, null, 2)); // congela (gitignored)
  return parsed;
}

(async () => {
  // ── ITAÚ (SALDO DO DIA) ──
  const itTxt = await extractPdfTextServer(fs.readFileSync(path.join(FIX, "itau-extrato.pdf")));
  const it = await extractExtrato("itau-extrato", itTxt);
  if (!it) {
    add("ITAÚ EXTRATO\n  PULADO (sem ANTHROPIC_API_KEY e sem congelado)", false);
  } else {
    // completo → auditoria dispara (sem no-op) → verificado
    const aFull = auditExtratoCompleteness(it, itTxt);
    const c1 = aFull.mode === "balance" && aFull.state === "verificado";
    add(`ITAÚ EXTRATO (completo)\n  auditoria disparou, sem no-op ${aFull.mode !== "none" ? "✅" : "❌"}\n  checagem: ${aFull.state === "verificado" ? "conferido ✅" : aFull.state + " ❌"}`, c1);

    // 1 lançamento removido → nao_conferido com delta = valor do removido
    const removed = it.transactions[Math.floor(it.transactions.length / 2)];
    const minus = { ...it, transactions: it.transactions.filter((t) => t !== removed) };
    const a2 = auditExtratoCompleteness(minus, itTxt);
    const expectDeltaCents = Math.round(Math.abs(removed.amount) * 100);
    const c2 = a2.state === "nao_conferido" && Math.abs(a2.deltaCents - expectDeltaCents) <= 2;
    add(`ITAÚ EXTRATO (1 lançamento removido)\n  checagem: ${a2.state === "nao_conferido" ? "pode faltar lançamento" : a2.state}, delta ${c2 ? "correto ✅" : "❌"}`, c2);

    // sem saldo inicial: remove o saldo de fechamento mais antigo (a semente) → primeiro
    // trecho não verificável, resto confere.
    const cps = [...it.balanceCheckpoints].sort((a, b) => String(a.date).localeCompare(String(b.date)));
    const txsAudit = it.transactions
      .filter((t) => t.classification !== "IGNORAR")
      .map((t) => ({ date: t.date, type: t.type, amount: t.amount }));
    const cpsCents = cps.slice(1).map((c) => ({ date: String(c.date), balanceCents: Math.round(Number(c.balance) * 100) }));
    const a3 = auditByBalance(txsAudit, cpsCents, undefined);
    const firstUnver = a3.intervals[0]?.unverifiable === true;
    const restOk = a3.intervals.slice(1).every((iv) => iv.ok);
    add(`ITAÚ EXTRATO (sem saldo inicial)\n  primeiro trecho não verificável, resto conferido ${firstUnver && restOk ? "✅" : "❌"}`, firstUnver && restOk);
  }

  // ── NUBANK (subtotal por dia) — sem regressão ──
  // Determinístico (sem depender de o Claude extrair 100%): valida que o caminho de
  // SUBTOTAL ainda detecta (mode=flow) e audita por sinal → verificado quando bate.
  // (Em extrato real, a single-call do Claude às vezes dropa linha — é justamente o que
  // a re-extração da recoverCompleteness recupera; o audit, corretamente, sinaliza o drop.)
  {
    const text = ["10/05/2026", "Total de entradas + 100,00", "Total de saídas - 30,00"].join("\n");
    const parsed = {
      transactions: [
        { date: "2026-05-10", type: "income", amount: 100, description: "PIX recebido" },
        { date: "2026-05-10", type: "expense", amount: 30, description: "Compra X" },
      ],
      balanceCheckpoints: [],
      initialBalance: null,
    };
    const aN = auditExtratoCompleteness(parsed, text);
    const c4 = aN.mode === "flow" && aN.state === "verificado";
    add(`NUBANK (subtotal)\n  sem regressão ${c4 ? "✅" : `❌ (mode=${aN.mode}, ${aN.state})`}`, c4);
  }

  console.log("");
  for (const r of out) console.log(r.line);
  const passed = out.filter((r) => r.pass).length;
  console.log(`\nPLACAR: ${passed} de ${out.length} passou`);
  process.exit(passed === out.length ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
