"use client";

// ─── /cards — credit-card lens (behind the cardsEnabled flag) ────────────────
// Cards, current fatura, limit bar, purchases by category, parcelamentos, and
// previous faturas. A separate lens from cash flow: card data only, never mixed
// into the account diagnosis. Follows the Salvô! design system.

import { ArrowLeft, CreditCard, ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useAuthUser } from "@/app/auth-provider";
import { CategoryAvatar } from "@/components/CategoryAvatar";
import { useCardData, currentFatura, limitInfo, cardToneLine } from "@/lib/cards";
import { isCardsEnabled } from "@/lib/flags";
import { colors, radius, typography } from "@/lib/design-system";
import { formatCurrency, monthLabel } from "@/lib/money";
import { CATEGORY_LABELS } from "@/lib/parsers";
import type { Card, Fatura, Transaction } from "@/lib/types";

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
  const [selectedId, setSelectedId] = useState<string | null>(null);

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

            {card && <CardDetail card={card} faturas={faturas} cardTx={cardTx} />}
          </>
        )}
      </div>
    </div>
  );
}

function CardDetail({ card, faturas, cardTx }: { card: Card; faturas: Fatura[]; cardTx: Transaction[] }) {
  const fatura = currentFatura(faturas, card.id);
  const lim = limitInfo(card);

  // Purchases of the current fatura period for this card.
  const periodTx = useMemo(
    () => cardTx.filter((t) => t.cardId === card.id && (!fatura || t.faturaPeriod === fatura.period)),
    [cardTx, card.id, fatura]
  );

  const byCategory = useMemo(() => {
    const m: Record<string, number> = {};
    for (const t of periodTx) m[t.category] = (m[t.category] ?? 0) + t.amount;
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [periodTx]);
  const totalCompras = byCategory.reduce((s, [, v]) => s + v, 0);

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
      {/* Hero: card + current fatura + limit */}
      <div style={{ ...cardBox(), background: `linear-gradient(135deg, ${colors.accentMuted}, rgba(184,245,90,0.02))`, border: `1px solid ${colors.borderAccent}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <div style={{ width: 34, height: 34, borderRadius: 9, background: "rgba(184,245,90,0.18)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <CreditCard size={18} color={colors.accent} strokeWidth={2} />
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
            <div style={{ fontFamily: typography.fontMono, fontSize: 30, fontWeight: 800, letterSpacing: "-0.02em", marginTop: 2 }}>
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
                  <span style={{ fontFamily: typography.fontMono, fontSize: 12.5, color: colors.textPrimary, opacity: 0.7, minWidth: 78, textAlign: "right" }}>{formatCurrency(total)}</span>
                </div>
              );
            })}
          </div>
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
                <span style={{ fontFamily: typography.fontMono, fontSize: 12.5, color: colors.textPrimary, opacity: 0.7 }}>{formatCurrency(t.amount)}</span>
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
                <span style={{ fontFamily: typography.fontMono, fontSize: 13, color: colors.textPrimary, opacity: 0.8 }}>{formatCurrency(f.totalAPagar)}</span>
                <ChevronRight size={15} color={colors.textFaint} />
              </div>
            ))}
          </div>
        </div>
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
