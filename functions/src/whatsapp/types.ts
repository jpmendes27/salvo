// ─── WhatsApp chatbot — tipos base (passada 1: fundação reply-only) ──────────
// O roteador é lógica pura sobre deps injetáveis (store/serviços). A camada de
// transporte (Evolution) e a persistência (Firestore) são adapters — isso deixa a
// validação rodar local com fakes, sem tocar em rede.

export type ConversationMode = string; // 'idle' | 'help' | 'help_capture' | 'diagnosis' | 'reminder' | 'awaiting_link'

export type Option = { id: string; label: string };

export type LinkedAccount = { uid: string; workspaceId: string };

export type ConversationState = {
  mode: ConversationMode;
  context?: string | null; // INTENÇÃO PENDENTE (ex.: 'diagnosis' guardado até o vínculo fechar)
  turnCount: number;
  lastActivityAt: number;  // epoch ms
};

// Serviços que uma folha pode acionar (ações, nunca apresentação).
export type LeafServices = {
  sendHelpEmail: (phone: string, text: string) => Promise<void>;
  // Diagnóstico REAL (conta + cartão, renda derivada). A folha não sabe de IA/Firestore —
  // só pede o texto pronto pro serviço injetado.
  getDiagnosis: (account: LinkedAccount) => Promise<string>;
};

export type LeafContext = {
  phone: string;           // E.164
  text: string;            // texto cru do inbound (o que uma folha 'raw' consumiria)
  normalizedText: string;  // trim + minúsculo + sem acento (folhas 'structured' casam por aqui)
  state: ConversationState;
  account: LinkedAccount | null; // conta vinculada quando o número está em /whatsappLinks
  services: LeafServices;
};

// A folha devolve OU um texto OU uma lista SEMÂNTICA de opções — NUNCA a string do
// menu montada. Quem renderiza é o transporte.
export type LeafResult = {
  reply?: string;
  options?: Option[];
  optionsHeader?: string;
  nextMode?: ConversationMode;      // pra onde a conversa vai depois deste turno
  context?: string | null;          // set/limpa a intenção pendente (undefined = não mexe)
  dispatchNext?: boolean;           // roteador: rodar já a folha de nextMode (seleção de menu)
};

export interface Leaf {
  mode: ConversationMode;
  inputType: "structured" | "raw"; // v1: todas 'structured'. 'raw' é a porta do oráculo (dormível).
  requiresLink: boolean;
  handle(ctx: LeafContext): Promise<LeafResult> | LeafResult;
}

// Adapter de persistência (Firestore em prod, fake em teste). O roteador só conhece
// esta interface — nunca o Firestore direto.
export interface ConversationStore {
  loadState(phone: string): Promise<ConversationState | null>;
  saveState(phone: string, state: ConversationState): Promise<void>;
  getLink(phone: string): Promise<LinkedAccount | null>;
  // vínculo/código:
  findValidCode(code: string, now: number): Promise<LinkedAccount | null>;
  burnCode(code: string): Promise<void>;
  saveLink(phone: string, account: LinkedAccount, now: number): Promise<void>;
}

export type Inbound = { phone: string; text: string };

export type Deps = {
  store: ConversationStore;
  services: LeafServices;
  now: () => number;
};
