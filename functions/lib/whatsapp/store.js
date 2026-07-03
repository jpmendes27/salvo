"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.firestoreStore = firestoreStore;
function firestoreStore(db) {
    const conversations = () => db.collection("whatsappConversations");
    const links = () => db.collection("whatsappLinks");
    const codes = () => db.collection("whatsappVerificationCodes");
    return {
        async loadState(phone) {
            const snap = await conversations().doc(phone).get();
            if (!snap.exists)
                return null;
            const d = snap.data();
            if (!d || typeof d.mode !== "string")
                return null;
            return {
                mode: d.mode,
                context: d.context ?? null,
                turnCount: typeof d.turnCount === "number" ? d.turnCount : 0,
                lastActivityAt: typeof d.lastActivityAt === "number" ? d.lastActivityAt : 0,
            };
        },
        async saveState(phone, state) {
            await conversations().doc(phone).set({
                mode: state.mode,
                context: state.context ?? null,
                turnCount: state.turnCount,
                lastActivityAt: state.lastActivityAt,
            }, { merge: true });
        },
        async getLink(phone) {
            const snap = await links().doc(phone).get();
            if (!snap.exists)
                return null;
            const d = snap.data();
            if (!d?.uid || !d?.workspaceId)
                return null;
            return { uid: d.uid, workspaceId: d.workspaceId };
        },
        async findValidCode(code, now) {
            const snap = await codes().doc(code).get();
            if (!snap.exists)
                return null;
            const d = snap.data();
            if (!d || d.used === true)
                return null;
            if (typeof d.expiresAt !== "number" || d.expiresAt <= now)
                return null;
            if (!d.uid || !d.workspaceId)
                return null;
            return { uid: d.uid, workspaceId: d.workspaceId };
        },
        async burnCode(code) {
            await codes().doc(code).set({ used: true }, { merge: true });
        },
        async saveLink(phone, account, now) {
            await links().doc(phone).set({ uid: account.uid, workspaceId: account.workspaceId, verifiedAt: now }, { merge: true });
        },
    };
}
//# sourceMappingURL=store.js.map