/* tests/income-pix.test.js — extração do remetente em PIX recebido (Nubank e afins).
 * Rodar: npm run test:income
 *
 * Prova que o classifyIncome distingue PIX PRÓPRIO (titular, neutro) de PIX de
 * TERCEIRO (renda, trabalho) mesmo com o descritor do Nubank poluído pela
 * instituição ("... - NOME - CPF - MERCADO PAGO IP LTDA"). O nome é isolado pelo
 * segmento anterior ao documento (CPF/CNPJ), sem varrer a linha inteira.
 */
const path = require("node:path");
const FUNC = path.join(__dirname, "..", "functions");
const { classifyIncome, extractSenderName } = require(path.join(FUNC, "lib", "income-core.js"));

const results = [];
const check = (label, cond, extra = "") =>
  results.push({ label, pass: !!cond, extra });

// 1) PIX próprio da Helen (nome completo no onboarding) → NEUTRO.
{
  const desc = "Transferência recebida pelo Pix - Helen Bemvindo Farias Soares - •••.307.547-•• - MERCADO PAGO IP LTDA.";
  const v = classifyIncome({ type: "income", description: desc, amount: 312.29 }, { userNames: ["Helen Bemvindo Farias Soares"] });
  check("1. PIX próprio da Helen (nome completo) → neutro", v.kind === "neutro",
    `sender="${extractSenderName(desc)}" kind=${v.kind}`);
}

// 2) PIX de PJ (CNPJ) → TRABALHO (renda de terceiro), sem regressão.
{
  const pj1 = "Transferência recebida pelo Pix - ANJOS ASSIS GESTAO CONDOMINIAL E CORRETAGEM DE IMOVEIS LTDA - 46.992.102/0001-31 - CORA SCFI";
  const pj2 = "ANJOS ASSIS GESTAO CONDOMINIAL E CORRETAGEM DE IMOVEIS LTDA - 46.992.102/0001-31 - CORA SCFI"; // sem prefixo
  const pj3 = "Transferência recebida pelo Pix - R.A. GUEDES SERVICOS DIGITAIS LTDA - 12.345.678/0001-90 - PAGSEGURO";
  const user = ["Helen Bemvindo Farias Soares"];
  const k1 = classifyIncome({ type: "income", description: pj1, amount: 900 }, { userNames: user }).kind;
  const k2 = classifyIncome({ type: "income", description: pj2, amount: 900 }, { userNames: user }).kind;
  const k3 = classifyIncome({ type: "income", description: pj3, amount: 900 }, { userNames: user }).kind;
  check("2. PIX de PJ (CNPJ) → trabalho, sem regressão", k1 === "trabalho" && k2 === "trabalho" && k3 === "trabalho",
    `ANJOS(prefixo)=${k1} ANJOS(cru)=${k2} R.A.GUEDES=${k3}`);
}

// 3) Formatos SEM CPF continuam funcionando (nome inline, sem documento).
//    'enviada' é saída (não chega no classifier de renda), então provamos o
//    extractSenderName direto: tem que isolar o nome, não sumir com ele.
{
  const a = extractSenderName("Bruno da Silva da Conceição (Transferência enviada)");
  const b = extractSenderName("61.301.074 JOYCE COELHO DE CAMPOS (Transferência enviada)");
  // E um recebido sem CPF com nome de terceiro → trabalho (não some com a renda).
  const recNoCpf = classifyIncome(
    { type: "income", description: "Pix recebido de MARIA DAS DORES SANTOS", amount: 200 },
    { userNames: ["Helen Bemvindo Farias Soares"] }
  ).kind;
  const okA = a === "BRUNO SILVA CONCEICAO";
  const okB = b === "JOYCE COELHO CAMPOS";
  check("3. Formatos sem CPF continuam funcionando", okA && okB && recNoCpf === "trabalho",
    `bruno="${a}" joyce="${b}" recSemCpf=${recNoCpf}`);
}

console.log("");
for (const r of results) console.log(`${r.pass ? "✅" : "❌"} ${r.label}${r.extra ? `  [${r.extra}]` : ""}`);
const passed = results.filter((r) => r.pass).length;
console.log(`\nPLACAR: ${passed} de ${results.length} passou`);
process.exit(passed === results.length ? 0 : 1);
