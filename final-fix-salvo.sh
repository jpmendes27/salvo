#!/bin/bash

# Script final para corrigir o problema do caminho dos arquivos
echo "🔧 CORREÇÃO FINAL - Problema de caminho identificado!"

# Problema: Sistema roda de app/ mas arquivos estão em data/
# Solução: Corrigir caminhos relativos

echo "📁 Corrigindo caminhos nos arquivos..."

# 1. Corrigir auth.py com caminho absoluto
cat > app/services/analytics/auth.py << 'EOF'
"""
Sistema de Autenticação Simples para Analytics
"""

import json
import os
from pathlib import Path
from flask import session
import logging

logger = logging.getLogger(__name__)

class SimpleAuth:
    """Sistema de autenticação simples baseado em sessões Flask"""
    
    def __init__(self):
        # Corrigir caminho - voltar para raiz do projeto
        current_dir = os.path.dirname(os.path.abspath(__file__))
        project_root = os.path.dirname(os.path.dirname(os.path.dirname(current_dir)))
        self.users_file = os.path.join(project_root, "data", "users", "clients.json")
        logger.info(f"📁 Caminho do arquivo de usuários: {self.users_file}")
    
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
            logger.info(f"🔍 Tentando carregar arquivo: {self.users_file}")
            logger.info(f"📁 Arquivo existe? {os.path.exists(self.users_file)}")
            
            if os.path.exists(self.users_file):
                with open(self.users_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    logger.info(f"✅ Arquivo de usuários carregado com sucesso!")
                    logger.info(f"📄 Conteúdo: {data}")
                    return data
            else:
                logger.error(f"❌ Arquivo não encontrado: {self.users_file}")
                
        except Exception as e:
            logger.error(f"❌ Erro ao carregar usuários: {e}")
        
        logger.warning("⚠️ Retornando estrutura de usuários vazia")
        return {"admin": {}, "clients": {}}
EOF

# 2. Corrigir data_processor.py com caminhos corretos
cat > app/services/analytics/data_processor.py << 'EOF'
"""
Data Processor - Processamento e agregação de dados analytics
"""

import json
import os
from datetime import datetime, timedelta
from collections import defaultdict, Counter
import logging

logger = logging.getLogger(__name__)

class DataProcessor:
    """Processa e agrega dados de analytics para relatórios"""
    
    def __init__(self):
        # Corrigir caminhos
        current_dir = os.path.dirname(os.path.abspath(__file__))
        project_root = os.path.dirname(os.path.dirname(os.path.dirname(current_dir)))
        self.analytics_file = os.path.join(project_root, "data", "analytics", "interactions.json")
        self.daily_stats_file = os.path.join(project_root, "data", "analytics", "daily_stats.json")
    
    def get_dashboard_stats(self):
        """Retorna estatísticas para o dashboard administrativo"""
        try:
            analytics_data = self._load_analytics_data()
            interactions = analytics_data.get("interactions", [])
            
            if not interactions:
                return self._empty_stats()
            
            now = datetime.now()
            today = now.strftime('%Y-%m-%d')
            week_ago = (now - timedelta(days=7)).strftime('%Y-%m-%d')
            
            # Estatísticas básicas
            total_interactions = len(interactions)
            interactions_today = len([i for i in interactions if i.get('timestamp', '').startswith(today)])
            interactions_week = len([i for i in interactions if i.get('timestamp', '')[:10] >= week_ago])
            
            # Top termos de busca
            search_terms = [i.get('search_term', '').lower() for i in interactions if i.get('search_term')]
            top_searches = Counter(search_terms).most_common(5)
            
            # Cidades mais ativas
            cities = [i.get('city', '') for i in interactions if i.get('city')]
            top_cities = Counter(cities).most_common(5)
            
            # Distribuição por hora
            hours = [i.get('hour', 0) for i in interactions]
            hour_distribution = Counter(hours)
            
            return {
                'total_interactions': total_interactions,
                'interactions_today': interactions_today,
                'interactions_week': interactions_week,
                'top_searches': top_searches,
                'top_cities': top_cities,
                'hour_distribution': dict(hour_distribution),
                'last_update': analytics_data.get('metadata', {}).get('last_update', '')
            }
            
        except Exception as e:
            logger.error(f"Erro ao processar estatísticas do dashboard: {e}")
            return self._empty_stats()
    
    def get_hourly_stats(self, days=7):
        """Retorna estatísticas por hora dos últimos N dias"""
        try:
            analytics_data = self._load_analytics_data()
            interactions = analytics_data.get("interactions", [])
            
            cutoff_date = (datetime.now() - timedelta(days=days)).strftime('%Y-%m-%d')
            recent_interactions = [
                i for i in interactions 
                if i.get('timestamp', '')[:10] >= cutoff_date
            ]
            
            hourly_data = defaultdict(int)
            for interaction in recent_interactions:
                hour = interaction.get('hour', 0)
                hourly_data[hour] += 1
            
            # Garantir que todas as horas estejam representadas
            for hour in range(24):
                if hour not in hourly_data:
                    hourly_data[hour] = 0
            
            return dict(hourly_data)
            
        except Exception as e:
            logger.error(f"Erro ao processar estatísticas horárias: {e}")
            return {}
    
    def _load_analytics_data(self):
        """Carrega dados de analytics"""
        try:
            if os.path.exists(self.analytics_file):
                with open(self.analytics_file, 'r', encoding='utf-8') as f:
                    return json.load(f)
        except Exception as e:
            logger.error(f"Erro ao carregar dados de analytics: {e}")
        
        return {"metadata": {}, "interactions": []}
    
    def _empty_stats(self):
        """Retorna estatísticas vazias"""
        return {
            'total_interactions': 0,
            'interactions_today': 0,
            'interactions_week': 0,
            'top_searches': [],
            'top_cities': [],
            'hour_distribution': {},
            'last_update': ''
        }
EOF

# 3. Corrigir admin_routes.py com caminhos corretos
cat > app/api/analytics/admin_routes.py << 'EOF'
"""
Rotas Administrativas do Sistema de Analytics
"""

from flask import Blueprint, render_template, redirect, url_for, request, flash, jsonify
from app.services.analytics.auth import SimpleAuth
from app.services.analytics.data_processor import DataProcessor
import json
import os
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
        # Corrigir caminho
        current_dir = os.path.dirname(os.path.abspath(__file__))
        project_root = os.path.dirname(os.path.dirname(os.path.dirname(current_dir)))
        sellers_file = os.path.join(project_root, "data", "sellers", "sellers.json")
        
        sellers_data = {"sellers": []}
        
        if os.path.exists(sellers_file):
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
    current_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(os.path.dirname(os.path.dirname(current_dir)))
    users_file = os.path.join(project_root, "data", "users", "clients.json")
    
    return jsonify({
        'logged_in': auth.is_logged_in(),
        'is_admin': auth.is_admin(),
        'user_file_path': users_file,
        'user_file_exists': os.path.exists(users_file),
        'current_dir': current_dir,
        'project_root': project_root
    })
EOF

echo "✅ Caminhos corrigidos!"
echo ""
echo "📋 Verificando estrutura de arquivos..."

# Verificar se os arquivos existem
if [ -f "data/users/clients.json" ]; then
    echo "✅ data/users/clients.json existe"
    echo "📄 Conteúdo:"
    cat data/users/clients.json
else
    echo "❌ data/users/clients.json NÃO existe"
    echo "🔧 Recriando arquivo..."
    mkdir -p data/users
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
    echo "✅ Arquivo criado!"
fi

echo ""
echo "🎉 CORREÇÃO FINAL APLICADA!"
echo ""
echo "🔧 Para testar:"
echo "   1. Pare o servidor (Ctrl+C)"
echo "   2. Execute: ./start_analytics.sh"
echo "   3. Acesse: http://localhost:5000/admin/test-auth (para debug)"
echo "   4. Acesse: http://localhost:5000/admin/login"
echo ""
echo "🔐 Credenciais:"
echo "   Username: admin"
echo "   Password: salvo2025admin"