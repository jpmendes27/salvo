/* tests/fatura-conferencia.test.js — Conserto 2: fatura NUNCA bloqueia.
 * Prova que a conferência virou SINAL: reconcileFatura devolve o diff e
 * faturaVerification mapeia pra nota, sem abortar. Casos reais da Helen. */
const path = require("node:path");
const { reconcileFatura, faturaVerification } = require(path.join(__dirname, "..", "functions", "lib", "pdf-core.js"));

const out = [];
const add = (line, pass) => out.push({ line, pass });

// Helper: monta totals com um diff-alvo em reais (mexe só no totalAPagar).
function totalsComDiff(diffReais) {
  const saldoAnterior = 100, despesas = 1000, pagamentos = 100, creditos = 0;
  const esperado = saldoAnterior + despesas - pagamentos - creditos; // 1000
  return { saldoAnterior, totalDespesas: despesas, totalPagamentos: pagamentos, totalCreditos: creditos, totalAPagar: esperado + diffReais };
}

// 1) 0,87 (arredondamento do Nubank) → completude verificada → IMPORTA verificado, sem alarde.
{
  const g = reconcileFatura(totalsComDiff(0.87));
  const v = faturaVerification("verificado", null, g.ok, g.diffCents);
  add(`0,87 (arredondamento): diff=${g.diffCents}c, gate.ok=${g.ok} → nota=${v.verification} (esperado verificado, sem delta) ${v.verification === "verificado" && v.deltaCents == null ? "✅" : "❌"}`,
    v.verification === "verificado" && v.deltaCents == null);
}

// 2) 151,04 EM ROTATIVO → completude já é nao_verificavel → IMPORTA nao_verificavel (não vira alarme falso).
{
  const g = reconcileFatura(totalsComDiff(151.04));
  const v = faturaVerification("nao_verificavel", null, g.ok, g.diffCents);
  add(`151,04 rotativo: diff=${g.diffCents}c → nota=${v.verification} (esperado nao_verificavel) ${v.verification === "nao_verificavel" ? "✅" : "❌"}`,
    v.verification === "nao_verificavel");
}

// 3) 151,04 SEM rotativo (completude verificada) → rebaixa pra nao_conferido + grava delta (aviso honesto), mas IMPORTA.
{
  const g = reconcileFatura(totalsComDiff(151.04));
  const v = faturaVerification("verificado", null, g.ok, g.diffCents);
  add(`151,04 sem rotativo: → nota=${v.verification}, delta=${v.deltaCents}c (esperado nao_conferido + delta) ${v.verification === "nao_conferido" && v.deltaCents === 15104 ? "✅" : "❌"}`,
    v.verification === "nao_conferido" && v.deltaCents === 15104);
}

// 4) NENHUM caso retorna "bloqueio": faturaVerification só devolve os 3 estados válidos, nunca aborta.
{
  const estados = ["verificado","nao_conferido","nao_verificavel"];
  const todos = [0, 0.87, 5, 151.04, 999].every((d) => {
    const g = reconcileFatura(totalsComDiff(d));
    const v = faturaVerification("verificado", null, g.ok, g.diffCents);
    return estados.includes(v.verification);
  });
  add(`Qualquer diferença → sempre um dos 3 estados (nunca bloqueio) ${todos ? "✅" : "❌"}`, todos);
}

console.log("");
for (const x of out) console.log(x.line);
const passed = out.filter((x) => x.pass).length;
console.log(`\nPLACAR: ${passed} de ${out.length} passou`);
process.exit(passed === out.length ? 0 : 1);
