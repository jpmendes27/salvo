"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractCode = extractCode;
exports.tryVerifyAndLink = tryVerifyAndLink;
// Extrai um código de 6 dígitos de um texto livre ("meu codigo eh 123456", "123456").
// Não revela nada — só tenta achar o padrão. Sem 6 dígitos → null (tratado como falha).
function extractCode(text) {
    const m = (text ?? "").match(/\b(\d{6})\b/);
    if (m)
        return m[1];
    const digits = (text ?? "").replace(/\D/g, "");
    return digits.length === 6 ? digits : null;
}
// Tenta casar o texto com um código válido e, se casar, grava o vínculo e queima o
// código (uso único). Devolve a conta vinculada ou null. NÃO monta mensagem.
async function tryVerifyAndLink(phone, text, store, now) {
    const code = extractCode(text);
    if (!code)
        return null;
    const found = await store.findValidCode(code, now);
    if (!found)
        return null;
    await store.saveLink(phone, found, now);
    await store.burnCode(code);
    return found;
}
//# sourceMappingURL=verification.js.map