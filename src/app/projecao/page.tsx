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
        @keyframes fadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .proj-month-card { transition: border-color .18s, background .18s; }
        .proj-month-card:hover { background: rgba(255,255,255,0.035) !important; }
      `}</style>

      {/* Topbar */}
      <div style={{
        position: "sticky", top: 0, zIndex: 10,
        background: "rgba(5,5,5,0.92)", backdropFilter: "blur(18px)",
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
          <span style={{ fontSize: 15, fontWeight: 800, fontFamily: "var(--font-ui)", letterSpacing: "-0.01em" }}>
            Projeção {currentYear}
          </span>
        </div>
        <span style={{
          fontFamily: "var(--font-mono)", fontSize: 9.5, fontWeight: 400,
          color: G, letterSpacing: "0.12em", textTransform: "uppercase",
          background: "rgba(184,245,90,0.08)", border: "1px solid rgba(184,245,90,0.2)",
          borderRadius: 5, padding: "3px 8px"
        }}>
          MISSÃO {currentYear}
        </span>
      </div>

      <div style={{ maxWidth: 680, margin: "0 auto", padding: "28px 16px 60px" }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: "64px 0", color: "rgba(255,255,255,0.25)", fontSize: 13, fontFamily: "var(--font-mono)" }}>
            Carregando...
          </div>
        ) : (
          <>
            {/* Hero stats */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10, marginBottom: 28 }}>
              <HeroCard label="Entradas no ano" value={formatCurrency(totalIncome)} color={G} />
              <HeroCard label="Saídas no ano" value={formatCurrency(totalExpense)} color={RED} />
              <HeroCard
                label="Saldo projetado"
                value={formatCurrency(endBalance)}
                color={endBalance >= 0 ? G : RED}
                highlight
              />
              <HeroCard
                label="Meses positivos"
                value={`${positiveMonths} de 12`}
                color={positiveMonths >= 9 ? G : positiveMonths >= 6 ? "#facc15" : RED}
              />
            </div>

            {recurringItems.length === 0 && (
              <div style={{
                background: "rgba(250,204,21,0.05)", border: "1px solid rgba(250,204,21,0.14)",
                borderRadius: 10, padding: "11px 15px", marginBottom: 22,
                fontSize: 12, color: "rgba(250,204,21,0.75)", lineHeight: 1.6,
                fontFamily: "var(--font-ui)"
              }}>
                Sem recorrências cadastradas — meses futuros aparecem zerados. Adicione receitas e despesas fixas no Plano do Mês para ver a projeção completa.
              </div>
            )}

            {/* Month list */}
            <div style={{ display: "grid", gap: 7, animation: "fadeUp .4s ease both" }}>
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
      background: highlight ? "rgba(184,245,90,0.04)" : "#111111",
      border: `1px solid ${highlight ? "rgba(184,245,90,0.30)" : "rgba(255,255,255,0.07)"}`,
      borderRadius: 12, padding: "16px 18px"
    }}>
      <p style={{
        fontFamily: "var(--font-ui)", fontSize: 10, color: "rgba(255,255,255,0.35)",
        textTransform: "uppercase", letterSpacing: "0.11em", fontWeight: 700, marginBottom: 8
      }}>
        {label}
      </p>
      <p style={{ fontFamily: "var(--font-mono)", fontSize: 19, fontWeight: 500, color, letterSpacing: "-0.02em" }}>
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
  const statusColor = m.isCurrent ? "#facc15" : m.isPast ? "rgba(255,255,255,0.3)" : "rgba(184,245,90,0.45)";

  return (
    <div
      className="proj-month-card"
      style={{
        background: m.isCurrent ? "rgba(184,245,90,0.08)" : "#111111",
        border: `1px solid ${m.isCurrent ? "rgba(184,245,90,0.30)" : "rgba(255,255,255,0.07)"}`,
        borderRadius: 12,
        padding: "14px 16px",
        opacity: isEmpty ? 0.45 : 1,
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
        {/* Month label */}
        <div style={{ flexShrink: 0, width: 44 }}>
          <p style={{
            fontFamily: "var(--font-display)", fontSize: 14,
            color: m.isCurrent ? G : m.isPast ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.38)",
            marginBottom: 4
          }}>
            {m.shortLabel}
          </p>
          <span style={{
            fontFamily: "var(--font-mono)", fontSize: 9, color: statusColor,
            letterSpacing: "0.04em", display: "block"
          }}>
            {statusLabel}
          </span>
        </div>

        {/* Bars */}
        <div style={{ flex: 1, minWidth: 0, display: "grid", gap: 7 }}>
          {/* Income */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
              <span style={{ fontFamily: "var(--font-ui)", fontSize: 10, color: "rgba(255,255,255,0.28)", fontWeight: 600 }}>Entradas</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: G, fontWeight: 500 }}>{formatCurrency(m.income)}</span>
            </div>
            <div style={{ height: 5, background: "rgba(255,255,255,0.06)", borderRadius: 3, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${incomeW}%`, background: G, borderRadius: 3, opacity: m.isFuture ? 0.5 : 1, transition: "width .5s ease" }} />
            </div>
          </div>
          {/* Expense */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
              <span style={{ fontFamily: "var(--font-ui)", fontSize: 10, color: "rgba(255,255,255,0.28)", fontWeight: 600 }}>Saídas</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: RED, fontWeight: 500 }}>{formatCurrency(m.expense)}</span>
            </div>
            <div style={{ height: 5, background: "rgba(255,255,255,0.06)", borderRadius: 3, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${expenseW}%`, background: RED, borderRadius: 3, opacity: m.isFuture ? 0.5 : 1, transition: "width .5s ease" }} />
            </div>
          </div>
        </div>

        {/* Delta + accumulated */}
        <div style={{ flexShrink: 0, textAlign: "right", minWidth: 86 }}>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 500, color: isPositive ? G : RED, letterSpacing: "-0.02em", marginBottom: 4 }}>
            {isPositive ? "+" : "−"}{formatCurrency(Math.abs(m.balance))}
          </p>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "rgba(255,255,255,0.25)", letterSpacing: "-0.01em" }}>
            {formatCurrency(m.accumulated)}
          </p>
          <p style={{ fontFamily: "var(--font-ui)", fontSize: 9, color: "rgba(255,255,255,0.2)", marginTop: 1 }}>acum.</p>
        </div>
      </div>
    </div>
  );
}
