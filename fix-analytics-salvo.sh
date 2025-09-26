#!/bin/bash

# Script de Correção - Sistema Analytics Salvô
# Corrige problemas de ambiente e importação

echo "🔧 Corrigindo problemas do Sistema Analytics..."

# 1. Criar ambiente virtual
echo "🐍 Criando ambiente virtual..."
python3 -m venv venv

# Ativar ambiente virtual
echo "✅ Ativando ambiente virtual..."
source venv/bin/activate

# 2. Instalar dependências no ambiente virtual
echo "📦 Instalando dependências no ambiente virtual..."
pip install Flask python-dotenv requests

# 3. Corrigir imports no main.py
echo "🔧 Corrigindo imports no main.py..."
cat > app/main.py << 'EOF'
"""
Salvô - WhatsApp Business Assistant
Aplicação principal com Sistema de Analytics
"""

from flask import Flask
from datetime import datetime
import logging
import os
import sys

# Adicionar diretório atual ao PYTHONPATH
current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(current_dir)
sys.path.insert(0, parent_dir)

def create_app():
    """Factory pattern para criar a aplicação Flask"""
    app = Flask(__name__)
    app.config['SECRET_KEY'] = 'dev-secret-key-salvo-2025-analytics'
    app.config['DEBUG'] = True
    
    # Configurar logging
    os.makedirs('logs', exist_ok=True)
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        handlers=[
            logging.FileHandler('logs/salvo.log'),
            logging.StreamHandler()
        ]
    )
    
    # Registrar blueprints com try/except mais específico
    try:
        from app.api.analytics.admin_routes import admin_bp
        app.register_blueprint(admin_bp)
        logging.info("✅ Blueprint analytics registrado")
    except Exception as e:
        logging.warning(f"⚠️ Analytics não carregado: {e}")
    
    try:
        from app.api.whatsapp.webhook import whatsapp_bp
        app.register_blueprint(whatsapp_bp, url_prefix='/api/whatsapp')
        logging.info("✅ Blueprint WhatsApp registrado")
    except Exception as e:
        logging.warning(f"⚠️ WhatsApp não carregado: {e}")
    
    @app.route('/')
    def home():
        return {
            'message': 'Salvô API funcionando!',
            'timestamp': datetime.now().isoformat(),
            'version': '1.0.0-Analytics',
            'admin_panel': '/admin/login',
            'status': 'Sistema corrigido'
        }
    
    @app.route('/health')
    def health():
        return {'status': 'healthy', 'service': 'salvo-analytics'}
    
    @app.route('/test')
    def test():
        return {
            'message': 'Sistema funcionando!',
            'blueprints': [rule.rule for rule in app.url_map.iter_rules()],
            'admin_available': '/admin/login' in [rule.rule for rule in app.url_map.iter_rules()]
        }
    
    return app

if __name__ == '__main__':
    app = create_app()
    print("🚀 Salvô Analytics iniciando...")
    print("🔐 Admin: http://localhost:5000/admin/login")
    print("🧪 Test: http://localhost:5000/test")
    print("👤 User: admin | Pass: salvo2025admin")
    app.run(debug=True, host='0.0.0.0', port=5000)
EOF

# 4. Corrigir estrutura de __init__.py files
echo "📁 Verificando estrutura de módulos..."

# Criar __init__.py files necessários
touch app/__init__.py
touch app/api/__init__.py
touch app/api/analytics/__init__.py
touch app/api/whatsapp/__init__.py
touch app/services/__init__.py
touch app/services/analytics/__init__.py

# 5. Criar script de inicialização correto
echo "🚀 Criando script de inicialização..."
cat > start_analytics.sh << 'EOF'
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
EOF

chmod +x start_analytics.sh

# 6. Testar se as rotas estão funcionando
echo "🧪 Verificando estrutura..."

if [ -f "app/api/analytics/admin_routes.py" ]; then
    echo "✅ Rotas analytics encontradas"
else
    echo "❌ Rotas analytics não encontradas"
fi

if [ -d "app/templates/admin" ]; then
    echo "✅ Templates admin encontrados"
else
    echo "❌ Templates admin não encontrados"
fi

echo ""
echo "🎉 ========================================"
echo "✅ CORREÇÕES APLICADAS!"
echo "========================================"
echo ""
echo "🚀 Para iniciar o sistema:"
echo "   ./start_analytics.sh"
echo ""
echo "🔗 URLs disponíveis:"
echo "   http://localhost:5000/         # Status"
echo "   http://localhost:5000/test     # Teste"
echo "   http://localhost:5000/admin/login  # Admin"
echo ""
echo "🔐 Credenciais:"
echo "   Usuário: admin"
echo "   Senha: salvo2025admin"
echo ""
echo "🐍 Ambiente virtual criado em: venv/"
echo "📦 Dependências instaladas localmente"