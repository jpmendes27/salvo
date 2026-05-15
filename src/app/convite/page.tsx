"use client";

import {
  createUserWithEmailAndPassword,
  fetchSignInMethodsForEmail,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  type User
} from "firebase/auth";
import {
  addDoc,
  arrayUnion,
  collection,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  writeBatch
} from "firebase/firestore";
import {
  ArrowRight,
  Calendar,
  Check,
  ChevronLeft,
  Eye,
  Mail,
  MessageCircle,
  TrendingUp
} from "lucide-react";
import { FormEvent, Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { auth, db, googleProvider } from "@/lib/firebase";
import { consentText, PRIVACY_VERSION, TERMS_VERSION } from "@/lib/legal";
import type { Invite } from "@/lib/types";

const G = "#b8f55a";
const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";
const SEND_VERIFICATION_URL =
  process.env.NEXT_PUBLIC_SEND_VERIFICATION_URL ||
  "https://sendverificationcode-ihalwtxjpq-uc.a.run.app";
const VERIFY_CODE_URL =
  process.env.NEXT_PUBLIC_VERIFY_CODE_URL ||
  "https://verifycode-ihalwtxjpq-uc.a.run.app";

// ─── helpers ─────────────────────────────────────────────────────────────────

function maskPhone(value: string): string {
  const d = value.replace(/\D/g, "").slice(0, 11);
  if (!d) return "";
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

function maskCPF(value: string): string {
  const d = value.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

function maskPhoneDisplay(phone: string): string {
  const d = phone.replace(/\D/g, "").replace(/^55/, "");
  if (d.length < 8) return phone;
  return `(${d.slice(0, 2)}) ${d.slice(2, 3)}****-${d.slice(-4)}`;
}

function maskEmailDisplay(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain || !local) return email;
  return `${local[0]}***@${domain}`;
}

function errMsg(err: unknown): string {
  if (err instanceof Error) {
    if (err.message.includes("email-already-in-use"))
      return "Este e-mail já tem uma conta. Tente entrar acima.";
    if (err.message.includes("weak-password"))
      return "Senha muito fraca. Use ao menos 8 caracteres.";
    if (err.message.includes("invalid-email")) return "E-mail inválido.";
    if (err.message.includes("wrong-password") || err.message.includes("invalid-credential"))
      return "Senha incorreta. Tente de novo.";
    if (err.message.includes("too-many-requests"))
      return "Muitas tentativas. Aguarde alguns minutos e tente de novo.";
    return err.message;
  }
  return "Algo deu errado. Tente de novo.";
}

// ─── Logo ─────────────────────────────────────────────────────────────────────

function Logo() {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 0 }}>
      <span style={{ fontFamily: "'DM Serif Display', serif", fontWeight: 700, fontSize: "1.1rem", color: G, letterSpacing: "-0.02em", lineHeight: 1 }}>fincheck</span>
      <span style={{ fontFamily: "'DM Serif Display', serif", fontWeight: 700, fontSize: "1.1rem", color: "#fff", letterSpacing: "-0.02em", lineHeight: 1 }}>pro</span>
      <sup style={{ fontFamily: "'DM Mono', monospace", fontSize: "0.42rem", verticalAlign: "super", color: G, fontWeight: 400, marginLeft: 1 }}>®</sup>
    </div>
  );
}

// ─── Shell (loading / error) ──────────────────────────────────────────────────

function InviteShell({ error }: { error?: string }) {
  return (
    <main style={{ minHeight: "100vh", background: "#050505", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px 16px", fontFamily: "inherit" }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div style={{ width: "100%", maxWidth: 400 }}>
        <div style={{ marginBottom: 32 }}><Logo /></div>
        {error ? (
          <>
            <p style={{ color: "rgba(255,255,255,0.45)", fontSize: "0.9rem", marginBottom: 24 }}>{error}</p>
            <button
              onClick={() => { window.location.href = `${BASE}/login`; }}
              style={{ width: "100%", padding: "14px", borderRadius: 12, background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.6)", border: "1px solid rgba(255,255,255,0.08)", cursor: "pointer", fontSize: "0.9rem", fontWeight: 600 }}
            >
              Ir para o Fincheck Pro
            </button>
          </>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 18, height: 18, borderRadius: "50%", border: `2px solid ${G}`, borderTopColor: "transparent", animation: "spin 0.7s linear infinite" }} />
            <span style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.9rem" }}>Abrindo convite…</span>
          </div>
        )}
      </div>
    </main>
  );
}

// ─── Success screen ───────────────────────────────────────────────────────────

function InviteSuccess() {
  return (
    <main style={{ minHeight: "100vh", background: "#050505", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px 16px", fontFamily: "inherit" }}>
      <div style={{ width: "100%", maxWidth: 400, textAlign: "center" }}>
        <div style={{ width: 64, height: 64, borderRadius: "50%", background: G, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px" }}>
          <Check size={30} color="#050505" strokeWidth={3} />
        </div>
        <p style={{ color: "#fff", fontSize: "1.2rem", fontWeight: 800, marginBottom: 8, letterSpacing: "-0.02em" }}>Bem-vindo!</p>
        <p style={{ color: "rgba(255,255,255,0.45)", fontSize: "0.9rem" }}>Abrindo o painel…</p>
      </div>
    </main>
  );
}

// ─── Page entry ───────────────────────────────────────────────────────────────

export default function InvitePage() {
  return (
    <Suspense fallback={<InviteShell />}>
      <InviteFlow />
    </Suspense>
  );
}

// ─── Orchestrator ─────────────────────────────────────────────────────────────

function InviteFlow() {
  const token = useSearchParams().get("token") || "";
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [invite, setInvite] = useState<Invite | null>(null);
  const [inviteError, setInviteError] = useState("");
  const [inviteLoading, setInviteLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => setUser(u));
  }, []);

  useEffect(() => {
    if (!token) { setInviteLoading(false); return; }
    (async () => {
      try {
        const snap = await getDoc(doc(db, "invites", token));
        if (!snap.exists()) { setInviteError("Convite não encontrado ou expirado."); return; }
        const data = { id: snap.id, ...snap.data() } as Invite;
        if (data.status === "accepted") { setInviteError("Este convite já foi aceito."); return; }
        if (data.status !== "active") { setInviteError("Este convite foi cancelado."); return; }
        const exp = data.expiresAt instanceof Timestamp ? data.expiresAt.toDate() : null;
        if (exp && exp < new Date()) { setInviteError("Este convite expirou. Peça um novo link."); return; }
        setInvite(data);
      } catch (err) {
        setInviteError(err instanceof Error ? err.message : "Erro ao carregar convite.");
      } finally {
        setInviteLoading(false);
      }
    })();
  }, [token]);

  if (!token) return <InviteShell error="Link de convite inválido." />;
  if (inviteLoading || user === undefined) return <InviteShell />;
  if (inviteError) return <InviteShell error={inviteError} />;
  if (!invite) return <InviteShell />;

  if (user) return <ExistingUserAccept user={user} invite={invite} />;
  return <UnifiedInviteFlow invite={invite} />;
}

// ─── Existing user accept ─────────────────────────────────────────────────────

function ExistingUserAccept({ user, invite }: { user: User; invite: Invite }) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const inviterName = invite.createdByName || "Alguém";

  async function accept() {
    setError("");
    setBusy(true);
    try {
      const displayName = user.displayName || user.email?.split("@")[0] || "Convidado";

      const memberSnap = await getDoc(doc(db, "workspaces", invite.workspaceId, "members", user.uid));
      if (memberSnap.exists() && memberSnap.data()?.status === "active") {
        window.location.replace(`${BASE}/home?workspace=${invite.workspaceId}`);
        return;
      }

      const batch = writeBatch(db);
      batch.set(doc(db, "workspaces", invite.workspaceId, "members", user.uid), {
        uid: user.uid,
        role: "editor",
        status: "active",
        displayName,
        email: user.email || "",
        inviteId: invite.id,
        createdBy: invite.createdBy,
        joinedAt: serverTimestamp()
      });
      batch.update(doc(db, "invites", invite.id), {
        status: "accepted",
        acceptedAt: serverTimestamp(),
        acceptedBy: user.uid,
        acceptedByEmail: user.email || ""
      });
      batch.set(doc(db, "users", user.uid), {
        workspaceIds: arrayUnion(invite.workspaceId),
        updatedAt: serverTimestamp()
      }, { merge: true });
      await batch.commit();

      await updateDoc(doc(db, "workspaces", invite.workspaceId), {
        memberEmails: arrayUnion(user.email || "")
      }).catch(() => {});

      await addDoc(collection(db, "consents"), {
        uid: user.uid,
        email: user.email || "",
        termsVersion: TERMS_VERSION,
        privacyVersion: PRIVACY_VERSION,
        text: consentText,
        purpose: "invite_workspace_access",
        createdAt: serverTimestamp()
      });

      setDone(true);
      setTimeout(() => { window.location.replace(`${BASE}/home?workspace=${invite.workspaceId}`); }, 1400);
    } catch (err) {
      setError(errMsg(err));
      setBusy(false);
    }
  }

  if (done) return <InviteSuccess />;

  return (
    <main style={{ minHeight: "100vh", background: "#050505", color: "#fff", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px 16px", fontFamily: "inherit" }}>
      <style>{`
        @keyframes fadeUp { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
      <div style={{ width: "100%", maxWidth: 400, animation: "fadeUp .4s ease both" }}>
        <div style={{ marginBottom: 36 }}><Logo /></div>

        <div style={{ position: "relative", display: "inline-block", marginBottom: 20 }}>
          <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(184,245,90,0.12)", border: "1.5px solid rgba(184,245,90,0.25)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.4rem", fontWeight: 700, color: G }}>
            {inviterName.charAt(0).toUpperCase()}
          </div>
          <div style={{ position: "absolute", bottom: -2, right: -2, width: 20, height: 20, borderRadius: "50%", background: G, border: "2px solid #050505", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ color: "#050505", fontSize: "0.7rem", fontWeight: 900 }}>+</span>
          </div>
        </div>

        <h1 style={{ margin: "0 0 8px", fontSize: "1.45rem", fontWeight: 800, color: "#fff", lineHeight: 1.25, letterSpacing: "-0.025em" }}>
          {inviterName} te convidou para gerir as finanças juntos
        </h1>
        <p style={{ margin: "0 0 4px", color: "rgba(255,255,255,0.4)", fontSize: "0.85rem" }}>
          Entrando como <span style={{ color: "rgba(255,255,255,0.7)" }}>{user.email}</span>
        </p>
        <p onClick={() => auth.signOut()} style={{ margin: "0 0 28px", color: "rgba(255,255,255,0.25)", fontSize: "0.8rem", cursor: "pointer", textDecoration: "underline" }}>
          Não é você? Sair
        </p>

        {error && (
          <div style={{ padding: "12px 14px", borderRadius: 10, marginBottom: 16, background: "rgba(255,128,128,0.08)", border: "1px solid rgba(255,128,128,0.2)", color: "#ff8080", fontSize: "0.85rem" }}>
            {error}
          </div>
        )}

        <button
          onClick={accept}
          disabled={busy}
          style={{ width: "100%", padding: "14px", borderRadius: 12, background: busy ? "rgba(184,245,90,0.6)" : G, color: "#050505", border: "none", cursor: busy ? "default" : "pointer", fontSize: "0.95rem", fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
        >
          {busy
            ? <div style={{ width: 16, height: 16, border: "2px solid rgba(0,0,0,0.3)", borderTopColor: "#000", borderRadius: "50%", animation: "spin .7s linear infinite" }} />
            : <>Aceitar convite <ArrowRight size={15} /></>}
        </button>
      </div>
    </main>
  );
}

// ─── Unified flow (unauthenticated users) ────────────────────────────────────

type InviteStep = "email" | "login" | "phone" | "verify" | "name" | "cpf" | "password";
const NEW_USER_STEPS: InviteStep[] = ["phone", "verify", "name", "cpf", "password"];

function UnifiedInviteFlow({ invite }: { invite: Invite }) {
  const [step, setStep] = useState<InviteStep>("email");

  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [nome, setNome] = useState("");
  const [cpf, setCpf] = useState("");
  const [senha, setSenha] = useState("");
  const [senhaConfirm, setSenhaConfirm] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  const [tempKey] = useState(() => crypto.randomUUID());
  const [channel, setChannel] = useState<"whatsapp" | "email" | null>(null);
  const [codeSent, setCodeSent] = useState(false);
  const [code, setCode] = useState("");
  const [countdown, setCountdown] = useState(0);
  const [verificationToken, setVerificationToken] = useState("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const emailRef = useRef<HTMLInputElement>(null);
  const loginPasswordRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);
  const nomeRef = useRef<HTMLInputElement>(null);
  const cpfRef = useRef<HTMLInputElement>(null);
  const senhaRef = useRef<HTMLInputElement>(null);
  const senhaConfirmRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    if (step === "email") t = setTimeout(() => emailRef.current?.focus(), 50);
    else if (step === "login") t = setTimeout(() => loginPasswordRef.current?.focus(), 50);
    else if (step === "phone") t = setTimeout(() => phoneRef.current?.focus(), 50);
    else if (step === "verify" && codeSent) t = setTimeout(() => codeRef.current?.focus(), 50);
    else if (step === "name") t = setTimeout(() => nomeRef.current?.focus(), 50);
    else if (step === "cpf") t = setTimeout(() => cpfRef.current?.focus(), 50);
    else if (step === "password") t = setTimeout(() => senhaRef.current?.focus(), 50);
    return () => clearTimeout(t as ReturnType<typeof setTimeout>);
  }, [step, codeSent]);

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  async function handleEmailContinue() {
    if (!email.includes("@")) { setError("Digite um e-mail válido."); return; }
    setError("");
    setBusy(true);
    try {
      const methods = await fetchSignInMethodsForEmail(auth, email);
      setStep(methods && methods.length > 0 ? "login" : "phone");
    } catch {
      setStep("phone");
    } finally {
      setBusy(false);
    }
  }

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await signInWithEmailAndPassword(auth, email, loginPassword);
      // onAuthStateChanged in InviteFlow updates user → ExistingUserAccept
    } catch (err) {
      setError(errMsg(err));
      setBusy(false);
    }
  }

  async function handleGoogleLogin() {
    setError("");
    setBusy(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      setError(errMsg(err));
      setBusy(false);
    }
  }

  async function sendCode(ch: "whatsapp" | "email") {
    setChannel(ch);
    setError("");
    setBusy(true);
    try {
      const phoneDigits = phone.replace(/\D/g, "");
      const phoneCC = phoneDigits.startsWith("55") ? phoneDigits : `55${phoneDigits}`;
      const resp = await fetch(SEND_VERIFICATION_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid: tempKey, email, phone: phoneCC, channel: ch })
      });
      if (!resp.ok) {
        const j = await resp.json().catch(() => ({}));
        throw new Error(j.error || "Erro ao enviar código");
      }
      const j = await resp.json();
      setVerificationToken(j.verificationToken || "");
      setCodeSent(true);
      setCountdown(60);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao enviar código");
      setChannel(null);
    } finally {
      setBusy(false);
    }
  }

  async function handleVerifyCode() {
    if (code.length !== 6) return;
    setError("");
    setBusy(true);
    try {
      const resp = await fetch(VERIFY_CODE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid: tempKey, code, token: verificationToken })
      });
      const j = await resp.json();
      if (!resp.ok) throw new Error(j.error || "Código inválido");
      setStep("name");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Código inválido");
    } finally {
      setBusy(false);
    }
  }

  async function handleCpfNext() {
    const cpfDigits = cpf.replace(/\D/g, "");
    if (cpfDigits.length !== 11) { setError("Informe seu CPF completo."); return; }
    setError("");
    setBusy(true);
    try {
      const snap = await getDoc(doc(db, "cpfIndex", cpfDigits));
      if (snap.exists()) { setError("Este CPF já está cadastrado."); setBusy(false); return; }
    } catch { /* ignore and proceed */ }
    setBusy(false);
    setStep("password");
  }

  async function handleFinalSubmit() {
    if (senha.length < 8) { setError("A senha precisa ter ao menos 8 caracteres."); return; }
    if (senha !== senhaConfirm) { setError("As senhas não coincidem."); return; }
    setError("");
    setBusy(true);
    try {
      const credential = await createUserWithEmailAndPassword(auth, email, senha);
      const { user } = credential;

      const displayName = nome.trim() || email.split("@")[0];
      const phoneDigits = phone.replace(/\D/g, "");
      const phoneCC = phoneDigits.startsWith("55") ? phoneDigits : `55${phoneDigits}`;
      const cpfDigits = cpf.replace(/\D/g, "");

      const batch = writeBatch(db);

      batch.set(doc(db, "users", user.uid), {
        uid: user.uid,
        displayName,
        email: user.email || "",
        phone: phoneCC,
        ...(cpfDigits.length === 11 ? { cpf: cpfDigits } : {}),
        accountVerified: true,
        hasCreatedRealMonth: false,
        acceptedTermsVersion: TERMS_VERSION,
        acceptedPrivacyVersion: PRIVACY_VERSION,
        workspaceIds: [invite.workspaceId],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      batch.set(doc(db, "workspaces", invite.workspaceId, "members", user.uid), {
        uid: user.uid,
        role: "editor",
        status: "active",
        displayName,
        email: user.email || "",
        inviteId: invite.id,
        createdBy: invite.createdBy,
        joinedAt: serverTimestamp()
      });

      batch.update(doc(db, "invites", invite.id), {
        status: "accepted",
        acceptedAt: serverTimestamp(),
        acceptedBy: user.uid,
        acceptedByEmail: user.email || ""
      });

      if (cpfDigits.length === 11) {
        batch.set(doc(db, "cpfIndex", cpfDigits), { uid: user.uid });
      }

      await batch.commit();

      await updateDoc(doc(db, "workspaces", invite.workspaceId), {
        memberEmails: arrayUnion(user.email || "")
      }).catch(() => {});

      await addDoc(collection(db, "consents"), {
        uid: user.uid,
        email: user.email || "",
        termsVersion: TERMS_VERSION,
        privacyVersion: PRIVACY_VERSION,
        text: consentText,
        purpose: "invite_workspace_access",
        createdAt: serverTimestamp()
      });

      setDone(true);
      setTimeout(() => { window.location.replace(`${BASE}/home?workspace=${invite.workspaceId}`); }, 1400);
    } catch (err) {
      setError(errMsg(err));
      setBusy(false);
    }
  }

  if (done) return <InviteSuccess />;

  const inviterName = invite.createdByName || "Alguém";
  const newStepIndex = NEW_USER_STEPS.indexOf(step);
  const cpfDigits = cpf.replace(/\D/g, "");
  const canSubmit = !busy && senha.length >= 8 && senha === senhaConfirm;

  return (
    <main style={{ minHeight: "100vh", background: "#050505", color: "#fff", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px 16px", fontFamily: "inherit" }}>
      <style>{`
        @keyframes fadeUp { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes spin { to { transform: rotate(360deg); } }
        .inv-input { transition: border-color .15s, background .15s; }
        .inv-input:focus { border-color: rgba(184,245,90,0.4) !important; background: rgba(184,245,90,0.04) !important; outline: none; }
        .inv-ch-btn { transition: border-color .15s, background .15s; }
        .inv-ch-btn:hover { border-color: rgba(255,255,255,0.2) !important; }
      `}</style>
      <div style={{ width: "100%", maxWidth: 420, animation: "fadeUp .4s ease both" }}>
        <div style={{ marginBottom: 32 }}><Logo /></div>

        {/* ── Email step ── */}
        {step === "email" && (
          <div>
            <div style={{ position: "relative", display: "inline-block", marginBottom: 20 }}>
              <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(184,245,90,0.12)", border: "1.5px solid rgba(184,245,90,0.25)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.4rem", fontWeight: 700, color: G }}>
                {inviterName.charAt(0).toUpperCase()}
              </div>
              <div style={{ position: "absolute", bottom: -2, right: -2, width: 20, height: 20, borderRadius: "50%", background: G, border: "2px solid #050505", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ color: "#050505", fontSize: "0.7rem", fontWeight: 900 }}>+</span>
              </div>
            </div>

            <h1 style={{ margin: "0 0 10px", fontSize: "1.5rem", fontWeight: 800, color: "#fff", lineHeight: 1.25, letterSpacing: "-0.025em" }}>
              {inviterName} quer gerir as finanças com você
            </h1>
            <p style={{ margin: "0 0 24px", color: "rgba(255,255,255,0.5)", fontSize: "0.9rem", lineHeight: 1.6 }}>
              Acompanhem juntos o que entra, o que sai e o que ainda está por vir — sem surpresa no fim do mês.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 28 }}>
              {[
                { icon: Eye, text: "Visão unificada de todas as finanças" },
                { icon: Calendar, text: "Planejamento mês a mês em tempo real" },
                { icon: TrendingUp, text: "Acompanhe tendências de gastos e economia" }
              ].map(({ icon: Icon, text }) => (
                <div key={text} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 34, height: 34, borderRadius: 8, flexShrink: 0, background: "rgba(184,245,90,0.08)", border: "1px solid rgba(184,245,90,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Icon size={15} color={G} />
                  </div>
                  <span style={{ color: "rgba(255,255,255,0.65)", fontSize: "0.875rem" }}>{text}</span>
                </div>
              ))}
            </div>

            <p style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.4)", marginBottom: 6 }}>Qual é o seu e-mail?</p>
            <input
              ref={emailRef}
              className="inv-input"
              type="email"
              placeholder="seu@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === "Enter" && !busy && handleEmailContinue()}
              style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "12px 14px", fontSize: 14, color: "#fff", marginBottom: 16, boxSizing: "border-box" }}
            />

            {error && <div style={{ background: "rgba(255,80,80,0.1)", border: "1px solid rgba(255,80,80,0.2)", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "#ff8080" }}>{error}</div>}

            <button
              onClick={handleEmailContinue}
              disabled={busy}
              style={{ width: "100%", padding: "14px", borderRadius: 12, background: G, color: "#050505", border: "none", cursor: busy ? "default" : "pointer", fontSize: "0.95rem", fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
            >
              {busy
                ? <div style={{ width: 16, height: 16, border: "2px solid rgba(0,0,0,0.3)", borderTopColor: "#000", borderRadius: "50%", animation: "spin .7s linear infinite" }} />
                : <>Continuar <ArrowRight size={16} /></>}
            </button>
          </div>
        )}

        {/* ── Login step (existing account detected) ── */}
        {step === "login" && (
          <div>
            <h1 style={{ margin: "0 0 8px", fontSize: "1.45rem", fontWeight: 800, color: "#fff", lineHeight: 1.25, letterSpacing: "-0.025em" }}>
              Bem-vindo de volta!
            </h1>
            <p style={{ margin: "0 0 24px", color: "rgba(255,255,255,0.5)", fontSize: "0.9rem", lineHeight: 1.6 }}>
              Identificamos uma conta com o e-mail{" "}
              <span style={{ color: "rgba(255,255,255,0.85)" }}>{email}</span>.{" "}
              Entre para aceitar o convite de {inviterName}.
            </p>

            <button
              onClick={handleGoogleLogin}
              disabled={busy}
              style={{ width: "100%", padding: "13px", borderRadius: 10, background: "#fff", color: "#111", border: "none", cursor: busy ? "default" : "pointer", fontSize: "0.875rem", fontWeight: 700, marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}
            >
              <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
                <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908C16.658 14.186 17.64 11.926 17.64 9.2z" fill="#4285F4"/>
                <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.859-3.048.859-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
                <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
                <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
              </svg>
              Entrar com Google
            </button>

            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.08)" }} />
              <span style={{ color: "rgba(255,255,255,0.25)", fontSize: 12 }}>ou com senha</span>
              <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.08)" }} />
            </div>

            <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <input
                ref={loginPasswordRef}
                className="inv-input"
                type="password"
                placeholder="Senha"
                value={loginPassword}
                onChange={e => setLoginPassword(e.target.value)}
                style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "12px 14px", fontSize: 14, color: "#fff", boxSizing: "border-box" }}
              />
              <button
                type="submit"
                disabled={busy || !loginPassword}
                style={{ width: "100%", padding: "13px", borderRadius: 12, background: loginPassword && !busy ? G : "rgba(255,255,255,0.08)", color: loginPassword && !busy ? "#050505" : "rgba(255,255,255,0.3)", border: "none", cursor: loginPassword && !busy ? "pointer" : "default", fontSize: 14, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
              >
                {busy
                  ? <div style={{ width: 16, height: 16, border: "2px solid rgba(0,0,0,0.3)", borderTopColor: "#000", borderRadius: "50%", animation: "spin .7s linear infinite" }} />
                  : <>Entrar <ArrowRight size={15} /></>}
              </button>
            </form>

            {error && <p style={{ fontSize: 13, color: "#ff8080", marginTop: 12 }}>{error}</p>}

            <button
              onClick={() => { setStep("email"); setError(""); setLoginPassword(""); setEmail(""); }}
              style={{ marginTop: 20, background: "transparent", border: "none", color: "rgba(255,255,255,0.3)", cursor: "pointer", fontSize: 13, display: "flex", alignItems: "center", gap: 4 }}
            >
              <ChevronLeft size={14} /> Não sou eu
            </button>
          </div>
        )}

        {/* ── New user steps ── */}
        {newStepIndex >= 0 && (
          <>
            <div style={{ display: "flex", gap: 5, marginBottom: 32 }}>
              {NEW_USER_STEPS.map((s, i) => (
                <div key={s} style={{ flex: 1, height: 3, borderRadius: 2, background: i <= newStepIndex ? G : "rgba(255,255,255,0.1)", transition: "background .3s" }} />
              ))}
            </div>

            {/* phone */}
            {step === "phone" && (
              <div>
                <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 8 }}>Passo 1 de 5</p>
                <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1.2, marginBottom: 8 }}>Qual é o seu WhatsApp?</h1>
                <p style={{ fontSize: 14, color: "rgba(255,255,255,0.45)", lineHeight: 1.6, marginBottom: 24 }}>
                  Precisamos confirmar que é você antes de criar a conta.
                </p>
                <p style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.4)", marginBottom: 6 }}>WhatsApp (com DDD)</p>
                <input
                  ref={phoneRef}
                  className="inv-input"
                  type="tel"
                  inputMode="tel"
                  placeholder="(21) 99999-9999"
                  value={phone}
                  onChange={e => setPhone(maskPhone(e.target.value))}
                  onKeyDown={e => {
                    if (e.key === "Enter" && phone.replace(/\D/g, "").length >= 10) {
                      setError("");
                      setStep("verify");
                    }
                  }}
                  style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "12px 14px", fontSize: 14, color: "#fff", marginBottom: 24 }}
                />

                {error && <div style={{ background: "rgba(255,80,80,0.1)", border: "1px solid rgba(255,80,80,0.2)", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "#ff8080" }}>{error}</div>}

                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => { setStep("email"); setError(""); }} style={{ padding: "12px 16px", borderRadius: 12, background: "transparent", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.5)", fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center" }}>
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    onClick={() => {
                      if (phone.replace(/\D/g, "").length < 10) { setError("Digite um número de WhatsApp válido com DDD."); return; }
                      setError("");
                      setStep("verify");
                    }}
                    style={{ flex: 1, padding: "13px", borderRadius: 12, background: G, border: "none", color: "#050505", fontSize: 14, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
                  >
                    Continuar <ArrowRight size={15} />
                  </button>
                </div>
              </div>
            )}

            {/* verify — channel selector */}
            {step === "verify" && !codeSent && (
              <div>
                <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 8 }}>Passo 2 de 5</p>
                <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1.2, marginBottom: 8 }}>Como quer receber o código?</h1>
                <p style={{ fontSize: 14, color: "rgba(255,255,255,0.45)", lineHeight: 1.6, marginBottom: 24 }}>
                  Confirmamos que é você antes de criar a conta.
                </p>

                <button
                  className="inv-ch-btn"
                  onClick={() => !busy && sendCode("whatsapp")}
                  disabled={busy}
                  style={{ width: "100%", background: "rgba(184,245,90,0.06)", border: `1px solid ${G}`, borderRadius: 14, padding: "16px 20px", display: "flex", alignItems: "center", gap: 14, cursor: "pointer", marginBottom: 10, textAlign: "left" }}
                >
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(184,245,90,0.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    {busy && channel === "whatsapp"
                      ? <div style={{ width: 18, height: 18, border: "2px solid rgba(184,245,90,0.3)", borderTopColor: G, borderRadius: "50%", animation: "spin .7s linear infinite" }} />
                      : <MessageCircle size={20} color={G} />}
                  </div>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 700, color: "#fff", marginBottom: 2 }}>Receber pelo WhatsApp</p>
                    <p style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>{maskPhoneDisplay(phone)}</p>
                  </div>
                  <div style={{ marginLeft: "auto", background: G, color: "#050505", fontSize: 10, fontWeight: 800, padding: "3px 8px", borderRadius: 6, letterSpacing: "0.05em" }}>RECOMENDADO</div>
                </button>

                <button
                  className="inv-ch-btn"
                  onClick={() => !busy && sendCode("email")}
                  disabled={busy}
                  style={{ width: "100%", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 14, padding: "16px 20px", display: "flex", alignItems: "center", gap: 14, cursor: "pointer", textAlign: "left" }}
                >
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    {busy && channel === "email"
                      ? <div style={{ width: 18, height: 18, border: "2px solid rgba(255,255,255,0.2)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin .7s linear infinite" }} />
                      : <Mail size={20} color="rgba(255,255,255,0.5)" />}
                  </div>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.75)", marginBottom: 2 }}>Receber por e-mail</p>
                    <p style={{ fontSize: 12, color: "rgba(255,255,255,0.35)" }}>{maskEmailDisplay(email)}</p>
                  </div>
                </button>

                {error && <p style={{ fontSize: 13, color: "#ff8080", marginTop: 14 }}>{error}</p>}

                <button onClick={() => { setStep("phone"); setError(""); }} style={{ marginTop: 20, background: "transparent", border: "none", color: "rgba(255,255,255,0.3)", cursor: "pointer", fontSize: 13, display: "flex", alignItems: "center", gap: 4 }}>
                  <ChevronLeft size={14} /> Voltar
                </button>
              </div>
            )}

            {/* verify — code input */}
            {step === "verify" && codeSent && (
              <div>
                <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 8 }}>Passo 2 de 5</p>
                <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1.2, marginBottom: 8 }}>Digite o código</h1>
                <p style={{ fontSize: 14, color: "rgba(255,255,255,0.45)", lineHeight: 1.6, marginBottom: 24 }}>
                  Código de 6 dígitos enviado para{" "}
                  <span style={{ color: "rgba(255,255,255,0.7)" }}>
                    {channel === "whatsapp" ? maskPhoneDisplay(phone) : maskEmailDisplay(email)}
                  </span>
                </p>

                <input
                  ref={codeRef}
                  className="inv-input"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="000000"
                  value={code}
                  onChange={e => {
                    const v = e.target.value.replace(/\D/g, "").slice(0, 6);
                    setCode(v);
                    if (v.length === 6) setTimeout(() => handleVerifyCode(), 0);
                  }}
                  style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "16px", fontSize: 28, fontWeight: 800, color: "#fff", marginBottom: 20, textAlign: "center", letterSpacing: "0.25em" }}
                />

                {error && <div style={{ background: "rgba(255,80,80,0.1)", border: "1px solid rgba(255,80,80,0.2)", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "#ff8080" }}>{error}</div>}

                <button
                  onClick={handleVerifyCode}
                  disabled={busy || code.length !== 6}
                  style={{ width: "100%", padding: "14px", borderRadius: 12, background: code.length === 6 ? G : "rgba(255,255,255,0.08)", border: "none", color: code.length === 6 ? "#050505" : "rgba(255,255,255,0.3)", fontSize: 14, fontWeight: 700, cursor: code.length === 6 ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, transition: "all .15s", marginBottom: 16 }}
                >
                  {busy
                    ? <div style={{ width: 16, height: 16, border: "2px solid rgba(0,0,0,0.3)", borderTopColor: "#000", borderRadius: "50%", animation: "spin .7s linear infinite" }} />
                    : <>Verificar <ArrowRight size={15} /></>}
                </button>

                <p style={{ fontSize: 13, color: "rgba(255,255,255,0.3)", textAlign: "center" }}>
                  {countdown > 0
                    ? `Reenviar em ${countdown}s`
                    : <span onClick={() => { setCodeSent(false); setCode(""); setError(""); setChannel(null); }} style={{ cursor: "pointer", color: "rgba(255,255,255,0.5)", textDecoration: "underline" }}>Reenviar código</span>}
                </p>
              </div>
            )}

            {/* name */}
            {step === "name" && (
              <div>
                <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 8 }}>Passo 3 de 5</p>
                <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1.2, marginBottom: 8 }}>Como quer ser chamado?</h1>
                <p style={{ fontSize: 14, color: "rgba(255,255,255,0.45)", lineHeight: 1.6, marginBottom: 24 }}>
                  Aparece no painel compartilhado com {invite.createdByName || "o dono da conta"}.
                </p>
                <p style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.4)", marginBottom: 6 }}>Seu nome</p>
                <input
                  ref={nomeRef}
                  className="inv-input"
                  type="text"
                  placeholder="Ex: Ana"
                  value={nome}
                  onChange={e => setNome(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && nome.trim() && setStep("cpf")}
                  style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "12px 14px", fontSize: 14, color: "#fff", marginBottom: 24 }}
                />
                <button
                  onClick={() => nome.trim() && setStep("cpf")}
                  disabled={!nome.trim()}
                  style={{ width: "100%", padding: "13px", borderRadius: 12, background: nome.trim() ? G : "rgba(255,255,255,0.08)", border: "none", color: nome.trim() ? "#050505" : "rgba(255,255,255,0.3)", fontSize: 14, fontWeight: 700, cursor: nome.trim() ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, transition: "all .15s" }}
                >
                  Continuar <ArrowRight size={15} />
                </button>
              </div>
            )}

            {/* cpf */}
            {step === "cpf" && (
              <div>
                <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 8 }}>Passo 4 de 5</p>
                <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1.2, marginBottom: 8 }}>Qual é o seu CPF?</h1>
                <p style={{ fontSize: 14, color: "rgba(255,255,255,0.45)", lineHeight: 1.6, marginBottom: 24 }}>
                  Usado para desbloquear automaticamente extratos bancários protegidos por senha.
                </p>
                <p style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.4)", marginBottom: 6 }}>CPF</p>
                <input
                  ref={cpfRef}
                  className="inv-input"
                  type="text"
                  inputMode="numeric"
                  placeholder="000.000.000-00"
                  value={cpf}
                  onChange={e => setCpf(maskCPF(e.target.value))}
                  onKeyDown={e => e.key === "Enter" && cpfDigits.length === 11 && handleCpfNext()}
                  style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "12px 14px", fontSize: 14, color: "#fff", marginBottom: 16 }}
                />

                {error && <div style={{ background: "rgba(255,80,80,0.1)", border: "1px solid rgba(255,80,80,0.2)", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "#ff8080" }}>{error}</div>}

                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => { setStep("name"); setError(""); }} style={{ padding: "12px 16px", borderRadius: 12, background: "transparent", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.5)", fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center" }}>
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    onClick={handleCpfNext}
                    disabled={busy || cpfDigits.length !== 11}
                    style={{ flex: 1, padding: "13px", borderRadius: 12, background: cpfDigits.length === 11 && !busy ? G : "rgba(255,255,255,0.08)", border: "none", color: cpfDigits.length === 11 && !busy ? "#050505" : "rgba(255,255,255,0.3)", fontSize: 14, fontWeight: 700, cursor: cpfDigits.length === 11 && !busy ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
                  >
                    {busy
                      ? <div style={{ width: 16, height: 16, border: "2px solid rgba(0,0,0,0.3)", borderTopColor: "#000", borderRadius: "50%", animation: "spin .7s linear infinite" }} />
                      : <>Continuar <ArrowRight size={15} /></>}
                  </button>
                </div>
              </div>
            )}

            {/* password */}
            {step === "password" && (
              <div>
                <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 8 }}>Passo 5 de 5</p>
                <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1.2, marginBottom: 8 }}>Crie uma senha</h1>
                <p style={{ fontSize: 14, color: "rgba(255,255,255,0.45)", lineHeight: 1.6, marginBottom: 24 }}>
                  Mínimo de 8 caracteres com letras e números.
                </p>
                <p style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.4)", marginBottom: 6 }}>Senha</p>
                <input
                  ref={senhaRef}
                  className="inv-input"
                  type="password"
                  placeholder="Mínimo 8 caracteres"
                  value={senha}
                  onChange={e => setSenha(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && senhaConfirmRef.current?.focus()}
                  style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "12px 14px", fontSize: 14, color: "#fff", marginBottom: 12 }}
                />
                <p style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.4)", marginBottom: 6 }}>Confirmar senha</p>
                <input
                  ref={senhaConfirmRef}
                  className="inv-input"
                  type="password"
                  placeholder="Repita a senha"
                  value={senhaConfirm}
                  onChange={e => setSenhaConfirm(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && canSubmit && handleFinalSubmit()}
                  style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "12px 14px", fontSize: 14, color: "#fff", marginBottom: 24 }}
                />

                {error && <div style={{ background: "rgba(255,80,80,0.1)", border: "1px solid rgba(255,80,80,0.2)", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "#ff8080" }}>{error}</div>}

                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => { setStep("cpf"); setError(""); }} style={{ padding: "12px 16px", borderRadius: 12, background: "transparent", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.5)", fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center" }}>
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    onClick={handleFinalSubmit}
                    disabled={!canSubmit}
                    style={{ flex: 1, padding: "13px", borderRadius: 12, background: canSubmit ? G : "rgba(255,255,255,0.08)", border: "none", color: canSubmit ? "#050505" : "rgba(255,255,255,0.3)", fontSize: 14, fontWeight: 700, cursor: canSubmit ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, transition: "all .15s" }}
                  >
                    {busy
                      ? <div style={{ width: 16, height: 16, border: "2px solid rgba(0,0,0,0.3)", borderTopColor: "#000", borderRadius: "50%", animation: "spin .7s linear infinite" }} />
                      : <>Criar conta e entrar <ArrowRight size={15} /></>}
                  </button>
                </div>

                <p style={{ fontSize: 11, color: "rgba(255,255,255,0.2)", textAlign: "center", marginTop: 16, lineHeight: 1.5 }}>
                  Ao criar a conta, você aceita os{" "}
                  <a href={`${BASE}/termos`} style={{ color: G, textDecoration: "none" }}>Termos</a>{" "}e a{" "}
                  <a href={`${BASE}/privacidade`} style={{ color: G, textDecoration: "none" }}>Política de Privacidade</a>.
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
