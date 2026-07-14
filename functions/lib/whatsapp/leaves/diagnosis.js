"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.diagnosisLeaf = void 0;
exports.diagnosisLeaf = {
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
        }
        catch {
            // Degrada honesto — nunca inventa diagnóstico.
            return {
                reply: "Não consegui montar teu panorama agora. Tenta de novo daqui a pouco.",
                nextMode: "idle",
            };
        }
    },
};
//# sourceMappingURL=diagnosis.js.map