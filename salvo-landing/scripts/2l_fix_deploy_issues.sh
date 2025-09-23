#!/bin/bash

# Script 2l: Corrigir Problemas de Deploy - Salvô Landing Page
# Autor: Rafael Ferreira
# Data: 2025-08-16
# Uso: cp ../scripts/2l_fix_deploy_issues.sh . && chmod +x 2l_fix_deploy_issues.sh && ./2l_fix_deploy_issues.sh

echo "🔧 Salvô - Correção de Problemas de Deploy..."

# Verificar se está na pasta correta
if [ ! -f "index.html" ] || [ ! -d "assets" ]; then
    echo "❌ Erro: Execute este script dentro da pasta salvo-landing"
    echo "📁 Comando correto:"
    echo "   cd salvo-landing"
    echo "   cp ../scripts/2l_fix_deploy_issues.sh ."
    echo "   chmod +x 2l_fix_deploy_issues.sh && ./2l_fix_deploy_issues.sh"
    exit 1
fi

echo "✅ Pasta do projeto encontrada!"

# Configurações do servidor
VPS_HOST="212.85.1.55"
VPS_USER="salvo-vtec"
VPS_PASSWORD="Bj4hwtmpSXA0ELI32nsI"
VPS_DOMAIN="salvo.vancouvertec.com.br"
VPS_PATH="/home/salvo-vtec/htdocs/salvo.vancouvertec.com.br"

# 1. DIAGNÓSTICO DO SERVIDOR
echo "🔍 Diagnosticando problemas no servidor..."

# Verificar estrutura no servidor
echo "📁 Verificando estrutura de arquivos no servidor..."
server_structure=$(sshpass -p "$VPS_PASSWORD" ssh -o StrictHostKeyChecking=no "$VPS_USER@$VPS_HOST" "
echo '=== CONTEÚDO DO DIRETÓRIO PRINCIPAL ==='
ls -la $VPS_PATH/

echo ''
echo '=== VERIFICANDO PASTA ASSETS ==='
if [ -d '$VPS_PATH/assets' ]; then
    ls -la $VPS_PATH/assets/
else
    echo 'Pasta assets NÃO ENCONTRADA!'
fi

echo ''
echo '=== VERIFICANDO CSS ==='
if [ -d '$VPS_PATH/assets/css' ]; then
    ls -la $VPS_PATH/assets/css/
else
    echo 'Pasta assets/css NÃO ENCONTRADA!'
fi

echo ''
echo '=== VERIFICANDO JS ==='
if [ -d '$VPS_PATH/assets/js' ]; then
    ls -la $VPS_PATH/assets/js/
else
    echo 'Pasta assets/js NÃO ENCONTRADA!'
fi

echo ''
echo '=== VERIFICANDO IMG ==='
if [ -d '$VPS_PATH/assets/img' ]; then
    ls -la $VPS_PATH/assets/img/
else
    echo 'Pasta assets/img NÃO ENCONTRADA!'
fi

echo ''
echo '=== PERMISSÕES ==='
ls -la $VPS_PATH/ | head -10
")

echo "$server_structure"

# 2. VERIFICAR ARQUIVOS LOCAIS
echo ""
echo "📋 Verificando arquivos locais..."

echo "=== ESTRUTURA LOCAL ==="
ls -la

echo ""
echo "=== ASSETS LOCAL ==="
if [ -d "assets" ]; then
    ls -la assets/
else
    echo "❌ Pasta assets local não encontrada!"
fi

echo ""
echo "=== CSS LOCAL ==="
if [ -d "assets/css" ]; then
    ls -la assets/css/
else
    echo "❌ Pasta assets/css local não encontrada!"
fi

echo ""
echo "=== JS LOCAL ==="
if [ -d "assets/js" ]; then
    ls -la assets/js/
else
    echo "❌ Pasta assets/js local não encontrada!"
fi

# 3. RECRIAR ESTRUTURA E FAZER UPLOAD FORÇADO
echo ""
echo "🔄 Recriando estrutura e fazendo upload forçado..."

# Criar todas as pastas necessárias no servidor
sshpass -p "$VPS_PASSWORD" ssh -o StrictHostKeyChecking=no "$VPS_USER@$VPS_HOST" "
echo 'Criando estrutura de pastas...'
mkdir -p $VPS_PATH
mkdir -p $VPS_PATH/assets
mkdir -p $VPS_PATH/assets/css
mkdir -p $VPS_PATH/assets/js
mkdir -p $VPS_PATH/assets/img
mkdir -p $VPS_PATH/assets/img/icons

echo 'Definindo permissões das pastas...'
chmod 755 $VPS_PATH
chmod 755 $VPS_PATH/assets
chmod 755 $VPS_PATH/assets/css
chmod 755 $VPS_PATH/assets/js
chmod 755 $VPS_PATH/assets/img
chmod 755 $VPS_PATH/assets/img/icons

echo 'Estrutura criada!'
"

# 4. UPLOAD INDIVIDUAL DE CADA ARQUIVO
echo "📤 Fazendo upload individual dos arquivos..."

# Função melhorada para upload
upload_file() {
    local file="$1"
    local dest_path="$2"

    if [ -f "$file" ]; then
        echo "📄 Enviando: $file"
        sshpass -p "$VPS_PASSWORD" scp -o StrictHostKeyChecking=no "$file" "$VPS_USER@$VPS_HOST:$dest_path/$file"

        if [ $? -eq 0 ]; then
            echo "✅ $file enviado com sucesso!"
        else
            echo "❌ Erro ao enviar $file"
        fi
    else
        echo "⚠️ Arquivo não encontrado: $file"
    fi
}

# Upload de arquivos HTML
echo "📄 Enviando arquivos HTML..."
for html_file in *.html; do
    upload_file "$html_file" "$VPS_PATH"
done

# Upload de arquivos CSS
echo "🎨 Enviando arquivos CSS..."
if [ -d "assets/css" ]; then
    for css_file in assets/css/*.css; do
        if [ -f "$css_file" ]; then
            echo "📄 Enviando: $css_file"
            sshpass -p "$VPS_PASSWORD" scp -o StrictHostKeyChecking=no "$css_file" "$VPS_USER@$VPS_HOST:$VPS_PATH/$css_file"
        fi
    done
fi

# Upload de arquivos JavaScript
echo "⚡ Enviando arquivos JavaScript..."
if [ -d "assets/js" ]; then
    for js_file in assets/js/*.js; do
        if [ -f "$js_file" ]; then
            echo "📄 Enviando: $js_file"
            sshpass -p "$VPS_PASSWORD" scp -o StrictHostKeyChecking=no "$js_file" "$VPS_USER@$VPS_HOST:$VPS_PATH/$js_file"
        fi
    done
fi

# Upload de imagens (se existir)
echo "🖼️ Enviando imagens..."
if [ -d "assets/img" ]; then
    for img_file in assets/img/*; do
        if [ -f "$img_file" ]; then
            echo "📄 Enviando: $img_file"
            sshpass -p "$VPS_PASSWORD" scp -o StrictHostKeyChecking=no "$img_file" "$VPS_USER@$VPS_HOST:$VPS_PATH/$img_file"
        fi
    done
fi

# Upload de outros arquivos
echo "📋 Enviando outros arquivos..."
for other_file in robots.txt sitemap.xml manifest.webmanifest; do
    upload_file "$other_file" "$VPS_PATH"
done

# 5. CORRIGIR PERMISSÕES FINAIS
echo "🔐 Corrigindo permissões finais..."

sshpass -p "$VPS_PASSWORD" ssh -o StrictHostKeyChecking=no "$VPS_USER@$VPS_HOST" "
echo 'Ajustando permissões de arquivos...'
find $VPS_PATH -type f -name '*.html' -exec chmod 644 {} \;
find $VPS_PATH -type f -name '*.css' -exec chmod 644 {} \;
find $VPS_PATH -type f -name '*.js' -exec chmod 644 {} \;
find $VPS_PATH -type f -name '*.txt' -exec chmod 644 {} \;
find $VPS_PATH -type f -name '*.xml' -exec chmod 644 {} \;
find $VPS_PATH -type f -name '*.webmanifest' -exec chmod 644 {} \;

echo 'Ajustando proprietário...'
chown -R $VPS_USER:$VPS_USER $VPS_PATH

echo 'Permissões ajustadas!'
"

# 6. CRIAR ARQUIVO DE LOGO SIMPLES (TEMPORÁRIO)
echo "🎨 Criando logo temporária..."

# Criar logo SVG simples se não existir
if [ ! -f "assets/img/logo-salvo.svg" ]; then
    mkdir -p assets/img
    cat > assets/img/logo-salvo.svg << 'EOF'
<svg width="120" height="40" xmlns="http://www.w3.org/2000/svg">
  <rect width="120" height="40" fill="#25D366" rx="8"/>
  <text x="60" y="25" font-family="Arial, sans-serif" font-size="16" font-weight="bold" text-anchor="middle" fill="white">Salvô</text>
</svg>
EOF

    # Enviar logo para servidor
    sshpass -p "$VPS_PASSWORD" scp -o StrictHostKeyChecking=no "assets/img/logo-salvo.svg" "$VPS_USER@$VPS_HOST:$VPS_PATH/assets/img/"
    echo "✅ Logo temporária criada e enviada!"
fi

# 7. CRIAR FAVICON SIMPLES
echo "🔖 Criando favicon..."

if [ ! -f "assets/img/favicon.ico" ]; then
    # Criar favicon SVG simples
    cat > assets/img/favicon.svg << 'EOF'
<svg width="32" height="32" xmlns="http://www.w3.org/2000/svg">
  <rect width="32" height="32" fill="#25D366" rx="4"/>
  <text x="16" y="22" font-family="Arial, sans-serif" font-size="14" font-weight="bold" text-anchor="middle" fill="white">S</text>
</svg>
EOF

    # Enviar favicon para servidor
    sshpass -p "$VPS_PASSWORD" scp -o StrictHostKeyChecking=no "assets/img/favicon.svg" "$VPS_USER@$VPS_HOST:$VPS_PATH/assets/img/"
    echo "✅ Favicon criado e enviado!"
fi

# 8. VERIFICAÇÃO FINAL
echo ""
echo "🔍 Verificação final no servidor..."

final_check=$(sshpass -p "$VPS_PASSWORD" ssh -o StrictHostKeyChecking=no "$VPS_USER@$VPS_HOST" "
echo '=== ESTRUTURA FINAL ==='
ls -la $VPS_PATH/

echo ''
echo '=== ASSETS FINAL ==='
ls -la $VPS_PATH/assets/

echo ''
echo '=== CSS FINAL ==='
ls -la $VPS_PATH/assets/css/

echo ''
echo '=== JS FINAL ==='
ls -la $VPS_PATH/assets/js/

echo ''
echo '=== TESTE DE ACESSO ==='
cd $VPS_PATH
if [ -f 'index.html' ]; then
    echo '✅ index.html encontrado'
else
    echo '❌ index.html NÃO encontrado'
fi

if [ -f 'assets/css/style.css' ]; then
    echo '✅ style.css encontrado'
else
    echo '❌ style.css NÃO encontrado'
fi

if [ -f 'assets/js/app.js' ]; then
    echo '✅ app.js encontrado'
else
    echo '❌ app.js NÃO encontrado'
fi
")

echo "$final_check"

# 9. TESTE DE CONECTIVIDADE
echo ""
echo "🌐 Testando conectividade do site..."

# Testar acesso HTTP
http_test=$(curl -s -o /dev/null -w "%{http_code}" "http://$VPS_DOMAIN" 2>/dev/null || echo "000")
echo "🔗 Teste HTTP: $http_test"

# Testar arquivo CSS específico
css_test=$(curl -s -o /dev/null -w "%{http_code}" "http://$VPS_DOMAIN/assets/css/style.css" 2>/dev/null || echo "000")
echo "🎨 Teste CSS: $css_test"

# Testar arquivo JS específico
js_test=$(curl -s -o /dev/null -w "%{http_code}" "http://$VPS_DOMAIN/assets/js/app.js" 2>/dev/null || echo "000")
echo "⚡ Teste JS: $js_test"

# 10. RELATÓRIO FINAL
echo ""
echo "📋 RELATÓRIO DE CORREÇÃO:"
echo "============================================================"
echo "🔧 Problemas identificados e corrigidos:"
echo "   ✅ Estrutura de pastas recriada"
echo "   ✅ Upload individual de todos os arquivos"
echo "   ✅ Permissões corrigidas"
echo "   ✅ Logo temporária criada"
echo "   ✅ Favicon criado"
echo ""
echo "🌐 Testes de conectividade:"
echo "   📄 Site principal: $http_test"
echo "   🎨 Arquivo CSS: $css_test"
echo "   ⚡ Arquivo JS: $js_test"
echo ""
echo "🎯 Próximos passos:"
echo "   1. Acesse: https://$VPS_DOMAIN"
echo "   2. Pressione Ctrl+F5 para limpar cache"
echo "   3. Verifique se os arquivos carregam"
echo "   4. Teste os formulários"
echo ""
if [[ "$http_test" == "200" && "$css_test" == "200" && "$js_test" == "200" ]]; then
    echo "🎉 SUCESSO! Todos os arquivos estão carregando corretamente!"
else
    echo "⚠️ Alguns arquivos ainda podem ter problemas. Verifique manualmente."
fi
echo ""
echo "🔄 Se ainda houver problemas, execute novamente este script."
echo "🌟 Script 2l concluído!"
