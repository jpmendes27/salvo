#!/bin/bash

# Script para corrigir credenciais do admin
echo "🔐 Corrigindo credenciais do sistema..."

# Verificar arquivo de usuários atual
echo "📁 Verificando arquivo de usuários..."
if [ -f "data/users/clients.json" ]; then
    echo "✅ Arquivo encontrado, verificando conteúdo..."
    cat data/users/clients.json
else
    echo "❌ Arquivo não encontrado!"
fi

echo ""
echo "🔧 Criando novo arquivo de credenciais..."

# Recriar arquivo com credenciais corretas
cat > data/users/clients.json << 'EOF'
{
  "admin": {
    "username": "admin",
    "password": "salvo2025admin",
    "role": "admin",
    "created_at": "2025-09-26T14:30:00Z"
  },
  "clients": {}
}
EOF

echo "✅ Credenciais atualizadas!"
echo ""
echo "🔐 Credenciais do Admin:"
echo "   Usuário: admin"
echo "   Senha: salvo2025admin"
echo ""

# Verificar se o sistema está rodando
if pgrep -f "python.*main.py" > /dev/null; then
    echo "⚠️ Sistema está rodando. Reinicie para aplicar as mudanças:"
    echo "   1. Pressione Ctrl+C no terminal do servidor"
    echo "   2. Execute: ./start_analytics.sh"
else
    echo "🚀 Para iniciar o sistema:"
    echo "   ./start_analytics.sh"
fi

echo ""
echo "🌐 Depois acesse:"
echo "   http://localhost:5000/admin/login"
echo ""

# Também vamos verificar se existe algum problema na autenticação
echo "🧪 Testando se as rotas estão registradas..."
if [ -f "app/api/analytics/admin_routes.py" ]; then
    echo "✅ Arquivo de rotas existe"
    
    # Verificar se a função de login existe
    if grep -q "def login" app/api/analytics/admin_routes.py; then
        echo "✅ Função de login encontrada"
    else
        echo "❌ Função de login não encontrada"
    fi
    
    # Verificar se a autenticação está correta
    if grep -q "auth.login" app/api/analytics/admin_routes.py; then
        echo "✅ Chamada de autenticação encontrada"
    else
        echo "❌ Chamada de autenticação não encontrada"
    fi
else
    echo "❌ Arquivo de rotas não existe"
fi

echo ""
echo "📋 Debug: Conteúdo do arquivo de usuários criado:"
cat data/users/clients.json