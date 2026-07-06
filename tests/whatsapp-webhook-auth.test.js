/* tests/whatsapp-webhook-auth.test.js — endurecimento do auth do whatsappWebhook.
 * Rodar: npm run test:whatsapp-auth
 *
 * Comportamental (funções puras de webhookAuth) + estático (source do index.ts):
 * prova os 7 critérios da tarefa.
 */
const fs = require("node:fs");
const path = require("node:path");
const FUNC = path.join(__dirname, "..", "functions");
const { extractWebhookToken, secretMatches, isWellFormedEvent } =
  require(path.join(FUNC, "lib", "whatsapp", "webhookAuth.js"));

const INDEX_SRC = fs.readFileSync(path.join(FUNC, "src", "index.ts"), "utf8");
const AUTH_SRC = fs.readFileSync(path.join(FUNC, "src", "whatsapp", "webhookAuth.ts"), "utf8");
// Recorta só o bloco da function whatsappWebhook pra checagens estáticas focadas.
const WH_START = INDEX_SRC.indexOf("export const whatsappWebhook");
const WH_BLOCK = INDEX_SRC.slice(WH_START);

const SECRET = "s3gr3d0-de-teste-super-longo-123456";
const INSTANCE = "fincheck-pro";
const validPayload = { event: "messages.upsert", instance: INSTANCE, data: { key: { remoteJid: "5521999990000@s.whatsapp.net", fromMe: false }, message: { conversation: "oi" } } };

const results = [];
const check = (label, cond) => results.push({ label, pass: !!cond });

// 1) Segredo NÃO trafega mais na query string.
{
  const noQueryInCode = !/req\.query\b/.test(WH_BLOCK) && !/query\.token/.test(WH_BLOCK) && !/\.query\./.test(AUTH_SRC);
  // token só em query (sem header, sem path) não é encontrado
  const notFoundInQuery = extractWebhookToken(undefined, "/") === null;
  check("1. Segredo não trafega na query string (código não lê query; token em query não vale)",
    noQueryInCode && notFoundInQuery);
}

// 2) Request sem segredo válido (nem header nem path) → rejeitado (401 antes de processar).
{
  const noneProvided = secretMatches(extractWebhookToken(undefined, "/"), SECRET) === false;
  const wrongProvided = secretMatches(extractWebhookToken("errado", "/"), SECRET) === false;
  // 401 e retorno ANTES do parseInbound
  const returns401 = /status\(401\)/.test(WH_BLOCK);
  const authBeforeRouting = WH_BLOCK.indexOf("secretMatches(") < WH_BLOCK.indexOf("parseInbound(");
  check("2. Sem segredo válido → 401 genérico, antes de processar",
    noneProvided && wrongProvided && returns401 && authBeforeRouting);
}

// 3) Comparação em TEMPO CONSTANTE (timingSafeEqual), tamanhos diferentes sem estourar.
{
  let noThrowDiffLen = true, diffLenFalse = false, equalTrue = false;
  try {
    diffLenFalse = secretMatches("abc", "abcdefghijklmnop") === false; // tamanhos diferentes
    equalTrue = secretMatches(SECRET, SECRET) === true;
  } catch { noThrowDiffLen = false; }
  const usesTimingSafe = /timingSafeEqual/.test(AUTH_SRC);
  check("3. Comparação em tempo constante (timingSafeEqual; tamanhos diferentes não estouram)",
    noThrowDiffLen && diffLenFalse && equalTrue && usesTimingSafe);
}

// 4) Segredo vem do Secret Manager (defineSecret), não hardcoded nem env plaintext.
{
  const usesDefineSecret = /defineSecret\(\s*["']WHATSAPP_WEBHOOK_SECRET["']\s*\)/.test(INDEX_SRC);
  const usesValue = /whatsappWebhookSecret\.value\(\)/.test(WH_BLOCK);
  const noEnvSecret = !/process\.env\.WHATSAPP_WEBHOOK/.test(INDEX_SRC); // nem TOKEN nem SECRET via env
  check("4. Segredo do Secret Manager (defineSecret + .value()), sem env plaintext/hardcoded",
    usesDefineSecret && usesValue && noEnvSecret);
}

// 5) Body malformado ou instância errada → rejeitado (400), sem rotear.
{
  const badNull = isWellFormedEvent(null, INSTANCE) === false;
  const badNoData = isWellFormedEvent({ instance: INSTANCE }, INSTANCE) === false;
  const badInstance = isWellFormedEvent({ instance: "outra", data: {} }, INSTANCE) === false;
  const ok = isWellFormedEvent(validPayload, INSTANCE) === true;
  const returns400 = /status\(400\)/.test(WH_BLOCK);
  const checkBeforeRouting = WH_BLOCK.indexOf("isWellFormedEvent(") < WH_BLOCK.indexOf("parseInbound(");
  check("5. Body malformado / instância errada → 400, antes de rotear",
    badNull && badNoData && badInstance && ok && returns400 && checkBeforeRouting);
}

// 6) Segredo NUNCA aparece em log.
{
  const consoleLines = (INDEX_SRC + "\n" + AUTH_SRC).split("\n").filter((l) => /console\./.test(l));
  const leaks = consoleLines.some((l) =>
    /whatsappWebhookSecret|\.value\(\)|\bprovided\b|x-salvo-webhook-token|req\.headers|req\.url|req\.path/i.test(l));
  check("6. Segredo nunca aparece em log (nenhum console loga segredo/header/path/url)", !leaks);
}

// 7) Roteador/folhas intocados; request VÁLIDO se comporta idêntico.
{
  // Ambos os caminhos de auth entregam o token; request válido passa auth + validação.
  const headerPath = extractWebhookToken(SECRET, "/") === SECRET;
  const pathFallback = extractWebhookToken(undefined, `/${SECRET}`) === SECRET;
  const validPasses = secretMatches(SECRET, SECRET) && isWellFormedEvent(validPayload, INSTANCE);
  // fluxo de rota intacto no source (roteamento segue chamando processInbound)
  const routingIntact = /processInbound\(\s*inbound/.test(WH_BLOCK) && /import \{ processInbound \} from "\.\/whatsapp\/router"/.test(INDEX_SRC);
  check("7. Ambos caminhos de auth funcionam; request válido segue roteando (router intacto)",
    headerPath && pathFallback && validPasses && routingIntact);
}

console.log("");
for (const r of results) console.log(`${r.pass ? "✅" : "❌"} ${r.label}`);
const passed = results.filter((r) => r.pass).length;
console.log(`\nPLACAR: ${passed} de ${results.length} passou`);
process.exit(passed === results.length ? 0 : 1);
