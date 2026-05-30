import { onCall, onRequest } from "firebase-functions/v2/https";
import Anthropic from "@anthropic-ai/sdk";
import { Resend } from "resend";
import crypto from "crypto";
import * as admin from "firebase-admin";

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
  "transactions": [
    {
      "date": "YYYY-MM-DD",
      "description": "string",
      "amount": number,
      "type": "income" | "expense"
    }
  ]
}

Regras para sourceLabel — CRÍTICO seguir exatamente:
- Fatura de cartão de crédito COM últimos 4 dígitos visíveis: "Cartão [Banco] [4 dígitos]"
  Exemplos: "Cartão Nubank 1234", "Cartão Itaú 5678", "Cartão Bradesco 9012"
- Fatura de cartão SEM dígitos visíveis: "Cartão [Banco]"
  Exemplos: "Cartão Santander", "Cartão Caixa"
- Extrato / conta corrente / conta digital / poupança: apenas o nome do banco
  Exemplos: "Nubank", "Inter", "Bradesco", "Caixa"
- Carteira digital: nome da carteira — "PicPay", "Mercado Pago"
- NUNCA inclua datas, períodos, números de agência ou conta no sourceLabel
- SEMPRE tente extrair os últimos 4 dígitos do cartão — aparecem como •••• 1234, **** 1234, "final 1234", "terminado em 1234" ou similares
- "extrato" no documento → é conta, não cartão → label = só nome do banco
- Se não conseguir identificar o banco: "Importação"

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

type ParsedClaudeResponse = {
  sourceLabel?: string;
  transactions?: Array<{
    date: string;
    description: string;
    amount: number;
    type: "income" | "expense";
  }>;
};

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
        "Você corrige JSON financeiro. Retorne somente um JSON válido no formato {\"sourceLabel\":\"string\",\"transactions\":[{\"date\":\"YYYY-MM-DD\",\"description\":\"string\",\"amount\":number,\"type\":\"income\"|\"expense\"}]}. Não invente transações.",
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

    const client = new Anthropic({ apiKey });

    type ImageMediaType = "image/jpeg" | "image/png" | "image/gif" | "image/webp";
    const isImage =
      mimeType.startsWith("image/") &&
      ["image/jpeg", "image/png", "image/gif", "image/webp"].includes(mimeType);
    const isPDF = mimeType === "application/pdf";
    const isText = mimeType === "text/plain" || mimeType === "text/csv";

    if (!isImage && !isPDF && !isText) {
      res.status(400).json({ error: "Unsupported mimeType: " + mimeType });
      return;
    }

    try {
      let content: Anthropic.MessageParam["content"];

      if (isText) {
        content = [
          {
            type: "text",
            text: `Arquivo: ${filename || "extrato.txt"}\n\nExtraia todas as transações financeiras deste extrato/fatura bancária. O conteúdo pode ser texto de PDF, CSV ou OFX — adapte a leitura ao formato encontrado:\n\n${(textData || "").slice(0, 120000)}`
          }
        ];
      } else if (isImage) {
        content = [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: mimeType as ImageMediaType,
              data: fileData || ""
            }
          },
          {
            type: "text",
            text: "Extraia todas as transações financeiras desta imagem de extrato bancário."
          }
        ];
      } else {
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

      const rawText =
        message.content.find((b): b is Anthropic.TextBlock => b.type === "text")?.text ?? "{}";

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
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("Claude API error:", msg);
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

    const client = new Anthropic({ apiKey });

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

    const client = new Anthropic({ apiKey });
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
