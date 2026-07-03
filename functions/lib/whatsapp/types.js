"use strict";
// ─── WhatsApp chatbot — tipos base (passada 1: fundação reply-only) ──────────
// O roteador é lógica pura sobre deps injetáveis (store/serviços). A camada de
// transporte (Evolution) e a persistência (Firestore) são adapters — isso deixa a
// validação rodar local com fakes, sem tocar em rede.
Object.defineProperty(exports, "__esModule", { value: true });
//# sourceMappingURL=types.js.map