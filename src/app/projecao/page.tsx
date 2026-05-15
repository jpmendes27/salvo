"use client";

import { collection, onSnapshot, query, where } from "firebase/firestore";
import { ArrowLeft, TrendingUp } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useAuthUser } from "@/app/auth-provider";
import { db } from "@/lib/firebase";
import { formatCurrency } from "@/lib/money";
import type { RecurringItem, Transaction } from "@/lib/types";

const G = "#b8f55a";

const MONTH_NAMES = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez"
];

function Shell({ text }: { text: string }) {
  return (
    <div style={{ minHeight: "100vh", background: "#09090b", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.4)", fontSize: 14 }}>
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
        // Projetado = max(real, recorrente) — o que já entrou + o que ainda falta segundo recorrências
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

      const date = new Date(currentYear, m - 1, 1);
      const label = new Intl.DateTimeFormat("pt-BR", { month: "long" }).format(date);

      return { monthKey, label, shortLabel: MONTH_NAMES[i], isPast, isCurrent, isFuture, income, expense, balance, accumulated, hasData };
    });
  }, [transactions, recurringItems, currentYear, currentMonthKey, recurringIncome, recurringExpense]);

  const totalIncome = months.reduce((s, m) => s + m.income, 0);
  const totalExpense = months.reduce((s, m) => s + m.expense, 0);
  const endBalance = months[11]?.accumulated ?? 0;
  const positiveMonths = months.filter(m => m.balance > 0).length;

  const maxBar = Math.max(...months.map(m => Math.max(m.income, m.expense)), 1);

  return (
    <div style={{ minHeight: "100vh", background: "#09090b", color: "#fff", fontFamily: "var(--font-dm-sans, sans-serif)" }}>
      {/* Header */}
      <div style={{ position: "sticky", top: 0, zIndex: 10, background: "rgba(9,9,11,0.92)", backdropFilter: "blur(16px)", borderBottom: "1px solid rgba(255,255,255,0.07)", padding: "14px 24px", display: "flex", alignItems: "center", gap: 16 }}>
        <button onClick={() => router.push("/")} style={{ display: "flex", alignItems: "center", gap: 6, background: "transparent", border: "none", color: "rgba(255,255,255,0.5)", cursor: "pointer", fontSize: 13, fontWeight: 600, padding: 0 }}>
          <ArrowLeft size={16} /> Voltar
        </button>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 15, fontWeight: 800 }}>Projeção {currentYear}</h1>
        </div>
        <TrendingUp size={16} color={G} />
      </div>

      <div style={{ maxWidth: 760, margin: "0 auto", padding: "24px 20px" }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: "64px 0", color: "rgba(255,255,255,0.28)", fontSize: 13 }}>Carregando...</div>
        ) : (
          <>
            {/* Summary cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 32 }}>
              <SummaryCard label="Entradas no ano" value={formatCurrency(totalIncome)} color={G} />
              <SummaryCard label="Saídas no ano" value={formatCurrency(totalExpense)} color="#ff8080" />
              <SummaryCard label="Saldo projetado" value={formatCurrency(endBalance)} color={endBalance >= 0 ? G : "#ff8080"} />
              <SummaryCard label="Meses positivos" value={`${positiveMonths} de 12`} color={positiveMonths >= 9 ? G : positiveMonths >= 6 ? "#facc15" : "#ff8080"} />
            </div>

            {recurringItems.length === 0 && (
              <div style={{ background: "rgba(250,204,21,0.06)", border: "1px solid rgba(250,204,21,0.15)", borderRadius: 12, padding: "12px 16px", marginBottom: 20, fontSize: 12.5, color: "rgba(250,204,21,0.8)", lineHeight: 1.6 }}>
                Sem recorrências cadastradas — os meses futuros aparecem zerados. Adicione receitas e despesas fixas na aba de Plano do Mês para ver a projeção completa.
              </div>
            )}

            {/* Month list */}
            <div style={{ display: "grid", gap: 6 }}>
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

function SummaryCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: "16px 18px" }}>
      <p style={{ fontSize: 10.5, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700, marginBottom: 6 }}>{label}</p>
      <p style={{ fontSize: 18, fontWeight: 800, color, letterSpacing: "-0.03em" }}>{value}</p>
    </div>
  );
}

function MonthCard({ month: m, maxBar }: { month: MonthRow; maxBar: number }) {
  const incomeW = maxBar > 0 ? (m.income / maxBar) * 100 : 0;
  const expenseW = maxBar > 0 ? (m.expense / maxBar) * 100 : 0;
  const isPositive = m.balance >= 0;

  const badge = m.isCurrent
    ? { label: "em andamento", color: "#facc15", bg: "rgba(250,204,21,0.10)" }
    : m.isPast
    ? { label: "realizado", color: "rgba(255,255,255,0.35)", bg: "rgba(255,255,255,0.05)" }
    : { label: "projetado", color: "rgba(184,245,90,0.5)", bg: "rgba(184,245,90,0.06)" };

  return (
    <div style={{
      background: m.isCurrent ? "rgba(184,245,90,0.03)" : "rgba(255,255,255,0.02)",
      border: `1px solid ${m.isCurrent ? "rgba(184,245,90,0.12)" : "rgba(255,255,255,0.06)"}`,
      borderRadius: 12,
      padding: "14px 16px",
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
        {/* Month label */}
        <div style={{ flexShrink: 0, width: 36, paddingTop: 2 }}>
          <p style={{ fontSize: 13, fontWeight: 800, color: m.isCurrent ? G : m.isPast ? "#e8e9ec" : "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.04em" }}>{m.shortLabel}</p>
          <span style={{ fontSize: 9.5, fontWeight: 700, color: badge.color, background: badge.bg, padding: "2px 5px", borderRadius: 4, display: "inline-block", marginTop: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>{badge.label}</span>
        </div>

        {/* Bars + values */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", gap: 4, marginBottom: 6 }}>
            {/* Income bar */}
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", fontWeight: 600 }}>Entradas</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: G }}>{formatCurrency(m.income)}</span>
              </div>
              <div style={{ height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 2, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${incomeW}%`, background: G, borderRadius: 2, opacity: m.isFuture ? 0.45 : 0.9, transition: "width .4s ease" }} />
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            {/* Expense bar */}
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", fontWeight: 600 }}>Saídas</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#ff8080" }}>{formatCurrency(m.expense)}</span>
              </div>
              <div style={{ height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 2, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${expenseW}%`, background: "#ff8080", borderRadius: 2, opacity: m.isFuture ? 0.45 : 0.9, transition: "width .4s ease" }} />
              </div>
            </div>
          </div>
        </div>

        {/* Balance + accumulated */}
        <div style={{ flexShrink: 0, textAlign: "right", minWidth: 90 }}>
          <p style={{ fontSize: 13, fontWeight: 800, color: isPositive ? G : "#ff8080", letterSpacing: "-0.02em" }}>
            {isPositive ? "+" : ""}{formatCurrency(m.balance)}
          </p>
          <p style={{ fontSize: 10.5, color: "rgba(255,255,255,0.28)", marginTop: 3 }}>
            acum. {formatCurrency(m.accumulated)}
          </p>
        </div>
      </div>
    </div>
  );
}
