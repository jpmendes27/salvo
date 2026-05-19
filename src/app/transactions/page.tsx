"use client";

import { type User } from "firebase/auth";
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  where
} from "firebase/firestore";
import { ArrowLeft, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAuthUser } from "@/app/auth-provider";
import { db } from "@/lib/firebase";
import { formatCurrency, monthLabel } from "@/lib/money";
import { CATEGORY_COLORS } from "@/lib/parsers";
import type { Transaction } from "@/lib/types";

const G = "#b8f55a";

function categoryColor(cat: string): string {
  return (CATEGORY_COLORS as Record<string, string>)[cat] ?? "#888";
}

export default function TransactionsPage() {
  return (
    <Suspense fallback={<Shell text="Carregando..." />}>
      <TransactionsFlow />
    </Suspense>
  );
}

function Shell({ text }: { text: string }) {
  return (
    <div style={{
      minHeight: "100vh", background: "#09090b",
      display: "flex", alignItems: "center", justifyContent: "center",
      color: "rgba(255,255,255,0.4)", fontSize: 14
    }}>
      {text}
    </div>
  );
}

function TransactionsFlow() {
  const params = useSearchParams();
  const monthKey = params.get("month") || new Date().toISOString().slice(0, 7);
  const { user, authLoading } = useAuthUser();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !user) router.replace("/");
  }, [authLoading, user, router]);

  if (authLoading) return <Shell text="Carregando..." />;
  if (!user) return null;

  const workspaceId = typeof window !== "undefined"
    ? localStorage.getItem("fincheck_workspace") ?? ""
    : "";

  if (!workspaceId) { router.replace("/"); return null; }

  return <TransactionList user={user} workspaceId={workspaceId} monthKey={monthKey} />;
}

function TransactionList({
  user,
  workspaceId,
  monthKey
}: {
  user: User;
  workspaceId: string;
  monthKey: string;
}) {
  const router = useRouter();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [txFilter, setTxFilter] = useState<"all" | "income" | "expense">("all");
  const [sourceFilter, setSourceFilter] = useState("all");

  useEffect(() => {
    setLoading(true);
    const q = query(
      collection(db, "workspaces", workspaceId, "transactions"),
      where("monthKey", "==", monthKey),
      orderBy("date", "desc")
    );
    return onSnapshot(q, (snap) => {
      setTransactions(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Transaction));
      setLoading(false);
    });
  }, [workspaceId, monthKey]);

  const sources = useMemo(() => {
    const labels = [...new Set(transactions.map((t) => t.sourceLabel).filter(Boolean))] as string[];
    return labels.sort();
  }, [transactions]);

  const filtered = transactions.filter((t) => {
    const typeOk = txFilter === "all" || t.type === txFilter;
    const srcOk = sourceFilter === "all" || t.sourceLabel === sourceFilter;
    return typeOk && srcOk;
  });

  const income = transactions.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const expense = transactions.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);

  return (
    <div style={{ minHeight: "100vh", background: "#09090b", color: "#fff", fontFamily: "var(--font-dm-sans, sans-serif)" }}>
      {/* Header */}
      <div style={{
        position: "sticky", top: 0, zIndex: 10,
        background: "rgba(9,9,11,0.92)", backdropFilter: "blur(16px)",
        borderBottom: "1px solid rgba(255,255,255,0.07)",
        padding: "14px 24px",
        display: "flex", alignItems: "center", gap: 16
      }}>
        <button
          onClick={() => router.push("/home")}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            background: "transparent", border: "none",
            color: "rgba(255,255,255,0.5)", cursor: "pointer",
            fontSize: 13, fontWeight: 600, padding: 0
          }}
        >
          <ArrowLeft size={16} /> Voltar
        </button>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 15, fontWeight: 800 }}>
            Lançamentos — {monthLabel(monthKey)}
          </h1>
        </div>
        <div style={{ display: "flex", gap: 20, fontSize: 12.5 }}>
          <span style={{ color: G }}>+{formatCurrency(income)}</span>
          <span style={{ color: "#ff8080" }}>−{formatCurrency(expense)}</span>
        </div>
      </div>

      <div style={{ maxWidth: 760, margin: "0 auto", padding: "24px 20px" }}>
        {/* Filters */}
        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
          {(["all", "income", "expense"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setTxFilter(f)}
              style={{
                fontSize: 12, fontWeight: 600, padding: "5px 12px", borderRadius: 999,
                border: `1px solid ${txFilter === f ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.08)"}`,
                background: txFilter === f ? "rgba(255,255,255,0.10)" : "transparent",
                color: txFilter === f ? "#fff" : "rgba(255,255,255,0.38)",
                cursor: "pointer"
              }}
            >
              {f === "all" ? "Todas" : f === "income" ? "Entradas" : "Saídas"}
            </button>
          ))}

          {sources.length > 1 && (
            <>
              <div style={{ width: 1, background: "rgba(255,255,255,0.1)", margin: "0 4px" }} />
              {(["all", ...sources] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setSourceFilter(s)}
                  style={{
                    fontSize: 12, fontWeight: 600, padding: "5px 12px", borderRadius: 999,
                    border: `1px solid ${sourceFilter === s ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.08)"}`,
                    background: sourceFilter === s ? "rgba(255,255,255,0.10)" : "transparent",
                    color: sourceFilter === s ? "#fff" : "rgba(255,255,255,0.38)",
                    cursor: "pointer"
                  }}
                >
                  {s === "all" ? "Tudo" : s}
                </button>
              ))}
            </>
          )}
        </div>

        {/* Count */}
        <p style={{ fontSize: 12, color: "rgba(255,255,255,0.28)", marginBottom: 12 }}>
          {filtered.length} lançamento{filtered.length !== 1 ? "s" : ""}
        </p>

        {/* List */}
        {loading ? (
          <div style={{ textAlign: "center", padding: "48px 0", color: "rgba(255,255,255,0.28)", fontSize: 13 }}>
            Carregando...
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "48px 0", color: "rgba(255,255,255,0.24)", fontSize: 13 }}>
            Nenhum lançamento.
          </div>
        ) : (
          <div style={{ display: "grid", gap: 2 }}>
            {filtered.map((tx) => (
              <TxRow
                key={tx.id}
                tx={tx}
                onDelete={() => deleteDoc(doc(db, "workspaces", workspaceId, "transactions", tx.id))}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TxRow({ tx, onDelete }: { tx: Transaction; onDelete: () => void }) {
  const [hov, setHov] = useState(false);
  const isIncome = tx.type === "income";
  const parts = tx.date.split("-");
  const dateLabel = parts.length === 3 ? `${parts[2]}/${parts[1]}` : tx.date;

  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: "grid",
        gridTemplateColumns: "8px 1fr auto auto",
        gap: "0 14px",
        alignItems: "center",
        padding: "11px 12px",
        borderRadius: 10,
        background: hov ? "rgba(255,255,255,0.04)" : "transparent",
        transition: "background .15s"
      }}
    >
      <div style={{
        width: 8, height: 8, borderRadius: "50%",
        background: categoryColor(tx.category),
        boxShadow: `0 0 8px ${categoryColor(tx.category)}66`,
        flexShrink: 0
      }} />
      <div style={{ minWidth: 0 }}>
        <p style={{
          fontSize: 13.5, fontWeight: 600, color: "#e8e9ec",
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis"
        }}>
          {tx.description}
        </p>
        <p style={{ fontSize: 11.5, color: "rgba(255,255,255,0.32)", marginTop: 1 }}>
          {tx.category} · {dateLabel}
          {tx.sourceLabel ? ` · ${tx.sourceLabel}` : ""}
        </p>
      </div>
      <span style={{
        fontSize: 14, fontWeight: 800, letterSpacing: "-0.02em",
        color: isIncome ? G : "#ff8080", whiteSpace: "nowrap"
      }}>
        {isIncome ? "+" : "−"}{formatCurrency(tx.amount)}
      </span>
      <button
        onClick={onDelete}
        style={{
          opacity: hov ? 1 : 0,
          background: "transparent", border: "none", cursor: "pointer",
          color: "rgba(255,80,80,0.65)", padding: 4, borderRadius: 6,
          display: "flex", alignItems: "center",
          transition: "opacity .15s"
        }}
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}
