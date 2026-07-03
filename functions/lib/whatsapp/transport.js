"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderOptions = renderOptions;
exports.renderReply = renderReply;
exports.parseInbound = parseInbound;
exports.sendText = sendText;
// ÚNICO ponto de renderização de opções (v1: texto numerado).
function renderOptions(header, options) {
    const lines = options.map((o, i) => `${i + 1}. ${o.label}`);
    const foot = "Manda só o número.";
    return [header, ...lines, "", foot].filter((l) => l !== undefined).join("\n");
}
// Converte o resultado semântico de uma folha no texto final a enviar.
function renderReply(result) {
    if (result.options && result.options.length) {
        return renderOptions(result.optionsHeader ?? result.reply, result.options);
    }
    return result.reply ?? "";
}
// Parse do inbound do Evolution: extrai número em E.164 + texto. Devolve null pra
// tudo que NÃO for mensagem de texto de usuário (fromMe, grupo, mídia, etc.).
function parseInbound(body) {
    const b = body;
    const data = b?.data;
    const key = data?.key;
    if (!key || key.fromMe)
        return null;
    const jid = key.remoteJid ?? "";
    if (!jid || jid.endsWith("@g.us"))
        return null; // ignora grupo
    const text = data?.message?.conversation ?? data?.message?.extendedTextMessage?.text;
    if (typeof text !== "string" || !text.trim())
        return null; // só texto de usuário
    const digits = jid.split("@")[0].replace(/\D/g, "");
    if (!digits)
        return null;
    return { phone: `+${digits}`, text };
}
// Envio outbound via Evolution (mesmo endpoint das outras functions).
async function sendText(phone, text, evolutionUrl, instance, apiKey) {
    const number = phone.replace(/\D/g, "");
    const resp = await fetch(`${evolutionUrl}/message/sendText/${instance}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: apiKey },
        body: JSON.stringify({ number, options: { delay: 400 }, textMessage: { text } }),
    });
    if (!resp.ok) {
        const detail = await resp.text().catch(() => "");
        throw new Error(`Evolution sendText ${resp.status}: ${detail.slice(0, 200)}`);
    }
}
//# sourceMappingURL=transport.js.map