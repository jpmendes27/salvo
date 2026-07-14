"use strict";
// ─── Motor de DIAGNÓSTICO (fonte de verdade ÚNICA: WhatsApp + home) ──────────
// Conta e cartão são DUAS leituras separadas — cartão NUNCA soma no fluxo de caixa.
// A âncora de renda é DERIVADA do transacional (buildAccountSummary + classifyIncome),
// nunca a renda declarada. Os dois canais consomem o MESMO contexto: só o formato de
// saída muda (texto corrido no WhatsApp; narrativa + bullets na home).
//
// Cache carimbado por canal: {whatsapp,home}Diagnoses/{ws} guarda o resultado + o
// CARIMBO (processedAt do último importJob 'done') + a VERSÃO da lógica. Tudo igual →
// devolve cacheado, ZERO chamada de IA.
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDataStamp = getDataStamp;
exports.loadDiagContext = loadDiagContext;
exports.generateWhatsappDiagnosis = generateWhatsappDiagnosis;
exports.generateHomeDiagnosis = generateHomeDiagnosis;
const account_core_1 = require("./account-core");
// Modelo do diagnóstico — o mesmo nos dois canais (consistência de voz app↔WhatsApp).
// trocar pra claude-opus-4-x aqui se precisar de mais qualidade
const DIAG_MODEL = "claude-haiku-4-5-20251001";
// Versão da LÓGICA (âncora + prompts). Bumpar invalida o cache dos dois canais.
const DIAG_VERSION = "v4-fonte-unica";
// Dado com mais de 10 dias → o texto REFORÇA que pode estar desatualizado. Não trava nada.
const STALE_DAYS = 10;
const BRL = (v) => `R$${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho",
    "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const mesLabel = (monthKey) => {
    const [y, m] = monthKey.split("-").map(Number);
    return `${MESES[m - 1]} de ${y}`;
};
// ── CARIMBO: quando os dados deste workspace mudaram pela última vez ─────────
async function getDataStamp(db, workspaceId) {
    const snap = await db.collection(`workspaces/${workspaceId}/importJobs`)
        .where("status", "==", "done").get();
    let max = null;
    for (const d of snap.docs) {
        const p = d.data()?.processedAt;
        const ms = p && typeof p.toMillis === "function" ? p.toMillis() : null;
        if (ms != null && (max == null || ms > max))
            max = ms;
    }
    return max;
}
// ── Contexto compartilhado pelos DOIS canais ────────────────────────────────
async function loadDiagContext(db, workspaceId, monthKey) {
    const prevKey = (0, account_core_1.prevMonthKey)(monthKey);
    const txCol = db.collection(`workspaces/${workspaceId}/transactions`);
    const [membersSnap, curSnap, prevSnap, faturasSnap, stamp] = await Promise.all([
        // Nomes do onboarding (displayName dos membros ativos) — âncora do match de PIX próprio.
        db.collection(`workspaces/${workspaceId}/members`).where("status", "==", "active").get(),
        txCol.where("monthKey", "==", monthKey).get(),
        txCol.where("monthKey", "==", prevKey).get(),
        db.collection(`workspaces/${workspaceId}/faturas`).get(),
        getDataStamp(db, workspaceId),
    ]);
    const userNames = membersSnap.docs
        .map((d) => String(d.data()?.displayName ?? "").trim()).filter(Boolean);
    const toTx = (d) => {
        const x = d.data();
        return {
            type: x.type === "income" ? "income" : "expense",
            amount: Number(x.amount ?? 0) || 0,
            category: String(x.category ?? "Outros"),
            date: String(x.date ?? ""),
            description: String(x.description ?? ""),
            source: typeof x.source === "string" ? x.source : undefined,
            sourceLabel: typeof x.sourceLabel === "string" ? x.sourceLabel : undefined,
            internal: x.internal === true,
        };
    };
    const transactions = curSnap.docs.map(toTx);
    const prevTransactions = prevSnap.docs.map(toTx);
    const summary = (0, account_core_1.buildAccountSummary)({ transactions, prevTransactions, userNames });
    // Categorias por CÓDIGO (a home usa pra cor/ícone; o WhatsApp usa o rótulo do summary).
    const accountExpenses = transactions
        .filter((t) => t.source !== "card" && !t.internal && t.type === "expense");
    const codeMap = {};
    for (const t of accountExpenses)
        codeMap[t.category] = (codeMap[t.category] ?? 0) + t.amount;
    const byCategoryCodes = Object.entries(codeMap).sort((a, b) => b[1] - a[1]);
    // Gasto do mês anterior em REAIS (a voz mostra valor, não %).
    const prevGasto = prevTransactions
        .filter((t) => t.source !== "card" && t.type === "expense")
        .reduce((s, t) => s + t.amount, 0);
    // ── Lente de CARTÃO: lê o agregado de fatura JÁ calculado pelo servidor. ──
    let card = { temCartao: false };
    if (!faturasSnap.empty) {
        let vencendoMes = 0, emAberto = 0, qtdVencendo = 0;
        let vencimentoMaisProximo = null;
        let algumaNaoConferida = false;
        for (const d of faturasSnap.docs) {
            const f = d.data();
            const total = Number(f.totalAPagar ?? 0) || 0;
            emAberto += total;
            if (f.verification === "nao_conferido")
                algumaNaoConferida = true;
            if (typeof f.vencimento === "string" && f.vencimento.startsWith(monthKey)) {
                vencendoMes += total;
                qtdVencendo += 1;
                if (!vencimentoMaisProximo || f.vencimento < vencimentoMaisProximo) {
                    vencimentoMaisProximo = f.vencimento;
                }
            }
        }
        card = { temCartao: true, vencendoMes, qtdVencendo, vencimentoMaisProximo, emAberto, algumaNaoConferida };
    }
    // ── Dado velho (>10 dias) → reforço no gancho, sem travar nada. ──
    const diasDesdeUpdate = stamp != null
        ? Math.floor((Date.now() - stamp) / (24 * 60 * 60 * 1000))
        : null;
    const isStale = diasDesdeUpdate != null && diasDesdeUpdate > STALE_DAYS;
    const stampLabel = stamp
        ? new Date(stamp).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })
        : "sem import registrado";
    const temMovimentoConta = transactions.some((t) => t.source !== "card");
    const temDadoAlgum = temMovimentoConta || card.temCartao;
    // Magro = não dá pra fechar veredito de fluxo (sem gasto OU sem renda derivada).
    const dadoMagro = summary.expensesCount === 0 || summary.rendaRef === null;
    return {
        monthKey, summary, byCategoryCodes, prevGasto, card,
        stamp, stampLabel, isStale, diasDesdeUpdate,
        temMovimentoConta, temDadoAlgum, dadoMagro,
    };
}
// ── Blocos de prompt compartilhados ─────────────────────────────────────────
function dadosBlock(ctx) {
    const s = ctx.summary;
    const r = s.renda;
    const resultado = s.net >= 0
        ? `Sobrou ${BRL(s.net)}`
        : `Faltou ${BRL(Math.abs(s.net))} (a conta fechou no vermelho)`;
    const naoRendaLinhas = r.itensNaoRenda
        .map((i) => `  • ${BRL(i.valor)} — "${i.descricao}" → ${i.kind === "divida" ? "parece EMPRÉSTIMO recebido" : "NÃO é renda (transferência própria/resgate/estorno/rendimento)"}`)
        .join("\n");
    const rendaLine = r.derivada > 0
        ? `- Renda de trabalho (o que o dado sustenta como renda): ${BRL(r.derivada)}` +
            (r.itensNaoRenda.length ? `\n- Do que entrou, NÃO é renda:\n${naoRendaLinhas}` : `\n- Todas as entradas do mês são renda de trabalho clara.`)
        : `- Renda de trabalho: NENHUMA entrada do mês parece renda de trabalho. NÃO afirme renda.`;
    const contaBlock = !ctx.temMovimentoConta
        ? `- AINDA NÃO VI MOVIMENTO DA CONTA neste mês. Diga isso com honestidade e convide a subir o extrato. NÃO invente números de conta.`
        : [
            `- Entrou: ${BRL(s.totalEntradas)}`,
            `- Saiu: ${BRL(s.totalGasto)}`,
            `- Resultado: ${resultado}`,
            rendaLine,
            s.topCat ? `- Onde mais pesou: ${s.topCat.nome} — ${BRL(s.topCat.valor)}` : `- Onde mais pesou: sem dados`,
            ctx.prevGasto > 0
                ? `- Vs mês passado: gastou ${BRL(Math.abs(s.totalGasto - ctx.prevGasto))} ${s.totalGasto >= ctx.prevGasto ? "A MAIS" : "A MENOS"}`
                : `- Vs mês passado: sem dados do mês anterior (não compare)`,
        ].join("\n");
    const cardBlock = !ctx.card.temCartao
        ? `- AINDA NÃO VI NENHUM CARTÃO/FATURA. Diga isso com honestidade e convide a importar a fatura. NÃO invente nada de cartão.`
        : [
            ctx.card.qtdVencendo > 0
                ? `- Fatura vencendo em ${mesLabel(ctx.monthKey)}: ${BRL(ctx.card.vencendoMes)}${ctx.card.vencimentoMaisProximo ? ` (vence ${ctx.card.vencimentoMaisProximo.slice(8, 10)}/${ctx.card.vencimentoMaisProximo.slice(5, 7)})` : ""}`
                : `- Nenhuma fatura vencendo em ${mesLabel(ctx.monthKey)}`,
            `- Total em aberto nos cartões: ${BRL(ctx.card.emAberto)}`,
            ctx.card.algumaNaoConferida
                ? `- ATENÇÃO: uma fatura não fechou a conta na conferência — pode faltar lançamento. Diga isso com honestidade.`
                : "",
        ].filter(Boolean).join("\n");
    return `💸 CONTA (fluxo de caixa do mês):\n${contaBlock}\n\n💳 CARTÃO (lente separada — NUNCA somar com a conta):\n${cardBlock}`;
}
function regrasBlock(ctx) {
    const r = ctx.summary.renda;
    const confianca = !ctx.temMovimentoConta || ctx.dadoMagro
        ? `DADO MAGRO: não dá pra fechar um veredito de verdade com o que tem aqui. NÃO force diagnóstico,
NÃO invente. Diga honestamente o que falta e convide a alimentar os dados no app.`
        : r.confianca === "alta"
            ? `CONFIANÇA DA RENDA: ALTA — a foto tá limpa (quase tudo que entrou é renda de trabalho).
Pode FALAR DIRETO: "entrou X, sobrou Y, tá tranquilo/tá apertado".`
            : `CONFIANÇA DA RENDA: BAIXA — boa parte do que entrou NÃO é renda de trabalho clara.
NÃO DECRETE. MOSTRE a incerteza e APONTE de onde ela vem. Diga quanto entrou, quanto disso PARECE
renda recorrente, e o que o resto parece ser. Abra os dois cenários ("se isso for renda, é assim;
se foi pontual, é assim") e devolva a escolha: "você que sabe".`;
    const emprestimo = r.breakdown.divida > 0
        ? `\nEMPRÉSTIMO: uma das entradas parece empréstimo recebido. Aceno HONESTO — não é renda e volta
como parcela depois. NÃO invente valor de parcela, número de parcelas, juros nem prazo.`
        : "";
    const velho = ctx.isStale
        ? `\nDADO VELHO: a última atualização foi há ${ctx.diasDesdeUpdate} dias. REFORCE que a foto pode
estar desatualizada e peça pra atualizar os dados no app. Não trave nada — é só um reforço no gancho.`
        : "";
    return `${confianca}${emprestimo}${velho}`;
}
const VOZ = `Você é o Salvô — o amigo que entende de dinheiro e explica o panorama sem enrolação.

REGRAS DE VOZ (obrigatórias):
- Português neutro: escreva "pra você", NUNCA "pra ti". Neutro de gênero: nunca "mano", "cara", "irmão".
- Mostre VALORES EM REAIS. NUNCA escreva percentuais (nada de "%").
- NUNCA dê nota, pontuação ou score.
- CONTA e CARTÃO são DUAS leituras SEPARADAS. Jamais some fatura de cartão no resultado do mês.
- Frases curtas. Sem julgamento moral.
- NADA de jargão de consultor. PROIBIDO: "folga real", "margem", "comprometimento", "saúde financeira",
  "otimizar", "alocar", "fluxo de caixa", "déficit", "superávit", "patrimônio".
  Fale como gente fala: "sobrou", "tá tranquilo", "tá apertado", "tá puxado".
- Descreva a SITUAÇÃO, não adjetive a PESSOA.
  ERRADO: "você tá com folga real", "você é organizado".
  CERTO: "os gastos na conta estão bem tranquilos até aqui".
- Todo conselho vem com o PORQUÊ, ligado ao dado real. Explique o risco e devolva a escolha pra pessoa.
- NUNCA dê veredito categórico de decisão ("não pode gastar 500"). Você MOSTRA o risco, a escolha é dela.`;
function guardrails(ctx) {
    return `GUARDRAILS (invioláveis):
- O MÊS ANALISADO É ${mesLabel(ctx.monthKey)}. É o único mês que você resume. NUNCA diga que o panorama
  é de outro mês. A "última atualização dos dados" é a data do IMPORT — NÃO é o mês, e pode ser de outro.
- Use APENAS os números fornecidos. NUNCA invente ou estime número que não está aqui.
- NUNCA aconselhe algo que o dado não sustenta. Dado ausente → diga com honestidade.
- RENDA é só o que está marcado como renda de trabalho. Transferência própria, resgate, estorno,
  rendimento e empréstimo NÃO são renda — nunca os some como se fossem.`;
}
async function askModel(client, prompt, maxTokens) {
    const msg = await client.messages.create({
        model: DIAG_MODEL,
        max_tokens: maxTokens,
        messages: [{ role: "user", content: prompt }],
    });
    const raw = msg.content.find((b) => b.type === "text")?.text ?? "";
    const m = raw.match(/\{[\s\S]*\}/);
    if (!m)
        throw new Error("diagnóstico veio fora do schema");
    return JSON.parse(m[0]);
}
// ─────────────────────────────────────────────────────────────────────────────
// CANAL 1 — WhatsApp (texto corrido)
// ─────────────────────────────────────────────────────────────────────────────
async function generateWhatsappDiagnosis(db, client, workspaceId, monthKey) {
    const cacheRef = db.doc(`whatsappDiagnoses/${workspaceId}`);
    const ctx = await loadDiagContext(db, workspaceId, monthKey);
    const cached = await cacheRef.get();
    if (cached.exists) {
        const c = cached.data();
        if (c.version === DIAG_VERSION && c.monthKey === monthKey && (c.stamp ?? null) === ctx.stamp && c.texto) {
            return { texto: c.texto, cached: true };
        }
    }
    // EMPTY STATE total → sem IA, sem inventar.
    if (!ctx.temDadoAlgum) {
        const texto = "Ainda não tenho dado nenhum pra olhar aqui. 🤷\n\n" +
            "Sobe um extrato ou uma fatura no app que eu te conto na hora como tá a sua situação.";
        await cacheRef.set({ version: DIAG_VERSION, monthKey, stamp: ctx.stamp, texto, updatedAt: new Date() }, { merge: true });
        return { texto, cached: false };
    }
    const prompt = `${VOZ}
Está mandando uma mensagem de WhatsApp, não um relatório. Curto e escaneável.
- Feche com a data da última atualização dos dados e um gancho curto pra alimentar dados novos no app.

${regrasBlock(ctx)}

${guardrails(ctx)}

DADOS REAIS (${mesLabel(monthKey)}):

${dadosBlock(ctx)}

ÚLTIMA ATUALIZAÇÃO DOS DADOS: ${ctx.stampLabel}

Escreva a mensagem final do WhatsApp. Use os emojis 💸 e 💳 pra separar as duas leituras.
O conselho do fim nasce da SITUAÇÃO REAL acima, sempre com o porquê.

Retorne APENAS um JSON válido, sem markdown:
{ "texto": "a mensagem completa do WhatsApp, com quebras de linha \\n" }`;
    const out = await askModel(client, prompt, 700);
    const texto = String(out.texto ?? "");
    if (!texto)
        throw new Error("diagnóstico do WhatsApp veio vazio");
    await cacheRef.set({ version: DIAG_VERSION, monthKey, stamp: ctx.stamp, texto, updatedAt: new Date() }, { merge: true });
    return { texto, cached: false };
}
async function generateHomeDiagnosis(db, client, workspaceId, monthKey) {
    const cacheRef = db.doc(`homeDiagnoses/${workspaceId}`);
    const ctx = await loadDiagContext(db, workspaceId, monthKey);
    const base = {
        summary: ctx.summary,
        byCategoryCodes: ctx.byCategoryCodes,
        stale: ctx.isStale,
        stampLabel: ctx.stampLabel,
    };
    const cached = await cacheRef.get();
    if (cached.exists) {
        const c = cached.data();
        if (c.version === DIAG_VERSION && c.monthKey === monthKey && (c.stamp ?? null) === ctx.stamp && c.diag?.narrativa) {
            return { ...base, diag: c.diag, cached: true };
        }
    }
    // EMPTY STATES → texto honesto, sem IA e sem veredito forçado.
    const salvarEDevolver = async (diag) => {
        await cacheRef.set({ version: DIAG_VERSION, monthKey, stamp: ctx.stamp, diag, updatedAt: new Date() }, { merge: true });
        return { ...base, diag, cached: false };
    };
    if (!ctx.temDadoAlgum) {
        return salvarEDevolver({
            narrativa: "Ainda não vi nenhum dado seu. Sobe um extrato ou uma fatura que eu te mostro como tá a situação.",
            bullet1: null, bullet2: null, scoreLabel: "Sem dados ainda",
        });
    }
    if (!ctx.temMovimentoConta) {
        return salvarEDevolver({
            narrativa: "Ainda não vi movimento da sua conta neste mês. Sobe o extrato que eu te mostro pra onde o dinheiro foi.",
            bullet1: ctx.card.temCartao ? "Por enquanto só enxergo o cartão — a conta ainda tá vazia aqui." : null,
            bullet2: null, scoreLabel: "Sem dados da conta",
        });
    }
    const prompt = `${VOZ}
Está escrevendo o resumo do painel (app), não uma mensagem de WhatsApp.

${regrasBlock(ctx)}

${guardrails(ctx)}

DADOS REAIS (${mesLabel(monthKey)}):

${dadosBlock(ctx)}

ÚLTIMA ATUALIZAÇÃO DOS DADOS: ${ctx.stampLabel}

Retorne APENAS um JSON válido, sem markdown:
{
  "narrativa": "2-3 frases. Começa com o resultado do mês, depois o peso disso. Descreve a SITUAÇÃO.",
  "bullet1": "Uma observação curta sobre onde mais pesou, com impacto real.",
  "bullet2": "Uma observação curta sobre a comparação com o mês passado OU sobre o cartão.",
  "scoreLabel": "Rótulo curto da situação, SEM nota e SEM número. Ex.: 'Tá tranquilo', 'Tá apertado', 'Dá pra melhorar', 'Difícil dizer'."
}`;
    const out = await askModel(client, prompt, 600);
    const diag = {
        narrativa: out.narrativa ?? null,
        bullet1: out.bullet1 ?? null,
        bullet2: out.bullet2 ?? null,
        scoreLabel: out.scoreLabel ?? null,
    };
    if (!diag.narrativa)
        throw new Error("diagnóstico da home veio vazio");
    await cacheRef.set({ version: DIAG_VERSION, monthKey, stamp: ctx.stamp, diag, updatedAt: new Date() }, { merge: true });
    return { ...base, diag, cached: false };
}
//# sourceMappingURL=diagnosis-core.js.map