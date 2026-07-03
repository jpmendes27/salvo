"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.diagnosisStubLeaf = void 0;
exports.diagnosisStubLeaf = {
    mode: "diagnosis",
    inputType: "structured",
    requiresLink: true,
    handle() {
        return { reply: "Já já tô montando essa parte, tá quase pronta.", nextMode: "idle" };
    },
};
//# sourceMappingURL=diagnosisStub.js.map