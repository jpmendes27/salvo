import type { MonthlySummary, Transaction } from "./types";
import { formatCurrency, monthLabel } from "./money";

export function buildMonthlySummary(
  transactions: Transaction[],
  monthKey: string
): MonthlySummary {
  const income = transactions
    .filter((item) => item.type === "income")
    .reduce((total, item) => total + item.amount, 0);
  const expense = transactions
    .filter((item) => item.type === "expense")
    .reduce((total, item) => total + item.amount, 0);
  const balance = income - expense;
  const savingsRate = income > 0 ? Math.round((balance / income) * 100) : 0;

  const categoryTotals = transactions
    .filter((item) => item.type === "expense")
    .reduce<Record<string, number>>((acc, item) => {
      acc[item.category] = (acc[item.category] || 0) + item.amount;
      return acc;
    }, {});

  const [topCategory, topCategoryAmount] = Object.entries(categoryTotals).sort(
    (a, b) => b[1] - a[1]
  )[0] || [undefined, undefined];

  const insights: string[] = [];

  if (!transactions.length) {
    insights.push("Comece lancando uma entrada ou saida para gerar seu primeiro resumo.");
  } else if (balance >= 0) {
    insights.push(`Seu mes esta positivo em ${formatCurrency(balance)}.`);
  } else {
    insights.push(`Seu mes esta negativo em ${formatCurrency(Math.abs(balance))}.`);
  }

  if (income > 0) {
    insights.push(`Voce usou ${Math.max(0, 100 - savingsRate)}% das entradas do mes.`);
  }

  if (topCategory && topCategoryAmount) {
    insights.push(
      `${topCategory} e sua maior categoria de gastos, com ${formatCurrency(topCategoryAmount)}.`
    );
  }

  const contributors = new Set(transactions.map((item) => item.createdByName));
  if (contributors.size > 1) {
    insights.push("Este resumo considera lancamentos feitos por mais de uma pessoa.");
  }

  const shareText = [
    `Resumo Fincheck Pro de ${monthLabel(monthKey)}`,
    `Entradas: ${formatCurrency(income)}`,
    `Saidas: ${formatCurrency(expense)}`,
    `Saldo: ${formatCurrency(balance)}`,
    insights[0] || ""
  ]
    .filter(Boolean)
    .join("\n");

  return {
    income,
    expense,
    balance,
    savingsRate,
    topCategory,
    topCategoryAmount,
    insights,
    shareText
  };
}
