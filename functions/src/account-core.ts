// ─── Motor de resumo de CONTA (server-side, PURO) ────────────────────────────
// Porta FIEL da lógica que hoje roda no browser (src/lib/summary.ts +
// src/app/home/page.tsx). Mesmos filtros, mesma definição de rendaRef, score,
// comprometimento e variação. Os nomes de campo da saída são os MESMOS que a
// generateDiagnosis já recebe hoje (DiagPayload), pra plugar sem adaptar.
//
// É PURA: recebe dados, devolve agregados. Não lê Firestore, não faz request.
// Cartão é lente separada — nunca entra aqui (source 'card' é filtrado fora).
//
// ÂNCORA DE RENDA: derivada do TRANSACIONAL (soma das entradas 'trabalho' via
// classifyIncome), não mais a renda declarada digitada no app.

import { classifyIncome, type IncomeKind } from "./income-core";

export type AccountTx = {
  type: "income" | "expense";
  amount: number;
  category: string;
  date: string;              // YYYY-MM-DD
  description?: string;      // texto cru do banco — âncora do classifyIncome
  source?: string;           // 'account' | 'card' | ausente
  sourceLabel?: string;
  internal?: boolean;        // movimento interno (cofrinho/CDB): real no ledger, neutro no score
};

export type AccountSummary = {
  // ── campos que a generateDiagnosis espera hoje (DiagPayload) ──
  totalGasto: number;
  totalEntradas: number;
  comprometimento: number;                                     // % da renda (0 = sem base)
  net: number;
  score: number | null;                                        // null = "Sem dados suficientes"
  topCat: { nome: string; valor: number; percentual: number } | null;
  expenseChange: number | null;                                // % vs mês anterior
  byCategory: Array<{ nome: string; valor: number }>;          // top 5, rótulo humano
  // ── extras úteis pro chamador (não vão pro prompt) ──
  rendaRef: number | null;                    // = renda DERIVADA (soma 'trabalho'), ou null
  expensesCount: number;
  // ── RENDA DERIVADA + sinal de CONFIANÇA (pro prompt calibrar a honestidade) ──
  renda: {
    derivada: number;                          // soma das entradas 'trabalho'
    confianca: "alta" | "baixa";               // alta = foto limpa; baixa = aponta a incerteza
    parcelaTrabalho: number;                   // 0..1 — quanto da entrada é renda clara
    breakdown: { trabalho: number; neutro: number; divida: number };
    itensNaoRenda: Array<{ descricao: string; valor: number; kind: IncomeKind; motivo: string }>;
  };
};

// Rótulos humanos — espelho de CATEGORY_LABELS (src/lib/parsers.ts).
const CATEGORY_LABELS: Record<string, string> = {
  Alimentacao: "Alimentação", Mercado: "Mercado", Transporte: "Transporte", Carro: "Carro",
  CartaoCredito: "Cartão de Crédito", Assinaturas: "Assinaturas", Saude: "Saúde", Varejo: "Varejo",
  Educacao: "Educação", Moradia: "Moradia", Contas: "Contas", Seguros: "Seguros", Taxas: "Taxas",
  Emprestimos: "Empréstimos", Doacoes: "Doações", Transferencias: "Transferências",
  Hospedagem: "Hospedagem", Viagem: "Viagem", Lazer: "Lazer", Recebimentos: "Recebimentos",
  Outros: "Outros",
};

// Espelho de inferSource (src/lib/summary.ts): só quando o campo `source`
// estruturado não é 'account'|'card', cai no rótulo.
function inferSource(sourceLabel?: string): "account" | "card" | undefined {
  if (!sourceLabel) return undefined;
  if (/cartão|fatura|card/i.test(sourceLabel)) return "card";
  return "account";
}
function resolveSource(t: AccountTx): "account" | "card" | undefined {
  return t.source === "account" || t.source === "card" ? t.source : inferSource(t.sourceLabel);
}

// Mês anterior a partir de um monthKey "YYYY-MM".
export function prevMonthKey(monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1, 1));
  d.setUTCMonth(d.getUTCMonth() - 1);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function buildAccountSummary(args: {
  transactions: AccountTx[];       // transações do MÊS de referência (todas as fontes)
  prevTransactions: AccountTx[];   // transações do mês ANTERIOR (todas as fontes)
  userNames: string[];             // displayName dos membros ativos (âncora do match de PIX próprio)
}): AccountSummary {
  const { transactions, prevTransactions, userNames } = args;

  // Conta = tudo que NÃO é cartão. Pontuável = conta sem os internos (neutros).
  const accountTx = transactions.filter((t) => resolveSource(t) !== "card");
  const scorable = accountTx.filter((t) => !t.internal);
  const expenses = scorable.filter((t) => t.type === "expense");

  const totalGasto = expenses.reduce((s, t) => s + t.amount, 0);
  const incomeTxs = scorable.filter((t) => t.type === "income");
  const totalEntradas = incomeTxs.reduce((s, t) => s + t.amount, 0);

  // ── RENDA DERIVADA DO TRANSACIONAL ─────────────────────────────────────────
  // A âncora deixou de ser a renda DECLARADA (valor digitado) e passou a ser o que o
  // dado sustenta: só as entradas classificadas como 'trabalho' (classifyIncome).
  // 'neutro' (transferência própria, resgate, estorno, rendimento) e 'divida'
  // (empréstimo recebido) NÃO são renda.
  const classificadas = incomeTxs.map((t) => ({
    tx: t,
    v: classifyIncome(
      { type: "income", description: t.description ?? "", amount: t.amount, internal: t.internal },
      { userNames }
    ),
  }));
  const somaPor = (k: IncomeKind) =>
    classificadas.filter((c) => c.v.kind === k).reduce((s, c) => s + c.tx.amount, 0);
  const breakdown = {
    trabalho: somaPor("trabalho"),
    neutro: somaPor("neutro"),
    divida: somaPor("divida"),
  };
  const rendaDerivada = breakdown.trabalho;

  // CONFIANÇA: quanto da entrada do mês é renda de trabalho CLARA. Alta = a foto é
  // limpa (a IA pode falar direto). Baixa = boa parte da entrada não é renda clara →
  // a IA mostra a incerteza em vez de decretar.
  const parcelaTrabalho = totalEntradas > 0 ? rendaDerivada / totalEntradas : 0;
  const rendaConfianca: "alta" | "baixa" =
    totalEntradas > 0 && parcelaTrabalho >= 0.8 ? "alta" : "baixa";

  // O que NÃO é renda — pra IA poder APONTAR a incerteza com honestidade (nunca inventar).
  const itensNaoRenda = classificadas
    .filter((c) => c.v.kind !== "trabalho")
    .map((c) => ({
      descricao: c.tx.description ?? "",
      valor: c.tx.amount,
      kind: c.v.kind,
      motivo: c.v.reason,
    }))
    .sort((a, b) => b.valor - a.valor);

  // Sem promessa furada: sem renda derivada (nada classificado como 'trabalho'),
  // rendaRef é null → score null → degrada honesto. Nunca base fabricada.
  const rendaRef = rendaDerivada > 0 ? rendaDerivada : null;
  const comprometimento =
    rendaRef && totalGasto > 0 ? Math.min(100, Math.round((totalGasto / rendaRef) * 100)) : 0;
  const ratio = rendaRef ? totalGasto / rendaRef : 0;

  const score: number | null =
    expenses.length === 0 || rendaRef === null
      ? null
      : ratio >= 2.0 ? 0
      : ratio >= 1.5 ? 1
      : ratio >= 1.0 ? 2.5
      : ratio >= 0.90 ? 4.5
      : ratio >= 0.75 ? 6.5
      : ratio >= 0.50 ? 8.5
      : 10;

  const byCatMap: Record<string, number> = {};
  for (const t of expenses) byCatMap[t.category] = (byCatMap[t.category] ?? 0) + t.amount;
  const byCatSorted = Object.entries(byCatMap).sort((a, b) => b[1] - a[1]);
  const label = (c: string) => CATEGORY_LABELS[c] ?? c;

  const top = byCatSorted[0] ?? null;
  const topCat = top
    ? {
        nome: label(top[0]),
        valor: top[1],
        percentual: totalGasto > 0 ? Math.round((top[1] / totalGasto) * 100) : 0,
      }
    : null;
  const byCategory = byCatSorted.slice(0, 5).map(([c, v]) => ({ nome: label(c), valor: v }));

  // Variação vs mês anterior — ESPELHO FIEL do app: o mês anterior é filtrado só por
  // source !== 'card' e NÃO exclui `internal` (o mês corrente exclui). Assimetria real
  // do app (home/page.tsx: prevTransactions só filtra cartão) — replicada de propósito
  // pra os números baterem com a tela. Sinalizada no relatório.
  const prevExpense = prevTransactions
    .filter((t) => resolveSource(t) !== "card")
    .filter((t) => t.type === "expense")
    .reduce((s, t) => s + t.amount, 0);

  const expenseChange =
    prevExpense > 0 && totalGasto > 0
      ? Math.round(((totalGasto - prevExpense) / prevExpense) * 100)
      : null;

  return {
    totalGasto,
    totalEntradas,
    comprometimento,
    net: totalEntradas - totalGasto,
    score,
    topCat,
    expenseChange,
    byCategory,
    rendaRef,
    expensesCount: expenses.length,
    renda: {
      derivada: rendaDerivada,
      confianca: rendaConfianca,
      parcelaTrabalho,
      breakdown,
      itensNaoRenda,
    },
  };
}
