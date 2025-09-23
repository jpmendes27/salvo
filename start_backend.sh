#!/bin/bash

echo "🐍 Iniciando Backend Salvô (Modo Simples)"
echo "========================================"
echo ""

# Verificar Flask
echo "📦 Verificando Flask..."
if ! python3 -c "import flask" 2>/dev/null; then
    echo "❌ Flask não encontrado"
    echo "💡 Execute: ./1k-simple-solution.sh"
    exit 1
fi

echo "✅ Flask OK!"

# Criar diretórios
mkdir -p data/sellers/images
mkdir -p logs

echo ""
echo "🚀 Iniciando Flask na porta 5000..."
echo "🌐 API: http://localhost:5000"
echo "📊 Health: http://localhost:5000/health"
echo "💾 Dados: data/sellers/sellers.json"
echo ""
echo "🔗 ENDPOINTS:"
echo "   POST /api/save_seller - Cadastrar seller"
echo "   GET  /api/list_sellers - Listar sellers"  
echo "   GET  /api/stats - Estatísticas"
echo "   GET  /health - Status"
echo ""
echo "⚠️  IMPORTANTE: Mantenha este terminal aberto!"
echo "💡 Para parar: Ctrl+C"
echo ""

# Iniciar Flask
python3 app/main.py
