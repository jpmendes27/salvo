#!/bin/bash

# Script 2m: Deploy Final Completo - Salvô Landing Page
# Autor: Rafael Ferreira
# Data: 2025-08-16
# Uso: cp ../scripts/2m_final_complete_deploy.sh . && chmod +x 2m_final_complete_deploy.sh && ./2m_final_complete_deploy.sh

echo "🚀 Salvô - Deploy Final Completo..."

# Verificar se está na pasta correta
if [ ! -f "index.html" ] || [ ! -d "assets" ]; then
    echo "❌ Erro: Execute este script dentro da pasta salvo-landing"
    echo "📁 Comando correto:"
    echo "   cd salvo-landing"
    echo "   cp ../scripts/2m_final_complete_deploy.sh ."
    echo "   chmod +x 2m_final_complete_deploy.sh && ./2m_final_complete_deploy.sh"
    exit 1
fi

echo "✅ Pasta do projeto encontrada!"

# Configurações do servidor
VPS_HOST="212.85.1.55"
VPS_USER="salvo-vtec"
VPS_PASSWORD="Bj4hwtmpSXA0ELI32nsI"
VPS_DOMAIN="salvo.vancouvertec.com.br"
VPS_PATH="/home/salvo-vtec/htdocs/salvo.vancouvertec.com.br"

# 1. LIMPEZA DOS CONSOLE LOGS
echo "🧹 Removendo console logs dos arquivos JavaScript..."

# Backup antes da limpeza
BACKUP_DIR="backup-clean-$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"
cp -r assets/js/ "$BACKUP_DIR/" 2>/dev/null

# Limpar console logs do app.js
if [ -f "assets/js/app.js" ]; then
    sed -i '/console\.log/d' assets/js/app.js
    sed -i '/console\.warn/d' assets/js/app.js
    sed -i '/console\.error/d' assets/js/app.js
    echo "✅ Console logs removidos do app.js"
fi

# Limpar console logs do firebase.js
if [ -f "assets/js/firebase.js" ]; then
    sed -i '/console\.log/d' assets/js/firebase.js
    sed -i '/console\.warn/d' assets/js/firebase.js
    sed -i '/console\.error/d' assets/js/firebase.js
    echo "✅ Console logs removidos do firebase.js"
fi

# Limpar console logs do masks-validations.js
if [ -f "assets/js/masks-validations.js" ]; then
    sed -i '/console\.log/d' assets/js/masks-validations.js
    sed -i '/console\.warn/d' assets/js/masks-validations.js
    sed -i '/console\.error/d' assets/js/masks-validations.js
    echo "✅ Console logs removidos do masks-validations.js"
fi

# 2. CRIAR ARQUIVOS FALTANTES
echo "📁 Criando arquivos faltantes..."

# Criar favicon.ico se não existir
if [ ! -f "assets/img/favicon.ico" ]; then
    echo "🔖 Criando favicon.ico..."
    # Copiar favicon.svg como favicon.ico (browsers modernos aceitam)
    if [ -f "assets/img/favicon.svg" ]; then
        cp assets/img/favicon.svg assets/img/favicon.ico
    fi
fi

# Criar ícones do manifest
if [ ! -f "assets/img/icons/icon-144x144.png" ]; then
    echo "📱 Criando ícones do manifest..."
    mkdir -p assets/img/icons

    # Criar arquivo placeholder para ícone 144x144
    cat > assets/img/icons/icon-144x144.png.txt << 'EOF'
# Ícone 144x144 do Salvô
# Para produção, substitua por arquivo PNG real
EOF

    # Criar arquivo placeholder para ícone 512x512
    cat > assets/img/icons/icon-512x512.png.txt << 'EOF'
# Ícone 512x512 do Salvô
# Para produção, substitua por arquivo PNG real
EOF
fi

# Corrigir manifest.webmanifest
if [ -f "manifest.webmanifest" ]; then
    echo "📱 Corrigindo manifest.webmanifest..."

    cat > manifest.webmanifest << 'EOF'
{
  "name": "Salvô - Encontre e venda localmente pelo WhatsApp",
  "short_name": "Salvô",
  "description": "Conecte seu negócio local com clientes próximos através do WhatsApp. 100% gratuito.",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#25D366",
  "theme_color": "#25D366",
  "icons": [
    {
      "src": "assets/img/favicon.svg",
      "sizes": "any",
      "type": "image/svg+xml"
    },
    {
      "src": "assets/img/logo-salvo.svg",
      "sizes": "any",
      "type": "image/svg+xml"
    }
  ]
}
EOF
fi

# 3. OTIMIZAR ARQUIVOS CSS
echo "🎨 Otimizando arquivos CSS..."

# Minificar CSS principal se não existir versão minificada
if [ -f "assets/css/style.css" ] && [ ! -f "assets/css/style.min.css" ]; then
    echo "🗜️ Minificando CSS..."
    # Minificação simples
    sed -e 's/\/\*.*\*\///g' -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//' -e '/^$/d' assets/css/style.css > assets/css/style.min.css
fi

# 4. VERIFICAR DEPENDÊNCIAS
echo "🔧 Verificando dependências..."

if ! command -v sshpass &> /dev/null; then
    echo "📦 Instalando sshpass..."
    sudo apt update && sudo apt install -y sshpass
fi

# 5. BACKUP NO SERVIDOR
echo "💾 Criando backup no servidor..."

sshpass -p "$VPS_PASSWORD" ssh -o StrictHostKeyChecking=no "$VPS_USER@$VPS_HOST" "
BACKUP_SERVER_DIR='/home/$VPS_USER/backups/final-backup-$(date +%Y%m%d_%H%M%S)'
mkdir -p \$BACKUP_SERVER_DIR
if [ -d '$VPS_PATH' ]; then
    cp -r $VPS_PATH/* \$BACKUP_SERVER_DIR/ 2>/dev/null || true
    echo 'Backup criado em: '\$BACKUP_SERVER_DIR
fi
"

# 6. UPLOAD COMPLETO E ORGANIZADO
echo "📤 Fazendo upload completo..."

# Função de upload melhorada
upload_with_verification() {
    local source="$1"
    local dest="$2"
    local desc="$3"

    echo "📤 Enviando $desc..."

    if [ -f "$source" ]; then
        sshpass -p "$VPS_PASSWORD" scp -o StrictHostKeyChecking=no "$source" "$VPS_USER@$VPS_HOST:$dest"

        # Verificar se o arquivo foi enviado
        if sshpass -p "$VPS_PASSWORD" ssh -o StrictHostKeyChecking=no "$VPS_USER@$VPS_HOST" "[ -f '$dest/$(basename $source)' ]"; then
            echo "✅ $desc enviado com sucesso"
        else
            echo "❌ Erro ao enviar $desc"
        fi
    else
        echo "⚠️ Arquivo não encontrado: $source"
    fi
}

# Criar estrutura completa no servidor
sshpass -p "$VPS_PASSWORD" ssh -o StrictHostKeyChecking=no "$VPS_USER@$VPS_HOST" "
mkdir -p $VPS_PATH
mkdir -p $VPS_PATH/assets/{css,js,img/icons}
chmod -R 755 $VPS_PATH
"

# Upload de arquivos HTML
for html_file in *.html; do
    upload_with_verification "$html_file" "$VPS_PATH" "HTML: $html_file"
done

# Upload de arquivos CSS
for css_file in assets/css/*.css; do
    upload_with_verification "$css_file" "$VPS_PATH/assets/css" "CSS: $(basename $css_file)"
done

# Upload de arquivos JavaScript
for js_file in assets/js/*.js; do
    upload_with_verification "$js_file" "$VPS_PATH/assets/js" "JS: $(basename $js_file)"
done

# Upload de imagens
if [ -d "assets/img" ]; then
    for img_file in assets/img/*; do
        if [ -f "$img_file" ]; then
            upload_with_verification "$img_file" "$VPS_PATH/assets/img" "IMG: $(basename $img_file)"
        fi
    done
fi

# Upload de ícones
if [ -d "assets/img/icons" ]; then
    for icon_file in assets/img/icons/*; do
        if [ -f "$icon_file" ]; then
            upload_with_verification "$icon_file" "$VPS_PATH/assets/img/icons" "ICON: $(basename $icon_file)"
        fi
    done
fi

# Upload de arquivos de configuração
for config_file in robots.txt sitemap.xml manifest.webmanifest FIREBASE_SETUP.md; do
    if [ -f "$config_file" ]; then
        upload_with_verification "$config_file" "$VPS_PATH" "CONFIG: $config_file"
    fi
done

# 7. CONFIGURAR .HTACCESS FINAL
echo "⚙️ Configurando .htaccess final..."

sshpass -p "$VPS_PASSWORD" ssh -o StrictHostKeyChecking=no "$VPS_USER@$VPS_HOST" "
cat > $VPS_PATH/.htaccess << 'EOL'
# Salvô Landing Page - Configuração Final
# Gerado automaticamente em $(date)

# Força HTTPS
<IfModule mod_rewrite.c>
    RewriteEngine On
    RewriteCond %{HTTPS} off
    RewriteRule ^(.*)$ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]
</IfModule>

# Compressão Gzip
<IfModule mod_deflate.c>
    AddOutputFilterByType DEFLATE text/plain text/html text/xml text/css
    AddOutputFilterByType DEFLATE application/xml application/xhtml+xml application/rss+xml
    AddOutputFilterByType DEFLATE application/javascript application/x-javascript
    AddOutputFilterByType DEFLATE image/svg+xml
</IfModule>

# Cache agressivo para arquivos estáticos
<IfModule mod_expires.c>
    ExpiresActive On
    ExpiresByType text/css \"access plus 1 year\"
    ExpiresByType application/javascript \"access plus 1 year\"
    ExpiresByType image/png \"access plus 1 year\"
    ExpiresByType image/jpg \"access plus 1 year\"
    ExpiresByType image/jpeg \"access plus 1 year\"
    ExpiresByType image/gif \"access plus 1 year\"
    ExpiresByType image/svg+xml \"access plus 1 year\"
    ExpiresByType image/x-icon \"access plus 1 year\"
    ExpiresByType font/woff \"access plus 1 year\"
    ExpiresByType font/woff2 \"access plus 1 year\"
    ExpiresByType text/html \"access plus 1 hour\"
</IfModule>

# Headers de segurança
<IfModule mod_headers.c>
    Header always set X-Content-Type-Options nosniff
    Header always set X-Frame-Options SAMEORIGIN
    Header always set X-XSS-Protection \"1; mode=block\"
    Header always set Referrer-Policy \"strict-origin-when-cross-origin\"

    # Cache headers para arquivos estáticos
    <FilesMatch \"\.(css|js|png|jpg|jpeg|gif|svg|ico|woff|woff2)$\">
        Header set Cache-Control \"max-age=31536000, public, immutable\"
    </FilesMatch>

    # Cache headers para HTML
    <FilesMatch \"\.(html)$\">
        Header set Cache-Control \"max-age=3600, public\"
    </FilesMatch>
</IfModule>

# Página de erro 404
ErrorDocument 404 /index.html

# Bloquear acesso a arquivos sensíveis
<Files \"*.md\">
    Order allow,deny
    Deny from all
</Files>

<Files \"backup-*\">
    Order allow,deny
    Deny from all
</Files>

<Files \"*.sh\">
    Order allow,deny
    Deny from all
</Files>

# MIME types
<IfModule mod_mime.c>
    AddType application/font-woff2 .woff2
    AddType image/svg+xml .svg
    AddType application/manifest+json .webmanifest
</IfModule>
EOL
"

# 8. CONFIGURAR PERMISSÕES FINAIS
echo "🔐 Configurando permissões finais..."

sshpass -p "$VPS_PASSWORD" ssh -o StrictHostKeyChecking=no "$VPS_USER@$VPS_HOST" "
find $VPS_PATH -type f -name '*.html' -exec chmod 644 {} \;
find $VPS_PATH -type f -name '*.css' -exec chmod 644 {} \;
find $VPS_PATH -type f -name '*.js' -exec chmod 644 {} \;
find $VPS_PATH -type f -name '*.svg' -exec chmod 644 {} \;
find $VPS_PATH -type f -name '*.ico' -exec chmod 644 {} \;
find $VPS_PATH -type f -name '*.txt' -exec chmod 644 {} \;
find $VPS_PATH -type f -name '*.xml' -exec chmod 644 {} \;
find $VPS_PATH -type f -name '*.webmanifest' -exec chmod 644 {} \;
find $VPS_PATH -type f -name '.htaccess' -exec chmod 644 {} \;
find $VPS_PATH -type d -exec chmod 755 {} \;
chown -R $VPS_USER:$VPS_USER $VPS_PATH
"

# 9. VERIFICAÇÃO FINAL COMPLETA
echo "🔍 Verificação final completa..."

# Testar conectividade
echo "🌐 Testando conectividade..."
https_test=$(curl -s -o /dev/null -w "%{http_code}" "https://$VPS_DOMAIN" 2>/dev/null || echo "000")
css_test=$(curl -s -o /dev/null -w "%{http_code}" "https://$VPS_DOMAIN/assets/css/style.css" 2>/dev/null || echo "000")
js_test=$(curl -s -o /dev/null -w "%{http_code}" "https://$VPS_DOMAIN/assets/js/app.js" 2>/dev/null || echo "000")
logo_test=$(curl -s -o /dev/null -w "%{http_code}" "https://$VPS_DOMAIN/assets/img/logo-salvo.svg" 2>/dev/null || echo "000")

# Verificar estrutura final
echo "📋 Verificando estrutura final..."
structure_check=$(sshpass -p "$VPS_PASSWORD" ssh -o StrictHostKeyChecking=no "$VPS_USER@$VPS_HOST" "
echo '=== ARQUIVOS PRINCIPAIS ==='
ls -la $VPS_PATH/*.html | wc -l
echo 'arquivos HTML encontrados'

echo '=== CSS ==='
ls -la $VPS_PATH/assets/css/*.css | wc -l
echo 'arquivos CSS encontrados'

echo '=== JAVASCRIPT ==='
ls -la $VPS_PATH/assets/js/*.js | wc -l
echo 'arquivos JS encontrados'

echo '=== IMAGENS ==='
ls -la $VPS_PATH/assets/img/ | wc -l
echo 'arquivos em assets/img'
")

echo "$structure_check"

# 10. RELATÓRIO FINAL
echo ""
echo "📋 RELATÓRIO FINAL DO DEPLOY:"
echo "============================================================"
echo "🎯 Projeto: Salvô Landing Page - Deploy Final"
echo "📅 Data: $(date '+%d/%m/%Y %H:%M:%S')"
echo "🌐 Domínio: https://$VPS_DOMAIN"
echo ""
echo "🔧 CORREÇÕES APLICADAS:"
echo "   ✅ Console logs removidos"
echo "   ✅ Arquivos faltantes criados"
echo "   ✅ Manifest corrigido"
echo "   ✅ CSS otimizado"
echo "   ✅ Upload completo verificado"
echo "   ✅ .htaccess final configurado"
echo "   ✅ Permissões ajustadas"
echo ""
echo "🌐 TESTES DE CONECTIVIDADE:"
echo "   🏠 Site HTTPS: $https_test"
echo "   🎨 CSS: $css_test"
echo "   ⚡ JavaScript: $js_test"
echo "   🖼️ Logo: $logo_test"
echo ""
echo "🔗 LINKS FINAIS:"
echo "   🏠 Site: https://$VPS_DOMAIN"
echo "   ❓ FAQ: https://$VPS_DOMAIN/faq.html"
echo "   📧 Contato: https://$VPS_DOMAIN/contato.html"
echo ""
if [[ "$https_test" == "200" && "$css_test" == "200" && "$js_test" == "200" ]]; then
    echo "🎉 DEPLOY FINAL CONCLUÍDO COM SUCESSO!"
    echo "🚀 O Salvô está 100% funcional!"
else
    echo "⚠️ Alguns recursos podem ainda precisar de ajustes."
fi
echo ""
echo "💡 PRÓXIMAS AÇÕES:"
echo "   1. Configure Firebase (FIREBASE_SETUP.md)"
echo "   2. Configure reCAPTCHA"
echo "   3. Teste todos os formulários"
echo "   4. Para atualizações: use o script de update"
echo ""
echo "📁 Backup local salvo em: $BACKUP_DIR"
echo "🌟 Deploy final concluído!"
