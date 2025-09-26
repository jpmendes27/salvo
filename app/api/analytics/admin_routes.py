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

@admin_bp.route('/logs')
def logs():
    """Página de logs do sistema"""
    try:
        # Ler logs recentes
        log_content = ""
        log_count = 0
        
        log_file = "logs/salvo.log"
        if os.path.exists(log_file):
            with open(log_file, 'r', encoding='utf-8') as f:
                lines = f.readlines()
                log_content = ''.join(lines[-100:])  # Últimas 100 linhas
                log_count = len([line for line in lines if datetime.now().strftime('%Y-%m-%d') in line])
        
        return render_template('admin/logs.html', log_content=log_content, log_count=log_count)
    except Exception as e:
        flash(f'Erro ao carregar logs: {e}', 'error')
        return render_template('admin/logs.html', log_content='', log_count=0)

@admin_bp.route('/api/logs')
def api_logs():
    """API para logs em tempo real"""
    try:
        log_file = "logs/salvo.log"
        if os.path.exists(log_file):
            with open(log_file, 'r', encoding='utf-8') as f:
                lines = f.readlines()
                content = ''.join(lines[-50:])  # Últimas 50 linhas
        else:
            content = "Arquivo de log não encontrado"
        
        return jsonify({'content': content})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@admin_bp.route('/api/logs/clear', methods=['POST'])
def api_clear_logs():
    """API para limpar logs"""
    try:
        log_file = "logs/salvo.log"
        if os.path.exists(log_file):
            with open(log_file, 'w') as f:
                f.write("")
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500
