// ─── Folha AJUDA (mode 'help' → 'help_capture') — ABERTA, não toca a conta ────
// Duas etapas na mesma folha (registrada nos dois modos): pede o relato, captura a
// próxima mensagem e encaminha por e-mail. Não exige vínculo.
import type { Leaf } from "../types";

export const helpLeaf: Leaf = {
  mode: "help",
  inputType: "structured",
  requiresLink: false,
  async handle(ctx) {
    if (ctx.state.mode !== "help_capture") {
      // Entrada: convida a contar o problema e passa a aguardar a próxima mensagem.
      return { reply: "Pode mandar. 👂 Me conta o que tá pegando.\n\n_Se mudou de ideia, manda *menu* pra voltar._", nextMode: "help_capture" };
    }
    // Captura: encaminha o relato por e-mail e encerra o fluxo.
    await ctx.services.sendHelpEmail(ctx.phone, ctx.text);
    return { reply: "Recebi! ✅ Te respondo em breve por aqui.", nextMode: "idle" };
  },
};
