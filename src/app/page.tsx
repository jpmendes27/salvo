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
  Check,
  ChevronDown,
  Copy,
  Eye,
  EyeOff,
  FileText,
  ImageIcon,
  LogOut,
  Plus,
  RefreshCw,
  Settings,
  Trash2,
  Upload,
  Users,
  X
} from "lucide-react";
import { CSSProperties, DragEvent, FormEvent, ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { auth, db, googleProvider } from "@/lib/firebase";
import { consentText, PRIVACY_VERSION, TERMS_VERSION } from "@/lib/legal";
import { currentMonthKey, formatCurrency, monthLabel } from "@/lib/money";
import { buildMonthlySummary } from "@/lib/summary";
import type { Member, Transaction, TransactionType, Workspace } from "@/lib/types";
import { defaultCategories, demoTransactions } from "@/lib/demo";
import { categorizeTransaction, CATEGORIES, CATEGORY_COLORS, fileToBase64, guessCategory, parseCSV, parseOFX, type ParsedTransaction } from "@/lib/parsers";
import { isStopDescription, parseBankText } from "@/lib/bank-parsers";
import { extractPDFText } from "@/lib/pdf-extract";

type Profile = {
  uid: string;
  displayName: string;
  email: string;
  hasCreatedRealMonth?: boolean;
  acceptedTermsVersion?: string;
  acceptedPrivacyVersion?: string;
  workspaceIds?: string[];
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
    return onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser?.emailVerified) {
        await currentUser.getIdToken(true);
      }
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

            {error && (
              <div style={{ background: "rgba(255,80,80,0.12)", border: "1px solid rgba(255,80,80,0.25)", borderRadius: 10, padding: "10px 14px", marginBottom: 14, fontSize: 13, color: "#ff8080", lineHeight: 1.5 }}>
                {error}
              </div>
            )}
            {message && (
              <div style={{ background: "rgba(184,245,90,0.10)", border: "1px solid rgba(184,245,90,0.25)", borderRadius: 10, padding: "10px 14px", marginBottom: 14, fontSize: 13, color: G, lineHeight: 1.5 }}>
                {message}
              </div>
            )}

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
                    <span>{mode === "signup" ? "Criar conta" : "Entrar com e-mail"}</span>
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
                {mode === "signup" ? "Já tenho conta" : "Criar conta"}
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
        await auth.currentUser.getIdToken(true);
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
      if (!snap.exists()) {
        setProfile(null);
        setLoading(false);
        return;
      }
      const profile = snap.data() as Profile;
      if (profile.acceptedTermsVersion && !profile.workspaceIds?.length) {
        const displayName = user.displayName || user.email?.split("@")[0] || "Voce";
        await ensureDefaultWorkspace(user, displayName);
        window.location.reload();
        return;
      }
      setProfile(profile);
      setLoading(false);
    }
    loadProfile().catch((err) => {
      setError(errorMessage(err));
      setLoading(false);
    });
  }, [user.uid]);

  useEffect(() => {
    const ids = profile?.workspaceIds;
    if (!profile?.acceptedTermsVersion || !ids?.length) return;

    const unsubs = ids.map((wsId) =>
      onSnapshot(doc(db, "workspaces", wsId), async (wsSnap) => {
        if (!wsSnap.exists()) return;
        const memberSnap = await getDoc(doc(db, "workspaces", wsId, "members", user.uid));
        if (!memberSnap.exists()) return;
        const entry: WorkspaceWithMember = {
          workspace: { id: wsSnap.id, ...wsSnap.data() } as Workspace,
          member: { id: memberSnap.id, workspaceId: wsId, ...memberSnap.data() } as Member
        };
        setWorkspaces((prev) => {
          const rest = prev.filter((e) => e.workspace.id !== wsId);
          return [...rest, entry];
        });
        setActiveWorkspaceId((current) => current || wsId);
      })
    );

    return () => unsubs.forEach((u) => u());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.workspaceIds?.join(","), profile?.acceptedTermsVersion, user.uid]);

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

      window.localStorage.removeItem("fincheck:pendingName");
      await ensureDefaultWorkspace(user, displayName);
      window.location.reload();
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

// ─── Workspace dashboard ────────────────────────────────────────────────────

const PARSE_FUNCTION_URL =
  process.env.NEXT_PUBLIC_FUNCTIONS_URL ||
  "https://parsebankstatement-ihalwtxjpq-uc.a.run.app";

type ParsedWithMeta = ParsedTransaction & { _id: string; selected: boolean };

type ImportState =
  | { phase: "parsing" }
  | { phase: "preview"; rows: ParsedWithMeta[]; error?: string }
  | { phase: "saving"; rows: ParsedWithMeta[] };

function categoryColor(cat: string): string {
  return CATEGORY_COLORS[cat as keyof typeof CATEGORY_COLORS] ?? "#6b7080";
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
  const [txLoading, setTxLoading] = useState(true);
  const [error, setError] = useState("");
  const [txFilter, setTxFilter] = useState<"all" | "income" | "expense">("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [importState, setImportState] = useState<ImportState | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [inviteLink, setInviteLink] = useState("");

  const workspace = activeEntry.workspace;
  const member = activeEntry.member;
  const isOwner = member.role === "owner";
  const showDemo = !profile.hasCreatedRealMonth && transactions.length === 0;
  const visibleTx = showDemo ? demoTransactions : transactions;
  const sources = useMemo(() => {
    const labels = [...new Set(transactions.map((t) => t.sourceLabel).filter(Boolean))] as string[];
    return labels.sort();
  }, [transactions]);

  const filteredTx = visibleTx.filter((t) => {
    const typeOk = txFilter === "all" || t.type === txFilter;
    const sourceOk = sourceFilter === "all" || t.sourceLabel === sourceFilter;
    return typeOk && sourceOk;
  });
  const summary = useMemo(
    () => buildMonthlySummary(visibleTx, showDemo ? "2026-04" : monthKey),
    [monthKey, showDemo, visibleTx]
  );

  useEffect(() => {
    setTxLoading(true);
    const txQuery = query(
      collection(db, "workspaces", workspace.id, "transactions"),
      where("monthKey", "==", monthKey),
      orderBy("date", "desc")
    );
    return onSnapshot(
      txQuery,
      (snap) => {
        setTransactions(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Transaction));
        setTxLoading(false);
      },
      (err) => {
        setError(errorMessage(err));
        setTxLoading(false);
      }
    );
  }, [workspace.id, monthKey]);

  async function markReal() {
    if (profile.hasCreatedRealMonth) return;
    await updateDoc(doc(db, "users", user.uid), {
      hasCreatedRealMonth: true,
      updatedAt: serverTimestamp()
    });
    setProfile({ ...profile, hasCreatedRealMonth: true });
  }

  async function handleFiles(files: File[]) {
    setImportState({ phase: "parsing" });
    const rows: ParsedWithMeta[] = [];

    for (const file of files) {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
      const mime = file.type || `application/${ext}`;
      try {
        if (ext === "csv" || mime.includes("csv")) {
          const text = await file.text();
          parseCSV(text, file.name).forEach((t) =>
            rows.push({ ...t, _id: crypto.randomUUID(), selected: true })
          );
        } else if (ext === "ofx" || ext === "qfx" || mime.includes("ofx")) {
          const text = await file.text();
          parseOFX(text, file.name).forEach((t) =>
            rows.push({ ...t, _id: crypto.randomUUID(), selected: true })
          );
        } else if (ext === "pdf" || mime === "application/pdf" || (mime === "application/octet-stream" && ext === "pdf")) {
          const pdfText = await extractPDFText(file);
          const { transactions: bankTxs, sourceLabel: bankLabel } = parseBankText(pdfText, { filename: file.name });

          if (bankTxs.length >= 3) {
            bankTxs.forEach((t) =>
              rows.push({ ...t, _id: crypto.randomUUID(), selected: true })
            );
          } else {
            // Fallback to Claude when deterministic parser yields too few results
            const base64 = await fileToBase64(file);
            const resp = await fetch(PARSE_FUNCTION_URL, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ fileData: base64, mimeType: "application/pdf" })
            });
            if (!resp.ok) {
              const errJson = await resp.json().catch(() => ({}));
              throw new Error(errJson.error || `Erro ao processar ${file.name}`);
            }
            const data = await resp.json();
            const claudeLabel: string = data.sourceLabel || bankLabel;
            (data.transactions ?? []).forEach((t: ParsedTransaction) => {
              if (Math.abs(t.amount ?? 0) === 0) return;
              if (isStopDescription(t.description ?? "")) return;
              const type = t.type ?? (t.amount < 0 ? "expense" : "income");
              rows.push({
                ...t,
                type,
                amount: Math.abs(t.amount ?? 0),
                category: categorizeTransaction(t.description ?? "", type),
                sourceLabel: claudeLabel,
                _id: crypto.randomUUID(),
                selected: true
              });
            });
          }
        } else if (mime.startsWith("image/")) {
          const base64 = await fileToBase64(file);
          const resp = await fetch(PARSE_FUNCTION_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ fileData: base64, mimeType: mime })
          });
          if (!resp.ok) {
            const errJson = await resp.json().catch(() => ({}));
            throw new Error(errJson.error || `Erro ao processar ${file.name}`);
          }
          const data = await resp.json();
          const imageLabel: string = data.sourceLabel || "Comprovante";
          (data.transactions ?? []).forEach((t: ParsedTransaction) => {
            if (Math.abs(t.amount ?? 0) === 0) return;
            if (isStopDescription(t.description ?? "")) return;
            const type = t.type ?? (t.amount < 0 ? "expense" : "income");
            rows.push({
              ...t,
              type,
              amount: Math.abs(t.amount ?? 0),
              category: categorizeTransaction(t.description ?? "", type),
              sourceLabel: imageLabel,
              _id: crypto.randomUUID(),
              selected: true
            });
          });
        }
      } catch (err) {
        setImportState({
          phase: "preview",
          rows,
          error: `Erro em ${file.name}: ${errorMessage(err)}`
        });
        return;
      }
    }

    // Auto-deselect duplicates
    const existingKeys = new Set(
      transactions.map((t) => {
        const raw = (t as Transaction & { dedupKey?: string }).dedupKey;
        if (raw) return raw;
        return `${t.date}|${t.description.toLowerCase().trim()}|${t.amount.toFixed(2)}`;
      })
    );
    rows.forEach((r) => {
      if (existingKeys.has(r.dedupKey)) r.selected = false;
    });

    setImportState({ phase: "preview", rows });
  }

  async function confirmImport(rows: ParsedWithMeta[]) {
    setImportState({ phase: "saving", rows });
    const selected = rows.filter((r) => r.selected);
    for (const tx of selected) {
      await addDoc(collection(db, "workspaces", workspace.id, "transactions"), {
        type: tx.type,
        description: tx.description,
        amount: tx.amount,
        category: tx.category || categorizeTransaction(tx.description, tx.type),
        date: tx.date,
        monthKey: tx.monthKey || tx.date.slice(0, 7),
        createdBy: user.uid,
        createdByName: profile.displayName,
        sourceLabel: tx.sourceLabel ?? null,
        dedupKey: tx.dedupKey || `${tx.date}|${tx.description.toLowerCase().trim()}|${tx.amount.toFixed(2)}`,
        source: "import",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    }
    await markReal();
    setImportState(null);
  }

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

  async function deleteWorkspace() {
    const conf = window.prompt(
      `Digite "${workspace.name}" para confirmar a exclusão permanente.`
    );
    if (conf !== workspace.name) return;
    const batch = writeBatch(db);
    for (const col of ["transactions", "categories", "summaries", "openFinanceWaitlist"]) {
      const snap = await getDocs(collection(db, "workspaces", workspace.id, col));
      snap.docs.forEach((d) => batch.delete(d.ref));
    }
    batch.delete(doc(db, "workspaces", workspace.id));
    await batch.commit();
    const membersSnap = await getDocs(
      collection(db, "workspaces", workspace.id, "members")
    );
    for (const md of membersSnap.docs) await deleteDoc(md.ref);
  }

  const D = {
    shell: {
      minHeight: "100vh",
      background: "#050505",
      color: "#fff",
      fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
      display: "flex",
      flexDirection: "column" as const
    },
    topbar: {
      position: "sticky" as const,
      top: 0,
      zIndex: 20,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "0 clamp(16px,4vw,40px)",
      height: 60,
      background: "rgba(5,5,5,0.88)",
      borderBottom: "1px solid rgba(255,255,255,0.07)",
      backdropFilter: "blur(20px)",
      gap: 16
    },
    content: {
      flex: 1,
      width: "min(1200px,calc(100% - 32px))",
      margin: "0 auto",
      padding: "32px 0 80px",
      display: "grid",
      gap: 24
    }
  };

  return (
    <div style={D.shell}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;600;800;900&family=DM+Serif+Display&family=DM+Mono:wght@400;500&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
        .ws-tx-row:hover{background:rgba(255,255,255,0.03)!important}
        .ws-filter-btn{cursor:pointer;transition:all .18s}
        .ws-icon-btn:hover{background:rgba(255,255,255,0.08)!important;color:#fff!important}
        @media(max-width:800px){.ws-sidebar{display:none!important}.ws-grid{grid-template-columns:1fr!important}}
      `}</style>

      {/* Topbar */}
      <header style={D.topbar}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <Logo />
          {workspaces.length > 1 ? (
            <select
              value={workspace.id}
              onChange={(e) => onSelectWorkspace(e.target.value)}
              style={{
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 8,
                color: "#fff",
                fontSize: 13,
                padding: "6px 10px",
                cursor: "pointer"
              }}
            >
              {workspaces.map((e) => (
                <option key={e.workspace.id} value={e.workspace.id}>
                  {e.workspace.name}
                </option>
              ))}
            </select>
          ) : (
            <span style={{ fontSize: 13, color: "rgba(255,255,255,0.46)" }}>
              {workspace.name}
            </span>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <input
            type="month"
            value={monthKey}
            onChange={(e) => setMonthKey(e.target.value)}
            style={{
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 8,
              color: "#fff",
              fontSize: 13,
              padding: "6px 10px",
              cursor: "pointer"
            }}
          />
          <IconBtn
            icon={<Settings size={16} />}
            label="Configurações"
            onClick={() => setSettingsOpen(true)}
          />
          <IconBtn
            icon={<LogOut size={16} />}
            label="Sair"
            onClick={() => signOut(auth)}
          />
        </div>
      </header>

      <div style={D.content}>
        {/* Demo banner */}
        {showDemo && (
          <div
            style={{
              background: "rgba(184,245,90,0.07)",
              border: "1px solid rgba(184,245,90,0.18)",
              borderRadius: 12,
              padding: "14px 20px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 16,
              animation: "fadeUp .5s ease both"
            }}
          >
            <div>
              <span style={{ fontWeight: 700, color: G, fontSize: 13 }}>
                Visualização demo
              </span>
              <p style={{ fontSize: 12.5, color: "rgba(255,255,255,0.45)", marginTop: 3 }}>
                Importe seu extrato ou adicione um lançamento para ver seus dados reais.
              </p>
            </div>
            <span
              style={{
                fontSize: 11,
                fontWeight: 800,
                color: G,
                background: "rgba(184,245,90,0.12)",
                border: "1px solid rgba(184,245,90,0.22)",
                borderRadius: 999,
                padding: "4px 10px",
                flexShrink: 0
              }}
            >
              DEMO
            </span>
          </div>
        )}

        {error && (
          <div
            style={{
              background: "rgba(255,80,80,0.1)",
              border: "1px solid rgba(255,80,80,0.25)",
              borderRadius: 12,
              padding: "12px 16px",
              fontSize: 13,
              color: "#ff8080"
            }}
          >
            {error}
          </div>
        )}

        {/* Balance header */}
        <BalanceHeader summary={summary} showDemo={showDemo} monthKey={monthKey} />

        {/* Main grid */}
        <div
          className="ws-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 340px",
            gap: 20,
            alignItems: "start"
          }}
        >
          {/* Left column */}
          <div style={{ display: "grid", gap: 20 }}>
            {/* Upload zone */}
            <UploadZone
              onFiles={handleFiles}
              onAddManual={() => setAddOpen(true)}
            />

            {/* Transaction list */}
            <WsCard>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 18
                }}
              >
                <h2 style={{ fontSize: 15, fontWeight: 700 }}>Lançamentos</h2>
                <div style={{ display: "flex", gap: 6 }}>
                  {(["all", "income", "expense"] as const).map((f) => (
                    <button
                      key={f}
                      className="ws-filter-btn"
                      onClick={() => setTxFilter(f)}
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        padding: "5px 12px",
                        borderRadius: 999,
                        border: "none",
                        background:
                          txFilter === f
                            ? f === "income"
                              ? "rgba(184,245,90,0.15)"
                              : f === "expense"
                              ? "rgba(255,80,80,0.15)"
                              : "rgba(255,255,255,0.10)"
                            : "transparent",
                        color:
                          txFilter === f
                            ? f === "income"
                              ? G
                              : f === "expense"
                              ? "#ff8080"
                              : "#fff"
                            : "rgba(255,255,255,0.38)"
                      }}
                    >
                      {f === "all" ? "Todas" : f === "income" ? "Entradas" : "Saídas"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Source tabs — só aparece quando há mais de uma fonte */}
              {sources.length > 1 && (
                <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
                  {(["all", ...sources] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => setSourceFilter(s)}
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        padding: "4px 10px",
                        borderRadius: 999,
                        border: `1px solid ${sourceFilter === s ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.08)"}`,
                        background: sourceFilter === s ? "rgba(255,255,255,0.10)" : "transparent",
                        color: sourceFilter === s ? "#fff" : "rgba(255,255,255,0.38)",
                        cursor: "pointer",
                        letterSpacing: "0.01em"
                      }}
                    >
                      {s === "all" ? "Tudo" : s}
                    </button>
                  ))}
                </div>
              )}

              {txLoading ? (
                <div
                  style={{
                    textAlign: "center",
                    padding: "32px 0",
                    color: "rgba(255,255,255,0.28)",
                    fontSize: 13
                  }}
                >
                  Carregando lançamentos...
                </div>
              ) : filteredTx.length === 0 ? (
                <div
                  style={{
                    textAlign: "center",
                    padding: "40px 0",
                    color: "rgba(255,255,255,0.24)",
                    fontSize: 13
                  }}
                >
                  Nenhum lançamento neste mês.
                </div>
              ) : (
                <div style={{ display: "grid", gap: 2 }}>
                  {filteredTx.map((tx) => (
                    <TxRow
                      key={tx.id}
                      tx={tx}
                      readonly={showDemo}
                      onDelete={async () =>
                        deleteDoc(doc(db, "workspaces", workspace.id, "transactions", tx.id))
                      }
                    />
                  ))}
                </div>
              )}
            </WsCard>
          </div>

          {/* Right sidebar */}
          <aside className="ws-sidebar" style={{ display: "grid", gap: 16 }}>
            {/* Summary card */}
            <WsCard>
              <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 14 }}>
                Resumo de {monthLabel(showDemo ? "2026-04" : monthKey)}
              </h3>
              {summary.insights.map((ins) => (
                <p
                  key={ins}
                  style={{ fontSize: 12.5, color: "rgba(255,255,255,0.45)", lineHeight: 1.6, marginBottom: 6 }}
                >
                  {ins}
                </p>
              ))}
              <textarea
                readOnly
                value={summary.shareText}
                style={{
                  width: "100%",
                  marginTop: 10,
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 8,
                  color: "rgba(255,255,255,0.55)",
                  fontSize: 11.5,
                  padding: "10px 12px",
                  resize: "vertical",
                  minHeight: 80,
                  lineHeight: 1.6
                }}
              />
              <button
                onClick={() => navigator.clipboard.writeText(summary.shareText)}
                style={{
                  marginTop: 8,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 12,
                  fontWeight: 600,
                  color: "rgba(255,255,255,0.45)",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  padding: 0,
                  transition: "color .18s"
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#fff")}
                onMouseLeave={(e) =>
                  (e.currentTarget.style.color = "rgba(255,255,255,0.45)")
                }
              >
                <Copy size={13} /> Copiar
              </button>
            </WsCard>

            {/* Invite card */}
            {isOwner && (
              <WsCard>
                <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>
                  Convidar membro
                </h3>
                <p
                  style={{
                    fontSize: 12,
                    color: "rgba(255,255,255,0.38)",
                    lineHeight: 1.6,
                    marginBottom: 12
                  }}
                >
                  Compartilhe acesso ao workspace como editor.
                </p>
                <button
                  onClick={createInvite}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 7,
                    fontSize: 13,
                    fontWeight: 700,
                    color: "#000",
                    background: G,
                    border: "none",
                    borderRadius: 8,
                    padding: "10px 14px",
                    cursor: "pointer",
                    width: "100%",
                    justifyContent: "center"
                  }}
                >
                  <Users size={14} /> Gerar link de convite
                </button>
                {inviteLink && (
                  <div
                    style={{
                      marginTop: 10,
                      background: "rgba(184,245,90,0.07)",
                      border: "1px solid rgba(184,245,90,0.18)",
                      borderRadius: 8,
                      padding: "10px 12px",
                      fontSize: 11.5,
                      color: G,
                      wordBreak: "break-all",
                      lineHeight: 1.5
                    }}
                  >
                    {inviteLink}
                    <button
                      onClick={() => navigator.clipboard.writeText(inviteLink)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 5,
                        fontSize: 11,
                        fontWeight: 600,
                        color: G,
                        background: "transparent",
                        border: "none",
                        cursor: "pointer",
                        padding: 0,
                        marginTop: 6
                      }}
                    >
                      <Copy size={11} /> Copiar link
                    </button>
                  </div>
                )}
              </WsCard>
            )}
          </aside>
        </div>
      </div>

      {/* Add manual modal */}
      {addOpen && (
        <AddTransactionModal
          user={user}
          profile={profile}
          workspaceId={workspace.id}
          monthKey={monthKey}
          onClose={() => setAddOpen(false)}
          onCreated={async () => {
            await markReal();
            setAddOpen(false);
          }}
        />
      )}

      {/* Import preview modal */}
      {importState && (
        <ImportModal
          state={importState}
          onCancel={() => setImportState(null)}
          onConfirm={confirmImport}
          onToggle={(id) =>
            importState.phase === "preview" &&
            setImportState({
              ...importState,
              rows: importState.rows.map((r) =>
                r._id === id ? { ...r, selected: !r.selected } : r
              )
            })
          }
          onCategoryChange={(id, cat) =>
            importState.phase === "preview" &&
            setImportState({
              ...importState,
              rows: importState.rows.map((r) =>
                r._id === id ? { ...r, category: cat } : r
              )
            })
          }
        />
      )}

      {/* Settings drawer */}
      {settingsOpen && (
        <SettingsModal
          workspace={workspace}
          member={member}
          isOwner={isOwner}
          onClose={() => setSettingsOpen(false)}
          onDelete={deleteWorkspace}
          onLeave={async () => {
            await updateDoc(
              doc(db, "workspaces", workspace.id, "members", user.uid),
              { status: "left", leftAt: serverTimestamp() }
            );
          }}
        />
      )}
    </div>
  );
}

// ─── Balance header ──────────────────────────────────────────────────────────

function BalanceHeader({
  summary,
  showDemo,
  monthKey
}: {
  summary: ReturnType<typeof buildMonthlySummary>;
  showDemo: boolean;
  monthKey: string;
}) {
  const isPositive = summary.balance >= 0;
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.025)",
        border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: 16,
        padding: "28px 32px",
        animation: "fadeUp .45s ease both"
      }}
    >
      <p style={{ fontSize: 12, color: "rgba(255,255,255,0.36)", fontWeight: 600, marginBottom: 8, letterSpacing: "0.06em", textTransform: "uppercase" }}>
        {showDemo ? "Demo — Abril 2026" : monthLabel(monthKey)}
      </p>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 32, flexWrap: "wrap" }}>
        <div>
          <p style={{ fontSize: 11, color: "rgba(255,255,255,0.32)", marginBottom: 4 }}>Saldo do mês</p>
          <p
            style={{
              fontSize: "clamp(36px,5vw,56px)",
              fontWeight: 900,
              letterSpacing: "-0.04em",
              color: isPositive ? G : "#ff8080",
              lineHeight: 1
            }}
          >
            {formatCurrency(summary.balance)}
          </p>
        </div>
        <div style={{ display: "flex", gap: 28, paddingBottom: 4 }}>
          <div>
            <p style={{ fontSize: 11, color: "rgba(255,255,255,0.32)", marginBottom: 4 }}>Entradas</p>
            <p style={{ fontSize: 20, fontWeight: 800, color: G, letterSpacing: "-0.03em" }}>
              +{formatCurrency(summary.income)}
            </p>
          </div>
          <div>
            <p style={{ fontSize: 11, color: "rgba(255,255,255,0.32)", marginBottom: 4 }}>Saídas</p>
            <p style={{ fontSize: 20, fontWeight: 800, color: "#ff8080", letterSpacing: "-0.03em" }}>
              -{formatCurrency(summary.expense)}
            </p>
          </div>
          {summary.savingsRate > 0 && (
            <div>
              <p style={{ fontSize: 11, color: "rgba(255,255,255,0.32)", marginBottom: 4 }}>Economia</p>
              <p style={{ fontSize: 20, fontWeight: 800, color: "rgba(255,255,255,0.7)", letterSpacing: "-0.03em" }}>
                {summary.savingsRate.toFixed(0)}%
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Upload zone ─────────────────────────────────────────────────────────────

function UploadZone({
  onFiles,
  onAddManual
}: {
  onFiles: (files: File[]) => void;
  onAddManual: () => void;
}) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const accept = ".pdf,.csv,.ofx,.qfx,image/*";

  const onDragOver = (e: DragEvent) => {
    e.preventDefault();
    setDragging(true);
  };
  const onDragLeave = () => setDragging(false);
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length) onFiles(files);
  };
  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length) onFiles(files);
    e.target.value = "";
  };

  return (
    <div>
      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        style={{
          border: `1.5px dashed ${dragging ? G : "rgba(255,255,255,0.14)"}`,
          borderRadius: 14,
          padding: "28px 24px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
          cursor: "pointer",
          background: dragging
            ? "rgba(184,245,90,0.05)"
            : "rgba(255,255,255,0.018)",
          transition: "all .2s"
        }}
      >
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: "50%",
            background: dragging ? "rgba(184,245,90,0.15)" : "rgba(255,255,255,0.06)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "all .2s"
          }}
        >
          <Upload size={18} color={dragging ? G : "rgba(255,255,255,0.5)"} />
        </div>
        <div style={{ textAlign: "center" }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: "#fff", marginBottom: 4 }}>
            {dragging ? "Solte os arquivos aqui" : "Importar extrato"}
          </p>
          <p style={{ fontSize: 12, color: "rgba(255,255,255,0.36)" }}>
            Arraste ou clique para selecionar
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
          {[
            { icon: <FileText size={13} />, label: "PDF" },
            { icon: <FileText size={13} />, label: "CSV" },
            { icon: <FileText size={13} />, label: "OFX" },
            { icon: <ImageIcon size={13} />, label: "Imagem" }
          ].map(({ icon, label }) => (
            <span
              key={label}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                fontSize: 11,
                fontWeight: 600,
                color: "rgba(255,255,255,0.38)",
                background: "rgba(255,255,255,0.06)",
                borderRadius: 6,
                padding: "3px 8px"
              }}
            >
              {icon} {label}
            </span>
          ))}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple
          style={{ display: "none" }}
          onChange={onPick}
        />
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onAddManual();
        }}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          fontSize: 12,
          fontWeight: 600,
          color: "rgba(255,255,255,0.36)",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          padding: "8px 0 0",
          transition: "color .18s"
        }}
        onMouseEnter={(e) => (e.currentTarget.style.color = G)}
        onMouseLeave={(e) =>
          (e.currentTarget.style.color = "rgba(255,255,255,0.36)")
        }
      >
        <Plus size={13} /> Adicionar manualmente
      </button>
    </div>
  );
}

// ─── Transaction row ──────────────────────────────────────────────────────────

function TxRow({
  tx,
  readonly,
  onDelete
}: {
  tx: Transaction;
  readonly: boolean;
  onDelete: () => void;
}) {
  const [hov, setHov] = useState(false);
  const isIncome = tx.type === "income";
  const parts = tx.date.split("-");
  const dateLabel = parts.length === 3 ? `${parts[2]}/${parts[1]}` : tx.date;

  return (
    <div
      className="ws-tx-row"
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: "grid",
        gridTemplateColumns: "8px 1fr auto auto",
        gap: "0 14px",
        alignItems: "center",
        padding: "10px 12px",
        borderRadius: 10,
        transition: "background .15s"
      }}
    >
      <div
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: categoryColor(tx.category),
          boxShadow: `0 0 8px ${categoryColor(tx.category)}66`,
          flexShrink: 0
        }}
      />
      <div style={{ minWidth: 0 }}>
        <p
          style={{
            fontSize: 13.5,
            fontWeight: 600,
            color: "#e8e9ec",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis"
          }}
        >
          {tx.description}
        </p>
        <p style={{ fontSize: 11.5, color: "rgba(255,255,255,0.32)", marginTop: 1 }}>
          {tx.category} · {dateLabel}
        </p>
      </div>
      <span
        style={{
          fontSize: 14,
          fontWeight: 800,
          letterSpacing: "-0.02em",
          color: isIncome ? G : "#ff8080",
          whiteSpace: "nowrap"
        }}
      >
        {isIncome ? "+" : "-"}
        {formatCurrency(tx.amount)}
      </span>
      {!readonly && (
        <button
          onClick={onDelete}
          style={{
            opacity: hov ? 1 : 0,
            background: "transparent",
            border: "none",
            cursor: "pointer",
            color: "rgba(255,80,80,0.65)",
            padding: 4,
            borderRadius: 6,
            display: "flex",
            alignItems: "center",
            transition: "opacity .15s"
          }}
        >
          <Trash2 size={14} />
        </button>
      )}
    </div>
  );
}

// ─── Import modal ─────────────────────────────────────────────────────────────

function ImportModal({
  state,
  onCancel,
  onConfirm,
  onToggle,
  onCategoryChange
}: {
  state: ImportState;
  onCancel: () => void;
  onConfirm: (rows: ParsedWithMeta[]) => void;
  onToggle: (id: string) => void;
  onCategoryChange: (id: string, cat: string) => void;
}) {
  const isParsing = state.phase === "parsing";
  const isSaving = state.phase === "saving";
  const rows = state.phase !== "parsing" ? state.rows : [];
  const selectedCount = rows.filter((r) => r.selected).length;
  const error = state.phase === "preview" ? state.error : undefined;

  const categoriesFor = (type: "income" | "expense") =>
    type === "income"
      ? CATEGORIES.filter((c) => true)
      : CATEGORIES.filter((c) => c !== "Recebimentos");

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.72)",
        backdropFilter: "blur(8px)",
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24
      }}
      onClick={(e) => e.target === e.currentTarget && !isSaving && onCancel()}
    >
      <div
        style={{
          background: "#0e0f11",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 18,
          width: "100%",
          maxWidth: 680,
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          boxShadow: "0 40px 100px rgba(0,0,0,0.6)"
        }}
      >
        {/* Modal header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "20px 24px",
            borderBottom: "1px solid rgba(255,255,255,0.07)"
          }}
        >
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "#fff" }}>
              {isParsing
                ? "Lendo arquivo..."
                : isSaving
                ? "Salvando..."
                : "Revisar importação"}
            </h2>
            {!isParsing && !isSaving && (
              <p style={{ fontSize: 12, color: "rgba(255,255,255,0.38)", marginTop: 3 }}>
                {selectedCount} de {rows.length} transações selecionadas
              </p>
            )}
          </div>
          {!isSaving && (
            <button
              onClick={onCancel}
              style={{
                background: "rgba(255,255,255,0.07)",
                border: "none",
                borderRadius: 8,
                color: "rgba(255,255,255,0.55)",
                cursor: "pointer",
                padding: "6px 8px",
                display: "flex"
              }}
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Modal body */}
        <div style={{ flex: 1, overflow: "auto", padding: "16px 24px" }}>
          {isParsing || isSaving ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 14,
                padding: "48px 0"
              }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  border: "3px solid rgba(184,245,90,0.2)",
                  borderTopColor: G,
                  borderRadius: "50%",
                  animation: "spin .8s linear infinite"
                }}
              />
              <p style={{ fontSize: 13, color: "rgba(255,255,255,0.45)" }}>
                {isParsing
                  ? "Extraindo transações com IA..."
                  : "Salvando lançamentos..."}
              </p>
            </div>
          ) : (
            <>
              {error && (
                <div
                  style={{
                    background: "rgba(255,80,80,0.1)",
                    border: "1px solid rgba(255,80,80,0.25)",
                    borderRadius: 8,
                    padding: "10px 14px",
                    fontSize: 12.5,
                    color: "#ff8080",
                    marginBottom: 14
                  }}
                >
                  {error}
                </div>
              )}
              {rows.length === 0 ? (
                <p
                  style={{
                    textAlign: "center",
                    padding: "40px 0",
                    color: "rgba(255,255,255,0.28)",
                    fontSize: 13
                  }}
                >
                  Nenhuma transação encontrada no arquivo.
                </p>
              ) : (
                <div style={{ display: "grid", gap: 6 }}>
                  {/* Header */}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "28px 1fr 140px 110px",
                      gap: 10,
                      padding: "4px 8px",
                      fontSize: 10.5,
                      fontWeight: 700,
                      color: "rgba(255,255,255,0.28)",
                      textTransform: "uppercase",
                      letterSpacing: "0.06em"
                    }}
                  >
                    <span />
                    <span>Descrição</span>
                    <span>Categoria</span>
                    <span style={{ textAlign: "right" }}>Valor</span>
                  </div>
                  {rows.map((row) => (
                    <div
                      key={row._id}
                      onClick={() => onToggle(row._id)}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "28px 1fr 140px 110px",
                        gap: 10,
                        alignItems: "center",
                        padding: "10px 8px",
                        borderRadius: 10,
                        background: row.selected
                          ? "rgba(255,255,255,0.04)"
                          : "transparent",
                        opacity: row.selected ? 1 : 0.38,
                        cursor: "pointer",
                        transition: "all .15s",
                        border: `1px solid ${row.selected ? "rgba(255,255,255,0.07)" : "transparent"}`
                      }}
                    >
                      <div
                        style={{
                          width: 18,
                          height: 18,
                          borderRadius: 5,
                          border: `1.5px solid ${row.selected ? G : "rgba(255,255,255,0.22)"}`,
                          background: row.selected ? G : "transparent",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                          transition: "all .15s"
                        }}
                      >
                        {row.selected && <Check size={11} color="#000" strokeWidth={3} />}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <p
                          style={{
                            fontSize: 13,
                            fontWeight: 600,
                            color: "#e8e9ec",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis"
                          }}
                        >
                          {row.description}
                        </p>
                        <p style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 2 }}>
                          {row.date}
                        </p>
                      </div>
                      <select
                        value={row.category}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => {
                          e.stopPropagation();
                          onCategoryChange(row._id, e.target.value);
                        }}
                        style={{
                          fontSize: 12,
                          background: `${categoryColor(row.category)}18`,
                          border: `1px solid ${categoryColor(row.category)}44`,
                          borderRadius: 6,
                          color: categoryColor(row.category),
                          padding: "4px 8px",
                          cursor: "pointer",
                          fontWeight: 600
                        }}
                      >
                        {categoriesFor(row.type).map((c) => (
                          <option key={c} value={c} style={{ background: "#111", color: "#fff" }}>
                            {c}
                          </option>
                        ))}
                      </select>
                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: 800,
                          color: row.type === "income" ? G : "#ff8080",
                          textAlign: "right",
                          letterSpacing: "-0.02em"
                        }}
                      >
                        {row.type === "income" ? "+" : "-"}
                        {formatCurrency(row.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal footer */}
        {!isParsing && !isSaving && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              gap: 10,
              padding: "16px 24px",
              borderTop: "1px solid rgba(255,255,255,0.07)"
            }}
          >
            <button
              onClick={onCancel}
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: "rgba(255,255,255,0.45)",
                background: "transparent",
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 8,
                padding: "10px 18px",
                cursor: "pointer"
              }}
            >
              Cancelar
            </button>
            <button
              onClick={() => onConfirm(rows)}
              disabled={selectedCount === 0}
              style={{
                fontSize: 13,
                fontWeight: 800,
                color: "#000",
                background: selectedCount === 0 ? "rgba(184,245,90,0.35)" : G,
                border: "none",
                borderRadius: 8,
                padding: "10px 22px",
                cursor: selectedCount === 0 ? "not-allowed" : "pointer",
                transition: "all .18s"
              }}
            >
              Importar {selectedCount} lançamento{selectedCount !== 1 ? "s" : ""}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Add transaction modal ────────────────────────────────────────────────────

function AddTransactionModal({
  user,
  profile,
  workspaceId,
  monthKey,
  onClose,
  onCreated
}: {
  user: User;
  profile: Profile;
  workspaceId: string;
  monthKey: string;
  onClose: () => void;
  onCreated: () => Promise<void>;
}) {
  const [type, setType] = useState<TransactionType>("expense");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("Alimentacao");
  const [date, setDate] = useState(`${monthKey}-01`);
  const [busy, setBusy] = useState(false);
  const expenseCategories = CATEGORIES.filter((c) => c !== "Recebimentos" && c !== "Outros");
  const categories = type === "income" ? ["Recebimentos"] : [...expenseCategories, "Outros"];

  async function submit(e: FormEvent) {
    e.preventDefault();
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
      await onCreated();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.72)",
        backdropFilter: "blur(8px)",
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          background: "#0e0f11",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 18,
          width: "100%",
          maxWidth: 440,
          boxShadow: "0 40px 100px rgba(0,0,0,0.6)"
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "20px 24px",
            borderBottom: "1px solid rgba(255,255,255,0.07)"
          }}
        >
          <h2 style={{ fontSize: 16, fontWeight: 700 }}>Adicionar lançamento</h2>
          <button
            onClick={onClose}
            style={{
              background: "rgba(255,255,255,0.07)",
              border: "none",
              borderRadius: 8,
              color: "rgba(255,255,255,0.55)",
              cursor: "pointer",
              padding: "6px 8px",
              display: "flex"
            }}
          >
            <X size={16} />
          </button>
        </div>
        <form onSubmit={submit} style={{ padding: 24, display: "grid", gap: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <select
              value={type}
              onChange={(e) => {
                const t = e.target.value as TransactionType;
                setType(t);
                setCategory(t === "income" ? "Recebimentos" : "Alimentacao");
              }}
              style={inputStyle}
            >
              <option value="expense">Saída</option>
              <option value="income">Entrada</option>
            </select>
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="Valor (R$)"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              style={inputStyle}
            />
          </div>
          <input
            placeholder="Descrição"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            style={inputStyle}
          />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              style={inputStyle}
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              style={inputStyle}
            />
          </div>
          <button
            type="submit"
            disabled={busy}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 7,
              fontWeight: 800,
              fontSize: 14,
              color: "#000",
              background: G,
              border: "none",
              borderRadius: 10,
              padding: "13px 0",
              cursor: busy ? "not-allowed" : "pointer",
              opacity: busy ? 0.7 : 1,
              transition: "all .18s"
            }}
          >
            {busy ? (
              <div
                style={{
                  width: 16,
                  height: 16,
                  border: "2.5px solid rgba(0,0,0,0.3)",
                  borderTopColor: "#000",
                  borderRadius: "50%",
                  animation: "spin .7s linear infinite"
                }}
              />
            ) : (
              <>
                <Plus size={16} /> Adicionar
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Settings modal ───────────────────────────────────────────────────────────

function SettingsModal({
  workspace,
  member,
  isOwner,
  onClose,
  onDelete,
  onLeave
}: {
  workspace: Workspace;
  member: Member;
  isOwner: boolean;
  onClose: () => void;
  onDelete: () => Promise<void>;
  onLeave: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.72)",
        backdropFilter: "blur(8px)",
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          background: "#0e0f11",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 18,
          width: "100%",
          maxWidth: 400,
          boxShadow: "0 40px 100px rgba(0,0,0,0.6)"
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "20px 24px",
            borderBottom: "1px solid rgba(255,255,255,0.07)"
          }}
        >
          <h2 style={{ fontSize: 16, fontWeight: 700 }}>Configurações do workspace</h2>
          <button
            onClick={onClose}
            style={{
              background: "rgba(255,255,255,0.07)",
              border: "none",
              borderRadius: 8,
              color: "rgba(255,255,255,0.55)",
              cursor: "pointer",
              padding: "6px 8px",
              display: "flex"
            }}
          >
            <X size={16} />
          </button>
        </div>
        <div style={{ padding: "20px 24px", display: "grid", gap: 20 }}>
          <div>
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.38)", marginBottom: 4 }}>
              Workspace
            </p>
            <p style={{ fontSize: 15, fontWeight: 700 }}>{workspace.name}</p>
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.38)", marginTop: 2 }}>
              Seu papel: {member.role === "owner" ? "Owner" : "Editor"}
            </p>
          </div>
          <div
            style={{
              borderTop: "1px solid rgba(255,255,255,0.07)",
              paddingTop: 20,
              display: "grid",
              gap: 10
            }}
          >
            {isOwner ? (
              <button
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  await onDelete();
                  setBusy(false);
                  onClose();
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 7,
                  fontWeight: 700,
                  fontSize: 13,
                  color: "#fff",
                  background: "rgba(255,80,80,0.15)",
                  border: "1px solid rgba(255,80,80,0.25)",
                  borderRadius: 8,
                  padding: "11px 0",
                  cursor: "pointer"
                }}
              >
                <Trash2 size={14} /> Excluir workspace
              </button>
            ) : (
              <button
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  await onLeave();
                  setBusy(false);
                  onClose();
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 7,
                  fontWeight: 700,
                  fontSize: 13,
                  color: "rgba(255,255,255,0.65)",
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: 8,
                  padding: "11px 0",
                  cursor: "pointer"
                }}
              >
                Sair do workspace
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Shared UI helpers ───────────────────────────────────────────────────────

const inputStyle: CSSProperties = {
  width: "100%",
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 8,
  color: "#fff",
  fontSize: 13,
  padding: "11px 13px"
};

function WsCard({
  children,
  style = {}
}: {
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.025)",
        border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: 14,
        padding: "20px 22px",
        ...style
      }}
    >
      {children}
    </div>
  );
}

function IconBtn({
  icon,
  label,
  onClick
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className="ws-icon-btn"
      onClick={onClick}
      title={label}
      style={{
        width: 34,
        height: 34,
        borderRadius: 8,
        background: "transparent",
        border: "1px solid rgba(255,255,255,0.1)",
        color: "rgba(255,255,255,0.5)",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transition: "all .18s"
      }}
    >
      {icon}
    </button>
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

async function ensureDefaultWorkspace(user: User, displayName: string): Promise<string> {
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

  await updateDoc(doc(db, "users", user.uid), {
    workspaceIds: [workspaceRef.id],
    updatedAt: serverTimestamp()
  });

  return workspaceRef.id;
}

function errorMessage(err: unknown) {
  if (err instanceof Error) return err.message;
  return "Algo saiu do eixo. Tente de novo.";
}
