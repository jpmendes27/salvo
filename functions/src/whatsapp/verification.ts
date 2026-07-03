// ─── Vínculo: validação de código (anti-enumeração) ──────────────────────────
// A verificação SÓ devolve a conta em caso de casamento perfeito (código válido,
// não-expirado, não-usado). Em QUALQUER falha devolve null — quem decide a mensagem
// genérica é o roteador, então o chamador nunca diferencia os motivos de falha.
import type { ConversationStore, LinkedAccount } from "./types";

// Extrai um código de 6 dígitos de um texto livre ("meu codigo eh 123456", "123456").
// Não revela nada — só tenta achar o padrão. Sem 6 dígitos → null (tratado como falha).
export function extractCode(text: string): string | null {
  const m = (text ?? "").match(/\b(\d{6})\b/);
  if (m) return m[1];
  const digits = (text ?? "").replace(/\D/g, "");
  return digits.length === 6 ? digits : null;
}

// Tenta casar o texto com um código válido e, se casar, grava o vínculo e queima o
// código (uso único). Devolve a conta vinculada ou null. NÃO monta mensagem.
export async function tryVerifyAndLink(
  phone: string,
  text: string,
  store: ConversationStore,
  now: number
): Promise<LinkedAccount | null> {
  const code = extractCode(text);
  if (!code) return null;
  const found = await store.findValidCode(code, now);
  if (!found) return null;
  await store.saveLink(phone, found, now);
  await store.burnCode(code);
  return found;
}
