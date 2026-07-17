// ─── Distinção de RENDA nas entradas (incomeKind) — FUNÇÃO PURA ──────────────
// Classifica cada transação de ENTRADA em:
//   'trabalho' → conta como RENDA (salário, pró-labore, aposentadoria, freela, PIX de terceiro)
//   'neutro'   → NÃO é renda (transferência própria, resgate/aplicação, cofrinho, reembolso)
//   'divida'   → NÃO é renda (empréstimo/financiamento recebido) — guardado separado do
//                'neutro' pro oráculo usar depois, mesmo que o cálculo trate os dois igual hoje.
//
// Espelha o padrão determinístico que já existe (isInternalTransfer): regex sobre a
// descrição, sem IA. É PURA: recebe a transação + o nome do usuário, devolve o kind + o
// motivo. Não lê Firestore, não persiste nada — pode ser calculada on-the-fly, igual o
// `internal` já é usado.

import { isInternalTransfer } from "./pdf-core";

export type IncomeKind = "trabalho" | "neutro" | "divida";

export type IncomeTx = {
  type: "income" | "expense";
  description: string;
  amount: number;
  internal?: boolean; // se já veio marcado na persistência, respeitamos
};

export type IncomeVerdict = { kind: IncomeKind; reason: string };

const norm = (s: string) =>
  (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().trim();

// ── Regras determinísticas por descrição ─────────────────────────────────────
// Empréstimo/financiamento RECEBIDO: é entrada, mas é dívida — nunca renda.
const DIVIDA_PATTERNS = [
  /\bEMPRESTIMO\b/, /\bEMPRÉSTIMO\b/, /\bFINANCIAMENTO\b/,
  /\bCREDITO\s+PESSOAL\b/, /\bCONSIGNADO\b/, /\bCREDITO\s+CONSIGNADO\b/,
  /\bANTECIPACAO\b/, /\bCAPITAL\s+DE\s+GIRO\b/,
];

// Reembolso / estorno / devolução: dinheiro voltando — não é renda nova.
const REEMBOLSO_PATTERNS = [
  /\bESTORNO\b/, /\bREEMBOLSO\b/, /\bDEVOLUCAO\b/, /\bRESSARCIMENTO\b/, /\bCHARGEBACK\b/,
];

// Renda de trabalho explícita na descrição.
const TRABALHO_PATTERNS = [
  /\bSALARIO\b/, /\bPRO\s*-?\s*LABORE\b/, /\bPROLABORE\b/, /\bHOLERITE\b/, /\bFOLHA\s+DE\s+PAGAMENTO\b/,
  /\bAPOSENTADORIA\b/, /\bPENSAO\b/, /\bBENEFICIO\s+INSS\b/, /\bINSS\b/,
  /\bDECIMO\s+TERCEIRO\b/, /\b13\s*O?\s+SALARIO\b/, /\bFERIAS\b/,
  /\bHONORARIOS\b/, /\bFREELA\b/, /\bFREELANCE\b/, /\bVALE\b.*\bPAGAMENTO\b/,
];

// Rendimento de investimento (juros/poupança/cashback): entrou, mas NÃO é renda de trabalho.
// ⚠️ DECISÃO A VALIDAR: tratado como 'neutro' (segue a régua "resgate de investimento não conta").
const RENDIMENTO_PATTERNS = [/\bRENDIMENTO/, /\bJUROS\b/, /\bCASHBACK\b/, /\bDIVIDENDO/];

// PIX/TED/transferência RECEBIDA — o caso difícil (própria vs terceiro).
const RECEBIMENTO_TRANSFER_PATTERNS = [
  /\bPIX\b.*\bRECEBID/, /\bRECEBID.*\bPIX\b/, /\bTRANSFERENCIA\s+RECEBIDA\b/,
  /\bTED\s+RECEBID/, /\bDOC\s+RECEBID/, /\bDEPOSITO\b/,
];

// ── Similaridade de nome (tolerante a variação de banco) ─────────────────────
// "JOAO P M SILVA" tem que casar com "João Paulo Mendes da Silva".
const STOP = new Set(["DE", "DA", "DO", "DAS", "DOS", "E"]);
// Ruído bancário que NÃO é nome de gente (evita "DEPOSITO EM DINHEIRO" virar remetente).
const NOISE = new Set([
  "EM", "DINHEIRO", "ESPECIE", "CAIXA", "CONTA", "CORRENTE", "POUPANCA",
  "BANCO", "AGENCIA", "ELETRONICO", "ONLINE", "AUTOATENDIMENTO", "TERMINAL",
]);

function nameTokens(s: string): string[] {
  return norm(s)
    .replace(/[^A-Z\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 0 && !STOP.has(t));
}

// Jaro-Winkler compacto — tolera erro de grafia/abreviação do banco.
function jaroWinkler(a: string, b: string): number {
  if (a === b) return 1;
  const la = a.length, lb = b.length;
  if (!la || !lb) return 0;
  const win = Math.max(0, Math.floor(Math.max(la, lb) / 2) - 1);
  const ma = new Array(la).fill(false), mb = new Array(lb).fill(false);
  let m = 0;
  for (let i = 0; i < la; i++) {
    for (let j = Math.max(0, i - win); j < Math.min(lb, i + win + 1); j++) {
      if (!mb[j] && a[i] === b[j]) { ma[i] = mb[j] = true; m++; break; }
    }
  }
  if (!m) return 0;
  let t = 0, k = 0;
  for (let i = 0; i < la; i++) {
    if (!ma[i]) continue;
    while (!mb[k]) k++;
    if (a[i] !== b[k]) t++;
    k++;
  }
  const jaro = (m / la + m / lb + (m - t / 2) / m) / 3;
  let p = 0;
  while (p < 4 && p < la && p < lb && a[p] === b[p]) p++;
  return jaro + p * 0.1 * (1 - jaro);
}

// Dois tokens casam se: iguais, um é a INICIAL do outro, ou grafia muito próxima.
function tokenMatch(a: string, b: string): boolean {
  if (a === b) return true;
  if (a.length === 1 && b.startsWith(a)) return true; // "P" ↔ "PAULO"
  if (b.length === 1 && a.startsWith(b)) return true;
  return jaroWinkler(a, b) >= 0.88;
}

// Fração dos tokens do REMETENTE que casaram com o nome do usuário, + quantos casaram.
export function nameSimilarity(sender: string, user: string): { score: number; matched: number } {
  const S = nameTokens(sender), U = nameTokens(user);
  if (!S.length || !U.length) return { score: 0, matched: 0 };
  const used = new Set<number>();
  let matched = 0;
  for (const s of S) {
    for (let i = 0; i < U.length; i++) {
      if (used.has(i)) continue;
      if (tokenMatch(s, U[i])) { matched++; used.add(i); break; }
    }
  }
  return { score: matched / S.length, matched };
}

// Casa se a maior parte dos tokens do remetente bate E pelo menos 2 tokens casaram
// (evita falso positivo por um "JOAO" solto).
const SIM_THRESHOLD = 0.6;
function isSameHolder(sender: string, userNames: string[]): boolean {
  return userNames.some((u) => {
    const { score, matched } = nameSimilarity(sender, u);
    return score >= SIM_THRESHOLD && matched >= 2;
  });
}

// Reduz um trecho a tokens de nome limpos (sem dígitos, sem lixo). null se sobrar < 2
// tokens alfabéticos (o extrato não trouxe um nome de remetente utilizável).
function cleanNameTokens(s: string): string | null {
  const toks = s
    .replace(/\d/g, " ")                    // CPF/CNPJ, datas, valores
    .replace(/[^A-Z\s]/g, " ")              // bullets, pontos, barras, parênteses
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter((t) => t.length > 1 && !STOP.has(t) && !NOISE.has(t));
  return toks.length >= 2 ? toks.join(" ") : null;
}

// Tira os prefixos do banco e o lixo → sobra só o nome do remetente.
// Formato Nubank/afins delimitado por " - ": "[prefixo] - NOME - CPF/CNPJ - INSTITUIÇÃO".
// O NOME é o segmento IMEDIATAMENTE ANTES do documento (CPF ou CNPJ), seja PF ou PJ —
// isolar só ele evita que a instituição ("MERCADO PAGO IP LTDA") entre como parte do
// nome e dilua o match do titular abaixo do limiar. Sem separadores/documento (nome
// inline, sem CPF), varre a linha inteira como antes.
export function extractSenderName(description: string): string | null {
  const raw = norm(description);
  const segments = raw.split(/\s+-\s+/).map((x) => x.trim()).filter(Boolean);
  if (segments.length >= 2) {
    // Documento = segmento formado só por dígitos/bullets/pontuação (CPF mascarado
    // "•••.307.547-••" ou CNPJ "46.992.102/0001-31"). O nome vem logo antes dele.
    const isDoc = (s: string) => /[\d*•]/.test(s) && /^[\d*•.\-\/\s]+$/.test(s);
    const docIdx = segments.findIndex(isDoc);
    if (docIdx >= 1) return cleanNameTokens(segments[docIdx - 1]);
  }
  return cleanNameTokens(
    raw.replace(/\bPIX\b|\bTED\b|\bDOC\b|\bRECEBIDA?O?\b|\bENVIADA?O?\b|\bTRANSFERENCIA\b|\bDEPOSITO\b|\bPELO\b|\bDE\b/g, " ")
  );
}

// ── Classificador ────────────────────────────────────────────────────────────
export function classifyIncome(
  tx: IncomeTx,
  ctx: { userNames: string[] }
): IncomeVerdict {
  const d = norm(tx.description);

  // 1) NEUTRO já detectado pela reconciliação (cofrinho, CDB/RDB, aplicação/resgate,
  //    dinheiro reservado/retirado). REUSA o mecanismo existente — não reinventa.
  if (tx.internal === true || isInternalTransfer(tx.description)) {
    return { kind: "neutro", reason: "movimento interno (internal) — resgate/aplicação/reserva" };
  }

  // 2) DÍVIDA: empréstimo/financiamento recebido. Entra no ledger, mas NUNCA é renda.
  if (DIVIDA_PATTERNS.some((p) => p.test(d))) {
    return { kind: "divida", reason: "descrição indica empréstimo/financiamento recebido" };
  }

  // 3) Reembolso/estorno: dinheiro voltando, não é renda nova.
  if (REEMBOLSO_PATTERNS.some((p) => p.test(d))) {
    return { kind: "neutro", reason: "estorno/reembolso — dinheiro voltando, não é renda nova" };
  }

  // 4) Renda de trabalho explícita.
  if (TRABALHO_PATTERNS.some((p) => p.test(d))) {
    return { kind: "trabalho", reason: "descrição indica renda de trabalho (salário/pró-labore/etc.)" };
  }

  // 5) Rendimento de investimento — entrou, mas não é renda de trabalho.
  //    ⚠️ Decisão a validar com o produto (ver comentário acima).
  if (RENDIMENTO_PATTERNS.some((p) => p.test(d))) {
    return { kind: "neutro", reason: "rendimento/juros de investimento — não é renda de trabalho" };
  }

  // 6) CASO DIFÍCIL — PIX/TED/transferência recebida: própria (neutro) ou de terceiro (trabalho)?
  if (RECEBIMENTO_TRANSFER_PATTERNS.some((p) => p.test(d))) {
    const sender = extractSenderName(tx.description);
    if (!sender) {
      // FALLBACK (viés deliberado): extrato não trouxe o nome do remetente. Assumimos
      // 'trabalho' — fiel à fotografia: o dinheiro ENTROU, melhor contar como renda do
      // que sumir com ela.
      // 👉 PRA INVERTER O VIÉS: troque "trabalho" por "neutro" nesta linha.
      return { kind: "trabalho", reason: "transferência recebida sem nome de remetente no extrato → assume renda (viés: não sumir com dinheiro que entrou)" };
    }
    if (isSameHolder(sender, ctx.userNames)) {
      return { kind: "neutro", reason: `remetente "${sender}" casou com o nome do onboarding → transferência própria` };
    }
    return { kind: "trabalho", reason: `remetente "${sender}" NÃO casou com o nome do onboarding → renda de terceiro` };
  }

  // 7) Entrada não reconhecida. Mesmo viés do fallback: o dinheiro entrou → conta.
  // 👉 PRA INVERTER O VIÉS: troque "trabalho" por "neutro" nesta linha.
  return { kind: "trabalho", reason: "entrada não reconhecida → assume renda (viés: não sumir com dinheiro que entrou)" };
}
