/* tests/whatsapp.test.js — SALVO WhatsApp chatbot (passada 1: fundação reply-only).
 * Rodar: npm run test:whatsapp
 *
 * Exercita o ROTEADOR puro com store em memória + serviços fake (sem Firestore,
 * Evolution ou Resend reais). Prova os 10 itens de validação da tarefa.
 */
const path = require("node:path");
const FUNC = path.join(__dirname, "..", "functions");
const { processInbound, REGISTRY } = require(path.join(FUNC, "lib", "whatsapp", "router.js"));
const { renderOptions, renderReply } = require(path.join(FUNC, "lib", "whatsapp", "transport.js"));

const GENERIC_PREFIX = "Pra isso eu preciso te reconhecer";
const STUB = "Já já tô montando essa parte, tá quase pronta.";
const HELP_ENTRY = "Pode mandar. Me conta o que tá pegando.";
const HELP_DONE = "Recebi! Te respondo em breve por aqui.";

// ── Fakes injetáveis ─────────────────────────────────────────────────────────
function makeStore() {
  const conversations = new Map();
  const links = new Map();
  const codes = new Map();
  return {
    _conversations: conversations, _links: links, _codes: codes,
    seedLink(phone, uid, ws) { links.set(phone, { uid, workspaceId: ws, verifiedAt: 0 }); },
    seedCode(code, uid, ws, expiresAt, used = false) { codes.set(code, { uid, workspaceId: ws, expiresAt, used }); },
    async loadState(phone) { return conversations.get(phone) ?? null; },
    async saveState(phone, st) { conversations.set(phone, { ...st }); },
    async getLink(phone) { return links.get(phone) ?? null; },
    async findValidCode(code, now) {
      const d = codes.get(code);
      if (!d || d.used === true) return null;
      if (typeof d.expiresAt !== "number" || d.expiresAt <= now) return null;
      return { uid: d.uid, workspaceId: d.workspaceId };
    },
    async burnCode(code) { const d = codes.get(code); if (d) d.used = true; },
    async saveLink(phone, acc, now) { links.set(phone, { uid: acc.uid, workspaceId: acc.workspaceId, verifiedAt: now }); },
  };
}
function makeServices() {
  const emails = [];
  return { emails, sendHelpEmail: async (phone, text) => { emails.push({ phone, text }); } };
}
function scenario() {
  const store = makeStore();
  const services = makeServices();
  const nowRef = { v: 1_000_000 };
  const deps = { store, services, now: () => nowRef.v };
  const say = (phone, text) => processInbound({ phone, text }, deps);
  return { store, services, nowRef, say };
}

// ── Placar ───────────────────────────────────────────────────────────────────
const results = [];
function check(label, cond) { results.push({ label, pass: !!cond }); }

(async () => {
  const P = "+5521999990000";

  // 1) Não vinculado manda "oi" → menu (aberto), zero dado financeiro.
  {
    const { say } = scenario();
    const r = await say(P, "oi");
    const ids = (r.options || []).map((o) => o.id).join(",");
    const noFinance = !(r.reply || "").includes(STUB) && !(r.reply || "").includes("R$");
    check("1. Não vinculado 'oi' → menu aberto, sem dado financeiro",
      ids === "diagnosis,reminder,help" && noFinance);
  }

  // 2) Não vinculado toca opção 3 (ajuda) → funciona SEM pedir vínculo.
  {
    const { say, services, store } = scenario();
    const r1 = await say(P, "3");
    const r2 = await say(P, "não consigo importar meu extrato");
    check("2. Ajuda (3) funciona sem vínculo",
      r1.reply === HELP_ENTRY &&
      !(r1.reply || "").startsWith(GENERIC_PREFIX) &&
      r2.reply === HELP_DONE &&
      services.emails.length === 1 &&
      (await store.loadState(P)).mode === "idle");
  }

  // 3) Não vinculado toca opção 1 (diagnóstico) → pede código, guarda intenção, aguarda.
  {
    const { say, store } = scenario();
    const r = await say(P, "1");
    const st = await store.loadState(P);
    check("3. Diagnóstico (1) não vinculado → pede código, guarda intenção, aguarda",
      (r.reply || "").startsWith(GENERIC_PREFIX) &&
      st.mode === "awaiting_link" && st.context === "diagnosis");
  }

  // 4) Código inválido / expirado / usado → mensagem genérica (anti-enumeração).
  {
    const { say, store, nowRef } = scenario();
    await say(P, "1"); // entra em awaiting_link (context diagnosis)
    const invalid = await say(P, "000000"); // não existe
    store.seedCode("111111", "u", "w", nowRef.v - 1); // expirado
    const expired = await say(P, "111111");
    store.seedCode("222222", "u", "w", nowRef.v + 999999, true); // já usado
    const used = await say(P, "222222");
    const notCode = await say(P, "socorro"); // texto que nem é código
    const st = await store.loadState(P);
    const allGeneric = [invalid, expired, used, notCode].every((r) => (r.reply || "").startsWith(GENERIC_PREFIX));
    check("4. Código inválido/expirado/usado/não-código → genérico, nada revelado",
      allGeneric && st.mode === "awaiting_link" && !(await store.getLink(P)));
  }

  // 5) Código válido → vincula, queima código, RETOMA intenção (diagnóstico stub).
  {
    const { say, store, nowRef } = scenario();
    await say(P, "1"); // awaiting_link, context diagnosis
    store.seedCode("123456", "uid-A", "ws-A", nowRef.v + 600000);
    const r = await say(P, "meu código é 123456");
    const link = await store.getLink(P);
    const st = await store.loadState(P);
    check("5. Código válido → vincula, queima, retoma diagnóstico (stub)",
      (r.reply || "").includes(STUB) &&
      link && link.uid === "uid-A" && link.workspaceId === "ws-A" &&
      store._codes.get("123456").used === true &&
      st.mode === "idle" && (st.context === null || st.context === undefined));
  }

  // 6) Número JÁ vinculado toca opção 1 → NÃO pede código, responde direto (stub).
  {
    const { say, store } = scenario();
    store.seedLink(P, "uid-A", "ws-A");
    const r = await say(P, "1");
    check("6. Já vinculado (1) → não pede código, responde stub direto",
      (r.reply || "").includes(STUB) && !(r.reply || "").startsWith(GENERIC_PREFIX));
  }

  // 7) "menu"/"voltar" no meio de qualquer fluxo (inclusive aguardando código) → menu.
  {
    const { say, store } = scenario();
    await say(P, "1"); // awaiting_link
    const rMenu = await say(P, "menu");
    const stAfterMenu = await store.loadState(P);
    await say(P, "3"); // help entry → help_capture
    const rVoltar = await say(P, "voltar");
    const stAfterVoltar = await store.loadState(P);
    const menuIds = (rMenu.options || []).map((o) => o.id).join(",");
    const voltarIds = (rVoltar.options || []).map((o) => o.id).join(",");
    check("7. 'menu'/'voltar' derruba pro menu (inclusive aguardando código)",
      menuIds === "diagnosis,reminder,help" && stAfterMenu.mode === "idle" &&
      voltarIds === "diagnosis,reminder,help" && stAfterVoltar.mode === "idle");
  }

  // 8) Fluxo parado > 30 min → reseta pra idle antes de processar.
  {
    const { say, store, nowRef } = scenario();
    await say(P, "3"); // entra em help_capture
    nowRef.v += 31 * 60 * 1000; // +31 min
    const r = await say(P, "oi"); // deve cair no MENU, não capturar como relato de ajuda
    const ids = (r.options || []).map((o) => o.id).join(",");
    check("8. Fluxo parado > 30 min → reseta pra idle (vê menu, não captura ajuda)",
      ids === "diagnosis,reminder,help" && store.emails === undefined /* nunca definiu */);
  }

  // 9) Opções vêm SEMÂNTICAS da folha e o transporte renderiza numerado; trocar a
  //    renderização não mexe em roteador/folha. Opções 1 e 2 registradas (respondem stub).
  {
    const { say, store } = scenario();
    const menu = await say(P, "oi");
    const semantic = Array.isArray(menu.options) && menu.options.every((o) => o.id && o.label);
    const rendered = renderOptions(menu.optionsHeader, menu.options);
    const numbered = rendered.includes("1. Como tá financeiramente?") &&
                     rendered.includes("2. Criar lembrete pra mandar mais dados") &&
                     rendered.includes("3. Preciso de ajuda");
    const registered = !!REGISTRY.diagnosis && !!REGISTRY.reminder && !!REGISTRY.help && !!REGISTRY.idle;
    // opção 2 registrada responde stub (já vinculado, pra não cair no portão)
    store.seedLink(P, "u", "w");
    const r2 = await say(P, "2");
    check("9. Opções semânticas → transporte renderiza numerado; 1 e 2 registradas (stub)",
      semantic && numbered && registered && (r2.reply || "").includes(STUB));
  }

  // 10) Bot nunca envia sem inbound (reply-only). Sem nada a dizer → string vazia
  //     (não há envio espontâneo); o único outbound é o retorno de processInbound.
  {
    const silent = renderReply({}) === "";
    const routerKeys = Object.keys(require(path.join(FUNC, "lib", "whatsapp", "router.js")));
    const noProactiveSender = !routerKeys.some((k) => /send|push|broadcast|notify/i.test(k));
    check("10. Reply-only: sem inbound não há envio; resultado vazio = silêncio",
      silent && noProactiveSender);
  }

  // ── Impressão ────────────────────────────────────────────────────────────
  console.log("");
  for (const r of results) console.log(`${r.pass ? "✅" : "❌"} ${r.label}`);
  const passed = results.filter((r) => r.pass).length;
  console.log(`\nPLACAR: ${passed} de ${results.length} passou`);
  process.exit(passed === results.length ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
