# CLAUDE.md — Salvô!

Salvô! é um app de finanças pessoais pro brasileiro comum ("o amigo rico que o
brasileiro nunca teve"). Princípio-mãe: **sem promessa furada** — nunca dado errado,
nunca número fabricado, sempre degradar honesto.

## Contexto carregado automaticamente

@./SALVO_CONTEXT.md
@./SALVO_CONTEXT.local.md
@./src/lib/design-system.ts
@./src/lib/categories.ts
@./src/lib/banks.ts

SALVO_CONTEXT.md = decisões, arquitetura e voz (camada estável, pública). Os arquivos de
código = fonte da verdade dos valores (tokens, categorias, cores de banco).
SALVO_CONTEXT.local.md = camada sensível (estratégia comercial, bugs em aberto),
gitignorada — não vai pro repo público. Arquivo que não existe é ignorado em silêncio.

## Manutenção deste contexto (retroalimentação)

Ao concluir uma feature ou mudar uma decisão de produto, **atualize o
SALVO_CONTEXT.md** nas seções Decisões / Arquitetura / O que não fazer, no mesmo
passo da entrega. Quem muda o código documenta a mudança.

Não duplicar no doc valores que vivem em código (tokens, categorias, flags) —
referenciar o arquivo pelo caminho. Manter o SALVO_CONTEXT enxuto (alvo < 200 linhas).

## Regras sempre válidas

- **Sem promessa furada:** nunca mostrar "X de X", nota, ou % com dado errado, ausente
  ou fabricado; degradar honesto.
- **Cartão é lente separada:** compras de cartão (source='card') nunca entram no score
  de fluxo de caixa nem em /transactions.
- **Mês de cartão = faturaPeriod**, nunca mês-calendário.
- **Reconciliar antes de persistir** (extrato pelo saldo final; fatura por totais).
- **Não alterar design/fontes/estilos sem pedido explícito** — seguir
  src/lib/design-system.ts.
- **Não renomear identificadores técnicos** (project id fincheck-pro, domínios,
  service accounts).
- **Tom de voz:** direto, popular, neutro em gênero, sem termo técnico (ver
  SALVO_CONTEXT, seção Tom de voz).

## Ao implementar

Apresentar a decisão de arquitetura e as consequências downstream **antes** de codar
mudanças não triviais. Consolidar mudanças relacionadas num passo só. Sempre preservar
o design system.

## Decisão — Completude de extração bank-agnostic (jun/2026)
- Raiz do churn no realMonth: extração LLM omite linhas em silêncio em extratos
  longos e a re-extração era pulada na falha de totais (sentinela -1) → omissão
  persistia (ex.: 79 de 110 transações lidas, delta fantasma de ~R$2,2k).
- Fix bank-agnostic: auditoria de completude por dia usando subtotais declarados
  ("Total de entradas/saídas" por data) + totais globais como âncoras. Compara por
  sinal e valor o extraído vs declarado; dia curto → re-extração Claude escopada só
  no trecho do dia, bounded (1x/dia, cap 8 dias/job).
- Subtotais e totais declarados são ÂNCORAS, nunca transações (igual SALDO DO DIA).
- Subtotal de fluxo por dia ≠ checkpoint de saldo: auditoria é camada nova
  pré-reconcile; reconcileLedger e os 3 estados ficam inalterados, sobre ledger completo.
- RDB/Cofrinho conta na completude (linha real do ledger), mas segue neutro no
  diagnóstico. Cartão segue lente separada.
- nao_conferido + delta só após a recuperação falhar → delta passa a ser real.
- Adapter determinístico do Nubank: otimização deferida em cima dessa base
  (determinístico-primeiro / Claude-fallback, padrão Mercado Pago).

## Decisão — Reserva/poupança real-no-ledger + neutro-no-diagnóstico (jun/2026)
- Extração trata movimento interno de reserva/poupança como real-no-ledger + neutro-no-
  diagnóstico, bank-agnostic (semântico). Substituiu a regra format-specific "ignorar
  reservado/retirado" que dropava linhas e quebrava a cadeia saldo-por-linha (MP) →
  nao_conferido/churn no fallback. Validado na POC, 3 modelos, estável.
- Dois pontos em functions: `buildSystemPrompt` default = 'neutral' ('ignore' mantido
  válido p/ reversão); `isInternalTransfer` generalizado (cofrinho/caixinha/dinheiro
  reservado-retirado/CDB/RDB/aplicação-resgate) → o `internal:true` neutraliza no score.
- Reconciliação inalterada: a linha entra no ledger (conta na cadeia/totais), só sai do
  diagnóstico. Cartão segue lente separada.

## Decisão — Throughput de extração: throttle no teto real + chunks paralelos (jun/2026)
- O throttle era 7.500 output tok/min (~9% do teto real). Limite REAL da conta (lido do
  header): 80K output / 500K input / 1000 req por min. Subiu pra guard a **72K** (90%) +
  chunks extraídos em **PARALELO** (cap 5, ordem preservada); retry/backoff do SDK no 429.
- Stress (extrato 304 linhas, Claude): **321s → 76s (4,2×)**, mesma contagem de tx e mesma
  reconciliação (sem perder accuracy). `OUTPUT_TOKENS_PER_MIN` / `EXTRACT_CONCURRENCY=1`
  reproduzem o comportamento antigo. reconcileLedger e os 3 estados inalterados.
