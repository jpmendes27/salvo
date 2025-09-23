"""
Salvô - WhatsApp Business Assistant
Aplicação principal para conectar clientes e comércios locais
"""

from flask import Flask
from app.config.settings import Config
from app.api.whatsapp.webhook import whatsapp_bp
from app.services.firebase.connection import initialize_firebase
import logging
from datetime import datetime

def create_app():
    """Factory pattern para criar a aplicação Flask"""
    app = Flask(__name__)
    app.config.from_object(Config)
    
    # Configurar logging
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        handlers=[
            logging.FileHandler('logs/salvo.log'),
            logging.StreamHandler()
        ]
    )
    
    # Inicializar Firebase
    initialize_firebase()
    
    # Registrar blueprints
    app.register_blueprint(whatsapp_bp, url_prefix='/api/whatsapp')
    
    @app.route('/')
    def home():
        return {
            'message': 'Salvô API está funcionando!',
            'timestamp': datetime.now().isoformat(),
            'version': '1.0.0-MVP'
        }
    
    @app.route('/health')
    def health_check():
        return {'status': 'healthy', 'service': 'salvo-api'}
    
    return app

if __name__ == '__main__':
    app = create_app()
    app.run(debug=True, host='0.0.0.0', port=5000)
