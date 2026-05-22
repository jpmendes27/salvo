"use client";

import { collection, onSnapshot, query, where } from "firebase/firestore";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useAuthUser } from "@/app/auth-provider";
import { db } from "@/lib/firebase";
import { formatCurrency } from "@/lib/money";
import type { RecurringItem, Transaction } from "@/lib/types";

const G = "#b8f55a";
const RED = "#ff5c5c";

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];
const MONTH_SHORT = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

function Shell({ text }: { text: string }) {
  return (
    <div style={{ minHeight: "100vh", background: "#050505", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.4)", fontSize: 14, fontFamily: "var(--font-ui)" }}>
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
    });
  }, [workspaceId, currentYear]);

  useEffect(() => {
    const q = query(collection(db, "workspaces", workspaceId, "recurringItems"), where("active", "==", true));
    return onSnapshot(q, (snap) => {
      setRecurringItems(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as RecurringItem));
    });
  }, [workspaceId]);

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
        monthKey, label: MONTH_NAMES[i], shortLabel: MONTH_SHORT[i],
        isPast, isCurrent, isFuture, income, expense, balance, accumulated, hasData
      };
    });
  }, [transactions, recurringItems, currentYear, currentMonthKey, recurringIncome, recurringExpense]);

  const totalIncome = months.reduce((s, m) => s + m.income, 0);
  const totalExpense = months.reduce((s, m) => s + m.expense, 0);
  const endBalance = months[11]?.accumulated ?? 0;
  const positiveMonths = months.filter(m => m.balance > 0).length;
  const maxBar = Math.max(...months.map(m => Math.max(m.income, m.expense)), 1);

  return (
    <div style={{ minHeight: "100vh", background: "#050505", color: "#fff", fontFamily: "var(--font-ui)" }}>
      <style>{`
        @media (max-width: 767px) {
          .proj-month-grid {
            grid-template-columns: 1fr !important;
            gap: 14px !important;
          }
          .proj-hero-grid {
            grid-template-columns: repeat(2, 1fr) !important;
          }
          .proj-bottom-row {
            display: flex !important;
            justify-content: space-between !important;
            align-items: flex-start !important;
          }
        }
      `}</style>

      {/* Topbar */}
      <div style={{
        position: "sticky", top: 0, zIndex: 10,
        background: "rgba(5,5,5,0.94)", backdropFilter: "blur(20px)",
        borderBottom: "1px solid rgba(255,255,255,0.07)",
        padding: "0 24px", height: 56,
        display: "flex", alignItems: "center", gap: 16
      }}>
        <button
          onClick={() => router.push("/home")}
          style={{ display: "flex", alignItems: "center", gap: 6, background: "transparent", border: "none", color: "rgba(255,255,255,0.45)", cursor: "pointer", fontSize: 13, fontWeight: 600, padding: "6px 0", fontFamily: "var(--font-ui)" }}
        >
          <ArrowLeft size={15} /> Voltar
        </button>
        <div style={{ flex: 1 }}>
          <span style={{ fontSize: 15, fontWeight: 800, letterSpacing: "-0.01em" }}>
            Projeção {currentYear}
          </span>
        </div>
        <span style={{
          fontFamily: "'DM Mono', monospace", fontSize: 9.5, fontWeight: 400,
          color: G, letterSpacing: "0.12em", textTransform: "uppercase",
          background: "rgba(184,245,90,0.08)", border: "1px solid rgba(184,245,90,0.2)",
          borderRadius: 5, padding: "3px 8px"
        }}>
          MISSÃO {currentYear}
        </span>
      </div>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "32px 20px 80px" }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: "64px 0", color: "rgba(255,255,255,0.25)", fontSize: 13, fontFamily: "'DM Mono', monospace" }}>
            Carregando...
          </div>
        ) : (
          <>
            {/* Hero stats — 4 colunas desktop, 2 mobile */}
            <div className="proj-hero-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 28 }}>
              <HeroCard label="Entradas no ano" value={formatCurrency(totalIncome)} color={totalIncome > 0 ? G : "rgba(255,255,255,0.4)"} />
              <HeroCard label="Saídas no ano" value={formatCurrency(totalExpense)} color={totalExpense > 0 ? RED : "rgba(255,255,255,0.4)"} />
              <HeroCard label="Saldo projetado" value={formatCurrency(endBalance)} color={endBalance >= 0 ? G : RED} highlight />
              <HeroCard
                label="Meses positivos"
                value={`${positiveMonths} de 12`}
                color={positiveMonths >= 9 ? G : positiveMonths >= 6 ? "#facc15" : RED}
              />
            </div>

            {recurringItems.length === 0 && (
              <div style={{
                background: "rgba(250,204,21,0.04)", border: "1px solid rgba(250,204,21,0.12)",
                borderRadius: 10, padding: "11px 16px", marginBottom: 24,
                fontSize: 12, color: "rgba(250,204,21,0.7)", lineHeight: 1.6
              }}>
                Sem recorrências cadastradas — meses futuros aparecem zerados. Adicione receitas e despesas fixas no Plano do Mês para ver a projeção completa.
              </div>
            )}

            {/* Month list */}
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

function HeroCard({ label, value, color, highlight }: { label: string; value: string; color: string; highlight?: boolean }) {
  return (
    <div style={{
      padding: "22px 24px",
      background: highlight
        ? "linear-gradient(135deg, rgba(184,245,90,0.10), rgba(184,245,90,0.02))"
        : "#111111",
      border: `1px solid ${highlight ? "rgba(184,245,90,0.30)" : "rgba(255,255,255,0.08)"}`,
      borderRadius: 16,
      display: "flex", flexDirection: "column", gap: 12
    }}>
      <p style={{
        fontFamily: "'DM Mono', monospace", fontSize: 11,
        letterSpacing: "0.14em", textTransform: "uppercase",
        color: "rgba(255,255,255,0.45)", margin: 0
      }}>
        {label}
      </p>
      <p style={{
        fontFamily: "'DM Mono', monospace",
        fontSize: highlight ? 38 : 30,
        fontWeight: 400,
        letterSpacing: "-0.01em",
        lineHeight: 1,
        fontVariantNumeric: "tabular-nums",
        color,
        margin: 0
      }}>
        {value}
      </p>
    </div>
  );
}

function MonthCard({ month: m, maxBar }: { month: MonthRow; maxBar: number }) {
  const incomeW = maxBar > 0 ? (m.income / maxBar) * 100 : 0;
  const expenseW = maxBar > 0 ? (m.expense / maxBar) * 100 : 0;
  const isPositive = m.balance >= 0;
  const isEmpty = !m.hasData && m.isFuture;

  const statusLabel = m.isCurrent ? "• em andamento" : m.isPast ? "realizado" : "projetado";
  const statusColor = m.isCurrent ? G : "rgba(255,255,255,0.45)";
  const deltaLabel = m.isCurrent ? "parcial" : "do mês";

  return (
    <div
      className="proj-month-grid"
      style={{
        display: "grid",
        gridTemplateColumns: "84px 1fr 180px 160px",
        gap: 24,
        alignItems: "center",
        padding: "18px 24px",
        background: m.isCurrent
          ? "linear-gradient(90deg, rgba(184,245,90,0.10), rgba(184,245,90,0.02) 60%)"
          : "#111111",
        border: `1px solid ${m.isCurrent ? "rgba(184,245,90,0.30)" : "rgba(255,255,255,0.08)"}`,
        borderRadius: 14,
        opacity: isEmpty ? 0.45 : 1,
        transition: "border-color .15s, background .15s",
      }}
    >
      {/* Col 1 — nome + estado */}
      <div>
        <p style={{
          fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1,
          color: m.isCurrent ? G : m.isPast ? "#ffffff" : "rgba(255,255,255,0.38)",
          margin: 0
        }}>
          {m.shortLabel}
        </p>
        <p style={{
          fontFamily: "'DM Mono', monospace", fontSize: 9,
          letterSpacing: "0.12em", textTransform: "uppercase",
          color: statusColor, marginTop: 5, margin: "5px 0 0"
        }}>
          {statusLabel}
        </p>
      </div>

      {/* Col 2 — barras */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {/* Entradas */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 11 }}>
          <span style={{ width: 60, color: "rgba(255,255,255,0.45)", fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: "0.08em", textTransform: "uppercase", flexShrink: 0 }}>
            Entradas
          </span>
          <div style={{ flex: 1, height: 5, background: "rgba(255,255,255,0.04)", borderRadius: 999, overflow: "hidden" }}>
            <div style={{ height: "100%", borderRadius: 999, background: G, width: `${incomeW}%`, opacity: m.isFuture ? 0.55 : 1, transition: "width .5s ease" }} />
          </div>
          <span style={{ minWidth: 90, textAlign: "right", fontFamily: "'DM Mono', monospace", fontWeight: 400, fontSize: 14, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.005em", color: G }}>
            {formatCurrency(m.income)}
          </span>
        </div>
        {/* Saídas */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 11 }}>
          <span style={{ width: 60, color: "rgba(255,255,255,0.45)", fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: "0.08em", textTransform: "uppercase", flexShrink: 0 }}>
            Saídas
          </span>
          <div style={{ flex: 1, height: 5, background: "rgba(255,255,255,0.04)", borderRadius: 999, overflow: "hidden" }}>
            <div style={{ height: "100%", borderRadius: 999, background: RED, width: `${expenseW}%`, opacity: m.isFuture ? 0.55 : 1, transition: "width .5s ease" }} />
          </div>
          <span style={{ minWidth: 90, textAlign: "right", fontFamily: "'DM Mono', monospace", fontWeight: 400, fontSize: 14, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.005em", color: RED }}>
            {formatCurrency(m.expense)}
          </span>
        </div>
      </div>

      {/* Col 3 — delta */}
      <div className="proj-bottom-row" style={{ textAlign: "right" }}>
        <div>
          <p style={{
            fontFamily: "'DM Mono', monospace", fontSize: 22, fontWeight: 400,
            letterSpacing: "-0.01em", lineHeight: 1, fontVariantNumeric: "tabular-nums",
            color: isPositive ? G : RED, margin: 0
          }}>
            {isPositive ? "+" : "−"}{formatCurrency(Math.abs(m.balance))}
          </p>
          <p style={{ marginTop: 5, color: "rgba(255,255,255,0.45)", fontSize: 11, margin: "5px 0 0" }}>
            {deltaLabel}
          </p>
        </div>
      </div>

      {/* Col 4 — acumulado */}
      <div className="proj-bottom-row" style={{ textAlign: "right" }}>
        <div>
          <p style={{
            fontFamily: "'DM Mono', monospace", fontSize: 9,
            letterSpacing: "0.12em", textTransform: "uppercase",
            color: "rgba(255,255,255,0.45)", margin: 0
          }}>
            Acumulado
          </p>
          <p style={{
            marginTop: 5, fontFamily: "'DM Mono', monospace", fontWeight: 400,
            fontSize: 16, fontVariantNumeric: "tabular-nums",
            color: "#ffffff", letterSpacing: "-0.005em", margin: "5px 0 0"
          }}>
            {formatCurrency(m.accumulated)}
          </p>
        </div>
      </div>
    </div>
  );
}
