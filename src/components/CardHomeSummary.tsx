"use client";

// ─── Home card summary (behind the cardsEnabled flag) ────────────────────────
// A compact, separate-lens card section for the home view: current fatura,
// used/available limit bar, and a Salvô-tone line. Tapping opens /cards.
// Follows the design system rigorously and never touches the account UI.

import { useRouter } from "next/navigation";
import { CreditCard, ChevronRight } from "lucide-react";
import { colors, radius, typography } from "@/lib/design-system";
import { formatCurrency } from "@/lib/money";
import { useCardData, currentFatura, limitInfo, cardToneLine } from "@/lib/cards";

export function CardHomeSummary({ workspaceId }: { workspaceId: string }) {
  const router = useRouter();
  const { cards, faturas, loading } = useCardData(workspaceId);

  // Nothing imported yet → render nothing (flag-gated section stays invisible
  // until there's a card to show).
  if (loading || cards.length === 0) return null;

  // Show the card with the most recently dated fatura first.
  const ordered = [...cards].sort((a, b) => {
    const fa = currentFatura(faturas, a.id)?.period ?? "";
    const fb = currentFatura(faturas, b.id)?.period ?? "";
    return fb.localeCompare(fa);
  });
  const card = ordered[0];
  const fatura = currentFatura(faturas, card.id);
  const lim = limitInfo(card);

  return (
    <button
      onClick={() => router.push("/cards")}
      style={{
        width: "100%",
        textAlign: "left",
        background: colors.card,
        border: `1px solid ${colors.border}`,
        borderRadius: radius.card,
        padding: "16px 18px",
        display: "flex",
        flexDirection: "column",
        gap: 12,
        cursor: "pointer",
        fontFamily: typography.fontUI,
        color: colors.textPrimary,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div
          style={{
            width: 30,
            height: 30,
            borderRadius: 8,
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
          <div style={{ fontSize: 13, fontWeight: 700, color: colors.textPrimary }}>
            {card.name || card.bank}
          </div>
          <div style={{ fontSize: 11, color: colors.textMuted }}>
            {card.last4 ? `•••• ${card.last4}` : "Cartão de crédito"}
            {ordered.length > 1 ? ` · +${ordered.length - 1}` : ""}
          </div>
        </div>
        {fatura && (
          <div style={{ textAlign: "right" }}>
            <div style={{ ...typography.labelSmall, marginBottom: 2 }}>Fatura</div>
            <div style={{ fontFamily: typography.fontMono, fontSize: 16, fontWeight: 700 }}>
              {formatCurrency(fatura.totalAPagar)}
            </div>
          </div>
        )}
        <ChevronRight size={18} color={colors.textFaint} style={{ marginLeft: 4 }} />
      </div>

      {lim.pct != null && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div
            style={{
              height: 6,
              borderRadius: 999,
              background: "rgba(255,255,255,0.08)",
              overflow: "hidden",
            }}
          >
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
          <div style={{ fontSize: 11.5, color: colors.textSecondary, lineHeight: 1.4 }}>
            {cardToneLine(card, fatura)}
          </div>
        </div>
      )}
      {lim.pct == null && (
        <div style={{ fontSize: 11.5, color: colors.textSecondary, lineHeight: 1.4 }}>
          {cardToneLine(card, fatura)}
        </div>
      )}
    </button>
  );
}
