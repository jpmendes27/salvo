"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractWebhookToken = extractWebhookToken;
exports.secretMatches = secretMatches;
exports.isWellFormedEvent = isWellFormedEvent;
// ─── Autenticação do webhook (endurecida) ────────────────────────────────────
// O segredo NUNCA viaja na query string (vaza em log de request). Vem por DOIS
// caminhos, o que existir: (a) HEADER 'x-salvo-webhook-token' (preferencial, Evolution
// Cloud), ou (b) ÚLTIMO SEGMENTO DE PATH da URL (fallback pra self-hosted sem header).
// Comparação em tempo constante; defesa em profundidade valida o corpo + instância.
const crypto_1 = __importDefault(require("crypto"));
// Extrai o segredo do request: header preferencial, senão o último segmento do path.
// NÃO lê query string. Recebe valores já extraídos do req (header + path) — mantém puro
// e testável.
function extractWebhookToken(headerValue, path) {
    if (typeof headerValue === "string" && headerValue.length > 0)
        return headerValue;
    const segments = (path ?? "").split("/").filter(Boolean);
    if (segments.length > 0)
        return segments[segments.length - 1];
    return null;
}
// Comparação em TEMPO CONSTANTE. Faz hash SHA-256 dos dois lados → digests de tamanho
// FIXO (32 bytes): tamanhos de entrada diferentes não vazam por early-return nem estouram
// exceção no timingSafeEqual. Segredo vazio/ausente → false.
function secretMatches(provided, secret) {
    if (!provided || !secret)
        return false;
    const p = crypto_1.default.createHash("sha256").update(provided, "utf8").digest();
    const s = crypto_1.default.createHash("sha256").update(secret, "utf8").digest();
    return crypto_1.default.timingSafeEqual(p, s);
}
// Defesa em profundidade: o corpo tem que ser um evento Evolution bem-formado E a
// instância no payload tem que bater com a esperada. Qualquer desvio → false (o caller
// rejeita com 400, sem chamar o roteador).
function isWellFormedEvent(body, expectedInstance) {
    if (!body || typeof body !== "object")
        return false;
    const b = body;
    if (typeof b.instance !== "string" || b.instance !== expectedInstance)
        return false;
    if (!b.data || typeof b.data !== "object")
        return false;
    return true;
}
//# sourceMappingURL=webhookAuth.js.map