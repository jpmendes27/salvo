#!/bin/bash

# =================================================================
# SCRIPT DE INVESTIGAÇÃO DO BACKEND - PROJETO SALVÔ
# Fase 1: Mapeamento completo da estrutura atual
# Autor: Claude Assistant
# Data: 2025-09-26
# =================================================================

echo "🔍 INICIANDO INVESTIGAÇÃO DO BACKEND SALVÔ..."
echo "=================================================="

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Função para logging
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Criar arquivo de relatório
REPORT_FILE="backend_investigation_report_$(date +%Y%m%d_%H%M%S).md"

cat > $REPORT_FILE << EOF
# 🔍 RELATÓRIO DE INVESTIGAÇÃO DO BACKEND - SALVÔ
**Data:** $(date '+%Y-%m-%d %H:%M:%S')
**Objetivo:** Mapear estrutura atual do backend para implementação do WhatsApp

## 📋 RESUMO EXECUTIVO
- **Status Atual:** Analisando estrutura existente
- **Próxima Fase:** Implementação WhatsApp Business API
- **Estrutura Encontrada:** [A ser preenchido]

---

EOF

echo "📝 Relatório sendo gerado em: $REPORT_FILE"
echo ""

# =================================================================
# 1. ANÁLISE DA ESTRUTURA DE DIRETÓRIOS
# =================================================================

log_info "1. ANALISANDO ESTRUTURA DE DIRETÓRIOS..."
echo "## 📁 ESTRUTURA DE DIRETÓRIOS" >> $REPORT_FILE
echo "" >> $REPORT_FILE

if [ -d "." ]; then
    echo "```" >> $REPORT_FILE
    tree -a -I '__pycache__|*.pyc|node_modules|.git' . >> $REPORT_FILE 2>/dev/null || find . -type f -not -path '*/\.*' -not -path '*/__pycache__/*' -not -path '*/node_modules/*' | head -50 >> $REPORT_FILE
    echo "```" >> $REPORT_FILE
    log_success "Estrutura de diretórios mapeada"
else
    log_error "Diretório raiz não encontrado"
fi

echo "" >> $REPORT_FILE

# =================================================================
# 2. ANÁLISE DOS ARQUIVOS PYTHON EXISTENTES
# =================================================================

log_info "2. LOCALIZANDO ARQUIVOS PYTHON EXISTENTES..."
echo "## 🐍 ARQUIVOS PYTHON ENCONTRADOS" >> $REPORT_FILE
echo "" >> $REPORT_FILE

PYTHON_FILES=$(find . -name "*.py" -type f 2>/dev/null | head -20)

if [ ! -z "$PYTHON_FILES" ]; then
    echo "### Arquivos Python localizados:" >> $REPORT_FILE
    echo "```" >> $REPORT_FILE
    echo "$PYTHON_FILES" >> $REPORT_FILE
    echo "```" >> $REPORT_FILE
    log_success "$(echo "$PYTHON_FILES" | wc -l) arquivos Python encontrados"
else
    echo "❌ **Nenhum arquivo Python encontrado**" >> $REPORT_FILE
    log_warning "Nenhum arquivo Python encontrado - Backend pode não estar configurado"
fi

echo "" >> $REPORT_FILE

# =================================================================
# 3. ANÁLISE DO ARQUIVO PRINCIPAL (app.py ou main.py)
# =================================================================

log_info "3. PROCURANDO ARQUIVO PRINCIPAL DA APLICAÇÃO..."
echo "## 🚀 ARQUIVO PRINCIPAL" >> $REPORT_FILE
echo "" >> $REPORT_FILE

MAIN_FILES=("app.py" "main.py" "server.py" "run.py" "application.py" "api.py")
FOUND_MAIN=""

for file in "${MAIN_FILES[@]}"; do
    if [ -f "$file" ]; then
        FOUND_MAIN="$file"
        break
    fi
    if [ -f "app/$file" ]; then
        FOUND_MAIN="app/$file"
        break
    fi
done

if [ ! -z "$FOUND_MAIN" ]; then
    echo "### 📄 Arquivo principal encontrado: \`$FOUND_MAIN\`" >> $REPORT_FILE
    echo "" >> $REPORT_FILE
    echo "**Conteúdo (primeiras 30 linhas):**" >> $REPORT_FILE
    echo "```python" >> $REPORT_FILE
    head -n 30 "$FOUND_MAIN" >> $REPORT_FILE
    echo "```" >> $REPORT_FILE
    log_success "Arquivo principal localizado: $FOUND_MAIN"
else
    echo "❌ **Nenhum arquivo principal encontrado**" >> $REPORT_FILE
    log_warning "Arquivo principal não encontrado"
fi

echo "" >> $REPORT_FILE

# =================================================================
# 4. ANÁLISE DOS REQUIREMENTS
# =================================================================

log_info "4. VERIFICANDO DEPENDÊNCIAS..."
echo "## 📦 DEPENDÊNCIAS" >> $REPORT_FILE
echo "" >> $REPORT_FILE

REQ_FILES=("requirements.txt" "requirements-dev.txt" "pyproject.toml" "Pipfile" "environment.yml")
FOUND_REQ=""

for file in "${REQ_FILES[@]}"; do
    if [ -f "$file" ]; then
        FOUND_REQ="$file"
        echo "### 📋 Arquivo de dependências: \`$file\`" >> $REPORT_FILE
        echo "```" >> $REPORT_FILE
        cat "$file" >> $REPORT_FILE
        echo "```" >> $REPORT_FILE
        echo "" >> $REPORT_FILE
        log_success "Dependências encontradas em: $file"
        break
    fi
done

if [ -z "$FOUND_REQ" ]; then
    echo "❌ **Nenhum arquivo de dependências encontrado**" >> $REPORT_FILE
    log_warning "Arquivo de dependências não encontrado"
fi

# =================================================================
# 5. ANÁLISE DE CONFIGURAÇÕES
# =================================================================

log_info "5. VERIFICANDO ARQUIVOS DE CONFIGURAÇÃO..."
echo "## ⚙️ CONFIGURAÇÕES" >> $REPORT_FILE
echo "" >> $REPORT_FILE

CONFIG_FILES=(".env" ".env.example" "config.py" "settings.py" "config.json" "config.yml")

for file in "${CONFIG_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo "### 🔧 Configuração encontrada: \`$file\`" >> $REPORT_FILE
        if [[ "$file" == *".env"* ]]; then
            echo "```bash" >> $REPORT_FILE
            # Não mostrar valores reais por segurança
            sed 's/=.*/=***HIDDEN***/' "$file" >> $REPORT_FILE
            echo "```" >> $REPORT_FILE
        else
            echo "```" >> $REPORT_FILE
            head -n 20 "$file" >> $REPORT_FILE
            echo "```" >> $REPORT_FILE
        fi
        echo "" >> $REPORT_FILE
        log_success "Configuração encontrada: $file"
    fi
    
    # Verificar também em subdiretórios
    if [ -f "app/$file" ]; then
        echo "### 🔧 Configuração encontrada: \`app/$file\`" >> $REPORT_FILE
        echo "```" >> $REPORT_FILE
        head -n 20 "app/$file" >> $REPORT_FILE
        echo "```" >> $REPORT_FILE
        echo "" >> $REPORT_FILE
        log_success "Configuração encontrada: app/$file"
    fi
done

# =================================================================
# 6. ANÁLISE DOS DADOS (JSON)
# =================================================================

log_info "6. PROCURANDO ARQUIVOS DE DADOS (JSON)..."
echo "## 🗄️ BANCO DE DADOS JSON" >> $REPORT_FILE
echo "" >> $REPORT_FILE

JSON_FILES=$(find . -name "*.json" -type f 2>/dev/null | grep -v node_modules | head -10)

if [ ! -z "$JSON_FILES" ]; then
    echo "### Arquivos JSON encontrados:" >> $REPORT_FILE
    echo "$JSON_FILES" | while read json_file; do
        if [ -f "$json_file" ]; then
            echo "#### 📄 \`$json_file\`" >> $REPORT_FILE
            
            # Verificar se é o arquivo sellers.json
            if [[ "$json_file" == *"sellers.json"* ]]; then
                echo "**⭐ ARQUIVO PRINCIPAL DE SELLERS IDENTIFICADO**" >> $REPORT_FILE
                echo "```json" >> $REPORT_FILE
                head -n 20 "$json_file" >> $REPORT_FILE
                echo "```" >> $REPORT_FILE
                log_success "Arquivo sellers.json encontrado!"
            else
                echo "```json" >> $REPORT_FILE
                head -n 10 "$json_file" >> $REPORT_FILE
                echo "```" >> $REPORT_FILE
            fi
            echo "" >> $REPORT_FILE
        fi
    done
    log_success "$(echo "$JSON_FILES" | wc -l) arquivos JSON encontrados"
else
    echo "❌ **Nenhum arquivo JSON encontrado**" >> $REPORT_FILE
    log_warning "Nenhum arquivo JSON encontrado"
fi

# =================================================================
# 7. ANÁLISE DE ROTAS/ENDPOINTS
# =================================================================

log_info "7. PROCURANDO DEFINIÇÕES DE ROTAS/ENDPOINTS..."
echo "## 🛣️ ENDPOINTS/ROTAS EXISTENTES" >> $REPORT_FILE
echo "" >> $REPORT_FILE

# Procurar por padrões de rotas Flask
if [ ! -z "$PYTHON_FILES" ]; then
    echo "### Rotas Flask encontradas:" >> $REPORT_FILE
    echo "```python" >> $REPORT_FILE
    grep -n "@app.route\|@bp.route\|@api.route" $PYTHON_FILES 2>/dev/null >> $REPORT_FILE || echo "Nenhuma rota Flask encontrada" >> $REPORT_FILE
    echo "```" >> $REPORT_FILE
    log_success "Análise de rotas concluída"
else
    echo "❌ **Nenhum arquivo Python para analisar rotas**" >> $REPORT_FILE
fi

echo "" >> $REPORT_FILE

# =================================================================
# 8. ANÁLISE DE PORTAS E CONFIGURAÇÃO DE SERVIDOR
# =================================================================

log_info "8. VERIFICANDO CONFIGURAÇÕES DE SERVIDOR..."
echo "## 🌐 CONFIGURAÇÃO DE SERVIDOR" >> $REPORT_FILE
echo "" >> $REPORT_FILE

if [ ! -z "$PYTHON_FILES" ]; then
    echo "### Configurações de porta/host encontradas:" >> $REPORT_FILE
    echo "```python" >> $REPORT_FILE
    grep -n "app.run\|port=\|host=" $PYTHON_FILES 2>/dev/null >> $REPORT_FILE || echo "Nenhuma configuração de servidor encontrada" >> $REPORT_FILE
    echo "```" >> $REPORT_FILE
fi

# Procurar arquivos de configuração do servidor web
SERVER_CONFIGS=("nginx.conf" "apache.conf" "uwsgi.ini" "gunicorn.conf")
for config in "${SERVER_CONFIGS[@]}"; do
    if [ -f "$config" ]; then
        echo "### 🗄️ Configuração de servidor: \`$config\`" >> $REPORT_FILE
        echo "```" >> $REPORT_FILE
        cat "$config" >> $REPORT_FILE
        echo "```" >> $REPORT_FILE
        log_success "Configuração de servidor encontrada: $config"
    fi
done

echo "" >> $REPORT_FILE

# =================================================================
# 9. RESUMO E PRÓXIMOS PASSOS
# =================================================================

log_info "9. GERANDO RESUMO E PRÓXIMOS PASSOS..."
echo "## 🎯 RESUMO E PRÓXIMOS PASSOS" >> $REPORT_FILE
echo "" >> $REPORT_FILE

echo "### ✅ O que foi encontrado:" >> $REPORT_FILE
echo "- Estrutura de diretórios mapeada" >> $REPORT_FILE

if [ ! -z "$FOUND_MAIN" ]; then
    echo "- ✅ Arquivo principal: $FOUND_MAIN" >> $REPORT_FILE
else
    echo "- ❌ Arquivo principal não encontrado" >> $REPORT_FILE
fi

if [ ! -z "$FOUND_REQ" ]; then
    echo "- ✅ Dependências: $FOUND_REQ" >> $REPORT_FILE
else
    echo "- ❌ Dependências não encontradas" >> $REPORT_FILE
fi

if [ ! -z "$JSON_FILES" ]; then
    echo "- ✅ Arquivos de dados JSON identificados" >> $REPORT_FILE
else
    echo "- ❌ Arquivos JSON não encontrados" >> $REPORT_FILE
fi

echo "" >> $REPORT_FILE
echo "### 🚀 Próxima fase recomendada:" >> $REPORT_FILE
echo "1. **Configuração WhatsApp Business API**" >> $REPORT_FILE
echo "2. **Implementação dos webhooks**" >> $REPORT_FILE
echo "3. **Sistema de processamento de mensagens**" >> $REPORT_FILE
echo "4. **Integração com o sistema de busca**" >> $REPORT_FILE

echo "" >> $REPORT_FILE
echo "---" >> $REPORT_FILE
echo "**Relatório gerado em:** $(date '+%Y-%m-%d %H:%M:%S')" >> $REPORT_FILE

# =================================================================
# FINALIZAÇÃO
# =================================================================

echo ""
echo "=================================================="
log_success "INVESTIGAÇÃO CONCLUÍDA!"
echo "=================================================="
echo ""
echo "📄 Relatório completo salvo em: $REPORT_FILE"
echo ""
echo "🎯 PRÓXIMO PASSO: Baseado neste relatório, será criado o"
echo "   script de implementação do WhatsApp Business API"
echo ""
echo "📋 Para continuar, execute:"
echo "   ./scripts/2_whatsapp_implementation.sh"
echo ""