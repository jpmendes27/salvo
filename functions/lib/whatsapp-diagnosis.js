"use strict";
// ─── Diagnóstico do WhatsApp (conta + cartão, com cache carimbado) ───────────
// Dá VOZ ao motor de conta (account-core.ts) na folha "Como tá financeiramente?".
// Conta e cartão são DUAS leituras separadas — cartão NUNCA soma no fluxo de caixa.
//
// Cache carimbado: whatsappDiagnoses/{workspaceId} guarda o texto + o CARIMBO
// (processedAt do último importJob 'done'). Carimbo igual → devolve cacheado, ZERO
// chamada de IA. Carimbo diferente (ou sem cache) → regenera e atualiza.
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDataStamp = getDataStamp;
exports.generateWhatsappDiagnosis = generateWhatsappDiagnosis;
const account_core_1 = require("./account-core");
// Modelo do diagnóstico do WhatsApp. Mesmo do generateDiagnosis da home —
// consistência de voz app↔WhatsApp, mais barato e mais rápido.
// trocar pra claude-opus-4-x aqui se precisar de mais qualidade
const WHATSAPP_DIAG_MODEL = "claude-haiku-4-5-20251001";
// Versão da LÓGICA do diagnóstico (âncora de renda + prompt). Faz o cache invalidar
// sozinho quando a régua muda — senão o texto velho sobreviveria ao carimbo igual.
const DIAG_VERSION = "v3.1-tom-popular-mes-fix";
const BRL = (v) => `R$${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho",
    "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const mesLabel = (monthKey) => {
    const [y, m] = monthKey.split("-").map(Number);
    return `${MESES[m - 1]} de ${y}`;
};
// ── CARIMBO: quando os dados deste workspace mudaram pela última vez ──────────
// = processedAt do último importJob com status 'done'. Sem orderBy pra não exigir
// índice composto: os jobs por workspace são poucos, o max sai em memória.
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
// ── Lente de CONTA (fluxo de caixa) ──────────────────────────────────────────
async function loadAccountLens(db, workspaceId, monthKey) {
    const prevKey = (0, account_core_1.prevMonthKey)(monthKey);
    const txCol = db.collection(`workspaces/${workspaceId}/transactions`);
    const [membersSnap, curSnap, prevSnap] = await Promise.all([
        // Nomes do onboarding (displayName de TODOS os membros ativos) — âncora do match de
        // PIX próprio. O "domínio" do casal é a unidade: PIX entre cônjuges não é renda nova.
        db.collection(`workspaces/${workspaceId}/members`).where("status", "==", "active").get(),
        txCol.where("monthKey", "==", monthKey).get(),
        txCol.where("monthKey", "==", prevKey).get(),
    ]);
    const userNames = membersSnap.docs
        .map((d) => String(d.data()?.displayName ?? "").trim())
        .filter(Boolean);
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
    // Gasto do mês anterior EM REAIS (a voz mostra valor, não %). Mesmo filtro que o
    // app usa pro mês anterior (só exclui cartão).
    const prevGasto = prevTransactions
        .filter((t) => t.source !== "card")
        .filter((t) => t.type === "expense")
        .reduce((s, t) => s + t.amount, 0);
    return { summary, prevGasto, hasData: transactions.length > 0 };
}
// ── Lente de CARTÃO (separada — nunca soma no fluxo) ─────────────────────────
// Lê o agregado de fatura JÁ CALCULADO pelo servidor (processFatura). Não recalcula.
async function loadCardLens(db, workspaceId, monthKey) {
    const snap = await db.collection(`workspaces/${workspaceId}/faturas`).get();
    if (snap.empty)
        return { temCartao: false };
    let vencendoMes = 0, emAberto = 0, qtdVencendo = 0;
    let vencimentoMaisProximo = null;
    let algumaNaoConferida = false;
    for (const d of snap.docs) {
        const f = d.data();
        const total = Number(f.totalAPagar ?? 0) || 0;
        emAberto += total;
        if (f.verification === "nao_conferido")
            algumaNaoConferida = true;
        // "Vencendo no mês" = vencimento cai no mês corrente (mesma regra da home).
        if (typeof f.vencimento === "string" && f.vencimento.startsWith(monthKey)) {
            vencendoMes += total;
            qtdVencendo += 1;
            if (!vencimentoMaisProximo || f.vencimento < vencimentoMaisProximo) {
                vencimentoMaisProximo = f.vencimento;
            }
        }
    }
    return {
        temCartao: true,
        vencendoMes, qtdVencendo, vencimentoMaisProximo, emAberto, algumaNaoConferida,
    };
}
// ── Prompt (a voz) ───────────────────────────────────────────────────────────
function buildPrompt(args) {
    const { monthKey, account, card, dataStampLabel } = args;
    const s = account.summary;
    const resultado = s.net >= 0
        ? `Sobrou ${BRL(s.net)}`
        : `Faltou ${BRL(Math.abs(s.net))} (fechou no vermelho)`;
    // ── RENDA DERIVADA + honestidade calibrada pela CONFIANÇA ──────────────────
    const r = s.renda;
    const naoRendaLinhas = r.itensNaoRenda
        .map((i) => `  • ${BRL(i.valor)} — "${i.descricao}" → ${i.kind === "divida" ? "parece EMPRÉSTIMO recebido" : "não é renda (transferência própria/resgate/estorno/rendimento)"}`)
        .join("\n");
    const rendaLine = r.derivada > 0
        ? `- Renda de trabalho (o que o dado sustenta como renda): ${BRL(r.derivada)}` +
            (r.itensNaoRenda.length
                ? `\n- Do que entrou, NÃO é renda:\n${naoRendaLinhas}`
                : `\n- Todas as entradas do mês são renda de trabalho clara.`)
        : `- Renda de trabalho: NENHUMA entrada do mês parece renda de trabalho. NÃO afirme renda; diga isso com honestidade.`;
    const confiancaRule = r.confianca === "alta"
        ? `CONFIANÇA DA RENDA: ALTA — a foto tá limpa (quase tudo que entrou é renda de trabalho).
Pode FALAR DIRETO, com segurança: "entrou X, sobrou Y, tá tranquilo/tá apertado".`
        : `CONFIANÇA DA RENDA: BAIXA — boa parte do que entrou NÃO é renda de trabalho clara.
NÃO DECRETE. MOSTRE a incerteza e APONTE de onde ela vem, usando os itens listados acima.
Estrutura obrigatória: diga quanto entrou no total, quanto disso PARECE renda recorrente, e o que
o resto parece ser. Depois abra os dois cenários ("se isso for renda, sua situação é assim; se foi
pontual, é assim") e devolva a escolha: "você que sabe". NUNCA finja certeza que o dado não dá.`;
    const emprestimoRule = r.breakdown.divida > 0
        ? `EMPRÉSTIMO: uma das entradas parece empréstimo recebido. Dê um aceno HONESTO — isso não é
renda, e volta como parcela depois. NÃO invente valor de parcela, número de parcelas, juros nem prazo.`
        : "";
    const topLine = s.topCat
        ? `- Onde mais pesou: ${s.topCat.nome} — ${BRL(s.topCat.valor)}`
        : `- Onde mais pesou: sem dados`;
    const varLine = account.prevGasto > 0
        ? `- Vs mês passado: gastou ${BRL(Math.abs(s.totalGasto - account.prevGasto))} ${s.totalGasto >= account.prevGasto ? "A MAIS" : "A MENOS"}`
        : `- Vs mês passado: sem dados do mês anterior (não compare)`;
    const cardBlock = !card.temCartao
        ? `- Nenhuma fatura de cartão importada. NÃO invente nada sobre cartão; se citar, diga que não tem fatura no sistema.`
        : [
            card.qtdVencendo > 0
                ? `- Fatura vencendo em ${mesLabel(monthKey)}: ${BRL(card.vencendoMes)}${card.vencimentoMaisProximo ? ` (vence ${card.vencimentoMaisProximo.slice(8, 10)}/${card.vencimentoMaisProximo.slice(5, 7)})` : ""}`
                : `- Nenhuma fatura vencendo em ${mesLabel(monthKey)}`,
            `- Total em aberto nos cartões: ${BRL(card.emAberto)}`,
            card.algumaNaoConferida
                ? `- ATENÇÃO: uma fatura não fechou a conta na conferência — pode faltar lançamento. Diga isso com honestidade.`
                : "",
        ].filter(Boolean).join("\n");
    return `Você é o Salvô — o amigo que entende de dinheiro e explica o panorama sem enrolação.
Está mandando uma mensagem de WhatsApp, não um relatório.

REGRAS DE VOZ (obrigatórias):
- Português neutro: escreva "pra você", NUNCA "pra ti". Neutro de gênero: nunca "mano", "cara", "irmão".
- Mostre VALORES EM REAIS. NUNCA escreva percentuais (nada de "%"). O impacto vem do número concreto.
- NUNCA dê nota, pontuação ou score.
- CONTA e CARTÃO são DUAS leituras SEPARADAS. Jamais some fatura de cartão no resultado do mês.
- Curto e escaneável no WhatsApp. Frases curtas. Sem julgamento moral.
- Todo conselho vem com o PORQUÊ, ligado ao dado real (ex.: "segura o parcelamento essa semana porque
  você fechou no vermelho e o cartão já tá puxado"). Explique o risco e deixe a escolha com a pessoa —
  não proíba, não mande.
- NUNCA dê veredito categórico de decisão ("não pode gastar 500", "cancele isso"). Você MOSTRA o risco
  com o porquê e devolve a escolha pra pessoa.
- NADA de jargão de consultor financeiro. PROIBIDO: "folga real", "margem", "comprometimento",
  "saúde financeira", "otimizar", "alocar", "fluxo de caixa", "déficit", "superávit", "patrimônio".
  Fale como gente fala na mesa do bar: "sobrou", "tá tranquilo", "tá apertado", "tá puxado".
- Descreva a SITUAÇÃO, não adjetive a PESSOA. Fale do que os números mostram, não de como a pessoa é.
  ERRADO: "você tá com folga real", "você é organizado", "você está no vermelho".
  CERTO: "os gastos na conta estão bem tranquilos até aqui", "a conta fechou no vermelho esse mês".
- REGISTRO DE REFERÊNCIA (calibragem de tom, NÃO texto pra copiar):
  "Os gastos na conta estão bem tranquilos até aqui. Isso dá espaço pra você respirar, planejar e
  até investir se quiser. O cartão tá sob controle."
  Repare: popular, descreve a situação, não rotula a pessoa, sem termo técnico.
- Feche com a data da última atualização dos dados e um gancho curto pra alimentar dados novos no app.

${confiancaRule}
${emprestimoRule}

GUARDRAILS (invioláveis):
- O MÊS ANALISADO É ${mesLabel(monthKey)}. É o único mês que você está resumindo. NUNCA diga que o
  panorama é de outro mês. ATENÇÃO: a "última atualização dos dados" é a data em que a pessoa
  importou o extrato — NÃO é o mês analisado, e pode ser de outro mês. Não confunda as duas.
- Use APENAS os números abaixo. NUNCA invente ou estime um número que não está aqui.
- NUNCA aconselhe algo que o dado não sustenta.
- Se um dado não existe, diga com honestidade em vez de inventar.
- RENDA é só o que está marcado como renda de trabalho. Transferência própria, resgate, estorno,
  rendimento e empréstimo NÃO são renda — nunca os some como se fossem.

DADOS REAIS (${mesLabel(monthKey)}):

💸 CONTA (fluxo de caixa do mês):
- Entrou: ${BRL(s.totalEntradas)}
- Saiu: ${BRL(s.totalGasto)}
- Resultado: ${resultado}
${rendaLine}
${topLine}
${varLine}

💳 CARTÃO (lente separada — NUNCA somar com a conta):
${cardBlock}

ÚLTIMA ATUALIZAÇÃO DOS DADOS: ${dataStampLabel}

Escreva a mensagem final do WhatsApp. Use os emojis 💸 e 💳 pra separar as duas leituras.
O conselho do fim deve nascer da SITUAÇÃO REAL acima (fechou no vermelho? cartão puxado? sobrou folga?),
sempre com o porquê.

Retorne APENAS um JSON válido, sem markdown:
{ "texto": "a mensagem completa do WhatsApp, com quebras de linha \\n" }`;
}
// ── Entrada principal ────────────────────────────────────────────────────────
async function generateWhatsappDiagnosis(db, client, workspaceId, monthKey) {
    const stamp = await getDataStamp(db, workspaceId);
    const cacheRef = db.doc(`whatsappDiagnoses/${workspaceId}`);
    // Cache carimbado: mesmo mês E mesmo carimbo → dados não mudaram → zero IA.
    const cached = await cacheRef.get();
    if (cached.exists) {
        const c = cached.data();
        if (c.version === DIAG_VERSION && c.monthKey === monthKey && (c.stamp ?? null) === stamp && c.texto) {
            return { texto: c.texto, cached: true };
        }
    }
    const [account, card] = await Promise.all([
        loadAccountLens(db, workspaceId, monthKey),
        loadCardLens(db, workspaceId, monthKey),
    ]);
    // Guardrail duro: sem NENHUM dado, não chama IA e não inventa diagnóstico.
    if (!account.hasData && !card.temCartao) {
        const texto = "Ainda não tenho dado nenhum pra olhar aqui. 🤷\n\n" +
            "Sobe um extrato ou uma fatura no app que eu te conto na hora como tá a sua situação.";
        await cacheRef.set({ version: DIAG_VERSION, monthKey, stamp, texto, updatedAt: new Date() }, { merge: true });
        return { texto, cached: false };
    }
    const dataStampLabel = stamp
        ? new Date(stamp).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })
        : "sem import registrado";
    const prompt = buildPrompt({ monthKey, account, card, dataStampLabel });
    const msg = await client.messages.create({
        model: WHATSAPP_DIAG_MODEL,
        max_tokens: 700,
        messages: [{ role: "user", content: prompt }],
    });
    const raw = msg.content.find((b) => b.type === "text")?.text ?? "";
    const m = raw.match(/\{[\s\S]*\}/);
    const texto = (m ? JSON.parse(m[0]).texto : null) ?? "";
    if (!texto)
        throw new Error("diagnóstico do WhatsApp veio vazio");
    await cacheRef.set({ version: DIAG_VERSION, monthKey, stamp, texto, updatedAt: new Date() }, { merge: true });
    return { texto, cached: false };
}
//# sourceMappingURL=whatsapp-diagnosis.js.map