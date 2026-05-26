const DIAG_VERSION = "v1";
const DIAG_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 dias

export type DiagPayload = {
  totalGasto: number;
  totalEntradas: number;
  comprometimento: number;
  net: number;
  score: number;
  topCat: { nome: string; valor: number; percentual: number } | null;
  expenseChange: number | null;
  byCategory: Array<{ nome: string; valor: number }>;
};

export type DiagResult = {
  narrativa: string;
  bullet1: string | null;
  bullet2: string | null;
  scoreLabel: string;
};

type DiagEntry = { fingerprint: string; data: DiagResult; savedAt: number };

export function buildDiagFingerprint(p: DiagPayload): string {
  const cats = p.byCategory.slice(0, 5)
    .map(c => `${c.nome}:${c.valor.toFixed(2)}`).join(",");
  const top = p.topCat
    ? `${p.topCat.nome}:${p.topCat.valor.toFixed(2)}:${p.topCat.percentual}`
    : "null";
  return [
    p.totalGasto.toFixed(2),
    p.totalEntradas.toFixed(2),
    p.comprometimento,
    p.net.toFixed(2),
    p.score,
    top,
    p.expenseChange ?? "null",
    cats,
  ].join("|");
}

function diagKey(workspaceId: string, monthKey: string): string {
  return `fincheck_diag_${DIAG_VERSION}_${workspaceId}_${monthKey}`;
}

export function readDiagCache(
  workspaceId: string,
  monthKey: string,
  fingerprint: string
): DiagResult | null {
  try {
    const raw = localStorage.getItem(diagKey(workspaceId, monthKey));
    if (!raw) return null;
    const entry: DiagEntry = JSON.parse(raw);
    if (entry.fingerprint !== fingerprint) return null;
    if (Date.now() - entry.savedAt > DIAG_TTL_MS) return null;
    return entry.data;
  } catch {
    return null;
  }
}

export function writeDiagCache(
  workspaceId: string,
  monthKey: string,
  fingerprint: string,
  data: DiagResult
): void {
  try {
    localStorage.setItem(
      diagKey(workspaceId, monthKey),
      JSON.stringify({ fingerprint, data, savedAt: Date.now() } satisfies DiagEntry)
    );
  } catch {
    // quota ou modo privado — falha silenciosamente
  }
}
