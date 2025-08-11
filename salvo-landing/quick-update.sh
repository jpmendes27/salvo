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
