// ⚠️ GERADO por scripts/sync-shared.mjs — NÃO EDITE AQUI.
// Fonte da verdade: src/lib/shared/. Rode o build do functions pra regenerar.

// ─── Categorização determinística do CLIENTE (fonte da verdade compartilhada) ──
// Motor de keyword-match usado no parse client-side (CSV/OFX/imagem). PURO.
// Movimento interno (RDB/CDB/cofrinho/aplicação/resgate) resolve ANTES de tudo em
// "Transferencias" — resgate nunca vira "Recebimentos" (renda) nem "Outros".
// UMA definição, dois chamadores.

import { isInternalTransfer } from "./internal-transfer";

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

export function normalizeDesc(s: string): string {
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
  // Movimento interno (RDB/CDB/cofrinho/aplicação/resgate) → SEMPRE "Transferencias",
  // antes de tudo. Resgate NUNCA pode virar "Recebimentos" (renda) nem "Outros".
  if (isInternalTransfer(description)) return "Transferencias";

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
