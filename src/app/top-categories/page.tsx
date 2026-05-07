"use client";

import { onAuthStateChanged, type User } from "firebase/auth";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { ArrowLeft } from "lucide-react";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { formatCurrency, monthLabel } from "@/lib/money";
import { CATEGORY_COLORS } from "@/lib/parsers";
import type { Transaction } from "@/lib/types";

const G = "#b8f55a";

function Shell({ text }: { text: string }) {
  return (
    <div style={{ minHeight: "100vh", background: "#09090b", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.4)", fontSize: 14 }}>
      {text}
    </div>
  );
}

export default function TopCategoriesPage() {
  return (
    <Suspense fallback={<Shell text="Carregando..." />}>
      <TopCategoriesFlow />
    </Suspense>
  );
}

function TopCategoriesFlow() {
  const params = useSearchParams();
  const monthKey = params.get("month") || new Date().toISOString().slice(0, 7);
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => { setUser(u); setReady(true); });
  }, []);

  if (!ready) return <Shell text="Carregando..." />;
  if (!user || !user.emailVerified) { window.location.href = "/"; return null; }

  const workspaceId = typeof window !== "undefined" ? localStorage.getItem("fincheck_workspace") ?? "" : "";
  if (!workspaceId) { window.location.href = "/"; return null; }

  return <CategoryRanking workspaceId={workspaceId} monthKey={monthKey} />;
}

function CategoryRanking({ workspaceId, monthKey }: { workspaceId: string; monthKey: string }) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [prevTransactions, setPrevTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  const prevMonthKey = useMemo(() => {
    const [y, m] = monthKey.split("-").map(Number);
    return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
  }, [monthKey]);

  useEffect(() => {
    setLoading(true);
    const q = query(collection(db, "workspaces", workspaceId, "transactions"), where("monthKey", "==", monthKey));
    return onSnapshot(q, (snap) => {
      setTransactions(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Transaction));
      setLoading(false);
    });
  }, [workspaceId, monthKey]);

  useEffect(() => {
    const q = query(collection(db, "workspaces", workspaceId, "transactions"), where("monthKey", "==", prevMonthKey));
    return onSnapshot(q, (snap) => {
      setPrevTransactions(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Transaction));
    });
  }, [workspaceId, prevMonthKey]);

  const expenses = transactions.filter((t) => t.type === "expense");
  const totalGasto = expenses.reduce((s, t) => s + t.amount, 0);

  const byCategory = useMemo(() => {
    const m: Record<string, number> = {};
    for (const tx of expenses) m[tx.category] = (m[tx.category] ?? 0) + tx.amount;
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [expenses]);

  const prevByCategory = useMemo(() => {
    const m: Record<string, number> = {};
    for (const tx of prevTransactions.filter((t) => t.type === "expense"))
      m[tx.category] = (m[tx.category] ?? 0) + tx.amount;
    return m;
  }, [prevTransactions]);

  const maxCat = byCategory[0]?.[1] ?? 1;

  return (
    <div style={{ minHeight: "100vh", background: "#09090b", color: "#fff", fontFamily: "var(--font-dm-sans, sans-serif)" }}>
      {/* Header */}
      <div style={{ position: "sticky", top: 0, zIndex: 10, background: "rgba(9,9,11,0.92)", backdropFilter: "blur(16px)", borderBottom: "1px solid rgba(255,255,255,0.07)", padding: "14px 24px", display: "flex", alignItems: "center", gap: 16 }}>
        <button onClick={() => window.history.back()} style={{ display: "flex", alignItems: "center", gap: 6, background: "transparent", border: "none", color: "rgba(255,255,255,0.5)", cursor: "pointer", fontSize: 13, fontWeight: 600, padding: 0 }}>
          <ArrowLeft size={16} /> Voltar
        </button>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 15, fontWeight: 800 }}>
            Categorias — {monthLabel(monthKey)}
          </h1>
        </div>
        <span style={{ fontSize: 12.5, color: "#ff8080", fontWeight: 700 }}>{formatCurrency(totalGasto)}</span>
      </div>

      <div style={{ maxWidth: 640, margin: "0 auto", padding: "24px 20px" }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: "48px 0", color: "rgba(255,255,255,0.28)", fontSize: 13 }}>Carregando...</div>
        ) : byCategory.length === 0 ? (
          <div style={{ textAlign: "center", padding: "48px 0", color: "rgba(255,255,255,0.24)", fontSize: 13 }}>Nenhum gasto em {monthLabel(monthKey)}.</div>
        ) : (
          <div style={{ display: "grid", gap: 2 }}>
            {byCategory.map(([cat, total], idx) => {
              const color = (CATEGORY_COLORS as Record<string, string>)[cat] ?? "#888";
              const pct = totalGasto > 0 ? Math.round((total / totalGasto) * 100) : 0;
              const prev = prevByCategory[cat] ?? 0;
              const changePct = prev > 0 ? ((total - prev) / prev) * 100 : null;
              const barW = Math.round((total / maxCat) * 100);
              const isTop = idx === 0;

              return (
                <div
                  key={cat}
                  style={{ padding: "14px 14px", borderRadius: 12, background: isTop ? "rgba(184,245,90,0.04)" : "transparent", border: isTop ? "1px solid rgba(184,245,90,0.1)" : "1px solid transparent", marginBottom: 4 }}
                >
                  {/* Header row */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 13, color: "rgba(255,255,255,0.28)", fontWeight: 700, width: 20 }}>#{idx + 1}</span>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: color, boxShadow: `0 0 8px ${color}88`, flexShrink: 0 }} />
                      <span style={{ fontSize: 14, fontWeight: 800, color: isTop ? G : "#e8e9ec" }}>{cat}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                      {changePct !== null && (
                        <span style={{ fontSize: 11.5, fontWeight: 700, color: changePct < 0 ? G : "#ff8080", background: changePct < 0 ? "rgba(184,245,90,0.1)" : "rgba(255,80,80,0.1)", padding: "2px 7px", borderRadius: 999 }}>
                          {changePct < 0 ? "▼" : "▲"} {Math.abs(changePct).toFixed(0)}%
                        </span>
                      )}
                      <div style={{ textAlign: "right" }}>
                        <p style={{ fontSize: 15, fontWeight: 800, color: isTop ? G : "#fff", letterSpacing: "-0.02em" }}>{formatCurrency(total)}</p>
                        <p style={{ fontSize: 10.5, color: "rgba(255,255,255,0.32)" }}>{pct}% do total</p>
                      </div>
                    </div>
                  </div>

                  {/* Bar */}
                  <div style={{ height: 5, borderRadius: 3, background: "rgba(255,255,255,0.07)", overflow: "hidden" }}>
                    <div style={{ height: "100%", borderRadius: 3, width: `${barW}%`, background: color, boxShadow: `0 0 10px ${color}66`, transition: "width .5s cubic-bezier(.4,0,.2,1)" }} />
                  </div>

                  {/* Prev month comparison */}
                  {prev > 0 && (
                    <p style={{ fontSize: 11, color: "rgba(255,255,255,0.28)", marginTop: 6 }}>
                      {monthLabel(prevMonthKey)}: {formatCurrency(prev)}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
