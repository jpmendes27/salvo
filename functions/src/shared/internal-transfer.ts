// ⚠️ GERADO por scripts/sync-shared.mjs — NÃO EDITE AQUI.
// Fonte da verdade: src/lib/shared/. Rode o build do functions pra regenerar.

// ─── Movimento interno (fonte da verdade compartilhada) ──────────────────────
// Aplicação/resgate de cofrinho/CDB/RDB/poupança/tesouro: TRANSAÇÕES REAIS (mexem
// no saldo, entram no ledger e na reconciliação), mas NEUTRAS no diagnóstico
// (dinheiro do próprio dono mudando de bolso — nem gasto nem receita). NÃO confundir
// com PIX/transferência a terceiro (essas continuam entrada/saída normal).
// Bank-agnostic por CONCEITO (não por banco): reserva/poupança do próprio dono.
//
// USADO POR: cliente (parseCSV/parseOFX/categorizeTransaction) E servidor
// (classifyServer/classifyIncome/import). UMA definição, dois chamadores.
export const INTERNAL_TRANSFER_PATTERNS: RegExp[] = [
  /cofrinho/,
  /caixinha/,
  /dinheiro\s+(reservado|retirado)/,
  /\bcdb\b/,
  /\brdb\b/,
  /(aplicac\w*|resgate)\s*(de\s+)?(cofrinho|caixinha|cdb|rdb|poupan|tesouro|investiment|fundo|reserva)/,
  /(aplicac\w*|resgate)\s+(automat\w*|program\w*)/,
  /poupan\w*\s+(aplicac|resgate)/,
];

export function isInternalTransfer(description: string): boolean {
  const n = (description ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
  return INTERNAL_TRANSFER_PATTERNS.some((p) => p.test(n));
}
