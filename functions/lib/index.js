"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.clientError = exports.processImportJob = exports.sendAdminAlert = exports.requestAccountDeletion = exports.suggestGoal = exports.generateDiagnosis = exports.relinkGoogleAccount = exports.verifyCode = exports.sendVerificationCode = exports.sendInviteEmail = exports.sendInviteWhatsApp = exports.parseBankStatement = void 0;
const https_1 = require("firebase-functions/v2/https");
const storage_1 = require("firebase-functions/v2/storage");
const sdk_1 = __importDefault(require("@anthropic-ai/sdk"));
const resend_1 = require("resend");
const crypto_1 = __importDefault(require("crypto"));
const admin = __importStar(require("firebase-admin"));
admin.initializeApp();
// ─── HMAC helpers for stateless verification (no Firestore needed) ────────────
function signVerifToken(uid, expiry, code, secret) {
    const payload = Buffer.from(`${uid}|${expiry}`).toString("base64url");
    const mac = crypto_1.default.createHmac("sha256", secret).update(`${payload}|${code}`).digest("hex");
    return `${payload}.${mac}`;
}
function checkVerifToken(token, uid, enteredCode, secret) {
    try {
        const [payload, mac] = token.split(".");
        const decoded = Buffer.from(payload, "base64url").toString();
        const [storedUid, expiryStr] = decoded.split("|");
        if (storedUid !== uid)
            return false;
        if (Date.now() > parseInt(expiryStr))
            return false;
        const expected = crypto_1.default.createHmac("sha256", secret).update(`${payload}|${enteredCode}`).digest("hex");
        return crypto_1.default.timingSafeEqual(Buffer.from(mac, "hex"), Buffer.from(expected, "hex"));
    }
    catch {
        return false;
    }
}
function buildSystemPrompt() {
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
function extractJsonObject(rawText) {
    const start = rawText.indexOf("{");
    const end = rawText.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start)
        return null;
    return rawText.slice(start, end + 1);
}
async function parseOrRepairJson(client, rawText) {
    const jsonText = extractJsonObject(rawText);
    if (!jsonText) {
        throw new Error("No JSON in Claude response");
    }
    try {
        return JSON.parse(jsonText);
    }
    catch (err) {
        const repair = await client.messages.create({
            model: "claude-sonnet-4-6",
            max_tokens: 8192,
            system: "Você corrige JSON financeiro. Retorne somente um JSON válido no formato {\"sourceLabel\":\"string\",\"initialBalance\":number|null,\"finalBalance\":number|null,\"transactions\":[{\"date\":\"YYYY-MM-DD\",\"description\":\"string\",\"amount\":number,\"type\":\"income\"|\"expense\",\"category\":\"string\",\"classification\":\"ENTRADA\"|\"SAIDA\"|\"IGNORAR\",\"balance\":number|null}]}. Não invente transações.",
            messages: [
                {
                    role: "user",
                    content: [
                        {
                            type: "text",
                            text: `Corrija este JSON inválido preservando os dados existentes. Erro original: ${err instanceof Error ? err.message : String(err)}\n\n${jsonText}`
                        }
                    ]
                }
            ]
        });
        const repairedText = repair.content.find((b) => b.type === "text")?.text ?? "{}";
        const repairedJson = extractJsonObject(repairedText);
        if (!repairedJson) {
            throw new Error("No JSON in repaired Claude response");
        }
        return JSON.parse(repairedJson);
    }
}
// ─── Import job helpers ──────────────────────────────────────────────────────
const IMPORT_CATEGORIES = [
    "Alimentacao", "Mercado", "Transporte", "Carro", "CartaoCredito",
    "Assinaturas", "Saude", "Varejo", "Educacao", "Moradia", "Contas",
    "Seguros", "Taxas", "Emprestimos", "Doacoes", "Transferencias",
    "Hospedagem", "Viagem", "Lazer", "Recebimentos", "Outros",
];
// Shared extraction helper — avoids duplicating Claude call logic between
// parseBankStatement (sync HTTP) and processImportJob (async Storage trigger).
async function callClaudeExtraction(client, data, mimeType, filename, maxTokens = 8192) {
    const isImage = mimeType.startsWith("image/") &&
        ["image/jpeg", "image/png", "image/gif", "image/webp"].includes(mimeType);
    const isPDF = mimeType === "application/pdf";
    const isText = mimeType === "text/plain" || mimeType === "text/csv";
    if (!isImage && !isPDF && !isText) {
        throw new Error("Unsupported mimeType: " + mimeType);
    }
    let content;
    if (isText) {
        content = [
            {
                type: "text",
                text: `Arquivo: ${filename || "extrato.txt"}\n\nExtraia todas as transações financeiras deste extrato/fatura bancária. O conteúdo pode ser texto de PDF, CSV ou OFX — adapte a leitura ao formato encontrado:\n\n${data.slice(0, 120000)}`
            }
        ];
    }
    else if (isImage) {
        content = [
            {
                type: "image",
                source: { type: "base64", media_type: mimeType, data }
            },
            { type: "text", text: "Extraia todas as transações financeiras desta imagem de extrato bancário." }
        ];
    }
    else {
        content = [
            {
                type: "document",
                source: { type: "base64", media_type: "application/pdf", data }
            },
            { type: "text", text: "Extraia todas as transações financeiras deste extrato bancário em PDF." }
        ];
    }
    const message = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: maxTokens,
        system: buildSystemPrompt(),
        messages: [{ role: "user", content }]
    });
    const rawText = message.content.find((b) => b.type === "text")?.text ?? "{}";
    return parseOrRepairJson(client, rawText);
}
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
function looksLikeTxStart(line) {
    const l = line.trim();
    return (/^\d{1,2}[/-]\d{1,2}([/-]\d{2,4})?(\s|$)/.test(l) ||
        /^\d{1,2}\s+[A-Za-zÀ-ÿ]{3,4}\b/.test(l));
}
// Partition text lines into chunks of ~BATCH_TX_COUNT transactions each.
// The header prefix (lines before the first tx) rides with chunk 0; the footer
// (lines after the last tx, e.g. "Saldo final") rides with the last chunk.
function splitTextIntoChunks(text) {
    const lines = text.split("\n");
    const startIdx = [];
    for (let i = 0; i < lines.length; i++) {
        if (looksLikeTxStart(lines[i]))
            startIdx.push(i);
    }
    // Not enough structure to chunk safely → single chunk
    if (startIdx.length <= CHUNK_THRESHOLD)
        return [text];
    const chunks = [];
    for (let g = 0; g < startIdx.length; g += BATCH_TX_COUNT) {
        // First group starts at line 0 to keep the document header.
        const from = g === 0 ? 0 : startIdx[g];
        const nextGroup = g + BATCH_TX_COUNT;
        // Last group runs to the end of the document to keep the footer/summary.
        const to = nextGroup < startIdx.length ? startIdx[nextGroup] : lines.length;
        chunks.push(lines.slice(from, to).join("\n"));
    }
    return chunks;
}
async function extractTextInChunks(client, text, filename) {
    const chunks = splitTextIntoChunks(text);
    // Small statement → one call (default token budget is plenty).
    if (chunks.length === 1) {
        return callClaudeExtraction(client, text, "text/plain", filename);
    }
    const results = await Promise.all(chunks.map((chunk) => callClaudeExtraction(client, chunk, "text/plain", filename)));
    // Merge: transactions concatenated in document order. Dedup defensively in
    // case a boundary heuristic ever overlaps (would otherwise double-count and
    // break reconciliation). Only dedup when a balance is present — the running
    // balance is a monotonic total that never legitimately repeats, so a
    // collision there is a true overlap. Without a balance, two identical rows
    // (e.g. two equal coffees on the same day) are kept as distinct.
    const seen = new Set();
    const transactions = [];
    for (const r of results) {
        for (const t of r.transactions ?? []) {
            if (t.balance != null) {
                const key = `${t.date}|${(t.description ?? "").toLowerCase().trim()}|${t.amount}|${t.balance}`;
                if (seen.has(key))
                    continue;
                seen.add(key);
            }
            transactions.push(t);
        }
    }
    // sourceLabel & initialBalance: first non-null (document header is in chunk 0).
    // finalBalance: last non-null (closest to the end of the document).
    const sourceLabel = results.find((r) => r.sourceLabel)?.sourceLabel;
    const initialBalance = results.find((r) => r.initialBalance != null)?.initialBalance;
    const finalBalance = [...results].reverse().find((r) => r.finalBalance != null)?.finalBalance;
    return { sourceLabel, initialBalance, finalBalance, transactions };
}
async function alertJobFailure(resendKey, msg, jobId, workspaceId) {
    try {
        const resend = new resend_1.Resend(resendKey);
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
    }
    catch { /* alert must never crash the pipeline */ }
}
exports.parseBankStatement = (0, https_1.onRequest)({
    cors: true,
    secrets: ["ANTHROPIC_API_KEY"],
    maxInstances: 10,
    timeoutSeconds: 120,
    memory: "512MiB"
}, async (req, res) => {
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
    const { fileData, mimeType, textData, filename } = req.body;
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
        const client = new sdk_1.default({ apiKey });
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
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("Claude API error:", msg);
        res.set("Access-Control-Allow-Origin", "*");
        res.status(500).json({ error: msg });
    }
});
const EVOLUTION_URL = "http://136.248.106.93:8080";
const EVOLUTION_INSTANCE = "fincheck-pro";
exports.sendInviteWhatsApp = (0, https_1.onRequest)({
    cors: true,
    secrets: ["EVOLUTION_API_KEY"],
    maxInstances: 10,
    timeoutSeconds: 30,
    memory: "256MiB"
}, async (req, res) => {
    res.set("Access-Control-Allow-Origin", "*");
    if (req.method === "OPTIONS") {
        res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
        res.set("Access-Control-Allow-Headers", "Content-Type");
        res.status(204).send("");
        return;
    }
    if (req.method !== "POST") {
        res.status(405).json({ error: "Method Not Allowed" });
        return;
    }
    const { phone, workspaceName, inviteLink, fromName } = req.body;
    if (!phone || !workspaceName || !inviteLink) {
        res.status(400).json({ error: "Missing required fields: phone, workspaceName, inviteLink" });
        return;
    }
    const apiKey = process.env.EVOLUTION_API_KEY;
    if (!apiKey) {
        res.status(500).json({ error: "EVOLUTION_API_KEY not configured" });
        return;
    }
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
        const data = await resp.json();
        if (!resp.ok)
            throw new Error(JSON.stringify(data));
        res.json({ success: true });
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("sendInviteWhatsApp error:", msg);
        res.status(500).json({ error: msg });
    }
});
exports.sendInviteEmail = (0, https_1.onRequest)({
    cors: true,
    secrets: ["RESEND_API_KEY"],
    maxInstances: 10,
    timeoutSeconds: 30,
    memory: "256MiB",
}, async (req, res) => {
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
    const { to, workspaceName, inviteLink, fromName } = req.body;
    if (!to || !workspaceName || !inviteLink) {
        res.status(400).json({ error: "Missing required fields: to, workspaceName, inviteLink" });
        return;
    }
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
        res.status(500).json({ error: "RESEND_API_KEY not configured" });
        return;
    }
    const resend = new resend_1.Resend(apiKey);
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
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("sendInviteEmail error:", msg);
        res.set("Access-Control-Allow-Origin", "*");
        res.status(500).json({ error: msg });
    }
});
exports.sendVerificationCode = (0, https_1.onRequest)({
    cors: true,
    secrets: ["EVOLUTION_API_KEY", "RESEND_API_KEY", "VERIFICATION_HMAC_KEY"],
    maxInstances: 10,
    timeoutSeconds: 30,
    memory: "256MiB",
}, async (req, res) => {
    res.set("Access-Control-Allow-Origin", "*");
    if (req.method === "OPTIONS") {
        res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
        res.set("Access-Control-Allow-Headers", "Content-Type");
        res.status(204).send("");
        return;
    }
    if (req.method !== "POST") {
        res.status(405).json({ error: "Method Not Allowed" });
        return;
    }
    const { uid, email, phone, channel } = req.body;
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
            if (!apiKey)
                throw new Error("EVOLUTION_API_KEY not configured");
            const resp = await fetch(`${EVOLUTION_URL}/message/sendText/${EVOLUTION_INSTANCE}`, {
                method: "POST",
                headers: { "Content-Type": "application/json", apikey: apiKey },
                body: JSON.stringify({
                    number: phone,
                    options: { delay: 500 },
                    textMessage: { text: `Seu código de verificação do Salvô!: *${code}*\n\nEle expira em 10 minutos. Não compartilhe com ninguém.` }
                })
            });
            if (!resp.ok)
                throw new Error(await resp.text());
        }
        else {
            const apiKey = process.env.RESEND_API_KEY;
            if (!apiKey)
                throw new Error("RESEND_API_KEY not configured");
            const resend = new resend_1.Resend(apiKey);
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
            if (error)
                throw new Error(error.message);
        }
        res.json({ success: true, verificationToken });
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("sendVerificationCode error:", msg);
        res.status(500).json({ error: msg });
    }
});
exports.verifyCode = (0, https_1.onRequest)({
    cors: true,
    secrets: ["VERIFICATION_HMAC_KEY"],
    maxInstances: 10,
    timeoutSeconds: 30,
    memory: "256MiB"
}, async (req, res) => {
    res.set("Access-Control-Allow-Origin", "*");
    if (req.method === "OPTIONS") {
        res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
        res.set("Access-Control-Allow-Headers", "Content-Type");
        res.status(204).send("");
        return;
    }
    if (req.method !== "POST") {
        res.status(405).json({ error: "Method Not Allowed" });
        return;
    }
    const { uid, code, token } = req.body;
    if (!uid || !code || !token) {
        res.status(400).json({ error: "Missing uid, code or token" });
        return;
    }
    const hmacKey = process.env.VERIFICATION_HMAC_KEY || "";
    const valid = checkVerifToken(token, uid, code, hmacKey);
    if (!valid) {
        res.status(400).json({ error: "Código inválido ou expirado" });
        return;
    }
    res.json({ success: true });
});
// Links a Google account to existing workspace memberships found by email.
// Runs server-side with Admin SDK to bypass Firestore rules — no memberEmails needed.
exports.relinkGoogleAccount = (0, https_1.onCall)({ maxInstances: 10 }, async (request) => {
    const uid = request.auth?.uid;
    const email = request.auth?.token.email;
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
    const workspaceIds = [];
    for (const mDoc of membersSnap.docs) {
        const wsId = mDoc.ref.parent.parent.id;
        const md = mDoc.data();
        workspaceIds.push(wsId);
        if (mDoc.id === uid)
            continue; // already linked to this uid
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
    }
    else {
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
});
// ─── generateDiagnosis ────────────────────────────────────────────────────────
async function getSalarioMinimo() {
    try {
        const res = await fetch("https://servicodados.ibge.gov.br/api/v1/pesquisas/indicadores/1619/resultados");
        const data = await res.json();
        const serie = data[0]?.series?.[0]?.serie;
        if (!serie)
            return null;
        const valores = Object.values(serie);
        const ultimo = valores[valores.length - 1];
        return ultimo ? parseFloat(ultimo) : null;
    }
    catch {
        return null;
    }
}
exports.generateDiagnosis = (0, https_1.onRequest)({
    cors: true,
    secrets: ["ANTHROPIC_API_KEY"],
    maxInstances: 10,
    timeoutSeconds: 30,
    memory: "256MiB"
}, async (req, res) => {
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
    const { totalGasto, totalEntradas, comprometimento, net, score, topCat, expenseChange, byCategory, monthLabel: month } = req.body;
    const salarioMinimo = await getSalarioMinimo();
    const fmt = (v) => `R$${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const topCatLine = topCat
        ? `- Maior categoria: ${topCat.nome} — ${fmt(topCat.valor)} (${topCat.percentual}% dos gastos)`
        : "- Maior categoria: nenhuma";
    const expChangeLine = expenseChange !== null
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
    const client = new sdk_1.default({ apiKey });
    try {
        const message = await client.messages.create({
            model: "claude-haiku-4-5-20251001",
            max_tokens: 512,
            messages: [{ role: "user", content: prompt }]
        });
        const rawText = message.content.find((b) => b.type === "text")?.text ?? "{}";
        const jsonMatch = rawText.match(/\{[\s\S]*\}/);
        const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
        res.set("Access-Control-Allow-Origin", "*");
        res.json({
            narrativa: parsed.narrativa ?? null,
            bullet1: parsed.bullet1 ?? null,
            bullet2: parsed.bullet2 ?? null,
            scoreLabel: parsed.scoreLabel ?? null
        });
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("generateDiagnosis error:", msg);
        res.status(500).json({ error: msg });
    }
});
// ─── suggestGoal ─────────────────────────────────────────────────────────────
exports.suggestGoal = (0, https_1.onRequest)({
    cors: true,
    secrets: ["ANTHROPIC_API_KEY"],
    maxInstances: 10,
    timeoutSeconds: 30,
    memory: "256MiB"
}, async (req, res) => {
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
    const fmt = (v) => `R$${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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
    const client = new sdk_1.default({ apiKey });
    try {
        const message = await client.messages.create({
            model: "claude-haiku-4-5-20251001",
            max_tokens: 512,
            messages: [{ role: "user", content: prompt }]
        });
        const rawText = message.content.find((b) => b.type === "text")?.text ?? "{}";
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
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("suggestGoal error:", msg);
        res.status(500).json({ error: msg });
    }
});
exports.requestAccountDeletion = (0, https_1.onRequest)({
    cors: true,
    secrets: ["RESEND_API_KEY"],
    maxInstances: 10,
    timeoutSeconds: 30,
    memory: "256MiB",
}, async (req, res) => {
    res.set("Access-Control-Allow-Origin", "*");
    if (req.method === "OPTIONS") {
        res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
        res.set("Access-Control-Allow-Headers", "Content-Type");
        res.status(204).send("");
        return;
    }
    if (req.method !== "POST") {
        res.status(405).json({ error: "Method Not Allowed" });
        return;
    }
    const { userId, email, displayName, workspaceId } = req.body;
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
        }
        catch (fsErr) {
            console.error("requestAccountDeletion: firestore write failed (non-fatal):", fsErr);
        }
        const apiKey = process.env.RESEND_API_KEY;
        if (!apiKey)
            throw new Error("RESEND_API_KEY not configured");
        const resend = new resend_1.Resend(apiKey);
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
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("requestAccountDeletion error:", msg);
        res.status(500).json({ error: msg });
    }
});
exports.sendAdminAlert = (0, https_1.onRequest)({
    cors: true,
    secrets: ["RESEND_API_KEY"],
    maxInstances: 5,
    timeoutSeconds: 15,
    memory: "128MiB",
}, async (req, res) => {
    res.set("Access-Control-Allow-Origin", "*");
    if (req.method === "OPTIONS") {
        res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
        res.set("Access-Control-Allow-Headers", "Content-Type");
        res.status(204).send("");
        return;
    }
    if (req.method !== "POST") {
        res.status(405).json({ error: "Method Not Allowed" });
        return;
    }
    const { errorType, raw, context, requestId } = req.body;
    if (!errorType || !raw || !context) {
        res.status(400).json({ error: "Missing required fields" });
        return;
    }
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
        res.status(500).json({ error: "RESEND_API_KEY not configured" });
        return;
    }
    const resend = new resend_1.Resend(apiKey);
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
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("sendAdminAlert error:", msg);
        res.status(500).json({ error: msg });
    }
});
// ─── Server-side reconciliation ──────────────────────────────────────────────
// KEEP IN SYNC with src/lib/import/reconcile.ts:reconcileWithBalanceColumn
// Works in integer centavos to avoid floating-point drift.
function reconcileServer(txs, initialBalanceCents, finalBalanceCents, toleranceCents = 2) {
    if (txs.length === 0)
        return { ok: true, suspectIndices: [] };
    const hasBalance = txs.some((t) => t.balanceCents !== undefined);
    if (!hasBalance) {
        // Totals strategy: sum of all signed amounts must equal final - initial
        if (initialBalanceCents !== undefined && finalBalanceCents !== undefined) {
            const sumCents = txs.reduce((s, t) => s + t.signedCents, 0);
            const expectedCents = finalBalanceCents - initialBalanceCents;
            return { ok: Math.abs(sumCents - expectedCents) <= toleranceCents, suspectIndices: [] };
        }
        return { ok: true, suspectIndices: [] }; // no anchor, skip
    }
    // Balance-column strategy: balance[n] == balance[n-1] + value[n]
    const inferredInitial = txs[0].balanceCents !== undefined
        ? txs[0].balanceCents - txs[0].signedCents
        : undefined;
    const initial = initialBalanceCents ?? inferredInitial;
    if (initial === undefined)
        return { ok: true, suspectIndices: [] };
    let running = initial;
    let maxDiff = 0;
    const suspectIndices = [];
    for (let i = 0; i < txs.length; i++) {
        running += txs[i].signedCents;
        const bc = txs[i].balanceCents;
        if (bc !== undefined) {
            const diff = Math.abs(running - bc);
            if (diff > toleranceCents) {
                suspectIndices.push(i);
                running = bc; // reset to authoritative balance to avoid cascade errors
                if (diff > maxDiff)
                    maxDiff = diff;
            }
        }
    }
    const finalOk = finalBalanceCents === undefined ||
        Math.abs(running - finalBalanceCents) <= toleranceCents;
    return { ok: suspectIndices.length === 0 && finalOk, suspectIndices };
}
// ─── Server-side classification ───────────────────────────────────────────────
// KEEP IN SYNC with src/lib/import/classify.ts
// Applies IGNORAR overrides before the sign-based default.
const MP_IGNORE_PATTERNS = [
    /dinheiro\s+reservado/i,
    /dinheiro\s+retirado/i,
    /^reembolso\b/i,
    /^estorno\b/i,
];
function classifyServer(description, signedCents, bankSlug, claudeClassification) {
    if (signedCents === 0)
        return "IGNORAR";
    const norm = description.normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
    // Bank-specific IGNORAR patterns take priority over Claude's output
    if (bankSlug === "mercado-pago" && MP_IGNORE_PATTERNS.some((p) => p.test(norm))) {
        return "IGNORAR";
    }
    // Claude's IGNORAR hint is trusted for other cases
    if (claudeClassification === "IGNORAR")
        return "IGNORAR";
    // Sign-based default (source of truth)
    return signedCents > 0 ? "ENTRADA" : "SAIDA";
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
exports.processImportJob = (0, storage_1.onObjectFinalized)({
    secrets: ["ANTHROPIC_API_KEY", "RESEND_API_KEY"],
    timeoutSeconds: 300,
    memory: "512MiB",
}, async (event) => {
    const objectPath = event.data.name;
    // Only process files uploaded under imports/
    if (!objectPath.startsWith("imports/"))
        return;
    const parts = objectPath.split("/");
    if (parts.length < 4)
        return;
    const workspaceId = parts[1];
    const jobId = parts[2];
    const filename = parts.slice(3).join("/");
    const originalFilename = event.data.metadata?.originalFilename ?? filename;
    const db = admin.firestore();
    const jobRef = db.doc(`workspaces/${workspaceId}/importJobs/${jobId}`);
    const bucket = admin.storage().bucket(event.data.bucket);
    // ── Idempotency: skip if already processed ────────────────────────────
    const jobSnap = await jobRef.get();
    if (!jobSnap.exists) {
        await bucket.file(objectPath).delete().catch(() => { });
        return;
    }
    const jobData = jobSnap.data();
    if (jobData.status !== "processing") {
        await bucket.file(objectPath).delete().catch(() => { });
        return;
    }
    // ── Download ──────────────────────────────────────────────────────────
    let fileBuffer;
    try {
        [fileBuffer] = await bucket.file(objectPath).download();
    }
    catch (err) {
        console.error("[import-job] download error:", err);
        await jobRef.update({
            status: "failed",
            error: "Não consegui ler o arquivo enviado.",
            failedAt: admin.firestore.FieldValue.serverTimestamp(),
        }).catch(() => { });
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
        }).catch(() => { });
        return;
    }
    const client = new sdk_1.default({ apiKey });
    // ── Extraction ────────────────────────────────────────────────────────
    // Text path (pdfjs extracted client-side, common case): chunked parallel
    // extraction — scales to any size and stays well under the 300s timeout.
    // Raw PDF path (pdfjs failed, e.g. mobile OOM, rare): can't be chunked
    // (binary), so a single call with a high token budget is the safety net.
    let parsed;
    try {
        const isPdfFile = filename.endsWith(".pdf");
        if (isPdfFile) {
            parsed = await callClaudeExtraction(client, fileBuffer.toString("base64"), "application/pdf", originalFilename, 32000);
        }
        else {
            parsed = await extractTextInChunks(client, fileBuffer.toString("utf-8"), originalFilename);
        }
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("[import-job] extraction error:", msg);
        await jobRef.update({
            status: "failed",
            error: "Não consegui extrair as transações. Tenta de novo.",
            failedAt: admin.firestore.FieldValue.serverTimestamp(),
        }).catch(() => { });
        if (resendKey)
            await alertJobFailure(resendKey, msg, jobId, workspaceId);
        return;
    }
    const allRawTxs = (parsed.transactions ?? []).filter((t) => t.amount != null && t.date && t.description);
    const sourceLabel = parsed.sourceLabel ?? "Importação";
    const bankSlug = /mercado\s*pago/i.test(sourceLabel) ? "mercado-pago" : "generic";
    if (allRawTxs.length === 0) {
        await jobRef.update({
            status: "partial",
            transactions: [],
            sourceLabel,
            warning: "Nenhuma transação encontrada nesse arquivo.",
            processedAt: admin.firestore.FieldValue.serverTimestamp(),
        }).catch(() => { });
        return;
    }
    // ── Reconciliation (integer centavos) ─────────────────────────────────
    // Runs over ALL raw transactions (incl. future IGNORAR) because the
    // balance column in the document includes internal movements.
    const internalTxs = allRawTxs.map((t) => {
        const signedCents = Math.round((t.type === "income" ? t.amount : -t.amount) * 100);
        const balanceCents = t.balance !== undefined ? Math.round(t.balance * 100) : undefined;
        return { ...t, signedCents, balanceCents };
    });
    const initialCents = parsed.initialBalance !== undefined
        ? Math.round(parsed.initialBalance * 100)
        : undefined;
    const finalCents = parsed.finalBalance !== undefined
        ? Math.round(parsed.finalBalance * 100)
        : undefined;
    const reconciliation = reconcileServer(internalTxs, initialCents, finalCents);
    // ── Classification (ENTRADA / SAIDA / IGNORAR) ────────────────────────
    const classified = internalTxs.map((t) => classifyServer(t.description, t.signedCents, bankSlug, t.classification));
    // ── Build saved transactions (exclude IGNORAR) ────────────────────────
    const VALID_CATS = new Set(IMPORT_CATEGORIES);
    const transactions = internalTxs
        .filter((_, i) => classified[i] !== "IGNORAR")
        .filter((t) => Math.abs(t.amount) > 0)
        .map((t) => {
        const amount = Math.abs(t.amount);
        const desc = t.description.trim();
        const cat = t.category && VALID_CATS.has(t.category) ? t.category : "Outros";
        return {
            date: t.date,
            description: desc,
            amount,
            type: t.type,
            category: cat,
            sourceLabel,
            source: /cartão|fatura|card/i.test(sourceLabel) ? "card" : "account",
            monthKey: (t.date ?? "").slice(0, 7),
            dedupKey: `${t.date}|${desc.toLowerCase()}|${amount.toFixed(2)}`,
        };
    });
    const ignoredCount = classified.filter((c) => c === "IGNORAR").length;
    const baseUpdate = {
        transactions,
        sourceLabel,
        ignoredCount,
        processedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    if (!reconciliation.ok) {
        await jobRef.update({
            ...baseUpdate,
            status: "partial",
            warning: `Reconciliação não fechou — ${reconciliation.suspectIndices.length} linha(s) suspeita(s). Revise os valores antes de confirmar.`,
            reconciliation: {
                ok: false,
                suspectCount: reconciliation.suspectIndices.length,
            },
        });
        return;
    }
    await jobRef.update({ ...baseUpdate, status: "done" });
});
// ─── Client-side error beacon ─────────────────────────────────────────────────
// Receives operational errors that die on the device (Storage upload failure,
// importJob creation failure, etc.) and forwards them as admin alerts.
// Rate-limiting is handled client-side; this endpoint trusts the client to not spam.
exports.clientError = (0, https_1.onRequest)({
    cors: true,
    secrets: ["RESEND_API_KEY"],
    maxInstances: 5,
    timeoutSeconds: 15,
    memory: "128MiB",
}, async (req, res) => {
    res.set("Access-Control-Allow-Origin", "*");
    if (req.method === "OPTIONS") {
        res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
        res.set("Access-Control-Allow-Headers", "Content-Type");
        res.status(204).send("");
        return;
    }
    if (req.method !== "POST") {
        res.status(405).json({ error: "Method Not Allowed" });
        return;
    }
    const { context, message, uid } = req.body;
    if (!context || !message) {
        res.status(400).json({ error: "Missing context or message" });
        return;
    }
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
        res.json({ ok: false });
        return;
    }
    const resend = new resend_1.Resend(apiKey);
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
    }
    catch {
        res.json({ ok: false });
    }
});
//# sourceMappingURL=index.js.map