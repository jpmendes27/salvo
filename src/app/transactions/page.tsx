"use client";

import { type User } from "firebase/auth";
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  where,
  writeBatch,
} from "firebase/firestore";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAuthUser } from "@/app/auth-provider";
import { db } from "@/lib/firebase";
import { formatCurrency, monthLabel } from "@/lib/money";
import { TxRow } from "@/components/TxRow";
import type { RecurringItem, Transaction } from "@/lib/types";

const G = "#b8f55a";

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
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [recurringItems, setRecurringItems] = useState<RecurringItem[]>([]);

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

  useEffect(() => {
    return onSnapshot(
      collection(db, "workspaces", workspaceId, "recurringItems"),
      (snap) => setRecurringItems(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as RecurringItem))
    );
  }, [workspaceId]);

  // Card purchases (source='card') are a SEPARATE lens (/cards): they never
  // appear in the account transaction list nor in its totals.
  const accountTx = useMemo(() => transactions.filter((t) => t.source !== "card"), [transactions]);

  const sources = useMemo(() => {
    const labels = [...new Set(accountTx.map((t) => t.sourceLabel).filter(Boolean))] as string[];
    return labels.sort();
  }, [accountTx]);

  const parceladaMap = useMemo(() => {
    const map = new Map<string, RecurringItem>();
    for (const r of recurringItems) {
      if (r.recorrencia?.tipo === "parcelada" && r.recorrencia.mesInicio && r.recorrencia.totalMeses) {
        map.set(r.title.toLowerCase().trim(), r);
      }
    }
    return map;
  }, [recurringItems]);

  const filtered = accountTx.filter((t) => {
    const typeOk = txFilter === "all" || t.type === txFilter;
    const srcOk = sourceFilter === "all" || t.sourceLabel === sourceFilter;
    return typeOk && srcOk;
  });

  const income = accountTx.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const expense = accountTx.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);

  function toggleSelectMode() {
    setSelectMode((v) => !v);
    setSelected(new Set());
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function selectAll() {
    setSelected(new Set(filtered.map((t) => t.id)));
  }

  function clearSelection() {
    setSelected(new Set());
  }

  async function deleteSelected() {
    if (selected.size === 0) return;
    const batch = writeBatch(db);
    selected.forEach((id) => {
      batch.delete(doc(db, "workspaces", workspaceId, "transactions", id));
    });
    await batch.commit();
    setSelected(new Set());
    setSelectMode(false);
  }

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
        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
          {!selectMode && (["all", "income", "expense"] as const).map((f) => (
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

          {!selectMode && sources.length > 1 && (
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

          <div style={{ marginLeft: "auto" }}>
            <button
              onClick={toggleSelectMode}
              style={{
                fontSize: 12, fontWeight: 600, padding: "5px 12px", borderRadius: 999,
                border: `1px solid ${selectMode ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.08)"}`,
                background: selectMode ? "rgba(255,255,255,0.10)" : "transparent",
                color: selectMode ? "#fff" : "rgba(255,255,255,0.38)",
                cursor: "pointer"
              }}
            >
              {selectMode ? "Cancelar" : "Selecionar"}
            </button>
          </div>
        </div>

        {/* Bulk action bar */}
        {selectMode && (
          <div style={{
            display: "flex", alignItems: "center", gap: 8, marginBottom: 12,
            padding: "8px 12px", borderRadius: 10,
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.07)"
          }}>
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", flex: 1 }}>
              {selected.size === 0 ? "Nenhuma selecionada" : `${selected.size} selecionada${selected.size !== 1 ? "s" : ""}`}
            </span>
            {selected.size < filtered.length ? (
              <button
                onClick={selectAll}
                style={{
                  fontSize: 12, fontWeight: 600, padding: "4px 10px", borderRadius: 999,
                  border: "1px solid rgba(255,255,255,0.12)", background: "transparent",
                  color: "rgba(255,255,255,0.5)", cursor: "pointer"
                }}
              >
                Selecionar todas
              </button>
            ) : (
              <button
                onClick={clearSelection}
                style={{
                  fontSize: 12, fontWeight: 600, padding: "4px 10px", borderRadius: 999,
                  border: "1px solid rgba(255,255,255,0.12)", background: "transparent",
                  color: "rgba(255,255,255,0.5)", cursor: "pointer"
                }}
              >
                Limpar seleção
              </button>
            )}
            <button
              onClick={deleteSelected}
              disabled={selected.size === 0}
              style={{
                fontSize: 12, fontWeight: 700, padding: "4px 12px", borderRadius: 999,
                border: "1px solid rgba(255,80,80,0.35)",
                background: selected.size > 0 ? "rgba(255,80,80,0.15)" : "transparent",
                color: selected.size > 0 ? "#ff8080" : "rgba(255,80,80,0.3)",
                cursor: selected.size > 0 ? "pointer" : "default",
                transition: "all .15s"
              }}
            >
              Excluir {selected.size > 0 ? `(${selected.size})` : ""}
            </button>
          </div>
        )}

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
                workspaceId={workspaceId}
                onDelete={() => deleteDoc(doc(db, "workspaces", workspaceId, "transactions", tx.id))}
                selectMode={selectMode}
                isSelected={selected.has(tx.id)}
                onToggleSelect={() => toggleSelect(tx.id)}
                parceladaMap={parceladaMap}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
