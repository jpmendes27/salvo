"use client";

// ─── /cards — credit-card lens (behind the cardsEnabled flag) ────────────────
// Cards, current fatura, limit bar, purchases by category, parcelamentos, and
// previous faturas. A separate lens from cash flow: card data only, never mixed
// into the account diagnosis. Follows the Salvô! design system.

import { deleteDoc, doc, getDoc } from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { ArrowLeft, CreditCard, ChevronRight, Search, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useAuthUser } from "@/app/auth-provider";
import { CategoryAvatar } from "@/components/CategoryAvatar";
import { TxRow } from "@/components/TxRow";
import { app, db } from "@/lib/firebase";
import { useCardData, currentFatura, limitInfo, cardToneLine } from "@/lib/cards";
import { detectBank } from "@/lib/banks";
import { isCardsEnabled } from "@/lib/flags";
import { colors, radius, typography } from "@/lib/design-system";
import { formatCurrency, monthLabel } from "@/lib/money";
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
  const { cards, faturas, cardTx, loading } = useCardData(workspaceId);
  // One-shot hint from the home grouped view: open on the tapped card.
  const [selectedId, setSelectedId] = useState<string | null>(
    () => (typeof window !== "undefined" ? localStorage.getItem("fincheck_card") : null)
  );
  useEffect(() => { localStorage.removeItem("fincheck_card"); }, []);

  // Default selection: the card with the most recent fatura.
  const ordered = useMemo(() => {
    return [...cards].sort((a, b) => {
      const fa = currentFatura(faturas, a.id)?.period ?? "";
      const fb = currentFatura(faturas, b.id)?.period ?? "";
      return fb.localeCompare(fa);
    });
  }, [cards, faturas]);

  const card = ordered.find((c) => c.id === selectedId) ?? ordered[0] ?? null;

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
            {/* Card selector (when more than one) */}
            {ordered.length > 1 && (
              <div style={{ display: "flex", gap: 8, overflowX: "auto", marginBottom: 16, paddingBottom: 4 }}>
                {ordered.map((c) => {
                  const active = c.id === card?.id;
                  return (
                    <button
                      key={c.id}
                      onClick={() => setSelectedId(c.id)}
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
                      {c.name || c.bank}{c.last4 ? ` ••${c.last4}` : ""}
                    </button>
                  );
                })}
              </div>
            )}

            {card && <CardDetail workspaceId={workspaceId} card={card} faturas={faturas} cardTx={cardTx} />}
          </>
        )}
      </div>
    </div>
  );
}

function CardDetail({ workspaceId, card, faturas, cardTx }: { workspaceId: string; card: Card; faturas: Fatura[]; cardTx: Transaction[] }) {
  const fatura = currentFatura(faturas, card.id);
  const lim = limitInfo(card);
  const bank = detectBank(card.bank || card.name);
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState<string>("all");

  // Purchases of the current fatura period for this card.
  const periodTx = useMemo(
    () => cardTx
      .filter((t) => t.cardId === card.id && (!fatura || t.faturaPeriod === fatura.period))
      .sort((a, b) => b.date.localeCompare(a.date)),
    [cardTx, card.id, fatura]
  );

  const byCategory = useMemo(() => {
    const m: Record<string, number> = {};
    for (const t of periodTx) m[t.category] = (m[t.category] ?? 0) + t.amount;
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [periodTx]);
  const totalCompras = byCategory.reduce((s, [, v]) => s + v, 0);

  // Transactions list filtered by search + category (same UX as /transactions).
  const listTx = useMemo(() => {
    const q = search.trim().toLowerCase();
    return periodTx.filter((t) => {
      const catOk = catFilter === "all" || t.category === catFilter;
      const qOk = !q || t.description.toLowerCase().includes(q);
      return catOk && qOk;
    });
  }, [periodTx, search, catFilter]);

  // Parcelamentos: purchases carrying installment info.
  const parcelamentos = useMemo(
    () => periodTx.filter((t) => t.parcela && t.parcela.total > 1),
    [periodTx]
  );

  // Previous faturas (this card), most recent first, excluding the current one.
  const historico = useMemo(() => {
    return faturas
      .filter((f) => f.cardId === card.id && (!fatura || f.period !== fatura.period))
      .sort((a, b) => b.period.localeCompare(a.period));
  }, [faturas, card.id, fatura]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Diagnóstico do cartão (lente separada — cache Firestore, IA só quando muda) */}
      {fatura && (
        <CardDiagnosis
          workspaceId={workspaceId}
          card={card}
          fatura={fatura}
          prevFatura={historico[0] ?? null}
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

      {/* Compras por categoria */}
      {byCategory.length > 0 && (
        <div style={cardBox()}>
          <div style={{ ...typography.labelSmall, marginBottom: 14 }}>Compras por categoria</div>
          <div style={{ display: "grid", gap: 12 }}>
            {byCategory.map(([cat, total]) => {
              const pct = totalCompras > 0 ? Math.round((total / totalCompras) * 100) : 0;
              return (
                <div key={cat} style={{ display: "flex", alignItems: "center", gap: 11 }}>
                  <CategoryAvatar categoria={cat} size={30} radius={9} />
                  <span style={{ flex: 1, fontSize: 13, color: colors.textPrimary, opacity: 0.82, fontWeight: 600 }}>{catLabel(cat)}</span>
                  <span style={{ fontSize: 11, color: colors.textMuted, minWidth: 30, textAlign: "right" }}>{pct}%</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: colors.textPrimary, opacity: 0.82, minWidth: 78, textAlign: "right" }}>{formatCurrency(total)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Transações (mesmas capacidades de /transactions: ver, recategorizar,
          buscar, filtrar) — só source='card', do cartão/period exibido. */}
      {periodTx.length > 0 && (
        <div style={cardBox()}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div style={typography.labelSmall}>Transações</div>
            <div style={{ fontSize: 11, color: colors.textMuted }}>{listTx.length} de {periodTx.length}</div>
          </div>

          {/* Search */}
          <div style={{ position: "relative", marginBottom: 12 }}>
            <Search size={14} color={colors.textFaint} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar compra..."
              style={{
                width: "100%",
                background: "rgba(255,255,255,0.04)",
                border: `1px solid ${colors.border}`,
                borderRadius: 10,
                outline: "none",
                color: colors.textPrimary,
                fontSize: 13,
                fontFamily: typography.fontUI,
                padding: "9px 12px 9px 34px",
              }}
            />
          </div>

          {/* Category filter (chips) */}
          {byCategory.length > 1 && (
            <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
              {["all", ...byCategory.map(([c]) => c)].map((c) => {
                const active = catFilter === c;
                return (
                  <button
                    key={c}
                    onClick={() => setCatFilter(c)}
                    style={{
                      fontSize: 11, fontWeight: 600, padding: "4px 10px", borderRadius: 999,
                      border: `1px solid ${active ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.08)"}`,
                      background: active ? "rgba(255,255,255,0.10)" : "transparent",
                      color: active ? colors.textPrimary : colors.textMuted,
                      cursor: "pointer",
                    }}
                  >
                    {c === "all" ? "Todas" : catLabel(c)}
                  </button>
                );
              })}
            </div>
          )}

          {/* List — reuses the same TxRow as /transactions (recategorize, etc.) */}
          {listTx.length === 0 ? (
            <div style={{ textAlign: "center", padding: "28px 0", color: colors.textFaint, fontSize: 13 }}>
              Nenhuma compra encontrada.
            </div>
          ) : (
            <div style={{ display: "grid", gap: 2 }}>
              {listTx.map((tx) => (
                <TxRow
                  key={tx.id}
                  tx={tx}
                  workspaceId={workspaceId}
                  onDelete={() => deleteDoc(doc(db, "workspaces", workspaceId, "transactions", tx.id))}
                  selectMode={false}
                  isSelected={false}
                  onToggleSelect={() => {}}
                  parceladaMap={EMPTY_PARCELADA}
                />
              ))}
            </div>
          )}
        </div>
      )}

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
  const [diag, setDiag] = useState<CardDiag | null>(null);
  const [loading, setLoading] = useState(false);

  // Inputs + fingerprint: changes only when a new fatura lands or a
  // recategorization shifts the numbers → cache stays warm otherwise.
  const { fingerprint, payload } = useMemo(() => {
    const topCat = byCategory[0]
      ? {
          nome: catLabel(byCategory[0][0]),
          valor: byCategory[0][1],
          pct: totalCompras > 0 ? Math.round((byCategory[0][1] / totalCompras) * 100) : 0,
        }
      : null;
    const totalAtual = fatura.totalAPagar;
    const totalAnterior = prevFatura?.totalAPagar ?? null;
    const fp = [
      fatura.period,
      totalAtual.toFixed(2),
      totalAnterior?.toFixed(2) ?? "none",
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
        totalAtual,
        totalAnterior,
        topCat,
        limitPct: lim.pct,
        limitUsado: lim.usado,
        limitTotal: lim.total,
        byCategory: byCategory.slice(0, 5).map(([c, v]) => ({ nome: catLabel(c), valor: v })),
      },
    };
  }, [card, fatura, prevFatura, byCategory, totalCompras, lim]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // 1. Read the Firestore cache. Warm + same fingerprint → no AI, no call.
      try {
        const snap = await getDoc(doc(db, "workspaces", workspaceId, "cardDiagnoses", `${card.id}_${fatura.period}`));
        if (cancelled) return;
        if (snap.exists() && snap.data().fingerprint === fingerprint) {
          setDiag({ headline: snap.data().headline ?? null, insights: snap.data().insights ?? [] });
          return;
        }
      } catch { /* fall through to generate */ }
      // 2. Stale or missing → generate (the callable writes the cache).
      setLoading(true);
      try {
        const fn = httpsCallable<unknown, CardDiag>(getFunctions(app, "us-central1"), "generateCardDiagnosis");
        const res = await fn({ workspaceId, cardId: card.id, period: fatura.period, fingerprint, payload });
        if (!cancelled) setDiag({ headline: res.data.headline ?? null, insights: res.data.insights ?? [] });
      } catch (e) {
        if (!cancelled) console.error("[card-diagnosis] failed:", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [fingerprint, workspaceId, card.id, fatura.period, payload]);

  // Nothing to show yet and nothing cached → render nothing (no empty state).
  if (!diag?.headline && !loading) return null;

  return (
    <div style={{ ...cardBox(), background: `linear-gradient(135deg, ${colors.accentMuted}, rgba(184,245,90,0.02))`, border: `1px solid ${colors.borderAccent}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 10 }}>
        <Sparkles size={13} color={colors.accent} strokeWidth={2.2} />
        <span style={typography.labelSmall}>Diagnóstico do cartão</span>
      </div>
      {loading && !diag?.headline ? (
        <div style={{ fontSize: 13, color: colors.textMuted }}>Analisando a fatura…</div>
      ) : (
        <>
          {diag?.headline && (
            <div style={{ fontSize: 15, fontWeight: 800, color: colors.textPrimary, lineHeight: 1.35, letterSpacing: "-0.01em" }}>
              {diag.headline}
            </div>
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

function cardBox(): React.CSSProperties {
  return {
    background: colors.card,
    border: `1px solid ${colors.border}`,
    borderRadius: radius.card,
    padding: "18px 20px",
  };
}
