import { onRequest } from "firebase-functions/v2/https";
import Anthropic from "@anthropic-ai/sdk";

const SYSTEM_PROMPT = `Você é um extrator especializado de transações financeiras de extratos bancários brasileiros.

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
- Para fatura de cartão: "NomeBanco •••• XXXX" (últimos 4 dígitos do cartão principal, se visível)
- Para extrato de conta corrente/poupança: "NomeBanco Conta"
- Para carteira digital (PicPay, Mercado Pago): nome da carteira
- Exemplos: "Nubank •••• 3640", "Nubank Conta", "PicPay", "Itaú •••• 1234", "Bradesco Conta"
- Se não identificar o banco: "Extrato"

Regras para transações:
- Débitos, saídas, compras, tarifas, IOF = "expense"
- Créditos, entradas, depósitos, PIX recebidos = "income"
- NÃO inclua: pagamentos de fatura, saldo anterior, saldo restante, crédito de atraso, encerramento de dívida, totais, limites — essas são linhas contábeis, não transações reais
- "amount" SEMPRE positivo (ex: 150.00, nunca -150.00)
- "date" no formato ISO YYYY-MM-DD
- "description" deve ser o texto original da transação, sem truncar
- NÃO inclua campo "category" — isso é processado separadamente
- Retorne APENAS o JSON puro, sem markdown, sem texto adicional, sem explicação`;

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

    const { fileData, mimeType } = req.body as {
      fileData?: string;
      mimeType?: string;
    };

    if (!fileData || !mimeType) {
      res.status(400).json({ error: "Missing fileData or mimeType" });
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

    if (!isImage && !isPDF) {
      res.status(400).json({ error: "Unsupported mimeType: " + mimeType });
      return;
    }

    try {
      let content: Anthropic.MessageParam["content"];

      if (isImage) {
        content = [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: mimeType as ImageMediaType,
              data: fileData
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
              data: fileData
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
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content }]
      });

      const rawText =
        message.content.find((b): b is Anthropic.TextBlock => b.type === "text")?.text ?? "{}";

      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        res.status(500).json({ error: "No JSON in Claude response", raw: rawText });
        return;
      }

      const parsed = JSON.parse(jsonMatch[0]) as {
        sourceLabel?: string;
        transactions: Array<{
          date: string;
          description: string;
          amount: number;
          type: "income" | "expense";
        }>;
      };

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
