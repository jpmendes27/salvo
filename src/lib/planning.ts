import type { PlannedItem, Transaction } from "./types";

export type MonthlyPlanSummary = {
  plannedIncome: number;
  plannedExpense: number;
  paidIncome: number;
  paidExpense: number;
  pendingIncome: number;
  pendingExpense: number;
  projectedIncome: number;
  projectedExpense: number;
  projectedBalance: number;
  pendingItems: PlannedItem[];
};

export function buildMonthlyPlanSummary(
  transactions: Transaction[],
  plannedItems: PlannedItem[]
): MonthlyPlanSummary {
  const paidIncome = totalByType(transactions, "income");
  const paidExpense = totalByType(transactions, "expense");

  const activePlanned = plannedItems.filter((item) => item.status !== "skipped");
  const pendingItems = activePlanned
    .filter((item) => item.status === "planned")
    .sort((a, b) => a.dueDay - b.dueDay || a.title.localeCompare(b.title));

  const plannedIncome = totalPlannedByType(activePlanned, "income");
  const plannedExpense = totalPlannedByType(activePlanned, "expense");
  // Se já entrou mais do que o planejado, não há "ainda entra"
  const pendingIncome = Math.max(0, plannedIncome - paidIncome);
  const pendingExpense = Math.max(0, plannedExpense - paidExpense);

  const projectedIncome = paidIncome + pendingIncome;
  const projectedExpense = paidExpense + pendingExpense;

  return {
    plannedIncome,
    plannedExpense,
    paidIncome,
    paidExpense,
    pendingIncome,
    pendingExpense,
    projectedIncome,
    projectedExpense,
    projectedBalance: projectedIncome - projectedExpense,
    pendingItems
  };
}

function totalByType(items: Transaction[], type: "income" | "expense") {
  return items
    .filter((item) => item.type === type)
    .reduce((total, item) => total + item.amount, 0);
}

function totalPlannedByType(items: PlannedItem[], type: "income" | "expense") {
  return items
    .filter((item) => item.type === type)
    .reduce((total, item) => total + item.amount, 0);
}
