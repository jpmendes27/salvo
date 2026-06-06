import { onCall, onRequest, HttpsError } from "firebase-functions/v2/https";
import { onObjectFinalized } from "firebase-functions/v2/storage";
import Anthropic from "@anthropic-ai/sdk";
import { Resend } from "resend";
import crypto from "crypto";
import * as admin from "firebase-admin";
import {
  type ParsedClaudeResponse,
  type ParsedFatura,
  extractPdfTextServer,
  tryMercadoPagoGeometric,
  reconcileServer,
  reconcileParsed,
  classifyServer,
  IMPORT_CATEGORIES,
  buildCategorySystemPrompt,
  buildCategoryUserMessage,
  parseCategoryCodes,
  directionRule,
  seedLookup,
  normalizeMerchantKey,
  isCreditCardStatement,
  buildFaturaSystemPrompt,
  parseFaturaJson,
  reconcileFatura,
} from "./pdf-core";

admin.initializeApp();

// ─── HMAC helpers for stateless verification (no Firestore needed) ────────────

function signVerifToken(uid: string, expiry: number, code: string, secret: string): string {
  const payload = Buffer.from(`${uid}|${expiry}`).toString("base64url");
  const mac = crypto.createHmac("sha256", secret).update(`${payload}|${code}`).digest("hex");
  return `${payload}.${mac}`;
}

function checkVerifToken(token: string, uid: string, enteredCode: string, secret: string): boolean {
  try {
    const [payload, mac] = token.split(".");
    const decoded = Buffer.from(payload, "base64url").toString();
    const [storedUid, expiryStr] = decoded.split("|");
    if (storedUid !== uid) return false;
    if (Date.now() > parseInt(expiryStr)) return false;
    const expected = crypto.createHmac("sha256", secret).update(`${payload}|${enteredCode}`).digest("hex");
    return crypto.timingSafeEqual(Buffer.from(mac, "hex"), Buffer.from(expected, "hex"));
  } catch {
    return false;
  }
}

function buildSystemPrompt(): string {
  const today = new Date().toISOString().slice(0, 10);
  return `Hoje é ${today}. Use esta data como referência para inferir o ano quando as datas do documento não tiverem ano explícito (ex: "06 MAI" → use o ano corrente ou o mais próximo cronologicamente).

Você é um extrator especializado de transações financeiras de extratos bancários brasileiros.

Dado um arquivo (PDF, imagem ou CSV), extraia TODAS as transações financeiras visíveis e retorne SOMENTE um JSON válido:

{
  "sourceLabel": "string",
  "initialBalance": number | null,
  "finalBalance": number | null,
  "transactions": [
    {
      "date": "YYYY-MM-DD",
      "description": "string",
      "amount": number,
      "type": "income" | "expense",
      "category": "string",
      "classification": "ENTRADA" | "SAIDA" | "IGNORAR",
      "balance": number | null
    }
  ]
}

=== REGRAS PARA sourceLabel ===
- Fatura de cartão de crédito COM últimos 4 dígitos visíveis: "Cartão [Banco] [4 dígitos]"
  Exemplos: "Cartão Nubank 1234", "Cartão Itaú 5678"
- Fatura de cartão SEM dígitos visíveis: "Cartão [Banco]"
- Extrato / conta corrente / conta digital / poupança: apenas o nome do banco
  Exemplos: "Nubank", "Inter", "Mercado Pago"
- Carteira digital: nome da carteira — "PicPay", "Mercado Pago"
- NUNCA inclua datas, períodos, números de agência ou conta
- SEMPRE tente extrair os últimos 4 dígitos do cartão (aparecem como •••• 1234, **** 1234, "final 1234")
- Se não conseguir identificar o banco: "Importação"

=== REGRAS PARA initialBalance e finalBalance ===
- Extraia os saldos inicial e final do cabeçalho ou resumo do documento
- Use o valor numérico exato, sem símbolo de moeda (ex: 25.04, não "R$ 25,04")
- Use null se não disponível

=== REGRAS PARA classification ===
- ENTRADA: dinheiro que entrou de fora (salário, PIX recebido, rendimento, reembolso de terceiro real)
- SAIDA: dinheiro que saiu para fora (compra, pagamento, PIX enviado, transferência para outro banco)
- IGNORAR: movimento interno que NÃO representa receita nem gasto real:
  • "Dinheiro reservado" — reserva para pagamento futuro, não saiu de facto
  • "Dinheiro retirado" — transferência interna entre contas do mesmo banco/carteira
  • "Reembolso" sem contexto de terceiro — estorno interno do banco
  • "Estorno" — cancelamento de operação anterior (compensa operação prévia)
  • Qualquer linha com amount = 0

=== REGRAS PARA balance ===
- "balance": o saldo APÓS esta transação, conforme a coluna Saldo do documento
- Use o valor numérico exato (ex: 25.05), sem símbolo de moeda
- null se a coluna Saldo não estiver disponível

=== REGRAS ESPECÍFICAS: MERCADO PAGO ===
O extrato do Mercado Pago tem 5 colunas: Data | Descrição | ID da operação | Valor | Saldo
CRÍTICO — leia com atenção:
1. O valor da transação vem da coluna VALOR (com sinal). NUNCA use a coluna SALDO como valor.
2. Sinal da coluna Valor determina o type: "R$ -18,75" → expense; "R$ 18,75" → income.
   Uma "Transferência enviada IFOOD R$ 18,75" COM VALOR POSITIVO é income (estorno/reembolso).
3. O ID da operação (sequência de 12+ dígitos isolada) NÃO entra em "description".
4. CPF/CNPJ dentro de descrições de PIX É parte da description (ex: "João Silva 123.456.789-00").
5. A coluna Saldo = saldo depois da transação → use em "balance".
6. "Rendimentos" = ENTRADA (rendimento da conta), type = "income".

=== REGRAS PARA category ===
Categorias disponíveis: ${IMPORT_CATEGORIES.join(", ")}
- income/ENTRADA → "Recebimentos" como padrão; outra se claramente identificável
- expense/SAIDA → categoria mais específica
- IGNORAR → "Transferencias"
- Dúvida → "Outros"

=== REGRAS PARA transações ===
- NÃO inclua: pagamentos de fatura, saldo anterior/restante, crédito de atraso, encerramento de dívida, totais, limites
- "amount" SEMPRE positivo (ex: 150.00, nunca -150.00)
- "type": "expense" se a transação reduziu o saldo; "income" se aumentou
- "date" no formato ISO YYYY-MM-DD
- "description": texto original da transação, sem truncar
- Retorne APENAS o JSON puro, sem markdown, sem texto adicional, sem explicação`;
}


function extractJsonObject(rawText: string): string | null {
  const start = rawText.indexOf("{");
  const end = rawText.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  return rawText.slice(start, end + 1);
}

async function parseOrRepairJson(
  client: Anthropic,
  rawText: string
): Promise<ParsedClaudeResponse> {
  const jsonText = extractJsonObject(rawText);
  if (!jsonText) {
    throw new Error("No JSON in Claude response");
  }

  try {
    return JSON.parse(jsonText) as ParsedClaudeResponse;
  } catch (err) {
    const repair = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 8192,
      system:
        "Você corrige JSON financeiro. Retorne somente um JSON válido no formato {\"sourceLabel\":\"string\",\"initialBalance\":number|null,\"finalBalance\":number|null,\"transactions\":[{\"date\":\"YYYY-MM-DD\",\"description\":\"string\",\"amount\":number,\"type\":\"income\"|\"expense\",\"category\":\"string\",\"classification\":\"ENTRADA\"|\"SAIDA\"|\"IGNORAR\",\"balance\":number|null}]}. Não invente transações.",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Corrija este JSON inválido preservando os dados existentes. Erro original: ${
                err instanceof Error ? err.message : String(err)
              }\n\n${jsonText}`
            }
          ]
        }
      ]
    });

    const repairedText =
      repair.content.find((b): b is Anthropic.TextBlock => b.type === "text")?.text ?? "{}";
    const repairedJson = extractJsonObject(repairedText);
    if (!repairedJson) {
      throw new Error("No JSON in repaired Claude response");
    }
    return JSON.parse(repairedJson) as ParsedClaudeResponse;
  }
}

// ─── Import job helpers ──────────────────────────────────────────────────────

// ─── Output-token rate limiter (Anthropic Tier 1: 8K output tokens/min) ──────
//
// A sliding 60s window of real output-token usage. Before each Claude call we
// block until the next request fits under the budget. This proactively avoids
// 429s; any that still slip through are handled by the SDK's built-in retry
// (maxRetries), which honours the Retry-After header. The goal is zero failures,
// not speed — a ~2-2.5min background job for a 304-tx statement is invisible to
// the user, a 429 is not.
const OUTPUT_TOKENS_PER_MIN = 7500; // 8K hard limit minus safety margin
const tokenLog: Array<{ t: number; tokens: number }> = [];

function recentOutputTokens(): number {
  const cutoff = Date.now() - 60_000;
  while (tokenLog.length && tokenLog[0].t < cutoff) tokenLog.shift();
  return tokenLog.reduce((s, e) => s + e.tokens, 0);
}

async function throttleOutput(estimatedTokens: number): Promise<void> {
  // Block until the trailing-60s usage plus this request fits the budget.
  while (recentOutputTokens() + estimatedTokens > OUTPUT_TOKENS_PER_MIN && tokenLog.length) {
    const waitMs = Math.max(1000, tokenLog[0].t + 60_000 - Date.now());
    await new Promise((r) => setTimeout(r, Math.min(waitMs, 15_000)));
  }
}

function recordOutputTokens(tokens: number): void {
  tokenLog.push({ t: Date.now(), tokens });
}

// Rough output-token estimate before a call (we don't know the count until the
// response arrives; the recorded value uses the real usage). ~30 tokens per
// "R$" occurrence (each tx line has ~2) is a safe over-estimate for text.
function estimateOutputTokens(data: string, mimeType: string): number {
  if (mimeType === "text/plain" || mimeType === "text/csv") {
    const rs = (data.match(/R\$/g) || []).length;
    return Math.min(8192, Math.max(800, rs * 25));
  }
  return 4000; // image/PDF: conservative
}

// Shared extraction helper — avoids duplicating Claude call logic between
// parseBankStatement (sync HTTP) and processImportJob (async Storage trigger).
async function callClaudeExtraction(
  client: Anthropic,
  data: string,
  mimeType: string,
  filename?: string,
  maxTokens = 8192
): Promise<ParsedClaudeResponse> {
  type ImageMediaType = "image/jpeg" | "image/png" | "image/gif" | "image/webp";
  const isImage =
    mimeType.startsWith("image/") &&
    ["image/jpeg", "image/png", "image/gif", "image/webp"].includes(mimeType);
  const isPDF = mimeType === "application/pdf";
  const isText = mimeType === "text/plain" || mimeType === "text/csv";

  if (!isImage && !isPDF && !isText) {
    throw new Error("Unsupported mimeType: " + mimeType);
  }

  let content: Anthropic.MessageParam["content"];

  if (isText) {
    content = [
      {
        type: "text",
        text: `Arquivo: ${filename || "extrato.txt"}\n\nExtraia todas as transações financeiras deste extrato/fatura bancária. O conteúdo pode ser texto de PDF, CSV ou OFX — adapte a leitura ao formato encontrado:\n\n${data.slice(0, 120000)}`
      }
    ];
  } else if (isImage) {
    content = [
      {
        type: "image",
        source: { type: "base64", media_type: mimeType as ImageMediaType, data }
      },
      { type: "text", text: "Extraia todas as transações financeiras desta imagem de extrato bancário." }
    ];
  } else {
    content = [
      {
        type: "document",
        source: { type: "base64", media_type: "application/pdf", data }
      },
      { type: "text", text: "Extraia todas as transações financeiras deste extrato bancário em PDF." }
    ];
  }

  // Stay under the Tier 1 output-token/min budget before issuing the call.
  await throttleOutput(estimateOutputTokens(data, mimeType));

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: maxTokens,
    system: buildSystemPrompt(),
    messages: [{ role: "user", content }]
  });

  // Record real usage so the sliding window reflects what was actually emitted.
  recordOutputTokens(message.usage?.output_tokens ?? 0);

  const rawText =
    message.content.find((b): b is Anthropic.TextBlock => b.type === "text")?.text ?? "{}";

  return parseOrRepairJson(client, rawText);
}

// ─── Category enrichment (one batched, deduped Claude call) ──────────────────
// Separate, lightweight pass that runs AFTER extraction + the reconciliation
// gate. Sends the clean descriptions (deduped) and gets back one category code
// each (~1 short token run per description), so the whole thing is one fast call
// that fits the Tier 1 budget. Throws on API failure; the caller treats it as
// non-blocking and never fails a reconciled import over categorization.
async function categorizeViaClaude(
  client: Anthropic,
  descriptions: string[],
  model = "claude-sonnet-4-6"
): Promise<string[]> {
  // Dedup: identical descriptions are asked once, then mirrored back.
  const unique = [...new Set(descriptions)];
  const indexOf = new Map(unique.map((d, i) => [d, i]));

  // Output ≈ one short "i":"Code" pair per unique description.
  await throttleOutput(Math.min(8000, Math.max(400, unique.length * 10)));
  const message = await client.messages.create({
    model,
    max_tokens: 8192,
    temperature: 0,
    system: buildCategorySystemPrompt(),
    messages: [{ role: "user", content: buildCategoryUserMessage(unique) }],
  });
  recordOutputTokens(message.usage?.output_tokens ?? 0);

  const raw = message.content.find((b): b is Anthropic.TextBlock => b.type === "text")?.text ?? "";
  const uniqueCodes = parseCategoryCodes(raw, unique.length);
  return descriptions.map((d) => uniqueCodes[indexOf.get(d)!]);
}

// Firestore doc id from a normalized merchant key (no spaces/slashes, bounded).
function merchantCacheId(key: string): string {
  return key.replace(/\s+/g, "_").replace(/[^a-z_]/g, "").slice(0, 200);
}

// ─── Deterministic-first categorization cascade ──────────────────────────────
// Per transaction, in order: (1) direction rule, (2) BR merchant seed, (3)
// Firestore merchant cache, (4) Claude on the RESIDUE only — batched, deduped by
// merchant key, with results written back to the cache so next time they're free.
// Returns one code (or null) per input description. Non-blocking: if the Claude
// residue call fails, those stay null and the client's rule-based categorizer
// fills them in.
async function categorizeCascade(
  client: Anthropic,
  db: admin.firestore.Firestore,
  descriptions: string[]
): Promise<(string | null)[]> {
  const valid = new Set<string>(IMPORT_CATEGORIES);
  const n = descriptions.length;
  const results: (string | null)[] = new Array(n).fill(null);
  const keys: string[] = new Array(n).fill("");

  // Layers 1 & 2 — direction rule + merchant seed (free, local).
  const needCache: number[] = [];
  for (let i = 0; i < n; i++) {
    const dir = directionRule(descriptions[i]);
    if (dir) { results[i] = dir; continue; }
    const seed = seedLookup(descriptions[i]);
    if (seed) { results[i] = seed; continue; }
    const key = normalizeMerchantKey(descriptions[i]);
    keys[i] = key;
    if (key) needCache.push(i); // else leave null → client rule-based fallback
  }

  // Layer 3 — Firestore merchant cache (batched read by normalized key).
  const uniqueKeys = [...new Set(needCache.map((i) => keys[i]))];
  const cacheMap = new Map<string, string>();
  if (uniqueKeys.length) {
    const refs = uniqueKeys.map((k) => db.collection("merchantCategories").doc(merchantCacheId(k)));
    const snaps = await db.getAll(...refs).catch(() => []);
    snaps.forEach((s, j) => {
      const c = s.exists ? (s.data()?.c as string | undefined) : undefined;
      if (c && valid.has(c)) cacheMap.set(uniqueKeys[j], c);
    });
  }
  const residue: number[] = [];
  for (const i of needCache) {
    const c = cacheMap.get(keys[i]);
    if (c) results[i] = c;
    else residue.push(i);
  }

  // Layer 4 — Claude on the residue only, deduped by merchant key.
  if (residue.length) {
    const residueKeys = [...new Set(residue.map((i) => keys[i]))];
    const repDesc = residueKeys.map((k) => descriptions[residue.find((i) => keys[i] === k)!]);
    try {
      // Haiku on the residue: the seed already resolved the known merchants, so
      // the residue is obscure names where Haiku matches Sonnet (both mostly
      // "Outros"). Much cheaper/faster for the same result.
      const codes = await categorizeViaClaude(client, repDesc, "claude-haiku-4-5-20251001");
      const keyToCode = new Map<string, string>();
      residueKeys.forEach((k, j) => keyToCode.set(k, codes[j]));
      for (const i of residue) results[i] = keyToCode.get(keys[i]) ?? null;
      // Persist to cache so these merchants are free next time.
      const batch = db.batch();
      keyToCode.forEach((code, k) =>
        batch.set(
          db.collection("merchantCategories").doc(merchantCacheId(k)),
          { c: code, updatedAt: admin.firestore.FieldValue.serverTimestamp() },
          { merge: true }
        )
      );
      await batch.commit().catch((e) => console.error("[import-job] merchant cache write failed:", e));
      console.log(`[import-job] residue: ${residueKeys.length} merchants via Claude (cached for next time)`);
    } catch (e) {
      console.error("[import-job] residue categorization failed (non-blocking):", e instanceof Error ? e.message : String(e));
    }
  }

  return results;
}

// ─── Recategorize (callable) ──────────────────────────────────────────────────
// A user changing a transaction's category. Does THREE things, atomically from
// the caller's view:
//   1. Updates that transaction's category (NEVER its source).
//   2. Feeds the shared merchant cache (merchantCategories), so future imports of
//      the same merchant categorize correctly with zero API cost.
//   3. Optionally applies the category to every transaction of the SAME merchant
//      (same normalized key) in the workspace — account AND card alike (source
//      is never touched). This is why it's a function: clients can't write the
//      merchant cache (rules forbid it) and a cross-collection sweep needs admin.
export const recategorize = onCall({ maxInstances: 10 }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Faça login pra continuar.");

  const { workspaceId, transactionId, category, applyToAll } = (request.data ?? {}) as {
    workspaceId?: string; transactionId?: string; category?: string; applyToAll?: boolean;
  };
  if (!workspaceId || !transactionId || !category) {
    throw new HttpsError("invalid-argument", "Dados incompletos.");
  }
  if (!(IMPORT_CATEGORIES as readonly string[]).includes(category)) {
    throw new HttpsError("invalid-argument", "Categoria inválida.");
  }

  const db = admin.firestore();
  const FieldValue = admin.firestore.FieldValue;

  // Membership gate (active member of this workspace).
  const memberSnap = await db.doc(`workspaces/${workspaceId}/members/${uid}`).get();
  if (!memberSnap.exists || memberSnap.data()?.status !== "active") {
    throw new HttpsError("permission-denied", "Você não participa deste workspace.");
  }

  const txRef = db.doc(`workspaces/${workspaceId}/transactions/${transactionId}`);
  const txSnap = await txRef.get();
  if (!txSnap.exists) throw new HttpsError("not-found", "Lançamento não encontrado.");
  const description = String(txSnap.data()?.description ?? "");
  const key = normalizeMerchantKey(description);

  // 1 + 2: this transaction's category + the shared merchant cache.
  const base = db.batch();
  base.update(txRef, { category, updatedAt: FieldValue.serverTimestamp() });
  if (key) {
    base.set(
      db.collection("merchantCategories").doc(merchantCacheId(key)),
      { c: category, updatedAt: FieldValue.serverTimestamp() },
      { merge: true }
    );
  }
  await base.commit();
  let updated = 1;

  // 3: sweep the workspace for the same merchant (chunked; 500-op batch limit).
  if (applyToAll && key) {
    const allSnap = await db.collection(`workspaces/${workspaceId}/transactions`).get();
    const matches = allSnap.docs.filter((d) => {
      if (d.id === transactionId) return false;
      const data = d.data();
      return data.category !== category &&
        normalizeMerchantKey(String(data.description ?? "")) === key;
    });
    for (let i = 0; i < matches.length; i += 450) {
      const b = db.batch();
      for (const d of matches.slice(i, i + 450)) {
        b.update(d.ref, { category, updatedAt: FieldValue.serverTimestamp() });
      }
      await b.commit();
    }
    updated += matches.length;
  }

  return { updated };
});

// ─── Chunked text extraction (parallel batches) ───────────────────────────────
//
// A single Claude call truncates at max_tokens AND approaches the 300s timeout
// for large statements (304+ transactions ≈ 17K output tokens ≈ 240s).
// Splitting the text into batches of ~50 transactions and extracting them in
// parallel keeps each call small (~2.8K tokens, ~40s) and the total fast,
// regardless of statement size.
//
// Chunk boundaries are aligned to transaction-start lines (date-anchored) so a
// transaction is never split across two chunks — this keeps reconciliation
// (which needs the full ordered balance sequence) intact.

const BATCH_TX_COUNT = 50;
// Below this many transactions a single call is cheaper than the chunk overhead.
const CHUNK_THRESHOLD = 60;

// A line that starts a new transaction block. Covers the common BR layouts:
//   "06/05/2024"            (Mercado Pago: date on its own line)
//   "06/05/2024 ... 18,75"  (generic inline: date description amount)
//   "06 MAI ..."            (Nubank fatura/extrato)
function looksLikeTxStart(line: string): boolean {
  const l = line.trim();
  return (
    /^\d{1,2}[/-]\d{1,2}([/-]\d{2,4})?(\s|$)/.test(l) ||
    /^\d{1,2}\s+[A-Za-zÀ-ÿ]{3,4}\b/.test(l)
  );
}

// Partition text lines into chunks of ~BATCH_TX_COUNT transactions each.
// The header prefix (lines before the first tx) rides with chunk 0; the footer
// (lines after the last tx, e.g. "Saldo final") rides with the last chunk.
function splitTextIntoChunks(text: string): string[] {
  const lines = text.split("\n");
  const anchorIdx: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (looksLikeTxStart(lines[i])) anchorIdx.push(i);
  }

  // Not enough structure to chunk safely → single chunk
  if (anchorIdx.length <= CHUNK_THRESHOLD) return [text];

  // Cut AFTER each anchor line, not at it. In layouts like Mercado Pago the
  // description spans the lines BEFORE the anchor (date+id+amount+balance line),
  // so cutting at the anchor would orphan a transaction's description in the
  // previous chunk and its amount in the next — breaking reconciliation at every
  // boundary. Cutting after the anchor keeps each [description + anchor] block
  // whole. Validated on the real 304-tx statement: 0 split transactions (vs 6
  // with the naive cut-at-anchor approach).
  const chunks: string[] = [];
  const n = anchorIdx.length;
  for (let k = 0; k < n; k += BATCH_TX_COUNT) {
    // Start right after the previous group's last anchor (chunk 0 keeps the
    // document header by starting at line 0).
    const from = k === 0 ? 0 : anchorIdx[k - 1] + 1;
    // End right after this group's last anchor so the block stays whole; the
    // last group runs to EOF to keep the footer (e.g. "Saldo final").
    const lastInGroup = Math.min(k + BATCH_TX_COUNT - 1, n - 1);
    const to = lastInGroup === n - 1 ? lines.length : anchorIdx[lastInGroup] + 1;
    chunks.push(lines.slice(from, to).join("\n"));
  }
  return chunks;
}

// Assemble per-chunk results into one response. Transactions are concatenated
// in document order (no dedup: the cut-after-anchor chunking produces no overlap,
// and reconciliation must see every raw transaction in sequence). Header fields:
// sourceLabel/initialBalance = first non-null; finalBalance = last non-null.
function assembleMerged(
  perChunk: Array<NonNullable<ParsedClaudeResponse["transactions"]>>,
  headers: ParsedClaudeResponse[]
): ParsedClaudeResponse {
  const transactions: NonNullable<ParsedClaudeResponse["transactions"]> = [];
  for (const txs of perChunk) for (const t of txs) transactions.push(t);
  return {
    sourceLabel: headers.find((r) => r.sourceLabel)?.sourceLabel,
    initialBalance: headers.find((r) => r.initialBalance != null)?.initialBalance,
    finalBalance: [...headers].reverse().find((r) => r.finalBalance != null)?.finalBalance,
    transactions,
  };
}

async function extractTextInChunks(
  client: Anthropic,
  text: string,
  filename?: string
): Promise<ParsedClaudeResponse> {
  const chunks = splitTextIntoChunks(text);

  // Small statement → one call. Retry once if it doesn't reconcile.
  if (chunks.length === 1) {
    let parsed = await callClaudeExtraction(client, text, "text/plain", filename);
    if (!reconcileParsed(parsed).ok) {
      const retry = await callClaudeExtraction(client, text, "text/plain", filename);
      if (reconcileParsed(retry).ok) parsed = retry;
    }
    return parsed;
  }

  // Sequential extraction: the output-token throttle spaces the calls to stay
  // under the Tier 1 budget. Parallelism wouldn't help — the per-minute rate
  // cap is the floor, not concurrency. Optimize for never failing, not speed.
  const perChunk: Array<NonNullable<ParsedClaudeResponse["transactions"]>> = [];
  const headers: ParsedClaudeResponse[] = [];
  for (const chunk of chunks) {
    const r = await callClaudeExtraction(client, chunk, "text/plain", filename);
    headers.push(r);
    perChunk.push(r.transactions ?? []);
  }

  let merged = assembleMerged(perChunk, headers);
  const rec = reconcileParsed(merged);

  // Targeted retry: a broken balance points at the region that dropped (or
  // misread) a transaction. Map each suspect tx back to its chunk via cumulative
  // offsets, plus the chunk immediately before it (a missing tx makes the NEXT
  // balance look wrong, so the gap often sits at the boundary). Re-extract only
  // those chunks — ~2.5K output each, not the whole document. "partial" only if
  // it still doesn't reconcile after this.
  if (!rec.ok && rec.suspectIndices.length > 0) {
    const affected = new Set<number>();
    for (const idx of rec.suspectIndices) {
      if (idx < 0) continue; // sentinel from the totals strategy — not a tx index
      let acc = 0;
      for (let ci = 0; ci < perChunk.length; ci++) {
        if (idx < acc + perChunk[ci].length) {
          affected.add(ci);
          if (ci > 0) affected.add(ci - 1);
          break;
        }
        acc += perChunk[ci].length;
      }
    }
    for (const ci of affected) {
      const r = await callClaudeExtraction(client, chunks[ci], "text/plain", filename);
      headers[ci] = r;
      perChunk[ci] = r.transactions ?? [];
    }
    merged = assembleMerged(perChunk, headers);
  }

  return merged;
}

async function alertJobFailure(
  resendKey: string,
  msg: string,
  jobId: string,
  workspaceId: string
): Promise<void> {
  try {
    const resend = new Resend(resendKey);
    const now = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
    await resend.emails.send({
      from: "Salvô! <salvo@jpmendes.com>",
      to: ["salvo@jpmendes.com"],
      subject: "[Salvô! 🚨] Falha no job de importação",
      html: `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"></head>
<body style="font-family:monospace;background:#09090b;color:#e0e0e0;padding:32px;max-width:560px;margin:0 auto">
  <p style="color:#ff5c5c;font-weight:700;margin:0 0 20px">[SALVÔ!] FALHA NO JOB DE IMPORTAÇÃO</p>
  <table style="font-size:13px;line-height:2;border-collapse:collapse">
    <tr><td style="color:#999;padding-right:16px">Job ID:</td><td>${jobId}</td></tr>
    <tr><td style="color:#999;padding-right:16px">Workspace:</td><td>${workspaceId}</td></tr>
    <tr><td style="color:#999;padding-right:16px">Data:</td><td>${now}</td></tr>
  </table>
  <pre style="font-size:11px;color:#ccc;background:#111;padding:12px;border-radius:6px;margin-top:16px;white-space:pre-wrap">${msg.slice(0, 600)}</pre>
</body></html>`,
    });
  } catch { /* alert must never crash the pipeline */ }
}

export const parseBankStatement = onRequest(
  {
    cors: true,
    secrets: ["ANTHROPIC_API_KEY"],
    maxInstances: 10,
    timeoutSeconds: 120,
    memory: "512MiB"
  },
  async (req, res) => {
    if (req.method === "OPTIONS") {
      res.set("Access-Control-Allow-Origin", "*");
      res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
      res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
      res.status(204).send("");
      return;
    }

    if (req.method !== "POST") {
      res.status(405).json({ error: "Method Not Allowed" });
      return;
    }

    const { fileData, mimeType, textData, filename } = req.body as {
      fileData?: string;
      mimeType?: string;
      textData?: string;
      filename?: string;
    };

    if ((!fileData && !textData) || !mimeType) {
      res.status(400).json({ error: "Missing fileData/textData or mimeType" });
      return;
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      res.status(500).json({ error: "ANTHROPIC_API_KEY not configured" });
      return;
    }

    const isText = mimeType === "text/plain" || mimeType === "text/csv";
    const data = isText ? (textData || "") : (fileData || "");

    try {
      const client = new Anthropic({ apiKey, maxRetries: 6 });
      const parsed = await callClaudeExtraction(client, data, mimeType, filename);

      const sourceLabel = parsed.sourceLabel ?? "Extrato";
      const transactions = (parsed.transactions ?? []).map((t) => ({
        ...t,
        amount: Math.abs(t.amount ?? 0),
        monthKey: (t.date ?? "").slice(0, 7),
        dedupKey: `${t.date}|${(t.description ?? "").toLowerCase().trim()}|${Math.abs(t.amount ?? 0).toFixed(2)}`
      }));

      res.set("Access-Control-Allow-Origin", "*");
      res.json({ sourceLabel, transactions });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("Claude API error:", msg);
      res.set("Access-Control-Allow-Origin", "*");
      res.status(500).json({ error: msg });
    }
  }
);

const EVOLUTION_URL = "http://136.248.106.93:8080";
const EVOLUTION_INSTANCE = "fincheck-pro";

export const sendInviteWhatsApp = onRequest(
  {
    cors: true,
    secrets: ["EVOLUTION_API_KEY"],
    maxInstances: 10,
    timeoutSeconds: 30,
    memory: "256MiB"
  },
  async (req, res) => {
    res.set("Access-Control-Allow-Origin", "*");
    if (req.method === "OPTIONS") {
      res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
      res.set("Access-Control-Allow-Headers", "Content-Type");
      res.status(204).send("");
      return;
    }
    if (req.method !== "POST") { res.status(405).json({ error: "Method Not Allowed" }); return; }

    const { phone, workspaceName, inviteLink, fromName } = req.body as {
      phone?: string; workspaceName?: string; inviteLink?: string; fromName?: string;
    };
    if (!phone || !workspaceName || !inviteLink) {
      res.status(400).json({ error: "Missing required fields: phone, workspaceName, inviteLink" });
      return;
    }

    const apiKey = process.env.EVOLUTION_API_KEY;
    if (!apiKey) { res.status(500).json({ error: "EVOLUTION_API_KEY not configured" }); return; }

    const sender = fromName || "Alguém";
    const message = `${sender} te chamou pro Salvô! 👊\n\nVocês vão acompanhar entradas, gastos e o plano do mês juntos — em tempo real, sem ninguém ter que ficar perguntando "ué, gastou onde isso?".\n\nBora entrar?\n${inviteLink}`;

    try {
      const resp = await fetch(`${EVOLUTION_URL}/message/sendText/${EVOLUTION_INSTANCE}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: apiKey },
        body: JSON.stringify({
          number: phone,
          options: { delay: 500 },
          textMessage: { text: message }
        })
      });
      const data = await resp.json() as { key?: unknown; error?: string };
      if (!resp.ok) throw new Error(JSON.stringify(data));
      res.json({ success: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("sendInviteWhatsApp error:", msg);
      res.status(500).json({ error: msg });
    }
  }
);

export const sendInviteEmail = onRequest(
  {
    cors: true,
    secrets: ["RESEND_API_KEY"],
    maxInstances: 10,
    timeoutSeconds: 30,
    memory: "256MiB",
  },
  async (req, res) => {
    if (req.method === "OPTIONS") {
      res.set("Access-Control-Allow-Origin", "*");
      res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
      res.set("Access-Control-Allow-Headers", "Content-Type");
      res.status(204).send("");
      return;
    }

    if (req.method !== "POST") {
      res.status(405).json({ error: "Method Not Allowed" });
      return;
    }

    const { to, workspaceName, inviteLink, fromName } = req.body as {
      to?: string;
      workspaceName?: string;
      inviteLink?: string;
      fromName?: string;
    };

    if (!to || !workspaceName || !inviteLink) {
      res.status(400).json({ error: "Missing required fields: to, workspaceName, inviteLink" });
      return;
    }

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      res.status(500).json({ error: "RESEND_API_KEY not configured" });
      return;
    }

    const resend = new Resend(apiKey);
    const senderName = fromName || "Alguém";

    try {
      const { data, error } = await resend.emails.send({
        from: `${senderName} via Salvô! <salvo@jpmendes.com>`,
        to: [to],
        subject: `${senderName} quer gerir as finanças com você`,
        html: `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#09090b;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#09090b;padding:40px 20px">
    <tr><td align="center">
      <table width="100%" style="max-width:520px;background:#111214;border-radius:16px;border:1px solid rgba(255,255,255,0.08);overflow:hidden">
        <tr><td style="padding:36px 36px 32px">
          <p style="margin:0 0 8px;font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:rgba(255,255,255,0.28)">SALVÔ!</p>
          <h1 style="margin:0 0 24px;font-size:24px;font-weight:800;color:#fff;line-height:1.3">Oi! 👋</h1>
          <p style="margin:0 0 12px;font-size:15px;color:rgba(255,255,255,0.75);line-height:1.7">
            <strong style="color:#fff">${senderName}</strong> te convidou para acompanhar e gerir as finanças juntos no Salvô!.
          </p>
          <p style="margin:0 0 28px;font-size:15px;color:rgba(255,255,255,0.55);line-height:1.7">
            No painel de vocês dá pra ver em tempo real o que entrou, o que saiu e o que ainda está por vir — sem surpresa no fim do mês.
          </p>
          <a href="${inviteLink}" style="display:inline-block;background:#b8f55a;color:#09090b;font-size:14px;font-weight:800;text-decoration:none;padding:14px 32px;border-radius:10px;letter-spacing:-.01em">👉 Aceitar convite</a>
        </td></tr>
        <tr><td style="padding:18px 36px;border-top:1px solid rgba(255,255,255,0.05)">
          <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.2);line-height:1.7">Este link expira em 7 dias. Se você não esperava este convite, pode ignorar este email com segurança.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
      });

      if (error) {
        console.error("Resend error:", error);
        res.set("Access-Control-Allow-Origin", "*");
        res.status(500).json({ error: error.message });
        return;
      }

      res.set("Access-Control-Allow-Origin", "*");
      res.json({ success: true, id: data?.id });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("sendInviteEmail error:", msg);
      res.set("Access-Control-Allow-Origin", "*");
      res.status(500).json({ error: msg });
    }
  }
);

export const sendVerificationCode = onRequest(
  {
    cors: true,
    secrets: ["EVOLUTION_API_KEY", "RESEND_API_KEY", "VERIFICATION_HMAC_KEY"],
    maxInstances: 10,
    timeoutSeconds: 30,
    memory: "256MiB",
  },
  async (req, res) => {
    res.set("Access-Control-Allow-Origin", "*");
    if (req.method === "OPTIONS") {
      res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
      res.set("Access-Control-Allow-Headers", "Content-Type");
      res.status(204).send("");
      return;
    }
    if (req.method !== "POST") { res.status(405).json({ error: "Method Not Allowed" }); return; }

    const { uid, email, phone, channel } = req.body as {
      uid?: string; email?: string; phone?: string; channel?: "whatsapp" | "email";
    };
    if (!uid || !email || !channel) {
      res.status(400).json({ error: "Missing uid, email or channel" });
      return;
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiry = Date.now() + 10 * 60 * 1000;
    const hmacKey = process.env.VERIFICATION_HMAC_KEY || "";
    const verificationToken = signVerifToken(uid, expiry, code, hmacKey);

    try {
      if (channel === "whatsapp" && phone) {
        const apiKey = process.env.EVOLUTION_API_KEY;
        if (!apiKey) throw new Error("EVOLUTION_API_KEY not configured");
        const resp = await fetch(`${EVOLUTION_URL}/message/sendText/${EVOLUTION_INSTANCE}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: apiKey },
          body: JSON.stringify({
            number: phone,
            options: { delay: 500 },
            textMessage: { text: `Seu código de verificação do Salvô!: *${code}*\n\nEle expira em 10 minutos. Não compartilhe com ninguém.` }
          })
        });
        if (!resp.ok) throw new Error(await resp.text());
      } else {
        const apiKey = process.env.RESEND_API_KEY;
        if (!apiKey) throw new Error("RESEND_API_KEY not configured");
        const resend = new Resend(apiKey);
        const { error } = await resend.emails.send({
          from: "Salvô! <salvo@jpmendes.com>",
          to: [email],
          subject: `${code} é o seu código de verificação`,
          html: `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#09090b;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#09090b;padding:40px 20px">
    <tr><td align="center">
      <table width="100%" style="max-width:480px;background:#111214;border-radius:16px;border:1px solid rgba(255,255,255,0.08);overflow:hidden">
        <tr><td style="padding:36px 36px 32px;text-align:center">
          <p style="margin:0 0 28px;font-size:13px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:rgba(255,255,255,0.28)">SALVÔ!</p>
          <p style="margin:0 0 16px;font-size:15px;color:rgba(255,255,255,0.6);line-height:1.6">Seu código de verificação</p>
          <div style="background:rgba(184,245,90,0.08);border:1px solid rgba(184,245,90,0.2);border-radius:12px;padding:24px;margin:0 0 24px;display:inline-block">
            <span style="font-size:36px;font-weight:800;letter-spacing:0.25em;color:#b8f55a;font-family:'Courier New',monospace">${code}</span>
          </div>
          <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.35);line-height:1.6">Expira em 10 minutos. Não compartilhe com ninguém.</p>
        </td></tr>
        <tr><td style="padding:16px 36px;border-top:1px solid rgba(255,255,255,0.05)">
          <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.2)">Se você não solicitou este código, ignore este email.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
        });
        if (error) throw new Error(error.message);
      }
      res.json({ success: true, verificationToken });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("sendVerificationCode error:", msg);
      res.status(500).json({ error: msg });
    }
  }
);

export const verifyCode = onRequest(
  {
    cors: true,
    secrets: ["VERIFICATION_HMAC_KEY"],
    maxInstances: 10,
    timeoutSeconds: 30,
    memory: "256MiB"
  },
  async (req, res) => {
    res.set("Access-Control-Allow-Origin", "*");
    if (req.method === "OPTIONS") {
      res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
      res.set("Access-Control-Allow-Headers", "Content-Type");
      res.status(204).send("");
      return;
    }
    if (req.method !== "POST") { res.status(405).json({ error: "Method Not Allowed" }); return; }

    const { uid, code, token } = req.body as { uid?: string; code?: string; token?: string };
    if (!uid || !code || !token) { res.status(400).json({ error: "Missing uid, code or token" }); return; }

    const hmacKey = process.env.VERIFICATION_HMAC_KEY || "";
    const valid = checkVerifToken(token, uid, code, hmacKey);
    if (!valid) { res.status(400).json({ error: "Código inválido ou expirado" }); return; }

    res.json({ success: true });
  }
);

// Links a Google account to existing workspace memberships found by email.
// Runs server-side with Admin SDK to bypass Firestore rules — no memberEmails needed.
export const relinkGoogleAccount = onCall(
  { maxInstances: 10 },
  async (request) => {
    const uid = request.auth?.uid;
    const email = request.auth?.token.email as string | undefined;

    if (!uid || !email) {
      throw new Error("Unauthenticated");
    }

    const db = admin.firestore();
    const FieldValue = admin.firestore.FieldValue;

    // Find all active member docs with this email (may belong to a different uid)
    const membersSnap = await db
      .collectionGroup("members")
      .where("email", "==", email)
      .where("status", "==", "active")
      .get();

    if (membersSnap.empty) {
      return { linked: false, workspaceIds: [] };
    }

    const batch = db.batch();
    const workspaceIds: string[] = [];

    for (const mDoc of membersSnap.docs) {
      const wsId = mDoc.ref.parent.parent!.id;
      const md = mDoc.data();
      workspaceIds.push(wsId);

      if (mDoc.id === uid) continue; // already linked to this uid

      // Create member doc under the Google uid
      const newMemberRef = db.doc(`workspaces/${wsId}/members/${uid}`);
      batch.set(newMemberRef, {
        uid,
        role: md.role,
        status: "active",
        displayName: md.displayName || email.split("@")[0],
        email,
        ...(md.inviteId ? { inviteId: md.inviteId } : {}),
        createdBy: md.createdBy ?? uid,
        joinedAt: FieldValue.serverTimestamp()
      });

      // Keep memberEmails in sync
      batch.update(db.doc(`workspaces/${wsId}`), {
        memberEmails: FieldValue.arrayUnion(email)
      });
    }

    // Update (or create) the user doc
    const userRef = db.doc(`users/${uid}`);
    const userSnap = await userRef.get();
    const uniqueIds = [...new Set(workspaceIds)];

    if (userSnap.exists) {
      batch.update(userRef, {
        workspaceIds: uniqueIds,
        accountVerified: true,
        updatedAt: FieldValue.serverTimestamp()
      });
    } else {
      batch.set(userRef, {
        uid,
        email,
        displayName: request.auth?.token.name || email.split("@")[0],
        accountVerified: true,
        workspaceIds: uniqueIds,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      });
    }

    await batch.commit();
    return { linked: true, workspaceIds: uniqueIds };
  }
);

// ─── generateDiagnosis ────────────────────────────────────────────────────────

async function getSalarioMinimo(): Promise<number | null> {
  try {
    const res = await fetch(
      "https://servicodados.ibge.gov.br/api/v1/pesquisas/indicadores/1619/resultados"
    );
    const data = await res.json();
    const serie = data[0]?.series?.[0]?.serie;
    if (!serie) return null;
    const valores = Object.values(serie) as string[];
    const ultimo = valores[valores.length - 1];
    return ultimo ? parseFloat(ultimo) : null;
  } catch {
    return null;
  }
}

export const generateDiagnosis = onRequest(
  {
    cors: true,
    secrets: ["ANTHROPIC_API_KEY"],
    maxInstances: 10,
    timeoutSeconds: 30,
    memory: "256MiB"
  },
  async (req, res) => {
    if (req.method === "OPTIONS") {
      res.set("Access-Control-Allow-Origin", "*");
      res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
      res.set("Access-Control-Allow-Headers", "Content-Type");
      res.status(204).send("");
      return;
    }

    if (req.method !== "POST") {
      res.status(405).json({ error: "Method Not Allowed" });
      return;
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      res.status(500).json({ error: "ANTHROPIC_API_KEY not configured" });
      return;
    }

    const {
      totalGasto,
      totalEntradas,
      comprometimento,
      net,
      score,
      topCat,
      expenseChange,
      byCategory,
      monthLabel: month
    } = req.body as {
      totalGasto: number;
      totalEntradas: number;
      comprometimento: number;
      net: number;
      score: number;
      topCat: { nome: string; valor: number; percentual: number } | null;
      expenseChange: number | null;
      byCategory: Array<{ nome: string; valor: number }>;
      monthLabel: string;
    };

    const salarioMinimo = await getSalarioMinimo();

    const fmt = (v: number) =>
      `R$${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    const topCatLine = topCat
      ? `- Maior categoria: ${topCat.nome} — ${fmt(topCat.valor)} (${topCat.percentual}% dos gastos)`
      : "- Maior categoria: nenhuma";

    const expChangeLine =
      expenseChange !== null
        ? `- Variação vs mês anterior: ${expenseChange > 0 ? "+" : ""}${expenseChange}%`
        : "- Variação vs mês anterior: sem dados do mês anterior";

    const byCatLines = byCategory
      .slice(0, 5)
      .map((c) => `  • ${c.nome}: ${fmt(c.valor)}`)
      .join("\n");

    const salarioLine = salarioMinimo !== null
      ? `- Salário mínimo vigente: ${fmt(salarioMinimo)}`
      : "- Salário mínimo vigente: não disponível";

    const prompt = `Você é o Salvô — o conselheiro financeiro honesto que o brasileiro nunca teve.
Fala direto, sem enrolação, sem julgamento moral. Tom popular, neutro em gênero.
Sem vocativos (sem "irmão", "cara", "mano"). Frases curtas e precisas.
Sem termos técnicos: nunca use "otimizar", "alocar", "comprometer renda", "déficit".

Dados financeiros do usuário em ${month}:
- Entradas: ${fmt(totalEntradas)}
- Gastos: ${fmt(totalGasto)}
- Saldo do mês: ${fmt(Math.abs(net))} (${net >= 0 ? "positivo" : "negativo"})
- % da renda gasta: ${comprometimento}%
- Nota calculada: ${score}/10
${topCatLine}
${expChangeLine}
- Top categorias:
${byCatLines}
${salarioLine}

REGRAS CRÍTICAS:
1. Use APENAS os números enviados nos dados. Nunca invente valores.
2. Se salário mínimo estiver disponível, pode usá-lo para dar contexto
   a valores grandes — ex: "isso é X salários mínimos".
   Se não estiver disponível, não mencione salário mínimo em hipótese alguma.
3. Para dar peso a números, prefira proporções dos próprios dados
   — ex: "27% de tudo que saiu", "quase o que você gastou com moradia".
4. Nunca compare com inflação, custo de vida, ou qualquer referência
   externa que não foi fornecida nos dados.

Retorne APENAS um JSON válido, sem markdown, sem explicação:
{
  "narrativa": "2-3 frases. Começa com o resultado do mês, depois o peso disso.",
  "bullet1": "Observação sobre a maior categoria com impacto real.",
  "bullet2": "Observação sobre a variação vs mês anterior com reação proporcional.",
  "scoreLabel": "Label curto baseado na nota: >=8 'Arrasando 💪', >=6 'Dá pra melhorar', <6 'Tá pesado.'"
}

Exemplos de tom:
- "Fechou positivo, mas 85% da renda foi embora. De cada R$100 que entrou, R$85 sumiu."
- "Carro engoliu R$3.527 — 27% de tudo que saiu. São 2,3 salários mínimos só de ferro."
  (esse exemplo só vale se salário mínimo foi fornecido)
- "Gastos explodiram 2333% vs mês passado. O que mudou?"`;

    const client = new Anthropic({ apiKey, maxRetries: 6 });

    try {
      const message = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 512,
        messages: [{ role: "user", content: prompt }]
      });

      const rawText =
        message.content.find((b): b is Anthropic.TextBlock => b.type === "text")?.text ?? "{}";

      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {};

      res.set("Access-Control-Allow-Origin", "*");
      res.json({
        narrativa: parsed.narrativa ?? null,
        bullet1: parsed.bullet1 ?? null,
        bullet2: parsed.bullet2 ?? null,
        scoreLabel: parsed.scoreLabel ?? null
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("generateDiagnosis error:", msg);
      res.status(500).json({ error: msg });
    }
  }
);

// ─── generateCardDiagnosis (callable, cached in Firestore) ────────────────────
// Pocket diagnosis for the CARD lens — separate from the cash-flow diagnosis,
// never touches it. Cached at workspaces/{ws}/cardDiagnoses/{cardId}_{period}
// keyed by a fingerprint of the inputs: regenerates ONLY when a new fatura lands
// or a recategorization changes the numbers (fingerprint changes). A warm cache
// returns with zero AI calls. Month-over-month when a previous fatura exists;
// degrades honestly (no prev fatura → read-only; no limit → skip limit).
export const generateCardDiagnosis = onCall(
  { secrets: ["ANTHROPIC_API_KEY"], maxInstances: 10, timeoutSeconds: 30, memory: "256MiB" },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Faça login pra continuar.");

    const { workspaceId, cardId, period, fingerprint, mode, payload } = (request.data ?? {}) as {
      workspaceId?: string;
      cardId?: string;
      period?: string;
      fingerprint?: string;
      mode?: "single" | "todos";
      payload?: {
        cardLabel: string;
        monthLabel: string;
        prevMonthLabel: string | null;
        totalAtual: number;
        totalAnterior: number | null;
        topCat: { nome: string; valor: number; pct: number } | null;
        limitPct: number | null;
        limitUsado: number | null;
        limitTotal: number | null;
        byCategory: Array<{ nome: string; valor: number }>;
        // Income reference (same base as the home cash-flow diagnosis). When > 0,
        // the diagnosis anchors its tone on % of income; null/<=0 → honest no-
        // income mode (no % of income fabricated).
        renda?: number | null;
        // "todos" mode only:
        vencendoMes?: number | null;
        cardsCount?: number;
      };
    };
    if (!workspaceId || !cardId || !period || !fingerprint || !payload) {
      throw new HttpsError("invalid-argument", "Dados incompletos.");
    }

    const db = admin.firestore();
    const member = await db.doc(`workspaces/${workspaceId}/members/${uid}`).get();
    if (!member.exists || member.data()?.status !== "active") {
      throw new HttpsError("permission-denied", "Você não participa deste workspace.");
    }

    const docRef = db.doc(`workspaces/${workspaceId}/cardDiagnoses/${cardId}_${period}`);

    // Warm cache → return without calling the model (zero cost on screen open).
    const existing = await docRef.get();
    if (existing.exists && existing.data()?.fingerprint === fingerprint) {
      const d = existing.data()!;
      return { headline: d.headline ?? null, insights: d.insights ?? [], cached: true };
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new HttpsError("internal", "Configuração ausente.");

    const fmt = (v: number) =>
      `R$${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    // Income anchor (rendaRef = same base the home cash-flow diagnosis uses).
    // When present, the diagnosis calibrates tone on % of income; when absent,
    // it degrades honestly (no % of income fabricated — Bug 1 rule).
    const renda = payload.renda != null && payload.renda > 0 ? payload.renda : null;
    const pctRenda = (v: number) => Math.round((v / (renda as number)) * 100);

    const variacaoLine =
      payload.totalAnterior != null && payload.totalAnterior > 0
        ? `- Fatura anterior (${payload.prevMonthLabel}): ${fmt(payload.totalAnterior)} (variação ${
            Math.round(((payload.totalAtual - payload.totalAnterior) / payload.totalAnterior) * 100)
          }%)`
        : "- Fatura anterior: sem dados (não compare, é a primeira fatura deste cartão)";
    // Category headline is anchored on INCOME when available — never on the
    // card's own spend ("% da fatura"), which is self-referential.
    const topCatLine = payload.topCat
      ? `- Categoria que mais pesou: ${payload.topCat.nome} — ${fmt(payload.topCat.valor)}${renda ? ` (${pctRenda(payload.topCat.valor)}% da renda)` : ` (${payload.topCat.pct}% da fatura)`}`
      : "- Categoria que mais pesou: sem dados";
    const limitLine =
      payload.limitPct != null
        ? `- Limite: ${payload.limitPct}% comprometido${payload.limitTotal != null ? ` (${fmt(payload.limitUsado ?? 0)} de ${fmt(payload.limitTotal)})` : ""}`
        : "- Limite: sem dados (não mencione limite)";
    const byCatLines = payload.byCategory.slice(0, 5).map((c) => `  • ${c.nome}: ${fmt(c.valor)}`).join("\n");

    const rendaLine = renda
      ? `- Renda de referência do mês: ${fmt(renda)}\n- Total ${mode === "todos" ? "das faturas" : "da fatura"} = ${pctRenda(payload.totalAtual)}% da renda`
      : "- Renda de referência: INDISPONÍVEL — não calcule nem afirme % da renda";
    const rendaRule = renda
      ? `ÂNCORA PRIMÁRIA = o % da RENDA. A headline ancora nisso (ex: "Suas faturas somam R$2.425 — 38% do que entrou no mês"). A categoria principal vai CONTRA A RENDA (ex: "Varejo levou R$891 — 14% da renda"), nunca "% do gasto no cartão". CALIBRE O TOM por esse %: baixo (até ~15%) = tranquilo; médio = atenção leve; alto (acima de ~40%) = pesado/cuidado. Não alarme o que é 5% da renda, nem minimize 60%.`
      : `Sem renda de referência: ancore em VALORES ABSOLUTOS + limite + tendência. NÃO afirme nenhum % da renda.`;

    const voz = `Você é o Salvô — o conselheiro financeiro honesto que o brasileiro nunca teve.
Fala direto, sem enrolação, sem julgamento moral. Tom popular, neutro em gênero.
Sem vocativos (sem "irmão", "cara", "mano"). Frases curtas e precisas.
Sem termos técnicos: nunca use "otimizar", "alocar", "comprometer renda", "déficit".`;

    const formato = `Retorne APENAS um JSON válido, sem markdown:
{
  "headline": "1 frase curta e direta (o resultado principal).",
  "insights": ["1 a 2 observações curtas com impacto real. Cada item é uma frase."]
}`;

    const prompt = mode === "todos"
      ? `${voz}

Este é o diagnóstico do CONJUNTO DE CARTÕES de crédito (${payload.cardsCount ?? "vários"} cartões) — NÃO é o fluxo de caixa do mês.

Dados somados de todos os cartões (competência ${payload.monthLabel}):
- Total da competência (soma das faturas): ${fmt(payload.totalAtual)}
${rendaLine}
${payload.totalAnterior != null && payload.totalAnterior > 0
  ? `- Competência anterior (${payload.prevMonthLabel}): ${fmt(payload.totalAnterior)} (variação ${Math.round(((payload.totalAtual - payload.totalAnterior) / payload.totalAnterior) * 100)}%)`
  : "- Competência anterior: sem dados (não compare)"}
${payload.vencendoMes != null ? `- Vencendo em ${payload.monthLabel}: ${fmt(payload.vencendoMes)}` : ""}
${topCatLine.replace("da fatura", "do conjunto")}
- Categorias somadas dos cartões:
${byCatLines}

REGRAS CRÍTICAS:
1. Use APENAS os números enviados. Nunca invente valores nem variação.
2. ${rendaRule}
3. Se não há competência anterior, NÃO compare — fale só da atual.
4. Não há limite combinado — NÃO mencione limite no conjunto.
5. A renda é só a BASE pra dar peso (denominador). As compras são dos CARTÕES — não trate como fluxo de caixa do mês.

${formato}

Exemplos de tom (com renda):
- headline: "Suas faturas somam R$2.425 — 38% do que entrou no mês."
- insight: "Varejo levou R$891 — 14% da renda."
Exemplos (sem renda):
- headline: "Você tem R$1.240 em aberto nos cartões."
- insight: "Varejo é o que mais pesa: R$390."`
      : `${voz}

Este é o diagnóstico da FATURA DE CARTÃO de crédito (${payload.cardLabel}) — NÃO é o fluxo de caixa do mês.

Dados da fatura de ${payload.monthLabel}:
- Total da fatura: ${fmt(payload.totalAtual)}
${rendaLine}
${variacaoLine}
${topCatLine}
${limitLine}
- Categorias da fatura:
${byCatLines}

REGRAS CRÍTICAS:
1. Use APENAS os números enviados. Nunca invente valores nem variação.
2. ${rendaRule}
3. Se não há fatura anterior, NÃO compare com mês passado — fale só do mês atual.
4. Se não há dado de limite, NÃO mencione limite (quando existe, é âncora secundária).
5. A renda é só a BASE pra dar peso (denominador). As compras são do CARTÃO — não trate como fluxo de caixa do mês.

${formato}

Exemplos de tom (com renda):
- headline: "Sua fatura fechou em R$2.425 — 38% do que entrou no mês."
- insight: "Varejo levou R$891 — 14% da renda."
- insight: "98% do limite comprometido."
Exemplos (sem renda):
- headline: "Fatura subiu 18% vs maio — fechou em R$568."
- insight: "Varejo levou metade: R$274."`;

    const client = new Anthropic({ apiKey, maxRetries: 4 });
    let headline: string | null = null;
    let insights: string[] = [];
    try {
      const message = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 400,
        messages: [{ role: "user", content: prompt }],
      });
      const rawText = message.content.find((b): b is Anthropic.TextBlock => b.type === "text")?.text ?? "{}";
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
      headline = typeof parsed.headline === "string" ? parsed.headline : null;
      insights = Array.isArray(parsed.insights)
        ? parsed.insights.filter((s: unknown): s is string => typeof s === "string").slice(0, 2)
        : [];
    } catch (err) {
      console.error("generateCardDiagnosis error:", err instanceof Error ? err.message : String(err));
      throw new HttpsError("internal", "Não consegui gerar o diagnóstico agora.");
    }

    await docRef.set(
      { fingerprint, headline, insights, period, cardId, updatedAt: admin.firestore.FieldValue.serverTimestamp() },
      { merge: true }
    );
    return { headline, insights, cached: false };
  }
);

// ─── suggestGoal ─────────────────────────────────────────────────────────────

export const suggestGoal = onRequest(
  {
    cors: true,
    secrets: ["ANTHROPIC_API_KEY"],
    maxInstances: 10,
    timeoutSeconds: 30,
    memory: "256MiB"
  },
  async (req, res) => {
    if (req.method === "OPTIONS") {
      res.set("Access-Control-Allow-Origin", "*");
      res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
      res.set("Access-Control-Allow-Headers", "Content-Type");
      res.status(204).send("");
      return;
    }

    if (req.method !== "POST") {
      res.status(405).json({ error: "Method Not Allowed" });
      return;
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      res.status(500).json({ error: "ANTHROPIC_API_KEY not configured" });
      return;
    }

    const { rendaMensal, totalGastoMesAtual, economiaMensalSimulada, categoriaVilao, sobraAtual, mesAtual } = req.body;

    const mes = mesAtual ?? new Date().getMonth() + 1;
    const mesesRestantes = 12 - mes;
    const economia = economiaMensalSimulada ?? 0;
    const economiaAnual = economia * mesesRestantes;
    const comprometimento = rendaMensal > 0 ? Math.round((totalGastoMesAtual / rendaMensal) * 100) : 0;
    const fmt = (v: number) => `R$${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    const prompt = `Você é o Salvô! — conselheiro financeiro honesto do brasileiro comum.
Com base nos dados abaixo, sugere UMA meta financeira concreta, pequena e alcançável para esse usuário.

Dados:
- Renda mensal: ${fmt(rendaMensal ?? 0)}
- Gasto atual: ${fmt(totalGastoMesAtual ?? 0)} (${comprometimento}% da renda)
- Se cortar ${categoriaVilao?.nome ?? "gasto principal"}: economiza ${fmt(economia)}/mês
- Meses restantes no ano: ${mesesRestantes}
- Economia total possível até dezembro: ${fmt(economiaAnual)}
- Sobra atual do mês: ${fmt(sobraAtual ?? 0)}

REGRAS:
1. Sugere apenas UMA meta — a mais impactante e realista
2. A meta deve ser atingível com a economia simulada
3. Prioridade: reserva de emergência > quitar dívida pequena > conquista de vida
4. Se sobrar pouco (< R$300/mês): meta de reserva pequena (R$500-1000)
5. Se sobrar médio (R$300-800/mês): meta de reserva de emergência (1-3 meses de renda)
6. Se sobrar muito (> R$800/mês): meta maior (carro, viagem, entrada apartamento)
7. Tom: direto, popular, neutro em gênero. Sem "otimizar" ou "alocar".
8. Nunca mencione salário mínimo a menos que seja fornecido nos dados.

Retorna APENAS JSON válido:
{
  "titulo": "Nome curto da meta (ex: 'Reserva de emergência')",
  "descricao": "1-2 frases diretas explicando a meta e por que faz sentido agora",
  "valorMeta": 1000,
  "prazoMeses": 5,
  "valorMensal": 200,
  "mensagem": "Frase de impacto do Salvô! sobre essa meta (ex: 'Com R$200 por mês, em 5 meses você tem um colchão real. Ninguém te tira do sério.')"
}`;

    const client = new Anthropic({ apiKey, maxRetries: 6 });
    try {
      const message = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 512,
        messages: [{ role: "user", content: prompt }]
      });

      const rawText =
        message.content.find((b): b is Anthropic.TextBlock => b.type === "text")?.text ?? "{}";
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {};

      res.set("Access-Control-Allow-Origin", "*");
      res.json({
        titulo: parsed.titulo ?? null,
        descricao: parsed.descricao ?? null,
        valorMeta: parsed.valorMeta ?? null,
        prazoMeses: parsed.prazoMeses ?? null,
        valorMensal: parsed.valorMensal ?? null,
        mensagem: parsed.mensagem ?? null
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("suggestGoal error:", msg);
      res.status(500).json({ error: msg });
    }
  }
);

export const requestAccountDeletion = onRequest(
  {
    cors: true,
    secrets: ["RESEND_API_KEY"],
    maxInstances: 10,
    timeoutSeconds: 30,
    memory: "256MiB",
  },
  async (req, res) => {
    res.set("Access-Control-Allow-Origin", "*");
    if (req.method === "OPTIONS") {
      res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
      res.set("Access-Control-Allow-Headers", "Content-Type");
      res.status(204).send("");
      return;
    }
    if (req.method !== "POST") { res.status(405).json({ error: "Method Not Allowed" }); return; }

    const { userId, email, displayName, workspaceId } = req.body as {
      userId?: string; email?: string; displayName?: string; workspaceId?: string;
    };

    if (!userId || !email) {
      res.status(400).json({ error: "Missing userId or email" });
      return;
    }

    try {
      try {
        await admin.firestore().doc(`users/${userId}`).set({
          deletionRequestedAt: admin.firestore.FieldValue.serverTimestamp(),
          status: "deletion_requested",
        }, { merge: true });
      } catch (fsErr) {
        console.error("requestAccountDeletion: firestore write failed (non-fatal):", fsErr);
      }

      const apiKey = process.env.RESEND_API_KEY;
      if (!apiKey) throw new Error("RESEND_API_KEY not configured");
      const resend = new Resend(apiKey);
      const now = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });

      await resend.emails.send({
        from: "Salvô! <salvo@jpmendes.com>",
        to: ["salvo@jpmendes.com"],
        subject: "[Salvô!] Solicitação de exclusão de conta",
        html: `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"></head>
<body style="font-family:monospace;background:#09090b;color:#e0e0e0;padding:32px;max-width:560px;margin:0 auto">
  <p style="font-size:13px;color:#b8f55a;font-weight:700;margin:0 0 20px">[SALVÔ!] SOLICITAÇÃO DE EXCLUSÃO DE CONTA</p>
  <p style="font-size:13px;margin:0 0 8px">Nova solicitação de exclusão de conta recebida.</p>
  <hr style="border:none;border-top:1px solid #333;margin:20px 0"/>
  <table style="font-size:13px;line-height:2;border-collapse:collapse">
    <tr><td style="color:#999;padding-right:16px">Usuário:</td><td>${displayName || "—"}</td></tr>
    <tr><td style="color:#999;padding-right:16px">E-mail:</td><td>${email}</td></tr>
    <tr><td style="color:#999;padding-right:16px">User ID:</td><td>${userId}</td></tr>
    <tr><td style="color:#999;padding-right:16px">Workspace ID:</td><td>${workspaceId || "—"}</td></tr>
    <tr><td style="color:#999;padding-right:16px">Data:</td><td>${now}</td></tr>
  </table>
  <hr style="border:none;border-top:1px solid #333;margin:20px 0"/>
  <p style="font-size:12px;color:#666;line-height:1.7">Para excluir manualmente, acesse o Firebase Console e remova:<br>
  • Authentication &gt; Users &gt; ${userId}<br>
  • Firestore &gt; users/${userId}<br>
  • Firestore &gt; workspaces/${workspaceId || "—"}</p>
</body>
</html>`,
      });

      res.json({ success: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("requestAccountDeletion error:", msg);
      res.status(500).json({ error: msg });
    }
  }
);

export const sendAdminAlert = onRequest(
  {
    cors: true,
    secrets: ["RESEND_API_KEY"],
    maxInstances: 5,
    timeoutSeconds: 15,
    memory: "128MiB",
  },
  async (req, res) => {
    res.set("Access-Control-Allow-Origin", "*");
    if (req.method === "OPTIONS") {
      res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
      res.set("Access-Control-Allow-Headers", "Content-Type");
      res.status(204).send("");
      return;
    }
    if (req.method !== "POST") { res.status(405).json({ error: "Method Not Allowed" }); return; }

    const { errorType, raw, context, requestId } = req.body as {
      errorType?: string;
      raw?: string;
      context?: string;
      requestId?: string;
    };

    if (!errorType || !raw || !context) {
      res.status(400).json({ error: "Missing required fields" });
      return;
    }

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) { res.status(500).json({ error: "RESEND_API_KEY not configured" }); return; }

    const resend = new Resend(apiKey);
    const now = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });

    try {
      await resend.emails.send({
        from: "Salvô! <salvo@jpmendes.com>",
        to: ["salvo@jpmendes.com"],
        subject: `[Salvô! 🚨] Erro operacional — ${context}`,
        html: `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"></head>
<body style="font-family:monospace;background:#09090b;color:#e0e0e0;padding:32px;max-width:560px;margin:0 auto">
  <p style="font-size:13px;color:#ff5c5c;font-weight:700;margin:0 0 20px">[SALVÔ!] ERRO OPERACIONAL</p>
  <hr style="border:none;border-top:1px solid #333;margin:20px 0"/>
  <table style="font-size:13px;line-height:2;border-collapse:collapse">
    <tr><td style="color:#999;padding-right:16px">Tipo:</td><td>${errorType}</td></tr>
    <tr><td style="color:#999;padding-right:16px">Contexto:</td><td>${context}</td></tr>
    <tr><td style="color:#999;padding-right:16px">Request ID:</td><td>${requestId || "—"}</td></tr>
    <tr><td style="color:#999;padding-right:16px">Data:</td><td>${now}</td></tr>
  </table>
  <hr style="border:none;border-top:1px solid #333;margin:20px 0"/>
  <p style="font-size:12px;color:#999;margin:0 0 8px">Erro (truncado):</p>
  <pre style="font-size:11px;color:#ccc;background:#111;padding:12px;border-radius:6px;overflow:auto;white-space:pre-wrap">${raw.slice(0, 600)}</pre>
  <p style="font-size:11px;color:#555;margin:20px 0 0">Nenhum dado pessoal ou financeiro incluído neste alerta.</p>
</body>
</html>`,
      });
      res.json({ success: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("sendAdminAlert error:", msg);
      res.status(500).json({ error: msg });
    }
  }
);

// ─── Credit-card statement (fatura) pipeline ─────────────────────────────────
//
// A fatura is a SEPARATE LENS from the cash-flow account extrato — it never
// touches the account pipeline, the account gate, or the account UI. Faturas
// are small, so a single Claude call extracts the whole document. The gate
// reconciles by TOTALS (SaldoAnterior + Despesas − Pagamentos − Créditos =
// SaldoDestaFatura), not by a balance chain. Doesn't close → failed, honest,
// never partial. Persistence is direct and idempotent (deterministic IDs), so a
// re-import overwrites in place.

// Stable, filesystem/Firestore-safe slug from arbitrary text.
function faturaSlug(s: string): string {
  return s
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
    .slice(0, 40) || "x";
}

// Deterministic card id: bank + last4 (falls back to bank+name when no last4).
function cardIdFor(card: ParsedFatura["card"]): string {
  const bank = faturaSlug(card.bank || "cartao");
  const tail = card.last4 ? faturaSlug(card.last4) : faturaSlug(card.name || "card");
  return `${bank}_${tail}`;
}

// Single-call fatura extraction via Claude. Faturas are small, so the flattened
// statement text goes in one bounded call (works for both upload modes: the
// client's pdfjs text, or server-extracted text from a raw PDF).
async function parseFaturaViaClaude(
  client: Anthropic,
  statementText: string,
  filename: string
): Promise<ParsedFatura | null> {
  await throttleOutput(4000);
  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 8192,
    system: buildFaturaSystemPrompt(),
    messages: [{
      role: "user",
      content: [{
        type: "text",
        text: `Fatura de cartão de crédito (${filename}):\n\n${statementText.slice(0, 120000)}`,
      }],
    }],
  });
  recordOutputTokens(message.usage?.output_tokens ?? 0);
  const raw =
    message.content.find((b): b is Anthropic.TextBlock => b.type === "text")?.text ?? "";
  return parseFaturaJson(raw);
}

// Full fatura job: parse → gate (totals) → categorize purchases → persist
// cards/faturas/transactions(source='card'). Idempotent by deterministic IDs.
async function processFatura(
  client: Anthropic,
  db: admin.firestore.Firestore,
  jobRef: admin.firestore.DocumentReference,
  workspaceId: string,
  statementText: string,
  filename: string,
  uid: string,
  displayName: string,
  resendKey: string | undefined,
  jobId: string
): Promise<void> {
  // 1 ─ Parse (watchdog so a stuck call fails cleanly, never a stuck job).
  let fatura: ParsedFatura | null = null;
  try {
    fatura = await Promise.race([
      parseFaturaViaClaude(client, statementText, filename),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("WATCHDOG_TIMEOUT")), 500_000)
      ),
    ]);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[fatura-job] parse error:", msg);
    await jobRef.update({
      status: "failed",
      type: "fatura", // so the client shows a fatura error, never the account modal
      error: "Não consegui ler essa fatura. Tenta exportar de novo.",
      failedAt: admin.firestore.FieldValue.serverTimestamp(),
    }).catch(() => {});
    if (resendKey) await alertJobFailure(resendKey, `fatura parse: ${msg}`, jobId, workspaceId);
    return;
  }
  if (!fatura || !fatura.card?.bank) {
    await jobRef.update({
      status: "failed",
      type: "fatura",
      error: "Não consegui identificar os dados dessa fatura. Confere se é uma fatura de cartão e envia de novo.",
      failedAt: admin.firestore.FieldValue.serverTimestamp(),
    }).catch(() => {});
    return;
  }

  // 2 ─ THE GATE — reconcile by totals. Doesn't close → failed, never partial.
  const gate = reconcileFatura(fatura.totals);
  if (!gate.ok) {
    console.error(`[fatura-job] BLOCKED by totals: ${gate.reason}`);
    await jobRef.update({
      status: "failed",
      type: "fatura",
      error: "Não consegui bater os totais dessa fatura. Pra não importar nada errado, parei aqui — confere se o PDF tá completo e tenta de novo.",
      failedAt: admin.firestore.FieldValue.serverTimestamp(),
    }).catch(() => {});
    if (resendKey) {
      await alertJobFailure(resendKey, `Fatura blocked: ${gate.reason}. bank=${fatura.card.bank}`, jobId, workspaceId);
    }
    return;
  }

  // 3 ─ Identity & period.
  const cardId = cardIdFor(fatura.card);
  const period =
    fatura.period ??
    (fatura.vencimento ? fatura.vencimento.slice(0, 7) : new Date().toISOString().slice(0, 7));
  const faturaId = `${cardId}_${period}`;
  const cardLabel = fatura.card.name || fatura.card.bank;

  // 4 ─ Categorize purchases only (same cascade as the account pipeline;
  // source='card'). Payments/credits are statement totals, not purchases.
  const compras = fatura.lancamentos.filter((l) => l.kind === "compra" && l.amount > 0);
  let codes: (string | null)[] = new Array(compras.length).fill(null);
  try {
    codes = await categorizeCascade(client, db, compras.map((c) => c.description));
  } catch (catErr) {
    console.error("[fatura-job] categorization failed (non-blocking):", catErr instanceof Error ? catErr.message : String(catErr));
  }

  // 5 ─ Persist (one batch, idempotent by deterministic IDs).
  const now = admin.firestore.FieldValue.serverTimestamp();
  const batch = db.batch();

  const cardDoc: Record<string, unknown> = {
    id: cardId,
    bank: fatura.card.bank,
    name: cardLabel,
    createdBy: uid,
    createdByName: displayName,
    updatedAt: now,
    createdAt: now,
  };
  if (fatura.card.last4 != null) cardDoc.last4 = fatura.card.last4;
  if (fatura.card.limitTotal != null) cardDoc.limitTotal = fatura.card.limitTotal;
  if (fatura.card.limitUsado != null) cardDoc.limitUsado = fatura.card.limitUsado;
  if (fatura.card.limitDisponivel != null) cardDoc.limitDisponivel = fatura.card.limitDisponivel;
  if (fatura.card.closingDay != null) cardDoc.closingDay = fatura.card.closingDay;
  if (fatura.card.dueDay != null) cardDoc.dueDay = fatura.card.dueDay;
  batch.set(db.doc(`workspaces/${workspaceId}/cards/${cardId}`), cardDoc, { merge: true });

  const t = fatura.totals;
  batch.set(db.doc(`workspaces/${workspaceId}/faturas/${faturaId}`), {
    id: faturaId,
    cardId,
    period,
    saldoAnterior: t.saldoAnterior ?? 0,
    totalDespesas: t.totalDespesas ?? 0,
    totalPagamentos: t.totalPagamentos ?? 0,
    totalCreditos: t.totalCreditos ?? 0,
    totalAPagar: t.totalAPagar ?? 0,
    ...(fatura.vencimento ? { vencimento: fatura.vencimento } : {}),
    ...(fatura.historico?.length ? { historico: fatura.historico } : {}),
    updatedAt: now,
    createdAt: now,
  }, { merge: true });

  // Purchases → transactions(source='card'). Deterministic id so re-import
  // overwrites the same docs instead of duplicating.
  compras.forEach((c, i) => {
    const dedupKey = `${cardId}|${period}|${c.date}|${c.description.toLowerCase()}|${c.amount.toFixed(2)}|${c.parcela ? `${c.parcela.atual}/${c.parcela.total}` : ""}`;
    const txId = `card_${crypto.createHash("sha1").update(dedupKey).digest("hex").slice(0, 24)}`;
    const tx: Record<string, unknown> = {
      id: txId,
      type: "expense",
      description: c.description,
      amount: c.amount,
      category: codes[i] ?? "outros",
      date: c.date,
      monthKey: (c.date ?? "").slice(0, 7),
      source: "card",
      cardId,
      faturaPeriod: period,
      sourceLabel: cardLabel,
      createdBy: uid,
      createdByName: displayName,
      updatedAt: now,
      createdAt: now,
    };
    if (c.parcela) tx.parcela = c.parcela;
    batch.set(db.doc(`workspaces/${workspaceId}/transactions/${txId}`), tx, { merge: true });
  });

  await batch.commit();

  // 6 ─ Done. Job doc carries a small summary for the client toast/redirect.
  await jobRef.update({
    status: "done",
    // Discriminator the client branches on at completion: a fatura must route
    // to the card lens, never to the account "Revisar importação" modal.
    type: "fatura",
    cardId,
    cardLabel,
    period,
    comprasCount: compras.length,
    totalDespesas: t.totalDespesas ?? 0,
    totalAPagar: t.totalAPagar ?? 0,
    processedAt: now,
  }).catch(() => {});
  console.log(`[fatura-job] done: card=${cardId} period=${period} compras=${compras.length}`);
}

// ─── Background import job (Storage trigger) ─────────────────────────────────
//
// Triggered when a file lands at imports/{workspaceId}/{jobId}/{filename}.
// The client uploads either:
//   text.txt  — pdfjs already extracted the text client-side
//   raw.pdf   — pdfjs failed (e.g. mobile OOM); Claude reads the PDF directly
//
// Single-call pipeline (no double API spend):
//   1. Idempotency check — skip if job is already done/failed
//   2. Download file; LGPD delete immediately after reading
//   3. ONE Claude Sonnet call: extraction + category + classification + balance
//   4. Server-side reconciliation (balance-column or totals strategy)
//   5. Server-side IGNORAR override (KEEP IN SYNC with classify.ts)
//   6. Write results; partial if reconciliation fails; failed on errors
//   On any error: mark status=failed, send alert email, do NOT loop/retry.

export const processImportJob = onObjectFinalized(
  {
    secrets: ["ANTHROPIC_API_KEY", "RESEND_API_KEY"],
    timeoutSeconds: 540,
    memory: "1GiB",
  },
  async (event) => {
    const objectPath = event.data.name;

    // Only process files uploaded under imports/
    if (!objectPath.startsWith("imports/")) return;

    const parts = objectPath.split("/");
    if (parts.length < 4) return;

    const workspaceId = parts[1];
    const jobId = parts[2];
    const filename = parts.slice(3).join("/");
    const originalFilename =
      (event.data.metadata as Record<string, string> | undefined)?.originalFilename ?? filename;

    const db = admin.firestore();
    const jobRef = db.doc(`workspaces/${workspaceId}/importJobs/${jobId}`);
    const bucket = admin.storage().bucket(event.data.bucket);

    // ── Idempotency: skip if already processed ────────────────────────────
    const jobSnap = await jobRef.get();
    if (!jobSnap.exists) {
      await bucket.file(objectPath).delete().catch(() => {});
      return;
    }
    const jobData = jobSnap.data()!;
    if (jobData.status !== "processing") {
      await bucket.file(objectPath).delete().catch(() => {});
      return;
    }

    // ── Download ──────────────────────────────────────────────────────────
    let fileBuffer: Buffer;
    try {
      [fileBuffer] = await bucket.file(objectPath).download();
    } catch (err) {
      console.error("[import-job] download error:", err);
      await jobRef.update({
        status: "failed",
        error: "Não consegui ler o arquivo enviado.",
        failedAt: admin.firestore.FieldValue.serverTimestamp(),
      }).catch(() => {});
      return;
    }

    // ── LGPD: delete from Storage immediately after reading ───────────────
    await bucket.file(objectPath).delete().catch(console.error);

    const apiKey = process.env.ANTHROPIC_API_KEY;
    const resendKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      await jobRef.update({
        status: "failed",
        error: "Configuração interna ausente.",
        failedAt: admin.firestore.FieldValue.serverTimestamp(),
      }).catch(() => {});
      return;
    }

    const client = new Anthropic({ apiKey, maxRetries: 6 });

    // ── Fatura detour ───────────────────────────────────────────────────────
    // Detect a credit-card statement (fatura) BEFORE the account pipeline and
    // route it to its own pipeline (separate lens, separate gate, direct
    // persistence). Detection is text-based: the client's pdfjs text, or text
    // extracted server-side from a raw PDF. If it's not a fatura, fall through
    // untouched to the account extrato pipeline below.
    {
      const isPdf = filename.endsWith(".pdf");
      let statementText = "";
      if (isPdf) {
        statementText = await extractPdfTextServer(fileBuffer).catch(() => "");
      } else {
        statementText = fileBuffer.toString("utf-8");
      }
      if (statementText && isCreditCardStatement(statementText)) {
        console.log("[import-job] detected fatura → card pipeline");
        const uid = (jobData.uid as string) || "";
        const displayName = (jobData.createdByName as string) || "Alguém";
        await processFatura(
          client, db, jobRef, workspaceId, statementText,
          originalFilename, uid, displayName, resendKey, jobId
        );
        return;
      }
    }

    // ── Extraction ────────────────────────────────────────────────────────
    // Text path (pdfjs extracted client-side, common case): chunked parallel
    // extraction — scales to any size and stays well under the 300s timeout.
    // Raw PDF path (pdfjs failed, e.g. mobile OOM, rare): can't be chunked
    // (binary), so a single call with a high token budget is the safety net.
    // Extraction wrapped in a watchdog: if it runs too long (a stuck Claude
    // fallback on a huge statement), fail cleanly BEFORE the platform's hard
    // kill at 540s. A platform kill would leave the job "processing" forever;
    // the watchdog guarantees timeout → status=failed, never a stuck/partial job.
    const WATCHDOG_MS = 500_000; // 500s, safely under the 540s function timeout
    const doExtraction = async (): Promise<ParsedClaudeResponse> => {
      const isPdfFile = filename.endsWith(".pdf");
      if (isPdfFile) {
        // Geometric Mercado Pago adapter first (zero API cost, correct 2D
        // description layout). Accept ONLY if it passes the reconciliation gate;
        // otherwise fall through to Claude. Logs are data-free: which path ran.
        let geometric: ParsedClaudeResponse | null = null;
        try {
          geometric = await tryMercadoPagoGeometric(fileBuffer);
        } catch (pdfErr) {
          const m = pdfErr instanceof Error ? pdfErr.message : String(pdfErr);
          throw new Error(/password/i.test(m) ? "PDF_PASSWORD" : "PDF_UNREADABLE");
        }
        if (geometric) {
          const rec = reconcileParsed(geometric);
          console.log(
            `[import-job] deterministic adapter: ${geometric.transactions?.length ?? 0} txs, ` +
            `reconcile=${rec.ok ? "OK" : `FAIL(${rec.reason})`}`
          );
          if (rec.ok) return geometric;
        }

        // Fallback: flatten to text and let Claude extract it.
        console.log("[import-job] falling back to Claude chunked extraction");
        const pdfText = await extractPdfTextServer(fileBuffer);
        if (pdfText.trim().length > 100) {
          return extractTextInChunks(client, pdfText, originalFilename);
        }
        // No text layer (scanned/image-only PDF) → Claude reads the raw PDF.
        return callClaudeExtraction(
          client,
          fileBuffer.toString("base64"),
          "application/pdf",
          originalFilename,
          32000
        );
      }
      return extractTextInChunks(client, fileBuffer.toString("utf-8"), originalFilename);
    };

    let parsed: ParsedClaudeResponse;
    try {
      parsed = await Promise.race([
        doExtraction(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("WATCHDOG_TIMEOUT")), WATCHDOG_MS)
        ),
      ]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[import-job] extraction error:", msg);
      let userError = "Não consegui extrair as transações. Tenta de novo.";
      if (msg.includes("WATCHDOG_TIMEOUT"))
        userError = "Esse extrato é grande demais e demorou pra processar. Tenta importar um período menor.";
      else if (msg.includes("PDF_PASSWORD"))
        userError = "Esse PDF tá protegido por senha. Tira a senha e envia de novo.";
      else if (msg.includes("PDF_UNREADABLE"))
        userError = "Não consegui abrir esse PDF. Tenta exportar de novo.";
      await jobRef.update({
        status: "failed",
        error: userError,
        failedAt: admin.firestore.FieldValue.serverTimestamp(),
      }).catch(() => {});
      if (resendKey) await alertJobFailure(resendKey, msg, jobId, workspaceId);
      return;
    }

    const allRawTxs = (parsed.transactions ?? []).filter(
      (t) => t.amount != null && t.date && t.description
    );
    const sourceLabel = parsed.sourceLabel ?? "Importação";
    const bankSlug = /mercado\s*pago/i.test(sourceLabel) ? "mercado-pago" : "generic";

    if (allRawTxs.length === 0) {
      await jobRef.update({
        status: "failed",
        error: "Não achei transações nesse arquivo. Confere se é o extrato certo e envia de novo.",
        failedAt: admin.firestore.FieldValue.serverTimestamp(),
      }).catch(() => {});
      return;
    }

    // ── Reconciliation (integer centavos) ─────────────────────────────────
    // Runs over ALL raw transactions (incl. future IGNORAR) because the
    // balance column in the document includes internal movements.
    const internalTxs = allRawTxs.map((t) => {
      const signedCents = Math.round(
        (t.type === "income" ? t.amount : -t.amount) * 100
      );
      const balanceCents =
        t.balance !== undefined ? Math.round(t.balance * 100) : undefined;
      return { ...t, signedCents, balanceCents };
    });

    const initialCents =
      parsed.initialBalance !== undefined
        ? Math.round(parsed.initialBalance * 100)
        : undefined;
    const finalCents =
      parsed.finalBalance !== undefined
        ? Math.round(parsed.finalBalance * 100)
        : undefined;

    const reconciliation = reconcileServer(internalTxs, initialCents, finalCents);

    // ── Classification (ENTRADA / SAIDA / IGNORAR) ────────────────────────
    const classified = internalTxs.map((t) =>
      classifyServer(t.description, t.signedCents, bankSlug, t.classification)
    );

    // ── THE GATE ──────────────────────────────────────────────────────────
    // Reconciliation is non-negotiable: extracted data is shown to the user
    // ONLY if the balance chain validated completeness. If it didn't (dropped
    // transaction, Saldo-as-Valor swap, missing balances, partial Claude
    // output), the result is BLOCKED — never surfaced as "X de X / importar".
    // Checked BEFORE building/categorizing, so a blocked import wastes no work.
    if (!reconciliation.ok) {
      console.error(
        `[import-job] BLOCKED by reconciliation: ${reconciliation.reason} ` +
        `(${allRawTxs.length} txs, ${reconciliation.suspectIndices.length} suspect)`
      );
      await jobRef.update({
        status: "failed",
        error: "Não consegui validar todos os lançamentos desse extrato. Pra não importar nada errado, parei aqui — tenta de novo ou fala com a gente.",
        failedAt: admin.firestore.FieldValue.serverTimestamp(),
      }).catch(() => {});
      if (resendKey) {
        await alertJobFailure(
          resendKey,
          `Reconciliation blocked: ${reconciliation.reason}. txs=${allRawTxs.length}, suspect=${reconciliation.suspectIndices.length}, source=${sourceLabel}`,
          jobId,
          workspaceId
        );
      }
      return;
    }

    // ── Build saved transactions (exclude IGNORAR) ────────────────────────
    const VALID_CATS = new Set<string>(IMPORT_CATEGORIES);
    const transactions = internalTxs
      .filter((_, i) => classified[i] !== "IGNORAR")
      .filter((t) => Math.abs(t.amount) > 0)
      .map((t) => {
        const amount = Math.abs(t.amount);
        const desc = t.description.trim();
        return {
          date: t.date,
          description: desc,
          amount,
          type: t.type,
          // Provisional category: a valid one from the Claude extraction path,
          // otherwise null — filled in by the category pass below.
          category: (t.category && VALID_CATS.has(t.category) ? t.category : null) as string | null,
          sourceLabel,
          source: /cartão|fatura|card/i.test(sourceLabel) ? "card" : "account",
          monthKey: (t.date ?? "").slice(0, 7),
          dedupKey: `${t.date}|${desc.toLowerCase()}|${amount.toFixed(2)}`,
        };
      });

    // ── Category enrichment — deterministic-first cascade, NON-BLOCKING ────
    // Runs after the gate: direction rule → merchant seed → Firestore cache →
    // Claude on the residue (cached for next time). Claude is reached only for
    // merchants no free layer resolved. On any failure the category stays null
    // and the client's rule-based categorizer fills it in. A reconciled import
    // is NEVER failed because of categorization.
    try {
      const codes = await categorizeCascade(client, db, transactions.map((t) => t.description));
      transactions.forEach((t, i) => { t.category = codes[i] ?? t.category; });
    } catch (catErr) {
      console.error("[import-job] categorization failed (non-blocking):", catErr instanceof Error ? catErr.message : String(catErr));
    }

    const ignoredCount = classified.filter((c) => c === "IGNORAR").length;
    await jobRef.update({
      transactions,
      sourceLabel,
      ignoredCount,
      processedAt: admin.firestore.FieldValue.serverTimestamp(),
      status: "done",
    });
  }
);

// ─── Client-side error beacon ─────────────────────────────────────────────────
// Receives operational errors that die on the device (Storage upload failure,
// importJob creation failure, etc.) and forwards them as admin alerts.
// Rate-limiting is handled client-side; this endpoint trusts the client to not spam.
export const clientError = onRequest(
  {
    cors: true,
    secrets: ["RESEND_API_KEY"],
    maxInstances: 5,
    timeoutSeconds: 15,
    memory: "128MiB",
  },
  async (req, res) => {
    res.set("Access-Control-Allow-Origin", "*");
    if (req.method === "OPTIONS") {
      res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
      res.set("Access-Control-Allow-Headers", "Content-Type");
      res.status(204).send("");
      return;
    }
    if (req.method !== "POST") { res.status(405).json({ error: "Method Not Allowed" }); return; }

    const { context, message, uid } = req.body as {
      context?: string;
      message?: string;
      uid?: string;
    };

    if (!context || !message) {
      res.status(400).json({ error: "Missing context or message" });
      return;
    }

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) { res.json({ ok: false }); return; }

    const resend = new Resend(apiKey);
    const now = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });

    try {
      await resend.emails.send({
        from: "Salvô! <salvo@jpmendes.com>",
        to: ["salvo@jpmendes.com"],
        subject: `[Salvô! 🚨] Erro cliente — ${context}`,
        html: `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"></head>
<body style="font-family:monospace;background:#09090b;color:#e0e0e0;padding:32px;max-width:560px;margin:0 auto">
  <p style="color:#ff5c5c;font-weight:700;margin:0 0 20px">[SALVÔ!] ERRO CLIENTE</p>
  <table style="font-size:13px;line-height:2;border-collapse:collapse">
    <tr><td style="color:#999;padding-right:16px">Contexto:</td><td>${context}</td></tr>
    <tr><td style="color:#999;padding-right:16px">UID:</td><td>${uid || "—"}</td></tr>
    <tr><td style="color:#999;padding-right:16px">Data:</td><td>${now}</td></tr>
  </table>
  <pre style="font-size:11px;color:#ccc;background:#111;padding:12px;border-radius:6px;margin-top:16px;white-space:pre-wrap">${message.slice(0, 600)}</pre>
</body></html>`,
      });
      res.json({ ok: true });
    } catch {
      res.json({ ok: false });
    }
  }
);
