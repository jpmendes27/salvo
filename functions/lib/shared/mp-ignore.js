"use strict";
// ⚠️ GERADO por scripts/sync-shared.mjs — NÃO EDITE AQUI.
// Fonte da verdade: src/lib/shared/. Rode o build do functions pra regenerar.
Object.defineProperty(exports, "__esModule", { value: true });
exports.MP_IGNORE_PATTERNS = void 0;
// ─── Lançamentos internos do Mercado Pago (fonte da verdade compartilhada) ────
// Reembolso/estorno/dinheiro reservado/retirado: entradas contábeis internas do MP
// que cancelam um movimento anterior — NÃO são renda/gasto real. Classificadas como
// IGNORAR (não entram no diagnóstico). Aplicadas sobre a descrição normalizada.
// UMA definição: servidor (classifyServer) E cliente (import/classify).
exports.MP_IGNORE_PATTERNS = [
    /dinheiro\s+reservado/i,
    /dinheiro\s+retirado/i,
    /^reembolso\b/i,
    /^estorno\b/i,
];
//# sourceMappingURL=mp-ignore.js.map