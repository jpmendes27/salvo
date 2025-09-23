"""
Salvô - WhatsApp Business Assistant
Aplicação principal para conectar clientes e comércios locais
+ Endpoints para Landing Page
"""

from flask import Flask, jsonify, request
from flask_cors import CORS
from app.config.settings import Config
import logging
from datetime import datetime
import json
import os
import time
from werkzeug.utils import secure_filename
import re

def create_app():
    """Factory pattern para criar a aplicação Flask"""
    app = Flask(__name__)
    app.config.from_object(Config)
    
    # Configurar CORS para permitir requisições da landing page
    CORS(app, origins=['http://localhost:8006', 'http://127.0.0.1:8006'])
    
    # Configurar logging
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        handlers=[
            logging.FileHandler('logs/salvo.log'),
            logging.StreamHandler()
        ]
    )
    
    # Configurações para upload
    UPLOAD_FOLDER = 'data/sellers/images'
    SELLERS_FILE = 'data/sellers/sellers.json'
    ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp'}
    MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB
    
    app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
    app.config['MAX_CONTENT_LENGTH'] = MAX_FILE_SIZE
    
    def allowed_file(filename):
        return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS
    
    def load_sellers():
        """Carregar sellers do JSON"""
        if not os.path.exists(SELLERS_FILE):
            return {'lastId': 0, 'sellers': [], 'metadata': {'created': datetime.now().isoformat()}}
        
        try:
            with open(SELLERS_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            logging.error(f"Erro ao carregar sellers: {e}")
            return {'lastId': 0, 'sellers': [], 'metadata': {'created': datetime.now().isoformat()}}
    
    def save_sellers(data):
        """Salvar sellers no JSON"""
        try:
            os.makedirs(os.path.dirname(SELLERS_FILE), exist_ok=True)
            with open(SELLERS_FILE, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            return True
        except Exception as e:
            logging.error(f"Erro ao salvar sellers: {e}")
            return False
    
    def validate_seller_data(data):
        """Validar dados do seller"""
        errors = []
        
        if not data.get('businessName') or len(data['businessName'].strip()) < 2:
            errors.append('Nome do negócio é obrigatório')
        
        if not data.get('category'):
            errors.append('Categoria é obrigatória')
        
        whatsapp = re.sub(r'\D', '', data.get('whatsapp', ''))
        if len(whatsapp) < 10:
            errors.append('WhatsApp é obrigatório')
        
        email = data.get('email', '').strip()
        if not email or '@' not in email:
            errors.append('E-mail é obrigatório')
        
        cep = re.sub(r'\D', '', data.get('cep', ''))
        if len(cep) != 8:
            errors.append('CEP é obrigatório')
        
        if not data.get('address') or len(data['address'].strip()) < 5:
            errors.append('Endereço é obrigatório')
        
        if not data.get('complement') or len(data['complement'].strip()) < 1:
            errors.append('Complemento é obrigatório')
        
        if not data.get('city') or len(data['city'].strip()) < 2:
            errors.append('Cidade é obrigatória')
        
        if not data.get('uf'):
            errors.append('UF é obrigatório')
        
        try:
            lat = float(data.get('latitude', 0))
            lng = float(data.get('longitude', 0))
            if lat == 0 or lng == 0:
                errors.append('Localização é obrigatória')
        except:
            errors.append('Localização inválida')
        
        return errors
    
    # ENDPOINTS PARA LANDING PAGE
    
    @app.route('/api/save_seller', methods=['POST', 'OPTIONS'])
    def save_seller():
        """Endpoint para salvar seller da landing page"""
        if request.method == 'OPTIONS':
            return '', 200
        
        try:
            logging.info("Recebendo novo seller da landing page")
            
            # Validar arquivo de imagem
            if 'logo' not in request.files:
                return jsonify({
                    'success': False,
                    'error': 'Imagem é obrigatória',
                    'message': 'Por favor, selecione uma imagem'
                }), 400
            
            file = request.files['logo']
            if file.filename == '':
                return jsonify({
                    'success': False,
                    'error': 'Nenhum arquivo selecionado',
                    'message': 'Por favor, selecione uma imagem'
                }), 400
            
            if not allowed_file(file.filename):
                return jsonify({
                    'success': False,
                    'error': 'Tipo de arquivo não permitido',
                    'message': 'Use apenas JPG, PNG, GIF ou WebP'
                }), 400
            
            # Coletar dados do formulário
            seller_data = {
                'businessName': request.form.get('businessName', '').strip(),
                'category': request.form.get('category', '').strip(),
                'whatsapp': request.form.get('whatsapp', '').strip(),
                'email': request.form.get('email', '').strip().lower(),
                'cep': request.form.get('cep', '').strip(),
                'address': request.form.get('address', '').strip(),
                'complement': request.form.get('complement', '').strip(),
                'city': request.form.get('city', '').strip(),
                'uf': request.form.get('uf', '').strip(),
                'latitude': request.form.get('latitude', '0'),
                'longitude': request.form.get('longitude', '0')
            }
            
            # Validar dados
            errors = validate_seller_data(seller_data)
            if errors:
                return jsonify({
                    'success': False,
                    'error': ', '.join(errors),
                    'message': f'Dados inválidos: {", ".join(errors)}'
                }), 400
            
            # Salvar imagem
            timestamp = int(time.time())
            safe_business_name = re.sub(r'[^a-zA-Z0-9]', '_', seller_data['businessName'])
            filename = f"{safe_business_name}_{timestamp}.{file.filename.rsplit('.', 1)[1].lower()}"
            
            os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
            file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
            file.save(file_path)
            
            # Carregar dados existentes
            sellers_db = load_sellers()
            
            # Criar novo seller
            new_seller = {
                'id': sellers_db['lastId'] + 1,
                'businessName': seller_data['businessName'],
                'category': seller_data['category'],
                'whatsapp': re.sub(r'\D', '', seller_data['whatsapp']),
                'email': seller_data['email'],
                'cep': re.sub(r'\D', '', seller_data['cep']),
                'address': seller_data['address'],
                'complement': seller_data['complement'],
                'city': seller_data['city'],
                'uf': seller_data['uf'],
                'latitude': float(seller_data['latitude']),
                'longitude': float(seller_data['longitude']),
                'logoFileName': filename,
                'logoUrl': f'data/sellers/images/{filename}',
                'createdAt': datetime.now().isoformat(),
                'updatedAt': datetime.now().isoformat(),
                'status': 'ativo',
                'source': 'landing_page'
            }
            
            # Adicionar ao banco
            sellers_db['lastId'] = new_seller['id']
            sellers_db['sellers'].append(new_seller)
            sellers_db['metadata']['lastUpdate'] = datetime.now().isoformat()
            
            # Salvar
            if not save_sellers(sellers_db):
                return jsonify({
                    'success': False,
                    'error': 'Erro ao salvar dados',
                    'message': 'Falha ao salvar no banco de dados'
                }), 500
            
            logging.info(f"Seller salvo com sucesso: ID {new_seller['id']}")
            
            return jsonify({
                'success': True,
                'id': new_seller['id'],
                'message': 'Negócio cadastrado com sucesso!',
                'seller': new_seller
            })
            
        except Exception as e:
            logging.error(f"Erro ao salvar seller: {e}")
            return jsonify({
                'success': False,
                'error': str(e),
                'message': 'Erro interno do servidor'
            }), 500
    
    @app.route('/api/list_sellers', methods=['GET'])
    def list_sellers():
        """Listar sellers"""
        try:
            sellers_db = load_sellers()
            
            # Filtros
            category = request.args.get('category', '')
            status = request.args.get('status', 'ativo')
            limit = int(request.args.get('limit', 10))
            
            sellers = sellers_db.get('sellers', [])
            
            # Aplicar filtros
            if status:
                sellers = [s for s in sellers if s.get('status') == status]
            
            if category:
                sellers = [s for s in sellers if s.get('category') == category]
            
            # Limitar
            sellers = sellers[:limit]
            
            return jsonify({
                'success': True,
                'sellers': sellers,
                'total': len(sellers)
            })
            
        except Exception as e:
            logging.error(f"Erro ao listar sellers: {e}")
            return jsonify({
                'success': False,
                'error': str(e)
            }), 500
    
    @app.route('/api/stats', methods=['GET'])
    def get_stats():
        """Estatísticas dos sellers"""
        try:
            sellers_db = load_sellers()
            sellers = sellers_db.get('sellers', [])
            
            stats = {
                'total': len(sellers),
                'ativo': len([s for s in sellers if s.get('status') == 'ativo']),
                'categorias': {}
            }
            
            for seller in sellers:
                if seller.get('status') == 'ativo':
                    cat = seller.get('category', 'Sem categoria')
                    stats['categorias'][cat] = stats['categorias'].get(cat, 0) + 1
            
            return jsonify({
                'success': True,
                'stats': stats
            })
            
        except Exception as e:
            logging.error(f"Erro ao obter estatísticas: {e}")
            return jsonify({
                'success': False,
                'error': str(e)
            }), 500
    
    # ENDPOINTS ORIGINAIS DO PROJETO
    
    @app.route('/')
    def home():
        return {
            'message': 'Salvô API está funcionando!',
            'timestamp': datetime.now().isoformat(),
            'version': '1.0.0-MVP',
            'services': {
                'landing_page_api': True,
                'whatsapp_integration': False,
                'business_matching': False
            }
        }
    
    @app.route('/health')
    def health_check():
        return {
            'status': 'healthy', 
            'service': 'salvo-api',
            'timestamp': datetime.now().isoformat(),
            'sellers_count': len(load_sellers().get('sellers', []))
        }
    
    return app

if __name__ == '__main__':
    app = create_app()
    app.run(debug=True, host='0.0.0.0', port=5000)
