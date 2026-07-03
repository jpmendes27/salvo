"use client";

import { onAuthStateChanged, type User } from "firebase/auth";
import { getFunctions, httpsCallable } from "firebase/functions";
import { MessageCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { app, auth } from "@/lib/firebase";
import { colors, radius, typography } from "@/lib/design-system";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";
const G = colors.accent;

type CodeResult = { code: string; expiresInSeconds: number; botNumber: string };

// Formata o número do bot pra leitura (+55 21 99999-9999) quando vier E.164.
function prettyNumber(raw: string): string {
  const d = raw.replace(/\D/g, "");
  if (d.length < 12) return raw;
  const cc = d.slice(0, 2), ddd = d.slice(2, 4), rest = d.slice(4);
  const mid = rest.length > 8 ? rest.slice(0, 5) : rest.slice(0, 4);
  const end = rest.length > 8 ? rest.slice(5) : rest.slice(4);
  return `+${cc} ${ddd} ${mid}-${end}`;
}

export default function VincularWhatsappPage() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);

  useEffect(() => {
    setWorkspaceId(new URLSearchParams(window.location.search).get("workspace"));
    return onAuthStateChanged(auth, (u) => {
      if (!u) { window.location.replace(`${BASE}/login`); return; }
      setUser(u);
    });
  }, []);

  if (user === undefined) return <Loader />;
  if (!user) return <Loader />;
  return <LinkFlow workspaceId={workspaceId} />;
}

function LinkFlow({ workspaceId }: { workspaceId: string | null }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<CodeResult | null>(null);
  const [remaining, setRemaining] = useState(0);

  // Contagem regressiva SÓ cosmética (charme iToken). A validade real é server-side.
  useEffect(() => {
    if (!result) return;
    setRemaining(result.expiresInSeconds);
    const t = setInterval(() => setRemaining((r) => (r > 0 ? r - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [result]);

  async function generate() {
    if (!workspaceId) { setError("Abre essa tela pelo app, dentro de uma conta."); return; }
    setBusy(true);
    setError("");
    try {
      const fn = httpsCallable<{ workspaceId: string }, CodeResult>(
        getFunctions(app, "us-central1"),
        "generateWhatsappLinkCode"
      );
      const { data } = await fn({ workspaceId });
      setResult(data);
    } catch {
      setError("Não consegui gerar o código agora. Tenta de novo daqui a pouco.");
    } finally {
      setBusy(false);
    }
  }

  const pct = result && result.expiresInSeconds > 0 ? Math.max(0, (remaining / result.expiresInSeconds) * 100) : 0;
  const expired = !!result && remaining <= 0;

  return (
    <Shell>
      <p style={LABEL}>WhatsApp</p>
      <h1 style={H1}>Vincular o WhatsApp</h1>
      <p style={SUB}>
        Vincula seu número uma vez e a gente já te reconhece por lá pra sempre — sem pedir código toda hora.
      </p>

      {!result ? (
        <>
          <div style={{ ...CARD, display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
            <div style={{ width: 40, height: 40, borderRadius: radius.button, background: colors.accentMuted, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <MessageCircle size={20} color={G} />
            </div>
            <p style={{ fontSize: 13.5, color: colors.textSecondary, lineHeight: 1.6 }}>
              Gera um código aqui e manda pra gente no WhatsApp. É rapidinho.
            </p>
          </div>

          {error && <div style={ERRBOX}>{error}</div>}

          <button onClick={generate} disabled={busy} style={CTA(busy)}>
            {busy
              ? <span style={SPINNER} />
              : "Gerar código"}
          </button>
        </>
      ) : (
        <>
          {/* Código — pode usar DM Mono (é código, não valor monetário) */}
          <div style={{ ...CARD, textAlign: "center", padding: "26px 22px", marginBottom: 16 }}>
            <p style={{ ...typography.labelSmall, marginBottom: 12 }}>Seu código</p>
            <div style={{ fontFamily: typography.fontMono, fontSize: 40, fontWeight: 500, letterSpacing: "0.18em", color: expired ? colors.textMuted : "#fff", paddingLeft: "0.18em" }}>
              {result.code}
            </div>

            {/* Barrinha de contagem regressiva — cosmética */}
            <div style={{ height: 4, borderRadius: radius.pill, background: "rgba(255,255,255,0.06)", overflow: "hidden", marginTop: 18 }}>
              <div style={{ height: "100%", width: `${pct}%`, background: G, borderRadius: radius.pill, transition: "width 1s linear" }} />
            </div>
            <p style={{ fontSize: 11.5, color: colors.textMuted, marginTop: 8 }}>
              {expired ? "Esse código expirou. Gera outro." : `Vale por mais ${Math.floor(remaining / 60)}min ${remaining % 60}s`}
            </p>
          </div>

          <div style={{ ...CARD, marginBottom: 20 }}>
            <p style={{ fontSize: 13.5, color: colors.textSecondary, lineHeight: 1.7 }}>
              Manda esse código pra gente no WhatsApp:
            </p>
            <p style={{ fontSize: 16, fontWeight: 800, color: "#fff", marginTop: 6, letterSpacing: "-0.01em" }}>
              {result.botNumber ? prettyNumber(result.botNumber) : "o nosso número do Salvô!"}
            </p>
          </div>

          <button onClick={generate} disabled={busy} style={CTA(busy)}>
            {busy ? <span style={SPINNER} /> : expired ? "Gerar outro código" : "Gerar um novo"}
          </button>
        </>
      )}
    </Shell>
  );
}

// ── Shell / tokens (design system — src/lib/design-system.ts) ────────────────
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", background: colors.bg, color: colors.textPrimary, fontFamily: typography.fontUI, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px 16px" }}>
      <style>{`
        @keyframes fadeUp { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
      <div style={{ width: "100%", maxWidth: 420, animation: "fadeUp .4s ease both" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 0, marginBottom: 40 }}>
          <span style={{ fontFamily: typography.fontDisplay, fontWeight: 700, fontSize: "1.15rem", color: G, letterSpacing: "-0.02em" }}>Salvô</span>
          <span style={{ fontFamily: typography.fontDisplay, fontWeight: 700, fontSize: "1.15rem", color: "#fff", letterSpacing: "-0.02em" }}>!</span>
          <sup style={{ fontFamily: typography.fontMono, fontSize: "0.45rem", verticalAlign: "super", color: G, fontWeight: 400, marginLeft: 1 }}>®</sup>
        </div>
        {children}
      </div>
    </div>
  );
}

function Loader() {
  return (
    <div style={{ minHeight: "100vh", background: colors.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: 28, height: 28, border: `3px solid ${colors.accentMuted}`, borderTop: `3px solid ${G}`, borderRadius: "50%", animation: "spin .8s linear infinite" }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

const LABEL: React.CSSProperties = { fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: colors.textFaint, marginBottom: 8 };
const H1: React.CSSProperties = { fontSize: 26, fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1.2, marginBottom: 8 };
const SUB: React.CSSProperties = { fontSize: 14, color: colors.textSecondary, lineHeight: 1.6, marginBottom: 28 };
const CARD: React.CSSProperties = { background: colors.card, border: `1px solid ${colors.border}`, borderRadius: radius.card, padding: "16px 18px" };
const ERRBOX: React.CSSProperties = { background: "rgba(255,80,80,0.1)", border: "1px solid rgba(255,80,80,0.2)", borderRadius: radius.button, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "#ff8080" };
const SPINNER: React.CSSProperties = { width: 16, height: 16, border: "2.5px solid rgba(0,0,0,0.3)", borderTopColor: "#000", borderRadius: "50%", animation: "spin .7s linear infinite", display: "inline-block" };
const CTA = (busy: boolean): React.CSSProperties => ({
  width: "100%", padding: "14px", borderRadius: radius.button, background: G, color: colors.bg,
  fontSize: 14, fontWeight: 800, border: "none", cursor: busy ? "default" : "pointer",
  display: "flex", alignItems: "center", justifyContent: "center", gap: 6, letterSpacing: "-0.02em",
});
