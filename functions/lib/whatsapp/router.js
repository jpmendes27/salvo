"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.REGISTRY = void 0;
exports.processInbound = processInbound;
const state_1 = require("./state");
const verification_1 = require("./verification");
const menu_1 = require("./leaves/menu");
const help_1 = require("./leaves/help");
const diagnosisStub_1 = require("./leaves/diagnosisStub");
const reminderStub_1 = require("./leaves/reminderStub");
// REGISTRO de folhas: mode → folha. NÃO é um switch cravado — folha nova é uma linha.
exports.REGISTRY = {
    idle: menu_1.menuLeaf,
    help: help_1.helpLeaf,
    help_capture: help_1.helpLeaf, // mesma folha, 2ª etapa (captura o relato)
    diagnosis: diagnosisStub_1.diagnosisStubLeaf,
    reminder: reminderStub_1.reminderStubLeaf,
};
// Porta do oráculo (dormível): se um dia existir uma folha 'raw' registrada como
// fallback de texto livre, o roteador a acionaria aqui em vez de cair no menu. No v1
// é null — o caminho existe no código, sem ninguém usar. NÃO implementar folha 'raw'.
const RAW_FALLBACK = null;
// Mensagem genérica de convite — MESMA no portão (1ª vez) e em QUALQUER falha de
// código. Anti-enumeração: nunca revela se um código existe, de quem é, ou se há conta.
const GENERIC_LINK_MSG = "Pra isso eu preciso te reconhecer aqui primeiro. Abre o Salvô!, entra em " +
    "\"Vincular WhatsApp\" e me manda o código que aparecer lá. Aí a gente destrava.";
const WELCOME_LINKED = "Boa, tá tudo certo por aqui! 👊";
const RESTART_MSG = "Deixa a gente começar de novo, tranquilo.";
function ctxFor(base, state) {
    return { ...base, state };
}
// Roda uma folha passando pelo PORTÃO DE VÍNCULO. Devolve o resultado semântico e o
// próximo estado a persistir. É o único lugar que aplica o gate — folha não sabe disso.
async function runLeafWithGate(mode, ctx, now) {
    const leaf = exports.REGISTRY[mode] ?? menu_1.menuLeaf;
    // PORTÃO: folha que toca a conta + número não vinculado → guarda a intenção, entra
    // em aguardando-código e devolve a mensagem genérica.
    if (leaf.requiresLink && !ctx.account) {
        const state = {
            mode: "awaiting_link",
            context: mode, // INTENÇÃO PENDENTE (retomada quando o vínculo fechar)
            turnCount: (ctx.state.turnCount ?? 0) + 1,
            lastActivityAt: now,
        };
        return { out: { reply: GENERIC_LINK_MSG }, state };
    }
    // v1: todas as folhas são 'structured'. Uma folha 'raw' (futuro oráculo) receberia
    // ctx.text intocado; hoje ninguém declara 'raw', então o caminho fica dormente.
    const res = await leaf.handle(ctx);
    const nextMode = res.nextMode ?? leaf.mode;
    const changedFlow = nextMode !== ctx.state.mode;
    const state = {
        mode: nextMode,
        context: res.context === undefined ? (ctx.state.context ?? null) : res.context,
        // idle não é um fluxo contado; trocar de fluxo zera o contador.
        turnCount: nextMode === "idle" || changedFlow ? 0 : (ctx.state.turnCount ?? 0) + 1,
        lastActivityAt: now,
    };
    return { out: res, state };
}
function withWelcome(out) {
    if (out.reply)
        return { ...out, reply: `${WELCOME_LINKED}\n\n${out.reply}` };
    if (out.options) {
        return { ...out, optionsHeader: `${WELCOME_LINKED}${out.optionsHeader ? "\n" + out.optionsHeader : ""}` };
    }
    return out;
}
// Processa UM inbound e devolve o resultado SEMÂNTICO a enviar (o transporte
// renderiza). Lógica pura sobre deps injetáveis — testável sem rede.
async function processInbound(inbound, deps) {
    const now = deps.now();
    const { phone, text } = inbound;
    const normalizedText = (0, state_1.normalize)(text);
    let state = (await deps.store.loadState(phone)) ?? (0, state_1.idleState)(now);
    state = (0, state_1.applyTimeout)(state, now); // fluxo parado > 30 min → idle
    const account = await deps.store.getLink(phone);
    const base = { phone, text, normalizedText, account, services: deps.services };
    // 1) SAÍDA EXPLÍCITA — "menu"/"voltar" derruba pro menu (inclusive aguardando código).
    if (normalizedText === "menu" || normalizedText === "voltar") {
        const idle = (0, state_1.idleState)(now);
        const out = await menu_1.menuLeaf.handle(ctxFor(base, idle));
        await deps.store.saveState(phone, idle);
        return out;
    }
    // 2) LIMITE DE TURNOS — fluxo travado além de 10 turnos recomeça.
    if (state.mode !== "idle" && state.turnCount > state_1.MAX_TURNS) {
        const idle = (0, state_1.idleState)(now);
        await deps.store.saveState(phone, idle);
        return { reply: RESTART_MSG, options: menu_1.MENU_OPTIONS };
    }
    // 3) AGUARDANDO CÓDIGO — o texto é tentativa de código (anti-enumeração total).
    if (state.mode === "awaiting_link") {
        const linked = await (0, verification_1.tryVerifyAndLink)(phone, text, deps.store, now);
        if (!linked) {
            // QUALQUER falha → MESMA mensagem genérica; segue aguardando (turno conta).
            const st = { ...state, turnCount: state.turnCount + 1, lastActivityAt: now };
            await deps.store.saveState(phone, st);
            return { reply: GENERIC_LINK_MSG };
        }
        // Casou → conta vinculada. RETOMA a intenção pendente, se houver.
        const pending = state.context ?? null;
        const linkedBase = { ...base, account: linked };
        if (pending && exports.REGISTRY[pending]) {
            const pendingState = { ...(0, state_1.idleState)(now), mode: pending };
            const { out, state: after } = await runLeafWithGate(pending, ctxFor(linkedBase, pendingState), now);
            await deps.store.saveState(phone, { ...after, context: null }); // intenção consumida
            return withWelcome(out);
        }
        // Sem intenção pendente → confirma e mostra o menu.
        const idle = (0, state_1.idleState)(now);
        const out = await menu_1.menuLeaf.handle(ctxFor(linkedBase, idle));
        await deps.store.saveState(phone, idle);
        return withWelcome(out);
    }
    // 4) DISPATCH normal pela folha do modo atual.
    const first = await runLeafWithGate(state.mode, ctxFor(base, state), now);
    // Seleção de menu → roda JÁ a folha escolhida (passa pelo portão se exigir vínculo).
    if (first.out.dispatchNext && first.out.nextMode) {
        const jumpState = { ...first.state, mode: first.out.nextMode };
        const jump = await runLeafWithGate(first.out.nextMode, ctxFor(base, jumpState), now);
        await deps.store.saveState(phone, jump.state);
        return jump.out;
    }
    // Input não reconhecido cai no menu naturalmente (a folha idle já devolve o menu).
    // Porta dormente do oráculo: se houvesse um fallback 'raw', entraria aqui.
    void RAW_FALLBACK;
    await deps.store.saveState(phone, first.state);
    return first.out;
}
//# sourceMappingURL=router.js.map