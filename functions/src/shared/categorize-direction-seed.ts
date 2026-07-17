// ⚠️ GERADO por scripts/sync-shared.mjs — NÃO EDITE AQUI.
// Fonte da verdade: src/lib/shared/. Rode o build do functions pra regenerar.

// ─── Categorização determinística do SERVIDOR (fonte da verdade compartilhada) ─
// Camadas 1 e 2 da cascata: regra de direção (o TIPO decide) + seed de merchants
// comuns. PURO (regex sobre a descrição). UMA definição, dois chamadores.

export function normDesc(d: string): string {
  return d.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

// Layer 1 — direction rule (free): the transaction TYPE decides the category,
// regardless of the counterparty's name. Person-to-person Pix is resolved here,
// so it never hits the merchant cache.
export function directionRule(description: string): string | null {
  const n = normDesc(description);
  if (/\brendimento/.test(n)) return "Recebimentos";
  if (/pix\s+recebido|transferencia\s+recebida|dep[oó]sito\s+recebido|ted\s+recebid|doc\s+recebid|sal[aá]rio/.test(n)) return "Recebimentos";
  if (/pix\s+enviado|transferencia\s+enviada|ted\s+enviad|doc\s+enviad/.test(n)) return "Transferencias";
  return null;
}

// Layer 2 — hardcoded BR merchant seed (free): substring match over the
// normalized description. Covers the common merchants so the first import of a
// new user already resolves most rows without Claude.
const MERCHANT_SEED: Array<[RegExp, string]> = [
  [/\bifood\b|\brappi\b|\baiqfome\b|\buber\s?eats\b|\bjames delivery\b/, "Alimentacao"],
  [/\bmc\s?donalds?\b|\bburger king\b|\bbk\b|\bsubway\b|\bhabib|\bbobs\b|\boutback\b|\bspoleto\b|\bgiraffas\b|\bkfc\b|\bpizza hut\b|\bdivino fogao\b|\bmadero\b/, "Alimentacao"],
  [/\bstarbucks\b|\bcacau show\b|\bkopenhagen\b|\bsorveteria\b|\bpadaria\b|\bconfeitaria\b|\bcafeteria\b|\bcafe\b|\bacai\b/, "Alimentacao"],
  [/\batacadao\b|\bassai\b|\bcarrefour\b|\bpao de acucar\b|\bwalmart\b|\bmakro\b|\bsam.?s club\b|\btenda atacado\b|\bbig bompreco\b|\bsupermercado\b|\bhortifruti\b|\bmercado\b|\bmercearia\b|\bsacolao\b/, "Mercado"],
  [/\bdia\b|\bextra\b|\bguanabara\b|\bprezunic\b|\bzona sul\b|\bmundial\b|\bsonda\b|\bcondor\b|\bmuffato\b|\bangeloni\b/, "Mercado"],
  [/\btim\b|\bvivo\b|\bclaro\b|\boi\b|\bnextel\b/, "Contas"],
  [/\benel\b|\bcpfl\b|\bcemig\b|\bcoelba\b|\blight\b|\bsabesp\b|\bcomgas\b|\bcedae\b|\bcopasa\b|\bsaneago\b|\benergisa\b|\bequatorial\b|\bneoenergia\b/, "Contas"],
  [/\bshell\b|\bipiranga\b|\bpetrobras\b|\bbr distribuidora\b|\bauto posto\b|\bposto\b|\bcombustivel\b|\bgasolina\b|\bsem parar\b|\bveloe\b|\bconectcar\b|\bpedagio\b|\bestacionamento\b/, "Carro"],
  [/\buber\b|\b99\s?(pop|taxi)?\b|\bcabify\b|\btaxi\b|\bmetro\b|\bonibus\b|\bbilhete unico\b|\bbom\b/, "Transporte"],
  [/\bnetflix\b|\bspotify\b|\bdisney\b|\bhbo\b|\bmax\b|\bamazon prime\b|\byoutube premium\b|\bdeezer\b|\bgloboplay\b|\bparamount\b|\bapple\.?com\b|\bgoogle\b|\bchatgpt\b|\bopenai\b|\badobe\b|\bcanva\b/, "Assinaturas"],
  [/\bgympass\b|\bwellhub\b|\btotalpass\b|\bsmart\s?fit\b|\bacademia\b|\bcinema\b|\bcinemark\b|\bsympla\b|\beventim\b|\bingresso\b/, "Lazer"],
  [/\bamazon\b|\bmercado livre\b|\bmercadolivre\b|\bmercado pago\b|\bshopee\b|\baliexpress\b|\bshein\b|\bmagazine luiza\b|\bmagalu\b|\bcasas bahia\b|\bamericanas\b|\brenner\b|\briachuelo\b|\bcentauro\b|\bnetshoes\b|\bleroy\b|\bkalunga\b/, "Varejo"],
  [/\bdrogaria\b|\bdroga raia\b|\bdrogasil\b|\bpacheco\b|\bpague menos\b|\bfarmacia\b|\bultrafarma\b|\bpanvel\b|\bhospital\b|\bclinica\b|\blaboratorio\b|\bunimed\b|\bhapvida\b|\bamil\b/, "Saude"],
  [/\biof\b|\btarifa\b|\banuidade\b|\bjuros\b|\bmulta\b|\bencargo\b/, "Taxas"],
  [/\baluguel\b|\bcondominio\b|\biptu\b|\bimobiliaria\b/, "Moradia"],
];

export function seedLookup(description: string): string | null {
  const n = normDesc(description);
  for (const [re, cat] of MERCHANT_SEED) if (re.test(n)) return cat;
  return null;
}
