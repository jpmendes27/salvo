"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAX_TURNS = exports.TIMEOUT_MS = void 0;
exports.idleState = idleState;
exports.normalize = normalize;
exports.applyTimeout = applyTimeout;
exports.TIMEOUT_MS = 30 * 60 * 1000; // fluxo parado > 30 min → volta pra 'idle'
exports.MAX_TURNS = 10; // fluxo passar de 10 turnos → recomeça
function idleState(now) {
    return { mode: "idle", context: null, turnCount: 0, lastActivityAt: now };
}
// Normaliza texto pra casar opção estruturada: sem acento, minúsculo, sem espaço nas pontas.
function normalize(text) {
    return (text ?? "")
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .trim()
        .toLowerCase();
}
// Ao carregar: se o fluxo (mode != idle) está parado além do timeout, reseta pra idle
// ANTES de processar. Preserva o vínculo (isso é outra coleção) — só zera a conversa.
function applyTimeout(state, now) {
    if (state.mode !== "idle" && now - state.lastActivityAt > exports.TIMEOUT_MS) {
        return idleState(now);
    }
    return state;
}
//# sourceMappingURL=state.js.map