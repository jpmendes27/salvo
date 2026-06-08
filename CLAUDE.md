# CLAUDE.md — Salvô!

Salvô! é um app de finanças pessoais pro brasileiro comum ("o amigo rico que o
brasileiro nunca teve"). Princípio-mãe: **sem promessa furada** — nunca dado errado,
nunca número fabricado, sempre degradar honesto.

## Contexto carregado automaticamente

@./SALVO_CONTEXT.md
@./src/lib/design-system.ts
@./src/lib/categories.ts
@./src/lib/flags.ts
@./src/lib/banks.ts

SALVO_CONTEXT.md = decisões, arquitetura e voz (camada estável). Os arquivos de
código = fonte da verdade dos valores (tokens, categorias, flags, cores de banco).
Arquivo que ainda não existe é ignorado em silêncio.

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
