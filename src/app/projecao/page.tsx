"use client";

import { collection, doc, getDoc, onSnapshot, query, updateDoc, where } from "firebase/firestore";
import { ArrowLeft, Target } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Area, ComposedChart, Line, ReferenceDot, ResponsiveContainer, XAxis, Tooltip
} from "recharts";
import { useAuthUser } from "@/app/auth-provider";
import { db } from "@/lib/firebase";
import { formatCurrency } from "@/lib/money";
import type { RecurringItem, Transaction } from "@/lib/types";

const G = "#b8f55a";
const RED = "#ff5c5c";
const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";
const MONTH_SHORT = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

const SUGGEST_GOAL_URL =
  process.env.NEXT_PUBLIC_SUGGEST_GOAL_URL ||
  "https://us-central1-fincheck-pro.cloudfunctions.net/suggestGoal";

function Shell({ text }: { text: string }) {
  return (
    <div style={{ minHeight: "100vh", background: "#050505", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.4)", fontSize: 14 }}>
      {text}
    </div>
  );
}

export default function ProjecaoPage() {
  const { user, authLoading } = useAuthUser();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !user) router.replace("/");
  }, [authLoading, user, router]);

  if (authLoading) return <Shell text="Carregando..." />;
  if (!user) return null;

  const workspaceId = typeof window !== "undefined" ? localStorage.getItem("fincheck_workspace") ?? "" : "";
  if (!workspaceId) { router.replace("/"); return null; }

  return <ProjectionView workspaceId={workspaceId} userId={user.uid} />;
}

type MonthRow = {
  monthKey: string;
  label: string;
  shortLabel: string;
  isPast: boolean;
  isCurrent: boolean;
  isFuture: boolean;
  income: number;
  expense: number;
  balance: number;
  accumulated: number;
  hasData: boolean;
};

type GoalSuggestion = {
  titulo: string;
  descricao: string;
  valorMeta: number;
  prazoMeses: number;
  valorMensal: number;
  mensagem: string;
};

// ─── Tour overlay components ─────────────────────────────────────────────────

function TourStep1({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 140,
      background: "rgba(0,0,0,0.72)",
      pointerEvents: "none"
    }}>
      <div style={{
        position: "absolute", bottom: 100, left: "50%",
        transform: "translateX(-50%)",
        background: "#1c1c1c",
        border: `1px solid ${G}`,
        borderRadius: 16,
        padding: "22px 24px",
        width: "min(360px, calc(100vw - 32px))",
        pointerEvents: "auto",
        boxShadow: `0 0 48px rgba(184,245,90,0.18)`
      }}>
        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: G, margin: "0 0 8px" }}>
          COMO FUNCIONA
        </p>
        <p style={{ fontSize: 16, fontWeight: 800, letterSpacing: "-0.02em", margin: "0 0 6px" }}>
          Arraste pra simular um corte
        </p>
        <p style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", lineHeight: 1.6, margin: "0 0 18px" }}>
          Mova o slider pra ver quanto você teria a mais no bolso até dezembro.
        </p>
        <button
          onClick={onDismiss}
          style={{ padding: "10px 20px", background: G, color: "#111", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "var(--font-ui)" }}
        >
          Entendi
        </button>
      </div>
    </div>
  );
}

function TourStep2({ onDismiss }: { onDismiss: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 3000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 140,
      background: "rgba(0,0,0,0.6)",
      pointerEvents: "none"
    }}>
      <div style={{
        position: "absolute", bottom: 80, left: "50%",
        transform: "translateX(-50%)",
        background: "#1c1c1c",
        border: `1px solid ${G}`,
        borderRadius: 14,
        padding: "16px 20px",
        width: "min(320px, calc(100vw - 32px))",
        pointerEvents: "auto",
        boxShadow: `0 0 40px rgba(184,245,90,0.16)`
      }}>
        <p style={{ fontSize: 14, fontWeight: 700, margin: "0 0 4px", letterSpacing: "-0.01em" }}>
          Essa é sua meta sugerida.
        </p>
        <p style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", lineHeight: 1.5, margin: "0 0 12px" }}>
          Clique pra criar e começar a acompanhar.
        </p>
        <button onClick={onDismiss} style={{ padding: "8px 16px", background: G, color: "#111", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "var(--font-ui)" }}>
          Ok, entendi →
        </button>
      </div>
    </div>
  );
}

// ─── Dots loading animation ───────────────────────────────────────────────────

function DotsLoader() {
  return (
    <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
      {[0, 1, 2].map(i => (
        <span key={i} style={{
          width: 7, height: 7, borderRadius: "50%", background: G, display: "inline-block",
          animation: `dotPulse 1.4s ease-in-out ${i * 0.16}s infinite`
        }} />
      ))}
    </div>
  );
}

// ─── Slider input ─────────────────────────────────────────────────────────────

function SliderInput({ value, max, onChange }: { value: number; max: number; onChange: (v: number) => void }) {
  const filledPct = max > 0 ? (value / max) * 100 : 100;
  const step = Math.max(1, Math.round(max / 200));

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
        <span style={{ fontSize: 10, color: "rgba(255,255,255,0.35)" }}>R$0</span>
        <span style={{ fontSize: 10, color: "rgba(255,255,255,0.35)" }}>{formatCurrency(max)} atual</span>
      </div>
      <div style={{ position: "relative", height: 36, display: "flex", alignItems: "center" }}>
        <div style={{ position: "absolute", left: 0, right: 0, height: 6, borderRadius: 999, background: "rgba(255,255,255,0.08)", pointerEvents: "none" }}>
          <div style={{ position: "absolute", left: 0, width: `${filledPct}%`, height: "100%", borderRadius: 999, background: G }} />
        </div>
        <input
          type="range"
          min={0}
          max={max}
          step={step}
          value={value}
          onChange={e => onChange(Number(e.target.value))}
          className="proj-slider"
          style={{
            position: "relative", zIndex: 1,
            width: "100%",
            appearance: "none", WebkitAppearance: "none",
            background: "transparent", cursor: "pointer", height: 36,
            margin: 0
          }}
        />
      </div>
      <div style={{ textAlign: "center", marginTop: 10 }}>
        <span style={{ fontSize: 22, color: "#fff", letterSpacing: "-0.01em" }}>
          {formatCurrency(value)}
        </span>
        <span style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", marginLeft: 8 }}>
          mantendo nessa categoria
        </span>
      </div>
    </div>
  );
}

// ─── Goal card ────────────────────────────────────────────────────────────────

function GoalCard({ goal, router }: { goal: GoalSuggestion; router: ReturnType<typeof useRouter> }) {
  const titulo = goal.titulo.toLowerCase();
  const tipo = titulo.includes("reserva") ? "reserva"
    : titulo.includes("viagem") ? "viagem"
    : titulo.includes("dívida") || titulo.includes("divida") ? "divida"
    : titulo.includes("invest") ? "investimento"
    : "outro";

  const href = `${BASE}/metas?tipo=${tipo}&valor=${goal.valorMeta}&mensal=${goal.valorMensal}&prazo=${goal.prazoMeses}`;

  return (
    <div style={{
      background: "#111111",
      border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: 12,
      padding: "20px 24px",
      animation: "goalFadeIn 0.35s ease"
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 16, marginBottom: 18 }}>
        <div style={{
          width: 48, height: 48, borderRadius: 12,
          background: "rgba(184,245,90,0.10)",
          border: "1px solid rgba(184,245,90,0.20)",
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0
        }}>
          <Target size={22} color={G} />
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 17, fontWeight: 700, letterSpacing: "-0.02em", margin: "0 0 6px" }}>
            {goal.titulo}
          </p>
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", lineHeight: 1.55, margin: 0 }}>
            {goal.descricao}
          </p>
        </div>
      </div>

      <p style={{
        fontStyle: "italic",
        fontSize: 16,
        color: G,
        lineHeight: 1.6,
        margin: "0 0 20px",
        padding: "12px 16px",
        borderLeft: `2px solid ${G}`,
        background: "rgba(184,245,90,0.03)"
      }}>
        "{goal.mensagem}"
      </p>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
          <div>
            <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)", margin: "0 0 4px" }}>Por mês</p>
            <p style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.02em", color: G, margin: 0 }}>
              {formatCurrency(goal.valorMensal)}
            </p>
          </div>
          <div>
            <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)", margin: "0 0 4px" }}>Meta total</p>
            <p style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.02em", color: "#fff", margin: 0 }}>
              {formatCurrency(goal.valorMeta)}
            </p>
          </div>
          <div>
            <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)", margin: "0 0 4px" }}>Prazo</p>
            <p style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.02em", color: "#fff", margin: 0 }}>
              {goal.prazoMeses} meses
            </p>
          </div>
        </div>
        <button
          onClick={() => router.push(href)}
          style={{
            padding: "12px 22px",
            background: G, color: "#111",
            border: "none", borderRadius: 10,
            fontSize: 14, fontWeight: 700,
            cursor: "pointer", fontFamily: "var(--font-ui)",
            letterSpacing: "-0.01em", whiteSpace: "nowrap"
          }}
        >
          Criar essa meta →
        </button>
      </div>
    </div>
  );
}

// ─── Main view ────────────────────────────────────────────────────────────────

function ProjectionView({ workspaceId, userId }: { workspaceId: string; userId: string }) {
  const router = useRouter();
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonthKey = now.toISOString().slice(0, 7);
  const currentMonthIndex = now.getMonth();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [recurringItems, setRecurringItems] = useState<RecurringItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadedAt, setLoadedAt] = useState<number | null>(null);
  const [, setTick] = useState(0);

  // Simulator
  const [sliderValue, setSliderValue] = useState<number | null>(null);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [goalSuggestion, setGoalSuggestion] = useState<GoalSuggestion | null>(null);
  const [goalLoading, setGoalLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Tour
  const [tourSeen, setTourSeen] = useState<boolean | null>(null);
  const [tourStep, setTourStep] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDoc(doc(db, "users", userId));
        const seen = snap.data()?.projectionTourSeen === true;
        setTourSeen(seen);
        if (!seen) setTourStep(1);
      } catch {
        setTourSeen(true);
      }
    })();
  }, [userId]);

  // Scroll to simulator when tour step 1 activates
  useEffect(() => {
    if (tourStep === 1) {
      setTimeout(() => {
        document.getElementById("sim-card")?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 400);
    }
  }, [tourStep]);

  const markTourSeen = useCallback(async () => {
    setTourStep(0);
    setTourSeen(true);
    try { await updateDoc(doc(db, "users", userId), { projectionTourSeen: true }); } catch { /* silent */ }
  }, [userId]);

  // Data
  useEffect(() => {
    setLoading(true);
    const q = query(
      collection(db, "workspaces", workspaceId, "transactions"),
      where("monthKey", ">=", `${currentYear}-01`),
      where("monthKey", "<=", `${currentYear}-12`)
    );
    return onSnapshot(q, (snap) => {
      setTransactions(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Transaction));
      setLoading(false);
      setLoadedAt(Date.now());
    });
  }, [workspaceId, currentYear]);

  useEffect(() => {
    const q = query(collection(db, "workspaces", workspaceId, "recurringItems"), where("active", "==", true));
    return onSnapshot(q, (snap) => {
      setRecurringItems(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as RecurringItem));
    });
  }, [workspaceId]);

  useEffect(() => {
    const t = setInterval(() => setTick(x => x + 1), 60000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, []);

  const minutesAgo = loadedAt ? Math.floor((Date.now() - loadedAt) / 60000) : null;
  const updatedLabel = minutesAgo === null ? "..." : minutesAgo === 0 ? "AGORA" : `HÁ ${minutesAgo} MIN`;

  const recurringIncome = useMemo(() => recurringItems.filter(r => r.type === "income").reduce((s, r) => s + r.amount, 0), [recurringItems]);
  const recurringExpense = useMemo(() => recurringItems.filter(r => r.type === "expense").reduce((s, r) => s + r.amount, 0), [recurringItems]);

  const months = useMemo<MonthRow[]>(() => {
    let accumulated = 0;
    return Array.from({ length: 12 }, (_, i) => {
      const m = i + 1;
      const monthKey = `${currentYear}-${String(m).padStart(2, "0")}`;
      const isPast = monthKey < currentMonthKey;
      const isCurrent = monthKey === currentMonthKey;
      const isFuture = monthKey > currentMonthKey;

      const monthTxs = transactions.filter(t => t.monthKey === monthKey);
      const actualIncome = monthTxs.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0);
      const actualExpense = monthTxs.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0);

      let income: number;
      let expense: number;
      let hasData: boolean;

      if (isPast) {
        income = actualIncome;
        expense = actualExpense;
        hasData = monthTxs.length > 0;
      } else if (isCurrent) {
        income = Math.max(actualIncome, recurringIncome > 0 ? recurringIncome : actualIncome);
        expense = Math.max(actualExpense, recurringExpense > 0 ? recurringExpense : actualExpense);
        hasData = true;
      } else {
        income = recurringIncome;
        expense = recurringExpense;
        hasData = recurringItems.length > 0;
      }

      const balance = income - expense;
      accumulated += balance;
      return { monthKey, label: MONTH_SHORT[i], shortLabel: MONTH_SHORT[i], isPast, isCurrent, isFuture, income, expense, balance, accumulated, hasData };
    });
  }, [transactions, recurringItems, currentYear, currentMonthKey, recurringIncome, recurringExpense]);

  const totalIncome = months.reduce((s, m) => s + m.income, 0);
  const totalExpense = months.reduce((s, m) => s + m.expense, 0);
  const endBalance = months[11]?.accumulated ?? 0;
  const positiveMonths = months.filter(m => m.balance > 0).length;
  const maxBar = Math.max(...months.map(m => Math.max(m.income, m.expense)), 1);
  const currentMonth = months.find(m => m.isCurrent) ?? null;

  // Biggest expense category in current month
  const vilaoCategory = useMemo(() => {
    const txs = transactions.filter(t => t.monthKey === currentMonthKey && t.type === "expense");
    const map = new Map<string, number>();
    for (const tx of txs) map.set(tx.category, (map.get(tx.category) ?? 0) + tx.amount);
    if (map.size === 0) return null;
    const sorted = [...map.entries()].sort((a, b) => b[1] - a[1]);
    return { nome: sorted[0][0], valor: sorted[0][1] };
  }, [transactions, currentMonthKey]);

  // Initialize slider once vilaoCategory is known
  useEffect(() => {
    if (vilaoCategory && sliderValue === null) setSliderValue(vilaoCategory.valor);
  }, [vilaoCategory, sliderValue]);

  const mesesRestantes = 12 - (currentMonthIndex + 1);
  const economiaMensal = vilaoCategory && sliderValue !== null ? Math.max(0, vilaoCategory.valor - sliderValue) : 0;
  const economiaAnual = economiaMensal * mesesRestantes;

  const handleSliderChange = useCallback((value: number) => {
    setSliderValue(value);

    if (!hasInteracted) {
      setHasInteracted(true);
      if (tourStep === 1) setTourStep(0);
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);

    const cut = (vilaoCategory?.valor ?? 0) - value;
    if (cut <= 0) {
      setGoalSuggestion(null);
      setGoalLoading(false);
      return;
    }

    setGoalLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const resp = await fetch(SUGGEST_GOAL_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            rendaMensal: currentMonth?.income ?? 0,
            totalGastoMesAtual: currentMonth?.expense ?? 0,
            economiaMensalSimulada: cut,
            categoriaVilao: vilaoCategory,
            sobraAtual: currentMonth?.balance ?? 0,
            mesAtual: currentMonthIndex + 1
          })
        });
        if (!resp.ok) throw new Error("api error");
        const data: GoalSuggestion = await resp.json();
        setGoalSuggestion(data.titulo ? data : null);
        setGoalLoading(false);
        if (tourSeen === false && tourStep <= 1) setTourStep(2);
      } catch {
        setGoalSuggestion(null);
        setGoalLoading(false);
      }
    }, 800);
  }, [vilaoCategory, currentMonth, currentMonthIndex, hasInteracted, tourStep, tourSeen]);

  return (
    <div style={{ minHeight: "100vh", background: "#050505", color: "#fff", fontFamily: "var(--font-ui)" }}>
      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.35} }
        @keyframes dotPulse { 0%,80%,100%{transform:scale(0)} 40%{transform:scale(1)} }
        @keyframes goalFadeIn { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
        @keyframes deltaIn { from{opacity:0;transform:translateX(4px)} to{opacity:1;transform:translateX(0)} }
        input[type="range"].proj-slider { outline: none; }
        input[type="range"].proj-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 22px; height: 22px; border-radius: 50%;
          background: #b8f55a;
          box-shadow: 0 2px 10px rgba(184,245,90,0.55);
          cursor: pointer; border: 2px solid #111;
        }
        input[type="range"].proj-slider::-moz-range-thumb {
          width: 22px; height: 22px; border-radius: 50%;
          background: #b8f55a;
          box-shadow: 0 2px 10px rgba(184,245,90,0.55);
          cursor: pointer; border: 2px solid #111;
        }
        @media (max-width: 767px) {
          .proj-hero-grid { grid-template-columns: repeat(2,1fr) !important; }
          .proj-month-row { grid-template-columns: 1fr !important; gap: 12px !important; }
          .proj-mobile-bottom { display: flex !important; justify-content: space-between !important; align-items: flex-end !important; }
          .proj-sim-card { padding: 24px 18px !important; }
        }
      `}</style>

      {tourStep === 1 && tourSeen === false && <TourStep1 onDismiss={() => setTourStep(0)} />}
      {tourStep === 2 && tourSeen === false && <TourStep2 onDismiss={markTourSeen} />}

      {/* Topbar */}
      <div style={{
        position: "sticky", top: 0, zIndex: tourStep > 0 ? 200 : 10,
        background: "rgba(5,5,5,0.95)", backdropFilter: "blur(20px)",
        borderBottom: "1px solid rgba(255,255,255,0.07)",
        padding: "10px 20px", display: "flex", alignItems: "center", gap: 16
      }}>
        <button
          onClick={() => router.push("/home")}
          style={{ display: "flex", alignItems: "center", gap: 6, background: "transparent", border: "none", color: "rgba(255,255,255,0.45)", cursor: "pointer", fontSize: 13, fontWeight: 600, padding: "4px 0", fontFamily: "var(--font-ui)", flexShrink: 0 }}
        >
          <ArrowLeft size={15} /> Voltar
        </button>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: G }}>MISSÃO {currentYear}</span>
          <span style={{ fontSize: 15, fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1 }}>Projeção 12 meses</span>
        </div>
        <div style={{
          display: "flex", alignItems: "center", gap: 6,
          fontSize: 9, letterSpacing: "0.08em",
          color: G, background: "rgba(184,245,90,0.06)",
          border: "1px solid rgba(184,245,90,0.15)", borderRadius: 6,
          padding: "5px 10px", flexShrink: 0
        }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: G, display: "inline-block", animation: "pulse 2s ease-in-out infinite" }} />
          ATUALIZADO {updatedLabel}
        </div>
      </div>

      <div style={{ width: "min(860px, calc(100% - 32px))", margin: "0 auto", padding: "32px 0 80px", display: "flex", flexDirection: "column", gap: 24 }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: "64px 0", color: "rgba(255,255,255,0.25)", fontSize: 12, letterSpacing: "0.08em" }}>
            CARREGANDO...
          </div>
        ) : (
          <>
            {/* ── MOMENTO 1 · REALIDADE AGORA ─────────────────────────────── */}
            <div className="proj-hero-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
              <HeroCard label="Entradas no ano" value={formatCurrency(totalIncome)} color={G} sub={`${months.filter(m => m.income > 0).length} meses com entrada`} />
              <HeroCard label="Saídas no ano" value={formatCurrency(totalExpense)} color={RED} sub={`${months.filter(m => m.expense > 0).length} meses com saída`} />
              <HeroCard label="Saldo projetado" value={formatCurrency(endBalance)} color={endBalance >= 0 ? G : RED} sub="acumulado em dezembro" highlight />
              <HeroCard
                label="Meses positivos"
                value={`${positiveMonths} de 12`}
                color={positiveMonths >= 9 ? G : positiveMonths >= 6 ? "#facc15" : RED}
                sub={positiveMonths >= 9 ? "excelente ritmo" : positiveMonths >= 6 ? "pode melhorar" : "atenção"}
              />
            </div>

            {recurringItems.length === 0 && (
              <div style={{ background: "rgba(250,204,21,0.04)", border: "1px solid rgba(250,204,21,0.12)", borderRadius: 10, padding: "10px 16px", marginBottom: 20, fontSize: 12, color: "rgba(250,204,21,0.7)", lineHeight: 1.6 }}>
                Sem recorrências cadastradas — meses futuros aparecem zerados. Adicione receitas e despesas fixas no Plano do Mês para ver a projeção completa.
              </div>
            )}

            <TrajectoryCard months={months} endBalance={endBalance} currentMonth={currentMonth} />

            {/* ── MOMENTO 2 · SIMULADOR ────────────────────────────────────── */}
            {vilaoCategory && sliderValue !== null && (
              <div
                id="sim-card"
                className="proj-sim-card"
                style={{
                  background: "#111111",
                  border: "1px solid rgba(184,245,90,0.22)",
                  borderRadius: 12,
                  padding: "20px 24px",
                  position: "relative",
                  zIndex: tourStep === 1 ? 150 : "auto"
                }}
              >
                <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)", margin: "0 0 8px" }}>
                  SIMULADOR
                </p>
                <p style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.02em", margin: "0 0 4px" }}>
                  E se você cortasse um gasto?
                </p>
                <p style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", margin: "0 0 24px" }}>
                  Arraste pra ver como muda o seu ano
                </p>

                <p style={{ fontSize: 14, color: "rgba(255,255,255,0.65)", margin: "0 0 20px", lineHeight: 1.55 }}>
                  Seu maior gasto é{" "}
                  <span style={{ color: "#fff", fontWeight: 500 }}>{vilaoCategory.nome}</span>
                  {" — "}
                  <span style={{ color: G }}>{formatCurrency(vilaoCategory.valor)}/mês</span>
                </p>

                <SliderInput value={sliderValue} max={vilaoCategory.valor} onChange={handleSliderChange} />

                {economiaMensal > 0 && (
                  <div style={{
                    marginTop: 20, padding: "16px 20px",
                    background: "rgba(184,245,90,0.04)",
                    border: "1px solid rgba(184,245,90,0.12)",
                    borderRadius: 10, transition: "all 200ms ease"
                  }}>
                    <p style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", margin: "0 0 12px", lineHeight: 1.55 }}>
                      Se cortar{" "}
                      <span style={{ color: G }}>{formatCurrency(economiaMensal)}</span>
                      {" "}por mês em{" "}
                      <span style={{ color: "#fff" }}>{vilaoCategory.nome}</span>:
                    </p>
                    <div style={{ display: "flex", gap: 28, flexWrap: "wrap" }}>
                      <div>
                        <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)", margin: "0 0 4px" }}>
                          Sobra por mês
                        </p>
                        <p style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.03em", color: G, margin: 0, transition: "all 200ms ease" }}>
                          +{formatCurrency(economiaMensal)}
                        </p>
                      </div>
                      {mesesRestantes > 0 && (
                        <div>
                          <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)", margin: "0 0 4px" }}>
                            Até dezembro
                          </p>
                          <p style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.03em", color: G, margin: 0, transition: "all 200ms ease" }}>
                            +{formatCurrency(economiaAnual)}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* ── MOMENTO 3 · META SUGERIDA ───────────────────────────── */}
                {(goalLoading || goalSuggestion) && (
                  <div
                    id="goal-card"
                    style={{ marginTop: 16, position: "relative", zIndex: tourStep === 2 ? 150 : "auto" }}
                  >
                    {goalLoading ? (
                      <div style={{ background: "#111111", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: "16px 20px", display: "flex", alignItems: "center", gap: 14 }}>
                        <DotsLoader />
                        <span style={{ fontSize: 13, color: "rgba(255,255,255,0.45)" }}>
                          Salvô! calculando seu caminho...
                        </span>
                      </div>
                    ) : goalSuggestion ? (
                      <GoalCard goal={goalSuggestion} router={router} />
                    ) : null}
                  </div>
                )}
              </div>
            )}

            {/* ── LISTA MÊS A MÊS ─────────────────────────────────────────── */}
            <div>
              <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)", margin: "0 0 12px" }}>
                MÊS A MÊS
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {months.map((m) => (
                  <MonthCard key={m.monthKey} month={m} maxBar={maxBar} simulatorDelta={m.isFuture ? economiaMensal : 0} />
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function HeroCard({ label, value, color, sub, highlight }: { label: string; value: string; color: string; sub: string; highlight?: boolean }) {
  return (
    <div style={{
      padding: "20px 24px",
      background: highlight ? "linear-gradient(135deg, rgba(184,245,90,0.10), rgba(184,245,90,0.02))" : "#111111",
      border: `1px solid ${highlight ? "rgba(184,245,90,0.30)" : "rgba(255,255,255,0.08)"}`,
      borderRadius: 12, display: "flex", flexDirection: "column", gap: 10
    }}>
      <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.36)", margin: 0 }}>{label}</p>
      <p style={{ fontSize: highlight ? 36 : 26, fontWeight: highlight ? 900 : 800, letterSpacing: "-0.03em", lineHeight: 1, color, margin: 0 }}>{value}</p>
      <p style={{ fontSize: 11, color: "rgba(255,255,255,0.28)", margin: 0 }}>{sub}</p>
    </div>
  );
}

function TrajectoryCard({ months, endBalance, currentMonth }: { months: MonthRow[]; endBalance: number; currentMonth: MonthRow | null }) {
  const currentAccumulated = currentMonth?.accumulated ?? 0;
  const currentLabel = currentMonth?.shortLabel ?? "";
  const endLabel = `R$${Math.round(Math.abs(endBalance) / 1000)}k`;

  const chartData = useMemo(() => months.map(m => ({
    name: m.shortLabel,
    all: m.accumulated,
    realized: !m.isFuture ? m.accumulated : null,
    projected: !m.isPast ? m.accumulated : null,
  })), [months]);

  return (
    <div style={{ background: "#111111", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: "24px 24px 16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
        <p style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.45, maxWidth: "55%", margin: 0 }}>
          Se mantiver o ritmo, você chega em{" "}
          <span style={{ color: endBalance >= 0 ? G : RED }}>{endLabel}</span>{" "}
          em dezembro.
        </p>
        <div style={{ textAlign: "right" }}>
          <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "rgba(255,255,255,0.45)", margin: 0 }}>Você está aqui</p>
          <p style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.03em", color: G, margin: "6px 0 0" }}>
            {formatCurrency(currentAccumulated)}
          </p>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={200}>
        <ComposedChart data={chartData} margin={{ top: 24, right: 16, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="projFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(184,245,90,0.15)" />
              <stop offset="100%" stopColor="rgba(184,245,90,0)" />
            </linearGradient>
          </defs>
          <XAxis dataKey="name" tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }} axisLine={false} tickLine={false} />
          <Tooltip
            contentStyle={{ background: "#1a1a1a", border: "1px solid rgba(184,245,90,0.3)", borderRadius: 8, fontSize: 12 }}
            labelStyle={{ color: "rgba(255,255,255,0.45)", marginBottom: 4 }}
            formatter={(v: unknown) => [formatCurrency(v as number), "Acumulado"]}
            itemStyle={{ color: G }}
          />
          <Area type="monotone" dataKey="all" fill="url(#projFill)" stroke="none" activeDot={false} isAnimationActive={false} />
          <Line type="monotone" dataKey="realized" stroke={G} strokeWidth={2} dot={false} activeDot={{ r: 3, fill: G, strokeWidth: 0 }} isAnimationActive={true} animationDuration={800} />
          <Line type="monotone" dataKey="projected" stroke={G} strokeWidth={2} strokeDasharray="5 4" dot={false} activeDot={false} isAnimationActive={false} />
          {currentLabel && <ReferenceDot x={currentLabel} y={currentAccumulated} r={6} fill={G} stroke="#fff" strokeWidth={2} />}
          <ReferenceDot x="Dez" y={endBalance} r={4} fill={G} stroke="none"
            label={{ value: `META · ${endLabel}`, position: "top", fill: G, fontSize: 9, letterSpacing: "0.08em" }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

function MonthCard({ month: m, maxBar, simulatorDelta = 0 }: { month: MonthRow; maxBar: number; simulatorDelta?: number }) {
  const incomeW = maxBar > 0 ? (m.income / maxBar) * 100 : 0;
  const expenseW = maxBar > 0 ? (m.expense / maxBar) * 100 : 0;
  const isPositive = m.balance >= 0;
  const isEmpty = !m.hasData && m.isFuture;
  const statusLabel = m.isCurrent ? "• EM ANDAMENTO" : m.isPast ? "REALIZADO" : "PROJETADO";
  const statusColor = m.isCurrent ? G : "rgba(255,255,255,0.35)";
  const deltaLabel = m.isCurrent ? "parcial" : "do mês";

  return (
    <div
      className="proj-month-row"
      style={{
        display: "grid", gridTemplateColumns: "84px 1fr 140px 120px", gap: 24, alignItems: "center",
        padding: "18px 24px",
        background: m.isCurrent ? "linear-gradient(90deg, rgba(184,245,90,0.08), rgba(184,245,90,0.01) 60%)" : "#111111",
        border: `1px solid ${m.isCurrent ? "rgba(184,245,90,0.25)" : simulatorDelta > 0 ? "rgba(184,245,90,0.15)" : "rgba(255,255,255,0.08)"}`,
        borderRadius: 12,
        opacity: isEmpty ? 0.45 : 1,
        transition: "border-color .2s"
      }}
    >
      <div>
        <p style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1, color: m.isCurrent ? G : m.isPast ? "#ffffff" : "rgba(255,255,255,0.38)", margin: 0 }}>
          {m.shortLabel}
        </p>
        <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: statusColor, margin: "5px 0 0" }}>
          {statusLabel}
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ width: 60, fontSize: 9, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.45)", flexShrink: 0 }}>Entradas</span>
          <div style={{ flex: 1, height: 5, background: "rgba(255,255,255,0.04)", borderRadius: 999, overflow: "hidden" }}>
            <div style={{ height: "100%", borderRadius: 999, background: G, width: `${incomeW}%`, opacity: m.isFuture ? 0.5 : 1, transition: "width .5s ease" }} />
          </div>
          <span style={{ minWidth: 90, textAlign: "right", fontSize: 14, fontWeight: 700, color: G }}>{formatCurrency(m.income)}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ width: 60, fontSize: 9, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.45)", flexShrink: 0 }}>Saídas</span>
          <div style={{ flex: 1, height: 5, background: "rgba(255,255,255,0.04)", borderRadius: 999, overflow: "hidden" }}>
            <div style={{ height: "100%", borderRadius: 999, background: RED, width: `${expenseW}%`, opacity: m.isFuture ? 0.5 : 1, transition: "width .5s ease" }} />
          </div>
          <span style={{ minWidth: 90, textAlign: "right", fontSize: 14, fontWeight: 700, color: RED }}>{formatCurrency(m.expense)}</span>
        </div>
      </div>

      <div className="proj-mobile-bottom" style={{ textAlign: "right" }}>
        <p style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1, color: isPositive ? G : RED, margin: 0 }}>
          {isPositive ? "+" : "−"}{formatCurrency(Math.abs(m.balance))}
        </p>
        <p style={{ marginTop: 5, color: "rgba(255,255,255,0.45)", fontSize: 11, margin: "5px 0 0" }}>{deltaLabel}</p>
        {simulatorDelta > 0 && (
          <p style={{ fontSize: 10, color: G, margin: "4px 0 0", animation: "deltaIn 0.25s ease", opacity: 0.8 }}>
            +{formatCurrency(simulatorDelta)} simulado
          </p>
        )}
      </div>

      <div className="proj-mobile-bottom" style={{ textAlign: "right" }}>
        <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "rgba(255,255,255,0.45)", margin: 0 }}>Acumulado</p>
        <p style={{ fontSize: 16, fontWeight: 700, letterSpacing: "-0.02em", color: "#ffffff", margin: "5px 0 0" }}>
          {formatCurrency(m.accumulated)}
        </p>
      </div>
    </div>
  );
}
