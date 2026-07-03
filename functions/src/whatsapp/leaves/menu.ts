// ─── Folha MENU (mode 'idle') — ABERTA a qualquer número ─────────────────────
// Não toca dado da conta (requiresLink:false). Qualquer coisa não reconhecida cai
// aqui e mostra as opções. Devolve lista SEMÂNTICA — nunca a string montada.
import type { Leaf, Option } from "../types";

// A ORDEM aqui define a numeração que o transporte renderiza; a própria folha mapeia
// o número de volta pra intenção. Trocar a renderização não mexe nesta ordem.
export const MENU_OPTIONS: Option[] = [
  { id: "diagnosis", label: "Como tá financeiramente?" },
  { id: "reminder", label: "Criar lembrete pra mandar mais dados" },
  { id: "help", label: "Preciso de ajuda" },
];

const MENU_HEADER = "E aí! O que você quer ver?";

export const menuLeaf: Leaf = {
  mode: "idle",
  inputType: "structured",
  requiresLink: false,
  handle(ctx) {
    const t = ctx.normalizedText;
    // Aceita o número da posição (v1: entrada numerada).
    const byNumber = /^([1-9]\d*)$/.test(t) ? Number(t) : NaN;
    const chosen =
      !Number.isNaN(byNumber) && byNumber >= 1 && byNumber <= MENU_OPTIONS.length
        ? MENU_OPTIONS[byNumber - 1]
        : null;

    if (chosen) {
      // Seleção válida → o roteador roda JÁ a folha do modo escolhido (passando pelo
      // portão de vínculo se ela exigir).
      return { nextMode: chosen.id, dispatchNext: true };
    }

    // Não reconhecido (inclui "oi") → mostra o menu, sem quebrar, sem revelar nada.
    return { options: MENU_OPTIONS, optionsHeader: MENU_HEADER, nextMode: "idle" };
  },
};
