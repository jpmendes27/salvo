"use client";

import { onAuthStateChanged, type User } from "firebase/auth";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  writeBatch
} from "firebase/firestore";
import { ChevronLeft, Mail, Trash2, X } from "lucide-react";
import { Suspense, useEffect, useRef, useState } from "react";
import { auth, db } from "@/lib/firebase";
import type { Member, Workspace } from "@/lib/types";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";
const G = "#b8f55a";

const SEND_EMAIL_FUNCTION_URL =
  process.env.NEXT_PUBLIC_SEND_EMAIL_URL ||
  "https://sendinviteemail-ihalwtxjpq-uc.a.run.app";

const SEND_WA_FUNCTION_URL =
  process.env.NEXT_PUBLIC_SEND_WA_URL ||
  "https://sendinvitewhatsapp-ihalwtxjpq-uc.a.run.app";

type Profile = { displayName: string; email: string };

// ─── Root (suspense boundary for useSearchParams) ────────────────────────────

export default function MembersRoot() {
  return (
    <Suspense fallback={<Loader />}>
      <MembersPage />
    </Suspense>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

function MembersPage() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      setWorkspaceId(params.get("workspace"));
    }
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u && !u.emailVerified) window.location.replace(`${BASE}/login`);
      if (!u) window.location.replace(`${BASE}/login`);
    });
  }, []);

  if (user === undefined) return <Loader />;
  if (!user || !workspaceId) return <Loader />;

  return <MembersApp user={user} workspaceId={workspaceId} />;
}

// ─── App ─────────────────────────────────────────────────────────────────────

function MembersApp({ user, workspaceId }: { user: User; workspaceId: string }) {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOwner, setIsOwner] = useState(false);
  const [inviteLink, setInviteLink] = useState("");
  const [inviteModal, setInviteModal] = useState<"whatsapp" | "email" | null>(null);
  const [removeTarget, setRemoveTarget] = useState<Member | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    async function load() {
      const [wsSnap, profileSnap, membersSnap] = await Promise.all([
        getDoc(doc(db, "workspaces", workspaceId)),
        getDoc(doc(db, "users", user.uid)),
        getDocs(collection(db, "workspaces", workspaceId, "members"))
      ]);

      if (!wsSnap.exists()) {
        window.location.replace(`${BASE}/home`);
        return;
      }

      setWorkspace({ id: wsSnap.id, ...wsSnap.data() } as Workspace);
      setProfile(profileSnap.exists() ? (profileSnap.data() as Profile) : null);

      const active = membersSnap.docs
        .map((d) => ({ id: d.id, ...d.data() } as Member))
        .filter((m) => m.status === "active");

      active.sort((a, b) => {
        if (a.role === "owner") return -1;
        if (b.role === "owner") return 1;
        return (a.displayName || "").localeCompare(b.displayName || "");
      });

      setMembers(active);

      const myMember = membersSnap.docs.find((d) => d.id === user.uid);
      setIsOwner(myMember?.data()?.role === "owner");
      setLoading(false);
    }

    load().catch(() => window.location.replace(`${BASE}/home`));
  }, [workspaceId, user.uid]);

  async function createInvite() {
    const token = crypto.randomUUID();
    const createdByName = profile?.displayName || user.displayName || user.email?.split("@")[0] || "Alguém";
    await setDoc(doc(db, "invites", token), {
      workspaceId,
      workspaceName: workspace!.name,
      createdBy: user.uid,
      createdByName,
      status: "active",
      createdAt: serverTimestamp(),
      expiresAt: Timestamp.fromDate(new Date(Date.now() + 24 * 60 * 60 * 1000))
    });
    const link = `${window.location.origin}${BASE}/convite?token=${token}`;
    setInviteLink(link);
    return link;
  }

  async function handleInvite(type: "whatsapp" | "email") {
    const link = inviteLink || await createInvite();
    setInviteLink(link);
    setInviteModal(type);
  }

  async function handleRemove(m: Member) {
    setBusy(true);
    await updateDoc(doc(db, "workspaces", workspaceId, "members", m.uid), {
      status: "removed",
      removedAt: serverTimestamp()
    });
    setMembers((prev) => prev.filter((x) => x.uid !== m.uid));
    setRemoveTarget(null);
    setBusy(false);
  }

  async function handleDelete() {
    if (!workspace) return;
    const conf = window.prompt(`Digite "${workspace.name}" para confirmar a exclusão permanente.`);
    if (conf !== workspace.name) return;
    setBusy(true);
    const batch = writeBatch(db);
    for (const col of ["transactions", "categories", "summaries", "plannedItems", "openFinanceWaitlist"]) {
      const snap = await getDocs(collection(db, "workspaces", workspaceId, col));
      snap.docs.forEach((d) => batch.delete(d.ref));
    }
    batch.delete(doc(db, "workspaces", workspaceId));
    await batch.commit();
    const membersSnap = await getDocs(collection(db, "workspaces", workspaceId, "members"));
    for (const md of membersSnap.docs) await deleteDoc(md.ref);
    window.location.replace(`${BASE}/home`);
  }

  async function handleLeave() {
    setBusy(true);
    await updateDoc(doc(db, "workspaces", workspaceId, "members", user.uid), {
      status: "left",
      leftAt: serverTimestamp()
    });
    window.location.replace(`${BASE}/home`);
  }

  function goBack() {
    window.location.replace(`${BASE}/home?workspace=${workspaceId}`);
  }

  if (loading || !workspace) return <Loader />;

  return (
    <div style={{ minHeight: "100vh", background: "#050505", color: "#fff", fontFamily: "inherit" }}>
      <div style={{ maxWidth: 560, margin: "0 auto", padding: "0 16px 64px" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "28px 0 24px" }}>
          <button
            onClick={goBack}
            style={{
              background: "rgba(255,255,255,0.07)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 10,
              color: "rgba(255,255,255,0.7)",
              cursor: "pointer",
              padding: "8px 10px",
              display: "flex",
              alignItems: "center",
              flexShrink: 0
            }}
          >
            <ChevronLeft size={18} />
          </button>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 700, lineHeight: 1.2 }}>Pessoas</h1>
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 3 }}>
              Quem tem acesso ao workspace{" "}
              <strong style={{ color: "rgba(255,255,255,0.65)" }}>{workspace.name}</strong>
            </p>
          </div>
        </div>

        {/* Members card */}
        <div
          style={{
            background: "#0e0f11",
            border: "1px solid rgba(255,255,255,0.09)",
            borderRadius: 18,
            overflow: "hidden",
            marginBottom: 16
          }}
        >
          <div style={{ padding: "6px 0" }}>
            {members.map((m, i) => {
              const initial = (m.displayName || m.email || "?")[0].toUpperCase();
              const isMe = m.uid === user.uid;
              const memberIsOwner = m.role === "owner";
              return (
                <div
                  key={m.uid}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "14px 20px",
                    borderBottom: i < members.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none"
                  }}
                >
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: "50%",
                      background: memberIsOwner ? `${G}22` : "rgba(255,255,255,0.07)",
                      border: `1.5px solid ${memberIsOwner ? `${G}55` : "rgba(255,255,255,0.1)"}`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 15,
                      fontWeight: 700,
                      color: memberIsOwner ? G : "rgba(255,255,255,0.6)",
                      flexShrink: 0
                    }}
                  >
                    {initial}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {m.displayName || m.email?.split("@")[0] || "—"}
                      </span>
                      {isMe && (
                        <span style={{ fontSize: 10, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 5, padding: "1px 6px", color: "rgba(255,255,255,0.4)", flexShrink: 0 }}>
                          você
                        </span>
                      )}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {m.email}
                      </span>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          color: memberIsOwner ? G : "rgba(255,255,255,0.45)",
                          background: memberIsOwner ? `${G}15` : "rgba(255,255,255,0.06)",
                          border: `1px solid ${memberIsOwner ? `${G}35` : "rgba(255,255,255,0.1)"}`,
                          borderRadius: 5,
                          padding: "1px 6px",
                          flexShrink: 0
                        }}
                      >
                        {memberIsOwner ? "Dono" : "Editor"}
                      </span>
                    </div>
                  </div>

                  {isOwner && !memberIsOwner && (
                    <button
                      onClick={() => setRemoveTarget(m)}
                      style={{
                        background: "rgba(255,80,80,0.08)",
                        border: "1px solid rgba(255,80,80,0.18)",
                        borderRadius: 8,
                        color: "#ff8080",
                        cursor: "pointer",
                        fontSize: 11,
                        fontWeight: 600,
                        padding: "6px 10px",
                        whiteSpace: "nowrap",
                        flexShrink: 0
                      }}
                    >
                      Remover
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Invite section — owner only */}
          {isOwner && (
            <div style={{ borderTop: "1px solid rgba(255,255,255,0.07)", padding: "20px" }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.3)", letterSpacing: "0.08em", marginBottom: 12 }}>
                CONVIDAR MAIS PESSOAS
              </p>
              <div style={{ display: "flex", gap: 10 }}>
                <button
                  onClick={() => handleInvite("whatsapp")}
                  style={{
                    flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                    background: "rgba(37,211,102,0.1)", border: "1px solid rgba(37,211,102,0.2)",
                    borderRadius: 10, color: "#25d366", cursor: "pointer", fontSize: 13, fontWeight: 600, padding: "11px 0"
                  }}
                >
                  <WhatsAppIcon /> WhatsApp
                </button>
                <button
                  onClick={() => handleInvite("email")}
                  style={{
                    flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                    background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 10, color: "rgba(255,255,255,0.7)", cursor: "pointer", fontSize: 13, fontWeight: 600, padding: "11px 0"
                  }}
                >
                  <Mail size={15} /> E-mail
                </button>
              </div>
            </div>
          )}

          {/* Destructive */}
          <div style={{ borderTop: "1px solid rgba(255,255,255,0.07)", padding: "16px 20px" }}>
            {isOwner ? (
              <button
                disabled={busy}
                onClick={handleDelete}
                style={{
                  width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                  fontWeight: 700, fontSize: 13, color: "#ff8080",
                  background: "rgba(255,80,80,0.08)", border: "1px solid rgba(255,80,80,0.18)",
                  borderRadius: 10, padding: "11px 0", cursor: "pointer"
                }}
              >
                <Trash2 size={14} /> Excluir workspace
              </button>
            ) : (
              <button
                disabled={busy}
                onClick={handleLeave}
                style={{
                  width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                  fontWeight: 700, fontSize: 13, color: "rgba(255,255,255,0.5)",
                  background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 10, padding: "11px 0", cursor: "pointer"
                }}
              >
                Sair do workspace
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Remove confirmation */}
      {removeTarget && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
          onClick={(e) => e.target === e.currentTarget && setRemoveTarget(null)}
        >
          <div style={{ background: "#0e0f11", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 18, width: "100%", maxWidth: 380, padding: 24 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Remover acesso</h3>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", lineHeight: 1.5, marginBottom: 24 }}>
              <strong style={{ color: "rgba(255,255,255,0.8)" }}>{removeTarget.displayName || removeTarget.email}</strong> perderá o acesso ao workspace. Você pode convidá-la novamente depois.
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => setRemoveTarget(null)}
                style={{ flex: 1, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, color: "rgba(255,255,255,0.6)", cursor: "pointer", fontSize: 13, fontWeight: 600, padding: "10px 0" }}
              >
                Cancelar
              </button>
              <button
                disabled={busy}
                onClick={() => handleRemove(removeTarget)}
                style={{ flex: 1, background: "rgba(255,80,80,0.15)", border: "1px solid rgba(255,80,80,0.25)", borderRadius: 10, color: "#ff8080", cursor: "pointer", fontSize: 13, fontWeight: 700, padding: "10px 0" }}
              >
                {busy ? "Removendo..." : "Remover"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invite modal */}
      {inviteModal && (
        <InviteModal
          type={inviteModal}
          workspaceName={workspace.name}
          inviteLink={inviteLink}
          senderName={profile?.displayName || user.displayName || user.email?.split("@")[0] || "Alguém"}
          members={members}
          onClose={() => setInviteModal(null)}
        />
      )}
    </div>
  );
}

// ─── Invite modal ─────────────────────────────────────────────────────────────

function InviteModal({
  type,
  workspaceName,
  inviteLink,
  senderName,
  members,
  onClose
}: {
  type: "whatsapp" | "email";
  workspaceName: string;
  inviteLink: string;
  senderName: string;
  members: Member[];
  onClose: () => void;
}) {
  const isWa = type === "whatsapp";
  const [countryCode, setCountryCode] = useState("+55");
  const [rawPhone, setRawPhone] = useState("");
  const [emailAddr, setEmailAddr] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState("");

  const displayPhone = countryCode === "+55"
    ? formatBrazilianPhone(rawPhone.replace(/\D/g, ""))
    : rawPhone;

  function handlePhoneChange(val: string) {
    if (countryCode === "+55") setRawPhone(val.replace(/\D/g, "").slice(0, 11));
    else setRawPhone(val);
  }

  async function send() {
    setErr("");
    if (isWa) {
      const digits = rawPhone.replace(/\D/g, "");
      if (!digits) { setErr("Digite o número do WhatsApp."); return; }
      const phone = countryCode.replace("+", "") + digits;
      setSending(true);
      try {
        const resp = await fetch(SEND_WA_FUNCTION_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone, workspaceName, inviteLink, fromName: senderName })
        });
        const data = await resp.json() as { success?: boolean; error?: string };
        if (!resp.ok || data.error) throw new Error(data.error || "Falha ao enviar.");
        setSent(true);
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Erro ao enviar mensagem.");
      } finally { setSending(false); }
    } else {
      if (!emailAddr.trim()) { setErr("Digite o email do convidado."); return; }
      if (members.some(m => m.email === emailAddr.trim() && m.status === "active")) {
        setErr("Este e-mail já tem acesso à conta.");
        return;
      }
      setSending(true);
      try {
        const resp = await fetch(SEND_EMAIL_FUNCTION_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ to: emailAddr.trim(), workspaceName, inviteLink, fromName: senderName })
        });
        const data = await resp.json() as { success?: boolean; error?: string };
        if (!resp.ok || data.error) throw new Error(data.error || "Falha ao enviar.");
        setSent(true);
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Erro ao enviar email.");
      } finally { setSending(false); }
    }
  }

  const inp: React.CSSProperties = {
    width: "100%", boxSizing: "border-box",
    background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 8, color: "#fff", fontSize: 14, padding: "10px 12px",
    outline: "none", marginBottom: 12
  };

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.72)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
      onClick={onClose}
    >
      <div
        style={{ background: "#111214", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 16, padding: "28px 28px 24px", width: "100%", maxWidth: 400 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {isWa ? <WhatsAppIcon /> : <Mail size={18} color="#fff" />}
            <h3 style={{ fontSize: 15, fontWeight: 800 }}>
              {isWa ? "Enviar por WhatsApp" : "Enviar por Email"}
            </h3>
          </div>
          <button onClick={onClose} style={{ background: "rgba(255,255,255,0.07)", border: "none", borderRadius: 8, color: "rgba(255,255,255,0.5)", cursor: "pointer", padding: "6px 8px", display: "flex" }}>
            <X size={16} />
          </button>
        </div>

        {sent ? (
          <div style={{ textAlign: "center", padding: "16px 0 8px" }}>
            <p style={{ fontSize: 15, fontWeight: 700, color: G, marginBottom: 6 }}>
              {isWa ? "Mensagem enviada!" : "Email enviado!"}
            </p>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.4)" }}>
              O convite foi enviado para {isWa ? displayPhone : emailAddr}.
            </p>
            <button onClick={onClose} style={{ marginTop: 20, width: "100%", padding: "10px", borderRadius: 8, background: G, border: "none", color: "#000", fontSize: 13, fontWeight: 800, cursor: "pointer" }}>
              Fechar
            </button>
          </div>
        ) : (
          <>
            {isWa ? (
              <div style={{ display: "flex", gap: 8, marginBottom: 0 }}>
                <select
                  value={countryCode}
                  onChange={(e) => setCountryCode(e.target.value)}
                  style={{ ...inp, width: "auto", marginBottom: 12, flexShrink: 0 }}
                >
                  <option value="+55">🇧🇷 +55</option>
                  <option value="+1">🇺🇸 +1</option>
                  <option value="+351">🇵🇹 +351</option>
                </select>
                <input
                  style={{ ...inp, flex: 1 }}
                  placeholder="(21) 99999-9999"
                  value={displayPhone}
                  onChange={(e) => handlePhoneChange(e.target.value)}
                />
              </div>
            ) : (
              <input
                style={inp}
                placeholder="email@exemplo.com"
                value={emailAddr}
                onChange={(e) => setEmailAddr(e.target.value)}
              />
            )}

            {err && <p style={{ fontSize: 12, color: "#ff8080", marginBottom: 10 }}>{err}</p>}

            <button
              onClick={send}
              disabled={sending}
              style={{ width: "100%", padding: "11px", borderRadius: 8, background: G, border: "none", color: "#000", fontSize: 14, fontWeight: 800, cursor: "pointer" }}
            >
              {sending ? "Enviando..." : "Enviar convite"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function Loader() {
  return (
    <div style={{ minHeight: "100vh", background: "#050505", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: 28, height: 28, border: `3px solid ${G}33`, borderTop: `3px solid ${G}`, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function formatBrazilianPhone(d: string): string {
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

function WhatsAppIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}
