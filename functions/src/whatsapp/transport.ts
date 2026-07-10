// ─── Transporte (Evolution API) — AGNÓSTICO DE APRESENTAÇÃO ───────────────────
// As folhas devolvem opções SEMÂNTICAS ({id,label}); é aqui — e SÓ aqui — que elas
// viram string. Migrar pra botão/enquete da API Oficial no futuro = mexer só em
// renderOptions, sem encostar em roteador nem folha. Todo envio é reação a inbound.
import type { LeafResult, Option, Inbound } from "./types";

// ÚNICO ponto de renderização de opções (v1: texto numerado).
export function renderOptions(header: string | undefined, options: Option[]): string {
  const lines = options.map((o, i) => `${i + 1}. ${o.label}`);
  const foot = "Manda só o número.";
  return [header, ...lines, "", foot].filter((l) => l !== undefined).join("\n");
}

// Converte o resultado semântico de uma folha no texto final a enviar.
export function renderReply(result: LeafResult): string {
  if (result.options && result.options.length) {
    return renderOptions(result.optionsHeader ?? result.reply, result.options);
  }
  return result.reply ?? "";
}

// Parse do inbound do Evolution: extrai número em E.164 + texto. Devolve null pra
// tudo que NÃO for mensagem de texto de usuário (fromMe, grupo, mídia, etc.).
export function parseInbound(body: unknown): Inbound | null {
  const b = body as {
    data?: {
      key?: { remoteJid?: string; fromMe?: boolean };
      message?: { conversation?: string; extendedTextMessage?: { text?: string } };
    };
  };
  const data = b?.data;
  const key = data?.key;
  if (!key || key.fromMe) return null;
  const jid = key.remoteJid ?? "";
  if (!jid || jid.endsWith("@g.us")) return null; // ignora grupo
  const text = data?.message?.conversation ?? data?.message?.extendedTextMessage?.text;
  if (typeof text !== "string" || !text.trim()) return null; // só texto de usuário
  const digits = jid.split("@")[0].replace(/\D/g, "");
  if (!digits) return null;
  return { phone: `+${digits}`, text };
}

// Envio outbound via Evolution (mesmo endpoint das outras functions).
export async function sendText(
  phone: string,
  text: string,
  evolutionUrl: string,
  instance: string,
  apiKey: string
): Promise<void> {
  const number = phone.replace(/\D/g, "");
  const resp = await fetch(`${evolutionUrl}/message/sendText/${instance}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: apiKey },
    body: JSON.stringify({ number, text }), // Evolution v2: texto PLANO na raiz (não textMessage)
  });
  if (!resp.ok) {
    const detail = await resp.text().catch(() => "");
    throw new Error(`Evolution sendText ${resp.status}: ${detail.slice(0, 200)}`);
  }
}
