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
exports.generateDiagnosis = exports.relinkGoogleAccount = exports.verifyCode = exports.sendVerificationCode = exports.sendInviteEmail = exports.sendInviteWhatsApp = exports.parseBankStatement = void 0;
const https_1 = require("firebase-functions/v2/https");
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
  "transactions": [
    {
      "date": "YYYY-MM-DD",
      "description": "string",
      "amount": number,
      "type": "income" | "expense"
    }
  ]
}

Regras para sourceLabel:
- Identifique o banco/instituição e tipo do documento
- Para fatura de cartão de crédito: "NomeBanco •••• XXXX" (últimos 4 dígitos do cartão, se visível; senão "NomeBanco Cartão")
- Para extrato/tela de conta corrente, poupança ou conta digital: "NomeBanco Conta"
- Para carteira digital (PicPay, Mercado Pago): nome da carteira
- Exemplos: "Nubank •••• 3640", "Nubank Conta", "Nubank Cartão", "PicPay", "Itaú •••• 1234", "Bradesco Conta", "Inter Conta"
- Se vir o logo/nome Nubank e a tela mostrar PIX, transferências, débitos em conta → "Nubank Conta"
- Se vir o logo/nome Nubank e a tela mostrar compras no crédito, fatura → "Nubank Cartão" ou "Nubank •••• XXXX"
- NUNCA retorne "Extrato" se conseguir identificar o banco — só use "Extrato" como último recurso absoluto

Regras para transações:
- Débitos, saídas, compras, tarifas, IOF = "expense"
- Créditos, entradas, depósitos, PIX recebidos = "income"
- NÃO inclua: pagamentos de fatura, saldo anterior, saldo restante, crédito de atraso, encerramento de dívida, totais, limites — essas são linhas contábeis, não transações reais
- "amount" SEMPRE positivo (ex: 150.00, nunca -150.00)
- "date" no formato ISO YYYY-MM-DD
- "description" deve ser o texto original da transação, sem truncar
- NÃO inclua campo "category" — isso é processado separadamente
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
            system: "Você corrige JSON financeiro. Retorne somente um JSON válido no formato {\"sourceLabel\":\"string\",\"transactions\":[{\"date\":\"YYYY-MM-DD\",\"description\":\"string\",\"amount\":number,\"type\":\"income\"|\"expense\"}]}. Não invente transações.",
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
    const client = new sdk_1.default({ apiKey });
    const isImage = mimeType.startsWith("image/") &&
        ["image/jpeg", "image/png", "image/gif", "image/webp"].includes(mimeType);
    const isPDF = mimeType === "application/pdf";
    const isText = mimeType === "text/plain" || mimeType === "text/csv";
    if (!isImage && !isPDF && !isText) {
        res.status(400).json({ error: "Unsupported mimeType: " + mimeType });
        return;
    }
    try {
        let content;
        if (isText) {
            content = [
                {
                    type: "text",
                    text: `Arquivo: ${filename || "extrato.txt"}\n\nExtraia todas as transações financeiras deste extrato/fatura bancária. O conteúdo pode ser texto de PDF, CSV ou OFX — adapte a leitura ao formato encontrado:\n\n${(textData || "").slice(0, 120000)}`
                }
            ];
        }
        else if (isImage) {
            content = [
                {
                    type: "image",
                    source: {
                        type: "base64",
                        media_type: mimeType,
                        data: fileData || ""
                    }
                },
                {
                    type: "text",
                    text: "Extraia todas as transações financeiras desta imagem de extrato bancário."
                }
            ];
        }
        else {
            content = [
                {
                    type: "document",
                    source: {
                        type: "base64",
                        media_type: "application/pdf",
                        data: fileData || ""
                    }
                },
                {
                    type: "text",
                    text: "Extraia todas as transações financeiras deste extrato bancário em PDF."
                }
            ];
        }
        const message = await client.messages.create({
            model: "claude-sonnet-4-6",
            max_tokens: 8192,
            system: buildSystemPrompt(),
            messages: [{ role: "user", content }]
        });
        const rawText = message.content.find((b) => b.type === "text")?.text ?? "{}";
        const parsed = await parseOrRepairJson(client, rawText);
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
    const message = `${sender} te chamou pro Fincheck Pro 👊\n\nVocês vão acompanhar entradas, gastos e o plano do mês juntos — em tempo real, sem ninguém ter que ficar perguntando "ué, gastou onde isso?".\n\nBora entrar?\n${inviteLink}`;
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
            from: `${senderName} via Fincheck Pro <onboarding@resend.dev>`,
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
          <p style="margin:0 0 8px;font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:rgba(255,255,255,0.28)">FINCHECK PRO</p>
          <h1 style="margin:0 0 24px;font-size:24px;font-weight:800;color:#fff;line-height:1.3">Oi! 👋</h1>
          <p style="margin:0 0 12px;font-size:15px;color:rgba(255,255,255,0.75);line-height:1.7">
            <strong style="color:#fff">${senderName}</strong> te convidou para acompanhar e gerir as finanças juntos no Fincheck Pro.
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
                    textMessage: { text: `Seu código de verificação do Fincheck Pro: *${code}*\n\nEle expira em 10 minutos. Não compartilhe com ninguém.` }
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
                from: "Fincheck Pro <onboarding@resend.dev>",
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
          <p style="margin:0 0 28px;font-size:13px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:rgba(255,255,255,0.28)">FINCHECK PRO</p>
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
//# sourceMappingURL=index.js.map