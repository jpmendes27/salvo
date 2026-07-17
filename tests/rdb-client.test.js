/* tests/rdb-client.test.js — categorização determinística do núcleo COMPARTILHADO
 * (src/lib/shared/categorize-keyword + internal-transfer), o MESMO código que o
 * parse client-side de CSV/OFX usa. Blinda o movimento interno (RDB/CDB/cofrinho)
 * contra regressão: resgate NUNCA vira "Recebimentos" (renda) nem "Outros".
 * Roda pelo mirror compilado (functions/lib/shared), igual aos outros testes.
 * Rodar: npm run test:rdb-client
 */
const path = require("node:path");
const SH = path.join(__dirname, "..", "functions", "lib", "shared");
const { categorizeTransaction } = require(path.join(SH, "categorize-keyword.js"));
const { isInternalTransfer } = require(path.join(SH, "internal-transfer.js"));

const results = [];
const check = (label, cond, extra = "") => results.push({ label, pass: !!cond, extra });

// ── Movimento interno → SEMPRE "Transferencias" (o bug original) ──────────────
check("Resgate RDB (entrada) → Transferencias, NÃO Recebimentos",
  categorizeTransaction("Resgate RDB", "income") === "Transferencias",
  categorizeTransaction("Resgate RDB", "income"));
check("Aplicação RDB (saída) → Transferencias, NÃO Outros",
  categorizeTransaction("Aplicação RDB", "expense") === "Transferencias",
  categorizeTransaction("Aplicação RDB", "expense"));
check("isInternalTransfer cobre RDB/CDB/cofrinho/caixinha/aplicação automática",
  isInternalTransfer("Aplicação RDB") && isInternalTransfer("Resgate CDB") &&
  isInternalTransfer("Cofrinho") && isInternalTransfer("Caixinha Nubank") &&
  isInternalTransfer("Aplicação automática") && !isInternalTransfer("Pix recebido de Maria"),
  "");

// ── Sem regressão: terceiros e compras normais seguem iguais ──────────────────
check("PIX de terceiro (entrada) → Recebimentos (sem regressão)",
  categorizeTransaction("Pix recebido de Maria", "income") === "Recebimentos",
  categorizeTransaction("Pix recebido de Maria", "income"));
check("iFood (saída) → Alimentacao (sem regressão)",
  categorizeTransaction("iFood", "expense") === "Alimentacao",
  categorizeTransaction("iFood", "expense"));
check("Compra desconhecida (saída) → Outros (sem regressão)",
  categorizeTransaction("XPTO COMERCIO", "expense") === "Outros",
  categorizeTransaction("XPTO COMERCIO", "expense"));

console.log("");
for (const r of results) console.log(`${r.pass ? "✅" : "❌"} ${r.label}${r.extra ? `  [${r.extra}]` : ""}`);
const passed = results.filter((r) => r.pass).length;
console.log(`\nPLACAR: ${passed} de ${results.length} passou`);
process.exit(passed === results.length ? 0 : 1);
