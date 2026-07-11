"use strict";
// ─── Motor de resumo de CONTA (server-side, PURO) ────────────────────────────
// Porta FIEL da lógica que hoje roda no browser (src/lib/summary.ts +
// src/app/home/page.tsx). Mesmos filtros, mesma definição de rendaRef, score,
// comprometimento e variação. Os nomes de campo da saída são os MESMOS que a
// generateDiagnosis já recebe hoje (DiagPayload), pra plugar sem adaptar.
//
// É PURA: recebe dados, devolve agregados. Não lê Firestore, não faz request.
// Cartão é lente separada — nunca entra aqui (source 'card' é filtrado fora).
Object.defineProperty(exports, "__esModule", { value: true });
exports.prevMonthKey = prevMonthKey;
exports.buildAccountSummary = buildAccountSummary;
// Rótulos humanos — espelho de CATEGORY_LABELS (src/lib/parsers.ts).
const CATEGORY_LABELS = {
    Alimentacao: "Alimentação", Mercado: "Mercado", Transporte: "Transporte", Carro: "Carro",
    CartaoCredito: "Cartão de Crédito", Assinaturas: "Assinaturas", Saude: "Saúde", Varejo: "Varejo",
    Educacao: "Educação", Moradia: "Moradia", Contas: "Contas", Seguros: "Seguros", Taxas: "Taxas",
    Emprestimos: "Empréstimos", Doacoes: "Doações", Transferencias: "Transferências",
    Hospedagem: "Hospedagem", Viagem: "Viagem", Lazer: "Lazer", Recebimentos: "Recebimentos",
    Outros: "Outros",
};
// Espelho de inferSource (src/lib/summary.ts): só quando o campo `source`
// estruturado não é 'account'|'card', cai no rótulo.
function inferSource(sourceLabel) {
    if (!sourceLabel)
        return undefined;
    if (/cartão|fatura|card/i.test(sourceLabel))
        return "card";
    return "account";
}
function resolveSource(t) {
    return t.source === "account" || t.source === "card" ? t.source : inferSource(t.sourceLabel);
}
// Mês anterior a partir de um monthKey "YYYY-MM".
function prevMonthKey(monthKey) {
    const [y, m] = monthKey.split("-").map(Number);
    const d = new Date(Date.UTC(y, m - 1, 1));
    d.setUTCMonth(d.getUTCMonth() - 1);
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}
function buildAccountSummary(args) {
    const { transactions, prevTransactions, monthlyIncome } = args;
    // Conta = tudo que NÃO é cartão. Pontuável = conta sem os internos (neutros).
    const accountTx = transactions.filter((t) => resolveSource(t) !== "card");
    const scorable = accountTx.filter((t) => !t.internal);
    const expenses = scorable.filter((t) => t.type === "expense");
    const totalGasto = expenses.reduce((s, t) => s + t.amount, 0);
    const totalEntradas = scorable
        .filter((t) => t.type === "income")
        .reduce((s, t) => s + t.amount, 0);
    // Sem promessa furada: sem base de renda real (renda <= 0 E sem entradas),
    // rendaRef é null → score null ("Sem dados suficientes"), nunca base fabricada.
    const rendaRef = monthlyIncome > 0 ? monthlyIncome : totalEntradas > 0 ? totalEntradas : null;
    const comprometimento = rendaRef && totalGasto > 0 ? Math.min(100, Math.round((totalGasto / rendaRef) * 100)) : 0;
    const ratio = rendaRef ? totalGasto / rendaRef : 0;
    const score = expenses.length === 0 || rendaRef === null
        ? null
        : ratio >= 2.0 ? 0
            : ratio >= 1.5 ? 1
                : ratio >= 1.0 ? 2.5
                    : ratio >= 0.90 ? 4.5
                        : ratio >= 0.75 ? 6.5
                            : ratio >= 0.50 ? 8.5
                                : 10;
    const byCatMap = {};
    for (const t of expenses)
        byCatMap[t.category] = (byCatMap[t.category] ?? 0) + t.amount;
    const byCatSorted = Object.entries(byCatMap).sort((a, b) => b[1] - a[1]);
    const label = (c) => CATEGORY_LABELS[c] ?? c;
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
    const expenseChange = prevExpense > 0 && totalGasto > 0
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
    };
}
//# sourceMappingURL=account-core.js.map