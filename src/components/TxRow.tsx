"use client";

// ─── Shared transaction row ──────────────────────────────────────────────────
// One transaction line with inline recategorization, used by BOTH /transactions
// (account) and /cards (card lens). Recategorize updates ONLY the category of
// the single doc — never the source. Reused verbatim so the two lists stay in
// parity; no parallel implementation.

import { getFunctions, httpsCallable } from "firebase/functions";
import { Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { app } from "@/lib/firebase";
import { formatCurrency } from "@/lib/money";
import { CATEGORY_COLORS, CATEGORY_LABELS } from "@/lib/parsers";
import type { RecurringItem, Transaction } from "@/lib/types";

const G = "#b8f55a";

function monthDiff(a: string, b: string): number {
  const [ay, am] = a.split("-").map(Number);
  const [by, bm] = b.split("-").map(Number);
  return (by - ay) * 12 + (bm - am);
}

export function categoryColor(cat: string): string {
  return (CATEGORY_COLORS as Record<string, string>)[cat] ?? "#888";
}

export const ALL_CATEGORIES = Object.entries(CATEGORY_LABELS) as [string, string][];

export function TxRow({
  tx,
  workspaceId,
  onDelete,
  selectMode,
  isSelected,
  onToggleSelect,
  parceladaMap,
  monoAmount = false,
}: {
  tx: Transaction;
  workspaceId: string;
  onDelete: () => void;
  selectMode: boolean;
  isSelected: boolean;
  onToggleSelect: () => void;
  parceladaMap: Map<string, RecurringItem>;
  // /cards renders amounts in DM Mono; /transactions keeps its existing font.
  monoAmount?: boolean;
}) {
  const [hov, setHov] = useState(false);
  const [editingCat, setEditingCat] = useState(false);
  const [applyAll, setApplyAll] = useState(false);
  const [saving, setSaving] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const isIncome = tx.type === "income";
  const parts = tx.date.split("-");
  const dateLabel = parts.length === 3 ? `${parts[2]}/${parts[1]}` : tx.date;

  const parcelaSuffix = (() => {
    // Card purchase: installment info travels on the transaction itself.
    if (tx.parcela && tx.parcela.total > 1) return `(${tx.parcela.atual}/${tx.parcela.total})`;
    // Account: derived from the linked parcelada recurring item.
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

  // Recategorize via the callable: it updates this transaction's category AND
  // the shared merchant cache (and, when applyAll is on, every transaction of
  // the same merchant). Never changes source.
  async function recategorize(newCat: string) {
    if (newCat === tx.category && !applyAll) { setEditingCat(false); return; }
    setSaving(true);
    try {
      const fn = httpsCallable(getFunctions(app, "us-central1"), "recategorize");
      await fn({ workspaceId, transactionId: tx.id, category: newCat, applyToAll: applyAll });
    } catch (e) {
      console.error("[recategorize] failed:", e);
    } finally {
      setSaving(false);
      setApplyAll(false);
      setEditingCat(false);
    }
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
          ...(monoAmount ? { fontFamily: "var(--font-dm-mono, ui-monospace, monospace)" } : {}),
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
        <div style={{ padding: "0 12px 12px" }}>
          {/* Apply-to-all: set intent BEFORE picking a category. */}
          <button
            onClick={() => setApplyAll((v) => !v)}
            disabled={saving}
            style={{
              display: "flex", alignItems: "center", gap: 7, marginBottom: 9,
              background: "none", border: "none", padding: 0, cursor: saving ? "default" : "pointer",
            }}
          >
            <span style={{
              width: 15, height: 15, borderRadius: 4, flexShrink: 0,
              border: `1.5px solid ${applyAll ? G : "rgba(255,255,255,0.25)"}`,
              background: applyAll ? G : "transparent",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              {applyAll && (
                <svg width="9" height="7" viewBox="0 0 10 8" fill="none">
                  <path d="M1 4l3 3 5-6" stroke="#09090b" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </span>
            <span style={{ fontSize: 11.5, color: applyAll ? "#fff" : "rgba(255,255,255,0.42)", fontWeight: 600 }}>
              Aplicar a todos desse estabelecimento
            </span>
          </button>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, opacity: saving ? 0.5 : 1, pointerEvents: saving ? "none" : "auto" }}>
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
                    cursor: active && !applyAll ? "default" : "pointer",
                    display: "flex", alignItems: "center", gap: 5,
                  }}
                >
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: categoryColor(key), flexShrink: 0 }} />
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
