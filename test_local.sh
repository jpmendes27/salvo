#!/bin/bash

# Script para testar sistema localmente

echo "🧪 Testando sistema Salvô localmente..."
echo ""

echo "1️⃣ Verificando estrutura de dados..."
if [ -f "data/sellers/sellers.json" ]; then
    echo "✅ Arquivo sellers.json existe"
    echo "📊 Sellers cadastrados: $(cat data/sellers/sellers.json | grep -o '"id"' | wc -l)"
else
    echo "❌ Arquivo sellers.json não encontrado"
fi

if [ -d "data/sellers/images" ]; then
    echo "✅ Pasta de imagens existe"
    echo "🖼️ Imagens: $(ls data/sellers/images/ 2>/dev/null | wc -l)"
else
    echo "❌ Pasta de imagens não encontrada"
fi

echo ""
echo "2️⃣ Verificando backend Python..."

# Verificar se Flask está rodando
if curl -s http://localhost:5000/health > /dev/null 2>&1; then
    echo "✅ Backend Flask está rodando"
    echo "📊 Status: $(curl -s http://localhost:5000/health | grep -o '"status":"[^"]*"')"
else
    echo "❌ Backend Flask não está rodando"
    echo "💡 Execute: python app/main.py"
fi

echo ""
echo "3️⃣ Verificando landing page..."

# Verificar se landing page está acessível
if ls salvo-landing/index.html > /dev/null 2>&1; then
    echo "✅ Landing page encontrada"
    echo "💡 Execute: cd salvo-landing && python3 -m http.server 8005"
else
    echo "❌ Landing page não encontrada"
fi

echo ""
echo "📋 INSTRUÇÕES PARA TESTAR:"
echo "1. Terminal 1: python app/main.py (backend)"
echo "2. Terminal 2: cd salvo-landing && python3 -m http.server 8005"
echo "3. Navegador: http://localhost:8005"
echo "4. Faça um cadastro de teste"
echo "5. Verifique data/sellers/sellers.json"
