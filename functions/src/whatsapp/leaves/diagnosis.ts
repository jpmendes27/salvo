// ─── Folha DIAGNÓSTICO (mode 'diagnosis') — REAL, atrás do portão de vínculo ──
// requiresLink:true → o roteador só chega aqui com a conta vinculada. A folha não sabe
// de IA nem de Firestore: pede o texto pronto pro serviço injetado (fonte de verdade
// única — o mesmo motor que alimenta a home).
import type { Leaf } from "../types";

export const diagnosisLeaf: Leaf = {
  mode: "diagnosis",
  inputType: "structured",
  requiresLink: true,
  async handle(ctx) {
    // Defensivo: o portão já garante a conta, mas nunca vaze dado sem vínculo.
    if (!ctx.account) {
      return { reply: "Preciso te reconhecer aqui antes de falar dos teus números.", nextMode: "idle" };
    }
    try {
      const texto = await ctx.services.getDiagnosis(ctx.account);
      return { reply: texto, nextMode: "idle" };
    } catch {
      // Degrada honesto — nunca inventa diagnóstico.
      return {
        reply: "Não consegui montar teu panorama agora. Tenta de novo daqui a pouco.",
        nextMode: "idle",
      };
    }
  },
};
