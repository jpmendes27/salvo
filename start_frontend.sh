#!/bin/bash

echo "🌐 Iniciando Landing Page Salvô"
echo "==============================="
echo ""

# Verificar pasta
if [ ! -d "salvo-landing" ]; then
    echo "❌ Pasta salvo-landing não encontrada"
    echo "📂 Estrutura esperada:"
    echo "   ~/rafael2312/salvo/salvo-landing/"
    exit 1
fi

cd salvo-landing

echo "✅ Pasta da landing page encontrada"
echo ""
echo "🚀 Iniciando servidor web na porta 8005..."
echo "🌐 Landing page: http://localhost:8005"
echo "📱 Para testar cadastro: http://localhost:8005"
echo ""
echo "💡 Para parar: Ctrl+C"
echo "⚠️  IMPORTANTE: Backend deve estar rodando na porta 5000"
echo ""

# Verificar se backend está rodando
if curl -s http://localhost:5000/health > /dev/null 2>&1; then
    echo "✅ Backend detectado na porta 5000!"
else
    echo "⚠️  Backend não detectado na porta 5000"
    echo "💡 Execute ./start_backend.sh em outro terminal"
fi

echo ""

# Iniciar servidor
python3 -m http.server 8005
