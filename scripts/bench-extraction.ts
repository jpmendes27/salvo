/* scripts/bench-extraction.ts — BENCH standalone (NÃO toca produção)
 *
 * Prova se os ~6 min de extração vêm do PIPELINE (throttle 7500 + chunking
 * sequencial) ou do MODELO: roda a MESMA extração em UMA chamada só, SEM throttle,
 * em 3 configs, e mede latência + tokens + nº de transações + JSON válido.
 *
 * Reusa VERBATIM de produção:
 *   - o system prompt de extração: buildSystemPrompt() (functions/src/index.ts)
 *   - o util de PDF→texto: extractPdfTextServer() (functions/src/pdf-core.ts)
 *   - a string do modelo Claude: "claude-sonnet-4-6"
 *
 * Uso (rodar da RAIZ do repo):
 *   ANTHROPIC_API_KEY=sk-... GEMINI_API_KEY=... \
 *     npx tsx scripts/bench-extraction.ts <extrato.pdf | extrato.txt>
 *
 * Sem GEMINI_API_KEY/ANTHROPIC_API_KEY a config correspondente sai como "—" na
 * tabela (com nota), sem derrubar as outras.
 */
import fs from "node:fs";
import path from "node:path";

const FUNC = path.join(__dirname, "..", "functions");

// Firebase dummy: requerer o módulo compilado de produção (pro prompt) dispara
// admin.initializeApp() no topo do index.ts; sem isto ele quebra. O bench NUNCA
// toca Firestore/Storage — é só pra conseguir importar buildSystemPrompt verbatim.
process.env.FIREBASE_CONFIG =
  process.env.FIREBASE_CONFIG || JSON.stringify({ projectId: "bench", storageBucket: "bench.appspot.com" });
process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || "bench";

/* eslint-disable @typescript-eslint/no-var-requires */
const { buildSystemPrompt } = require(path.join(FUNC, "lib", "index.js")) as {
  buildSystemPrompt: () => string;
};
const { extractPdfTextServer } = require(path.join(FUNC, "lib", "pdf-core.js")) as {
  extractPdfTextServer: (buf: Buffer) => Promise<string>;
};
const Anthropic = require(path.join(FUNC, "node_modules", "@anthropic-ai", "sdk")).default;
const { GoogleGenAI } = require(path.join(FUNC, "node_modules", "@google", "genai"));

// Strings de modelo — Claude = a MESMA de produção (extractTextInChunks).
const CLAUDE_MODEL = "claude-sonnet-4-6";
const GEMINI_25 = "gemini-2.5-flash-lite";
const GEMINI_31 = "gemini-3.1-flash-lite";
const MAX_OUT = 32000; // single-call: alto p/ não truncar (não é o teto de prod por chunk)

type Row = {
  config: string;
  latencyS: number | null;
  inTok: number | null;
  outTok: number | null;
  nTx: number | null;
  jsonOk: boolean;
  note?: string;
};

// Conta transactions[] do JSON retornado (tolera cercas/prefixo).
function countTx(out: string): { nTx: number | null; ok: boolean } {
  try {
    const s = out.indexOf("{");
    const e = out.lastIndexOf("}");
    if (s < 0 || e < 0) return { nTx: null, ok: false };
    const obj = JSON.parse(out.slice(s, e + 1));
    return { nTx: Array.isArray(obj.transactions) ? obj.transactions.length : null, ok: true };
  } catch {
    return { nTx: null, ok: false };
  }
}

async function runClaude(prompt: string, text: string): Promise<Row> {
  const config = `Claude ${CLAUDE_MODEL}`;
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return { config, latencyS: null, inTok: null, outTok: null, nTx: null, jsonOk: false, note: "ANTHROPIC_API_KEY ausente" };
  const client = new Anthropic({ apiKey: key, maxRetries: 0 }); // SEM retry/throttle
  const t0 = performance.now();
  try {
    // Streaming: o SDK exige stream quando max_tokens é alto (request pode passar
    // de 10 min). finalMessage() devolve a mensagem completa + usage, igual ao
    // create() não-streaming. NÃO é throttle — é só o transporte.
    const stream = client.messages.stream({
      model: CLAUDE_MODEL,
      max_tokens: MAX_OUT,
      system: prompt,
      messages: [{ role: "user", content: text }],
    });
    const msg = await stream.finalMessage();
    const dt = (performance.now() - t0) / 1000;
    const out = (msg.content.find((b: any) => b.type === "text")?.text as string) ?? "";
    const { nTx, ok } = countTx(out);
    return { config, latencyS: +dt.toFixed(1), inTok: msg.usage?.input_tokens ?? null, outTok: msg.usage?.output_tokens ?? null, nTx, jsonOk: ok };
  } catch (e: any) {
    return { config, latencyS: +((performance.now() - t0) / 1000).toFixed(1), inTok: null, outTok: null, nTx: null, jsonOk: false, note: String(e?.message ?? e).slice(0, 90) };
  }
}

async function runGemini(model: string, prompt: string, text: string): Promise<Row> {
  const config = `Gemini ${model}`;
  const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!key) return { config, latencyS: null, inTok: null, outTok: null, nTx: null, jsonOk: false, note: "GEMINI_API_KEY ausente" };
  const ai = new GoogleGenAI({ apiKey: key });
  const t0 = performance.now();
  try {
    const resp = await ai.models.generateContent({
      model,
      contents: text,
      config: { systemInstruction: prompt, responseMimeType: "application/json", maxOutputTokens: MAX_OUT },
    });
    const dt = (performance.now() - t0) / 1000;
    const out = (resp.text as string) ?? "";
    const { nTx, ok } = countTx(out);
    const u = resp.usageMetadata ?? {};
    return { config, latencyS: +dt.toFixed(1), inTok: u.promptTokenCount ?? null, outTok: u.candidatesTokenCount ?? null, nTx, jsonOk: ok };
  } catch (e: any) {
    return { config, latencyS: +((performance.now() - t0) / 1000).toFixed(1), inTok: null, outTok: null, nTx: null, jsonOk: false, note: String(e?.message ?? e).slice(0, 90) };
  }
}

function printTable(rows: Row[]) {
  const head = ["Config", "Latência(s)", "In tok", "Out tok", "Nº txs", "JSON ok"];
  const cells = (r: Row) => [r.config, r.latencyS ?? "—", r.inTok ?? "—", r.outTok ?? "—", r.nTx ?? "—", r.jsonOk ? "sim" : "não"].map(String);
  const table = [head, ...rows.map(cells)];
  const w = head.map((_, i) => Math.max(...table.map((row) => row[i].length)));
  console.log("");
  for (const row of table) console.log(row.map((c, i) => c.padEnd(w[i])).join("  "));
  const notes = rows.filter((r) => r.note);
  if (notes.length) {
    console.log("");
    for (const r of notes) console.log(`  • ${r.config}: ${r.note}`);
  }
}

async function main() {
  const p = process.argv[2];
  if (!p) {
    console.error("uso: npx tsx scripts/bench-extraction.ts <extrato.pdf | extrato.txt>");
    process.exit(1);
  }
  if (!fs.existsSync(p)) {
    console.error(`arquivo não encontrado: ${p}`);
    process.exit(1);
  }

  const buf = fs.readFileSync(p);
  let text: string;
  if (p.toLowerCase().endsWith(".pdf")) {
    console.log("→ PDF→texto via extractPdfTextServer() (mesmo util de produção)…");
    text = await extractPdfTextServer(buf);
  } else {
    text = buf.toString("utf-8");
  }

  const prompt = buildSystemPrompt();
  console.log(`system prompt: buildSystemPrompt() de produção — ${prompt.length} chars`);
  console.log(`modelo Claude: ${CLAUDE_MODEL} (verbatim de extractTextInChunks)`);
  console.log(`input: ${path.basename(p)} — ${text.length} chars de texto extraído`);

  // Sequencial p/ medir cada uma limpa (sem disputa de CPU/rede). Sem throttle.
  const rows: Row[] = [];
  rows.push(await runClaude(prompt, text));
  rows.push(await runGemini(GEMINI_25, prompt, text));
  rows.push(await runGemini(GEMINI_31, prompt, text));

  printTable(rows);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
