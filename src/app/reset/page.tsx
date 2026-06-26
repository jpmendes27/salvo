"use client";

import { confirmPasswordReset, verifyPasswordResetCode } from "firebase/auth";
import { ArrowRight, Eye, EyeOff } from "lucide-react";
import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase";
import { track } from "@/lib/analytics";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";
const G = "#b8f55a";

// Espelho FIEL da regra do /login: senha = exatamente 8 dígitos numéricos. É isso que
// fecha o lockout — a regra do reset bate com a do cadastro/login.
const PASSWORD_RE = /^[0-9]{8}$/;
const PASSWORD_HINT = "Crie uma senha de 8 dígitos numéricos.";

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain || !local) return email;
  return `${local[0]}***@${domain}`;
}

type Phase = "checking" | "form" | "success" | "invalid";

export default function ResetPage() {
  const [phase, setPhase] = useState<Phase>("checking");
  const [oobCode, setOobCode] = useState("");
  const [email, setEmail] = useState("");

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("oobCode") || "";
    if (!code) { setPhase("invalid"); return; }
    let alive = true;
    // Valida o código antes de mostrar o formulário: link expirado/usado → tela de erro
    // clara com opção de pedir de novo (nunca um formulário que falha só no fim).
    verifyPasswordResetCode(auth, code)
      .then((mail) => {
        if (!alive) return;
        setOobCode(code);
        setEmail(mail || "");
        setPhase("form");
      })
      .catch(() => { if (alive) setPhase("invalid"); });
    return () => { alive = false; };
  }, []);

  if (phase === "checking") return <Loader />;
  if (phase === "invalid") return <Invalid />;
  if (phase === "success") return <Success />;
  return <ResetForm oobCode={oobCode} email={email} onExpired={() => setPhase("invalid")} onDone={() => setPhase("success")} />;
}

function ResetForm({
  oobCode, email, onExpired, onDone,
}: { oobCode: string; email: string; onExpired: () => void; onDone: () => void }) {
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit() {
    if (!PASSWORD_RE.test(password)) { setError(PASSWORD_HINT); return; }
    setError("");
    setBusy(true);
    try {
      await confirmPasswordReset(auth, oobCode, password);
      track("password_reset_completed");
      onDone();
    } catch (err) {
      const code = (err as { code?: string })?.code ?? "";
      // Código expirado/inválido entre abrir a tela e confirmar → manda pro estado de erro
      // com a opção de pedir de novo.
      if (code === "auth/expired-action-code" || code === "auth/invalid-action-code") {
        onExpired();
        return;
      }
      setError("Não consegui trocar a senha agora. Tenta de novo daqui a pouco.");
      setBusy(false);
    }
  }

  const valid = PASSWORD_RE.test(password);

  return (
    <Shell>
      <p style={LABEL}>Nova senha</p>
      <h1 style={H1}>Crie sua senha nova</h1>
      <p style={SUB}>
        {email
          ? <>Pra entrar em <span style={{ color: "rgba(255,255,255,0.7)" }}>{maskEmail(email)}</span>. São 8 números.</>
          : <>Escolhe uma senha nova de 8 números.</>}
      </p>

      <div style={{ position: "relative", marginBottom: 14 }}>
        <input
          type={show ? "text" : "password"}
          inputMode="numeric"
          pattern="[0-9]{8}"
          minLength={8}
          maxLength={8}
          placeholder="Senha nova"
          value={password}
          onChange={(e) => setPassword(e.target.value.replace(/\D/g, "").slice(0, 8))}
          onKeyDown={(e) => { if (e.key === "Enter" && valid && !busy) handleSubmit(); }}
          autoFocus
          style={{
            width: "100%", padding: "13px 44px 13px 16px", borderRadius: 12, fontSize: 14,
            color: "#fff", fontFamily: "inherit", background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.09)", outline: "none", transition: "all .2s",
          }}
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? "Esconder senha" : "Mostrar senha"}
          style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.4)", display: "flex" }}
        >
          {show ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>

      {error && (
        <div style={{ background: "rgba(255,80,80,0.1)", border: "1px solid rgba(255,80,80,0.2)", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "#ff8080" }}>
          {error}
        </div>
      )}

      <button
        onClick={handleSubmit}
        disabled={busy || !valid}
        style={{
          width: "100%", padding: "14px", borderRadius: 12, border: "none",
          background: valid ? G : "rgba(255,255,255,0.08)",
          color: valid ? "#050505" : "rgba(255,255,255,0.3)",
          fontSize: 14, fontWeight: 700, cursor: valid && !busy ? "pointer" : "default",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 6, transition: "all .15s",
        }}
      >
        {busy
          ? <div style={{ width: 16, height: 16, border: "2px solid rgba(0,0,0,0.3)", borderTopColor: "#000", borderRadius: "50%", animation: "spin .7s linear infinite" }} />
          : <>Salvar senha nova <ArrowRight size={15} /></>}
      </button>
    </Shell>
  );
}

function Success() {
  return (
    <Shell>
      <p style={LABEL}>Tudo certo</p>
      <h1 style={H1}>Senha trocada!</h1>
      <p style={SUB}>Agora é só entrar com a senha nova.</p>
      <a
        href={`${BASE}/login`}
        style={{
          width: "100%", padding: "14px", borderRadius: 12, background: G, color: "#050505",
          fontSize: 14, fontWeight: 700, textDecoration: "none", display: "flex",
          alignItems: "center", justifyContent: "center", gap: 6,
        }}
      >
        Ir pro login <ArrowRight size={15} />
      </a>
    </Shell>
  );
}

function Invalid() {
  return (
    <Shell>
      <p style={LABEL}>Link inválido</p>
      <h1 style={H1}>Esse link expirou<br />ou já foi usado</h1>
      <p style={SUB}>Sem problema. Pede um novo link de recuperação no login.</p>
      <a
        href={`${BASE}/login`}
        style={{
          width: "100%", padding: "14px", borderRadius: 12, background: G, color: "#050505",
          fontSize: 14, fontWeight: 700, textDecoration: "none", display: "flex",
          alignItems: "center", justifyContent: "center", gap: 6,
        }}
      >
        Pedir de novo <ArrowRight size={15} />
      </a>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", background: "#050505", color: "#fff", fontFamily: "inherit", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px 16px" }}>
      <style>{`
        @keyframes fadeUp { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes spin { to { transform: rotate(360deg); } }
        ::placeholder{color:rgba(255,255,255,0.22)}
      `}</style>
      <div style={{ width: "100%", maxWidth: 420, animation: "fadeUp .4s ease both" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 0, marginBottom: 40 }}>
          <span style={{ fontFamily: "'DM Serif Display', serif", fontWeight: 700, fontSize: "1.15rem", color: "#b8f55a", letterSpacing: "-0.02em" }}>Salvô</span>
          <span style={{ fontFamily: "'DM Serif Display', serif", fontWeight: 700, fontSize: "1.15rem", color: "#ffffff", letterSpacing: "-0.02em" }}>!</span>
          <sup style={{ fontFamily: "'DM Mono', monospace", fontSize: "0.45rem", verticalAlign: "super", color: "#b8f55a", fontWeight: 400, marginLeft: 1 }}>®</sup>
        </div>
        {children}
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

const LABEL: React.CSSProperties = { fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 8 };
const H1: React.CSSProperties = { fontSize: 26, fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1.2, marginBottom: 8 };
const SUB: React.CSSProperties = { fontSize: 14, color: "rgba(255,255,255,0.45)", lineHeight: 1.6, marginBottom: 28 };
