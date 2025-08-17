# 🔥 Configuração do Firebase - Salvô

## 1. Criar Projeto Firebase

1. Acesse [Firebase Console](https://console.firebase.google.com/)
2. Clique em "Adicionar projeto"
3. Nome: `salvo-landing`
4. Habilite Google Analytics (opcional)

## 2. Configurar Firestore

1. No menu lateral, clique em "Firestore Database"
2. Clique em "Criar banco de dados"
3. Escolha "Modo de teste" (por enquanto)
4. Selecione localização: `us-central1`

## 3. Configurar Authentication (opcional)

1. No menu lateral, clique em "Authentication"
2. Na aba "Sign-in method", habilite:
   - E-mail/senha
   - Google (opcional)

## 4. Obter Credenciais

1. Clique na engrenagem > "Configurações do projeto"
2. Na aba "Geral", desça até "Seus aplicativos"
3. Clique em "</>" (Web)
4. Nome do app: `salvao-landing`
5. Copie as credenciais do `firebaseConfig`

## 5. Configurar no Código

Edite o arquivo `assets/js/firebase.js`:

```javascript
const firebaseConfig = {
  apiKey: "sua-api-key-aqui",
  authDomain: "salvo-landing.firebaseapp.com",
  projectId: "salvo-landing",
  storageBucket: "salvo-landing.appspot.com",
  messagingSenderId: "123456789",
  appId: "sua-app-id-aqui"
};
```

## 6. Configurar reCAPTCHA

1. Acesse [Google reCAPTCHA](https://www.google.com/recaptcha/admin)
2. Clique em "+" para adicionar site
3. Tipo: reCAPTCHA v2 (checkbox)
4. Domínio: `salvo.vancouvertec.com.br`
5. Copie a "Chave do site"

Edite `assets/js/firebase.js`:
```javascript
static siteKey = 'sua-chave-recaptcha-aqui';
```

E no `index.html`, substitua:
```html
data-sitekey="sua-chave-recaptcha-aqui"
```

## 7. Regras de Segurança Firestore

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /cadastros/{document} {
      allow create: if true;
      allow read, write: if false;
    }
  }
}
```

## 8. Testar

1. Abra a landing page
2. Preencha um formulário
3. Verifique no Firebase Console se os dados foram salvos
4. Verifique o console do navegador para logs

## 9. Webhook (Opcional)

Para integrar com sistemas externos, configure a URL do webhook em:
```javascript
const webhookUrl = 'https://seu-sistema.com/webhook';
```
