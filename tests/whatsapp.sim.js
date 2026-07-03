/* tests/whatsapp.sim.js — simulador de conversa do bot (LOCAL, sem deploy).
 * Rodar: npm run whatsapp:sim
 *
 * Você digita como se fosse o usuário no WhatsApp; o bot responde com o TEXTO EXATO
 * que o transporte renderiza. Usa store em memória + serviços fake — não toca Firestore,
 * Evolution nem Resend. É a mesma lógica (processInbound + renderReply) que roda em prod.
 *
 * Comandos meta (não são mensagens do usuário):
 *   /code            → gera um código de vínculo (o que o app mostraria) e injeta no store
 *   /status          → mostra vínculo + estado da conversa
 *   /unlink          → apaga o vínculo do número (pra testar de novo do zero)
 *   /quit            → sai
 */
const path = require("node:path");
const readline = require("node:readline");
const FUNC = path.join(__dirname, "..", "functions");
const { processInbound } = require(path.join(FUNC, "lib", "whatsapp", "router.js"));
const { renderReply } = require(path.join(FUNC, "lib", "whatsapp", "transport.js"));

const PHONE = "+5521999990000";

// Store em memória (mesmo shape do adapter Firestore).
const conversations = new Map(), links = new Map(), codes = new Map();
const store = {
  async loadState(p) { return conversations.get(p) ?? null; },
  async saveState(p, s) { conversations.set(p, { ...s }); },
  async getLink(p) { return links.get(p) ?? null; },
  async findValidCode(c, now) {
    const d = codes.get(c);
    if (!d || d.used || typeof d.expiresAt !== "number" || d.expiresAt <= now) return null;
    return { uid: d.uid, workspaceId: d.workspaceId };
  },
  async burnCode(c) { const d = codes.get(c); if (d) d.used = true; },
  async saveLink(p, a, now) { links.set(p, { uid: a.uid, workspaceId: a.workspaceId, verifiedAt: now }); },
};
const services = { sendHelpEmail: async (phone, text) => console.log(`   ✉️  [e-mail p/ salvo@jpmendes.com] de ${phone}: "${text}"`) };
const deps = { store, services, now: () => Date.now() };

function mintCode() {
  const code = String(Math.floor(Math.random() * 1_000_000)).padStart(6, "0");
  codes.set(code, { uid: "uid-demo", workspaceId: "ws-demo", expiresAt: Date.now() + 10 * 60 * 1000, used: false });
  return code;
}

const rl = readline.createInterface({ input: process.stdin, output: process.stdout, prompt: "você > " });
console.log("💬 Simulador do bot Salvô! (local). Digite mensagens; /code gera código; /quit sai.\n");
rl.prompt();

rl.on("line", async (raw) => {
  const line = raw.trim();
  if (line === "/quit") { rl.close(); return; }
  if (line === "/code") {
    const c = mintCode();
    console.log(`   🔑 código gerado (o app mostraria isto): ${c}  — manda ele como mensagem pra vincular\n`);
    rl.prompt(); return;
  }
  if (line === "/status") {
    console.log(`   vínculo: ${JSON.stringify(links.get(PHONE) ?? null)}`);
    console.log(`   conversa: ${JSON.stringify(conversations.get(PHONE) ?? null)}\n`);
    rl.prompt(); return;
  }
  if (line === "/unlink") { links.delete(PHONE); conversations.delete(PHONE); console.log("   🔓 vínculo/conversa apagados\n"); rl.prompt(); return; }
  if (!line) { rl.prompt(); return; }

  const result = await processInbound({ phone: PHONE, text: line }, deps);
  const reply = renderReply(result);
  console.log(`bot   > ${reply.replace(/\n/g, "\n        ")}\n`);
  rl.prompt();
}).on("close", () => { console.log("tchau 👋"); process.exit(0); });
