// ─── Folha DIAGNÓSTICO (mode 'diagnosis') — STUB, atrás do portão de vínculo ──
// requiresLink:true → o roteador só chega aqui com a conta vinculada. Nesta passada
// é stub: NÃO chama generateDiagnosis. Fica registrada e gateada, pronta pro oráculo.
import type { Leaf } from "../types";

export const diagnosisStubLeaf: Leaf = {
  mode: "diagnosis",
  inputType: "structured",
  requiresLink: true,
  handle() {
    return { reply: "Já já tô montando essa parte, tá quase pronta.", nextMode: "idle" };
  },
};
