#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import json
import os
import sys
import shutil
from datetime import datetime
from pathlib import Path
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from werkzeug.utils import secure_filename

# Adicionar diretório raiz ao PYTHONPATH
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

app = Flask(__name__)
CORS(app)

# Configuração
DATA_DIR = project_root / "data"
SELLERS_FILE = DATA_DIR / "sellers" / "sellers.json"
CATEGORIES_FILE = DATA_DIR / "config" / "categories.json"
IMAGES_DIR = DATA_DIR / "sellers" / "images"

# Configurar upload de arquivos
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp'}
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def load_json_file(file_path):
    """Carrega arquivo JSON com fallback"""
    try:
        if file_path.exists():
            with open(file_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        return {}
    except Exception as e:
        print(f"❌ Erro ao carregar {file_path}: {e}")
        return {}

def save_json_file(file_path, data):
    """Salva arquivo JSON com backup"""
    try:
        # Criar backup se arquivo existir
        if file_path.exists():
            backup_path = file_path.with_suffix('.json.backup')
            with open(file_path, 'r', encoding='utf-8') as src:
                with open(backup_path, 'w', encoding='utf-8') as dst:
                    dst.write(src.read())
        
        # Salvar novo arquivo
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        return True
    except Exception as e:
        print(f"❌ Erro ao salvar {file_path}: {e}")
        return False

def whatsapp_exists(whatsapp, exclude_id=None):
    """Verificar se WhatsApp já existe"""
    sellers_data = load_json_file(SELLERS_FILE)
    sellers = sellers_data.get('sellers', [])
    
    clean_whatsapp = ''.join(filter(str.isdigit, whatsapp))
    
    for seller in sellers:
        if exclude_id and seller.get('id') == exclude_id:
            continue
        seller_whatsapp = ''.join(filter(str.isdigit, seller.get('whatsapp', '')))
        if seller_whatsapp == clean_whatsapp:
            return True
    return False

@app.route('/')
def health_check():
    """Health check da API"""
    return jsonify({
        'status': 'success',
        'service': 'Salvô Backend API',
        'version': '2.1.0',
        'database': 'JSON Local',
        'features': ['upload_images', 'geolocation', 'unique_whatsapp'],
        'timestamp': datetime.now().isoformat()
    })

@app.route('/api/health')
def api_health():
    """Health check detalhado"""
    sellers_data = load_json_file(SELLERS_FILE)
    categories_data = load_json_file(CATEGORIES_FILE)
    
    return jsonify({
        'status': 'healthy',
        'service': 'salvo-backend',
        'database': {
            'type': 'json_local',
            'sellers_count': len(sellers_data.get('sellers', [])),
            'categories_count': len(categories_data.get('categories', [])),
            'data_dir': str(DATA_DIR),
            'files_exist': {
                'sellers.json': SELLERS_FILE.exists(),
                'categories.json': CATEGORIES_FILE.exists(),
                'images_dir': IMAGES_DIR.exists()
            }
        },
        'timestamp': datetime.now().isoformat()
    })

@app.route('/api/categories', methods=['GET'])
def get_categories():
    """Retorna lista de categorias"""
    categories_data = load_json_file(CATEGORIES_FILE)
    return jsonify({
        'status': 'success',
        'categories': categories_data.get('categories', []),
        'total': len(categories_data.get('categories', []))
    })

@app.route('/api/sellers', methods=['GET'])
def get_sellers():
    """Retorna lista de sellers"""
    sellers_data = load_json_file(SELLERS_FILE)
    return jsonify({
        'status': 'success',
        'sellers': sellers_data.get('sellers', []),
        'total': len(sellers_data.get('sellers', [])),
        'lastId': sellers_data.get('lastId', 0)
    })

@app.route('/api/sellers', methods=['POST'])
def create_seller():
    """Criar novo seller com upload de imagem e validação"""
    try:
        # Verificar se é multipart (com arquivo) ou JSON
        if request.content_type and 'multipart/form-data' in request.content_type:
            # Dados do form + arquivo
            data = request.form.to_dict()
            file = request.files.get('logo')
        else:
            # Dados JSON
            data = request.get_json()
            file = None
        
        if not data:
            return jsonify({'status': 'error', 'message': 'Dados não fornecidos'}), 400
        
        # Validar campos obrigatórios
        required_fields = ['nome', 'categoria', 'whatsapp', 'email', 'cep', 'endereco', 'cidade', 'uf']
        missing_fields = [field for field in required_fields if not data.get(field)]
        
        if missing_fields:
            return jsonify({
                'status': 'error', 
                'message': f'Campos obrigatórios: {", ".join(missing_fields)}'
            }), 400
        
        # Validar WhatsApp único
        whatsapp = data.get('whatsapp', '').strip()
        if whatsapp_exists(whatsapp):
            return jsonify({
                'status': 'error',
                'message': 'Este WhatsApp já está cadastrado no sistema'
            }), 400
        
        # Carregar dados existentes
        sellers_data = load_json_file(SELLERS_FILE)
        
        # Incrementar ID
        new_id = sellers_data.get('lastId', 0) + 1
        sellers_data['lastId'] = new_id
        
        # Criar novo seller
        new_seller = {
            'id': new_id,
            'nome': data.get('nome', '').strip(),
            'categoria': data.get('categoria', '').strip(),
            'whatsapp': whatsapp,
            'email': data.get('email', '').strip(),
            'cep': data.get('cep', '').strip(),
            'endereco': data.get('endereco', '').strip(),
            'complemento': data.get('complemento', '').strip(),
            'cidade': data.get('cidade', '').strip(),
            'uf': data.get('uf', '').strip(),
            'created_at': datetime.now().isoformat(),
            'status': 'active',
            'source': 'landing_page'
        }
        
        # Adicionar geolocalização se fornecida
        if data.get('latitude') and data.get('longitude'):
            try:
                new_seller['latitude'] = float(data.get('latitude'))
                new_seller['longitude'] = float(data.get('longitude'))
            except (ValueError, TypeError):
                pass  # Ignorar se não for número válido
        
        # Upload de imagem se fornecida
        if file and file.filename and allowed_file(file.filename):
            # Garantir que diretório existe
            IMAGES_DIR.mkdir(parents=True, exist_ok=True)
            
            # Nome seguro do arquivo
            filename = secure_filename(file.filename)
            file_extension = filename.rsplit('.', 1)[1].lower()
            new_filename = f"seller_{new_id}.{file_extension}"
            
            # Salvar arquivo
            file_path = IMAGES_DIR / new_filename
            file.save(file_path)
            
            new_seller['logo'] = new_filename
            new_seller['logo_url'] = f"/api/images/{new_filename}"
            
            print(f"✅ Imagem salva: {file_path}")
        
        # Adicionar à lista
        if 'sellers' not in sellers_data:
            sellers_data['sellers'] = []
        
        sellers_data['sellers'].append(new_seller)
        
        # Atualizar metadata
        sellers_data['metadata'] = {
            'created': sellers_data.get('metadata', {}).get('created', datetime.now().isoformat()),
            'version': '1.0',
            'description': 'Banco de dados dos sellers do Salvô',
            'last_update': datetime.now().isoformat(),
            'total_sellers': len(sellers_data['sellers'])
        }
        
        # Salvar arquivo
        if save_json_file(SELLERS_FILE, sellers_data):
            return jsonify({
                'status': 'success',
                'message': 'Seller cadastrado com sucesso!',
                'seller_id': new_id,
                'data': new_seller
            }), 201
        else:
            return jsonify({
                'status': 'error', 
                'message': 'Erro ao salvar dados'
            }), 500
            
    except Exception as e:
        print(f"❌ Erro ao criar seller: {e}")
        return jsonify({
            'status': 'error',
            'message': f'Erro interno: {str(e)}'
        }), 500

@app.route('/api/sellers/<int:seller_id>', methods=['GET'])
def get_seller(seller_id):
    """Obter seller específico"""
    sellers_data = load_json_file(SELLERS_FILE)
    sellers = sellers_data.get('sellers', [])
    
    seller = next((s for s in sellers if s.get('id') == seller_id), None)
    
    if seller:
        return jsonify({
            'status': 'success',
            'seller': seller
        })
    else:
        return jsonify({
            'status': 'error',
            'message': 'Seller não encontrado'
        }), 404

@app.route('/api/images/<filename>')
def serve_image(filename):
    """Servir imagens dos sellers"""
    return send_from_directory(IMAGES_DIR, filename)

@app.route('/api/check_whatsapp', methods=['POST'])
def check_whatsapp():
    """Verificar se WhatsApp já existe"""
    data = request.get_json()
    whatsapp = data.get('whatsapp', '').strip()
    
    if not whatsapp:
        return jsonify({'exists': False})
    
    exists = whatsapp_exists(whatsapp)
    return jsonify({'exists': exists})

# Servir arquivos estáticos (para desenvolvimento)
@app.route('/data/<path:filename>')
def serve_data(filename):
    """Servir arquivos da pasta data"""
    return send_from_directory(DATA_DIR, filename)

if __name__ == '__main__':
    # Verificar se pasta data existe
    if not DATA_DIR.exists():
        print("❌ Pasta /data não encontrada!")
        sys.exit(1)
    
    # Garantir que diretório de imagens existe
    IMAGES_DIR.mkdir(parents=True, exist_ok=True)
    
    # Configurações
    host = os.getenv('FLASK_HOST', '127.0.0.1')
    port = int(os.getenv('FLASK_PORT', 5000))
    debug = os.getenv('FLASK_DEBUG', 'True').lower() == 'true'
    
    print(f"🚀 Iniciando Salvô Backend...")
    print(f"📡 Servidor: http://{host}:{port}")
    print(f"🗄️  Banco: JSON Local (/data)")
    print(f"📊 Sellers: {SELLERS_FILE}")
    print(f"📋 Categories: {CATEGORIES_FILE}")
    print(f"🖼️  Images: {IMAGES_DIR}")
    print(f"✨ Features: Upload, Geolocalização, WhatsApp único")
    
    app.run(host=host, port=port, debug=debug)
