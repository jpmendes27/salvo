import type { Transaction } from "./types";

export const demoTransactions: Transaction[] = [
  {
    id: "demo-1",
    type: "income",
    description: "Salario",
    amount: 6200,
    category: "Renda",
    date: "2026-04-05",
    monthKey: "2026-04",
    createdBy: "demo",
    createdByName: "Voce"
  },
  {
    id: "demo-2",
    type: "expense",
    description: "Aluguel",
    amount: 1850,
    category: "Moradia",
    date: "2026-04-06",
    monthKey: "2026-04",
    createdBy: "demo",
    createdByName: "Voce"
  },
  {
    id: "demo-3",
    type: "expense",
    description: "Mercado do mes",
    amount: 980,
    category: "Alimentacao",
    date: "2026-04-08",
    monthKey: "2026-04",
    createdBy: "demo",
    createdByName: "Pessoa convidada"
  },
  {
    id: "demo-4",
    type: "expense",
    description: "Assinaturas",
    amount: 166,
    category: "Servicos",
    date: "2026-04-12",
    monthKey: "2026-04",
    createdBy: "demo",
    createdByName: "Voce"
  }
];

export const defaultCategories = [
  { name: "Renda", color: "#067a46", type: "income" },
  { name: "Moradia", color: "#2451a6", type: "expense" },
  { name: "Alimentacao", color: "#9a3412", type: "expense" },
  { name: "Transporte", color: "#5b21b6", type: "expense" },
  { name: "Saude", color: "#be123c", type: "expense" },
  { name: "Lazer", color: "#0f766e", type: "expense" },
  { name: "Servicos", color: "#52525b", type: "expense" }
] as const;
