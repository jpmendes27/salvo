"use client";

import { onAuthStateChanged, type User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { ArrowRight, Mail, MessageCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { auth, db } from "@/lib/firebase";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";
const G = "#b8f55a";
const SEND_VERIFICATION_URL =
  process.env.NEXT_PUBLIC_SEND_VERIFICATION_URL ||
  "https://sendverificationcode-ihalwtxjpq-uc.a.run.app";
const VERIFY_CODE_URL =
  process.env.NEXT_PUBLIC_VERIFY_CODE_URL ||
  "https://verifycode-ihalwtxjpq-uc.a.run.app";

function maskPhone(phone: string): string {
  const d = phone.replace(/\D/g, "").replace(/^55/, "");
  if (d.length < 8) return phone;
  return `(${d.slice(0, 2)}) ${d.slice(2, 3)}****-${d.slice(-4)}`;
}

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain || !local) return email;
  return `${local[0]}***@${domain}`;
}

export default function VerifyPage() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [phone, setPhone] = useState("");

  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      if (!u) { window.location.replace(`${BASE}/login`); return; }
      const snap = await getDoc(doc(db, "users", u.uid));
      const data = snap.data();
      if (data?.accountVerified) {
        const dest = data?.acceptedTermsVersion ? "/home" : "/onboarding";
        window.location.replace(`${BASE}${dest}`);
        return;
      }
      setPhone(data?.phone || "");
      setUser(u);
    });
  }, []);

  if (user === undefined) return <Loader />;
  if (!user) return <Loader />;
  return <VerifyFlow user={user} phone={phone} />;
}

function VerifyFlow({ user, phone }: { user: User; phone: string }) {
  const [channel, setChannel] = useState<"whatsapp" | "email" | null>(null);
  const [codeSent, setCodeSent] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [countdown, setCountdown] = useState(0);
  const [verificationToken, setVerificationToken] = useState("");
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (codeSent) codeRef.current?.focus();
  }, [codeSent]);

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  async function sendCode(ch: "whatsapp" | "email") {
    setChannel(ch);
    setError("");
    setBusy(true);
    try {
      const resp = await fetch(SEND_VERIFICATION_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid: user.uid, email: user.email, phone, channel: ch })
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

  async function handleVerify() {
    if (code.length !== 6) return;
    setError("");
    setBusy(true);
    try {
      const resp = await fetch(VERIFY_CODE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid: user.uid, code, token: verificationToken })
      });
      const j = await resp.json();
      if (!resp.ok) throw new Error(j.error || "Código inválido");
      const { setDoc, serverTimestamp } = await import("firebase/firestore");
      await setDoc(doc(db, "users", user.uid), { accountVerified: true, updatedAt: serverTimestamp() }, { merge: true });
      window.location.replace(`${BASE}/onboarding`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Código inválido");
      setBusy(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "#050505", color: "#fff", fontFamily: "inherit", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px 16px" }}>
      <style>{`
        @keyframes fadeUp { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes spin { to { transform: rotate(360deg); } }
        .v-btn { transition: border-color .15s, background .15s; }
        .v-btn:hover { border-color: rgba(255,255,255,0.2) !important; }
        .v-input:focus { border-color: rgba(184,245,90,0.4) !important; background: rgba(184,245,90,0.04) !important; }
      `}</style>

      <div style={{ width: "100%", maxWidth: 420, animation: "fadeUp .4s ease both" }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "baseline", gap: 0, marginBottom: 40 }}>
          <span style={{ fontFamily: "'DM Serif Display', serif", fontWeight: 700, fontSize: "1.15rem", color: "#b8f55a", letterSpacing: "-0.02em" }}>Salvô</span>
          <span style={{ fontFamily: "'DM Serif Display', serif", fontWeight: 700, fontSize: "1.15rem", color: "#ffffff", letterSpacing: "-0.02em" }}>!</span>
          <sup style={{ fontFamily: "'DM Mono', monospace", fontSize: "0.45rem", verticalAlign: "super", color: "#b8f55a", fontWeight: 400, marginLeft: 1 }}>®</sup>
        </div>

        {!codeSent ? (
          <>
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 8 }}>Verificação</p>
            <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1.2, marginBottom: 8 }}>
              Como quer receber<br />seu código?
            </h1>
            <p style={{ fontSize: 14, color: "rgba(255,255,255,0.45)", lineHeight: 1.6, marginBottom: 28 }}>
              Vamos confirmar que é você antes de liberar o acesso.
            </p>

            {/* WhatsApp option — primary */}
            {phone && (
              <button
                className="v-btn"
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
                  <p style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>{maskPhone(phone)}</p>
                </div>
                <div style={{ marginLeft: "auto", background: G, color: "#050505", fontSize: 10, fontWeight: 800, padding: "3px 8px", borderRadius: 6, letterSpacing: "0.05em" }}>RECOMENDADO</div>
              </button>
            )}

            {/* Email option */}
            <button
              className="v-btn"
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
                <p style={{ fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.75)", marginBottom: 2 }}>Receber por email</p>
                <p style={{ fontSize: 12, color: "rgba(255,255,255,0.35)" }}>{maskEmail(user.email || "")}</p>
              </div>
            </button>

            {error && <p style={{ fontSize: 13, color: "#ff8080", marginTop: 16 }}>{error}</p>}
          </>
        ) : (
          <>
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 8 }}>Verificação</p>
            <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1.2, marginBottom: 8 }}>
              Digite o código
            </h1>
            <p style={{ fontSize: 14, color: "rgba(255,255,255,0.45)", lineHeight: 1.6, marginBottom: 28 }}>
              Enviamos um código de 6 dígitos para{" "}
              <span style={{ color: "rgba(255,255,255,0.7)" }}>
                {channel === "whatsapp" ? maskPhone(phone) : maskEmail(user.email || "")}
              </span>
            </p>

            <input
              ref={codeRef}
              className="v-input"
              type="text"
              inputMode="numeric"
              maxLength={6}
              placeholder="000000"
              value={code}
              onChange={(e) => {
                const v = e.target.value.replace(/\D/g, "").slice(0, 6);
                setCode(v);
                if (v.length === 6) setTimeout(() => handleVerify(), 0);
              }}
              style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "16px", fontSize: 28, fontWeight: 800, color: "#fff", outline: "none", marginBottom: 20, textAlign: "center", letterSpacing: "0.25em", transition: "border-color .15s, background .15s" }}
            />

            {error && (
              <div style={{ background: "rgba(255,80,80,0.1)", border: "1px solid rgba(255,80,80,0.2)", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "#ff8080" }}>
                {error}
              </div>
            )}

            <button
              onClick={handleVerify}
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
          </>
        )}
      </div>
    </div>
  );
}

function Loader() {
  return (
    <div style={{ minHeight: "100vh", background: "#050505", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: 28, height: 28, border: "3px solid rgba(184,245,90,0.2)", borderTop: `3px solid ${G}`, borderRadius: "50%", animation: "spin .8s linear infinite" }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
