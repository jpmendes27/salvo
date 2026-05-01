"use client";

import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  reload,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type User
} from "firebase/auth";
import {
  addDoc,
  collection,
  collectionGroup,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch
} from "firebase/firestore";
import {
  ArrowRight,
  Copy,
  Eye,
  EyeOff,
  Handshake,
  LogOut,
  Plus,
  RefreshCw,
  Send,
  Trash2,
  Users
} from "lucide-react";
import { CSSProperties, FormEvent, ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { auth, db, googleProvider } from "@/lib/firebase";
import { consentText, PRIVACY_VERSION, TERMS_VERSION } from "@/lib/legal";
import { currentMonthKey, formatCurrency, monthLabel } from "@/lib/money";
import { buildMonthlySummary } from "@/lib/summary";
import type { Member, Transaction, TransactionType, Workspace } from "@/lib/types";
import { defaultCategories, demoTransactions } from "@/lib/demo";

type Profile = {
  uid: string;
  displayName: string;
  email: string;
  hasCreatedRealMonth?: boolean;
  acceptedTermsVersion?: string;
  acceptedPrivacyVersion?: string;
};

type WorkspaceWithMember = {
  workspace: Workspace;
  member: Member;
};

const G = "#b8f55a";
const G_10 = "rgba(184,245,90,0.10)";
const G_20 = "rgba(184,245,90,0.18)";
const G_30 = "rgba(184,245,90,0.28)";

export default function HomePage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return <CenteredStatus text="Preparando seu Fincheck Pro..." />;
  }

  if (!user) {
    return <AuthScreen />;
  }

  if (!user.emailVerified) {
    return <VerifyEmail user={user} />;
  }

  return <AuthenticatedApp user={user} />;
}

function GlassCard({
  children,
  style = {},
  accent = false
}: {
  children: ReactNode;
  style?: CSSProperties;
  accent?: boolean;
}) {
  return (
    <div
      style={{
        position: "relative",
        borderRadius: 20,
        backdropFilter: "blur(48px) saturate(180%)",
        WebkitBackdropFilter: "blur(48px) saturate(180%)",
        background: "rgba(255,255,255,0.042)",
        boxShadow: accent
          ? `0 0 0 1px rgba(184,245,90,0.28), 0 0 0 1px rgba(255,255,255,0.05) inset,
         0 32px 64px rgba(0,0,0,0.55), 0 0 80px rgba(184,245,90,0.06)`
          : `0 0 0 1px rgba(255,255,255,0.09), 0 0 0 1px rgba(255,255,255,0.04) inset,
         0 24px 48px rgba(0,0,0,0.50)`,
        ...style
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: 20,
          pointerEvents: "none",
          zIndex: 0,
          background:
            "linear-gradient(145deg, rgba(255,255,255,0.11) 0%, transparent 45%, rgba(0,0,0,0.08) 100%)"
        }}
      />
      <div style={{ position: "relative", zIndex: 1 }}>{children}</div>
    </div>
  );
}

function MiniBar({ h, active }: { h: number; active: boolean }) {
  return (
    <div
      style={{
        flex: 1,
        borderRadius: "3px 3px 0 0",
        height: `${h}%`,
        background: active ? G : "rgba(255,255,255,0.08)",
        boxShadow: active ? `0 0 10px ${G_30}` : "none"
      }}
    />
  );
}

function BarChart() {
  const data = [55, 70, 48, 82, 61, 90, 74, 95, 68, 100];
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 5, height: 70 }}>
      {data.map((h, i) => (
        <MiniBar key={i} h={h} active={i === data.length - 1} />
      ))}
    </div>
  );
}

function Donut({ pct, size = 64 }: { pct: number; size?: number }) {
  const r = size / 2 - 7;
  const c = size / 2;
  const circ = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={c} cy={c} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={7} />
      <circle
        cx={c}
        cy={c}
        r={r}
        fill="none"
        stroke={G}
        strokeWidth={7}
        strokeDasharray={`${(pct / 100) * circ} ${circ}`}
        strokeLinecap="round"
        style={{ filter: `drop-shadow(0 0 5px ${G})` }}
      />
    </svg>
  );
}

function FInput({
  type,
  placeholder,
  value,
  onChange,
  right
}: {
  type: string;
  placeholder: string;
  value: string;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  right?: ReactNode;
}) {
  const [f, setF] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        onFocus={() => setF(true)}
        onBlur={() => setF(false)}
        required
        minLength={type === "password" ? 6 : undefined}
        style={{
          width: "100%",
          padding: right ? "13px 44px 13px 16px" : "13px 16px",
          borderRadius: 12,
          fontSize: 14,
          color: "#fff",
          fontFamily: "inherit",
          background: f ? "rgba(184,245,90,0.05)" : "rgba(255,255,255,0.05)",
          border: f ? "1px solid rgba(184,245,90,0.35)" : "1px solid rgba(255,255,255,0.09)",
          outline: "none",
          transition: "all .2s",
          backdropFilter: "blur(8px)"
        }}
      />
      {right}
    </div>
  );
}

function Logo() {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 0 }}>
      <span
        style={{
          fontFamily: "'DM Serif Display', serif",
          fontWeight: 700,
          fontSize: "1.15rem",
          color: G,
          letterSpacing: "-0.02em",
          lineHeight: 1
        }}
      >
        fincheck
      </span>
      <span
        style={{
          fontFamily: "'DM Serif Display', serif",
          fontWeight: 700,
          fontSize: "1.15rem",
          color: "#fff",
          letterSpacing: "-0.02em",
          lineHeight: 1
        }}
      >
        pro
      </span>
      <sup
        style={{
          fontFamily: "'DM Mono', monospace",
          fontSize: "0.45rem",
          verticalAlign: "super",
          color: G,
          fontWeight: 400,
          marginLeft: 1
        }}
      >
        ®
      </sup>
    </div>
  );
}

function AuthScreen() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    const resize = () => {
      cv.width = window.innerWidth;
      cv.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const blobs = [
      { x: 0.25, y: 0.3, rx: 0.38, ry: 0.22, speed: 0.00018, phase: 0.0, alpha: 0.13, orbitX: 0.12, orbitY: 0.08 },
      { x: 0.7, y: 0.6, rx: 0.3, ry: 0.18, speed: 0.00024, phase: 1.8, alpha: 0.1, orbitX: 0.09, orbitY: 0.13 },
      { x: 0.5, y: 0.15, rx: 0.45, ry: 0.14, speed: 0.00015, phase: 3.2, alpha: 0.08, orbitX: 0.06, orbitY: 0.1 },
      { x: 0.15, y: 0.75, rx: 0.28, ry: 0.2, speed: 0.0002, phase: 5.1, alpha: 0.09, orbitX: 0.1, orbitY: 0.06 },
      { x: 0.8, y: 0.25, rx: 0.22, ry: 0.26, speed: 0.00028, phase: 0.9, alpha: 0.07, orbitX: 0.07, orbitY: 0.09 }
    ];

    const dots = Array.from({ length: 40 }, () => ({
      x: Math.random() * cv.width,
      y: Math.random() * cv.height,
      r: Math.random() * 0.9 + 0.2,
      phase: Math.random() * Math.PI * 2,
      speed: 0.002 + Math.random() * 0.003
    }));

    let raf = 0;
    const draw = () => {
      const W = cv.width;
      const H = cv.height;
      ctx.clearRect(0, 0, W, H);

      blobs.forEach((b) => {
        b.phase += b.speed * 16;
        const cx = (b.x + Math.sin(b.phase * 1.3) * b.orbitX) * W;
        const cy = (b.y + Math.cos(b.phase * 0.9) * b.orbitY) * H;
        const rx = b.rx * W;
        const ry = b.ry * H;
        const pulse = 1 + Math.sin(b.phase * 2.1) * 0.12;

        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(rx, ry) * pulse);
        grad.addColorStop(0, `rgba(184,245,90,${b.alpha})`);
        grad.addColorStop(0.4, `rgba(120,210,40,${b.alpha * 0.5})`);
        grad.addColorStop(1, "rgba(80,180,20,0)");

        ctx.save();
        ctx.scale(1, ry / rx);
        ctx.beginPath();
        ctx.arc(cx, cy * (rx / ry), rx * pulse, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.restore();
      });

      dots.forEach((d) => {
        d.phase += d.speed;
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(184,245,90,${0.08 + Math.sin(d.phase) * 0.06})`;
        ctx.fill();
      });

      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  async function handleGoogle() {
    setError("");
    setBusy(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleEmail(event: FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");
    setBusy(true);

    try {
      if (mode === "signup") {
        const credential = await createUserWithEmailAndPassword(auth, email, password);
        await sendEmailVerification(credential.user);
        window.localStorage.setItem("fincheck:pendingName", email.split("@")[0] || "Voce");
        setMessage("Conta criada. Confirme seu e-mail para liberar seu workspace.");
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleReset() {
    if (!email) {
      setError("Digite seu e-mail para receber a recuperacao de senha.");
      return;
    }
    setError("");
    setMessage("");
    setBusy(true);
    try {
      await sendPasswordResetEmail(auth, email);
      setMessage("Enviamos o link de recuperacao para seu e-mail.");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#050505",
        fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
        color: "#fff",
        display: "flex",
        flexDirection: "column",
        position: "relative",
        overflow: "hidden"
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Mono:wght@400;500&family=Inter+Tight:ital,wght@0,400;0,600;0,700;0,800;0,900;1,700&family=Plus+Jakarta+Sans:ital,wght@0,300;0,400;0,600;0,800;0,900;1,300&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        ::placeholder{color:rgba(255,255,255,0.22)!important}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(22px)}to{opacity:1;transform:translateY(0)}}
        @keyframes slideFromBottom{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
        @media(max-width:768px){
          .auth-left{display:none!important}
          .auth-divider{display:none!important}
          .auth-right{width:100%!important;padding:32px 24px!important}
          .auth-nav{padding:14px 24px!important;justify-content:center!important}
          .auth-nav-links{display:none!important}
          .auth-nav-spacer{display:none!important}
        }
      `}</style>

      <div style={{ position: "fixed", top: "-18%", left: "-5%", width: 900, height: 780, pointerEvents: "none", zIndex: 0, background: "radial-gradient(ellipse at 35% 45%, rgba(184,245,90,0.12) 0%, rgba(120,200,50,0.05) 38%, transparent 68%)", filter: "blur(52px)" }} />
      <div style={{ position: "fixed", bottom: "-12%", right: "8%", width: 640, height: 520, pointerEvents: "none", zIndex: 0, background: "radial-gradient(ellipse, rgba(150,220,60,0.07) 0%, transparent 62%)", filter: "blur(64px)" }} />
      <div style={{ position: "fixed", top: "38%", left: "42%", width: 420, height: 420, pointerEvents: "none", zIndex: 0, background: "radial-gradient(circle, rgba(184,245,90,0.04) 0%, transparent 70%)", filter: "blur(90px)" }} />
      <canvas ref={canvasRef} style={{ position: "fixed", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 0 }} />
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0, backgroundImage: `linear-gradient(rgba(184,245,90,0.016) 1px,transparent 1px), linear-gradient(90deg,rgba(184,245,90,0.016) 1px,transparent 1px)`, backgroundSize: "72px 72px" }} />

      <nav className="auth-nav" style={{ position: "relative", zIndex: 10, padding: "21px 52px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        <Logo />
        <div className="auth-nav-links" style={{ display: "flex", gap: 32 }}>
          {["Como funciona", "Preços"].map((it) => (
            <a
              key={it}
              href="#"
              style={{ color: "rgba(255,255,255,0.36)", fontSize: 13.5, textDecoration: "none", transition: "color .2s", letterSpacing: "-0.01em" }}
              onMouseEnter={(event) => {
                event.currentTarget.style.color = "rgba(255,255,255,0.82)";
              }}
              onMouseLeave={(event) => {
                event.currentTarget.style.color = "rgba(255,255,255,0.36)";
              }}
            >
              {it}
            </a>
          ))}
        </div>
        <div className="auth-nav-spacer" style={{ width: 100 }} />
      </nav>

      <div style={{ position: "relative", zIndex: 1, flex: 1, display: "flex", width: "100%" }}>
        <div className="auth-left" style={{ width: "50%", flexShrink: 0, display: "flex", flexDirection: "column", justifyContent: "center", padding: "40px 48px", animation: "fadeUp .75s ease both" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 7, background: G_10, border: "1px solid rgba(184,245,90,0.22)", borderRadius: 100, padding: "5px 14px 5px 9px", marginBottom: 28, width: "fit-content" }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: G, boxShadow: `0 0 8px ${G}`, display: "inline-block" }} />
            <span style={{ fontSize: 11, color: G, fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase" }}>
              Diagnóstico financeiro inteligente
            </span>
          </div>

          <h1 style={{ fontFamily: "'Inter Tight', 'Inter', system-ui, sans-serif", fontSize: "clamp(54px, 6.8vw, 82px)", fontWeight: 400, lineHeight: 0.96, letterSpacing: "-0.03em", marginBottom: 24, color: "#fff" }}>
            Você no controle
            <br />
            da sua{" "}
            <em style={{ fontStyle: "normal", color: G, textShadow: "0 0 48px rgba(184,245,90,0.30)" }}>
              vida financeira.
            </em>
          </h1>

          <p style={{ fontSize: 15, color: "rgba(255,255,255,0.40)", lineHeight: 1.75, maxWidth: 400, marginBottom: 34, fontWeight: 400 }}>
            Receitas, gastos e metas do mês — num workspace compartilhado
            com quem você quiser. Sem planilha, sem surpresa no fechamento.
          </p>

          <div style={{ marginBottom: 52 }} />

          <div style={{ position: "relative" }}>
            <div style={{ position: "absolute", bottom: "-18%", left: "50%", transform: "translateX(-50%)", width: "85%", height: 180, background: "radial-gradient(ellipse, rgba(184,245,90,0.28) 0%, rgba(184,245,90,0.10) 40%, transparent 70%)", filter: "blur(36px)", pointerEvents: "none", zIndex: 0 }} />
            <GlassCard accent style={{ background: "rgba(255,255,255,0.025)", position: "relative", zIndex: 1 }}>
              <div style={{ padding: "13px 20px", borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", gap: 6 }}>
                  {["#FF5F57", "#FFBD2E", "#28CA41"].map((c) => (
                    <div key={c} style={{ width: 10, height: 10, borderRadius: "50%", background: c }} />
                  ))}
                </div>
                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.24)", letterSpacing: "0.02em" }}>
                  Minhas finanças · Maio
                </span>
                <span style={{ fontSize: 12, fontWeight: 700, color: G }}>+18.4%</span>
              </div>

              <div style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <p style={{ fontSize: 10, color: "rgba(255,255,255,0.28)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 5 }}>Saldo projetado</p>
                    <p style={{ fontSize: 30, fontWeight: 900, letterSpacing: "-0.05em", color: "#fff", lineHeight: 1 }}>R$ 12.840</p>
                    <p style={{ fontSize: 11.5, color: G, marginTop: 5, fontWeight: 500 }}>R$ 2.140 livres até o fechamento</p>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <p style={{ fontSize: 10, color: "rgba(255,255,255,0.28)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 5 }}>Economia</p>
                    <p style={{ fontSize: 20, fontWeight: 800, color: G, letterSpacing: "-0.04em" }}>R$ 940</p>
                  </div>
                </div>

                <BarChart />

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                  <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 12, border: "1px solid rgba(255,255,255,0.07)", padding: "13px 14px" }}>
                    <p style={{ fontSize: 9.5, color: "rgba(255,255,255,0.28)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 7 }}>Membros</p>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <Users size={12} color={G} />
                      <p style={{ fontSize: 18, fontWeight: 800, color: "#fff", letterSpacing: "-0.04em" }}>2</p>
                    </div>
                    <p style={{ fontSize: 10, color: "rgba(255,255,255,0.26)", marginTop: 4 }}>joão + jenniffer</p>
                  </div>

                  <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 12, border: "1px solid rgba(255,255,255,0.07)", padding: "13px 14px" }}>
                    <p style={{ fontSize: 9.5, color: "rgba(255,255,255,0.28)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 7 }}>Gastos</p>
                    <p style={{ fontSize: 18, fontWeight: 800, color: "#fff", letterSpacing: "-0.04em" }}>R$ 6.760</p>
                    <p style={{ fontSize: 10, color: "rgba(255,100,100,0.72)", marginTop: 4 }}>74% do limite</p>
                  </div>

                  <div style={{ background: "linear-gradient(140deg,rgba(184,245,90,0.10),rgba(184,245,90,0.03))", borderRadius: 12, border: "1px solid rgba(184,245,90,0.16)", padding: "13px 14px", display: "flex", flexDirection: "column", gap: 8, animation: "slideFromBottom .7s .5s ease both", opacity: 0 }}>
                    <p style={{ fontSize: 9.5, color: "rgba(184,245,90,0.55)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Meta</p>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
                      <div style={{ position: "relative", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                        <Donut pct={68} size={56} />
                        <p style={{ position: "absolute", fontSize: 13, fontWeight: 900, color: "#fff", letterSpacing: "-0.04em", lineHeight: 1 }}>68%</p>
                      </div>
                      <p style={{ fontSize: 10, color: G, fontWeight: 600, letterSpacing: "0.03em" }}>viagem</p>
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                  {[
                    { dot: G, label: "Mercado", val: "-R$ 284", pos: false },
                    { dot: "#4EA8FF", label: "Freela", val: "+R$ 1.200", pos: true },
                    { dot: "#FFB520", label: "Aluguel", val: "-R$ 2.100", pos: false }
                  ].map(({ dot, label, val, pos }) => (
                    <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                        <div style={{ width: 7, height: 7, borderRadius: "50%", background: dot, flexShrink: 0 }} />
                        <span style={{ fontSize: 12.5, color: "rgba(255,255,255,0.52)" }}>{label}</span>
                      </div>
                      <span style={{ fontSize: 12.5, fontWeight: 700, color: pos ? G : "rgba(255,100,100,0.82)" }}>{val}</span>
                    </div>
                  ))}
                </div>
              </div>
            </GlassCard>
          </div>
        </div>

<div className="auth-right" style={{ width: "50%", flexShrink: 0, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", padding: "40px 48px", animation: "fadeUp .75s .18s ease both" }}>
          <GlassCard style={{ padding: "36px 30px", background: "rgba(255,255,255,0.025)", width: "100%", maxWidth: 420 }}>
            <h2 style={{ fontFamily: "'Inter Tight', 'Inter', system-ui, sans-serif", fontSize: 22, fontWeight: 600, letterSpacing: "-0.025em", marginBottom: 26, lineHeight: 1.1, color: "#fff", textAlign: "center" }}>
              Entre ou crie uma conta
            </h2>

            <button
              type="button"
              disabled={busy}
              onClick={handleGoogle}
              style={{ width: "100%", padding: "13px 0", borderRadius: 12, background: "#fff", color: "#111", fontSize: 14, fontWeight: 700, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 9, marginBottom: 15, transition: "opacity .2s,transform .15s", letterSpacing: "-0.01em" }}
              onMouseEnter={(event) => {
                event.currentTarget.style.opacity = ".91";
                event.currentTarget.style.transform = "scale(1.01)";
              }}
              onMouseLeave={(event) => {
                event.currentTarget.style.opacity = "1";
                event.currentTarget.style.transform = "scale(1)";
              }}
            >
              <svg width={17} height={17} viewBox="0 0 18 18">
                <path d="M17.64 9.2a10.34 10.34 0 0 0-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92A8.78 8.78 0 0 0 17.64 9.2z" fill="#4285F4" />
                <path d="M9 18a8.6 8.6 0 0 0 5.96-2.18l-2.92-2.26a5.43 5.43 0 0 1-8.07-2.85H.96v2.33A9 9 0 0 0 9 18z" fill="#34A853" />
                <path d="M3.97 10.71A5.41 5.41 0 0 1 3.69 9c0-.59.1-1.17.28-1.71V4.96H.96A9 9 0 0 0 0 9c0 1.45.35 2.82.96 4.04l3.01-2.33z" fill="#FBBC05" />
                <path d="M9 3.58a4.86 4.86 0 0 1 3.44 1.35l2.58-2.58A8.64 8.64 0 0 0 9 0 9 9 0 0 0 .96 4.96l3.01 2.33A5.36 5.36 0 0 1 9 3.58z" fill="#EA4335" />
              </svg>
              Continuar com Google
            </button>

            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <div style={{ flex: 1, height: "0.5px", background: "rgba(255,255,255,0.08)" }} />
              <span style={{ fontSize: 12, color: "rgba(255,255,255,0.20)" }}>ou</span>
              <div style={{ flex: 1, height: "0.5px", background: "rgba(255,255,255,0.08)" }} />
            </div>

            <form onSubmit={handleEmail}>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
                <FInput type="email" placeholder="email@exemplo.com" value={email} onChange={(event) => setEmail(event.target.value)} />
                <FInput
                  type={show ? "text" : "password"}
                  placeholder="Senha"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  right={
                    <button
                      type="button"
                      onClick={() => setShow(!show)}
                      style={{ position: "absolute", right: 13, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", padding: 0, color: "rgba(255,255,255,0.26)", display: "flex", alignItems: "center" }}
                    >
                      {show ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  }
                />
              </div>

              <button
                type="submit"
                disabled={busy}
                style={{ width: "100%", padding: "14px 0", borderRadius: 12, background: G, color: "#000", fontSize: 14.5, fontWeight: 900, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 7, boxShadow: `0 0 36px ${G_20}, 0 4px 20px rgba(0,0,0,0.4)`, letterSpacing: "-0.03em", marginBottom: 17, transition: "all .2s" }}
                onMouseEnter={(event) => {
                  event.currentTarget.style.transform = "scale(1.02)";
                  event.currentTarget.style.boxShadow = `0 0 52px ${G_30},0 4px 20px rgba(0,0,0,0.5)`;
                }}
                onMouseLeave={(event) => {
                  event.currentTarget.style.transform = "scale(1)";
                  event.currentTarget.style.boxShadow = `0 0 36px ${G_20},0 4px 20px rgba(0,0,0,0.4)`;
                }}
              >
                {busy ? (
                  <div style={{ width: 17, height: 17, border: "2.5px solid rgba(0,0,0,0.35)", borderTopColor: "#000", borderRadius: "50%", animation: "spin .7s linear infinite" }} />
                ) : (
                  <>
                    <span>Entrar com e-mail</span>
                    <ArrowRight size={15} />
                  </>
                )}
              </button>
            </form>

            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 18 }}>
              <button
                type="button"
                onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
                style={{ background: "none", border: "none", color: "rgba(255,255,255,0.33)", fontSize: 12.5, cursor: "pointer", padding: 0, letterSpacing: "-0.01em", transition: "color .2s" }}
                onMouseEnter={(event) => {
                  event.currentTarget.style.color = "rgba(255,255,255,0.72)";
                }}
                onMouseLeave={(event) => {
                  event.currentTarget.style.color = "rgba(255,255,255,0.33)";
                }}
              >
                Criar conta
              </button>
              <button
                type="button"
                onClick={handleReset}
                style={{ background: "none", border: "none", color: "rgba(255,255,255,0.33)", fontSize: 12.5, cursor: "pointer", padding: 0, letterSpacing: "-0.01em", transition: "color .2s" }}
                onMouseEnter={(event) => {
                  event.currentTarget.style.color = "rgba(255,255,255,0.72)";
                }}
                onMouseLeave={(event) => {
                  event.currentTarget.style.color = "rgba(255,255,255,0.33)";
                }}
              >
                Recuperar acesso
              </button>
            </div>

            <p style={{ fontSize: 11, color: "rgba(255,255,255,0.38)", lineHeight: 1.6, textAlign: "center" }}>
              Ao entrar, você aceita os{" "}
              <a href="/termos" style={{ color: "rgba(255,255,255,0.60)", textDecoration: "underline", textUnderlineOffset: 2, cursor: "pointer" }}>
                Termos de Uso
              </a>{" "}
              e a{" "}
              <a href="/privacidade" style={{ color: "rgba(255,255,255,0.60)", textDecoration: "underline", textUnderlineOffset: 2, cursor: "pointer" }}>
                Política de Privacidade
              </a>
              .
            </p>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.63-.06-1.24-.16-1.82H9v3.44h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.91c1.7-1.57 2.69-3.88 2.69-6.6z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.19l-2.91-2.26c-.81.54-1.85.86-3.05.86-2.34 0-4.33-1.58-5.04-3.71H.96v2.33A9 9 0 0 0 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.96 10.7a5.41 5.41 0 0 1 0-3.4V4.97H.96a9 9 0 0 0 0 8.06l3-2.33z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.34l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.97l3 2.33C4.67 5.16 6.66 3.58 9 3.58z"
      />
    </svg>
  );
}

function VerifyEmail({ user }: { user: User }) {
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function refresh() {
    setError("");
    try {
      await reload(user);
      if (auth.currentUser?.emailVerified) {
        window.location.reload();
      } else {
        setMessage("Ainda nao confirmamos seu e-mail. Confira sua caixa de entrada.");
      }
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function resend() {
    setError("");
    try {
      await sendEmailVerification(user);
      setMessage("Reenviamos a verificacao.");
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <CenteredCard>
      <h1>Confirme seu e-mail</h1>
      <p className="muted">
        Enviamos uma verificacao para {user.email}. Depois disso voce acessa seu workspace.
      </p>
      {message && <div className="success">{message}</div>}
      {error && <div className="error">{error}</div>}
      <div className="button-row">
        <button className="btn" onClick={refresh}>
          <RefreshCw size={17} /> Ja confirmei
        </button>
        <button className="btn secondary" onClick={resend}>
          Reenviar e-mail
        </button>
        <button className="btn ghost" onClick={() => signOut(auth)}>
          Sair
        </button>
      </div>
    </CenteredCard>
  );
}

function AuthenticatedApp({ user }: { user: User }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [workspaces, setWorkspaces] = useState<WorkspaceWithMember[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadProfile() {
      const snap = await getDoc(doc(db, "users", user.uid));
      setProfile(snap.exists() ? (snap.data() as Profile) : null);
      setLoading(false);
    }
    loadProfile().catch((err) => {
      setError(errorMessage(err));
      setLoading(false);
    });
  }, [user.uid]);

  useEffect(() => {
    if (!profile?.acceptedTermsVersion) return;

    const membersQuery = query(
      collectionGroup(db, "members"),
      where("uid", "==", user.uid),
      where("status", "==", "active")
    );

    return onSnapshot(
      membersQuery,
      async (snapshot) => {
        const entries = await Promise.all(
          snapshot.docs.map(async (memberDoc) => {
            const workspaceRef = memberDoc.ref.parent.parent;
            if (!workspaceRef) return null;
            const workspaceSnap = await getDoc(workspaceRef);
            if (!workspaceSnap.exists()) return null;
            return {
              workspace: { id: workspaceSnap.id, ...workspaceSnap.data() } as Workspace,
              member: {
                id: memberDoc.id,
                workspaceId: workspaceSnap.id,
                ...memberDoc.data()
              } as Member
            };
          })
        );

        const filtered = entries.filter(Boolean) as WorkspaceWithMember[];
        setWorkspaces(filtered);
        setActiveWorkspaceId((current) => current || filtered[0]?.workspace.id || "");
      },
      (err) => setError(errorMessage(err))
    );
  }, [profile?.acceptedTermsVersion, user.uid]);

  async function acceptLegal() {
    setError("");
    try {
      const displayName =
        user.displayName ||
        window.localStorage.getItem("fincheck:pendingName") ||
        user.email?.split("@")[0] ||
        "Voce";

      const userRef = doc(db, "users", user.uid);
      const nextProfile: Profile = {
        uid: user.uid,
        displayName,
        email: user.email || "",
        hasCreatedRealMonth: false,
        acceptedTermsVersion: TERMS_VERSION,
        acceptedPrivacyVersion: PRIVACY_VERSION
      };

      await setDoc(userRef, { ...nextProfile, updatedAt: serverTimestamp() }, { merge: true });
      await addDoc(collection(db, "consents"), {
        uid: user.uid,
        email: user.email || "",
        termsVersion: TERMS_VERSION,
        privacyVersion: PRIVACY_VERSION,
        text: consentText,
        purpose: "account_and_workspace_access",
        createdAt: serverTimestamp()
      });

      setProfile(nextProfile);
      window.localStorage.removeItem("fincheck:pendingName");
      await ensureDefaultWorkspace(user, displayName);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  if (loading) {
    return <CenteredStatus text="Abrindo sua vida financeira..." />;
  }

  if (error) {
    return (
      <CenteredCard>
        <div className="error">{error}</div>
        <button className="btn secondary" onClick={() => signOut(auth)}>
          Sair
        </button>
      </CenteredCard>
    );
  }

  if (!profile?.acceptedTermsVersion) {
    return <LegalGate onAccept={acceptLegal} />;
  }

  if (!workspaces.length) {
    return <CenteredStatus text="Criando seu primeiro workspace..." />;
  }

  const activeEntry =
    workspaces.find((entry) => entry.workspace.id === activeWorkspaceId) || workspaces[0];

  return (
    <WorkspaceApp
      user={user}
      profile={profile}
      setProfile={setProfile}
      workspaces={workspaces}
      activeEntry={activeEntry}
      onSelectWorkspace={setActiveWorkspaceId}
    />
  );
}

function LegalGate({ onAccept }: { onAccept: () => Promise<void> }) {
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    await onAccept();
    setBusy(false);
  }

  return (
    <CenteredCard>
      <h1>Antes de abrir seu workspace</h1>
      <p className="muted">
        O Fincheck Pro guarda apenas os dados necessarios para sua gestao financeira. Se voce
        convidar alguem, essa pessoa vera os dados do workspace compartilhado.
      </p>
      <label style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
        <input
          type="checkbox"
          checked={accepted}
          onChange={(event) => setAccepted(event.target.checked)}
        />
        <span>
          Li e aceito os <a href="/termos">Termos de Uso</a> e a{" "}
          <a href="/privacidade">Politica de Privacidade</a>.
        </span>
      </label>
      <button className="btn" disabled={!accepted || busy} onClick={submit}>
        Continuar
      </button>
    </CenteredCard>
  );
}

function WorkspaceApp({
  user,
  profile,
  setProfile,
  workspaces,
  activeEntry,
  onSelectWorkspace
}: {
  user: User;
  profile: Profile;
  setProfile: (profile: Profile) => void;
  workspaces: WorkspaceWithMember[];
  activeEntry: WorkspaceWithMember;
  onSelectWorkspace: (workspaceId: string) => void;
}) {
  const [monthKey, setMonthKey] = useState(currentMonthKey());
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [inviteLink, setInviteLink] = useState("");
  const [waitlistDone, setWaitlistDone] = useState(false);

  const workspace = activeEntry.workspace;
  const member = activeEntry.member;
  const isOwner = member.role === "owner";
  const showDemo = !profile.hasCreatedRealMonth && transactions.length === 0;
  const visibleTransactions = showDemo ? demoTransactions : transactions;
  const summary = useMemo(
    () => buildMonthlySummary(visibleTransactions, showDemo ? "2026-04" : monthKey),
    [monthKey, showDemo, visibleTransactions]
  );

  useEffect(() => {
    setLoading(true);
    const txQuery = query(
      collection(db, "workspaces", workspace.id, "transactions"),
      where("monthKey", "==", monthKey),
      orderBy("date", "desc")
    );

    return onSnapshot(
      txQuery,
      (snapshot) => {
        setTransactions(
          snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as Transaction)
        );
        setLoading(false);
      },
      (err) => {
        setError(errorMessage(err));
        setLoading(false);
      }
    );
  }, [workspace.id, monthKey]);

  async function createInvite() {
    setError("");
    try {
      const token = crypto.randomUUID();
      await setDoc(doc(db, "invites", token), {
        workspaceId: workspace.id,
        workspaceName: workspace.name,
        createdBy: user.uid,
        status: "active",
        createdAt: serverTimestamp(),
        expiresAt: Timestamp.fromDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000))
      });
      setInviteLink(`${window.location.origin}/convite?token=${token}`);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function joinWaitlist() {
    await setDoc(
      doc(db, "workspaces", workspace.id, "openFinanceWaitlist", user.uid),
      {
        uid: user.uid,
        email: user.email || "",
        displayName: profile.displayName,
        workspaceId: workspace.id,
        createdAt: serverTimestamp(),
        source: "dashboard_cta"
      },
      { merge: true }
    );
    setWaitlistDone(true);
  }

  async function deleteWorkspace() {
    const confirmation = window.prompt(
      `Digite ${workspace.name} para excluir este workspace e seus dados financeiros.`
    );
    if (confirmation !== workspace.name) return;

    const batch = writeBatch(db);
    const childCollections = ["transactions", "categories", "summaries", "openFinanceWaitlist"];

    for (const collectionName of childCollections) {
      const snapshot = await getDocs(collection(db, "workspaces", workspace.id, collectionName));
      snapshot.docs.forEach((item) => batch.delete(item.ref));
    }

    await updateDoc(doc(db, "workspaces", workspace.id), {
      confirmDelete: true,
      updatedAt: serverTimestamp()
    });
    batch.delete(doc(db, "workspaces", workspace.id));
    await batch.commit();

    const membersSnap = await getDocs(collection(db, "workspaces", workspace.id, "members"));
    const memberDeletes = membersSnap.docs.sort((a, b) => {
      if (a.id === user.uid) return 1;
      if (b.id === user.uid) return -1;
      return 0;
    });
    for (const memberDoc of memberDeletes) {
      await deleteDoc(memberDoc.ref);
    }
  }

  async function leaveWorkspace() {
    await updateDoc(doc(db, "workspaces", workspace.id, "members", user.uid), {
      status: "left",
      leftAt: serverTimestamp()
    });
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">F</span>
          <span>Fincheck Pro</span>
        </div>
        <div className="button-row">
          <select
            className="select"
            value={workspace.id}
            onChange={(event) => onSelectWorkspace(event.target.value)}
            aria-label="Workspace"
          >
            {workspaces.map((entry) => (
              <option key={entry.workspace.id} value={entry.workspace.id}>
                {entry.workspace.name}
              </option>
            ))}
          </select>
          <button className="btn secondary" onClick={() => signOut(auth)}>
            <LogOut size={17} /> Sair
          </button>
        </div>
      </header>

      <div className="page section">
        <div className="section-header">
          <div>
            <h1>{workspace.name}</h1>
            <p className="muted">
              {member.role === "owner" ? "Owner" : "Editor"} da vida financeira compartilhada.
            </p>
          </div>
          <input
            className="input"
            style={{ maxWidth: 180 }}
            type="month"
            value={monthKey}
            onChange={(event) => setMonthKey(event.target.value)}
          />
        </div>

        {showDemo && (
          <div className="demo-banner">
            <div>
              <strong>Veja como o resumo fica antes de lancar seus dados.</strong>
              <div className="muted">
                Assim que voce criar o primeiro lancamento real, a demo sai do caminho.
              </div>
            </div>
            <span className="tag">Demo</span>
          </div>
        )}

        {error && <div className="error">{error}</div>}

        <section className="stats-grid">
          <Stat label="Entradas" value={formatCurrency(summary.income)} tone="income" />
          <Stat label="Saidas" value={formatCurrency(summary.expense)} tone="expense" />
          <Stat label="Saldo" value={formatCurrency(summary.balance)} tone="balance" />
        </section>

        <section className="dashboard-grid">
          <div className="section">
            <TransactionForm
              user={user}
              profile={profile}
              workspaceId={workspace.id}
              monthKey={monthKey}
              onCreated={async () => {
                if (!profile.hasCreatedRealMonth) {
                  const nextProfile = { ...profile, hasCreatedRealMonth: true };
                  await updateDoc(doc(db, "users", user.uid), {
                    hasCreatedRealMonth: true,
                    updatedAt: serverTimestamp()
                  });
                  setProfile(nextProfile);
                }
              }}
            />

            <div className="panel">
              <div className="section-header">
                <h2>Lancamentos</h2>
                {loading && <span className="muted">Carregando...</span>}
              </div>
              <div className="transaction-list">
                {visibleTransactions.map((transaction) => (
                  <TransactionRow
                    key={transaction.id}
                    workspaceId={workspace.id}
                    transaction={transaction}
                    readonly={showDemo}
                  />
                ))}
              </div>
            </div>
          </div>

          <aside className="section">
            <div className="panel section">
              <h2>Resumo de {monthLabel(showDemo ? "2026-04" : monthKey)}</h2>
              {summary.insights.map((insight) => (
                <p key={insight} className="muted">
                  {insight}
                </p>
              ))}
              <textarea className="textarea" readOnly value={summary.shareText} />
              <button
                className="btn secondary"
                onClick={() => navigator.clipboard.writeText(summary.shareText)}
              >
                <Copy size={17} /> Copiar resumo
              </button>
            </div>

            <div className="panel section">
              <h2>Compartilhar acesso</h2>
              <p className="muted">
                Convide alguem para ver e editar os dados deste workspace como editor.
              </p>
              {isOwner ? (
                <>
                  <button className="btn" onClick={createInvite}>
                    <Users size={17} /> Criar link de convite
                  </button>
                  {inviteLink && (
                    <div className="success">
                      <div style={{ wordBreak: "break-all" }}>{inviteLink}</div>
                      <button
                        className="btn secondary"
                        style={{ marginTop: 10 }}
                        onClick={() => navigator.clipboard.writeText(inviteLink)}
                      >
                        <Copy size={17} /> Copiar link
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <div className="muted">Apenas owners gerenciam convites na v1.</div>
              )}
            </div>

            <div className="panel section">
              <h2>Open Finance</h2>
              <p className="muted">
                Estamos avaliando conexao bancaria automatica. Entre na fila sem compartilhar
                dados bancarios agora.
              </p>
              {waitlistDone ? (
                <div className="success">Interesse registrado.</div>
              ) : (
                <button className="btn secondary" onClick={joinWaitlist}>
                  <Handshake size={17} /> Quero entrar na fila
                </button>
              )}
            </div>

            <div className="panel section">
              <h2>Controle do workspace</h2>
              {isOwner ? (
                <button className="btn danger" onClick={deleteWorkspace}>
                  <Trash2 size={17} /> Excluir workspace
                </button>
              ) : (
                <button className="btn secondary" onClick={leaveWorkspace}>
                  Sair deste workspace
                </button>
              )}
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}

function TransactionForm({
  user,
  profile,
  workspaceId,
  monthKey,
  onCreated
}: {
  user: User;
  profile: Profile;
  workspaceId: string;
  monthKey: string;
  onCreated: () => Promise<void>;
}) {
  const [type, setType] = useState<TransactionType>("expense");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("Alimentacao");
  const [date, setDate] = useState(`${monthKey}-01`);
  const [busy, setBusy] = useState(false);
  const categories = defaultCategories.filter((item) => item.type === type);

  useEffect(() => {
    setDate(`${monthKey}-01`);
  }, [monthKey]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await addDoc(collection(db, "workspaces", workspaceId, "transactions"), {
        type,
        description,
        amount: Number(amount),
        category,
        date,
        monthKey,
        createdBy: user.uid,
        createdByName: profile.displayName,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      setDescription("");
      setAmount("");
      await onCreated();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="panel section" onSubmit={submit}>
      <div className="section-header">
        <h2>Novo lancamento</h2>
        <span className="tag">{type === "income" ? "Entrada" : "Saida"}</span>
      </div>
      <div className="two-col">
        <select
          className="select"
          value={type}
          onChange={(event) => {
            const nextType = event.target.value as TransactionType;
            setType(nextType);
            setCategory(nextType === "income" ? "Renda" : "Alimentacao");
          }}
        >
          <option value="expense">Saida</option>
          <option value="income">Entrada</option>
        </select>
        <input
          className="input"
          type="number"
          min="0"
          step="0.01"
          placeholder="Valor"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          required
        />
      </div>
      <input
        className="input"
        placeholder="Descricao"
        value={description}
        onChange={(event) => setDescription(event.target.value)}
        required
      />
      <div className="two-col">
        <select
          className="select"
          value={category}
          onChange={(event) => setCategory(event.target.value)}
        >
          {categories.map((item) => (
            <option key={item.name} value={item.name}>
              {item.name}
            </option>
          ))}
        </select>
        <input
          className="input"
          type="date"
          value={date}
          onChange={(event) => setDate(event.target.value)}
          required
        />
      </div>
      <button className="btn" disabled={busy}>
        <Plus size={17} /> Lancar
      </button>
    </form>
  );
}

function TransactionRow({
  workspaceId,
  transaction,
  readonly
}: {
  workspaceId: string;
  transaction: Transaction;
  readonly: boolean;
}) {
  async function remove() {
    await deleteDoc(doc(db, "workspaces", workspaceId, "transactions", transaction.id));
  }

  return (
    <div className="transaction">
      <div>
        <strong>{transaction.description}</strong>
        <div className="muted">
          {transaction.category} · {transaction.date} · {transaction.createdByName}
        </div>
      </div>
      <span className={transaction.type === "income" ? "amount-income" : "amount-expense"}>
        {transaction.type === "income" ? "+" : "-"}
        {formatCurrency(transaction.amount)}
      </span>
      {!readonly && (
        <button className="btn ghost" aria-label="Excluir lancamento" onClick={remove}>
          <Trash2 size={17} />
        </button>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="stat">
      <span className="muted">{label}</span>
      <strong className={tone === "income" ? "amount-income" : tone === "expense" ? "amount-expense" : ""}>
        {value}
      </strong>
    </div>
  );
}

function CenteredStatus({ text }: { text: string }) {
  return (
    <main className="auth-panel" style={{ minHeight: "100vh" }}>
      <p className="muted">{text}</p>
    </main>
  );
}

function CenteredCard({ children }: { children: React.ReactNode }) {
  return (
    <main className="auth-panel" style={{ minHeight: "100vh" }}>
      <div className="card auth-card section">{children}</div>
    </main>
  );
}

async function ensureDefaultWorkspace(user: User, displayName: string) {
  const memberQuery = query(
    collectionGroup(db, "members"),
    where("uid", "==", user.uid),
    where("status", "==", "active")
  );
  const existing = await getDocs(memberQuery);
  if (!existing.empty) return;

  const workspaceRef = doc(collection(db, "workspaces"));
  const batch = writeBatch(db);

  batch.set(workspaceRef, {
    name: "Minha vida financeira",
    createdBy: user.uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  batch.set(doc(db, "workspaces", workspaceRef.id, "members", user.uid), {
    uid: user.uid,
    role: "owner",
    status: "active",
    displayName,
    email: user.email || "",
    createdBy: user.uid,
    joinedAt: serverTimestamp()
  });

  await batch.commit();
}

function errorMessage(err: unknown) {
  if (err instanceof Error) return err.message;
  return "Algo saiu do eixo. Tente de novo.";
}
