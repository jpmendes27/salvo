// ─── Bank brand colors (card lens) ───────────────────────────────────────────
// Maps a fatura's bank string to a brand color for the card glyph. Glyph color
// (white vs dark) is derived from the background's luminance so contrast holds
// for any brand — light or dark — including the neutral fallback.

export type BankInfo = {
  key: string;
  label: string;
  color: string;   // brand background
  glyph: string;   // contrasting glyph color (white/dark)
};

// Pick a readable glyph color for a given background (relative luminance).
function contrastText(hex: string): string {
  const c = hex.replace("#", "");
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  const L = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return L > 0.6 ? "#141414" : "#ffffff";
}

// Approximate brand colors (verify official hexes later).
const BRANDS: Array<{ key: string; label: string; color: string; match: string[] }> = [
  { key: "nubank",      label: "Nubank",          color: "#820AD1", match: ["nubank", "nu bank", "nu pagamentos"] },
  { key: "itau",        label: "Itaú",            color: "#EC7000", match: ["itau"] },
  { key: "santander",   label: "Santander",       color: "#EC0000", match: ["santander"] },
  { key: "bradesco",    label: "Bradesco",        color: "#CC092F", match: ["bradesco"] },
  { key: "bb",          label: "Banco do Brasil", color: "#0033A0", match: ["banco do brasil", "brasil s.a", "bb "] },
  { key: "caixa",       label: "Caixa",           color: "#0070AF", match: ["caixa"] },
  { key: "inter",       label: "Inter",           color: "#FF7A00", match: ["inter"] },
  { key: "c6",          label: "C6 Bank",         color: "#1D1D1B", match: ["c6"] },
  { key: "picpay",      label: "PicPay",          color: "#11C76F", match: ["picpay", "pic pay"] },
  { key: "mercadopago", label: "Mercado Pago",    color: "#009EE3", match: ["mercado pago", "mercadopago", "mercado-pago"] },
];

const FALLBACK_COLOR = "#3a3a3e";

// Detect a bank from a free-text bank/card string (e.g. "Santander SX Visa").
export function detectBank(raw?: string): BankInfo {
  const s = (raw ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  for (const b of BRANDS) {
    if (b.match.some((m) => s.includes(m))) {
      return { key: b.key, label: b.label, color: b.color, glyph: contrastText(b.color) };
    }
  }
  return { key: "outro", label: raw?.trim() || "Cartão", color: FALLBACK_COLOR, glyph: contrastText(FALLBACK_COLOR) };
}
