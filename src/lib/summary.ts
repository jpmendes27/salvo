import type { MonthlySummary, Transaction } from "./types";
import { formatCurrency, monthLabel } from "./money";

function inferSource(sourceLabel?: string): "account" | "card" | undefined {
  if (!sourceLabel) return undefined;
  if (/cartão|fatura|card/i.test(sourceLabel)) return "card";
  return "account";
}

export function buildMonthlySummary(
  transactions: Transaction[],
  monthKey: string
): MonthlySummary {
  const enriched = transactions.map((t) => ({
    ...t,
    source: (t.source === "account" || t.source === "card") ? t.source : inferSource(t.sourceLabel),
  }));

  const accountTxs = enriched.filter((t) => t.source !== "card");
  const cardTxs    = enriched.filter((t) => t.source === "card");

  const accountIncome  = accountTxs.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const accountExpense = accountTxs.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  const cardExpense    = cardTxs.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);

  // Bug 3: income/expense are the CASH-FLOW figures — account only. Card
  // purchases are a separate lens (cardExpense above), never mixed in here.
  const income  = accountIncome;
  const expense = accountExpense;

  const balance     = accountIncome - accountExpense;
  const savingsRate = accountIncome > 0 ? Math.round((balance / accountIncome) * 100) : null;

  const categoryTotals = accountTxs
    .filter((t) => t.type === "expense")
    .reduce<Record<string, number>>((acc, t) => {
      acc[t.category] = (acc[t.category] || 0) + t.amount;
      return acc;
    }, {});

  const [topCategory, topCategoryAmount] =
    Object.entries(categoryTotals).sort((a, b) => b[1] - a[1])[0] || [undefined, undefined];

  const insights: string[] = [];

  if (!transactions.length) {
    insights.push("Comece lançando uma entrada ou saída para gerar seu primeiro resumo.");
  } else if (balance >= 0) {
    insights.push(`Seu mês fechou positivo em ${formatCurrency(balance)}.`);
  } else {
    insights.push(`Seu mês fechou negativo em ${formatCurrency(Math.abs(balance))}.`);
  }

  if (accountIncome > 0) {
    insights.push(`Você comprometeu ${Math.max(0, 100 - (savingsRate ?? 0))}% das suas entradas.`);
  }

  if (topCategory && topCategoryAmount) {
    insights.push(`${topCategory} foi sua maior categoria de gastos, com ${formatCurrency(topCategoryAmount)}.`);
  }

  const contributors = new Set(transactions.map((t) => t.createdByName));
  if (contributors.size > 1) {
    insights.push("Este resumo considera lançamentos de mais de uma pessoa no workspace.");
  }

  const shareText = [
    `📊 Resumo Salvô! — ${monthLabel(monthKey)}`,
    ``,
    `💰 Entradas:  ${formatCurrency(income)}`,
    `💸 Saídas:    ${formatCurrency(expense)}`,
    `📈 Saldo:     ${formatCurrency(balance)}`,
    ``,
    insights[0] || "",
  ]
    .filter((l, i) => i < 5 || l !== "")
    .join("\n");

  return {
    income,
    expense,
    balance,
    savingsRate,
    accountExpense,
    cardExpense,
    topCategory,
    topCategoryAmount,
    insights,
    shareText,
  };
}
