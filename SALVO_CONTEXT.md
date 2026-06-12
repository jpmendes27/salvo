# SALVÔ! — Contexto do Produto

> Camada **estável**: decisões, arquitetura, princípios e voz. Valores que vivem em
> código (tokens de design, categorias, flags) **não ficam aqui** — são referenciados
> pelo caminho do arquivo. Regra de ouro: **não duplicar o que o código já guarda.**

---

## Produto
Salvô! — *"o amigo rico que o brasileiro nunca teve"*. Gestão financeira pessoal e
compartilhada pro brasileiro comum (renda ~R$1.500–4.000, sem educação financeira).
Importa extratos e faturas, categoriza via Claude, diagnostica com honestidade,
workspace compartilhado (casal/família). Não é planilha — é conselheiro honesto, sem
julgamento, em linguagem popular.

**Princípio-mãe — sem promessa furada:** nunca mostrar dado errado, nunca fabricar
número, sempre degradar honestamente. Vale pra mensagem e pra integridade de dados.

## Stack
Next.js 14 estático (GitHub Pages) · Firebase (Auth, Firestore, Functions v2/Cloud Run,
project `fincheck-pro`, região `us-central1`) · Claude (Anthropic API) · WhatsApp
(Evolution API) · e-mail (Resend). Limite real da conta Anthropic (header): 80K output
tok/min · 500K input · 1000 req/min. O pipeline usa guard a 72K + chunks paralelos.

**Identificadores imutáveis (NÃO renomear, nem em rebrand):** project id `fincheck-pro`,
domínios, service accounts.

## Design system
Tokens (cores, espaçamento, raio, etc.) vivem em `src/lib/design-system.ts` — **fonte da
verdade, ler de lá, nunca duplicar nem alterar sem pedido explícito.**
Fontes: **Plus Jakarta Sans** (UI + valores de lista/transação), **DM Serif Display**
(logo/display), **DM Mono** (uso reservado — *não* é "todo valor monetário": os valores
de lista em /transactions e /cards usam Plus Jakarta).

## Telas
`/login` · `/onboarding` · `/home` · `/transactions` · `/top-categories` · `/projecao` ·
`/metas` · `/members` · `/cards` (feature de cartão — **GA, disponível pra toda a base**;
a tela/resumo aparecem quando há ≥1 cartão, descobertos ao importar uma fatura).

## Arquitetura — Pipeline de importação
Caminho **único server-side** pra todo arquivo (cliente sobe o arquivo cru; sem pdfjs no
cliente — evita OOM em aparelho fraco). Servidor: extrai texto → adapter determinístico
por banco quando existe → Claude em lotes só como fallback.

**Gate de reconciliação** universal e não-bypassável:
- Extrato ancora no **saldo final declarado** no cabeçalho (contagem + cadeia de saldo).
- Fatura ancora nos **totais** (Saldo Anterior + Despesas − Pagamentos − Créditos = Saldo
  Desta Fatura).
- `status=done` só se reconcilia; senão falha honesto. **Nunca "X de X" com dado errado.**

Async: trigger de Storage → `processImportJob` → status no Firestore → cliente via
`onSnapshot`. Timeout 540s + watchdog interno 500s. Alerting em 3 camadas (Resend + beacon
do cliente + Cloud Monitoring de latência).

Categorização: **cascata determinística** (regras + seed de merchants comuns + cache
Firestore `merchantCategories`) → Claude só pro resíduo, resultado volta pro cache. Custo
tende a zero conforme o cache enche.

**Upload de múltiplos arquivos:** um job por arquivo; cada um se autodetecta (extrato vs
fatura) e roteia sozinho; resumo honesto por arquivo; **idempotência** (reimportar atualiza,
não duplica); concorrência limitada (cap por instância, abaixo do teto real da conta).

## Arquitetura — Feature de cartão (lente separada)
**INEGOCIÁVEL — cartão é uma lente separada da conta.** Compras de cartão (`source='card'`)
**nunca** entram no diagnóstico/score de fluxo de caixa nem aparecem em /transactions. No
fluxo de caixa, o que conta é o **pagamento da fatura** (transação de conta). Nunca misturar
agregações das duas lentes.

- **Detecção automática** de fatura (marcadores: Vencimento, Saldo Anterior, Saldo Desta
  Fatura, Pagamento Mínimo, Limite, CET, Rotativo, cartão mascarado). O usuário **não**
  declara o tipo.
- **Data model:** `cards` (banco, nome, last4, limites, fechamento, vencimento) · transações
  `source='card'` + cardId + faturaPeriod + parcela{atual,total} + category · `faturas`
  (saldoAnterior, totalDespesas, totalPagamentos, totalCreditos, totalAPagar, vencimento).
  Reconcilia por totais. Coleções de cartão são read-only nas regras do Firestore.
- **"Mês" de cartão = `faturaPeriod` (competência), nunca o mês-calendário da data da
  transação** (a fatura cruza dois meses-calendário). O urlParam de mês seleciona o
  faturaPeriod.
- **/cards:** abas [Todos os cartões] + uma por cartão. Por cartão e agregado: diagnóstico,
  compras por categoria, lista de transações com recategorizar e **apagar em lote**
  (paridade com /transactions), navegação por período. **Apagar transação não altera o total
  autoritativo da fatura** (o que o banco cobra); só recalcula as views derivadas.
- **Diagnóstico de cartão:** Cloud Function, voz do Salvô, versão pocket. **Cacheado**
  (regenera só quando fatura ou renda mudam). **Ancorado no mesmo `rendaRef`** do diagnóstico
  de fluxo de caixa — a base lógica é o **% da renda**, não o % do próprio gasto. Compara
  período atual vs anterior (faturaPeriod). Modo agregado pra "Todos". Degrada honesto: sem
  rendaRef, não inventa % da renda (usa limite + valor absoluto + tendência).
- **Home multi-cartão:** "Vencendo em [mês]" = soma das faturas com vencimento no mês
  corrente, **agrupado por fatura** (cartão adicional na mesma fatura não é pagamento
  separado); "Total em aberto" = todas as faturas. Fatura sem vencimento parseado: entra no
  total em aberto, fica fora do total do mês, com nota honesta.
- **Cores de banco:** `src/lib/banks.ts` (cor da marca no ícone do cartão).
- **Cache de merchant compartilhado** entre conta e cartão; normaliza prefixos de gateway
  (MP*, DL*) pra mesma chave; recategorizar atualiza o cache (imports futuros aprendem), mas
  nunca reescreve silenciosamente a outra lente.

## Categorias
Definidas em `src/lib/categories.ts` (~21 categorias com cor e ícone Lucide). **Fonte da
verdade — ler de lá, não duplicar.**

## Tom de voz
Direto, popular, **neutro em gênero** (sem "irmão/cara/mano"), sem julgamento moral. O
impacto vem dos **números**. Frases curtas. Nada de termo técnico ("otimizar", "alocar",
"comprometer renda", "déficit"). Fala "foi embora", "engoliu", "tá pesado". WhatsApp mais
curto/pessoal; painel mais detalhado.

## Decisões de produto
- Detecção automática de fatura vs extrato (usuário **não** declara).
- Cartão é lente separada; nunca no score de fluxo de caixa.
- Reconciliar antes de persistir (extrato pelo saldo final; fatura por totais).
- Mês de cartão = `faturaPeriod`, nunca mês-calendário.
- Diagnóstico (home e cartão) ancorado no `rendaRef` real; se rendaRef ≤ 0/indisponível,
  degrada (não inventa % nem nota).
- Salário mínimo via API do IBGE; se indisponível, não menciona.
- Apagar transação de cartão não altera o total autoritativo da fatura.
- Cache de merchant compartilhado entre lentes; recategorizar ensina os imports futuros.
- Upload multi-arquivo; idempotência por (cartão+period) e (conta+período).
- Slider de simulação: tempo real no front, IA só ao parar (debounce 800ms); meta IA após
  interação.
- Nome **SALVÔ!** (acento + exclamação, gíria carioca).

## O que NÃO fazer
- Não misturar lente de conta e cartão em nenhuma agregação.
- Nunca filtrar transação de cartão por mês-calendário — usar `faturaPeriod`.
- Não alterar o total autoritativo da fatura ao apagar transações.
- Nunca mostrar "X de X" / nota / % da renda com dado errado, ausente ou fabricado.
- Não mencionar salário mínimo se a API do IBGE retornar null.
- Não duplicar no doc valores que vivem em código (tokens, categorias, flags) — referenciar.
- Não alterar design/fontes/estilos sem pedido explícito; seguir o design system.
- Não renomear identificadores técnicos (`fincheck-pro`, domínios, service accounts).
- Não usar vocativos de gênero nem termo técnico no tom de voz.
- O breakdown "conta · cartão" na home foi **removido** — não reintroduzir.

## Modelo de negócio · Known issues
Estratégia comercial (pricing, B2B, Open Finance) e o status detalhado dos bugs em aberto
vivem em `SALVO_CONTEXT.local.md` — fora do repositório (gitignorado), carregado só
localmente pelo `CLAUDE.md`. Mantém este doc público focado em arquitetura, decisões
técnicas e voz.
