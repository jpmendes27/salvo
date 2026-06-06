"use client";

// ─── /cards — credit-card lens (behind the cardsEnabled flag) ────────────────
// Cards, current fatura, limit bar, purchases by category, parcelamentos, and
// previous faturas. A separate lens from cash flow: card data only, never mixed
// into the account diagnosis. Follows the Salvô! design system.

import { deleteDoc, doc, getDoc, writeBatch } from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { ArrowLeft, CreditCard, ChevronRight, ChevronLeft, Search, Sparkles } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useAuthUser } from "@/app/auth-provider";
import { CategoryAvatar } from "@/components/CategoryAvatar";
import { TxRow } from "@/components/TxRow";
import { app, db } from "@/lib/firebase";
import { useCardData, currentFatura, limitInfo, cardToneLine } from "@/lib/cards";
import { detectBank } from "@/lib/banks";
import { isCardsEnabled } from "@/lib/flags";
import { colors, radius, typography } from "@/lib/design-system";
import { currentMonthKey, formatCurrency, monthLabel } from "@/lib/money";
import { CATEGORY_LABELS } from "@/lib/parsers";
import type { Card, Fatura, RecurringItem, Transaction } from "@/lib/types";

const EMPTY_PARCELADA = new Map<string, RecurringItem>();

function Shell({ text }: { text: string }) {
  return (
    <div style={{ minHeight: "100vh", background: colors.bg, display: "flex", alignItems: "center", justifyContent: "center", color: colors.textSecondary, fontSize: 14, fontFamily: typography.fontUI }}>
      {text}
    </div>
  );
}

const catLabel = (c: string) => (CATEGORY_LABELS as Record<string, string>)[c] ?? c;

export default function CardsPage() {
  return (
    <Suspense fallback={<Shell text="Carregando..." />}>
      <CardsFlow />
    </Suspense>
  );
}

function CardsFlow() {
  const { user, authLoading } = useAuthUser();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !user) router.replace("/");
  }, [authLoading, user, router]);

  if (authLoading) return <Shell text="Carregando..." />;
  if (!user) return null;
  if (!isCardsEnabled(user)) { router.replace("/home"); return null; }

  const workspaceId = typeof window !== "undefined" ? localStorage.getItem("fincheck_workspace") ?? "" : "";
  if (!workspaceId) { router.replace("/home"); return null; }

  return <CardsView workspaceId={workspaceId} />;
}

function CardsView({ workspaceId }: { workspaceId: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const { cards, faturas, cardTx, loading } = useCardData(workspaceId);
  // One-shot hint from the home grouped view: open on the tapped card.
  const [selectedId, setSelectedId] = useState<string | null>(
    () => (typeof window !== "undefined" ? localStorage.getItem("fincheck_card") : null)
  );
  useEffect(() => { localStorage.removeItem("fincheck_card"); }, []);

  // Selected statement period (faturaPeriod) from the URL — NOT a calendar month.
  // Scopes the whole view. Navigation updates ?mes, mirroring /transactions.
  const mes = params.get("mes");
  const setMes = (p: string) => {
    const q = new URLSearchParams(params.toString());
    q.set("mes", p);
    router.replace(`/cards?${q.toString()}`);
  };

  // Default selection: the card with the most recent fatura.
  const ordered = useMemo(() => {
    return [...cards].sort((a, b) => {
      const fa = currentFatura(faturas, a.id)?.period ?? "";
      const fb = currentFatura(faturas, b.id)?.period ?? "";
      return fb.localeCompare(fa);
    });
  }, [cards, faturas]);

  // Active tab: "all" (aggregated) or a card id. Default "all" with >1 card;
  // a one-shot hint or a single card collapses to that card.
  const tab: string | null = selectedId ?? (ordered.length > 1 ? "all" : ordered[0]?.id ?? null);

  if (loading) return <Shell text="Carregando..." />;

  return (
    <div style={{ minHeight: "100vh", background: colors.bg, color: colors.textPrimary, fontFamily: typography.fontUI }}>
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "20px 16px 60px" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 22 }}>
          <button onClick={() => router.push("/home")} style={{ background: "transparent", border: "none", color: colors.textPrimary, cursor: "pointer", padding: 4, display: "flex" }}>
            <ArrowLeft size={20} />
          </button>
          <h1 style={{ fontSize: 18, fontWeight: 800, letterSpacing: "-0.02em" }}>Cartões</h1>
        </div>

        {cards.length === 0 ? (
          <div style={{ ...cardBox(), textAlign: "center", padding: "40px 22px" }}>
            <CreditCard size={28} color={colors.textFaint} style={{ marginBottom: 12 }} />
            <p style={{ fontSize: 14, color: colors.textSecondary, lineHeight: 1.5 }}>
              Nenhum cartão ainda. Importe uma fatura na home pra acompanhar aqui.
            </p>
          </div>
        ) : (
          <>
            {/* Tabs: [Todos] + one per card (only with >1 card) */}
            {ordered.length > 1 && (
              <div style={{ display: "flex", gap: 8, overflowX: "auto", marginBottom: 16, paddingBottom: 4 }}>
                {[{ id: "all", label: "Todos" }, ...ordered.map((c) => ({ id: c.id, label: `${c.name || c.bank}${c.last4 ? ` ••${c.last4}` : ""}` }))].map((t) => {
                  const active = t.id === tab;
                  return (
                    <button
                      key={t.id}
                      onClick={() => setSelectedId(t.id)}
                      style={{
                        flexShrink: 0,
                        background: active ? colors.accentMuted : colors.card,
                        border: `1px solid ${active ? colors.borderAccent : colors.border}`,
                        borderRadius: radius.pill,
                        padding: "8px 14px",
                        color: active ? colors.accent : colors.textSecondary,
                        fontSize: 12.5,
                        fontWeight: 700,
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {t.label}
                    </button>
                  );
                })}
              </div>
            )}

            {tab === "all" ? (
              <AllCardsView workspaceId={workspaceId} cards={ordered} faturas={faturas} cardTx={cardTx} mes={mes} setMes={setMes} />
            ) : (
              (() => {
                const c = ordered.find((x) => x.id === tab) ?? ordered[0];
                return c ? <CardDetail workspaceId={workspaceId} card={c} faturas={faturas} cardTx={cardTx} mes={mes} setMes={setMes} /> : null;
              })()
            )}
          </>
        )}
      </div>
    </div>
  );
}

// Period navigator (statement period = competência, NOT a calendar month).
// Mirrors the /transactions month nav, but over the fatura periods that exist.
function PeriodNav({ periods, current, onChange }: { periods: string[]; current: string | null; onChange: (p: string) => void }) {
  if (!current) return null;
  const idx = periods.indexOf(current);
  const older = idx >= 0 && idx < periods.length - 1 ? periods[idx + 1] : null;
  const newer = idx > 0 ? periods[idx - 1] : null;
  const label = monthLabel(current).replace(/^./, (c) => c.toUpperCase());
  const navBtn = (enabled: boolean): React.CSSProperties => ({
    background: "transparent", border: "none", padding: 4, display: "flex",
    color: enabled ? colors.textPrimary : colors.textFaint,
    cursor: enabled ? "pointer" : "default", opacity: enabled ? 1 : 0.4,
  });
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 18, padding: "9px 14px", borderRadius: 12, background: colors.card, border: `1px solid ${colors.border}` }}>
      <button disabled={!older} onClick={() => older && onChange(older)} style={navBtn(!!older)} aria-label="Fatura anterior"><ChevronLeft size={18} /></button>
      <span style={{ fontSize: 13.5, fontWeight: 700, minWidth: 130, textAlign: "center" }}>{label}</span>
      <button disabled={!newer} onClick={() => newer && onChange(newer)} style={navBtn(!!newer)} aria-label="Próxima fatura"><ChevronRight size={18} /></button>
    </div>
  );
}

function CardDetail({ workspaceId, card, faturas, cardTx, mes, setMes }: { workspaceId: string; card: Card; faturas: Fatura[]; cardTx: Transaction[]; mes: string | null; setMes: (p: string) => void }) {
  const lim = limitInfo(card);
  const bank = detectBank(card.bank || card.name);

  // This card's faturas, newest first. The selected period comes from ?mes,
  // defaulting to the most recent; prevFatura is the one immediately older.
  const cardFaturas = useMemo(
    () => faturas.filter((f) => f.cardId === card.id).sort((a, b) => b.period.localeCompare(a.period)),
    [faturas, card.id]
  );
  const periods = useMemo(() => cardFaturas.map((f) => f.period), [cardFaturas]);
  const idx = (() => { const i = mes ? periods.indexOf(mes) : -1; return i >= 0 ? i : 0; })();
  const fatura = cardFaturas[idx] ?? null;
  const prevFatura = cardFaturas[idx + 1] ?? null;

  // Purchases of the SELECTED fatura period for this card.
  const periodTx = useMemo(
    () => cardTx
      .filter((t) => t.cardId === card.id && (!fatura || t.faturaPeriod === fatura.period))
      .sort((a, b) => b.date.localeCompare(a.date)),
    [cardTx, card.id, fatura]
  );

  const byCategory = useMemo(() => aggregateByCategory(periodTx), [periodTx]);
  const totalCompras = byCategory.reduce((s, [, v]) => s + v, 0);

  const parcelamentos = useMemo(
    () => periodTx.filter((t) => t.parcela && t.parcela.total > 1),
    [periodTx]
  );

  // Other faturas (this card), newest first, excluding the selected one.
  const historico = useMemo(
    () => cardFaturas.filter((f) => !fatura || f.period !== fatura.period),
    [cardFaturas, fatura]
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {periods.length > 1 && <PeriodNav periods={periods} current={fatura?.period ?? null} onChange={setMes} />}

      {/* Diagnóstico do cartão (lente separada — cache Firestore, IA só quando muda) */}
      {fatura && (
        <CardDiagnosis
          workspaceId={workspaceId}
          card={card}
          fatura={fatura}
          prevFatura={prevFatura}
          byCategory={byCategory}
          totalCompras={totalCompras}
          lim={lim}
        />
      )}

      {/* Hero: card + current fatura + limit */}
      <div style={{ ...cardBox(), background: `linear-gradient(135deg, ${colors.accentMuted}, rgba(184,245,90,0.02))`, border: `1px solid ${colors.borderAccent}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <div style={{ width: 36, height: 36, borderRadius: 11, background: bank.color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <CreditCard size={19} color={bank.glyph} strokeWidth={2} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 800 }}>{card.name || card.bank}</div>
            <div style={{ fontSize: 11.5, color: colors.textMuted }}>
              {card.last4 ? `•••• ${card.last4}` : card.bank}
              {card.dueDay ? ` · vence dia ${card.dueDay}` : ""}
            </div>
          </div>
        </div>

        {fatura && (
          <div style={{ marginBottom: lim.pct != null ? 16 : 0 }}>
            <div style={typography.labelSmall}>Fatura {monthLabel(fatura.period)}</div>
            <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: "-0.03em", marginTop: 2 }}>
              {formatCurrency(fatura.totalAPagar)}
            </div>
          </div>
        )}

        {lim.pct != null && (
          <div>
            <div style={{ height: 7, borderRadius: 999, background: "rgba(255,255,255,0.10)", overflow: "hidden", marginBottom: 8 }}>
              <div style={{ width: `${lim.pct}%`, height: "100%", borderRadius: 999, background: lim.pct >= 90 ? colors.negative : colors.accent, transition: "width 0.3s ease" }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5 }}>
              <span style={{ color: colors.textSecondary }}>
                {lim.usado != null ? formatCurrency(lim.usado) : "—"} usado
              </span>
              <span style={{ color: colors.textSecondary }}>
                {lim.disponivel != null ? formatCurrency(lim.disponivel) : "—"} disponível
              </span>
            </div>
          </div>
        )}

        <div style={{ fontSize: 12.5, color: colors.textPrimary, opacity: 0.85, lineHeight: 1.45, marginTop: 14 }}>
          {cardToneLine(card, fatura)}
        </div>
      </div>

      {/* Compras por categoria + Transações — componentes reusados na aba "Todos" */}
      <CategoryBreakdown byCategory={byCategory} total={totalCompras} />
      <CardTxList workspaceId={workspaceId} txs={periodTx} byCategory={byCategory} />

      {/* Parcelamentos */}
      {parcelamentos.length > 0 && (
        <div style={cardBox()}>
          <div style={{ ...typography.labelSmall, marginBottom: 14 }}>Parcelamentos</div>
          <div style={{ display: "grid", gap: 12 }}>
            {parcelamentos.map((t) => (
              <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 11 }}>
                <CategoryAvatar categoria={t.category} size={30} radius={9} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: colors.textPrimary, opacity: 0.85, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.description}</div>
                  <div style={{ fontSize: 11, color: colors.accent, fontWeight: 700 }}>
                    parcela {t.parcela!.atual}/{t.parcela!.total}
                  </div>
                </div>
                <span style={{ fontSize: 14, fontWeight: 800, letterSpacing: "-0.02em", color: "#ff8080" }}>−{formatCurrency(t.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Faturas anteriores */}
      {historico.length > 0 && (
        <div style={cardBox()}>
          <div style={{ ...typography.labelSmall, marginBottom: 14 }}>Faturas anteriores</div>
          <div style={{ display: "grid", gap: 4 }}>
            {historico.map((f) => (
              <div key={f.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: `1px solid ${colors.border}` }}>
                <span style={{ flex: 1, fontSize: 13, color: colors.textSecondary, fontWeight: 600 }}>{monthLabel(f.period)}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: colors.textPrimary, opacity: 0.82 }}>{formatCurrency(f.totalAPagar)}</span>
                <ChevronRight size={15} color={colors.textFaint} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

type CardDiag = { headline: string | null; insights: string[] };

// code → "Label". Aggregate a list of card transactions into [code, total] desc.
function aggregateByCategory(txs: Transaction[]): [string, number][] {
  const m: Record<string, number> = {};
  for (const t of txs) m[t.category] = (m[t.category] ?? 0) + t.amount;
  return Object.entries(m).sort((a, b) => b[1] - a[1]);
}

// ─── Reused sections (single card AND aggregated "Todos") ────────────────────

function CategoryBreakdown({ byCategory, total }: { byCategory: [string, number][]; total: number }) {
  if (byCategory.length === 0) return null;
  return (
    <div style={cardBox()}>
      <div style={{ ...typography.labelSmall, marginBottom: 14 }}>Compras por categoria</div>
      <div style={{ display: "grid", gap: 12 }}>
        {byCategory.map(([cat, val]) => {
          const pct = total > 0 ? Math.round((val / total) * 100) : 0;
          return (
            <div key={cat} style={{ display: "flex", alignItems: "center", gap: 11 }}>
              <CategoryAvatar categoria={cat} size={30} radius={9} />
              <span style={{ flex: 1, fontSize: 13, color: colors.textPrimary, opacity: 0.82, fontWeight: 600 }}>{catLabel(cat)}</span>
              <span style={{ fontSize: 11, color: colors.textMuted, minWidth: 30, textAlign: "right" }}>{pct}%</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: colors.textPrimary, opacity: 0.82, minWidth: 78, textAlign: "right" }}>{formatCurrency(val)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Transactions list (source='card'): search + category filter + the SAME TxRow
// as /transactions. Each row already shows the card in its subtitle.
function CardTxList({ workspaceId, txs, byCategory }: { workspaceId: string; txs: Transaction[]; byCategory: [string, number][] }) {
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState<string>("all");
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const listTx = useMemo(() => {
    const q = search.trim().toLowerCase();
    return txs.filter((t) => {
      const catOk = catFilter === "all" || t.category === catFilter;
      const qOk = !q || t.description.toLowerCase().includes(q);
      return catOk && qOk;
    });
  }, [txs, search, catFilter]);

  function toggleSelect(id: string) {
    setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  // Deleting a card transaction only updates the DERIVED views (list, categories,
  // diagnosis recompute from what's left). It does NOT touch the fatura's
  // authoritative total (the bank's saldoDestaFatura) nor the merchant cache.
  async function deleteSelected() {
    if (selected.size === 0) return;
    const batch = writeBatch(db);
    selected.forEach((id) => batch.delete(doc(db, "workspaces", workspaceId, "transactions", id)));
    await batch.commit();
    setSelected(new Set());
    setSelectMode(false);
  }

  if (txs.length === 0) return null;
  return (
    <div style={cardBox()}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={typography.labelSmall}>Transações</div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ fontSize: 11, color: colors.textMuted }}>{listTx.length} de {txs.length}</div>
          <button
            onClick={() => { setSelectMode((v) => !v); setSelected(new Set()); }}
            style={{ fontSize: 11.5, fontWeight: 600, padding: "4px 10px", borderRadius: 999, border: `1px solid ${selectMode ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.08)"}`, background: selectMode ? "rgba(255,255,255,0.10)" : "transparent", color: selectMode ? colors.textPrimary : colors.textMuted, cursor: "pointer" }}
          >
            {selectMode ? "Cancelar" : "Selecionar"}
          </button>
        </div>
      </div>

      {selectMode && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, padding: "8px 12px", borderRadius: 10, background: "rgba(255,255,255,0.04)", border: `1px solid ${colors.border}` }}>
          <span style={{ fontSize: 12, color: colors.textSecondary, flex: 1 }}>
            {selected.size === 0 ? "Nenhuma selecionada" : `${selected.size} selecionada${selected.size !== 1 ? "s" : ""}`}
          </span>
          {selected.size < listTx.length ? (
            <button onClick={() => setSelected(new Set(listTx.map((t) => t.id)))} style={{ fontSize: 12, fontWeight: 600, padding: "4px 10px", borderRadius: 999, border: "1px solid rgba(255,255,255,0.12)", background: "transparent", color: colors.textSecondary, cursor: "pointer" }}>Selecionar todas</button>
          ) : (
            <button onClick={() => setSelected(new Set())} style={{ fontSize: 12, fontWeight: 600, padding: "4px 10px", borderRadius: 999, border: "1px solid rgba(255,255,255,0.12)", background: "transparent", color: colors.textSecondary, cursor: "pointer" }}>Limpar seleção</button>
          )}
          <button
            onClick={deleteSelected}
            disabled={selected.size === 0}
            style={{ fontSize: 12, fontWeight: 700, padding: "4px 12px", borderRadius: 999, border: "1px solid rgba(255,92,92,0.35)", background: selected.size > 0 ? "rgba(255,92,92,0.15)" : "transparent", color: selected.size > 0 ? "#ff8080" : "rgba(255,92,92,0.3)", cursor: selected.size > 0 ? "pointer" : "default" }}
          >
            Excluir {selected.size > 0 ? `(${selected.size})` : ""}
          </button>
        </div>
      )}

      <div style={{ position: "relative", marginBottom: 12 }}>
        <Search size={14} color={colors.textFaint} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar compra..."
          style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: `1px solid ${colors.border}`, borderRadius: 10, outline: "none", color: colors.textPrimary, fontSize: 13, fontFamily: typography.fontUI, padding: "9px 12px 9px 34px" }}
        />
      </div>

      {byCategory.length > 1 && (
        <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
          {["all", ...byCategory.map(([c]) => c)].map((c) => {
            const active = catFilter === c;
            return (
              <button
                key={c}
                onClick={() => setCatFilter(c)}
                style={{ fontSize: 11, fontWeight: 600, padding: "4px 10px", borderRadius: 999, border: `1px solid ${active ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.08)"}`, background: active ? "rgba(255,255,255,0.10)" : "transparent", color: active ? colors.textPrimary : colors.textMuted, cursor: "pointer" }}
              >
                {c === "all" ? "Todas" : catLabel(c)}
              </button>
            );
          })}
        </div>
      )}

      {listTx.length === 0 ? (
        <div style={{ textAlign: "center", padding: "28px 0", color: colors.textFaint, fontSize: 13 }}>Nenhuma compra encontrada.</div>
      ) : (
        <div style={{ display: "grid", gap: 2 }}>
          {listTx.map((tx) => (
            <TxRow
              key={tx.id}
              tx={tx}
              workspaceId={workspaceId}
              onDelete={() => deleteDoc(doc(db, "workspaces", workspaceId, "transactions", tx.id))}
              selectMode={selectMode}
              isSelected={selected.has(tx.id)}
              onToggleSelect={() => toggleSelect(tx.id)}
              parceladaMap={EMPTY_PARCELADA}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Diagnosis: Firestore-cached, AI only when the fingerprint changes ───────

function useDiagnosis(workspaceId: string, docId: string, fingerprint: string, callableData: Record<string, unknown>) {
  const [diag, setDiag] = useState<CardDiag | null>(null);
  const [loading, setLoading] = useState(false);
  const dataRef = useRef(callableData);
  dataRef.current = callableData;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const snap = await getDoc(doc(db, "workspaces", workspaceId, "cardDiagnoses", docId));
        if (cancelled) return;
        if (snap.exists() && snap.data().fingerprint === fingerprint) {
          setDiag({ headline: snap.data().headline ?? null, insights: snap.data().insights ?? [] });
          return;
        }
      } catch { /* fall through to generate */ }
      setLoading(true);
      try {
        const fn = httpsCallable<unknown, CardDiag>(getFunctions(app, "us-central1"), "generateCardDiagnosis");
        const res = await fn(dataRef.current);
        if (!cancelled) setDiag({ headline: res.data.headline ?? null, insights: res.data.insights ?? [] });
      } catch (e) {
        if (!cancelled) console.error("[card-diagnosis] failed:", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [workspaceId, docId, fingerprint]);

  return { diag, loading };
}

function DiagnosisCard({ label, diag, loading, loadingText }: { label: string; diag: CardDiag | null; loading: boolean; loadingText: string }) {
  if (!diag?.headline && !loading) return null;
  return (
    <div style={{ ...cardBox(), background: `linear-gradient(135deg, ${colors.accentMuted}, rgba(184,245,90,0.02))`, border: `1px solid ${colors.borderAccent}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 10 }}>
        <Sparkles size={13} color={colors.accent} strokeWidth={2.2} />
        <span style={typography.labelSmall}>{label}</span>
      </div>
      {loading && !diag?.headline ? (
        <div style={{ fontSize: 13, color: colors.textMuted }}>{loadingText}</div>
      ) : (
        <>
          {diag?.headline && (
            <div style={{ fontSize: 15, fontWeight: 800, color: colors.textPrimary, lineHeight: 1.35, letterSpacing: "-0.01em" }}>{diag.headline}</div>
          )}
          {diag?.insights && diag.insights.length > 0 && (
            <div style={{ display: "grid", gap: 6, marginTop: 10 }}>
              {diag.insights.map((line, i) => (
                <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                  <span style={{ width: 5, height: 5, borderRadius: "50%", background: colors.accent, marginTop: 6, flexShrink: 0 }} />
                  <span style={{ fontSize: 12.5, color: colors.textSecondary, lineHeight: 1.45 }}>{line}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function CardDiagnosis({
  workspaceId, card, fatura, prevFatura, byCategory, totalCompras, lim,
}: {
  workspaceId: string;
  card: Card;
  fatura: Fatura;
  prevFatura: Fatura | null;
  byCategory: [string, number][];
  totalCompras: number;
  lim: ReturnType<typeof limitInfo>;
}) {
  const { fingerprint, payload } = useMemo(() => {
    const topCat = byCategory[0]
      ? { nome: catLabel(byCategory[0][0]), valor: byCategory[0][1], pct: totalCompras > 0 ? Math.round((byCategory[0][1] / totalCompras) * 100) : 0 }
      : null;
    const totalAtual = fatura.totalAPagar;
    const totalAnterior = prevFatura?.totalAPagar ?? null;
    const fp = [
      fatura.period, totalAtual.toFixed(2), totalAnterior?.toFixed(2) ?? "none",
      topCat ? `${byCategory[0][0]}:${topCat.valor.toFixed(2)}` : "none",
      lim.pct ?? "none",
      byCategory.slice(0, 5).map(([c, v]) => `${c}:${v.toFixed(2)}`).join(","),
    ].join("|");
    return {
      fingerprint: fp,
      payload: {
        cardLabel: card.name || card.bank,
        monthLabel: monthLabel(fatura.period),
        prevMonthLabel: prevFatura ? monthLabel(prevFatura.period) : null,
        totalAtual, totalAnterior, topCat,
        limitPct: lim.pct, limitUsado: lim.usado, limitTotal: lim.total,
        byCategory: byCategory.slice(0, 5).map(([c, v]) => ({ nome: catLabel(c), valor: v })),
      },
    };
  }, [card, fatura, prevFatura, byCategory, totalCompras, lim]);

  const { diag, loading } = useDiagnosis(workspaceId, `${card.id}_${fatura.period}`, fingerprint, {
    workspaceId, cardId: card.id, period: fatura.period, mode: "single", fingerprint, payload,
  });
  return <DiagnosisCard label="Diagnóstico do cartão" diag={diag} loading={loading} loadingText="Analisando a fatura…" />;
}

// ─── Aggregated "Todos os cartões" view ──────────────────────────────────────

function AllCardsView({ workspaceId, cards, faturas, cardTx, mes, setMes }: { workspaceId: string; cards: Card[]; faturas: Fatura[]; cardTx: Transaction[]; mes: string | null; setMes: (p: string) => void }) {
  // Periods = competências (faturaPeriod) across all cards, newest first.
  const allPeriods = useMemo(
    () => [...new Set(faturas.map((f) => f.period))].sort((a, b) => b.localeCompare(a)),
    [faturas]
  );
  const pIdx = (() => { const i = mes ? allPeriods.indexOf(mes) : -1; return i >= 0 ? i : 0; })();
  const selectedPeriod = allPeriods[pIdx] ?? null;
  const prevPeriod = allPeriods[pIdx + 1] ?? null;
  const isLatest = pIdx === 0;

  // Bills of the selected competência (one fatura per card for that period).
  const bills = useMemo(
    () => cards.map((card) => ({ card, fatura: faturas.find((f) => f.cardId === card.id && f.period === selectedPeriod) }))
      .filter((b): b is { card: Card; fatura: Fatura } => !!b.fatura),
    [cards, faturas, selectedPeriod]
  );

  const totalPeriodo = bills.reduce((s, b) => s + b.fatura.totalAPagar, 0);
  const prevTotal = prevPeriod ? faturas.filter((f) => f.period === prevPeriod).reduce((s, f) => s + f.totalAPagar, 0) : null;

  const thisMonth = currentMonthKey();
  const vencendoMes = bills
    .filter((b) => b.fatura.vencimento && b.fatura.vencimento.slice(0, 7) === thisMonth)
    .reduce((s, b) => s + b.fatura.totalAPagar, 0);
  const semVencimento = bills.filter((b) => !b.fatura.vencimento).length;
  const mesCalLabel = (() => { const [y, m] = thisMonth.split("-").map(Number); return new Intl.DateTimeFormat("pt-BR", { month: "long" }).format(new Date(y, m - 1, 1)); })();

  // Aggregated transactions of the selected competência (all cards).
  const aggTx = useMemo(
    () => cardTx.filter((t) => t.faturaPeriod === selectedPeriod).sort((a, b) => b.date.localeCompare(a.date)),
    [cardTx, selectedPeriod]
  );

  const byCategory = useMemo(() => aggregateByCategory(aggTx), [aggTx]);
  const totalCompras = byCategory.reduce((s, [, v]) => s + v, 0);

  // Aggregated diagnosis (mode "todos") for the selected competência vs the
  // previous one. Cached per period (doc all_<period>); refreshes when the set
  // of bills or the category mix changes.
  const { fingerprint, payload } = useMemo(() => {
    const topCat = byCategory[0]
      ? { nome: catLabel(byCategory[0][0]), valor: byCategory[0][1], pct: totalCompras > 0 ? Math.round((byCategory[0][1] / totalCompras) * 100) : 0 }
      : null;
    const fp = [
      selectedPeriod ?? "none", totalPeriodo.toFixed(2), prevTotal?.toFixed(2) ?? "none", vencendoMes.toFixed(2),
      bills.map((b) => `${b.card.id}:${b.fatura.totalAPagar.toFixed(2)}`).sort().join(";"),
      byCategory.slice(0, 5).map(([c, v]) => `${c}:${v.toFixed(2)}`).join(","),
    ].join("|");
    return {
      fingerprint: fp,
      payload: {
        cardLabel: "seus cartões",
        monthLabel: selectedPeriod ? monthLabel(selectedPeriod) : mesCalLabel,
        prevMonthLabel: prevPeriod ? monthLabel(prevPeriod) : null,
        totalAtual: totalPeriodo,
        totalAnterior: prevTotal && prevTotal > 0 ? prevTotal : null,
        topCat,
        limitPct: null, limitUsado: null, limitTotal: null,
        byCategory: byCategory.slice(0, 5).map(([c, v]) => ({ nome: catLabel(c), valor: v })),
        vencendoMes: isLatest && vencendoMes > 0 ? vencendoMes : null,
        cardsCount: bills.length,
      },
    };
  }, [selectedPeriod, prevPeriod, totalPeriodo, prevTotal, vencendoMes, isLatest, bills, byCategory, totalCompras, mesCalLabel]);

  const { diag, loading } = useDiagnosis(workspaceId, `all_${selectedPeriod ?? "none"}`, fingerprint, {
    workspaceId, cardId: "all", period: selectedPeriod ?? "none", mode: "todos", fingerprint, payload,
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {allPeriods.length > 1 && <PeriodNav periods={allPeriods} current={selectedPeriod} onChange={setMes} />}

      <DiagnosisCard label="Diagnóstico dos cartões" diag={diag} loading={loading} loadingText="Analisando os cartões…" />

      {/* Header agregado: total da competência + vencendo (quando atual) + lista */}
      <div style={{ ...cardBox(), background: `linear-gradient(135deg, ${colors.accentMuted}, rgba(184,245,90,0.02))`, border: `1px solid ${colors.borderAccent}` }}>
        <div style={typography.labelSmall}>{isLatest ? "Total em aberto" : `Fatura ${selectedPeriod ? monthLabel(selectedPeriod) : ""}`}</div>
        <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: "-0.03em", marginTop: 2 }}>{formatCurrency(totalPeriodo)}</div>
        {isLatest && vencendoMes > 0 && (
          <div style={{ fontSize: 12.5, color: colors.textSecondary, marginTop: 4 }}>
            Vencendo em {mesCalLabel}: <span style={{ color: colors.textPrimary, fontWeight: 700 }}>{formatCurrency(vencendoMes)}</span>
          </div>
        )}
        {isLatest && semVencimento > 0 && (
          <div style={{ fontSize: 11, color: colors.textMuted, marginTop: 4 }}>
            {semVencimento === 1 ? "1 fatura sem vencimento" : `${semVencimento} faturas sem vencimento`} — fora do total do mês.
          </div>
        )}

        <div style={{ display: "grid", gap: 2, marginTop: 14 }}>
          {bills.map(({ card, fatura }) => {
            const bank = detectBank(card.bank || card.name);
            const day = fatura.vencimento ? parseInt(fatura.vencimento.slice(8, 10), 10) : null;
            return (
              <div key={fatura.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: `1px solid ${colors.border}` }}>
                <div style={{ width: 30, height: 30, borderRadius: 9, background: bank.color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <CreditCard size={15} color={bank.glyph} strokeWidth={2} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: colors.textPrimary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {card.name || card.bank}{card.last4 ? ` ••• ${card.last4}` : ""}
                  </div>
                  <div style={{ fontSize: 11, color: colors.textMuted }}>{day ? `vence dia ${day}` : "sem vencimento"}</div>
                </div>
                <span style={{ fontSize: 14, fontWeight: 800, letterSpacing: "-0.02em", color: colors.textPrimary }}>{formatCurrency(fatura.totalAPagar)}</span>
              </div>
            );
          })}
        </div>
      </div>

      <CategoryBreakdown byCategory={byCategory} total={totalCompras} />
      <CardTxList workspaceId={workspaceId} txs={aggTx} byCategory={byCategory} />
    </div>
  );
}

function cardBox(): React.CSSProperties {
  return {
    background: colors.card,
    border: `1px solid ${colors.border}`,
    borderRadius: radius.card,
    padding: "18px 20px",
  };
}
