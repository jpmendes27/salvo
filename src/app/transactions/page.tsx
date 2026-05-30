"use client";

import { type User } from "firebase/auth";
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { ArrowLeft, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAuthUser } from "@/app/auth-provider";
import { db } from "@/lib/firebase";
import { formatCurrency, monthLabel } from "@/lib/money";
import { CATEGORY_COLORS, CATEGORY_LABELS } from "@/lib/parsers";
import type { RecurringItem, Transaction } from "@/lib/types";

const G = "#b8f55a";

function monthDiff(a: string, b: string): number {
  const [ay, am] = a.split("-").map(Number);
  const [by, bm] = b.split("-").map(Number);
  return (by - ay) * 12 + (bm - am);
}

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

  const sources = useMemo(() => {
    const labels = [...new Set(transactions.map((t) => t.sourceLabel).filter(Boolean))] as string[];
    return labels.sort();
  }, [transactions]);

  const parceladaMap = useMemo(() => {
    const map = new Map<string, RecurringItem>();
    for (const r of recurringItems) {
      if (r.recorrencia?.tipo === "parcelada" && r.recorrencia.mesInicio && r.recorrencia.totalMeses) {
        map.set(r.title.toLowerCase().trim(), r);
      }
    }
    return map;
  }, [recurringItems]);

  const filtered = transactions.filter((t) => {
    const typeOk = txFilter === "all" || t.type === txFilter;
    const srcOk = sourceFilter === "all" || t.sourceLabel === sourceFilter;
    return typeOk && srcOk;
  });

  const income = transactions.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const expense = transactions.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);

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

const ALL_CATEGORIES = Object.entries(CATEGORY_LABELS) as [string, string][];

function TxRow({ tx, workspaceId, onDelete, selectMode, isSelected, onToggleSelect, parceladaMap }: {
  tx: Transaction;
  workspaceId: string;
  onDelete: () => void;
  selectMode: boolean;
  isSelected: boolean;
  onToggleSelect: () => void;
  parceladaMap: Map<string, RecurringItem>;
}) {
  const [hov, setHov] = useState(false);
  const [editingCat, setEditingCat] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const isIncome = tx.type === "income";
  const parts = tx.date.split("-");
  const dateLabel = parts.length === 3 ? `${parts[2]}/${parts[1]}` : tx.date;

  const parcelaSuffix = (() => {
    const r = parceladaMap.get(tx.description.toLowerCase().trim());
    if (!r?.recorrencia?.mesInicio || !r.recorrencia.totalMeses) return null;
    const parcelaAtual = monthDiff(r.recorrencia.mesInicio, tx.monthKey) + 1;
    if (parcelaAtual < 1 || parcelaAtual > r.recorrencia.totalMeses) return null;
    return `(${parcelaAtual}/${r.recorrencia.totalMeses})`;
  })();

  useEffect(() => {
    if (!editingCat) return;
    function handleOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setEditingCat(false);
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [editingCat]);

  async function recategorize(newCat: string) {
    if (newCat === tx.category) { setEditingCat(false); return; }
    await updateDoc(doc(db, "workspaces", workspaceId, "transactions", tx.id), { category: newCat });
    setEditingCat(false);
  }

  return (
    <div
      ref={containerRef}
      onClick={selectMode ? onToggleSelect : undefined}
      style={{
        borderRadius: 10,
        background: isSelected ? "rgba(184,245,90,0.06)" : hov || editingCat ? "rgba(255,255,255,0.04)" : "transparent",
        transition: "background .15s",
        cursor: selectMode ? "pointer" : "default",
        outline: isSelected ? "1px solid rgba(184,245,90,0.18)" : "none",
      }}
    >
      <div
        onMouseEnter={() => setHov(true)}
        onMouseLeave={() => setHov(false)}
        style={{
          display: "grid",
          gridTemplateColumns: selectMode ? "20px 8px 1fr auto" : "8px 1fr auto auto",
          gap: "0 14px",
          alignItems: "center",
          padding: "11px 12px",
        }}
      >
        {selectMode && (
          <div style={{
            width: 16, height: 16, borderRadius: 4, flexShrink: 0,
            border: `2px solid ${isSelected ? G : "rgba(255,255,255,0.2)"}`,
            background: isSelected ? G : "transparent",
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "all .12s"
          }}>
            {isSelected && (
              <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                <path d="M1 4l3 3 5-6" stroke="#09090b" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
          </div>
        )}
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
            {tx.description}{parcelaSuffix ? ` ${parcelaSuffix}` : ""}
          </p>
          <p style={{ fontSize: 11.5, color: "rgba(255,255,255,0.32)", marginTop: 1 }}>
            <button
              onClick={(e) => { if (selectMode) return; e.stopPropagation(); setEditingCat((v) => !v); }}
              style={{
                background: "none", border: "none", padding: 0, cursor: "pointer",
                fontSize: 11.5, fontWeight: editingCat ? 700 : 400,
                color: editingCat ? G : "rgba(255,255,255,0.32)",
                textDecoration: hov && !editingCat ? "underline" : "none",
              }}
            >
              {CATEGORY_LABELS[tx.category as keyof typeof CATEGORY_LABELS] ?? tx.category}
            </button>
            {" · "}{dateLabel}{tx.sourceLabel ? ` · ${tx.sourceLabel}` : ""}
          </p>
        </div>
        <span style={{
          fontSize: 14, fontWeight: 800, letterSpacing: "-0.02em",
          color: isIncome ? G : "#ff8080", whiteSpace: "nowrap"
        }}>
          {isIncome ? "+" : "−"}{formatCurrency(tx.amount)}
        </span>
        {!selectMode && (
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            style={{
              opacity: hov || editingCat ? 1 : 0,
              background: "transparent", border: "none", cursor: "pointer",
              color: "rgba(255,80,80,0.65)", padding: 4, borderRadius: 6,
              display: "flex", alignItems: "center",
              transition: "opacity .15s"
            }}
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>

      {!selectMode && editingCat && (
        <div style={{ padding: "0 12px 12px", display: "flex", flexWrap: "wrap", gap: 6 }}>
          {ALL_CATEGORIES.map(([key, label]) => {
            const active = key === tx.category;
            return (
              <button
                key={key}
                onClick={() => recategorize(key)}
                style={{
                  fontSize: 11, fontWeight: 600, padding: "4px 10px", borderRadius: 999,
                  border: `1px solid ${active ? "rgba(255,255,255,0.28)" : "rgba(255,255,255,0.09)"}`,
                  background: active ? "rgba(255,255,255,0.11)" : "rgba(255,255,255,0.03)",
                  color: active ? "#fff" : "rgba(255,255,255,0.45)",
                  cursor: active ? "default" : "pointer",
                  display: "flex", alignItems: "center", gap: 5,
                }}
              >
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: categoryColor(key), flexShrink: 0 }} />
                {label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
