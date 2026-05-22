"use client";

import { collection, onSnapshot, query, where } from "firebase/firestore";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Area, ComposedChart, Line, ReferenceDot, ResponsiveContainer, XAxis, Tooltip
} from "recharts";
import { useAuthUser } from "@/app/auth-provider";
import { db } from "@/lib/firebase";
import { formatCurrency } from "@/lib/money";
import type { RecurringItem, Transaction } from "@/lib/types";

const G = "#b8f55a";
const RED = "#ff5c5c";

const MONTH_SHORT = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

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

  return <ProjectionView workspaceId={workspaceId} />;
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

function ProjectionView({ workspaceId }: { workspaceId: string }) {
  const router = useRouter();
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonthKey = now.toISOString().slice(0, 7);

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [recurringItems, setRecurringItems] = useState<RecurringItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadedAt, setLoadedAt] = useState<number | null>(null);
  const [, setTick] = useState(0);

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

  // Tick every minute to update the "updated X min ago" label
  useEffect(() => {
    const t = setInterval(() => setTick(x => x + 1), 60000);
    return () => clearInterval(t);
  }, []);

  const minutesAgo = loadedAt ? Math.floor((Date.now() - loadedAt) / 60000) : null;
  const updatedLabel = minutesAgo === null
    ? "..."
    : minutesAgo === 0
    ? "AGORA"
    : `HÁ ${minutesAgo} MIN`;

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

      return {
        monthKey, label: MONTH_SHORT[i], shortLabel: MONTH_SHORT[i],
        isPast, isCurrent, isFuture, income, expense, balance, accumulated, hasData
      };
    });
  }, [transactions, recurringItems, currentYear, currentMonthKey, recurringIncome, recurringExpense]);

  const totalIncome = months.reduce((s, m) => s + m.income, 0);
  const totalExpense = months.reduce((s, m) => s + m.expense, 0);
  const endBalance = months[11]?.accumulated ?? 0;
  const positiveMonths = months.filter(m => m.balance > 0).length;
  const maxBar = Math.max(...months.map(m => Math.max(m.income, m.expense)), 1);
  const currentMonth = months.find(m => m.isCurrent);

  return (
    <div style={{ minHeight: "100vh", background: "#050505", color: "#fff", fontFamily: "var(--font-ui)" }}>
      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.35} }
        @media (max-width: 767px) {
          .proj-hero-grid { grid-template-columns: repeat(2,1fr) !important; }
          .proj-month-row { grid-template-columns: 1fr !important; gap: 12px !important; }
          .proj-mobile-bottom { display: flex !important; justify-content: space-between !important; align-items: flex-end !important; }
        }
      `}</style>

      {/* Topbar */}
      <div style={{
        position: "sticky", top: 0, zIndex: 10,
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
          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", color: G }}>
            MISSÃO {currentYear}
          </span>
          <span style={{ fontSize: 15, fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1 }}>
            Projeção 12 meses
          </span>
        </div>
        <div style={{
          display: "flex", alignItems: "center", gap: 6,
          fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: "0.08em",
          color: G, background: "rgba(184,245,90,0.06)",
          border: "1px solid rgba(184,245,90,0.15)", borderRadius: 6,
          padding: "5px 10px", flexShrink: 0
        }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: G, display: "inline-block", animation: "pulse 2s ease-in-out infinite" }} />
          ATUALIZADO {updatedLabel}
        </div>
      </div>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "28px 16px 80px" }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: "64px 0", color: "rgba(255,255,255,0.25)", fontSize: 12, fontFamily: "'DM Mono', monospace", letterSpacing: "0.08em" }}>
            CARREGANDO...
          </div>
        ) : (
          <>
            {/* Hero stats */}
            <div className="proj-hero-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
              <HeroCard label="Entradas no ano" value={formatCurrency(totalIncome)} color={G} sub={`${months.filter(m => m.income > 0).length} meses com entrada`} />
              <HeroCard label="Saídas no ano" value={formatCurrency(totalExpense)} color={RED} sub={`${months.filter(m => m.expense > 0).length} meses com saída`} />
              <HeroCard
                label="Saldo projetado"
                value={formatCurrency(endBalance)}
                color={endBalance >= 0 ? G : RED}
                sub="acumulado em dezembro"
                highlight
              />
              <HeroCard
                label="Meses positivos"
                value={`${positiveMonths} de 12`}
                color={positiveMonths >= 9 ? G : positiveMonths >= 6 ? "#facc15" : RED}
                sub={positiveMonths >= 9 ? "excelente ritmo" : positiveMonths >= 6 ? "pode melhorar" : "atenção"}
              />
            </div>

            {recurringItems.length === 0 && (
              <div style={{
                background: "rgba(250,204,21,0.04)", border: "1px solid rgba(250,204,21,0.12)",
                borderRadius: 10, padding: "10px 16px", marginBottom: 20,
                fontSize: 12, color: "rgba(250,204,21,0.7)", lineHeight: 1.6
              }}>
                Sem recorrências cadastradas — meses futuros aparecem zerados. Adicione receitas e despesas fixas no Plano do Mês para ver a projeção completa.
              </div>
            )}

            {/* Trajectory chart */}
            <TrajectoryCard months={months} endBalance={endBalance} currentMonth={currentMonth ?? null} />

            {/* Month list */}
            <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)", marginBottom: 12, marginTop: 28 }}>
              MÊS A MÊS
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {months.map((m) => (
                <MonthCard key={m.monthKey} month={m} maxBar={maxBar} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function HeroCard({ label, value, color, sub, highlight }: { label: string; value: string; color: string; sub: string; highlight?: boolean }) {
  return (
    <div style={{
      padding: "22px 24px",
      background: highlight
        ? "linear-gradient(135deg, rgba(184,245,90,0.10), rgba(184,245,90,0.02))"
        : "#111111",
      border: `1px solid ${highlight ? "rgba(184,245,90,0.30)" : "rgba(255,255,255,0.08)"}`,
      borderRadius: 16,
      display: "flex", flexDirection: "column", gap: 10
    }}>
      <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(255,255,255,0.45)", margin: 0 }}>
        {label}
      </p>
      <p style={{ fontFamily: "'DM Mono', monospace", fontSize: highlight ? 38 : 28, fontWeight: 400, letterSpacing: "-0.01em", lineHeight: 1, fontVariantNumeric: "tabular-nums", color, margin: 0 }}>
        {value}
      </p>
      <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: "0.08em", color: "rgba(255,255,255,0.28)", margin: 0, textTransform: "uppercase" }}>
        {sub}
      </p>
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
    <div style={{
      background: "linear-gradient(180deg, rgba(184,245,90,0.04), transparent 70%), #111111",
      border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: 16,
      padding: "24px 24px 16px",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
        <p style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.45, maxWidth: "55%", margin: 0 }}>
          Se mantiver o ritmo, você chega em{" "}
          <span style={{ color: endBalance >= 0 ? G : RED }}>{endLabel}</span>{" "}
          em dezembro.
        </p>
        <div style={{ textAlign: "right" }}>
          <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.45)", margin: 0 }}>
            Você está aqui
          </p>
          <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 22, fontWeight: 400, color: G, letterSpacing: "-0.01em", margin: "6px 0 0", fontVariantNumeric: "tabular-nums" }}>
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
          <XAxis
            dataKey="name"
            tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10, fontFamily: "'DM Mono', monospace" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{ background: "#1a1a1a", border: "1px solid rgba(184,245,90,0.3)", borderRadius: 8, fontSize: 12, fontFamily: "'DM Mono', monospace" }}
            labelStyle={{ color: "rgba(255,255,255,0.45)", marginBottom: 4 }}
            formatter={(v: unknown) => [formatCurrency(v as number), "Acumulado"]}
            itemStyle={{ color: G }}
          />
          {/* Area fill — full 12 months */}
          <Area type="monotone" dataKey="all" fill="url(#projFill)" stroke="none" activeDot={false} isAnimationActive={false} />
          {/* Solid line — past + current */}
          <Line type="monotone" dataKey="realized" stroke={G} strokeWidth={2} dot={false} activeDot={{ r: 3, fill: G, strokeWidth: 0 }} isAnimationActive={true} animationDuration={800} />
          {/* Dashed line — current + future */}
          <Line type="monotone" dataKey="projected" stroke={G} strokeWidth={2} strokeDasharray="5 4" dot={false} activeDot={false} isAnimationActive={false} />
          {/* Dot at current month */}
          {currentLabel && (
            <ReferenceDot x={currentLabel} y={currentAccumulated} r={6} fill={G} stroke="#fff" strokeWidth={2} />
          )}
          {/* META label at December */}
          <ReferenceDot
            x="Dez"
            y={endBalance}
            r={4}
            fill={G}
            stroke="none"
            label={{ value: `META · ${endLabel}`, position: "top", fill: G, fontSize: 9, fontFamily: "'DM Mono', monospace", letterSpacing: "0.08em" }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

function MonthCard({ month: m, maxBar }: { month: MonthRow; maxBar: number }) {
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
        display: "grid",
        gridTemplateColumns: "84px 1fr 140px 120px",
        gap: 24,
        alignItems: "center",
        padding: "18px 24px",
        background: m.isCurrent
          ? "linear-gradient(90deg, rgba(184,245,90,0.10), rgba(184,245,90,0.02) 60%)"
          : "#111111",
        border: `1px solid ${m.isCurrent ? "rgba(184,245,90,0.30)" : "rgba(255,255,255,0.08)"}`,
        borderRadius: 14,
        opacity: isEmpty ? 0.45 : 1,
        transition: "border-color .15s",
      }}
    >
      {/* Col 1 — nome + estado */}
      <div>
        <p style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1, color: m.isCurrent ? G : m.isPast ? "#ffffff" : "rgba(255,255,255,0.38)", margin: 0 }}>
          {m.shortLabel}
        </p>
        <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", color: statusColor, margin: "5px 0 0" }}>
          {statusLabel}
        </p>
      </div>

      {/* Col 2 — barras */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ width: 60, fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.45)", flexShrink: 0 }}>Entradas</span>
          <div style={{ flex: 1, height: 5, background: "rgba(255,255,255,0.04)", borderRadius: 999, overflow: "hidden" }}>
            <div style={{ height: "100%", borderRadius: 999, background: G, width: `${incomeW}%`, opacity: m.isFuture ? 0.5 : 1, transition: "width .5s ease" }} />
          </div>
          <span style={{ minWidth: 90, textAlign: "right", fontFamily: "'DM Mono', monospace", fontSize: 14, fontWeight: 400, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.005em", color: G }}>
            {formatCurrency(m.income)}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ width: 60, fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.45)", flexShrink: 0 }}>Saídas</span>
          <div style={{ flex: 1, height: 5, background: "rgba(255,255,255,0.04)", borderRadius: 999, overflow: "hidden" }}>
            <div style={{ height: "100%", borderRadius: 999, background: RED, width: `${expenseW}%`, opacity: m.isFuture ? 0.5 : 1, transition: "width .5s ease" }} />
          </div>
          <span style={{ minWidth: 90, textAlign: "right", fontFamily: "'DM Mono', monospace", fontSize: 14, fontWeight: 400, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.005em", color: RED }}>
            {formatCurrency(m.expense)}
          </span>
        </div>
      </div>

      {/* Col 3 — delta */}
      <div className="proj-mobile-bottom" style={{ textAlign: "right" }}>
        <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 22, fontWeight: 400, letterSpacing: "-0.01em", lineHeight: 1, fontVariantNumeric: "tabular-nums", color: isPositive ? G : RED, margin: 0 }}>
          {isPositive ? "+" : "−"}{formatCurrency(Math.abs(m.balance))}
        </p>
        <p style={{ marginTop: 5, color: "rgba(255,255,255,0.45)", fontSize: 11, margin: "5px 0 0" }}>{deltaLabel}</p>
      </div>

      {/* Col 4 — acumulado */}
      <div className="proj-mobile-bottom" style={{ textAlign: "right" }}>
        <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.45)", margin: 0 }}>Acumulado</p>
        <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 16, fontWeight: 400, fontVariantNumeric: "tabular-nums", color: "#ffffff", letterSpacing: "-0.005em", margin: "5px 0 0" }}>
          {formatCurrency(m.accumulated)}
        </p>
      </div>
    </div>
  );
}
