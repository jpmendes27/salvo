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
