---
description: Carrega o contexto completo do Fincheck Pro para uma sessão nova de trabalho.
---

Você está iniciando uma sessão de trabalho no **Fincheck Pro**. Siga os passos abaixo para carregar o contexto completo antes de responder qualquer coisa.

## 1. Leia as memórias do projeto

Leia o arquivo `/home/joao/.claude/projects/-home-joao-Documentos-fincheck-pro/memory/MEMORY.md` e todos os arquivos de memória referenciados nele.

## 2. Leia os arquivos críticos de estado atual

Leia os seguintes arquivos para entender o estado atual do código:

- `firestore.rules` — regras de segurança do Firestore (permissões, estrutura de coleções)
- `src/app/convite/page.tsx` — fluxo de aceite de convite (CPF gate → login ou cadastro)
- `src/app/onboarding/page.tsx` — fluxo de criação de conta
- `src/app/home/page.tsx` — página principal após login
- `functions/src/index.ts` — Cloud Functions (verificação HMAC, envio de código)

## 3. Entenda a stack

- **Frontend:** Next.js 14, App Router, `output: "export"` (estático), `basePath: /fincheck-pro`
- **Hospedagem:** GitHub Pages (produção) + Firebase Hosting (demo)
- **Backend:** Firebase Auth + Firestore (client SDK) + Cloud Functions v2
- **Deploy:** push na `main` → GitHub Actions → GitHub Pages automaticamente

## 4. Entenda as decisões arquiteturais recentes

- **Verificação de identidade:** HMAC stateless nas Cloud Functions (`sendVerificationCode` / `verifyCode`) — sem Firestore nas functions
- **Unicidade de conta:** CPF como chave única via coleção `cpfIndex/{cpfDigits}` — não e-mail
- **Campo `accountVerified`:** campo customizado no Firestore `users/{uid}` (não `emailVerified` do Firebase Auth) — usuários convidados nunca têm `emailVerified: true`
- **Re-link de conta Google:** `memberEmails[]` no workspace permite que login Google com mesmo e-mail reconecte automaticamente a membros existentes
- **Fluxo de convite:** Landing → CPF (gate) → se CPF existe: login (Google ou e-mail/senha) → se CPF novo: WhatsApp + e-mail → verificação → nome → senha

## 5. Entenda a estrutura de workspaces

- Workspace tem `members/{uid}` com `role: "owner" | "editor"` e `status: "active" | "left"`
- Editors podem ver "Pessoas", renomear workspace, criar/editar transações
- Apenas owners podem excluir membros, excluir workspace, convidar

## 6. Output esperado

Após ler tudo, responda com um briefing no seguinte formato:

---

**Fincheck Pro — pronto para trabalhar**

**Stack:** (resumo em uma linha)

**Último trabalho:** (o que foi feito na sessão anterior, com base nas memórias)

**Estado atual:** (o que está funcionando, o que está pendente)

**Arquivos mais relevantes agora:** (lista dos arquivos que provavelmente serão tocados)

---

Depois do briefing, pergunte: "No que vamos trabalhar hoje?"
