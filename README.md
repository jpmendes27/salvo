# Salvô!

Web/PWA para gestao financeira mensal, compartilhavel e preparada para Open Finance futuro.

## Stack

- Next.js App Router
- Firebase Auth
- Cloud Firestore
- Firebase Hosting static export

## Rodando localmente

1. Copie `.env.example` para `.env.local`.
2. Preencha as chaves do Firebase Web App.
3. Ative no Firebase Auth:
   - Google
   - Email/password
   - Email verification
4. Instale e rode:

```bash
npm install
npm run dev
```

Abra `http://localhost:3000`.

## Deploy

```bash
npm run build
firebase deploy
```

Use `.firebaserc.example` como base para criar `.firebaserc`.

## Modelo de dados

Dados financeiros pertencem a `workspaces`, nao diretamente ao usuario. Um workspace possui membros em `workspaces/{workspaceId}/members/{uid}` com papeis `owner` ou `editor`.

Subcolecoes principais:

- `transactions`
- `categories`
- `summaries`
- `members`
- `openFinanceWaitlist`

Convites ficam em `invites/{token}` e concedem acesso `editor` enquanto ativos e nao expirados.
