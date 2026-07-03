// ─── Adapter Firestore do ConversationStore (prod) ───────────────────────────
// Único lugar que fala Firestore. O roteador só conhece a interface ConversationStore;
// os testes injetam um fake em memória. Datas em ms (número) pra casar a matemática de
// timeout do roteador sem conversão.
import type * as adminType from "firebase-admin";
import type { ConversationState, ConversationStore, LinkedAccount } from "./types";

type Firestore = adminType.firestore.Firestore;

export function firestoreStore(db: Firestore): ConversationStore {
  const conversations = () => db.collection("whatsappConversations");
  const links = () => db.collection("whatsappLinks");
  const codes = () => db.collection("whatsappVerificationCodes");

  return {
    async loadState(phone) {
      const snap = await conversations().doc(phone).get();
      if (!snap.exists) return null;
      const d = snap.data() as Partial<ConversationState> | undefined;
      if (!d || typeof d.mode !== "string") return null;
      return {
        mode: d.mode,
        context: d.context ?? null,
        turnCount: typeof d.turnCount === "number" ? d.turnCount : 0,
        lastActivityAt: typeof d.lastActivityAt === "number" ? d.lastActivityAt : 0,
      };
    },

    async saveState(phone, state: ConversationState) {
      await conversations().doc(phone).set(
        {
          mode: state.mode,
          context: state.context ?? null,
          turnCount: state.turnCount,
          lastActivityAt: state.lastActivityAt,
        },
        { merge: true }
      );
    },

    async getLink(phone): Promise<LinkedAccount | null> {
      const snap = await links().doc(phone).get();
      if (!snap.exists) return null;
      const d = snap.data() as { uid?: string; workspaceId?: string } | undefined;
      if (!d?.uid || !d?.workspaceId) return null;
      return { uid: d.uid, workspaceId: d.workspaceId };
    },

    async findValidCode(code, now): Promise<LinkedAccount | null> {
      const snap = await codes().doc(code).get();
      if (!snap.exists) return null;
      const d = snap.data() as
        | { uid?: string; workspaceId?: string; used?: boolean; expiresAt?: number }
        | undefined;
      if (!d || d.used === true) return null;
      if (typeof d.expiresAt !== "number" || d.expiresAt <= now) return null;
      if (!d.uid || !d.workspaceId) return null;
      return { uid: d.uid, workspaceId: d.workspaceId };
    },

    async burnCode(code) {
      await codes().doc(code).set({ used: true }, { merge: true });
    },

    async saveLink(phone, account, now) {
      await links().doc(phone).set(
        { uid: account.uid, workspaceId: account.workspaceId, verifiedAt: now },
        { merge: true }
      );
    },
  };
}
