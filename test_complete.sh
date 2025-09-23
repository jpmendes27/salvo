#!/bin/bash

# Script para testar sistema completo com venv

echo "🧪 Teste Completo - Sistema Salvô (com venv)"
echo "=============================================="
echo ""

# 1. Verificar estrutura
echo "1️⃣ Verificando estrutura..."
if [ -f "data/sellers/sellers.json" ]; then
    echo "✅ Banco de dados: data/sellers/sellers.json"
    echo "📊 Sellers cadastrados: $(cat data/sellers/sellers.json | grep -o '"id"' | wc -l)"
else
    echo "❌ Banco de dados não encontrado"
fi

if [ -d "data/sellers/images" ]; then
    echo "✅ Pasta de imagens: data/sellers/images/"
    echo "🖼️ Imagens: $(ls data/sellers/images/ 2>/dev/null | wc -l)"
else
    echo "❌ Pasta de imagens não encontrada"
fi

# 2. Verificar venv
echo ""
echo "2️⃣ Verificando ambiente virtual..."
if [ -d "venv" ]; then
    echo "✅ Ambiente virtual encontrado"
    
    # Testar dependências no venv
    source venv/bin/activate
    python -c "import flask, flask_cors, werkzeug; print('✅ Dependências OK no venv')" 2>/dev/null
    
    if [ $? -eq 0 ]; then
        echo "✅ Flask funcionando no venv"
    else
        echo "❌ Flask não funciona no venv"
        echo "💡 Execute: ./1i-fix-venv.sh"
    fi
    deactivate
else
    echo "❌ Ambiente virtual não encontrado"
    echo "💡 Execute: ./1i-fix-venv.sh"
fi

# 3. Testar backend
echo ""
echo "3️⃣ Testando backend..."
if curl -s http://localhost:5000/health > /dev/null 2>&1; then
    echo "✅ Backend rodando na porta 5000"
    echo "📊 Status: $(curl -s http://localhost:5000/health | grep -o '"status":"[^"]*"')"
    echo "👤 Sellers: $(curl -s http://localhost:5000/health | grep -o '"sellers_count":[0-9]*' | grep -o '[0-9]*')"
else
    echo "❌ Backend não está rodando"
    echo "💡 Execute em outro terminal: ./start_backend.sh"
fi

# 4. Testar frontend
echo ""
echo "4️⃣ Verificando frontend..."
if [ -f "salvo-landing/index.html" ]; then
    echo "✅ Landing page encontrada"
    if curl -s http://localhost:8005 > /dev/null 2>&1; then
        echo "✅ Frontend rodando na porta 8005"
    else
        echo "⚠️ Frontend não está rodando"
        echo "💡 Execute em outro terminal: ./start_frontend.sh"
    fi
else
    echo "❌ Landing page não encontrada"
fi

echo ""
echo "📋 INSTRUÇÕES PARA TESTAR:"
echo "=============================="
echo ""
echo "🖥️ Terminal 1 (Backend):"
echo "   ./start_backend.sh"
echo ""
echo "🖥️ Terminal 2 (Frontend):"  
echo "   ./start_frontend.sh"
echo ""
echo "🌐 Navegador:"
echo "   http://localhost:8005"
echo ""
echo "📊 Verificar dados salvos:"
echo "   cat data/sellers/sellers.json"
echo "   ls data/sellers/images/"
echo ""
echo "🔍 Monitorar backend:"
echo "   curl http://localhost:5000/health"
echo "   curl http://localhost:5000/api/stats"
echo ""
echo "💡 IMPORTANTE:"
echo "   - O backend DEVE rodar no ambiente virtual"
echo "   - Mantenha os dois terminais abertos"
echo "   - Teste fazendo um cadastro completo"
