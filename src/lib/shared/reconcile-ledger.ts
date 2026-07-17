// ─── Reconciliação de extrato (fonte da verdade compartilhada) ───────────────
// Integer centavos. Cadeia de saldo por linha/dia + totais do cabeçalho. PURO:
// recebe arrays, devolve veredito. Sem I/O, sem SDK. UMA definição, dois chamadores
// (servidor: processImportJob; cliente: quando/se precisar reconciliar no browser).

export function reconcileServer(
  txs: Array<{ signedCents: number; balanceCents?: number }>,
  initialBalanceCents?: number,
  finalBalanceCents?: number,
  toleranceCents = 2
): { ok: boolean; validated: boolean; suspectIndices: number[]; reason?: string } {
  if (txs.length === 0)
    return { ok: false, validated: false, suspectIndices: [], reason: "nenhuma transação extraída" };

  if (finalBalanceCents === undefined)
    return { ok: false, validated: false, suspectIndices: [], reason: "saldo final não encontrado no documento" };

  const hasBalance = txs.some((t) => t.balanceCents !== undefined);

  if (!hasBalance) {
    if (initialBalanceCents === undefined)
      return { ok: false, validated: false, suspectIndices: [], reason: "saldo inicial não encontrado" };
    const sumCents = txs.reduce((s, t) => s + t.signedCents, 0);
    const ok = Math.abs(sumCents - (finalBalanceCents - initialBalanceCents)) <= toleranceCents;
    return { ok, validated: true, suspectIndices: ok ? [] : [-1], reason: ok ? undefined : "soma dos valores não bate com os saldos" };
  }

  const inferredInitial =
    txs[0].balanceCents !== undefined ? txs[0].balanceCents - txs[0].signedCents : undefined;
  const initial = initialBalanceCents ?? inferredInitial;
  if (initial === undefined)
    return { ok: false, validated: false, suspectIndices: [], reason: "saldo inicial não encontrado" };

  let running = initial;
  const suspectIndices: number[] = [];
  for (let i = 0; i < txs.length; i++) {
    running += txs[i].signedCents;
    const bc = txs[i].balanceCents;
    if (bc !== undefined && Math.abs(running - bc) > toleranceCents) {
      suspectIndices.push(i);
      running = bc;
    }
  }

  const finalOk = Math.abs(running - finalBalanceCents) <= toleranceCents;
  const ok = suspectIndices.length === 0 && finalOk;
  return { ok, validated: true, suspectIndices, reason: ok ? undefined : "cadeia de saldo não fecha no saldo final" };
}

// ─── Reconciliation CASCADE (by checkpoint granularity) ───────────────────────
// Reconcile against whatever granularity the document itself declares, in
// integer cents. Passes if ANY applicable granularity closes:
//   1. line   — balance on (almost) every tx line (Mercado Pago). Strict.
//   2. day    — balance only on day checkpoints (e.g. Itaú "SALDO DO DIA").
//   3. totals — balance only in the header (initial + Σ = final).
// "none" only when nothing applicable closes (or there's no balance to anchor).
// Never blocks — the caller decides verificado vs nao_conferido from `ok`.
export type LedgerVerification = {
  mode: "line" | "day" | "totals" | "none";
  ok: boolean;
  readBalanceCents?: number;     // initial + Σ movimentos
  declaredBalanceCents?: number; // saldo final declarado (header ou último checkpoint)
  deltaCents?: number;           // declared - read (o que faltou), quando ambos conhecidos
};

export function reconcileLedger(
  txs: Array<{ date: string; signedCents: number; balanceCents?: number }>,
  checkpoints: Array<{ date: string; balanceCents: number }>,
  initialBalanceCents?: number,
  finalBalanceCents?: number
): LedgerVerification {
  const EXACT = 0; // checkpoint sums are computed — devem bater ao centavo
  const readTotal = txs.reduce((s, t) => s + t.signedCents, 0);

  const readBalanceCents = initialBalanceCents !== undefined ? initialBalanceCents + readTotal : undefined;
  const declaredBalanceCents =
    finalBalanceCents !== undefined
      ? finalBalanceCents
      : checkpoints.length
      ? [...checkpoints].sort((a, b) => a.date.localeCompare(b.date))[checkpoints.length - 1].balanceCents
      : undefined;
  const deltaCents =
    declaredBalanceCents !== undefined && readBalanceCents !== undefined
      ? declaredBalanceCents - readBalanceCents
      : undefined;
  const base = { readBalanceCents, declaredBalanceCents, deltaCents };

  // 1 — LINE chain (MP). Reuse the strict per-line reconciler (unchanged).
  const withBalance = txs.filter((t) => t.balanceCents !== undefined).length;
  if (txs.length > 0 && withBalance >= Math.ceil(txs.length * 0.8)) {
    const r = reconcileServer(
      txs.map((t) => ({ signedCents: t.signedCents, balanceCents: t.balanceCents })),
      initialBalanceCents,
      finalBalanceCents
    );
    if (r.ok) return { mode: "line", ok: true, ...base };
  }

  // 2 — DAY chain. Walk checkpoints chronologically; running balance after each
  // day's transactions must equal that day's declared balance.
  if (checkpoints.length > 0) {
    const cps = [...checkpoints].sort((a, b) => a.date.localeCompare(b.date));
    const sortedTx = [...txs].sort((a, b) => a.date.localeCompare(b.date));
    let start = initialBalanceCents;
    if (start === undefined) {
      // No header anchor: infer the opening from the first checkpoint minus its
      // day's transactions (the first checkpoint then sets the baseline).
      const firstDaySum = sortedTx.filter((t) => t.date <= cps[0].date).reduce((s, t) => s + t.signedCents, 0);
      start = cps[0].balanceCents - firstDaySum;
    }
    let running = start;
    let ti = 0;
    let dayOk = true;
    for (const cp of cps) {
      while (ti < sortedTx.length && sortedTx[ti].date <= cp.date) { running += sortedTx[ti].signedCents; ti++; }
      if (Math.abs(running - cp.balanceCents) > EXACT) { dayOk = false; break; }
    }
    if (dayOk) {
      while (ti < sortedTx.length) { running += sortedTx[ti].signedCents; ti++; }
      const finalOk = finalBalanceCents === undefined || Math.abs(running - finalBalanceCents) <= EXACT;
      if (finalOk) return { mode: "day", ok: true, ...base };
    }
  }

  // 3 — TOTALS: as pontas batem EXATAMENTE. Compara o saldo declarado (final do
  // cabeçalho, ou o último checkpoint quando não há cabeçalho) com o saldo lido
  // (inicial + Σ). Delta zero = a conta fecha de ponta a ponta = conferido — mesmo
  // que um checkpoint de dia intermediário não tenha encadeado (linha com data
  // trocada, dia partido). A cadeia por dia acima é o passe mais rígido; este é o
  // piso honesto. Delta zero NUNCA é falha (senão vira "faltou R$ 0,00").
  if (deltaCents !== undefined && Math.abs(deltaCents) <= EXACT) {
    return { mode: "totals", ok: true, ...base };
  }

  return { mode: "none", ok: false, ...base };
}
