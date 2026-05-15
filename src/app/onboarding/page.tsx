"use client";

import { onAuthStateChanged, type User } from "firebase/auth";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  Timestamp,
  writeBatch
} from "firebase/firestore";
import { ArrowRight, ChevronLeft } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { consentText, PRIVACY_VERSION, TERMS_VERSION } from "@/lib/legal";
import { track } from "@/lib/analytics";
import { maskBRL, parseBRL } from "@/lib/money";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";
const G = "#b8f55a";
const SEND_WA_FUNCTION_URL =
  process.env.NEXT_PUBLIC_SEND_WA_URL ||
  "https://sendinvitewhatsapp-ihalwtxjpq-uc.a.run.app";

function maskCPF(value: string): string {
  const d = value.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

function maskPhone(value: string): string {
  const d = value.replace(/\D/g, "").slice(0, 11);
  if (!d) return "";
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export default function OnboardingPage() {
  const [user, setUser] = useState<User | null | undefined>(undefined);

  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      if (!u) { window.location.replace(`${BASE}/login`); return; }
      const snap = await getDoc(doc(db, "users", u.uid));
      const data = snap.data();
      if (!snap.exists() || data?.accountVerified === false) {
        window.location.replace(`${BASE}/verify`); return;
      }
      if (data?.acceptedTermsVersion) {
        window.location.replace(`${BASE}/home`); return;
      }
      setUser(u);
    });
  }, []);

  if (user === undefined) return <Loader />;
  if (!user) return <Loader />;
  return <OnboardingFlow user={user} />;
}

function OnboardingFlow({ user }: { user: User }) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState(
    user.displayName || window.localStorage.getItem("fincheck:pendingName") || ""
  );
  const [income, setIncome] = useState("");
  const [cpf, setCpf] = useState("");
  const [usage, setUsage] = useState<"solo" | "shared">("solo");
  const [invitePhone, setInvitePhone] = useState("");
  const [workspaceId, setWorkspaceId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const nameRef = useRef<HTMLInputElement>(null);
  const incomeRef = useRef<HTMLInputElement>(null);
  const cpfRef = useRef<HTMLInputElement>(null);
  const invitePhoneRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (step === 0) nameRef.current?.focus();
    if (step === 1) cpfRef.current?.focus();
    if (step === 2) incomeRef.current?.focus();
    if (step === 4) invitePhoneRef.current?.focus();
  }, [step]);

  async function createWorkspace(): Promise<string> {
    if (workspaceId) return workspaceId;
    const displayName = name.trim() || user.displayName || user.email?.split("@")[0] || "Você";
    const incomeVal = parseBRL(income);
    const cpfDigits = cpf.replace(/\D/g, "");

    await addDoc(collection(db, "consents"), {
      uid: user.uid,
      email: user.email || "",
      termsVersion: TERMS_VERSION,
      privacyVersion: PRIVACY_VERSION,
      text: consentText,
      purpose: "account_and_workspace_access",
      createdAt: serverTimestamp()
    });

    const wsRef = doc(collection(db, "workspaces"));
    const batch = writeBatch(db);
    batch.set(wsRef, {
      name: "Minha vida financeira",
      createdBy: user.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      memberEmails: [user.email || ""],
      ...(incomeVal > 0 ? { monthlyIncome: incomeVal } : {})
    });
    batch.set(doc(db, "workspaces", wsRef.id, "members", user.uid), {
      uid: user.uid,
      role: "owner",
      status: "active",
      displayName,
      email: user.email || "",
      createdBy: user.uid,
      joinedAt: serverTimestamp()
    });
    if (cpfDigits.length === 11) {
      batch.set(doc(db, "cpfIndex", cpfDigits), { uid: user.uid });
    }
    // User doc no mesmo batch: acceptedTermsVersion e workspaceIds juntos,
    // evitando a janela onde loadProfile vê termos sem workspace e cria um novo sem renda
    batch.set(doc(db, "users", user.uid), {
      uid: user.uid,
      displayName,
      email: user.email || "",
      ...(cpfDigits.length === 11 ? { cpf: cpfDigits } : {}),
      hasCreatedRealMonth: false,
      acceptedTermsVersion: TERMS_VERSION,
      acceptedPrivacyVersion: PRIVACY_VERSION,
      workspaceIds: [wsRef.id],
      updatedAt: serverTimestamp()
    }, { merge: true });
    await batch.commit();

    setWorkspaceId(wsRef.id);
    return wsRef.id;
  }

  async function goHome(wsId: string) {
    track("onboarding_complete", { usage, has_income: parseBRL(income) > 0 });
    window.localStorage.removeItem("fincheck:pendingName");
    window.location.replace(`${BASE}/home`);
  }

  async function handleStep1Next() {
    const cpfDigits = cpf.replace(/\D/g, "");
    if (cpfDigits.length !== 11) {
      setError("Informe seu CPF completo.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const snap = await getDoc(doc(db, "cpfIndex", cpfDigits));
      if (snap.exists()) {
        setError("Este CPF já está cadastrado.");
        setBusy(false);
        return;
      }
    } catch { /* ignore and proceed */ }
    setBusy(false);
    setStep(2);
  }

  async function handleStep2Next() {
    setBusy(true);
    setError("");
    try {
      await createWorkspace();
      setStep(3);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Algo deu errado. Tente de novo.");
    } finally {
      setBusy(false);
    }
  }

  async function handleFinish() {
    setBusy(true);
    setError("");
    try {
      const wsId = await createWorkspace();
      await goHome(wsId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Algo deu errado. Tente de novo.");
      setBusy(false);
    }
  }

  async function handleSendInvite() {
    const wsId = workspaceId;
    if (!wsId) return;
    setBusy(true);
    setError("");
    try {
      const displayName = name.trim() || user.displayName || user.email?.split("@")[0] || "Você";
      const token = crypto.randomUUID();
      const invDigits = invitePhone.replace(/\D/g, "");
      const invPhone = invDigits.startsWith("55") ? invDigits : `55${invDigits}`;
      await setDoc(doc(db, "invites", token), {
        workspaceId: wsId,
        workspaceName: "Minha vida financeira",
        createdBy: user.uid,
        createdByName: displayName,
        canal: "whatsapp",
        guestPhone: invPhone,
        status: "active",
        createdAt: serverTimestamp(),
        expiresAt: Timestamp.fromDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000))
      });
      const link = `${window.location.origin}${BASE}/convite?token=${token}`;
      fetch(SEND_WA_FUNCTION_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: invPhone, workspaceName: "Minha vida financeira", inviteLink: link, fromName: displayName })
      }).catch(console.error);
      await goHome(wsId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Algo deu errado. Tente de novo.");
      setBusy(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "#050505", color: "#fff", fontFamily: "inherit", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px 16px" }}>
      <style>{`
        @keyframes fadeUp { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes spin { to { transform: rotate(360deg); } }
        .ob-option { transition: border-color .15s, background .15s; }
        .ob-option:hover { border-color: rgba(255,255,255,0.2) !important; }
        .ob-option.selected { border-color: ${G} !important; background: rgba(184,245,90,0.06) !important; }
        .ob-input:focus { border-color: rgba(184,245,90,0.4) !important; background: rgba(184,245,90,0.04) !important; }
      `}</style>

      <div style={{ width: "100%", maxWidth: 440, animation: "fadeUp .4s ease both" }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "baseline", gap: 0, marginBottom: 32 }}>
          <span style={{ fontFamily: "'DM Serif Display', serif", fontWeight: 700, fontSize: "1.15rem", color: G, letterSpacing: "-0.02em", lineHeight: 1 }}>fincheck</span>
          <span style={{ fontFamily: "'DM Serif Display', serif", fontWeight: 700, fontSize: "1.15rem", color: "#fff", letterSpacing: "-0.02em", lineHeight: 1 }}>pro</span>
          <sup style={{ fontFamily: "'DM Mono', monospace", fontSize: "0.45rem", verticalAlign: "super", color: G, fontWeight: 400, marginLeft: 1 }}>®</sup>
        </div>

        {/* Progress */}
        <div style={{ display: "flex", gap: 5, marginBottom: 32 }}>
          {(usage === "shared" ? [0, 1, 2, 3, 4] : [0, 1, 2, 3]).map((i) => (
            <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: i <= step ? G : "rgba(255,255,255,0.1)", transition: "background .3s" }} />
          ))}
        </div>

        {/* Step content */}
        {step === 0 && (
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 8 }}>Passo 1 de 4</p>
            <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1.15, marginBottom: 8 }}>
              Como quer ser<br />chamado?
            </h1>
            <p style={{ fontSize: 14, color: "rgba(255,255,255,0.45)", lineHeight: 1.6, marginBottom: 24 }}>
              Esse nome aparece no painel e nos convites que você enviar.
            </p>
            <p style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.4)", marginBottom: 6 }}>Seu nome</p>
            <input
              ref={nameRef}
              className="ob-input"
              type="text"
              placeholder="Ex: João"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && name.trim() && setStep(1)}
              style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "12px 14px", fontSize: 14, color: "#fff", outline: "none", marginBottom: 24, transition: "border-color .15s, background .15s" }}
            />
            <button
              onClick={() => name.trim() && setStep(1)}
              disabled={!name.trim()}
              style={{ width: "100%", padding: "13px", borderRadius: 12, background: name.trim() ? G : "rgba(255,255,255,0.08)", border: "none", color: name.trim() ? "#050505" : "rgba(255,255,255,0.3)", fontSize: 14, fontWeight: 700, cursor: name.trim() ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, transition: "all .15s" }}
            >
              Continuar <ArrowRight size={15} />
            </button>
          </div>
        )}

        {step === 1 && (
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 8 }}>Passo 2 de 4</p>
            <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1.15, marginBottom: 8 }}>
              Qual é o seu<br />CPF?
            </h1>
            <p style={{ fontSize: 14, color: "rgba(255,255,255,0.45)", lineHeight: 1.6, marginBottom: 24 }}>
              Usado para desbloquear automaticamente extratos bancários protegidos por senha.
            </p>
            <p style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.4)", marginBottom: 6 }}>CPF</p>
            <input
              ref={cpfRef}
              className="ob-input"
              type="text"
              inputMode="numeric"
              placeholder="000.000.000-00"
              value={cpf}
              onChange={(e) => setCpf(maskCPF(e.target.value))}
              onKeyDown={(e) => e.key === "Enter" && !busy && handleStep1Next()}
              style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "12px 14px", fontSize: 14, color: "#fff", outline: "none", marginBottom: 24, transition: "border-color .15s, background .15s" }}
            />
            {error && <p style={{ fontSize: 12, color: "#ff8080", marginBottom: 12, marginTop: -16 }}>{error}</p>}
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => setStep(0)}
                style={{ padding: "12px 16px", borderRadius: 12, background: "transparent", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.5)", fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center" }}
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={() => !busy && handleStep1Next()}
                disabled={busy}
                style={{ flex: 1, padding: "13px", borderRadius: 12, background: G, border: "none", color: "#050505", fontSize: 14, fontWeight: 700, cursor: busy ? "default" : "pointer", opacity: busy ? 0.6 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
              >
                Continuar <ArrowRight size={15} />
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 8 }}>Passo 3 de {usage === "shared" ? 5 : 4}</p>
            <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1.15, marginBottom: 8 }}>
              Qual é sua<br />renda mensal?
            </h1>
            <p style={{ fontSize: 14, color: "rgba(255,255,255,0.45)", lineHeight: 1.6, marginBottom: 24 }}>
              Usamos isso para calcular quanto da sua renda você está comprometendo com gastos.
            </p>
            <p style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.4)", marginBottom: 6 }}>Renda mensal (R$)</p>
            <input
              ref={incomeRef}
              className="ob-input"
              type="text"
              inputMode="numeric"
              placeholder="R$ 0,00"
              value={income}
              onChange={(e) => setIncome(maskBRL(e.target.value))}
              onKeyDown={(e) => { if (e.key === "Enter") handleStep2Next(); }}
              style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "12px 14px", fontSize: 14, color: "#fff", outline: "none", marginBottom: 24, transition: "border-color .15s, background .15s" }}
            />
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => setStep(1)}
                style={{ padding: "12px 16px", borderRadius: 12, background: "transparent", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.5)", fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center" }}
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={handleStep2Next}
                disabled={busy}
                style={{ flex: 1, padding: "13px", borderRadius: 12, background: G, border: "none", color: "#050505", fontSize: 14, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
              >
                {busy ? <div style={{ width: 16, height: 16, border: "2px solid rgba(0,0,0,0.3)", borderTopColor: "#000", borderRadius: "50%", animation: "spin .7s linear infinite" }} /> : <><span>Continuar</span> <ArrowRight size={15} /></>}
              </button>
            </div>
            <p
              onClick={handleStep2Next}
              style={{ fontSize: 12, color: "rgba(255,255,255,0.25)", cursor: "pointer", textAlign: "center", marginTop: 14 }}
            >
              Pular por agora
            </p>
          </div>
        )}

        {step === 3 && (
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 8 }}>Passo 4 de {usage === "shared" ? 5 : 4}</p>
            <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1.15, marginBottom: 8 }}>
              Como vai usar<br />o Fincheck Pro?
            </h1>
            <p style={{ fontSize: 14, color: "rgba(255,255,255,0.45)", lineHeight: 1.6, marginBottom: 24 }}>
              Isso nos ajuda a deixar o painel mais útil pra você desde o início.
            </p>

            {[
              { value: "solo" as const, icon: "👤", label: "Só eu mesmo", sub: "Acompanho minhas finanças pessoais" },
              { value: "shared" as const, icon: "👥", label: "Com mais alguém", sub: "Vou convidar uma pessoa para gerir juntos" }
            ].map((opt) => (
              <div
                key={opt.value}
                className={`ob-option${usage === opt.value ? " selected" : ""}`}
                onClick={() => setUsage(opt.value)}
                style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${usage === opt.value ? G : "rgba(255,255,255,0.09)"}`, borderRadius: 12, padding: "14px 16px", display: "flex", alignItems: "center", gap: 12, cursor: "pointer", marginBottom: 10 }}
              >
                <div style={{ width: 36, height: 36, borderRadius: 10, background: usage === opt.value ? "rgba(184,245,90,0.12)" : "rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0, transition: "background .15s" }}>
                  {opt.icon}
                </div>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: usage === opt.value ? "#fff" : "rgba(255,255,255,0.75)", marginBottom: 2 }}>{opt.label}</p>
                  <p style={{ fontSize: 11.5, color: "rgba(255,255,255,0.35)" }}>{opt.sub}</p>
                </div>
              </div>
            ))}

            {error && (
              <div style={{ background: "rgba(255,80,80,0.1)", border: "1px solid rgba(255,80,80,0.2)", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "#ff8080" }}>
                {error}
              </div>
            )}

            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <button
                onClick={() => setStep(2)}
                style={{ padding: "12px 16px", borderRadius: 12, background: "transparent", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.5)", fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center" }}
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={usage === "shared" ? () => setStep(4) : handleFinish}
                disabled={busy}
                style={{ flex: 1, padding: "13px", borderRadius: 12, background: G, border: "none", color: "#050505", fontSize: 14, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
              >
                {busy ? (
                  <div style={{ width: 16, height: 16, border: "2px solid rgba(0,0,0,0.3)", borderTopColor: "#000", borderRadius: "50%", animation: "spin .7s linear infinite" }} />
                ) : usage === "shared" ? (
                  <>Continuar <ArrowRight size={15} /></>
                ) : (
                  <>Entrar no painel <ArrowRight size={15} /></>
                )}
              </button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 8 }}>Passo 5 de 5</p>
            <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1.15, marginBottom: 8 }}>
              Quem vai gerir<br />com você?
            </h1>
            <p style={{ fontSize: 14, color: "rgba(255,255,255,0.45)", lineHeight: 1.6, marginBottom: 24 }}>
              Manda o convite agora pelo WhatsApp. A pessoa recebe um link pra entrar no seu painel.
            </p>
            <p style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.4)", marginBottom: 6 }}>WhatsApp (com DDD)</p>
            <input
              ref={invitePhoneRef}
              className="ob-input"
              type="tel"
              inputMode="tel"
              placeholder="(21) 99999-9999"
              value={invitePhone}
              onChange={(e) => setInvitePhone(maskPhone(e.target.value))}
              onKeyDown={(e) => { if (e.key === "Enter" && invitePhone.replace(/\D/g, "").length >= 10) handleSendInvite(); }}
              style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "12px 14px", fontSize: 14, color: "#fff", outline: "none", marginBottom: 24, transition: "border-color .15s, background .15s" }}
            />

            {error && (
              <div style={{ background: "rgba(255,80,80,0.1)", border: "1px solid rgba(255,80,80,0.2)", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "#ff8080" }}>
                {error}
              </div>
            )}

            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => setStep(3)}
                style={{ padding: "12px 16px", borderRadius: 12, background: "transparent", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.5)", fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center" }}
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={handleSendInvite}
                disabled={busy || invitePhone.replace(/\D/g, "").length < 10}
                style={{ flex: 1, padding: "13px", borderRadius: 12, background: invitePhone.replace(/\D/g, "").length >= 10 ? G : "rgba(255,255,255,0.08)", border: "none", color: invitePhone.replace(/\D/g, "").length >= 10 ? "#050505" : "rgba(255,255,255,0.3)", fontSize: 14, fontWeight: 700, cursor: invitePhone.replace(/\D/g, "").length >= 10 ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, transition: "all .15s" }}
              >
                {busy ? (
                  <div style={{ width: 16, height: 16, border: "2px solid rgba(0,0,0,0.3)", borderTopColor: "#000", borderRadius: "50%", animation: "spin .7s linear infinite" }} />
                ) : (
                  <>Enviar convite e entrar <ArrowRight size={15} /></>
                )}
              </button>
            </div>
            <p
              onClick={() => goHome(workspaceId)}
              style={{ fontSize: 12, color: "rgba(255,255,255,0.25)", cursor: "pointer", textAlign: "center", marginTop: 14 }}
            >
              Pular por agora
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function Loader() {
  return (
    <div style={{ minHeight: "100vh", background: "#050505", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: 28, height: 28, border: `3px solid rgba(184,245,90,0.2)`, borderTop: `3px solid ${G}`, borderRadius: "50%", animation: "spin .8s linear infinite" }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
