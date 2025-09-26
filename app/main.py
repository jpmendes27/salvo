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
