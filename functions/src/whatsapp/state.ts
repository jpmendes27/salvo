// ─── Estado da conversa: constantes, timeout e normalização ──────────────────
import type { ConversationState } from "./types";

export const TIMEOUT_MS = 30 * 60 * 1000; // fluxo parado > 30 min → volta pra 'idle'
export const MAX_TURNS = 10;              // fluxo passar de 10 turnos → recomeça

export function idleState(now: number): ConversationState {
  return { mode: "idle", context: null, turnCount: 0, lastActivityAt: now };
}

// Normaliza texto pra casar opção estruturada: sem acento, minúsculo, sem espaço nas pontas.
export function normalize(text: string): string {
  return (text ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();
}

// Ao carregar: se o fluxo (mode != idle) está parado além do timeout, reseta pra idle
// ANTES de processar. Preserva o vínculo (isso é outra coleção) — só zera a conversa.
export function applyTimeout(state: ConversationState, now: number): ConversationState {
  if (state.mode !== "idle" && now - state.lastActivityAt > TIMEOUT_MS) {
    return idleState(now);
  }
  return state;
}
