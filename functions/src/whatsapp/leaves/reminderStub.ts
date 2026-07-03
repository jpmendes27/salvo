// ─── Folha LEMBRETE (mode 'reminder') — STUB, atrás do portão de vínculo ──────
// requiresLink:true. Nesta passada é stub: NÃO agenda lembrete de verdade. Fica
// registrada e gateada, provando a extensibilidade do roteador.
import type { Leaf } from "../types";

export const reminderStubLeaf: Leaf = {
  mode: "reminder",
  inputType: "structured",
  requiresLink: true,
  handle() {
    return { reply: "Já já tô montando essa parte, tá quase pronta.", nextMode: "idle" };
  },
};
