export type ParsedTransaction = {
  type: "income" | "expense";
  description: string;
  amount: number;
  date: string;
  monthKey: string;
  category: string;
  dedupKey: string;
  sourceLabel?: string;
  source?: "account" | "card";
};

// ─── 19 categorias fixas ─────────────────────────────────────────────────────

export const CATEGORIES = [
  "Alimentacao",
  "Mercado",
  "Transporte",
  "Carro",
  "CartaoCredito",
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

export const CATEGORY_LABELS: Record<Category, string> = {
  Alimentacao:    "Alimentação",
  Mercado:        "Mercado",
  Transporte:     "Transporte",
  Carro:          "Carro",
  CartaoCredito:  "Cartão de Crédito",
  Assinaturas:    "Assinaturas",
  Saude:          "Saúde",
  Varejo:         "Varejo",
  Educacao:       "Educação",
  Moradia:        "Moradia",
  Contas:         "Contas",
  Seguros:        "Seguros",
  Taxas:          "Taxas",
  Emprestimos:    "Empréstimos",
  Doacoes:        "Doações",
  Transferencias: "Transferências",
  Hospedagem:     "Hospedagem",
  Viagem:         "Viagem",
  Lazer:          "Lazer",
  Recebimentos:   "Recebimentos",
  Outros:         "Outros"
};

export { CATEGORY_COLORS } from "@/lib/categories";

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
    // redes grandes
    "pao de acucar", "carrefour", "walmart", "assai", "atacadao",
    "makro", "fort atacadista", "tenda atacado", "maxxi atacado",
    // redes regionais
    "prezunic", "st marche", "zona sul", "condor", "bergamini",
    "g barbosa", "bistek", "mundial", "sonda", "big bom", "rede top",
    "muffato", "savegnago", "angeloni", "bretas", "super nosso",
    "hirota", "mambo", "coop supermercado", "mateus supermercado",
    "bom preco", "oba hortifruti", "guanabara supermercado",
    // genéricos
    "supermercado", "hipermercado", "atacado", "hortifruti",
    "mercadinho", "mercado", "extra mkt", "magazine luiza mercado",
    "varejao", "mercearia", "frutaria", "verdureiro", "sacolao",
    "feira livre", "feira", "quitanda", "emporio"
  ],
  Transporte: [
    "bilhete unico", "passagem metro", "transporte urbano",
    "cartao transporte", "passagem rod", "rodoviaria",
    "metrô", "metro", "sptrans", "onibus", "ônibus",
    "cabify", "99pop", "99 ", "uber", "taxi", "taxista",
    "brt", "vlt", "trem", "terminal"
  ],
  CartaoCredito: [
    // por emissor
    "fatura nubank", "nubank fatura", "fatura bradesco", "bradesco fatura",
    "fatura itau", "itau fatura", "fatura santander", "santander fatura",
    "fatura caixa", "fatura c6", "c6 fatura", "fatura inter", "inter fatura",
    "fatura xp", "xp fatura", "fatura next", "fatura neon", "fatura will",
    "fatura sicoob", "fatura banrisul", "fatura bmg", "fatura pan",
    "fatura avenue", "fatura mercadopago", "fatura pagbank",
    // por bandeira
    "fatura mastercard", "fatura visa", "fatura elo",
    "fatura amex", "fatura american express", "fatura hipercard",
    // genéricos
    "pagamento cartao", "pgto cartao", "pgto fatura",
    "pagamento fatura", "fatura cartao", "cartao credito", "fatura"
  ],
  Carro: [
    // postos e combustível
    "combustivel", "gasolina", "etanol", "alcool combust", "diesel", "gnv",
    "posto", "auto posto", "ipiranga", "petrobras", "shell", "raizen",
    "br distribuidora", "ale combustiveis", "texaco",
    // manutenção
    "oficina", "mecanico", "funilaria", "borracharia", "pneu",
    "troca de oleo", "revisao auto", "balanceamento", "alinhamento",
    "amortecedor", "bateria auto", "autopecas", "peca auto",
    // lavagem
    "lava jato", "lava rapido", "lavagem auto",
    // pedágio e estacionamento
    "pedagio", "sem parar", "veloe", "conectcar", "move mais",
    "estacionamento", "zona azul", "rotativo"
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
  const negative = raw.trim().startsWith("-");
  // Strip tudo que não é dígito, ponto ou vírgula (lida com "R$Â ", NBSP, etc.)
  const digits = raw.replace(/[^0-9,.]/g, "");
  if (!digits) return NaN;
  const num = /^[\d.]+,\d{1,2}$/.test(digits)
    ? parseFloat(digits.replace(/\./g, "").replace(",", "."))
    : parseFloat(digits.replace(",", "."));
  return negative ? -num : num;
}

export function detectCardSuffix(text: string): string | null {
  const m = text.match(
    /(?:[•·*.]{2,4}[\s-]?(\d{4}))|(?:final[\s:]+(\d{4}))|(?:terminad[ao]\s+em\s+(\d{4}))/i
  );
  return m ? (m[1] || m[2] || m[3]) : null;
}

const COMPE_BANKS: Record<string, string> = {
  "001": "Banco do Brasil", "033": "Santander",     "041": "Banrisul",
  "070": "BRB",             "077": "Inter",          "104": "Caixa",
  "208": "BTG Pactual",     "212": "Banco Original", "237": "Bradesco",
  "260": "Nubank",          "290": "PagBank",        "323": "Mercado Pago",
  "336": "C6 Bank",         "341": "Itaú",           "380": "PicPay",
  "422": "Safra",           "637": "Sofisa",         "655": "Votorantim",
  "735": "Neon",            "748": "Sicredi",        "756": "Sicoob",
};

const ISPB_BANKS: Record<string, string> = {
  "00000000": "Banco do Brasil", "00360305": "Caixa",
  "00416968": "Inter",           "18236120": "Nubank",
  "31872495": "C6 Bank",         "60701190": "Itaú",
  "60746948": "Bradesco",        "90400888": "Santander",
  "22896431": "PicPay",          "10573521": "Mercado Pago",
};

const LABEL_ALIASES: [RegExp, string][] = [
  [/^nu\b/i, "Nubank"],   [/^nub\b/i, "Nubank"],
  [/^bb\b/i, "Banco do Brasil"], [/^cef\b/i, "Caixa"],
  [/^pag\b/i, "PagBank"],
];

export function normalizeSourceLabel(label: string): string {
  let s = label
    .replace(/\b\d{2}[A-ZÁÉÍÓÚÇ]{3}\d{4}\b/gi, "")
    .replace(/\b\d{8}\b/g, "")
    .replace(/\b\d{4}-\d{2}-\d{2}\b/g, "")
    .replace(/\b(extrato|fatura|statement|export|download)\b/gi, "")
    .replace(/[•·*]{2,4}/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  for (const [pattern, name] of LABEL_ALIASES) {
    if (pattern.test(s)) { s = s.replace(pattern, name).trim(); break; }
  }

  const suffixMatch = label.match(/[•·*]{2,}\s*(\d{4})/);
  if (suffixMatch) {
    s = s.replace(/\b\d{4}\b/, "").replace(/\s{2,}/g, " ").trim();
    if (!/^Cartão/i.test(s)) s = `Cartão ${s}`;
    s = `${s} ${suffixMatch[1]}`.trim();
  }

  return s || "Importação";
}

export function sourceLabelFromFilename(filename: string): string {
  const base = filename.replace(/\.[^.]+$/, "").replace(/[-_]/g, " ").trim();
  const lower = base.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

  if (lower.includes("nubank"))    return "Nubank";
  if (lower.includes("picpay"))    return "PicPay";
  if (lower.includes("afinz"))     return "Afinz";
  if (lower.includes("inter"))     return "Inter";
  if (lower.includes("itau"))      return "Itaú";
  if (lower.includes("bradesco"))  return "Bradesco";
  if (lower.includes("santander")) return "Santander";
  if (lower.includes("caixa"))     return "Caixa";
  if (lower.includes("bb") || lower.includes("banco do brasil")) return "Banco do Brasil";
  if (lower.includes("c6"))        return "C6 Bank";
  if (/\bxp\b/.test(lower))        return "XP";
  if (lower.includes("noh"))       return "Noh";

  return normalizeSourceLabel(base) || "Importação";
}

export function parseCSV(text: string, filename = ""): ParsedTransaction[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];

  const delimiter = lines[0].includes(";") ? ";" : ",";
  const rows = lines.map((l) =>
    l.split(delimiter).map((c) => c.trim().replace(/^["']|["']$/g, ""))
  );

  const norm = (s: string) =>
    s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
  const header = rows[0].map(norm);

  const dateCol = header.findIndex((h) =>
    h === "data" || h === "date" ||
    h.includes("data lan") || h.includes("data mov") ||
    h.includes("data transac") || h.includes("data pagto") ||
    h.includes("data compra") || h.includes("data vencto")
  );
  // Aceita também headers com encoding quebrado (ex: "DescriÃ§Ã£o" da NOH)
  const descCol = header.findIndex((h) =>
    h.includes("historico") || h.includes("descricao") || h.includes("descri") ||
    h.includes("lancamento") || h.includes("detalhes") ||
    h.includes("estabelecimento") || h.includes("titulo") ||
    h === "description" || h === "memo" || h === "nome"
  );
  // Coluna de tipo textual: "Entrada" / "Saída" (NOH, outros)
  const tipoCol = header.findIndex((h) => h === "tipo" || h === "type" || h === "natureza");

  // Coluna única de valor (Nubank, Inter, etc.)
  const valueCol = header.findIndex((h) =>
    h === "valor" || h === "value" || h === "amount" || h.includes("quantia")
  );

  // Colunas separadas de crédito e débito (Itaú, Bradesco, Santander, etc.)
  const creditCol = header.findIndex((h) =>
    (h.includes("credito") || h.includes("entrada") || h.includes("credit")) &&
    !h.includes("debito")
  );
  const debitCol = header.findIndex((h) =>
    (h.includes("debito") || h.includes("saida") || h.includes("debit")) &&
    !h.includes("credito")
  );
  const hasSeparateCols = creditCol !== -1 && debitCol !== -1;

  if (dateCol === -1) throw new Error(`Coluna de data não encontrada. Colunas detectadas: ${rows[0].join(", ")}`);
  if (valueCol === -1 && !hasSeparateCols) throw new Error(`Coluna de valor não encontrada. Colunas detectadas: ${rows[0].join(", ")}`);

  const result: ParsedTransaction[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row.length < 2) continue;

    const rawDate = (row[dateCol] || "").trim();
    const rawDesc = descCol >= 0 ? (row[descCol] || "").trim() : "Sem descricao";
    const date = parseDate(rawDate);
    if (!date) continue;

    let amount: number;
    let type: "income" | "expense";

    if (hasSeparateCols) {
      const credit = parseBRNumber((row[creditCol] || "").trim());
      const debit = parseBRNumber((row[debitCol] || "").trim());
      if (!isNaN(credit) && credit > 0) {
        amount = credit;
        type = "income";
      } else if (!isNaN(debit) && debit > 0) {
        amount = debit;
        type = "expense";
      } else {
        continue;
      }
    } else {
      const rawValue = (row[valueCol] || "").trim();
      amount = parseBRNumber(rawValue);
      if (isNaN(amount) || amount === 0) continue;
      if (tipoCol >= 0 && amount > 0) {
        // Usa coluna "Tipo" para desambiguar quando valor é sempre positivo
        const rawTipo = (row[tipoCol] || "").toLowerCase();
        type = rawTipo.includes("sa") ? "expense" : "income"; // "saída"/"saida"
      } else {
        type = amount < 0 ? "expense" : "income";
      }
      amount = Math.abs(amount);
    }

    result.push({
      type,
      description: rawDesc,
      amount,
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

  // Resolve banco a partir de FID (COMPE = 3 dígitos, ISPB = 8 dígitos) ou ORG
  const fidMatch  = text.match(/<FID>\s*(\d+)/i);
  const orgMatch  = text.match(/<ORG>\s*([^<\n\r]+)/i);
  const acctMatch = text.match(/<ACCTTYPE>\s*([^<\n\r]+)/i);

  let bankFromFid: string | null = null;
  if (fidMatch) {
    const fid = fidMatch[1].trim();
    bankFromFid = fid.length === 8
      ? (ISPB_BANKS[fid] ?? null)
      : (COMPE_BANKS[fid.padStart(3, "0")] ?? null);
  }
  const bankFromOrg = orgMatch ? orgMatch[1].trim() : null;
  const bankName    = bankFromFid ?? bankFromOrg ?? null;
  const isCredit    = /credit/i.test(acctMatch?.[1] ?? "");
  const cardSuffix  = detectCardSuffix(text);

  let ofxSourceLabel: string;
  if (bankName) {
    ofxSourceLabel = isCredit
      ? (cardSuffix ? `Cartão ${bankName} ${cardSuffix}` : `Cartão ${bankName}`)
      : bankName;
  } else {
    ofxSourceLabel = sourceLabelFromFilename(filename);
  }

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
        sourceLabel: ofxSourceLabel
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
      sourceLabel: ofxSourceLabel
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
