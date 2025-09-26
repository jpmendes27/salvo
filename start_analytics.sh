#!/bin/bash

echo "🚀 Iniciando Salvô Analytics..."

# Verificar se ambiente virtual existe
if [ ! -d "venv" ]; then
    echo "❌ Ambiente virtual não encontrado. Execute primeiro:"
    echo "./fix-analytics-salvo.sh"
    exit 1
fi

# Ativar ambiente virtual
echo "🐍 Ativando ambiente virtual..."
source venv/bin/activate

# Adicionar diretório atual ao PYTHONPATH
export PYTHONPATH="${PYTHONPATH}:$(pwd)"

echo "📊 Iniciando servidor..."
echo "🔗 Acesse: http://localhost:5000"
echo "🔐 Admin: http://localhost:5000/admin/login"
echo "👤 User: admin | Pass: salvo2025admin"
echo ""

# Iniciar aplicação
cd app && python main.py
