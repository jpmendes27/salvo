#!/usr/bin/env node
/**
 * validate-import.mjs — valida o pipeline de import do Salvô!
 *
 * Cobre os pontos levantados na revisão:
 *   1. Mobile: o cliente extrai PDF com pdfjs no device? (reintroduz o OOM em aparelho fraco)
 *   2. Truncamento: max_tokens suficiente / chunking pra 304 transações
 *   3. Deploy: storage.rules permite upload de membro e restringe leitura
 *   4. Estrutural: batchCategorize removido, reconcile/classify/IGNORAR presentes
 *   5. E2E: extrai o PDF real via Claude, reconcilia e classifica, confere os números
 *
 * USO:
 *   # checagens estáticas (rode na raiz do repo):
 *   node validate-import.mjs
 *
 *   # estáticas + teste e2e com o PDF real:
 *   ANTHROPIC_API_KEY=sk-... node validate-import.mjs ./caminho/extrato_abril.pdf
 *
 *   # repo em outro lugar:
 *   node validate-import.mjs ./extrato.pdf --repo /home/joao/Documentos/salvo
 *
 * Opcional: MODEL=claude-sonnet-4-6 (ajuste pro modelo que suas functions usam)
 *
 * Requer Node 18+ (fetch global). O e2e usa a document API do Claude (lê o PDF cru).
 */

import fs from "node:fs";
import path from "node:path";

// ----- args -----
const args = process.argv.slice(2);
let repoRoot = process.cwd();
let pdfPath = null;
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--repo") repoRoot = args[++i];
  else if (!args[i].startsWith("--")) pdfPath = args[i];
}

const MODEL = process.env.MODEL || "claude-sonnet-4-6";
const API_KEY = process.env.ANTHROPIC_API_KEY;

// valores conhecidos DESTE extrato (extrato_abril Mercado Pago)
const EXPECTED = {
  count: 304,
  initialBalanceCents: 2504, // R$ 25,04
  finalBalanceCents: 1681, // R$ 16,81
};
const IGNORE_PATTERNS = ["dinheiro reservado", "dinheiro retirado", "reembolso", "estorno"];

// ----- output helpers -----
const C = { g: "\x1b[32m", r: "\x1b[31m", y: "\x1b[33m", dim: "\x1b[2m", b: "\x1b[1m", x: "\x1b[0m" };
let pass = 0, fail = 0, warn = 0;
const ok = (m) => { console.log(`  ${C.g}✓${C.x} ${m}`); pass++; };
const bad = (m) => { console.log(`  ${C.r}✗ ${m}${C.x}`); fail++; };
const wrn = (m) => { console.log(`  ${C.y}⚠ ${m}${C.x}`); warn++; };
const info = (m) => console.log(`  ${C.dim}${m}${C.x}`);
const head = (m) => console.log(`\n${C.b}${m}${C.x}`);

function readRepoFile(rel) {
  const p = path.join(repoRoot, rel);
  if (!fs.existsSync(p)) return null;
  return fs.readFileSync(p, "utf8");
}

// ============================================================
// CHECK 1 — Mobile: o cliente extrai PDF no device?
// ============================================================
function checkMobilePath() {
  head("CHECK 1 — Caminho do mobile (PDF não pode ser extraído no device)");
  const file = "src/app/home/page.tsx";
  const src = readRepoFile(file);
  if (!src) { wrn(`${file} não encontrado — ajuste --repo`); return; }

  // procura uso de pdfjs no fluxo de upload
  const pdfjsHits = [...src.matchAll(/(getDocument|pdfjs|pdfjs-dist)/g)];
  const rawUpload = /uploadBytes(Resumable)?\s*\(\s*[^,]*,\s*file\b/.test(src) ||
                    /uploadBytes(Resumable)?\([^)]*\bfile\b/.test(src);
  const textUpload = /uploadBytes(Resumable)?\([^)]*\b(text|extracted|conteudo|content)\b/i.test(src);

  if (pdfjsHits.length === 0) {
    ok("Nenhuma referência a pdfjs/getDocument no page.tsx — cliente não extrai PDF");
  } else {
    wrn(`pdfjs/getDocument aparece ${pdfjsHits.length}x no page.tsx — INSPECIONE se o ramo de PDF extrai no device antes de subir`);
    info("Se o PDF no mobile passa por pdfjs no cliente, o OOM em aparelho fraco NÃO foi resolvido.");
  }
  if (rawUpload) ok("Encontrado upload do arquivo CRU (file) — correto pro mobile");
  if (textUpload) wrn("Parece haver upload de TEXTO extraído (não do arquivo cru) — confirme que isso não é o caminho do mobile");
  if (!rawUpload && !textUpload) info("Não consegui inferir o que é enviado no upload — confira handleFiles manualmente.");
}

// ============================================================
// CHECK 2 — Truncamento: max_tokens e chunking
// ============================================================
function checkTruncation() {
  head("CHECK 2 — Truncamento na chamada de extração (304 transações)");
  const file = "functions/src/index.ts";
  const src = readRepoFile(file);
  if (!src) { wrn(`${file} não encontrado — ajuste --repo`); return; }

  const maxTokens = [...src.matchAll(/max_?[tT]okens["'\s:]+(\d+)/g)].map((m) => parseInt(m[1], 10));
  if (maxTokens.length === 0) {
    wrn("Não achei max_tokens em index.ts — confirme que a chamada de extração define um valor alto");
  } else {
    const max = Math.max(...maxTokens);
    info(`max_tokens encontrados: ${maxTokens.join(", ")}`);
    if (max >= 16000) ok(`max_tokens máximo = ${max} (folga pra ~304 transações estruturadas)`);
    else bad(`max_tokens máximo = ${max} — provavelmente CURTO pra 304 transações; saída pode truncar e perder transações no fim`);
  }
  const chunking = /(chunk|batch|slice|\.splice|for\s*\([^)]*\+=\s*\d{2,})/.test(src);
  if (chunking) ok("Há indício de chunking/lotes no processamento");
  else wrn("Nenhum indício de chunking — uma chamada única pra 304 é arriscada; o e2e abaixo confirma se trunca");
}

// ============================================================
// CHECK 3 — storage.rules: upload de membro + leitura restrita
// ============================================================
function checkStorageRules() {
  head("CHECK 3 — storage.rules (cliente precisa ESCREVER, leitura restrita)");
  const src = readRepoFile("storage.rules");
  if (!src) { wrn("storage.rules não encontrado — ele precisa existir e estar referenciado no firebase.json"); return; }

  const fb = readRepoFile("firebase.json");
  if (fb && /"storage"/.test(fb)) ok("storage.rules referenciado no firebase.json");
  else wrn("storage.rules pode não estar referenciado no firebase.json (bloco \"storage\")");

  const allowWrite = /allow\s+(write|create)[^;]*:[^;]*(request\.auth|isMember|workspace)/.test(src);
  const denyRead = /allow\s+read[^;]*:\s*if\s+false/.test(src) || /allow\s+read[^;]*:[^;]*(request\.auth|isMember)/.test(src);
  if (allowWrite) ok("Regra de WRITE condicionada a auth/membro — upload do cliente deve funcionar");
  else bad("Não vi regra de WRITE pra membro autenticado — o upload do cliente pode estar BLOQUEADO");
  if (denyRead) ok("Leitura restrita (Admin SDK / membro) — bom pro PDF cru com CPFs de terceiros");
  else wrn("Confirme que a LEITURA está restrita (não pode ser pública)");
}

// ============================================================
// CHECK 4 — Estrutural: peças do pipeline presentes
// ============================================================
function checkStructure() {
  head("CHECK 4 — Peças do pipeline (estrutural)");
  const idx = readRepoFile("functions/src/index.ts") || "";
  const checks = [
    ["reconcileServer", /reconcileServer/, true],
    ["classifyServer", /classifyServer/, true],
    ["MP_IGNORE_PATTERNS", /MP_IGNORE_PATTERNS/, true],
    ["processImportJob (storage trigger)", /processImportJob|onObjectFinalized/, true],
    ["clientError (beacon)", /clientError/, true],
  ];
  for (const [name, re, want] of checks) {
    if (re.test(idx) === want) ok(`${name} presente`);
    else bad(`${name} NÃO encontrado em index.ts`);
  }
  // batchCategorize deve ter sido removido (ou pelo menos não usado)
  if (/batchCategorize/.test(idx)) wrn("batchCategorize ainda aparece em index.ts — confirme que não é gasto duplo de API");
  else ok("batchCategorize removido (sem gasto duplo)");

  const alerting = readRepoFile("scripts/setup-alerting.sh") || readRepoFile("scripts/setup-monitoring.sh");
  if (alerting) ok("script de alerta de Cloud Monitoring existe");
  else wrn("script de alerta não encontrado em scripts/");
  info("Lembrete: o alerta de infra só EXISTE depois de rodar esse script com o gcloud configurado.");
}

// ============================================================
// CHECK 5 — E2E: extrai o PDF real, reconcilia, classifica
// ============================================================
// AVISO: este prompt é uma referência STANDALONE — NÃO é o que roda em produção.
// O pipeline real usa o adapter geométrico determinístico (tryMercadoPagoGeometric)
// e, no fallback, buildSystemPrompt em functions/src/pdf-core.ts. Este e2e valida a
// CAPACIDADE de extrair+reconciliar um extrato MP (modelo/abordagem), não o prompt
// exato de produção. Verde aqui ≠ prova de que o prod está correto; ao mudar o prod,
// este prompt pode defasar. Os EXPECTED abaixo são fixos pra um extrato específico.
const SYSTEM_PROMPT = `Você extrai transações de um extrato bancário do Mercado Pago (PDF).
Cada linha tem as colunas: Data | Descrição | ID da operação | Valor | Saldo.
Regras OBRIGATÓRIAS:
- "amount" = a coluna VALOR (valor da transação), em CENTAVOS INTEIROS, NEGATIVO para saídas (linhas "R$ -X").
  NUNCA use a coluna SALDO como amount.
- "balance" = a coluna SALDO (saldo corrente), em centavos inteiros.
- O sinal vem SÓ da coluna Valor, nunca inferido do texto da descrição
  (ex: "Transferência enviada IFOOD R$ 18,75" é POSITIVO, é estorno).
- "description" não inclui ID, valores nem "R$". CPF/CNPJ no meio da descrição NÃO é o ID.
- "classification": "ignorar" se a descrição contém "Dinheiro reservado", "Dinheiro retirado",
  "Reembolso" ou "Estorno" (movimentação interna). Senão "entrada" se amount>0, "saida" se amount<0.
- "category": melhor categoria em uma palavra.
- initialBalance / finalBalance = "Saldo inicial" e "Saldo final" do cabeçalho, em centavos inteiros.
- Inclua TODAS as transações, na ordem do extrato.
Responda APENAS com JSON válido, sem markdown, sem texto fora do JSON, neste formato:
{"initialBalance":int,"finalBalance":int,"transactions":[{"date":"YYYY-MM-DD","description":str,"amount":int,"balance":int,"category":str,"classification":"entrada"|"saida"|"ignorar"}]}`;

async function checkE2E() {
  head("CHECK 5 — E2E contra o PDF real (extração + reconciliação + classificação)");
  if (!pdfPath) { info("Sem PDF informado — pulando e2e. Passe o caminho do PDF como argumento."); return; }
  if (!fs.existsSync(pdfPath)) { bad(`PDF não encontrado: ${pdfPath}`); return; }
  if (!API_KEY) { wrn("ANTHROPIC_API_KEY não definida — pulando e2e."); return; }

  info(`Lendo ${pdfPath} e enviando pro Claude (${MODEL})...`);
  const pdfB64 = fs.readFileSync(pdfPath).toString("base64");

  let data;
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 32000,
        system: SYSTEM_PROMPT,
        messages: [{
          role: "user",
          content: [
            { type: "document", source: { type: "base64", media_type: "application/pdf", data: pdfB64 } },
            { type: "text", text: "Extraia todas as transações deste extrato seguindo as regras." },
          ],
        }],
      }),
    });
    data = await res.json();
  } catch (e) { bad(`Falha na chamada à API: ${e.message}`); return; }

  if (data.error) { bad(`API retornou erro: ${JSON.stringify(data.error)}`); return; }
  if (data.stop_reason === "max_tokens") {
    bad("stop_reason = max_tokens → a SAÍDA TRUNCOU. Aumente max_tokens ou processe em chunks.");
  }

  const text = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
  const cleaned = text.replace(/```json|```/g, "").trim();

  let out;
  try { out = JSON.parse(cleaned); }
  catch {
    bad("JSON inválido — provável truncamento da saída. Aumente max_tokens / faça chunking.");
    info(cleaned.slice(-200));
    return;
  }

  const txns = out.transactions || [];
  // contagem
  if (txns.length === EXPECTED.count) ok(`Extraiu ${txns.length} transações (esperado ${EXPECTED.count})`);
  else wrn(`Extraiu ${txns.length} transações — esperado ${EXPECTED.count}. Se for menos, suspeite de truncamento.`);

  // saldos do cabeçalho
  if (out.initialBalance === EXPECTED.initialBalanceCents) ok(`Saldo inicial = R$ ${(out.initialBalance / 100).toFixed(2)}`);
  else bad(`Saldo inicial = ${out.initialBalance} centavos (esperado ${EXPECTED.initialBalanceCents})`);
  if (out.finalBalance === EXPECTED.finalBalanceCents) ok(`Saldo final = R$ ${(out.finalBalance / 100).toFixed(2)}`);
  else bad(`Saldo final = ${out.finalBalance} centavos (esperado ${EXPECTED.finalBalanceCents})`);

  // reconciliação linha a linha
  let prev = out.initialBalance, mismatches = 0, firstBad = null;
  for (let i = 0; i < txns.length; i++) {
    const exp = prev + txns[i].amount;
    if (txns[i].balance !== exp) { mismatches++; if (!firstBad) firstBad = { i, ...txns[i], esperado: exp }; }
    prev = txns[i].balance;
  }
  if (mismatches === 0) ok("Reconciliação linha a linha fecha (saldo[n] = saldo[n-1] + valor[n])");
  else { bad(`${mismatches} linha(s) não reconciliam`); info(`primeira: idx ${firstBad.i} "${firstBad.description}" saldo=${firstBad.balance} esperado=${firstBad.esperado}`); }

  // cadeia fecha no saldo final
  if (prev === out.finalBalance) ok("Cadeia fecha no saldo final declarado");
  else bad(`Cadeia termina em ${prev} mas saldo final é ${out.finalBalance}`);

  // checagem agregada independente (pega transação faltando/truncada)
  const net = txns.reduce((s, t) => s + t.amount, 0);
  const expectedNet = out.finalBalance - out.initialBalance;
  if (net === expectedNet) ok(`Soma de todos os valores = R$ ${(net / 100).toFixed(2)} (bate com final − inicial)`);
  else bad(`Soma dos valores (${net}) ≠ final−inicial (${expectedNet}) → transação faltando ou valor errado`);

  // primeira transação
  const t0 = txns[0] || {};
  if (/rendimentos/i.test(t0.description || "")) ok(`1ª transação: "${t0.description}"`);
  else bad(`1ª transação deveria ser "Rendimentos", veio "${t0.description}"`);
  if (t0.amount === 1) ok("1ª transação = +R$ 0,01 (entrada, não -R$ 25,05)");
  else bad(`1ª transação amount = ${t0.amount} centavos (esperado +1) — o bug do Saldo-como-Valor pode ter voltado`);
  if (t0.classification === "entrada") ok("1ª transação classificada como entrada");
  else bad(`1ª transação classificada como "${t0.classification}" (esperado entrada)`);

  // classificação IGNORAR
  const ignored = txns.filter((t) => t.classification === "ignorar");
  const internalCount = txns.filter((t) => IGNORE_PATTERNS.some((p) => (t.description || "").toLowerCase().includes(p))).length;
  if (ignored.length > 0) ok(`${ignored.length} transações classificadas IGNORAR (internas: reserva/retirada/estorno)`);
  else bad("Nenhuma transação IGNORAR — este extrato tem MUITAS reservas; algo está errado na classificação");
  const misclassified = txns.filter((t) =>
    IGNORE_PATTERNS.some((p) => (t.description || "").toLowerCase().includes(p)) && t.classification !== "ignorar");
  if (misclassified.length === 0) ok("Todas as movimentações internas foram marcadas IGNORAR");
  else bad(`${misclassified.length} movimentações internas NÃO foram ignoradas (vão inflar entradas/saídas)`);

  // entradas/saídas reais (excluindo internas)
  const entradas = txns.filter((t) => t.classification === "entrada").reduce((s, t) => s + t.amount, 0);
  const saidas = txns.filter((t) => t.classification === "saida").reduce((s, t) => s + t.amount, 0);
  info(`Entradas reais: R$ ${(entradas / 100).toFixed(2)} · Saídas reais: R$ ${(saidas / 100).toFixed(2)} · Ignoradas: ${ignored.length}`);
  if (entradas < 1000000) ok(`Entradas reais (R$ ${(entradas / 100).toFixed(2)}) bem abaixo dos R$ 13.494 do cabeçalho → reservas excluídas`);
  else wrn("Entradas reais muito altas — as reservas podem NÃO estar sendo excluídas");
}

// ============================================================
async function main() {
  console.log(`${C.b}Validação do pipeline de import — Salvô!${C.x}`);
  info(`repo: ${repoRoot}`);
  checkMobilePath();
  checkTruncation();
  checkStorageRules();
  checkStructure();
  await checkE2E();

  head("RESUMO");
  console.log(`  ${C.g}${pass} ok${C.x} · ${C.y}${warn} avisos${C.x} · ${C.r}${fail} falhas${C.x}`);
  console.log(`\n${C.dim}Não dá pra scriptar: o OOM no iPhone real e o comportamento de upload em rede móvel.`);
  console.log(`Teste com um PDF real num celular de verdade pra fechar o item do mobile.${C.x}\n`);
  process.exit(fail > 0 ? 1 : 0);
}
main();
