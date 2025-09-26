#!/bin/bash

# Script para debugar e corrigir problema de autenticação
echo "🔍 Debugando problema de autenticação..."

# 1. Verificar logs detalhados
echo "📋 Adicionando logs detalhados no sistema..."

# Corrigir o arquivo de autenticação
cat > app/services/analytics/auth.py << 'EOF'
"""
Sistema de Autenticação Simples para Analytics
"""

import json
from pathlib import Path
from flask import session
import logging

logger = logging.getLogger(__name__)

class SimpleAuth:
    """Sistema de autenticação simples baseado em sessões Flask"""
    
    def __init__(self):
        self.users_file = Path("data/users/clients.json")
    
    def login(self, username, password, user_type="admin"):
        """
        Realiza login do usuário
        """
        try:
            logger.info(f"Tentativa de login: username={username}, user_type={user_type}")
            
            users_data = self._load_users()
            logger.info(f"Dados carregados: {users_data}")
            
            if user_type == "admin":
                admin_data = users_data.get("admin", {})
                logger.info(f"Admin data: {admin_data}")
                
                admin_username = admin_data.get("username")
                admin_password = admin_data.get("password")
                
                logger.info(f"Comparando: '{username}' == '{admin_username}' and '{password}' == '{admin_password}'")
                
                if admin_username == username and admin_password == password:
                    session["user_id"] = username
                    session["user_type"] = "admin"
                    session["logged_in"] = True
                    logger.info(f"✅ Login admin bem-sucedido: {username}")
                    return True
                else:
                    logger.error(f"❌ Credenciais incorretas - Username match: {admin_username == username}, Password match: {admin_password == password}")
            
            elif user_type == "client":
                clients = users_data.get("clients", {})
                for client_id, client_data in clients.items():
                    if client_data.get("username") == username and client_data.get("password") == password:
                        session["user_id"] = client_id
                        session["user_type"] = "client"
                        session["logged_in"] = True
                        session["plan"] = client_data.get("plan", "basic")
                        logger.info(f"✅ Login cliente bem-sucedido: {username}")
                        return True
            
            logger.error(f"❌ Login falhou para: {username}")
            return False
            
        except Exception as e:
            logger.error(f"❌ Erro no login: {e}")
            return False
    
    def logout(self):
        """Realiza logout do usuário"""
        session.clear()
        logger.info("✅ Logout realizado")
    
    def is_logged_in(self):
        """Verifica se usuário está logado"""
        logged_in = session.get("logged_in", False)
        logger.info(f"Verificação de login: {logged_in}")
        return logged_in
    
    def is_admin(self):
        """Verifica se usuário é admin"""
        is_admin = session.get("user_type") == "admin"
        logger.info(f"Verificação de admin: {is_admin}")
        return is_admin
    
    def is_client(self):
        """Verifica se usuário é cliente"""
        return session.get("user_type") == "client"
    
    def get_user_plan(self):
        """Retorna plano do cliente"""
        return session.get("plan", "basic")
    
    def _load_users(self):
        """Carrega dados de usuários"""
        try:
            if self.users_file.exists():
                with open(self.users_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    logger.info(f"✅ Arquivo de usuários carregado: {self.users_file}")
                    return data
        except Exception as e:
            logger.error(f"❌ Erro ao carregar usuários: {e}")
        
        logger.warning("⚠️ Retornando estrutura de usuários vazia")
        return {"admin": {}, "clients": {}}
EOF

# 2. Corrigir as rotas admin com mais logs
echo "🔧 Corrigindo rotas admin com logs detalhados..."

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
import logging

logger = logging.getLogger(__name__)

admin_bp = Blueprint('admin', __name__, url_prefix='/admin')
auth = SimpleAuth()
processor = DataProcessor()

@admin_bp.before_request
def require_admin():
    """Middleware para verificar autenticação admin"""
    logger.info(f"🔍 Before request: {request.endpoint}")
    
    if request.endpoint == 'admin.login':
        return
    
    if not auth.is_logged_in() or not auth.is_admin():
        logger.warning(f"⚠️ Acesso negado - redirecionando para login")
        return redirect(url_for('admin.login'))

@admin_bp.route('/login', methods=['GET', 'POST'])
def login():
    """Página de login administrativo"""
    logger.info(f"📝 Login route - Method: {request.method}")
    
    if request.method == 'POST':
        username = request.form.get('username', '').strip()
        password = request.form.get('password', '').strip()
        
        logger.info(f"🔐 Tentativa de login: username='{username}', password_length={len(password)}")
        
        if auth.login(username, password, 'admin'):
            flash('Login realizado com sucesso!', 'success')
            logger.info(f"✅ Login bem-sucedido - redirecionando para dashboard")
            return redirect(url_for('admin.dashboard'))
        else:
            flash('Credenciais inválidas!', 'error')
            logger.error(f"❌ Login falhou para username: '{username}'")
    
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
    logger.info("📊 Acessando dashboard")
    try:
        stats = processor.get_dashboard_stats()
        return render_template('admin/dashboard.html', stats=stats)
    except Exception as e:
        logger.error(f"❌ Erro no dashboard: {e}")
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

@admin_bp.route('/test-auth')
def test_auth():
    """Endpoint para testar autenticação"""
    return jsonify({
        'logged_in': auth.is_logged_in(),
        'is_admin': auth.is_admin(),
        'session': dict(request.args),
        'user_file_exists': Path("data/users/clients.json").exists()
    })
EOF

echo "✅ Arquivos corrigidos com logs detalhados"
echo ""
echo "🔧 Para testar:"
echo "   1. Pare o servidor (Ctrl+C)"
echo "   2. Execute: ./start_analytics.sh"
echo "   3. Tente fazer login novamente"
echo "   4. Verifique os logs no terminal"
echo ""
echo "🧪 Endpoints de debug:"
echo "   http://localhost:5000/admin/test-auth"
echo ""
echo "🔐 Use exatamente:"
echo "   Username: admin"
echo "   Password: salvo2025admin"