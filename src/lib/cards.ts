"use client";

// ─── Credit-card data layer (separate lens from cash flow) ───────────────────
// Subscribes to the card collections and exposes the math the card UI needs.
// Never mixes into the account diagnosis — card purchases live only here.

import { collection, onSnapshot, query, where } from "firebase/firestore";
import { useEffect, useState } from "react";
import { db } from "./firebase";
import { formatCurrency } from "./money";
import type { Card, Fatura, Transaction } from "./types";

export type CardData = {
  cards: Card[];
  faturas: Fatura[];
  cardTx: Transaction[];
  loading: boolean;
};

export function useCardData(workspaceId: string): CardData {
  const [cards, setCards] = useState<Card[]>([]);
  const [faturas, setFaturas] = useState<Fatura[]>([]);
  const [cardTx, setCardTx] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!workspaceId) return;
    const unsubCards = onSnapshot(
      collection(db, "workspaces", workspaceId, "cards"),
      (snap) => {
        setCards(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Card));
        setLoading(false);
      },
      () => setLoading(false)
    );
    const unsubFaturas = onSnapshot(
      collection(db, "workspaces", workspaceId, "faturas"),
      (snap) => setFaturas(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Fatura)),
      () => {}
    );
    const unsubTx = onSnapshot(
      query(collection(db, "workspaces", workspaceId, "transactions"), where("source", "==", "card")),
      (snap) => setCardTx(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Transaction)),
      () => {}
    );
    return () => { unsubCards(); unsubFaturas(); unsubTx(); };
  }, [workspaceId]);

  return { cards, faturas, cardTx, loading };
}

// Most recent fatura for a card (periods are YYYY-MM, lexicographically sortable).
export function currentFatura(faturas: Fatura[], cardId: string): Fatura | null {
  return faturas
    .filter((f) => f.cardId === cardId)
    .sort((a, b) => b.period.localeCompare(a.period))[0] ?? null;
}

// Fatura de um cartão para um PERÍODO específico (faturaPeriod = competência YYYY-MM) —
// a mesma seleção que /cards faz pela navegação de período. NUNCA filtro de mês-calendário.
export function faturaForPeriod(faturas: Fatura[], cardId: string, period: string): Fatura | null {
  return faturas.find((f) => f.cardId === cardId && f.period === period) ?? null;
}

export type LimitInfo = {
  total: number | null;
  usado: number | null;
  disponivel: number | null;
  pct: number | null; // 0–100, used fraction
};

// Limit math: prefer explicit fields, derive the missing one when possible.
export function limitInfo(card: Card): LimitInfo {
  const total = card.limitTotal ?? null;
  let usado = card.limitUsado ?? null;
  let disponivel = card.limitDisponivel ?? null;
  if (disponivel == null && total != null && usado != null) disponivel = total - usado;
  if (usado == null && total != null && disponivel != null) usado = total - disponivel;
  const pct =
    total && usado != null ? Math.min(100, Math.max(0, Math.round((usado / total) * 100))) : null;
  return { total, usado, disponivel, pct };
}

// Salvô-tone one-liner about the current fatura / limit usage.
export function cardToneLine(card: Card, fatura: Fatura | null): string {
  const { total, usado, disponivel } = limitInfo(card);
  if (total != null && usado != null) {
    const sobrou = disponivel ?? total - usado;
    return `Você comprometeu ${formatCurrency(usado)} dos ${formatCurrency(total)}. Sobrou ${formatCurrency(Math.max(0, sobrou))}.`;
  }
  if (fatura && fatura.totalAPagar > 0) {
    return `Sua fatura fechou em ${formatCurrency(fatura.totalAPagar)}.`;
  }
  return "Importe a fatura pra acompanhar o cartão aqui.";
}
