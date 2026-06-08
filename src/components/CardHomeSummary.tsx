"use client";

// ─── Home card summary (GA — renders only when there's ≥1 card) ──────────────
// One component covering 1..N cards:
//   • 1 fatura  → compact per-card row (icon, current fatura, limit read).
//   • N faturas → grouped "a pagar" view: what's due THIS month + total open,
//     with one compact line per fatura. Each fatura is one bill — grouped by
//     fatura, never summed blindly. Separate lens: NEVER the cash-flow score.

import { useRouter } from "next/navigation";
import { CreditCard, ArrowRight } from "lucide-react";
import { colors, radius, typography } from "@/lib/design-system";
import { currentMonthKey, formatCurrency } from "@/lib/money";
import { useCardData, currentFatura, limitInfo } from "@/lib/cards";
import { detectBank } from "@/lib/banks";
import type { Card, Fatura } from "@/lib/types";

// "2026-06" → "JUNHO" / "junho"
function monthName(period: string, upper = false): string {
  const [y, m] = period.split("-").map(Number);
  const name = new Intl.DateTimeFormat("pt-BR", { month: "long" }).format(new Date(y, m - 1, 1));
  return upper ? name.toUpperCase() : name;
}

function vencDay(f: Fatura): number | null {
  if (!f.vencimento) return null;
  const d = parseInt(f.vencimento.slice(8, 10), 10);
  return Number.isFinite(d) ? d : null;
}

export function CardHomeSummary({ workspaceId }: { workspaceId: string }) {
  const router = useRouter();
  const { cards, faturas, loading } = useCardData(workspaceId);

  if (loading || cards.length === 0) return null;

  const ordered = [...cards].sort((a, b) => {
    const fa = currentFatura(faturas, a.id)?.period ?? "";
    const fb = currentFatura(faturas, b.id)?.period ?? "";
    return fb.localeCompare(fa);
  });

  const openCards = (cardId?: string) => {
    localStorage.setItem("fincheck_workspace", workspaceId);
    if (cardId) localStorage.setItem("fincheck_card", cardId);
    router.push("/cards");
  };

  const Header = (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
      <span style={typography.labelSmall}>Cartões</span>
      <button
        onClick={() => openCards()}
        style={{
          display: "flex", alignItems: "center", gap: 4,
          background: "transparent", border: "none", color: colors.accent,
          fontSize: 11.5, fontWeight: 700, cursor: "pointer", opacity: 0.85,
        }}
      >
        Ver cartões <ArrowRight size={12} />
      </button>
    </div>
  );

  // Cards with a current fatura (each fatura = one bill).
  const bills = ordered
    .map((card) => ({ card, fatura: currentFatura(faturas, card.id) }))
    .filter((e): e is { card: Card; fatura: Fatura } => !!e.fatura);

  const grouped = bills.length >= 2;

  // ── Grouped "a pagar" view (N faturas) ─────────────────────────────────────
  if (grouped) {
    const thisMonth = currentMonthKey();
    const dueThisMonth = bills.filter((b) => b.fatura.vencimento && b.fatura.vencimento.slice(0, 7) === thisMonth);
    const vencendoMes = dueThisMonth.reduce((s, b) => s + b.fatura.totalAPagar, 0);
    const totalAberto = bills.reduce((s, b) => s + b.fatura.totalAPagar, 0);
    const semVencimento = bills.filter((b) => !b.fatura.vencimento).length;
    const showAberto = totalAberto > vencendoMes + 0.001;

    return (
      <section style={{ ...box(), padding: "16px 18px" }}>
        {Header}

        {/* Headline */}
        {vencendoMes > 0 ? (
          <>
            <div style={{ fontSize: 12, color: colors.textMuted, fontWeight: 600 }}>
              Vencendo em {monthName(thisMonth)}
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.03em", marginTop: 2 }}>
              {formatCurrency(vencendoMes)}
            </div>
            {showAberto && (
              <div style={{ fontSize: 11.5, color: colors.textSecondary, marginTop: 4 }}>
                Total em aberto: {formatCurrency(totalAberto)}
              </div>
            )}
          </>
        ) : (
          <>
            <div style={{ fontSize: 12, color: colors.textMuted, fontWeight: 600 }}>Total em aberto</div>
            <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.03em", marginTop: 2 }}>
              {formatCurrency(totalAberto)}
            </div>
            <div style={{ fontSize: 11.5, color: colors.textSecondary, marginTop: 4 }}>
              Nenhuma fatura vence em {monthName(thisMonth)}.
            </div>
          </>
        )}

        {semVencimento > 0 && (
          <div style={{ fontSize: 11, color: colors.textMuted, marginTop: 4 }}>
            {semVencimento === 1 ? "1 fatura sem data de vencimento" : `${semVencimento} faturas sem data de vencimento`} — fora do total do mês.
          </div>
        )}

        {/* One compact line per fatura */}
        <div style={{ display: "grid", gap: 2, marginTop: 14 }}>
          {bills.map(({ card, fatura }) => {
            const bank = detectBank(card.bank || card.name);
            const day = vencDay(fatura);
            return (
              <button
                key={fatura.id}
                onClick={() => openCards(card.id)}
                style={{
                  width: "100%", textAlign: "left", background: "transparent", border: "none",
                  padding: "8px 0", cursor: "pointer", display: "flex", alignItems: "center", gap: 10,
                  borderBottom: `1px solid ${colors.border}`,
                }}
              >
                <div style={{ width: 30, height: 30, borderRadius: 9, background: bank.color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <CreditCard size={15} color={bank.glyph} strokeWidth={2} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: colors.textPrimary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {card.name || card.bank}{card.last4 ? ` ••• ${card.last4}` : ""}
                  </div>
                  <div style={{ fontSize: 11, color: colors.textMuted }}>
                    {day ? `vence dia ${day}` : "sem vencimento"}
                  </div>
                </div>
                <span style={{ fontSize: 14, fontWeight: 800, letterSpacing: "-0.02em", color: colors.textPrimary }}>
                  {formatCurrency(fatura.totalAPagar)}
                </span>
              </button>
            );
          })}
        </div>
      </section>
    );
  }

  // ── Single-card view (1 fatura) — keeps the existing compact look ──────────
  return (
    <section style={{ ...box(), padding: "16px 18px" }}>
      {Header}
      <div style={{ display: "grid", gap: 12 }}>
        {ordered.map((card) => {
          const fatura = currentFatura(faturas, card.id);
          const lim = limitInfo(card);
          const bank = detectBank(card.bank || card.name);
          const limitText =
            lim.disponivel != null
              ? `${formatCurrency(lim.disponivel)} disponível`
              : lim.pct != null
              ? `${lim.pct}% comprometido`
              : null;
          return (
            <button
              key={card.id}
              onClick={() => openCards(card.id)}
              style={{
                width: "100%", textAlign: "left", background: "transparent", border: "none",
                padding: 0, cursor: "pointer", display: "flex", flexDirection: "column", gap: 9,
                color: colors.textPrimary,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 9, background: bank.color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <CreditCard size={16} color={bank.glyph} strokeWidth={2} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: colors.textPrimary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {card.name || card.bank}{card.last4 ? ` ••• ${card.last4}` : ""}
                  </div>
                  {fatura && (
                    <div style={{ fontSize: 11, color: colors.textMuted, display: "flex", alignItems: "center", gap: 5, marginTop: 1 }}>
                      <span style={{ fontWeight: 700, letterSpacing: "0.04em" }}>FATURA {monthName(fatura.period, true)}</span>
                      <span style={{ opacity: 0.5 }}>·</span>
                      <span style={{ color: colors.textSecondary, fontWeight: 700 }}>{formatCurrency(fatura.totalAPagar)}</span>
                    </div>
                  )}
                </div>
              </div>

              {lim.pct != null && (
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ flex: 1, height: 5, borderRadius: 999, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
                    <div style={{ width: `${lim.pct}%`, height: "100%", borderRadius: 999, background: lim.pct >= 90 ? colors.negative : colors.accent, transition: "width 0.3s ease" }} />
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

function box(): React.CSSProperties {
  return {
    background: colors.card,
    border: `1px solid ${colors.border}`,
    borderRadius: radius.card,
    fontFamily: typography.fontUI,
    color: colors.textPrimary,
  };
}
