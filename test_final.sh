#!/bin/bash

echo "⚡ Teste Final do Sistema"
echo "========================"
echo ""

# Testar Flask
echo "1️⃣ Testando Flask..."
if python3 -c "import flask" 2>/dev/null; then
    echo "✅ Flask instalado e funcionando"
    python3 -c "import flask; print(f'   Versão: {flask.__version__}')"
else
    echo "❌ Flask não encontrado"
    echo "💡 Execute: ./1k-simple-solution.sh"
    exit 1
fi

# Testar estrutura
echo ""
echo "2️⃣ Testando estrutura de dados..."
if [ -f "data/sellers/sellers.json" ]; then
    echo "✅ Banco de dados encontrado"
    echo "📊 Sellers: $(cat data/sellers/sellers.json | grep -o '"id"' | wc -l)"
else
    echo "⚠️  Banco será criado automaticamente no primeiro cadastro"
fi

if [ -d "data/sellers/images" ]; then
    echo "✅ Pasta de imagens encontrada"
    echo "🖼️  Imagens: $(ls data/sellers/images/ 2>/dev/null | wc -l)"
else
    echo "⚠️  Pasta de imagens será criada automaticamente"
fi

# Testar backend
echo ""
echo "3️⃣ Testando backend..."
if curl -s http://localhost:5000/health > /dev/null 2>&1; then
    echo "✅ Backend rodando!"
    echo "📊 $(curl -s http://localhost:5000/health | grep -o '"status":"[^"]*"')"
    SELLERS_COUNT=$(curl -s http://localhost:5000/health | grep -o '"sellers_count":[0-9]*' | grep -o '[0-9]*')
    echo "👥 Sellers cadastrados: ${SELLERS_COUNT:-0}"
else
    echo "⚠️  Backend não está rodando"
    echo "💡 Execute: ./start_backend.sh"
fi

# Testar frontend
echo ""
echo "4️⃣ Testando frontend..."
if [ -f "salvo-landing/index.html" ]; then
    echo "✅ Landing page encontrada"
    if curl -s http://localhost:8005 > /dev/null 2>&1; then
        echo "✅ Frontend rodando na porta 8005"
    else
        echo "⚠️  Frontend não está rodando"
        echo "💡 Execute: ./start_frontend.sh"
    fi
else
    echo "❌ Landing page não encontrada em salvo-landing/"
fi

echo ""
echo "📋 INSTRUÇÕES:"
echo "============="
echo "1. ./start_backend.sh (Terminal 1)"
echo "2. ./start_frontend.sh (Terminal 2)"
echo "3. http://localhost:8005 (Navegador)"
echo "4. Fazer cadastro completo de teste"
echo "5. Verificar dados: cat data/sellers/sellers.json"
