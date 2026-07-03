"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reminderStubLeaf = void 0;
exports.reminderStubLeaf = {
    mode: "reminder",
    inputType: "structured",
    requiresLink: true,
    handle() {
        return { reply: "Já já tô montando essa parte, tá quase pronta.", nextMode: "idle" };
    },
};
//# sourceMappingURL=reminderStub.js.map