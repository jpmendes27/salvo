#!/bin/bash

# Script 2: Criação da estrutura da Landing Page do Salvô
# Autor: Rafael Ferreira
# Data: 2025-08-09

echo "🌐 Criando estrutura da Landing Page do Salvô..."

# Criar estrutura de pastas da landing page
echo "📁 Criando estrutura da landing page..."

mkdir -p salvo-landing/public/assets/{css,js,img/icons}

# Criar README.md da landing page
echo "📄 Criando README.md da landing page..."
cat > salvo-landing/README.md << 'EOF'
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
EOF

# Criar .editorconfig
echo "⚙️ Criando .editorconfig..."
cat > salvo-landing/.editorconfig << 'EOF'
root = true

[*]
charset = utf-8
end_of_line = lf
insert_final_newline = true
trim_trailing_whitespace = true
indent_style = space
indent_size = 2

[*.md]
trim_trailing_whitespace = false

[*.{html,css,js}]
indent_size = 2

[*.json]
indent_size = 2
EOF

# Criar robots.txt
echo "🤖 Criando robots.txt..."
cat > salvo-landing/public/robots.txt << 'EOF'
User-agent: *
Allow: /

# Sitemaps
Sitemap: https://salvo.vancouvertec.com.br/sitemap.xml

# Otimizações
Crawl-delay: 1

# Bloquear arquivos desnecessários
Disallow: /assets/js/
Disallow: /*.json$
Disallow: /*.log$
EOF

# Criar sitemap.xml
echo "🗺️ Criando sitemap.xml..."
cat > salvo-landing/public/sitemap.xml << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://salvo.vancouvertec.com.br/</loc>
    <lastmod>2025-08-09</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://salvo.vancouvertec.com.br/obrigado.html</loc>
    <lastmod>2025-08-09</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
</urlset>
EOF

# Criar manifest.webmanifest
echo "📱 Criando manifest.webmanifest..."
cat > salvo-landing/public/manifest.webmanifest << 'EOF'
{
  "name": "Salvô - Conecte-se localmente pelo WhatsApp",
  "short_name": "Salvô",
  "description": "Encontre e venda localmente pelo WhatsApp - 100% grátis",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#25D366",
  "orientation": "portrait-primary",
  "icons": [
    {
      "src": "/assets/img/icons/icon-72x72.png",
      "sizes": "72x72",
      "type": "image/png",
      "purpose": "maskable any"
    },
    {
      "src": "/assets/img/icons/icon-96x96.png",
      "sizes": "96x96",
      "type": "image/png",
      "purpose": "maskable any"
    },
    {
      "src": "/assets/img/icons/icon-128x128.png",
      "sizes": "128x128",
      "type": "image/png",
      "purpose": "maskable any"
    },
    {
      "src": "/assets/img/icons/icon-144x144.png",
      "sizes": "144x144",
      "type": "image/png",
      "purpose": "maskable any"
    },
    {
      "src": "/assets/img/icons/icon-152x152.png",
      "sizes": "152x152",
      "type": "image/png",
      "purpose": "maskable any"
    },
    {
      "src": "/assets/img/icons/icon-192x192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "maskable any"
    },
    {
      "src": "/assets/img/icons/icon-384x384.png",
      "sizes": "384x384",
      "type": "image/png",
      "purpose": "maskable any"
    },
    {
      "src": "/assets/img/icons/icon-512x512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "maskable any"
    }
  ],
  "screenshots": [
    {
      "src": "/assets/img/screenshot-mobile.png",
      "sizes": "720x1280",
      "type": "image/png"
    },
    {
      "src": "/assets/img/screenshot-desktop.png",
      "sizes": "1280x720",
      "type": "image/png"
    }
  ]
}
EOF

# Criar configuração do Firebase
echo "🔥 Criando configuração do Firebase..."
cat > salvo-landing/public/assets/js/firebase.js << 'EOF'
// Configuração do Firebase para Salvô Landing Page
// Substitua pelas suas credenciais do Firebase

const firebaseConfig = {
  apiKey: "sua-api-key-aqui",
  authDomain: "seu-projeto.firebaseapp.com",
  projectId: "seu-projeto-id",
  storageBucket: "seu-projeto.appspot.com",
  messagingSenderId: "123456789",
  appId: "sua-app-id-aqui",
  measurementId: "G-XXXXXXXXXX"
};

// Inicializar Firebase
firebase.initializeApp(firebaseConfig);

// Inicializar Firestore
const db = firebase.firestore();

// Configurar App Check com reCAPTCHA v3
firebase.appCheck().activate('6LfxYZ4pAAAAAH-tYs9D1v9XrG7ZQk5QY8xP2wX7', true);

// Função para salvar lead no Firestore
async function salvarLead(dadosLead) {
  try {
    const docRef = await db.collection('leads').add({
      ...dadosLead,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      ip: await obterIP(),
      userAgent: navigator.userAgent,
      referrer: document.referrer || 'direct'
    });
    
    console.log('Lead salvo com ID:', docRef.id);
    return { success: true, id: docRef.id };
  } catch (error) {
    console.error('Erro ao salvar lead:', error);
    return { success: false, error: error.message };
  }
}

// Função auxiliar para obter IP do usuário
async function obterIP() {
  try {
    const response = await fetch('https://api.ipify.org?format=json');
    const data = await response.json();
    return data.ip;
  } catch (error) {
    console.error('Erro ao obter IP:', error);
    return 'unknown';
  }
}

// Regras de segurança do Firestore (aplicar no Console Firebase)
const firestoreRules = `
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Permitir apenas criação de leads
    match /leads/{document} {
      allow create: if request.auth == null 
        && resource == null 
        && request.resource.data.keys().hasAll(['tipo', 'createdAt'])
        && request.resource.data.tipo in ['PF', 'PJ'];
      allow read, update, delete: if false;
    }
    
    // Negar acesso a todas as outras coleções
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
`;

// Exportar para uso global
window.Firebase = {
  salvarLead,
  db
};
EOF

echo ""
echo "✅ Estrutura da Landing Page criada com sucesso!"
echo ""
echo "📂 Estrutura criada:"
echo "   ├── salvo-landing/"
echo "   │   ├── public/"
echo "   │   │   ├── assets/css/"
echo "   │   │   ├── assets/js/"
echo "   │   │   ├── assets/img/icons/"
echo "   │   │   ├── robots.txt"
echo "   │   │   ├── sitemap.xml"
echo "   │   │   └── manifest.webmanifest"
echo "   │   ├── README.md"
echo "   │   └── .editorconfig"
echo ""
echo "🔥 Firebase configurado com:"
echo "   ├── Firestore para armazenar leads"
echo "   ├── App Check com reCAPTCHA v3"
echo "   └── Security Rules (aplicar no console)"
echo ""
echo "📋 Próximos passos:"
echo "   1. Execute o próximo script: chmod +x 2a_landing_css.sh && ./2a_landing_css.sh"
echo "   2. Configure as credenciais do Firebase em firebase.js"
echo "   3. Configure o reCAPTCHA v3"
echo ""
echo "⚠️ IMPORTANTE:"
echo "   - Substitua as credenciais do Firebase em firebase.js"
echo "   - Configure o reCAPTCHA v3 no Google Console"
echo "   - Aplique as Security Rules no Firebase Console"
echo ""
echo "✨ Estrutura base pronta para desenvolvimento!"