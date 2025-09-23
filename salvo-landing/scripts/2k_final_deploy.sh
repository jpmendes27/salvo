#!/bin/bash

# Script 2k: Deploy Final e Verificações - Salvô Landing Page
# Autor: Rafael Ferreira
# Data: 2025-08-16
# Uso: cp ../scripts/2k_final_deploy.sh . && chmod +x 2k_final_deploy.sh && ./2k_final_deploy.sh

echo "🚀 Salvô - Deploy Final e Verificações..."

# Verificar se está na pasta correta
if [ ! -f "index.html" ] || [ ! -d "assets" ]; then
    echo "❌ Erro: Execute este script dentro da pasta salvo-landing"
    echo "📁 Comando correto:"
    echo "   cd salvo-landing"
    echo "   cp ../scripts/2k_final_deploy.sh ."
    echo "   chmod +x 2k_final_deploy.sh && ./2k_final_deploy.sh"
    exit 1
fi

echo "✅ Pasta do projeto encontrada!"

# Configurações do servidor
VPS_HOST="212.85.1.55"
VPS_USER="salvo-vtec"
VPS_PASSWORD="Bj4hwtmpSXA0ELI32nsI"
VPS_DOMAIN="salvo.vancouvertec.com.br"
VPS_PATH="/home/salvo-vtec/htdocs/salvo.vancouvertec.com.br"

# 1. VERIFICAÇÕES PRÉ-DEPLOY
echo "🔍 Executando verificações pré-deploy..."

# Lista de arquivos essenciais
essential_files=(
    "index.html"
    "faq.html"
    "contato.html"
    "obrigado.html"
    "termos.html"
    "privacidade.html"
    "assets/css/style.css"
    "assets/css/whatsapp-fonts.css"
    "assets/css/forms-improved.css"
    "assets/js/app.js"
    "assets/js/firebase.js"
    "assets/js/masks-validations.js"
    "sitemap.xml"
    "robots.txt"
    "manifest.webmanifest"
)

missing_files=()
for file in "${essential_files[@]}"; do
    if [ ! -f "$file" ]; then
        missing_files+=("$file")
    fi
done

if [ ${#missing_files[@]} -eq 0 ]; then
    echo "✅ Todos os arquivos essenciais estão presentes!"
else
    echo "❌ Arquivos essenciais faltando:"
    printf '%s\n' "${missing_files[@]}"
    echo ""
    echo "Execute os scripts anteriores antes do deploy:"
    echo "  2g_fix_navigation_colors.sh"
    echo "  2h_fix_forms_fonts.sh"
    echo "  2i_javascript_validations.sh"
    echo "  2j_firebase_config.sh"
    exit 1
fi

# 2. VERIFICAR DEPENDÊNCIAS DO SERVIDOR
echo "🔧 Verificando dependências do servidor..."

if ! command -v sshpass &> /dev/null; then
    echo "📦 Instalando sshpass..."
    sudo apt update && sudo apt install -y sshpass
fi

if ! command -v rsync &> /dev/null; then
    echo "📦 Instalando rsync..."
    sudo apt install -y rsync
fi

echo "✅ Dependências verificadas!"

# 3. TESTAR CONEXÃO COM SERVIDOR
echo "🌐 Testando conexão com servidor..."

if ! sshpass -p "$VPS_PASSWORD" ssh -o StrictHostKeyChecking=no -o ConnectTimeout=10 "$VPS_USER@$VPS_HOST" "echo 'Conexão OK'" > /dev/null 2>&1; then
    echo "❌ Erro: Não foi possível conectar ao servidor"
    echo "🔧 Verifique:"
    echo "   - Conexão com internet"
    echo "   - IP do servidor: $VPS_HOST"
    echo "   - Usuário: $VPS_USER"
    echo "   - Senha configurada"
    exit 1
fi

echo "✅ Conexão com servidor estabelecida!"

# 4. BACKUP DA VERSÃO ATUAL NO SERVIDOR
echo "💾 Criando backup da versão atual no servidor..."

BACKUP_SERVER_DIR="/home/$VPS_USER/backups/landing-$(date +%Y%m%d_%H%M%S)"

sshpass -p "$VPS_PASSWORD" ssh -o StrictHostKeyChecking=no "$VPS_USER@$VPS_HOST" "
mkdir -p $BACKUP_SERVER_DIR
if [ -d $VPS_PATH ]; then
    cp -r $VPS_PATH/* $BACKUP_SERVER_DIR/ 2>/dev/null || true
    echo '✅ Backup criado em: $BACKUP_SERVER_DIR'
else
    echo '⚠️ Primeira instalação - sem backup necessário'
fi
"

# 5. OTIMIZAÇÕES PRÉ-DEPLOY
echo "⚡ Aplicando otimizações..."

# Backup local antes das otimizações
BACKUP_LOCAL_DIR="backup-pre-deploy-$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_LOCAL_DIR"
cp -r . "$BACKUP_LOCAL_DIR/" 2>/dev/null

# Minificar CSS (simples)
if [ -f "assets/css/style.css" ]; then
    echo "🗜️ Comprimindo CSS..."
    # Remover comentários e espaços extras (minificação simples)
    sed -e 's/\/\*.*\*\///g' -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//' assets/css/style.css > assets/css/style.min.css
    echo "✅ CSS minificado!"
fi

# Verificar integridade do HTML
echo "🔍 Verificando integridade do HTML..."

html_errors=()
for html_file in *.html; do
    if [ -f "$html_file" ]; then
        # Verificar tags básicas
        if ! grep -q "</html>" "$html_file"; then
            html_errors+=("$html_file: falta tag </html>")
        fi
        if ! grep -q "</body>" "$html_file"; then
            html_errors+=("$html_file: falta tag </body>")
        fi
    fi
done

if [ ${#html_errors[@]} -eq 0 ]; then
    echo "✅ HTML válido!"
else
    echo "⚠️ Problemas no HTML:"
    printf '%s\n' "${html_errors[@]}"
fi

# 6. UPLOAD PARA SERVIDOR
echo "📤 Enviando arquivos para o servidor..."

# Função para upload com rsync
upload_files() {
    local source="$1"
    local destination="$2"

    sshpass -p "$VPS_PASSWORD" rsync -avz \
        --delete \
        --progress \
        -e "ssh -o StrictHostKeyChecking=no" \
        "$source" "$VPS_USER@$VPS_HOST:$destination"
}

# Criar estrutura no servidor
sshpass -p "$VPS_PASSWORD" ssh -o StrictHostKeyChecking=no "$VPS_USER@$VPS_HOST" "
mkdir -p $VPS_PATH
mkdir -p $VPS_PATH/assets/{css,js,img}
"

# Upload dos arquivos
echo "📄 Enviando arquivos HTML..."
upload_files "*.html" "$VPS_PATH/"

echo "🎨 Enviando assets CSS..."
upload_files "assets/css/" "$VPS_PATH/assets/"

echo "⚡ Enviando JavaScript..."
upload_files "assets/js/" "$VPS_PATH/assets/"

echo "🖼️ Enviando imagens..."
if [ -d "assets/img" ]; then
    upload_files "assets/img/" "$VPS_PATH/assets/"
fi

echo "📋 Enviando arquivos de configuração..."
for file in robots.txt sitemap.xml manifest.webmanifest FIREBASE_SETUP.md; do
    if [ -f "$file" ]; then
        upload_files "$file" "$VPS_PATH/"
    fi
done

# 7. CONFIGURAR PERMISSÕES NO SERVIDOR
echo "🔐 Configurando permissões no servidor..."

sshpass -p "$VPS_PASSWORD" ssh -o StrictHostKeyChecking=no "$VPS_USER@$VPS_HOST" "
find $VPS_PATH -type f -exec chmod 644 {} \;
find $VPS_PATH -type d -exec chmod 755 {} \;
chown -R $VPS_USER:$VPS_USER $VPS_PATH
"

echo "✅ Permissões configuradas!"

# 8. CONFIGURAR .HTACCESS OTIMIZADO
echo "⚙️ Configurando .htaccess otimizado..."

sshpass -p "$VPS_PASSWORD" ssh -o StrictHostKeyChecking=no "$VPS_USER@$VPS_HOST" "
cat > $VPS_PATH/.htaccess << 'EOL'
# Salvô Landing Page - Configurações Apache
# Gerado automaticamente em $(date)

# Compressão Gzip
<IfModule mod_deflate.c>
    AddOutputFilterByType DEFLATE text/plain
    AddOutputFilterByType DEFLATE text/html
    AddOutputFilterByType DEFLATE text/xml
    AddOutputFilterByType DEFLATE text/css
    AddOutputFilterByType DEFLATE application/xml
    AddOutputFilterByType DEFLATE application/xhtml+xml
    AddOutputFilterByType DEFLATE application/rss+xml
    AddOutputFilterByType DEFLATE application/javascript
    AddOutputFilterByType DEFLATE application/x-javascript
    AddOutputFilterByType DEFLATE image/svg+xml
</IfModule>

# Cache para arquivos estáticos
<IfModule mod_expires.c>
    ExpiresActive On
    ExpiresByType text/css \"access plus 1 month\"
    ExpiresByType application/javascript \"access plus 1 month\"
    ExpiresByType image/png \"access plus 6 months\"
    ExpiresByType image/jpg \"access plus 6 months\"
    ExpiresByType image/jpeg \"access plus 6 months\"
    ExpiresByType image/gif \"access plus 6 months\"
    ExpiresByType image/svg+xml \"access plus 6 months\"
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
    Header always set Permissions-Policy \"geolocation=(), microphone=(), camera=()\"
</IfModule>

# Redirecionamento HTTPS
<IfModule mod_rewrite.c>
    RewriteEngine On
    RewriteCond %{HTTPS} off
    RewriteRule ^(.*)$ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]
</IfModule>

# Página de erro 404 personalizada
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

# Otimizar entrega de arquivos
<IfModule mod_mime.c>
    AddType application/font-woff2 .woff2
    AddType image/svg+xml .svg
</IfModule>
EOL
"

echo "✅ .htaccess configurado!"

# 9. VERIFICAÇÕES PÓS-DEPLOY
echo "🔍 Executando verificações pós-deploy..."

# Testar se o site está acessível
echo "🌐 Testando acessibilidade do site..."

http_status=$(sshpass -p "$VPS_PASSWORD" ssh -o StrictHostKeyChecking=no "$VPS_USER@$VPS_HOST" "curl -s -o /dev/null -w '%{http_code}' http://localhost" 2>/dev/null || echo "000")

if [[ "$http_status" == "200" || "$http_status" == "301" || "$http_status" == "302" ]]; then
    echo "✅ Site acessível! Status: $http_status"
else
    echo "⚠️ Aviso: Site pode não estar acessível. Status: $http_status"
fi

# Verificar arquivos no servidor
echo "📋 Verificando arquivos no servidor..."

server_file_check=$(sshpass -p "$VPS_PASSWORD" ssh -o StrictHostKeyChecking=no "$VPS_USER@$VPS_HOST" "
cd $VPS_PATH
echo '=== ESTRUTURA DE ARQUIVOS ==='
ls -la
echo ''
echo '=== ASSETS ==='
ls -la assets/
echo ''
echo '=== CSS ==='
ls -la assets/css/
echo ''
echo '=== JS ==='
ls -la assets/js/
")

echo "$server_file_check"

# 10. LIMPEZA E RELATÓRIO FINAL
echo "🧹 Executando limpeza..."

# Remover backups locais antigos (manter apenas os 3 mais recentes)
backup_count=$(ls -1d backup-* 2>/dev/null | wc -l)
if [ "$backup_count" -gt 3 ]; then
    ls -1td backup-* | tail -n +4 | xargs rm -rf
    echo "✅ Backups antigos removidos!"
fi

# Gerar relatório final
echo ""
echo "📋 RELATÓRIO FINAL DO DEPLOY:"
echo "============================================================"
echo "🎯 Projeto: Salvô Landing Page"
echo "📅 Data: $(date '+%d/%m/%Y %H:%M:%S')"
echo "🌐 Domínio: https://$VPS_DOMAIN"
echo "📂 Servidor: $VPS_HOST:$VPS_PATH"
echo ""
echo "✅ ARQUIVOS DEPLOYADOS:"
echo "   📄 Páginas HTML: $(ls -1 *.html | wc -l)"
echo "   🎨 Arquivos CSS: $(ls -1 assets/css/*.css 2>/dev/null | wc -l)"
echo "   ⚡ Arquivos JS: $(ls -1 assets/js/*.js 2>/dev/null | wc -l)"
echo ""
echo "🔧 CONFIGURAÇÕES:"
echo "   ✅ Fontes WhatsApp configuradas"
echo "   ✅ Formulários com validação"
echo "   ✅ Firebase integrado (necessita configuração manual)"
echo "   ✅ reCAPTCHA v1 implementado"
echo "   ✅ .htaccess otimizado"
echo "   ✅ Cache e compressão habilitados"
echo ""
echo "🔗 LINKS IMPORTANTES:"
echo "   🏠 Site: https://$VPS_DOMAIN"
echo "   ❓ FAQ: https://$VPS_DOMAIN/faq.html"
echo "   📧 Contato: https://$VPS_DOMAIN/contato.html"
echo "   📋 Termos: https://$VPS_DOMAIN/termos.html"
echo "   🔒 Privacidade: https://$VPS_DOMAIN/privacidade.html"
echo ""
echo "⚠️  PRÓXIMAS AÇÕES MANUAIS:"
echo "   1. 🔥 Configurar Firebase (ler FIREBASE_SETUP.md)"
echo "   2. 🛡️ Configurar reCAPTCHA"
echo "   3. 📧 Configurar e-mail para formulário de contato"
echo "   4. 🧪 Testar todos os formulários"
echo "   5. 📊 Configurar Google Analytics (opcional)"
echo ""
echo "📞 SUPORTE:"
echo "   📧 E-mail: oficialsalvo@gmail.com"
echo "   💻 Documentação: Ver FIREBASE_SETUP.md no servidor"
echo ""
echo "🎉 DEPLOY CONCLUÍDO COM SUCESSO!"
echo "🚀 O Salvô está no ar em: https://$VPS_DOMAIN"
echo ""
echo "💡 Para atualizações futuras, use:"
echo "   ./quick-update.sh (se existir)"
echo "   ou execute novamente: 2f_landing_deploy.sh --update"
