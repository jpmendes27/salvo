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
  ArrowRight,
  Eye,
  EyeOff,
  RefreshCw,
  Users
} from "lucide-react";
import { CSSProperties, FormEvent, ReactNode, useEffect, useRef, useState } from "react";
import { auth, googleProvider } from "@/lib/firebase";

const G = "#b8f55a";
const G_10 = "rgba(184,245,90,0.10)";
const G_20 = "rgba(184,245,90,0.18)";
const G_30 = "rgba(184,245,90,0.28)";
const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";

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
              onMouseEnter={(event) => { event.currentTarget.style.color = "rgba(255,255,255,0.82)"; }}
              onMouseLeave={(event) => { event.currentTarget.style.color = "rgba(255,255,255,0.36)"; }}
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
              onMouseEnter={(event) => { event.currentTarget.style.opacity = ".91"; event.currentTarget.style.transform = "scale(1.01)"; }}
              onMouseLeave={(event) => { event.currentTarget.style.opacity = "1"; event.currentTarget.style.transform = "scale(1)"; }}
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
              <div style={{ background: `${G_10}`, border: `1px solid ${G_20}`, borderRadius: 10, padding: "10px 14px", marginBottom: 14, fontSize: 13, color: G, lineHeight: 1.5 }}>
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
                onMouseEnter={(event) => { event.currentTarget.style.transform = "scale(1.02)"; event.currentTarget.style.boxShadow = `0 0 52px ${G_30},0 4px 20px rgba(0,0,0,0.5)`; }}
                onMouseLeave={(event) => { event.currentTarget.style.transform = "scale(1)"; event.currentTarget.style.boxShadow = `0 0 36px ${G_20},0 4px 20px rgba(0,0,0,0.4)`; }}
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
                onMouseEnter={(event) => { event.currentTarget.style.color = "rgba(255,255,255,0.72)"; }}
                onMouseLeave={(event) => { event.currentTarget.style.color = "rgba(255,255,255,0.33)"; }}
              >
                {mode === "signup" ? "Já tenho conta" : "Criar conta"}
              </button>
              <button
                type="button"
                onClick={handleReset}
                style={{ background: "none", border: "none", color: "rgba(255,255,255,0.33)", fontSize: 12.5, cursor: "pointer", padding: 0, letterSpacing: "-0.01em", transition: "color .2s" }}
                onMouseEnter={(event) => { event.currentTarget.style.color = "rgba(255,255,255,0.72)"; }}
                onMouseLeave={(event) => { event.currentTarget.style.color = "rgba(255,255,255,0.33)"; }}
              >
                Recuperar acesso
              </button>
            </div>

            <p style={{ fontSize: 11, color: "rgba(255,255,255,0.38)", lineHeight: 1.6, textAlign: "center" }}>
              Ao entrar, você aceita os{" "}
              <a href={`${BASE}/termos`} style={{ color: "rgba(255,255,255,0.60)", textDecoration: "underline", textUnderlineOffset: 2, cursor: "pointer" }}>
                Termos de Uso
              </a>{" "}
              e a{" "}
              <a href={`${BASE}/privacidade`} style={{ color: "rgba(255,255,255,0.60)", textDecoration: "underline", textUnderlineOffset: 2, cursor: "pointer" }}>
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

function VerifyEmail({ user }: { user: User }) {
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function refresh() {
    setError("");
    try {
      await reload(user);
      if (auth.currentUser?.emailVerified) {
        await auth.currentUser.getIdToken(true);
        window.location.replace(`${BASE}/home`);
      } else {
        setMessage("Ainda não confirmamos seu e-mail. Confira sua caixa de entrada.");
      }
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function resend() {
    setError("");
    try {
      await sendEmailVerification(user);
      setMessage("Reenviamos a verificação.");
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "#050505", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <div style={{ maxWidth: 420, width: "100%", padding: "0 24px" }}>
        <div style={{ marginBottom: 28 }}><Logo /></div>
        <h1 style={{ fontSize: "1.4rem", fontWeight: 800, color: "#fff", marginBottom: 10, letterSpacing: "-0.025em" }}>Confirme seu e-mail</h1>
        <p style={{ color: "rgba(255,255,255,0.45)", fontSize: "0.9rem", lineHeight: 1.6, marginBottom: 24 }}>
          Enviamos uma verificação para <strong style={{ color: "rgba(255,255,255,0.7)" }}>{user.email}</strong>. Depois disso você acessa seu painel.
        </p>
        {message && <div style={{ background: "rgba(184,245,90,0.08)", border: `1px solid ${G_20}`, borderRadius: 10, padding: "10px 14px", marginBottom: 14, fontSize: 13, color: G }}>{message}</div>}
        {error && <div style={{ background: "rgba(255,80,80,0.10)", border: "1px solid rgba(255,80,80,0.22)", borderRadius: 10, padding: "10px 14px", marginBottom: 14, fontSize: 13, color: "#ff8080" }}>{error}</div>}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <button onClick={refresh} style={{ padding: "13px", borderRadius: 12, background: G, color: "#000", border: "none", cursor: "pointer", fontSize: "0.9rem", fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <RefreshCw size={16} /> Já confirmei
          </button>
          <button onClick={resend} style={{ padding: "13px", borderRadius: 12, background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.6)", border: "1px solid rgba(255,255,255,0.08)", cursor: "pointer", fontSize: "0.9rem", fontWeight: 600 }}>
            Reenviar e-mail
          </button>
          <button onClick={() => signOut(auth)} style={{ padding: "10px", borderRadius: 12, background: "transparent", color: "rgba(255,255,255,0.25)", border: "none", cursor: "pointer", fontSize: "0.85rem" }}>
            Sair
          </button>
        </div>
      </div>
    </div>
  );
}

function FincheckLoader() {
  const RINGS = [160, 118, 82, 48] as const;
  return (
    <div style={{ minHeight: "100vh", background: "#050505", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ position: "relative", width: 180, height: 180 }}>
        {RINGS.map((size, i) => (
          <div
            key={i}
            style={{
              position: "absolute", top: "50%", left: "50%",
              width: size, height: size, borderRadius: "50%",
              transform: "translate(-50%, -50%)",
              border: `${i === 3 ? 2 : 1}px solid rgba(184,245,90,${(0.85 - i * 0.19).toFixed(2)})`,
              boxShadow: `0 0 ${28 - i * 6}px rgba(184,245,90,${(0.22 - i * 0.045).toFixed(3)}), inset 0 0 ${16 - i * 3}px rgba(184,245,90,${(0.06 - i * 0.012).toFixed(3)})`,
              animation: "neonPulse 3s ease-in-out infinite",
              animationDelay: `${i * 0.28}s`
            }}
          />
        ))}
        <div style={{
          position: "absolute", top: "50%", left: "50%",
          width: 14, height: 14, borderRadius: "50%",
          background: G,
          transform: "translate(-50%, -50%)",
          animation: "neonCenterPulse 3s ease-in-out infinite"
        }} />
      </div>
      <style>{`
        @keyframes neonPulse { 0%,100%{opacity:.7;transform:translate(-50%,-50%) scale(1)} 50%{opacity:1;transform:translate(-50%,-50%) scale(1.03)} }
        @keyframes neonCenterPulse { 0%,100%{opacity:.8;transform:translate(-50%,-50%) scale(1)} 50%{opacity:1;transform:translate(-50%,-50%) scale(1.4)} }
      `}</style>
    </div>
  );
}

function errorMessage(err: unknown) {
  if (err instanceof Error) return err.message;
  return "Algo saiu do eixo. Tente de novo.";
}

export default function LoginPage() {
  const [user, setUser] = useState<User | null | undefined>(undefined);

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u?.emailVerified) {
        window.location.replace(`${BASE}/home`);
      }
    });
  }, []);

  if (user === undefined) return <FincheckLoader />;
  if (!user) return <AuthScreen />;
  if (!user.emailVerified) return <VerifyEmail user={user} />;
  return <FincheckLoader />;
}
