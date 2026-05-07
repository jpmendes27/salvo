export type ParsedTransaction = {
  type: "income" | "expense";
  description: string;
  amount: number;
  date: string;
  monthKey: string;
  category: string;
  dedupKey: string;
  sourceLabel?: string;
};

// ─── 19 categorias fixas ─────────────────────────────────────────────────────

export const CATEGORIES = [
  "Alimentacao",
  "Mercado",
  "Transporte",
  "Combustivel",
  "Assinaturas",
  "Saude",
  "Varejo",
  "Educacao",
  "Moradia",
  "Contas",
  "Seguros",
  "Taxas",
  "Emprestimos",
  "Doacoes",
  "Transferencias",
  "Hospedagem",
  "Viagem",
  "Lazer",
  "Recebimentos",
  "Outros"
] as const;

export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_COLORS: Record<Category, string> = {
  Alimentacao:    "#f5a623",
  Mercado:        "#5c9eff",
  Transporte:     "#4dcc8f",
  Combustivel:    "#4dcc8f",
  Assinaturas:    "#a78bfa",
  Saude:          "#ff5c5c",
  Varejo:         "#5c9eff",
  Educacao:       "#5c9eff",
  Moradia:        "#5c9eff",
  Contas:         "#4dcc8f",
  Seguros:        "#ff5c5c",
  Taxas:          "#ff8c42",
  Emprestimos:    "#ff5c5c",
  Doacoes:        "#c8f564",
  Transferencias: "#6b7080",
  Hospedagem:     "#ff5c5c",
  Viagem:         "#ff5c5c",
  Lazer:          "#c8f564",
  Recebimentos:   "#4dcc8f",
  Outros:         "#6b7080"
};

// ─── Keyword map ──────────────────────────────────────────────────────────────
// Ordenado por tamanho no build, evita match errado por substring curta.

const CATEGORY_MAP: Record<string, string[]> = {
  Alimentacao: [
    "restaurante", "lanchonete", "churrascaria", "pizzaria", "hamburguer",
    "hamburger", "japanese", "japonesa", "china in box", "madero",
    "coco bambu", "fogo de chao", "pizza hut", "burger king",
    "mc donalds", "mcdonalds", "outback", "giraffas", "vivenda",
    "spoleto", "habib", "subway", "kfc", "bobs", "bob s",
    "uber eats", "ubereats", "james delivery", "aiqfome", "pede pronto",
    "deliway", "goomer", "ifood", "ifd", "rappi",
    "sorveteria", "confeitaria", "cafeteria", "padaria", "cantina",
    "boteco", "bar e", "quentinha", "marmita", "cafe",
    "sushi", "acai", "doces", "delivery"
  ],
  Mercado: [
    "pao de acucar", "magazine luiza mercado", "supermercado",
    "hipermercado", "atacadao", "atacado", "hortifruti",
    "carrefour", "walmart", "assai", "prezunic", "st marche",
    "zona sul", "condor", "bergamini", "g barbosa", "bistek",
    "mundial", "sonda", "big bom", "rede top", "mercadinho",
    "mercado", "extra mkt", "feira", "sacolao"
  ],
  Transporte: [
    "bilhete unico", "passagem metro", "transporte urbano",
    "cartao transporte", "passagem rod", "rodoviaria",
    "metrô", "metro", "sptrans", "onibus", "ônibus",
    "cabify", "99pop", "99 ", "uber", "taxi", "taxista",
    "brt", "vlt", "trem", "terminal"
  ],
  Combustivel: [
    "combustivel", "br distribuidora", "ale combustiveis",
    "auto posto", "gasolina", "alcool combust",
    "ipiranga", "petrobras", "raizen", "etanol",
    "shell", "posto", "gnv", "diesel"
  ],
  Assinaturas: [
    "amazon prime", "amazon music", "disney plus", "youtube premium",
    "globoplay", "telecine", "hbo max", "office 365", "office365",
    "linkedin premium", "deezer", "netflix", "spotify", "disney",
    "apple music", "applecombill", "apple.com", "apple -", "apple", "google play",
    "openai", "chatgpt", "claude", "cloudflare",
    "adobe", "microsoft", "canva", "figma", "notion",
    "kaspersky", "antivirus", "dropbox", "icloud", "onedrive",
    "github", "duolingo", "nucel", "plano nu",
    "wellhub", "gympass", "br gym", "brgym", "totalpass", "total pass",
    "assinatura", "mensalidade sistema"
  ],
  Saude: [
    "pronto socorro", "plano de saude", "bradesco saude",
    "sulamerica saude", "clinica vet", "droga raia",
    "pague menos", "ultrafarma", "drogasil", "drogasmil", "notredame",
    "laboratorio", "fisioterapia", "psicologo", "psiquiatra",
    "farmacia", "drogaria", "hospital", "clinica", "hapvida",
    "unimed", "exame", "ultrasom", "raio x", "terapia",
    "medico", "medica", "dentista", "veterinario",
    "pet shop", "amil", "convênio", "copay"
  ],
  Varejo: [
    "magazine luiza", "casas bahia", "mercado livre",
    "leroy merlin", "telhanorte", "shopee", "shein",
    "aliexpress", "americanas", "submarino", "netshoes",
    "tok stok", "le biscuit", "ri happy", "pbkids",
    "riachuelo", "magalu", "renner", "zara", "hering",
    "centauro", "decathlon", "kalunga", "ikea", "etna",
    "cea", "loja", "shopping", "outlet", "boutique", "eletro"
  ],
  Educacao: [
    "material escolar", "mensalidade escola", "mensalidade colegio",
    "quero educacao", "faculdade", "universidade",
    "livraria", "alura", "udemy", "coursera", "descomplica",
    "saraiva", "cultura livros", "vestibular",
    "escola", "colegio", "educacao", "matricula", "curso"
  ],
  Moradia: [
    "taxa condominio", "caixa habitacao", "minha casa",
    "administracao imovel", "imobiliaria", "condominio",
    "aluguel", "iptu"
  ],
  Contas: [
    "internet residencial", "tv por assinatura", "debito automatico conta",
    "fatura energia", "fatura agua", "banda larga",
    "claro residencial", "vivo fixo", "tim fixo", "oi fixo",
    "conta de luz", "conta de agua", "conta de gas",
    "gas natural", "neoenergia", "eletropaulo",
    "energisa", "elektro", "sabesp", "cedae", "copasa",
    "saneago", "embasa", "comgas", "enel", "cpfl",
    "cemig", "coelba", "light", "sky", "directv",
    "ultragaz res"
  ],
  Seguros: [
    "porto seguro", "bradesco seguros", "liberty seguros",
    "tokio marine", "hdi seguros", "azul seguros",
    "premio seguro", "apolice", "suhai", "sompo",
    "allianz", "mapfre", "previdencia", "sinistro", "seguro"
  ],
  Taxas: [
    "iof de", "iof",
    "multa de atraso", "multa",
    "juros de", "juros mora", "juros",
    "encargo", "tarifa bancaria", "tarifa de", "taxa de",
    "taxa cartao", "taxa admin", "taxa manutencao",
    "anuidade", "mora", "comissao",
    "encerramento de divida", "encerramento de conta"
  ],
  Emprestimos: [
    "credito pessoal", "credito consignado", "bom pra credito",
    "prestacao emprest", "bv financeira", "banco pan",
    "sicoob cred", "sicredi cred", "portocred",
    "emprestimo", "financiamento", "consignado",
    "crefisa", "afinz", "bcredi", "creditas",
    "lendico", "parcela", "cdc"
  ],
  Doacoes: [
    "medicos sem fronteiras", "amigos do bem",
    "contribuicao voluntaria", "acao social",
    "greenpeace", "unicef", "fundacao", "pastoral",
    "instituto", "caridade", "dizimo", "oferta", "doacao"
  ],
  Transferencias: [
    "pagamento entre contas", "transferencia", "portabilidade",
    "envio pix", "transf", "ted", "doc", "pix"
  ],
  Hospedagem: [
    "apart hotel", "holiday inn", "intercontinental",
    "airbnb", "booking", "pousada", "hostel",
    "hilton", "marriott", "mercure", "ibis",
    "hotel", "flat", "suite"
  ],
  Viagem: [
    "passagem aerea", "agencia de viagem", "costa cruzeiros",
    "embarque aereo", "decolar", "expedia",
    "avianca", "cruzeiro", "latam", "kayak",
    "trivago", "hurb", "cvc", "aeroporto",
    "passaporte", "visto", "msc", "gol", "azul", "tam"
  ],
  Lazer: [
    "estudio pilates", "escape room", "laser tag",
    "ticketmaster", "ticket360", "paintball", "karting",
    "exposicao", "boliche", "bodytech", "bluefit",
    "smartfit", "crossfit", "academia", "sympla",
    "eventim", "ingresso", "natacao", "cinema",
    "teatro", "parque", "museu", "clube", "show"
  ]
};

// ─── Motor de classificação ───────────────────────────────────────────────────

function normalizeDesc(s: string): string {
  return s
    .toUpperCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Pré-computa lista ordenada do mais longo pro mais curto (uma vez)
const SORTED_KEYWORDS: Array<{ kw: string; cat: string }> = Object.entries(
  CATEGORY_MAP
)
  .flatMap(([cat, kws]) => kws.map((kw) => ({ kw: normalizeDesc(kw), cat })))
  .sort((a, b) => b.kw.length - a.kw.length);

// Padrões que devem sempre cair em "Outros" antes do keyword matching
const FORCE_OUTROS: RegExp[] = [
  /ALUGUEL\s+DE\s+PARC/,
];

export function categorizeTransaction(
  description: string,
  type: "income" | "expense"
): string {
  // Regra 1: entradas → Recebimentos
  if (type === "income") return "Recebimentos";

  const norm = normalizeDesc(description);

  if (FORCE_OUTROS.some((p) => p.test(norm))) return "Outros";

  // Keyword matching primeiro (longest first)
  for (const { kw, cat } of SORTED_KEYWORDS) {
    if (norm.includes(kw)) return cat;
  }

  // CREDITO sozinho como fallback (ex: "PIX Credito" sem keyword conhecido)
  if (norm.includes("CREDITO")) {
    if (/EMPRESTIMO|FINANCIAMENTO|AFINZ/.test(norm)) return "Emprestimos";
    return "Recebimentos";
  }

  return "Outros";
}

// Mantido como alias pra compatibilidade com código legado
export function guessCategory(description: string): string {
  return categorizeTransaction(description, "expense");
}

// ─── Parsers de arquivo ───────────────────────────────────────────────────────

function parseDate(raw: string): string | null {
  const d8 = raw.match(/^(\d{4})(\d{2})(\d{2})/);
  if (d8) return `${d8[1]}-${d8[2]}-${d8[3]}`;
  const dmy = raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  return null;
}

function monthKeyFromDate(date: string): string {
  return date.slice(0, 7);
}

function makeDedupKey(date: string, description: string, amount: number): string {
  return `${date}|${description.toLowerCase().trim()}|${Math.abs(amount).toFixed(2)}`;
}

function parseBRNumber(raw: string): number {
  const cleaned = raw.replace(/\s/g, "");
  if (/^\-?[\d.]+,\d{2}$/.test(cleaned)) {
    return parseFloat(cleaned.replace(/\./g, "").replace(",", "."));
  }
  return parseFloat(cleaned.replace(",", "."));
}

function sourceLabelFromFilename(filename: string): string {
  const base = filename.replace(/\.[^.]+$/, "").replace(/[-_]/g, " ").trim();
  const lower = base.toLowerCase();
  if (lower.includes("nubank")) return "Nubank";
  if (lower.includes("picpay")) return "PicPay";
  if (lower.includes("afinz")) return "Afinz";
  if (lower.includes("inter")) return "Banco Inter";
  if (lower.includes("itau") || lower.includes("itaú")) return "Itaú";
  if (lower.includes("bradesco")) return "Bradesco";
  if (lower.includes("santander")) return "Santander";
  if (lower.includes("caixa")) return "Caixa";
  if (lower.includes("bb") || lower.includes("banco do brasil")) return "Banco do Brasil";
  if (lower.includes("c6")) return "C6 Bank";
  if (lower.includes("xp")) return "XP";
  return base.slice(0, 32) || "Importação";
}

export function parseCSV(text: string, filename = ""): ParsedTransaction[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];

  const delimiter = lines[0].includes(";") ? ";" : ",";
  const rows = lines.map((l) =>
    l.split(delimiter).map((c) => c.trim().replace(/^["']|["']$/g, ""))
  );

  const normalize = (s: string) =>
    s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
  const header = rows[0].map(normalize);

  const dateCol = header.findIndex(
    (h) => h === "data" || h.includes("data lan") || h === "date"
  );
  const descCol = header.findIndex(
    (h) =>
      h.includes("historico") ||
      h.includes("descricao") ||
      h.includes("lancamento") ||
      h === "description" ||
      h === "memo" ||
      h === "estabelecimento" ||
      h === "nome"
  );
  const valueCol = header.findIndex(
    (h) =>
      h === "valor" ||
      h === "value" ||
      h === "amount" ||
      h.includes("debito") ||
      h.includes("credito") ||
      h.includes("quantia")
  );

  if (dateCol === -1 || valueCol === -1) return [];

  const result: ParsedTransaction[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row.length < 2) continue;

    const rawDate = (row[dateCol] || "").trim();
    const rawDesc = descCol >= 0 ? (row[descCol] || "").trim() : "Sem descricao";
    const rawValue = (row[valueCol] || "").trim();

    const date = parseDate(rawDate);
    if (!date) continue;

    const amount = parseBRNumber(rawValue);
    if (isNaN(amount) || amount === 0) continue;

    const type = amount < 0 ? "expense" : "income";
    result.push({
      type,
      description: rawDesc,
      amount: Math.abs(amount),
      date,
      monthKey: monthKeyFromDate(date),
      category: categorizeTransaction(rawDesc, type),
      dedupKey: makeDedupKey(date, rawDesc, amount),
      sourceLabel: sourceLabelFromFilename(filename)
    });
  }

  return result;
}

export function parseOFX(text: string, filename = ""): ParsedTransaction[] {
  const result: ParsedTransaction[] = [];

  const extractField = (block: string, tag: string): string =>
    block.match(new RegExp(`<${tag}>([^<\n\r]+)`, "i"))?.[1]?.trim() ?? "";

  const xmlBlocks = text.match(/<STMTTRN>[\s\S]*?<\/STMTTRN>/gi) ?? [];
  if (xmlBlocks.length > 0) {
    for (const block of xmlBlocks) {
      const dtposted = extractField(block, "DTPOSTED");
      const trnamt = extractField(block, "TRNAMT");
      const memo = extractField(block, "MEMO");
      const name = extractField(block, "NAME");

      const date = parseDate(dtposted);
      if (!date) continue;
      const amount = parseFloat(trnamt);
      if (isNaN(amount)) continue;

      const description = memo || name || "Transacao";
      const type = amount < 0 ? "expense" : "income";
      result.push({
        type,
        description,
        amount: Math.abs(amount),
        date,
        monthKey: monthKeyFromDate(date),
        category: categorizeTransaction(description, type),
        dedupKey: makeDedupKey(date, description, amount),
        sourceLabel: sourceLabelFromFilename(filename)
      });
    }
    return result;
  }

  const sgmlParts = text.split(/\n?<STMTTRN>/i).slice(1);
  for (const block of sgmlParts) {
    const dtposted = block.match(/DTPOSTED>([\d.T:+\-\[\]]+)/i)?.[1]?.trim() ?? "";
    const trnamt = block.match(/TRNAMT>([-\d.]+)/i)?.[1]?.trim() ?? "";
    const memo = block.match(/MEMO>([^\n\r<]+)/i)?.[1]?.trim() ?? "";
    const name = block.match(/NAME>([^\n\r<]+)/i)?.[1]?.trim() ?? "";

    const date = parseDate(dtposted);
    if (!date) continue;
    const amount = parseFloat(trnamt);
    if (isNaN(amount)) continue;

    const description = memo || name || "Transacao";
    const type = amount < 0 ? "expense" : "income";
    result.push({
      type,
      description,
      amount: Math.abs(amount),
      date,
      monthKey: monthKeyFromDate(date),
      category: categorizeTransaction(description, type),
      dedupKey: makeDedupKey(date, description, amount),
      sourceLabel: sourceLabelFromFilename(filename)
    });
  }

  return result;
}

export async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1] ?? result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
