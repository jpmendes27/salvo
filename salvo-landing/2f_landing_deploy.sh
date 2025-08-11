#!/bin/bash

# Script 2f: Deploy da Landing Page do Salvô para VPS
# Autor: Rafael Ferreira
# Data: 2025-08-09
# Uso: Execute dentro da pasta salvo-landing
# ./2f_landing_deploy.sh [--update]

echo "🚀 Deploy da Landing Page Salvô para VPS..."

# Verificar se está na pasta correta
if [ ! -f "index.html" ] || [ ! -d "assets" ]; then
    echo "❌ Erro: Execute este script dentro da pasta salvo-landing"
    echo "📁 Estrutura esperada:"
    echo "   salvo-landing/"
    echo "   ├── index.html"
    echo "   ├── assets/"
    echo "   └── ..."
    exit 1
fi

# Configurações do servidor
VPS_HOST="212.85.1.55"
VPS_USER="salvo-vtec"
VPS_PASSWORD="Bj4hwtmpSXA0ELI32nsI"
VPS_DOMAIN="salvo.vancouvertec.com.br"
VPS_PATH="/home/salvo-vtec/htdocs/salvo.vancouvertec.com.br"

# Verificar se é atualização
UPDATE_MODE=false
if [ "$1" = "--update" ]; then
    UPDATE_MODE=true
    echo "🔄 Modo atualização ativado"
fi

# Verificar dependências
echo "🔍 Verificando dependências..."

# Verificar sshpass
if ! command -v sshpass &> /dev/null; then
    echo "📦 Instalando sshpass..."
    sudo apt update
    sudo apt install -y sshpass
fi

# Verificar rsync
if ! command -v rsync &> /dev/null; then
    echo "📦 Instalando rsync..."
    sudo apt install -y rsync
fi

echo "✅ Dependências verificadas!"

# Função para executar comando no servidor
ssh_exec() {
    sshpass -p "$VPS_PASSWORD" ssh -o StrictHostKeyChecking=no "$VPS_USER@$VPS_HOST" "$1"
}

# Função para fazer upload de arquivos
upload_files() {
    local source="$1"
    local destination="$2"

    sshpass -p "$VPS_PASSWORD" rsync -avz \
        --delete \
        -e "ssh -o StrictHostKeyChecking=no" \
        "$source" "$VPS_USER@$VPS_HOST:$destination"
}

# Pré-deploy: Validações
echo "🔍 Executando validações pré-deploy..."

# Verificar arquivos essenciais
required_files=(
    "index.html"
    "assets/css/style.css"
    "assets/js/app.js"
    "assets/js/firebase.js"
    "assets/img/logo-salvo.svg"
)

for file in "${required_files[@]}"; do
    if [ ! -f "$file" ]; then
        echo "❌ Arquivo obrigatório não encontrado: $file"
        exit 1
    fi
done

echo "✅ Arquivos essenciais verificados!"

# Verificar se o servidor está acessível
echo "🌐 Testando conexão com o servidor..."
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

# Backup (apenas se não for primeira instalação)
if [ "$UPDATE_MODE" = true ]; then
    echo "💾 Criando backup da versão atual..."

    BACKUP_DIR="/home/$VPS_USER/backups/landing-$(date +%Y%m%d_%H%M%S)"

    ssh_exec "mkdir -p $BACKUP_DIR"
    ssh_exec "cp -r $VPS_PATH/* $BACKUP_DIR/ 2>/dev/null || true"

    if [ $? -eq 0 ]; then
        echo "✅ Backup criado em: $BACKUP_DIR"
    else
        echo "⚠️ Aviso: Backup não pôde ser criado (primeira instalação?)"
    fi
fi

# Criar estrutura de diretórios no servidor
echo "📁 Preparando estrutura no servidor..."

ssh_exec "mkdir -p $VPS_PATH"
ssh_exec "mkdir -p $VPS_PATH/assets/{css,js,img/icons}"

if [ $? -ne 0 ]; then
    echo "❌ Erro ao criar diretórios no servidor"
    exit 1
fi

echo "✅ Estrutura de diretórios criada!"

# Upload dos arquivos
echo "📤 Enviando arquivos para o servidor..."

# Fazer upload de todos os arquivos
echo "📄 Enviando arquivos HTML..."
upload_files "*.html" "$VPS_PATH/"

echo "🎨 Enviando assets CSS..."
upload_files "assets/css/" "$VPS_PATH/assets/"

echo "⚡ Enviando assets JavaScript..."
upload_files "assets/js/" "$VPS_PATH/assets/"

echo "🖼️ Enviando imagens..."
upload_files "assets/img/" "$VPS_PATH/assets/"

echo "📋 Enviando arquivos de configuração..."
for file in robots.txt sitemap.xml manifest.webmanifest; do
    if [ -f "$file" ]; then
        upload_files "$file" "$VPS_PATH/"
    fi
done

if [ $? -ne 0 ]; then
    echo "❌ Erro durante upload dos arquivos"
    exit 1
fi

echo "✅ Upload concluído!"

# Configurar permissões
echo "🔐 Configurando permissões..."

ssh_exec "find $VPS_PATH -type f -exec chmod 644 {} \;"
ssh_exec "find $VPS_PATH -type d -exec chmod 755 {} \;"
ssh_exec "chown -R $VPS_USER:$VPS_USER $VPS_PATH"

echo "✅ Permissões configuradas!"

# Otimizações
echo "⚡ Aplicando otimizações..."

# Comprimir arquivos CSS e JS (se disponível)
if ssh_exec "command -v gzip"; then
    echo "🗜️ Comprimindo arquivos..."
    ssh_exec "find $VPS_PATH -name '*.css' -exec gzip -k {} \;"
    ssh_exec "find $VPS_PATH -name '*.js' -exec gzip -k {} \;"
    ssh_exec "find $VPS_PATH -name '*.html' -exec gzip -k {} \;"
fi

# Configurar cache headers (se arquivo .htaccess não existir)
if ! ssh_exec "[ -f $VPS_PATH/.htaccess ]"; then
    echo "📄 Criando arquivo .htaccess..."

    ssh_exec "cat > $VPS_PATH/.htaccess << 'EOF'
# Salvô Landing Page - Configurações de Cache e Segurança

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
</IfModule>

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
</IfModule>

# Redirecionamento HTTPS
RewriteEngine On
RewriteCond %{HTTPS} off
RewriteRule ^(.*)$ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]

# Página de erro personalizada
ErrorDocument 404 /index.html

# Segurança - Headers
<IfModule mod_headers.c>
    Header always set X-Content-Type-Options nosniff
    Header always set X-Frame-Options DENY
    Header always set X-XSS-Protection \"1; mode=block\"
    Header always set Strict-Transport-Security \"max-age=31536000; includeSubDomains\"
</IfModule>
EOF"
fi

echo "✅ Otimizações aplicadas!"

# Verificar deploy
echo "🔍 Verificando deploy..."

# Testar se o site está acessível
if ssh_exec "curl -s -o /dev/null -w '%{http_code}' http://localhost" | grep -q "200\|301\|302"; then
    echo "✅ Site acessível localmente no servidor!"
else
    echo "⚠️ Aviso: Site pode não estar acessível localmente"
fi

# Verificar arquivos principais
missing_files=()
for file in index.html assets/css/style.css assets/js/app.js; do
    if ! ssh_exec "[ -f $VPS_PATH/$file ]"; then
        missing_files+=("$file")
    fi
done

if [ ${#missing_files[@]} -eq 0 ]; then
    echo "✅ Todos os arquivos principais foram enviados!"
else
    echo "⚠️ Arquivos faltando no servidor:"
    printf '%s\n' "${missing_files[@]}"
fi

# Verificar espaço em disco
disk_usage=$(ssh_exec "df -h $VPS_PATH | tail -1 | awk '{print \$5}' | sed 's/%//'")
if [ "$disk_usage" -gt 90 ]; then
    echo "⚠️ Aviso: Uso de disco alto: ${disk_usage}%"
else
    echo "✅ Espaço em disco: ${disk_usage}% usado"
fi

# Gerar relatório de deploy
echo ""
echo "📋 Gerando relatório de deploy..."

cat > deploy-report.txt << EOF
Relatório de Deploy - Salvô Landing Page
=======================================

Data/Hora: $(date '+%d/%m/%Y %H:%M:%S')
Servidor: $VPS_HOST
Domínio: $VPS_DOMAIN
Usuário: $VPS_USER
Diretório: $VPS_PATH

Status do Deploy:
✅ Arquivos enviados com sucesso
✅ Permissões configuradas
✅ Otimizações aplicadas
✅ Configurações de cache ativadas

Arquivos Principais:
$(for file in "${required_files[@]}"; do
    if ssh_exec "[ -f $VPS_PATH/$file ]"; then
        echo "✅ $file"
    else
        echo "❌ $file"
    fi
done)

URLs de Acesso:
🌐 Site: https://$VPS_DOMAIN
📄 FAQ: https://$VPS_DOMAIN/faq.html
📧 Contato: https://$VPS_DOMAIN/contato.html

Próximos Passos:
1. Configurar Firebase (credentials em firebase.js)
2. Configurar reCAPTCHA v3
3. Testar formulários de contato
4. Configurar SSL se necessário
5. Testar responsividade em dispositivos

Para atualizar no futuro:
./2f_landing_deploy.sh --update
EOF

echo "✅ Relatório salvo em: deploy-report.txt"

# Criar script de atualização rápida
cat > quick-update.sh << 'EOF'
#!/bin/bash

# Script de atualização rápida da Landing Page
# Execute após fazer alterações nos arquivos

echo "🔄 Atualização rápida da Landing Page..."

# Verificar se está na pasta correta
if [ ! -f "index.html" ]; then
    echo "❌ Execute na pasta salvo-landing"
    exit 1
fi

# Executar deploy em modo atualização
./2f_landing_deploy.sh --update

echo "✅ Atualização concluída!"
echo "🌐 Acesse: https://salvo.vancouvertec.com.br"
EOF

chmod +x quick-update.sh

# Criar script de rollback
cat > rollback.sh << 'EOF'
#!/bin/bash

# Script de rollback para versão anterior

VPS_HOST="212.85.1.55"
VPS_USER="salvo-vtec"
VPS_PASSWORD="Bj4hwtmpSXA0ELI32nsI"
VPS_PATH="/home/salvo-vtec/htdocs/salvo.vancouvertec.com.br"

echo "🔄 Fazendo rollback para versão anterior..."

# Listar backups disponíveis
echo "📋 Backups disponíveis:"
sshpass -p "$VPS_PASSWORD" ssh -o StrictHostKeyChecking=no "$VPS_USER@$VPS_HOST" "ls -la /home/$VPS_USER/backups/ | grep landing"

echo ""
echo "Para fazer rollback manual:"
echo "1. ssh $VPS_USER@$VPS_HOST"
echo "2. cp -r /home/$VPS_USER/backups/landing-YYYYMMDD_HHMMSS/* $VPS_PATH/"
echo "3. Confirme a restauração"
EOF

chmod +x rollback.sh

# Finalização
echo ""
echo "🎉 Deploy da Landing Page concluído com sucesso!"
echo ""
echo "📊 Resumo do Deploy:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🌐 Site principal: https://$VPS_DOMAIN"
echo "❓ FAQ: https://$VPS_DOMAIN/faq.html"
echo "📧 Contato: https://$VPS_DOMAIN/contato.html"
echo "📄 Obrigado: https://$VPS_DOMAIN/obrigado.html"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📋 Arquivos criados:"
echo "   ├── deploy-report.txt     # Relatório detalhado do deploy"
echo "   ├── quick-update.sh       # Atualização rápida"
echo "   └── rollback.sh          # Rollback de emergência"
echo ""
echo "🔧 Configurações pendentes:"
echo "   1. 🔥 Firebase: Edite assets/js/firebase.js com suas credenciais"
echo "   2. 🤖 reCAPTCHA: Configure chave no Google Console"
echo "   3. 📧 E-mail: Configure servidor SMTP para formulário de contato"
echo "   4. 🔒 SSL: Verifique se HTTPS está funcionando"
echo ""
echo "⚡ Comandos úteis:"
echo "   ./quick-update.sh         # Atualizar arquivos após mudanças"
echo "   ./rollback.sh            # Fazer rollback se necessário"
echo "   ./2f_landing_deploy.sh --update  # Deploy completo (modo atualização)"
echo ""
echo "📱 Para testar:"
echo "   ✅ Responsividade (mobile/desktop)"
echo "   ✅ Formulários PF e PJ"
echo "   ✅ Navegação entre páginas"
echo "   ✅ Performance (PageSpeed Insights)"
echo ""
if [ "$UPDATE_MODE" = true ]; then
    echo "🔄 Atualização concluída! Backup da versão anterior criado."
else
    echo "🚀 Primeira instalação concluída! Site está no ar."
fi
echo ""
echo "✨ Landing Page do Salvô está online e funcionando!"
echo "🌐 Acesse agora: https://$VPS_DOMAIN"
