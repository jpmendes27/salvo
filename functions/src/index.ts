import { onRequest } from "firebase-functions/v2/https";
import Anthropic from "@anthropic-ai/sdk";
import { Resend } from "resend";

function buildSystemPrompt(): string {
  const today = new Date().toISOString().slice(0, 10);
  return `Hoje é ${today}. Use esta data como referência para inferir o ano quando as datas do documento não tiverem ano explícito (ex: "06 MAI" → use o ano corrente ou o mais próximo cronologicamente).

Você é um extrator especializado de transações financeiras de extratos bancários brasileiros.

Dado um arquivo (PDF ou imagem), extraia TODAS as transações financeiras visíveis e retorne SOMENTE um JSON válido:

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
    const isText = mimeType === "text/plain";

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
            text: `Arquivo: ${filename || "extrato.txt"}\n\nExtraia todas as transações financeiras deste texto de extrato/fatura bancária:\n\n${(textData || "").slice(0, 120000)}`
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
    const message = `${sender} te adicionou no painel financeiro dele no Fincheck Pro. 💚\nAgora vocês acompanham tudo juntos — entradas, gastos e o planejamento do mês em tempo real.\n👉 ${inviteLink}`;

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
        from: `${senderName} via Fincheck Pro <convites@fincheck.pro>`,
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
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("sendInviteEmail error:", msg);
      res.set("Access-Control-Allow-Origin", "*");
      res.status(500).json({ error: msg });
    }
  }
);
