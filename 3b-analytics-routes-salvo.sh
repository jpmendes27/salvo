#!/bin/bash

# Script 3b: Sistema de Analytics - Rotas e Templates (Parte 1b)
# Autor: Sistema Analytics
# Data: 2025-09-26
# Descrição: Criação das rotas administrativas e templates

echo "📊 Iniciando criação das Rotas e Templates - Salvô (Parte 1b)..."

# Verificar se a parte 1a foi executada
if [ ! -f "app/services/analytics/data_collector.py" ]; then
    echo "❌ Execute primeiro: ./3a-analytics-data-salvo.sh"
    exit 1
fi

echo "✅ Serviços de dados verificados"

# Criar rotas administrativas
echo "🔧 Criando rotas administrativas..."
cat > app/api/analytics/admin_routes.py << 'EOF'
"""
Rotas Administrativas do Sistema de Analytics
"""

from flask import Blueprint, render_template, redirect, url_for, request, flash, jsonify
from app.services.analytics.auth import SimpleAuth
from app.services.analytics.data_processor import DataProcessor
import json
from pathlib import Path
from datetime import datetime

admin_bp = Blueprint('admin', __name__, url_prefix='/admin')
auth = SimpleAuth()
processor = DataProcessor()

@admin_bp.before_request
def require_admin():
    """Middleware para verificar autenticação admin"""
    if request.endpoint == 'admin.login':
        return
    
    if not auth.is_logged_in() or not auth.is_admin():
        return redirect(url_for('admin.login'))

@admin_bp.route('/login', methods=['GET', 'POST'])
def login():
    """Página de login administrativo"""
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')
        
        if auth.login(username, password, 'admin'):
            flash('Login realizado com sucesso!', 'success')
            return redirect(url_for('admin.dashboard'))
        else:
            flash('Credenciais inválidas!', 'error')
    
    return render_template('admin/login.html')

@admin_bp.route('/logout')
def logout():
    """Logout administrativo"""
    auth.logout()
    flash('Logout realizado com sucesso!', 'info')
    return redirect(url_for('admin.login'))

@admin_bp.route('/dashboard')
def dashboard():
    """Dashboard administrativo principal"""
    try:
        stats = processor.get_dashboard_stats()
        return render_template('admin/dashboard.html', stats=stats)
    except Exception as e:
        flash(f'Erro ao carregar dashboard: {e}', 'error')
        return render_template('admin/dashboard.html', stats={})

@admin_bp.route('/sellers')
def sellers():
    """Gerenciamento de sellers"""
    try:
        sellers_file = Path("data/sellers/sellers.json")
        sellers_data = {"sellers": []}
        
        if sellers_file.exists():
            with open(sellers_file, 'r', encoding='utf-8') as f:
                sellers_data = json.load(f)
        
        return render_template('admin/sellers.html', sellers=sellers_data.get('sellers', []))
    except Exception as e:
        flash(f'Erro ao carregar sellers: {e}', 'error')
        return render_template('admin/sellers.html', sellers=[])

@admin_bp.route('/api/stats')
def api_stats():
    """API para estatísticas em tempo real"""
    try:
        stats = processor.get_dashboard_stats()
        hourly_stats = processor.get_hourly_stats()
        
        return jsonify({
            'dashboard': stats,
            'hourly': hourly_stats,
            'timestamp': datetime.now().isoformat()
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500
EOF

# Criar template de login
echo "🎨 Criando template de login..."
cat > app/templates/admin/login.html << 'EOF'
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Salvô Admin - Login</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" rel="stylesheet">
    <style>
        body {
            background: linear-gradient(135deg, #25D366, #075E54);
            min-height: 100vh;
            display: flex;
            align-items: center;
        }
        .login-card {
            border: none;
            border-radius: 20px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
        }
        .btn-success {
            background: #25D366;
            border: none;
            border-radius: 10px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="row justify-content-center">
            <div class="col-md-5">
                <div class="card login-card">
                    <div class="card-body p-5">
                        <div class="text-center mb-4">
                            <i class="fas fa-chart-bar fa-3x text-success mb-3"></i>
                            <h3>Salvô Analytics</h3>
                            <p class="text-muted">Painel Administrativo</p>
                        </div>
                        
                        {% with messages = get_flashed_messages(with_categories=true) %}
                            {% if messages %}
                                {% for category, message in messages %}
                                    <div class="alert alert-{{ 'danger' if category == 'error' else category }} alert-dismissible fade show">
                                        {{ message }}
                                        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
                                    </div>
                                {% endfor %}
                            {% endif %}
                        {% endwith %}
                        
                        <form method="POST">
                            <div class="mb-3">
                                <label class="form-label">Usuário</label>
                                <div class="input-group">
                                    <span class="input-group-text"><i class="fas fa-user"></i></span>
                                    <input type="text" class="form-control" name="username" required>
                                </div>
                            </div>
                            <div class="mb-4">
                                <label class="form-label">Senha</label>
                                <div class="input-group">
                                    <span class="input-group-text"><i class="fas fa-lock"></i></span>
                                    <input type="password" class="form-control" name="password" required>
                                </div>
                            </div>
                            <button type="submit" class="btn btn-success w-100 py-2">
                                <i class="fas fa-sign-in-alt me-2"></i>Entrar
                            </button>
                        </form>
                        
                        <div class="text-center mt-4">
                            <small class="text-muted">
                                Salvô Analytics v1.0.0<br>
                                Sistema de Dados Monetizável
                            </small>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
</body>
</html>
EOF

# Criar template base para admin
echo "🎨 Criando template base..."
cat > app/templates/admin/base.html << 'EOF'
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{% block title %}Salvô Admin{% endblock %}</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" rel="stylesheet">
    <style>
        :root {
            --salvo-green: #25D366;
            --salvo-dark: #075E54;
        }
        body { background-color: #f8f9fa; }
        .navbar { background: var(--salvo-green) !important; }
        .card { border: none; border-radius: 15px; box-shadow: 0 5px 15px rgba(0,0,0,0.1); }
        .stat-card { background: linear-gradient(135deg, var(--salvo-green), var(--salvo-dark)); color: white; }
        .btn-success { background: var(--salvo-green); border: none; }
    </style>
</head>
<body>
    <nav class="navbar navbar-expand-lg navbar-dark">
        <div class="container-fluid">
            <a class="navbar-brand fw-bold" href="{{ url_for('admin.dashboard') }}">
                <i class="fas fa-chart-bar me-2"></i>Salvô Analytics
            </a>
            <div class="navbar-nav ms-auto">
                <a class="nav-link" href="{{ url_for('admin.dashboard') }}">
                    <i class="fas fa-tachometer-alt me-1"></i>Dashboard
                </a>
                <a class="nav-link" href="{{ url_for('admin.sellers') }}">
                    <i class="fas fa-store me-1"></i>Sellers
                </a>
                <a class="nav-link" href="{{ url_for('admin.logout') }}">
                    <i class="fas fa-sign-out-alt me-1"></i>Sair
                </a>
            </div>
        </div>
    </nav>

    <div class="container-fluid py-4">
        {% with messages = get_flashed_messages(with_categories=true) %}
            {% if messages %}
                {% for category, message in messages %}
                    <div class="alert alert-{{ 'danger' if category == 'error' else category }} alert-dismissible fade show">
                        {{ message }}
                        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
                    </div>
                {% endfor %}
            {% endif %}
        {% endwith %}

        {% block content %}{% endblock %}
    </div>

    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    {% block scripts %}{% endblock %}
</body>
</html>
EOF

# Atualizar main.py para incluir as rotas
echo "🔧 Atualizando main.py..."
# Fazer backup se ainda não existe
if [ ! -f "app/main.py.backup" ]; then
    cp app/main.py app/main.py.backup
fi

cat > app/main.py << 'EOF'
"""
Salvô - WhatsApp Business Assistant
Aplicação principal com Sistema de Analytics
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from flask import Flask
from datetime import datetime
import logging

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
    
    # Registrar blueprints
    try:
        from api.analytics.admin_routes import admin_bp
        app.register_blueprint(admin_bp)
        logging.info("✅ Blueprint analytics registrado")
    except ImportError as e:
        logging.warning(f"⚠️ Erro ao importar analytics: {e}")
    
    try:
        from api.whatsapp.webhook import whatsapp_bp
        app.register_blueprint(whatsapp_bp, url_prefix='/api/whatsapp')
        logging.info("✅ Blueprint WhatsApp registrado")
    except ImportError as e:
        logging.warning(f"⚠️ Erro ao importar WhatsApp: {e}")
    
    @app.route('/')
    def home():
        return {
            'message': 'Salvô API funcionando!',
            'timestamp': datetime.now().isoformat(),
            'version': '1.0.0-Analytics',
            'admin_panel': '/admin/login'
        }
    
    @app.route('/health')
    def health():
        return {'status': 'healthy', 'service': 'salvo-analytics'}
    
    return app

if __name__ == '__main__':
    app = create_app()
    print("🚀 Salvô Analytics iniciando...")
    print("🔐 Admin: http://localhost:5000/admin/login")
    print("👤 User: admin | Pass: salvo2025admin")
    app.run(debug=True, host='0.0.0.0', port=5000)
EOF

echo ""
echo "✅ PARTE 1b CONCLUÍDA!"
echo "🔧 Rotas administrativas criadas"
echo "🎨 Templates de login e base criados"
echo "🔧 main.py atualizado com imports corretos"
echo ""
echo "🚀 Execute a Parte 1c:"
echo "chmod +x 3c-analytics-dashboard-salvo.sh && ./3c-analytics-dashboard-salvo.sh"