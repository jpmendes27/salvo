"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.menuLeaf = exports.MENU_OPTIONS = void 0;
// A ORDEM aqui define a numeração que o transporte renderiza; a própria folha mapeia
// o número de volta pra intenção. Trocar a renderização não mexe nesta ordem.
exports.MENU_OPTIONS = [
    { id: "diagnosis", label: "Como tá financeiramente?" },
    { id: "reminder", label: "Criar lembrete pra mandar mais dados" },
    { id: "help", label: "Preciso de ajuda" },
];
const MENU_HEADER = "E aí! O que você quer ver?";
exports.menuLeaf = {
    mode: "idle",
    inputType: "structured",
    requiresLink: false,
    handle(ctx) {
        const t = ctx.normalizedText;
        // Aceita o número da posição (v1: entrada numerada).
        const byNumber = /^([1-9]\d*)$/.test(t) ? Number(t) : NaN;
        const chosen = !Number.isNaN(byNumber) && byNumber >= 1 && byNumber <= exports.MENU_OPTIONS.length
            ? exports.MENU_OPTIONS[byNumber - 1]
            : null;
        if (chosen) {
            // Seleção válida → o roteador roda JÁ a folha do modo escolhido (passando pelo
            // portão de vínculo se ela exigir).
            return { nextMode: chosen.id, dispatchNext: true };
        }
        // Não reconhecido (inclui "oi") → mostra o menu, sem quebrar, sem revelar nada.
        return { options: exports.MENU_OPTIONS, optionsHeader: MENU_HEADER, nextMode: "idle" };
    },
};
//# sourceMappingURL=menu.js.map