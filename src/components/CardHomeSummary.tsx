"use client";

// ─── Home card summary (behind the cardsEnabled flag) ────────────────────────
// A compact "CARTÕES" section for the home view: one row per card with current
// fatura and a compact limit read, plus a CTA into /cards. Separate lens — never
// part of the cash-flow diagnosis. Follows the design system; does not replicate
// the full /cards page.

import { useRouter } from "next/navigation";
import { CreditCard, ArrowRight } from "lucide-react";
import { colors, radius, typography } from "@/lib/design-system";
import { formatCurrency } from "@/lib/money";
import { useCardData, currentFatura, limitInfo } from "@/lib/cards";

// "2026-06" → "JUNHO"
function faturaMonth(period: string): string {
  const [y, m] = period.split("-").map(Number);
  const name = new Intl.DateTimeFormat("pt-BR", { month: "long" }).format(new Date(y, m - 1, 1));
  return name.toUpperCase();
}

export function CardHomeSummary({ workspaceId }: { workspaceId: string }) {
  const router = useRouter();
  const { cards, faturas, loading } = useCardData(workspaceId);

  // No card yet → render nothing (no empty state).
  if (loading || cards.length === 0) return null;

  const ordered = [...cards].sort((a, b) => {
    const fa = currentFatura(faturas, a.id)?.period ?? "";
    const fb = currentFatura(faturas, b.id)?.period ?? "";
    return fb.localeCompare(fa);
  });

  const openCards = () => {
    localStorage.setItem("fincheck_workspace", workspaceId);
    router.push("/cards");
  };

  return (
    <section
      style={{
        background: colors.card,
        border: `1px solid ${colors.border}`,
        borderRadius: radius.card,
        padding: "16px 18px",
        fontFamily: typography.fontUI,
      }}
    >
      {/* Section header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <span style={{ ...typography.labelSmall }}>Cartões</span>
        <button
          onClick={openCards}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            background: "transparent",
            border: "none",
            color: colors.accent,
            fontSize: 11.5,
            fontWeight: 700,
            cursor: "pointer",
            opacity: 0.85,
          }}
        >
          Ver cartões <ArrowRight size={12} />
        </button>
      </div>

      <div style={{ display: "grid", gap: 12 }}>
        {ordered.map((card) => {
          const fatura = currentFatura(faturas, card.id);
          const lim = limitInfo(card);
          const limitText =
            lim.disponivel != null
              ? `${formatCurrency(lim.disponivel)} disponível`
              : lim.pct != null
              ? `${lim.pct}% comprometido`
              : null;
          return (
            <button
              key={card.id}
              onClick={openCards}
              style={{
                width: "100%",
                textAlign: "left",
                background: "transparent",
                border: "none",
                padding: 0,
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                gap: 9,
                color: colors.textPrimary,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 9,
                    background: colors.accentMuted,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <CreditCard size={16} color={colors.accent} strokeWidth={2} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: colors.textPrimary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {card.name || card.bank}{card.last4 ? ` ••• ${card.last4}` : ""}
                  </div>
                  {fatura && (
                    <div style={{ fontSize: 11, color: colors.textMuted, display: "flex", alignItems: "center", gap: 5, marginTop: 1 }}>
                      <span style={{ fontWeight: 700, letterSpacing: "0.04em" }}>FATURA {faturaMonth(fatura.period)}</span>
                      <span style={{ opacity: 0.5 }}>·</span>
                      <span style={{ fontFamily: typography.fontMono, color: colors.textSecondary }}>{formatCurrency(fatura.totalAPagar)}</span>
                    </div>
                  )}
                </div>
              </div>

              {lim.pct != null && (
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ flex: 1, height: 5, borderRadius: 999, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
                    <div
                      style={{
                        width: `${lim.pct}%`,
                        height: "100%",
                        borderRadius: 999,
                        background: lim.pct >= 90 ? colors.negative : colors.accent,
                        transition: "width 0.3s ease",
                      }}
                    />
                  </div>
                  {limitText && (
                    <span style={{ fontSize: 11, color: lim.pct >= 90 ? colors.negative : colors.textSecondary, fontWeight: 600, whiteSpace: "nowrap" }}>
                      {limitText}
                    </span>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}
