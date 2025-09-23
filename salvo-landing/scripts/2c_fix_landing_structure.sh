#!/bin/bash

# Script 2c: Correção da estrutura da Landing Page do Salvô
# Autor: Rafael Ferreira
# Data: 2025-08-09

echo "🔧 Corrigindo estrutura da Landing Page..."

# Mover arquivos da pasta public para a raiz
echo "📁 Movendo arquivos para estrutura correta..."

# Criar nova estrutura correta
mkdir -p salvo-landing/{assets/css,assets/js,assets/img/icons}

# Mover arquivos da pasta public para raiz
if [ -d "salvo-landing/public" ]; then
    echo "📦 Movendo arquivos da pasta public..."
    
    # Mover arquivos principais
    [ -f "salvo-landing/public/index.html" ] && mv salvo-landing/public/index.html salvo-landing/
    [ -f "salvo-landing/public/robots.txt" ] && mv salvo-landing/public/robots.txt salvo-landing/
    [ -f "salvo-landing/public/sitemap.xml" ] && mv salvo-landing/public/sitemap.xml salvo-landing/
    [ -f "salvo-landing/public/manifest.webmanifest" ] && mv salvo-landing/public/manifest.webmanifest salvo-landing/
    
    # Mover pasta assets
    [ -d "salvo-landing/public/assets" ] && cp -r salvo-landing/public/assets/* salvo-landing/assets/
    
    # Remover pasta public
    rm -rf salvo-landing/public
    
    echo "✅ Arquivos movidos com sucesso!"
else
    echo "⚠️ Pasta public não encontrada, criando estrutura nova..."
fi

# Ajustar caminhos no index.html
echo "🔧 Ajustando caminhos no HTML..."
if [ -f "salvo-landing/index.html" ]; then
    sed -i 's|/assets/|assets/|g' salvo-landing/index.html
    echo "✅ Caminhos corrigidos no HTML!"
fi

# Criar página obrigado.html
echo "📄 Criando página obrigado.html..."
cat > salvo-landing/obrigado.html << 'EOF'
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="description" content="Obrigado por se cadastrar no Salvô! Em breve entraremos em contato.">
    <meta name="robots" content="noindex, nofollow">
    
    <title>Obrigado - Salvô</title>
    
    <!-- Favicon -->
    <link rel="icon" type="image/x-icon" href="assets/img/favicon.ico">
    
    <!-- Fonts -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Poppins:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    
    <!-- CSS -->
    <link rel="stylesheet" href="assets/css/style.css">
    
    <style>
        .thank-you {
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            background: linear-gradient(135deg, var(--color-white) 0%, var(--color-gray-100) 100%);
            padding: 2rem 1rem;
        }
        
        .thank-you__card {
            background: var(--color-white);
            border-radius: var(--border-radius-lg);
            box-shadow: var(--shadow-lg);
            padding: 3rem 2rem;
            text-align: center;
            max-width: 500px;
            width: 100%;
        }
        
        .thank-you__icon {
            font-size: 4rem;
            margin-bottom: 1.5rem;
            display: block;
        }
        
        .thank-you__title {
            font-size: 2rem;
            color: var(--whatsapp-green);
            margin-bottom: 1rem;
        }
        
        .thank-you__message {
            color: var(--color-gray-600);
            margin-bottom: 2rem;
            font-size: 1.1rem;
            line-height: 1.6;
        }
        
        .thank-you__actions {
            display: flex;
            flex-direction: column;
            gap: 1rem;
        }
        
        @media (min-width: 640px) {
            .thank-you__actions {
                flex-direction: row;
                justify-content: center;
            }
        }
    </style>
</head>
<body>
    <section class="thank-you">
        <div class="thank-you__card">
            <span class="thank-you__icon">🎉</span>
            <h1 class="thank-you__title">Obrigado!</h1>
            <p class="thank-you__message">
                Seu cadastro foi realizado com sucesso! Em breve nossa equipe entrará em contato através do WhatsApp informado.
            </p>
            <p class="thank-you__message">
                <strong>Próximos passos:</strong><br>
                • Aguarde nosso contato no WhatsApp<br>
                • Prepare-se para conectar-se localmente<br>
                • Comece a vender ou encontrar mais facilmente
            </p>
            <div class="thank-you__actions">
                <a href="/" class="btn btn--primary">
                    🏠 Voltar ao Início
                </a>
                <a href="https://wa.me/5511999999999" class="btn btn--secondary" target="_blank">
                    💬 Falar no WhatsApp
                </a>
            </div>
        </div>
    </section>

    <script>
        // Limpar parâmetros UTM da URL
        if (window.location.search) {
            const url = window.location.protocol + "//" + window.location.host + window.location.pathname;
            window.history.replaceState({}, document.title, url);
        }
        
        // Scroll to top
        window.scrollTo(0, 0);
    </script>
</body>
</html>
EOF

# Corrigir caminhos no CSS se necessário
echo "🎨 Verificando caminhos no CSS..."
if [ -f "salvo-landing/assets/css/style.css" ]; then
    # Ajustar caminhos de imagens se houver
    sed -i 's|/assets/img/|../img/|g' salvo-landing/assets/css/style.css
    echo "✅ Caminhos corrigidos no CSS!"
fi

# Criar estrutura de exemplo para as imagens
echo "🖼️ Criando estrutura de imagens..."

# Criar favicon placeholder
cat > salvo-landing/assets/img/favicon.ico.txt << 'EOF'
# Placeholder para favicon.ico
# Substitua este arquivo por um favicon real
# Tamanho recomendado: 16x16, 32x32, 48x48 pixels
# Formato: ICO
EOF

# Criar logo SVG placeholder
cat > salvo-landing/assets/img/logo-salvo.svg << 'EOF'
<svg width="120" height="40" viewBox="0 0 120 40" fill="none" xmlns="http://www.w3.org/2000/svg">
  <!-- Logo Salvô Placeholder -->
  <rect width="120" height="40" rx="8" fill="#25D366"/>
  <text x="60" y="25" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="16" font-weight="bold">Salvô</text>
</svg>
EOF

# Criar og-image placeholder
cat > salvo-landing/assets/img/og-image.png.txt << 'EOF'
# Placeholder para og-image.png
# Substitua este arquivo por uma imagem real
# Tamanho recomendado: 1200x630 pixels
# Formato: PNG ou JPG
# Conteúdo: Logo + texto "Salvô - Conecte-se localmente pelo WhatsApp"
EOF

# Criar ícones PWA placeholders
for size in 72 96 128 144 152 192 384 512; do
    cat > "salvo-landing/assets/img/icons/icon-${size}x${size}.png.txt" << EOF
# Placeholder para icon-${size}x${size}.png
# Substitua este arquivo por um ícone real
# Tamanho: ${size}x${size} pixels
# Formato: PNG
# Conteúdo: Logo Salvô adaptado para PWA
EOF
done

# Mostrar nova estrutura
echo ""
echo "✅ Estrutura corrigida com sucesso!"
echo ""
echo "📂 Nova estrutura da landing page:"
echo "salvo-landing/"
echo "├── index.html              # Página principal"
echo "├── obrigado.html           # Página de confirmação"
echo "├── robots.txt              # SEO"
echo "├── sitemap.xml             # Mapa do site"
echo "├── manifest.webmanifest    # PWA"
echo "├── README.md               # Documentação"
echo "├── .editorconfig           # Configuração do editor"
echo "└── assets/"
echo "    ├── css/"
echo "    │   └── style.css       # Estilos principais"
echo "    ├── js/"
echo "    │   ├── firebase.js     # Configuração Firebase"
echo "    │   └── app.js          # Lógica da aplicação (próximo script)"
echo "    └── img/"
echo "        ├── logo-salvo.svg  # Logo (placeholder criado)"
echo "        ├── favicon.ico     # Favicon (criar)"
echo "        ├── og-image.png    # Imagem Open Graph (criar)"
echo "        └── icons/          # Ícones PWA (criar)"
echo ""
echo "🔧 Correções aplicadas:"
echo "   ✅ Arquivos movidos da pasta public/ para raiz"
echo "   ✅ Caminhos ajustados no HTML (/assets/ → assets/)"
echo "   ✅ Caminhos ajustados no CSS"
echo "   ✅ Página obrigado.html criada"
echo "   ✅ Placeholders de imagens criados"
echo ""
echo "📋 Próximos passos:"
echo "   1. Execute: chmod +x 2d_landing_javascript.sh && ./2d_landing_javascript.sh"
echo "   2. Substitua os placeholders de imagens por arquivos reais"
echo "   3. Configure as credenciais do Firebase"
echo ""
echo "⚠️ IMPORTANTE:"
echo "   - Substitua favicon.ico, logo-salvo.svg, og-image.png por arquivos reais"
echo "   - Crie os ícones PWA nos tamanhos especificados"
echo "   - Configure o Firebase antes de testar os formulários"
echo ""
echo "✨ Estrutura corrigida e pronta para uso!"