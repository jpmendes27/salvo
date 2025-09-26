#!/bin/bash

# =================================================================
# SCRIPT 2: INTEGRAÇÃO WHATSAPP BUSINESS API - PROJETO SALVÔ
# Parte 1: Configuração básica e estrutura
# Autor: Claude Assistant
# Data: 2025-09-26
# =================================================================

echo "🚀 INTEGRAÇÃO WHATSAPP BUSINESS API - PARTE 1"
echo "=============================================="

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Verificações iniciais
log_info "Verificando estrutura existente..."

if [ ! -f "app/main.py" ]; then
    log_error "app/main.py não encontrado!"
    exit 1
fi

if [ ! -f "data/sellers/sellers.json" ]; then
    log_error "data/sellers/sellers.json não encontrado!"
    exit 1
fi

log_success "Estrutura básica verificada!"

# =================================================================
# 1. ATUALIZAR REQUIREMENTS.TXT
# =================================================================

log_info "Atualizando requirements.txt com dependências WhatsApp..."

# Fazer backup do requirements atual
if [ -f "requirements.txt" ]; then
    cp requirements.txt requirements.txt.backup
    log_info "Backup do requirements.txt criado"
fi

# Adicionar novas dependências
cat >> requirements.txt << 'EOF'

# === WHATSAPP BUSINESS API ===
requests==2.31.0
cryptography==41.0.4

# === GEOLOCALIZAÇÃO ===
geopy==2.3.0
haversine==2.7.0

# === VALIDAÇÃO ===
phonenumbers==8.13.21
email-validator==2.0.0
jsonschema==4.19.0

# === LOGGING ===
structlog==23.1.0
EOF

log_success "Requirements.txt atualizado!"

# =================================================================
# 2. CRIAR ESTRUTURA DE DIRETÓRIOS
# =================================================================

log_info "Criando estrutura de diretórios WhatsApp..."

mkdir -p app/api/whatsapp
mkdir -p app/services/whatsapp  
mkdir -p app/services/search
mkdir -p app/utils

log_success "Estrutura de diretórios criada!"

# =================================================================
# 3. CRIAR WEBHOOK WHATSAPP
# =================================================================

log_info "Criando webhook WhatsApp..."

cat > app/api/whatsapp/webhook.py << 'EOF'
"""
Webhook do WhatsApp Business API - Salvô
"""

from flask import Blueprint, request, jsonify, current_app
import json
import logging
from app.services.whatsapp.message_processor import MessageProcessor

whatsapp_bp = Blueprint('whatsapp', __name__)
logger = logging.getLogger(__name__)

@whatsapp_bp.route('/webhook', methods=['GET'])
def verify_webhook():
    """Verificação do webhook pelo Facebook"""
    verify_token = request.args.get('hub.verify_token')
    challenge = request.args.get('hub.challenge')
    
    expected_token = current_app.config.get('WHATSAPP_VERIFY_TOKEN')
    
    if verify_token == expected_token:
        logger.info("✅ Webhook verificado com sucesso")
        return challenge
    else:
        logger.error("❌ Token de verificação inválido")
        return "Token inválido", 403

@whatsapp_bp.route('/webhook', methods=['POST'])
def handle_webhook():
    """Processa mensagens recebidas do WhatsApp"""
    try:
        data = request.get_json()
        logger.info(f"📨 Mensagem recebida: {json.dumps(data, indent=2)}")
        
        if not data:
            return jsonify({"error": "No data received"}), 400
        
        # Verificar se é uma mensagem válida
        if 'entry' not in data:
            return jsonify({"status": "no_entry"}), 200
            
        for entry in data['entry']:
            if 'changes' not in entry:
                continue
                
            for change in entry['changes']:
                if change.get('field') == 'messages':
                    message_data = change.get('value', {})
                    if 'messages' in message_data:
                        processor = MessageProcessor()
                        processor.process_messages(message_data['messages'])
        
        return jsonify({"status": "success"}), 200
        
    except Exception as e:
        logger.error(f"❌ Erro no webhook: {str(e)}")
        return jsonify({"error": str(e)}), 500

@whatsapp_bp.route('/test', methods=['POST'])
def test_send():
    """Endpoint de teste para enviar mensagens"""
    try:
        data = request.get_json()
        phone = data.get('phone')
        message = data.get('message')
        
        if not phone or not message:
            return jsonify({"error": "Phone and message required"}), 400
        
        from app.services.whatsapp.sender import WhatsAppSender
        sender = WhatsAppSender()
        result = sender.send_text_message(phone, message)
        
        return jsonify(result), 200
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500
EOF

# =================================================================
# 4. CRIAR ARQUIVO __INIT__ PARA WHATSAPP
# =================================================================

cat > app/api/whatsapp/__init__.py << 'EOF'
"""
API WhatsApp do Salvô
"""
from .webhook import whatsapp_bp

__all__ = ['whatsapp_bp']
EOF

# =================================================================
# 5. ATUALIZAR APP/MAIN.PY
# =================================================================

log_info "Atualizando app/main.py para incluir WhatsApp..."

# Fazer backup do main.py atual
cp app/main.py app/main.py.backup
log_info "Backup do main.py criado"

cat > app/main.py << 'EOF'
"""
Salvô - WhatsApp Business Assistant
Aplicação principal atualizada com integração WhatsApp
"""

from flask import Flask, jsonify
import logging
import os
from datetime import datetime

def create_app():
    """Factory pattern para criar a aplicação Flask"""
    app = Flask(__name__)
    
    # Configurações básicas
    app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'dev-secret-key-salvo-2025')
    app.config['DEBUG'] = os.getenv('DEBUG', 'True').lower() == 'true'
    
    # Configurações WhatsApp
    app.config['WHATSAPP_TOKEN'] = os.getenv('WHATSAPP_TOKEN')
    app.config['WHATSAPP_VERIFY_TOKEN'] = os.getenv('WHATSAPP_VERIFY_TOKEN', 'salvo-verify-token')
    app.config['WHATSAPP_PHONE_NUMBER_ID'] = os.getenv('WHATSAPP_PHONE_NUMBER_ID')
    
    # Configurar logging
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        handlers=[
            logging.FileHandler('logs/salvo.log') if os.path.exists('logs') else logging.NullHandler(),
            logging.StreamHandler()
        ]
    )
    
    logger = logging.getLogger(__name__)
    
    # Criar diretório de logs se não existir
    os.makedirs('logs', exist_ok=True)
    
    # Registrar blueprints WhatsApp
    try:
        from app.api.whatsapp.webhook import whatsapp_bp
        app.register_blueprint(whatsapp_bp, url_prefix='/api/whatsapp')
        logger.info("✅ Blueprint WhatsApp registrado")
    except ImportError as e:
        logger.warning(f"⚠️ Erro ao importar WhatsApp blueprint: {e}")
    
    @app.route('/')
    def home():
        return {
            'message': 'Salvô API funcionando!',
            'timestamp': datetime.now().isoformat(),
            'version': '2.0.0-WhatsApp',
            'status': 'active',
            'integrations': {
                'whatsapp': bool(app.config.get('WHATSAPP_TOKEN')),
                'sellers_db': os.path.exists('data/sellers/sellers.json')
            }
        }
    
    @app.route('/health')
    def health_check():
        return jsonify({
            'status': 'healthy', 
            'service': 'salvo-api',
            'whatsapp_configured': bool(app.config.get('WHATSAPP_TOKEN'))
        })
    
    @app.route('/api/status')
    def api_status():
        """Status detalhado da API"""
        return jsonify({
            'api_version': '2.0.0',
            'whatsapp_integration': 'active',
            'endpoints': {
                'webhook_verify': '/api/whatsapp/webhook [GET]',
                'webhook_receive': '/api/whatsapp/webhook [POST]', 
                'test_message': '/api/whatsapp/test [POST]'
            },
            'database': {
                'sellers_file': 'data/sellers/sellers.json',
                'exists': os.path.exists('data/sellers/sellers.json')
            }
        })
    
    return app

if __name__ == '__main__':
    app = create_app()
    
    print("🚀 Salvô API iniciando...")
    print("📱 WhatsApp Business API integrado!")
    print("🌐 Servidor disponível em: http://localhost:5000")
    print("📋 Endpoints WhatsApp:")
    print("   GET  /api/whatsapp/webhook - Verificação")
    print("   POST /api/whatsapp/webhook - Receber mensagens") 
    print("   POST /api/whatsapp/test - Teste de envio")
    print("")
    
    app.run(debug=True, host='0.0.0.0', port=5000)
EOF

log_success "app/main.py atualizado com integração WhatsApp!"

# =================================================================
# 6. ATUALIZAR .ENV.EXAMPLE
# =================================================================

log_info "Atualizando .env.example..."

cat >> .env.example << 'EOF'

# === WHATSAPP BUSINESS API ===
WHATSAPP_TOKEN=your-whatsapp-access-token-here
WHATSAPP_VERIFY_TOKEN=salvo-verify-token-2025
WHATSAPP_PHONE_NUMBER_ID=your-phone-number-id

# === CONFIGURAÇÕES DE BUSCA ===
MAX_SEARCH_RADIUS_KM=5
MAX_RESULTS_PER_SEARCH=3
EOF

log_success ".env.example atualizado!"

# =================================================================
# FINALIZAÇÃO PARTE 1
# =================================================================

echo ""
echo "✅ PARTE 1 CONCLUÍDA COM SUCESSO!"
echo "=================================="
echo ""
echo "📦 O que foi criado:"
echo "   ✅ requirements.txt atualizado"
echo "   ✅ Estrutura de diretórios WhatsApp"
echo "   ✅ Webhook básico (/api/whatsapp/webhook)"
echo "   ✅ app/main.py atualizado"
echo "   ✅ .env.example com tokens WhatsApp"
echo ""
echo "🔧 Configuração necessária:"
echo "   1. Copie .env.example para .env"
echo "   2. Configure seus tokens WhatsApp no .env:"
echo "      - WHATSAPP_TOKEN"
echo "      - WHATSAPP_PHONE_NUMBER_ID"
echo ""
echo "🚀 Próximo passo:"
echo "   ./2a-processador-mensagens-salvo.sh"
echo ""
echo "💡 Para testar o webhook agora:"
echo "   python app/main.py"
echo "   Acesse: http://localhost:5000/api/status"
echo ""