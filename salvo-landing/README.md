# 🌐 Salvô Landing Page

Landing page estática para captação de leads do projeto Salvô.

## 🎯 Objetivo
Captar leads de Pessoas Físicas e Jurídicas interessadas em usar o Salvô para conectar clientes e comércios locais via WhatsApp.

## 🛠️ Tecnologias
- HTML5
- CSS3
- JavaScript (Vanilla)
- Firebase (Firestore)
- reCAPTCHA v3

## 📁 Estrutura
```
salvo-landing/
├── public/
│   ├── index.html           # Página principal
│   ├── obrigado.html       # Página de confirmação
│   ├── robots.txt          # SEO
│   ├── sitemap.xml         # SEO
│   ├── manifest.webmanifest # PWA
│   └── assets/
│       ├── css/style.css   # Estilos
│       ├── js/firebase.js  # Configuração Firebase
│       ├── js/app.js       # Lógica da aplicação
│       └── img/            # Imagens
├── README.md
└── .editorconfig
```

## 🚀 Deploy
- **Servidor:** 212.85.1.55
- **Domínio:** salvo.vancouvertec.com.br
- **Usuário:** salvo-vtec
- **Diretório:** /home/salvo-vtec/htdocs/salvo.vancouvertec.com.br

## 📋 Formulários
### Pessoa Física
- Nome Completo
- WhatsApp
- Email (opcional)
- Cidade/UF
- Aceite LGPD

### Pessoa Jurídica
- Razão Social
- Nome Fantasia
- CNPJ
- WhatsApp
- Email
- Cidade/UF
- Aceite LGPD

## 🔐 Segurança
- Firebase Security Rules (apenas create)
- reCAPTCHA v3
- Validação client-side e server-side

## 📱 Responsivo
- Mobile First
- Breakpoints: 768px, 1024px, 1200px

## 🎨 Design
- Cores WhatsApp: #25D366, #075E54, #128C7E
- Neutros: #111, #fff, #ECE5DD
- Fontes: Inter, Poppins

# Navegue até a pasta da landing page
cd /caminho/para/salvo-landing

# Execute o servidor Python
python3 -m http.server 8006