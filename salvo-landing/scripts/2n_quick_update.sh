#!/bin/bash

# Script 2n: Atualização Rápida - Salvô Landing Page
# Autor: Rafael Ferreira
# Data: 2025-08-16
# Uso: cp ../scripts/2n_quick_update.sh . && chmod +x 2n_quick_update.sh && ./2n_quick_update.sh

echo "🔄 Salvô - Atualização Rápida..."

# Verificar se está na pasta correta
if [ ! -f "index.html" ] || [ ! -d "assets" ]; then
    echo "❌ Erro: Execute este script dentro da pasta salvo-landing"
    echo "📁 Comando correto:"
    echo "   cd salvo-landing"
    echo "   cp ../scripts/2n_quick_update.sh ."
    echo "   chmod +x 2n_quick_update.sh && ./2n_quick_update.sh"
    exit 1
fi

echo "✅ Pasta do projeto encontrada!"

# Configurações do servidor
VPS_HOST="212.85.1.55"
VPS_USER="salvo-vtec"
VPS_PASSWORD="Bj4hwtmpSXA0ELI32nsI"
VPS_DOMAIN="salvo.vancouvertec.com.br"
VPS_PATH="/home/salvo-vtec/htdocs/salvo.vancouvertec.com.br"

# Verificar modo de atualização
UPDATE_MODE="smart"
if [ "$1" = "--force" ]; then
    UPDATE_MODE="force"
    echo "🔥 Modo: Atualização forçada"
elif [ "$1" = "--css" ]; then
    UPDATE_MODE="css"
    echo "🎨 Modo: Apenas CSS"
elif [ "$1" = "--js" ]; then
    UPDATE_MODE="js"
    echo "⚡ Modo: Apenas JavaScript"
elif [ "$1" = "--html" ]; then
    UPDATE_MODE="html"
    echo "📄 Modo: Apenas HTML"
else
    echo "🧠 Modo: Atualização inteligente"
fi

# Função para detectar arquivos modificados
detect_changes() {
    echo "🔍 Detectando mudanças..."

    changed_files=()

    # Verificar modificações nos últimos 30 minutos
    if [ -n "$(find . -name '*.html' -mmin -30 2>/dev/null)" ]; then
        changed_files+=("html")
    fi

    if [ -n "$(find assets/css -name '*.css' -mmin -30 2>/dev/null)" ]; then
        changed_files+=("css")
    fi

    if [ -n "$(find assets/js -name '*.js' -mmin -30 2>/dev/null)" ]; then
        changed_files+=("js")
    fi

    if [ -n "$(find assets/img -mmin -30 2>/dev/null)" ]; then
        changed_files+=("img")
    fi

    if [ ${#changed_files[@]} -eq 0 ]; then
        echo "ℹ️ Nenhuma mudança recente detectada. Atualizando tudo..."
        changed_files=("html" "css" "js" "img")
    else
        echo "📝 Mudanças detectadas em: ${changed_files[*]}"
    fi
}

# Função de backup rápido
quick_backup() {
    echo "💾 Criando backup rápido..."

    BACKUP_DIR="update-backup-$(date +%Y%m%d_%H%M%S)"
    mkdir -p "$BACKUP_DIR"

    # Backup dos arquivos que serão atualizados
    case $UPDATE_MODE in
        "css")
            cp -r assets/css/ "$BACKUP_DIR/" 2>/dev/null
            ;;
        "js")
            cp -r assets/js/ "$BACKUP_DIR/" 2>/dev/null
            ;;
        "html")
            cp *.html "$BACKUP_DIR/" 2>/dev/null
            ;;
        *)
            cp -r . "$BACKUP_DIR/" 2>/dev/null
            ;;
    esac

    echo "✅ Backup criado em: $BACKUP_DIR"
}

# Função de upload otimizado
optimized_upload() {
    local file_type="$1"

    case $file_type in
        "html")
            echo "📄 Atualizando arquivos HTML..."
            for html_file in *.html; do
                if [ -f "$html_file" ]; then
                    sshpass -p "$VPS_PASSWORD" scp -o StrictHostKeyChecking=no "$html_file" "$VPS_USER@$VPS_HOST:$VPS_PATH/"
                    echo "✅ $html_file atualizado"
                fi
            done
            ;;

        "css")
            echo "🎨 Atualizando arquivos CSS..."
            for css_file in assets/css/*.css; do
                if [ -f "$css_file" ]; then
                    sshpass -p "$VPS_PASSWORD" scp -o StrictHostKeyChecking=no "$css_file" "$VPS_USER@$VPS_HOST:$VPS_PATH/assets/css/"
                    echo "✅ $(basename $css_file) atualizado"
                fi
            done
            ;;

        "js")
            echo "⚡ Atualizando arquivos JavaScript..."

            # Limpar console logs antes do upload
            temp_dir=$(mktemp -d)
            cp assets/js/*.js "$temp_dir/" 2>/dev/null

            for js_file in "$temp_dir"/*.js; do
                if [ -f "$js_file" ]; then
                    # Remover console logs
                    sed -i '/console\.log/d' "$js_file"
                    sed -i '/console\.warn/d' "$js_file"
                    sed -i '/console\.error/d' "$js_file"

                    # Upload
                    sshpass -p "$VPS_PASSWORD" scp -o StrictHostKeyChecking=no "$js_file" "$VPS_USER@$VPS_HOST:$VPS_PATH/assets/js/"
                    echo "✅ $(basename $js_file) atualizado (console logs removidos)"
                fi
            done

            rm -rf "$temp_dir"
            ;;

        "img")
            echo "🖼️ Atualizando imagens..."
            for img_file in assets/img/*; do
                if [ -f "$img_file" ]; then
                    sshpass -p "$VPS_PASSWORD" scp -o StrictHostKeyChecking=no "$img_file" "$VPS_USER@$VPS_HOST:$VPS_PATH/assets/img/"
                    echo "✅ $(basename $img_file) atualizado"
                fi
            done
            ;;
    esac
}

# Função para limpeza de cache
clear_cache() {
    echo "🧹 Limpando cache do servidor..."

    sshpass -p "$VPS_PASSWORD" ssh -o StrictHostKeyChecking=no "$VPS_USER@$VPS_HOST" "
    # Atualizar timestamp dos arquivos para forçar recarregamento
    find $VPS_PATH -name '*.css' -exec touch {} \;
    find $VPS_PATH -name '*.js' -exec touch {} \;
    find $VPS_PATH -name '*.html' -exec touch {} \;

    # Limpar possível cache do Apache
    if [ -f '/etc/init.d/apache2' ]; then
        service apache2 reload 2>/dev/null || true
    fi
    "

    echo "✅ Cache limpo!"
}

# Função de verificação pós-update
verify_update() {
    echo "🔍 Verificando atualização..."

    # Testar conectividade
    https_test=$(curl -s -o /dev/null -w "%{http_code}" "https://$VPS_DOMAIN" 2>/dev/null || echo "000")

    if [ "$https_test" = "200" ]; then
        echo "✅ Site funcionando: $https_test"
    else
        echo "⚠️ Status do site: $https_test"
    fi

    # Verificar se arquivos específicos foram atualizados
    case $UPDATE_MODE in
        "css"|"smart"|"force")
            css_test=$(curl -s -o /dev/null -w "%{http_code}" "https://$VPS_DOMAIN/assets/css/style.css" 2>/dev/null || echo "000")
            echo "🎨 CSS Status: $css_test"
            ;;
        "js"|"smart"|"force")
            js_test=$(curl -s -o /dev/null -w "%{http_code}" "https://$VPS_DOMAIN/assets/js/app.js" 2>/dev/null || echo "000")
            echo "⚡ JS Status: $js_test"
            ;;
    esac
}

# Início da execução
echo "📅 Iniciando atualização em $(date '+%H:%M:%S')"

# Verificar dependências
if ! command -v sshpass &> /dev/null; then
    echo "❌ sshpass não encontrado. Instale com: sudo apt install sshpass"
    exit 1
fi

# Backup rápido
quick_backup

# Executar atualização baseada no modo
case $UPDATE_MODE in
    "css")
        optimized_upload "css"
        ;;
    "js")
        optimized_upload "js"
        ;;
    "html")
        optimized_upload "html"
        ;;
    "force")
        echo "🔥 Forçando atualização completa..."
        optimized_upload "html"
        optimized_upload "css"
        optimized_upload "js"
        optimized_upload "img"
        ;;
    "smart")
        detect_changes
        for change_type in "${changed_files[@]}"; do
            optimized_upload "$change_type"
        done
        ;;
esac

# Atualizar permissões sempre
echo "🔐 Atualizando permissões..."
sshpass -p "$VPS_PASSWORD" ssh -o StrictHostKeyChecking=no "$VPS_USER@$VPS_HOST" "
find $VPS_PATH -type f -exec chmod 644 {} \;
find $VPS_PATH -type d -exec chmod 755 {} \;
chown -R $VPS_USER:$VPS_USER $VPS_PATH
"

# Limpeza de cache
clear_cache

# Verificação final
verify_update

# Relatório final
echo ""
echo "📋 RELATÓRIO DE ATUALIZAÇÃO:"
echo "============================================"
echo "⏰ Hora: $(date '+%H:%M:%S')"
echo "🔄 Modo: $UPDATE_MODE"
echo "🌐 Site: https://$VPS_DOMAIN"
echo ""
echo "✅ Atualização concluída com sucesso!"
