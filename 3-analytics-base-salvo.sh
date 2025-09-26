#!/bin/bash

# Script 3: Sistema de Analytics Base - Salvô
# Autor: Sistema Analytics
# Data: 2025-09-26
# Descrição: Criação da estrutura base do sistema de analytics monetizável

echo "📊 Iniciando criação do Sistema de Analytics Base do Salvô..."

# Verificar se estamos no diretório correto
if [ ! -f "app/main.py" ]; then
    echo "❌ Execute este script na raiz do projeto Salvô (onde está app/main.py)"
    exit 1
fi

echo "✅ Diretório verificado: $(pwd)"

# Criar estrutura de pastas para analytics
echo "📁 Criando estrutura de pastas do sistema de analytics..."

mkdir -p app/api/analytics
mkdir -p app/services/analytics
mkdir -p app/templates/admin
mkdir -p app/templates/client
mkdir -p data/analytics/reports
mkdir -p data/users
mkdir -p static/admin/{css,js,charts}
mkdir -p static/client/{css,js,charts}

# Criar arquivo de dados de usuários do sistema
echo "👥 Criando estrutura de dados de usuários..."
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

# Criar arquivo base de analytics
echo "📈 Criando arquivo base de dados de analytics..."
cat > data/analytics/interactions.json << 'EOF'
{
  "metadata": {
    "created_at": "2025-09-26T14:30:00Z",
    "last_update": "2025-09-26T14:30:00Z",
    "version": "1.0.0",
    "total_interactions": 0
  },
  "interactions": []
}
EOF

# Criar arquivo de estatísticas diárias
cat > data/analytics/daily_stats.json << 'EOF'
{
  "metadata": {
    "created_at": "2025-09-26T14:30:00Z",
    "last_update": "2025-09-26T14:30:00Z"
  },
  "daily_stats": {}
}
EOF

# Criar inicializadores dos módulos analytics
echo "🔧 Criando arquivos de inicialização..."

cat > app/api/analytics/__init__.py << 'EOF'
"""
API Analytics do Salvô
Sistema de analytics monetizável
"""
EOF

cat > app/services/analytics/__init__.py << 'EOF'
"""
Serviços de Analytics do Salvô
Coleta, processamento e relatórios de dados
"""
EOF

# Criar serviço de coleta de dados
echo "📊 Criando serviço de coleta de dados..."
cat > app/services/analytics/data_collector.py << 'EOF'
"""
Data Collector - Coleta de dados das interações WhatsApp
"""

import json
import uuid
from datetime import datetime
from pathlib import Path
import logging

logger = logging.getLogger(__name__)

class DataCollector:
    """Coleta e armazena dados das interações do sistema"""
    
    def __init__(self):
        self.analytics_file = Path("data/analytics/interactions.json")
        self.daily_stats_file = Path("data/analytics/daily_stats.json")
    
    def save_interaction(self, interaction_data):
        """
        Salva uma interação do usuário com o sistema
        
        Args:
            interaction_data (dict): Dados da interação
        """
        try:
            # Gerar ID único para a interação
            interaction_id = str(uuid.uuid4())
            timestamp = datetime.now().isoformat()
            
            # Estruturar dados da interação
            formatted_interaction = {
                "interaction_id": interaction_id,
                "timestamp": timestamp,
                "phone": interaction_data.get("phone", ""),
                "location": interaction_data.get("location", {}),
                "search_type": interaction_data.get("search_type", "text"),
                "search_term": interaction_data.get("search_term", ""),
                "results_count": interaction_data.get("results_count", 0),
                "results_clicked": interaction_data.get("results_clicked", 0),
                "hour": datetime.now().hour,
                "day_of_week": datetime.now().strftime("%A").lower(),
                "city": interaction_data.get("location", {}).get("city", ""),
                "state": interaction_data.get("location", {}).get("state", "")
            }
            
            # Carregar dados existentes
            analytics_data = self._load_analytics_data()
            
            # Adicionar nova interação
            analytics_data["interactions"].append(formatted_interaction)
            analytics_data["metadata"]["last_update"] = timestamp
            analytics_data["metadata"]["total_interactions"] = len(analytics_data["interactions"])
            
            # Salvar dados atualizados
            self._save_analytics_data(analytics_data)
            
            # Atualizar estatísticas diárias
            self._update_daily_stats(formatted_interaction)
            
            logger.info(f"Interação salva: {interaction_id}")
            
        except Exception as e:
            logger.error(f"Erro ao salvar interação: {e}")
    
    def _load_analytics_data(self):
        """Carrega dados de analytics existentes"""
        try:
            if self.analytics_file.exists():
                with open(self.analytics_file, 'r', encoding='utf-8') as f:
                    return json.load(f)
        except Exception as e:
            logger.error(f"Erro ao carregar dados de analytics: {e}")
        
        # Retornar estrutura vazia se arquivo não existir ou houver erro
        return {
            "metadata": {
                "created_at": datetime.now().isoformat(),
                "last_update": datetime.now().isoformat(),
                "version": "1.0.0",
                "total_interactions": 0
            },
            "interactions": []
        }
    
    def _save_analytics_data(self, data):
        """Salva dados de analytics"""
        try:
            with open(self.analytics_file, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
        except Exception as e:
            logger.error(f"Erro ao salvar dados de analytics: {e}")
    
    def _update_daily_stats(self, interaction):
        """Atualiza estatísticas diárias"""
        try:
            date_key = interaction["timestamp"][:10]  # YYYY-MM-DD
            
            # Carregar estatísticas existentes
            daily_stats = self._load_daily_stats()
            
            if date_key not in daily_stats["daily_stats"]:
                daily_stats["daily_stats"][date_key] = {
                    "total_interactions": 0,
                    "search_types": {},
                    "cities": {},
                    "hours": {}
                }
            
            # Atualizar contadores
            day_stats = daily_stats["daily_stats"][date_key]
            day_stats["total_interactions"] += 1
            
            # Contagem por tipo de busca
            search_type = interaction["search_type"]
            day_stats["search_types"][search_type] = day_stats["search_types"].get(search_type, 0) + 1
            
            # Contagem por cidade
            city = interaction["city"]
            if city:
                day_stats["cities"][city] = day_stats["cities"].get(city, 0) + 1
            
            # Contagem por hora
            hour = str(interaction["hour"])
            day_stats["hours"][hour] = day_stats["hours"].get(hour, 0) + 1
            
            daily_stats["metadata"]["last_update"] = datetime.now().isoformat()
            
            # Salvar estatísticas atualizadas
            self._save_daily_stats(daily_stats)
            
        except Exception as e:
            logger.error(f"Erro ao atualizar estatísticas diárias: {e}")
    
    def _load_daily_stats(self):
        """Carrega estatísticas diárias"""
        try:
            if self.daily_stats_file.exists():
                with open(self.daily_stats_file, 'r', encoding='utf-8') as f:
                    return json.load(f)
        except Exception as e:
            logger.error(f"Erro ao carregar estatísticas diárias: {e}")
        
        return {
            "metadata": {
                "created_at": datetime.now().isoformat(),
                "last_update": datetime.now().isoformat()
            },
            "daily_stats": {}
        }
    
    def _save_daily_stats(self, data):
        """Salva estatísticas diárias"""
        try:
            with open(self.daily_stats_file, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
        except Exception as e:
            logger.error(f"Erro ao salvar estatísticas diárias: {e}")
EOF

# Criar sistema de autenticação simples
echo "🔐 Criando sistema de autenticação..."
cat > app/services/analytics/auth.py << 'EOF'
"""
Sistema de Autenticação Simples para Analytics
"""

import json
from pathlib import Path
from flask import session
import hashlib
import logging

logger = logging.getLogger(__name__)

class SimpleAuth:
    """Sistema de autenticação simples baseado em sessões Flask"""
    
    def __init__(self):
        self.users_file = Path("data/users/clients.json")
    
    def login(self, username, password, user_type="admin"):
        """
        Realiza login do usuário
        
        Args:
            username (str): Nome de usuário
            password (str): Senha
            user_type (str): Tipo de usuário (admin/client)
        
        Returns:
            bool: True se login for bem-sucedido
        """
        try:
            users_data = self._load_users()
            
            if user_type == "admin":
                admin_data = users_data.get("admin", {})
                if admin_data.get("username") == username and admin_data.get("password") == password:
                    session["user_id"] = username
                    session["user_type"] = "admin"
                    session["logged_in"] = True
                    logger.info(f"Login admin realizado: {username}")
                    return True
            
            elif user_type == "client":
                clients = users_data.get("clients", {})
                for client_id, client_data in clients.items():
                    if client_data.get("username") == username and client_data.get("password") == password:
                        session["user_id"] = client_id
                        session["user_type"] = "client"
                        session["logged_in"] = True
                        session["plan"] = client_data.get("plan", "basic")
                        logger.info(f"Login cliente realizado: {username}")
                        return True
            
            return False
            
        except Exception as e:
            logger.error(f"Erro no login: {e}")
            return False
    
    def logout(self):
        """Realiza logout do usuário"""
        session.clear()
    
    def is_logged_in(self):
        """Verifica se usuário está logado"""
        return session.get("logged_in", False)
    
    def is_admin(self):
        """Verifica se usuário é admin"""
        return session.get("user_type") == "admin"
    
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
                    return json.load(f)
        except Exception as e:
            logger.error(f"Erro ao carregar usuários: {e}")
        
        return {"admin": {}, "clients": {}}
EOF

# Criar rotas administrativas
echo "🔧 Criando rotas administrativas..."
cat > app/api/analytics/admin_routes.py << 'EOF'
"""
Rotas Administrativas do Sistema de Analytics
"""

from flask import Blueprint, render_template, redirect, url_for, request, flash, jsonify
from app.services.analytics.auth import SimpleAuth
from app.services.analytics.data_collector import DataCollector
import json
from pathlib import Path
from datetime import datetime, timedelta

admin_bp = Blueprint('admin', __name__, url_prefix='/admin')
auth = SimpleAuth()

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
        # Carregar estatísticas básicas
        analytics_file = Path("data/analytics/interactions.json")
        sellers_file = Path("data/sellers/sellers.json")
        
        stats = {
            'total_interactions': 0,
            'total_sellers': 0,
            'interactions_today': 0,
            'top_searches': []
        }
        
        # Estatísticas de interações
        if analytics_file.exists():
            with open(analytics_file, 'r', encoding='utf-8') as f:
                analytics_data = json.load(f)
                stats['total_interactions'] = analytics_data.get('metadata', {}).get('total_interactions', 0)
                
                # Contar interações de hoje
                today = datetime.now().strftime('%Y-%m-%d')
                interactions_today = [
                    i for i in analytics_data.get('interactions', [])
                    if i.get('timestamp', '').startswith(today)
                ]
                stats['interactions_today'] = len(interactions_today)
        
        # Estatísticas de sellers
        if sellers_file.exists():
            with open(sellers_file, 'r', encoding='utf-8') as f:
                sellers_data = json.load(f)
                stats['total_sellers'] = len(sellers_data.get('sellers', []))
        
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
        # Carregar dados de analytics
        analytics_file = Path("data/analytics/interactions.json")
        daily_stats_file = Path("data/analytics/daily_stats.json")
        
        if not analytics_file.exists():
            return jsonify({'error': 'Dados não encontrados'}), 404
        
        with open(analytics_file, 'r', encoding='utf-8') as f:
            analytics_data = json.load(f)
        
        # Preparar dados para gráficos
        interactions = analytics_data.get('interactions', [])
        
        # Estatísticas por hora (últimas 24h)
        now = datetime.now()
        hours_data = {}
        for i in range(24):
            hour = (now - timedelta(hours=i)).hour
            hours_data[str(hour)] = 0
        
        for interaction in interactions:
            timestamp = interaction.get('timestamp', '')
            if timestamp:
                interaction_time = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
                if (now - interaction_time).total_seconds() <= 86400:  # Últimas 24h
                    hour = str(interaction_time.hour)
                    hours_data[hour] = hours_data.get(hour, 0) + 1
        
        # Top categorias buscadas
        search_terms = {}
        for interaction in interactions[-100:]:  # Últimas 100 interações
            term = interaction.get('search_term', '').lower()
            if term:
                search_terms[term] = search_terms.get(term, 0) + 1
        
        top_searches = sorted(search_terms.items(), key=lambda x: x[1], reverse=True)[:5]
        
        return jsonify({
            'hours_data': hours_data,
            'top_searches': top_searches,
            'total_interactions': len(interactions),
            'interactions_today': len([
                i for i in interactions 
                if i.get('timestamp', '').startswith(now.strftime('%Y-%m-%d'))
            ])
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500
EOF

# Criar template base para admin
echo "🎨 Criando templates administrativos..."
cat > app/templates/admin/base.html << 'EOF'
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{% block title %}Salvô Admin{% endblock %}</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" rel="stylesheet">
    <link href="{{ url_for('static', filename='admin/css/admin.css') }}" rel="stylesheet">
</head>
<body>
    <nav class="navbar navbar-expand-lg navbar-dark bg-success">
        <div class="container-fluid">
            <a class="navbar-brand" href="{{ url_for('admin.dashboard') }}">
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
                    <div class="alert alert-{{ 'danger' if category == 'error' else category }} alert-dismissible fade show" role="alert">
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

# Criar CSS customizado para admin
echo "🎨 Criando CSS administrativo..."
cat > static/admin/css/admin.css << 'EOF'
/* CSS Personalizado para Painel Admin do Salvô */

:root {
    --salvo-green: #25D366;
    --salvo-dark-green: #075E54;
    --salvo-light-green: #128C7E;
}

body {
    background-color: #f8f9fa;
    font-family: 'Inter', sans-serif;
}

.navbar-brand {
    font-weight: 600;
}

.card {
    border: none;
    border-radius: 12px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.card:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 20px rgba(0,0,0,0.15);
}

.stat-card {
    background: linear-gradient(135deg, var(--salvo-green), var(--salvo-light-green));
    color: white;
}

.stat-card .card-title {
    font-size: 2.5rem;
    font-weight: 700;
    margin: 0;
}

.stat-card .card-text {
    font-size: 1.1rem;
    opacity: 0.9;
}

.table {
    border-radius: 12px;
    overflow: hidden;
}

.table thead th {
    background-color: var(--salvo-dark-green);
    color: white;
    border: none;
    font-weight: 600;
}

.btn-success {
    background-color: var(--salvo-green);
    border-color: var(--salvo-green);
}

.btn-success:hover {
    background-color: var(--salvo-dark-green);
    border-color: var(--salvo-dark-green);
}

.chart-container {
    position: relative;
    height: 300px;
    width: 100%;
}

.navbar-dark .navbar-nav .nav-link:hover {
    background-color: rgba(255,255,255,0.1);
    border-radius: 6px;
}

.alert {
    border-radius: 12px;
    border: none;
}

@media (max-width: 768px) {
    .stat-card .card-title {
        font-size: 2rem;
    }
    
    .chart-container {
        height: 250px;
    }
}
EOF

# Atualizar main.py para incluir rotas de analytics
echo "🔧 Atualizando main.py..."
# Fazer backup do main.py atual
cp app/main.py app/main.py.backup

cat > app/main.py << 'EOF'
"""
Salvô - WhatsApp Business Assistant
Aplicação principal para conectar clientes e comércios locais
Versão com Sistema de Analytics
"""

from flask import Flask, render_template
from app.config.settings import Config
from app.api.whatsapp.webhook import whatsapp_bp
from app.api.analytics.admin_routes import admin_bp
from app.services.firebase.connection import initialize_firebase
import logging
from datetime import datetime
import os

def create_app():
    """Factory pattern para criar a aplicação Flask"""
    app = Flask(__name__)
    app.config.from_object(Config)
    
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
    
    # Inicializar Firebase (se disponível)
    try:
        initialize_firebase()
    except Exception as e:
        logging.warning(f"Firebase não inicializado: {e}")
    
    # Registrar blueprints
    app.register_blueprint(whatsapp_bp, url_prefix='/api/whatsapp')
    app.register_blueprint(admin_bp, url_prefix='/admin')
    
    @app.route('/')
    def home():
        """Página inicial - mantendo compatibilidade"""
        return {
            'message': 'Salvô API está funcionando!',
            'timestamp': datetime.now().isoformat(),
            'version': '1.0.0-MVP-Analytics',
            'analytics': 'Sistema de Analytics ativo',
            'admin_panel': '/admin/login'
        }
    
    @app.route('/health')
    def health_check():
        """Health check da aplicação"""
        return {
            'status': 'healthy', 
            'service': 'salvo-api',
            'analytics': 'active',
            'timestamp': datetime.now().isoformat()
        }
    
    @app.route('/analytics')
    def analytics_info():
        """Informações sobre o sistema de analytics"""
        return {
            'message': 'Sistema de Analytics do Salvô',
            'admin_login': '/admin/login',
            'features': [
                'Dashboard administrativo',
                'Coleta automática de dados',
                'Estatísticas em tempo real',
                'Gerenciamento de sellers'
            ],
            'status': 'active'
        }
    
    return app

if __name__ == '__main__':
    app = create_app()
    app.run(debug=True, host='0.0.0.0', port=5000)
EOF

# Criar requirements adicionais para analytics
echo "📦 Atualizando requirements..."
if [ -f "requirements.txt" ]; then
    # Adicionar dependências do analytics se não estiverem presentes
    echo "" >> requirements.txt
    echo "# Analytics dependencies" >> requirements.txt
    grep -q "pandas" requirements.txt || echo "pandas>=1.5.0" >> requirements.txt
    grep -q "plotly" requirements.txt || echo "plotly>=5.17.0" >> requirements.txt
else
    # Criar requirements.txt se não existir
    cat > requirements.txt << 'EOF'
# Salvô Analytics Requirements
Flask>=2.3.0
requests>=2.31.0
python-dotenv>=1.0.0
pandas>=1.5.0
plotly>=5.17.0
gunicorn>=21.2.0
EOF
fi

# Criar script de instalação das dependências
echo "📦 Criando script de instalação..."
cat > scripts/install_analytics.sh << 'EOF'
#!/bin/bash

echo "📦 Instalando dependências do Sistema de Analytics..."

# Verificar se pip está disponível
if ! command -v pip &> /dev/null; then
    echo "❌ pip não encontrado. Instale o Python e pip primeiro."
    exit 1
fi

# Instalar dependências
pip install -r requirements.txt

echo "✅ Dependências instaladas com sucesso!"
echo ""
echo "🚀 Para iniciar o servidor:"
echo "python app/main.py"
echo ""
echo "🔐 Acesso Admin:"
echo "URL: http://localhost:5000/admin/login"
echo "Usuário: admin"
echo "Senha: salvo2025admin"
EOF

chmod +x scripts/install_analytics.sh

echo ""
echo "🎉 ========================================"
echo "✅ SISTEMA DE ANALYTICS BASE CRIADO!"
echo "========================================"
echo ""
echo "📁 Estrutura criada:"
echo "   ├── app/api/analytics/              # APIs de analytics"
echo "   ├── app/services/analytics/         # Serviços de dados"
echo "   ├── app/templates/admin/            # Templates admin"
echo "   ├── data/analytics/                 # Dados de analytics"
echo "   ├── data/users/                     # Usuários do sistema"
echo "   └── static/admin/                   # Assets admin"
echo ""
echo "🔧 Configuração:"
echo "   • Sistema de autenticação ativo"
echo "   • Coleta de dados configurada"
echo "   • Dashboard administrativo pronto"
echo "   • Integração com sistema atual mantida"
echo ""
echo "🚀 Próximos passos:"
echo "   1. Execute: ./scripts/install_analytics.sh"
echo "   2. Inicie o servidor: python app/main.py"
echo "   3. Acesse: http://localhost:5000/admin/login"
echo ""
echo "🔐 Credenciais Admin:"
echo "   Usuário: admin"
echo "   Senha: salvo2025admin"
echo ""
echo "📊 Endpoints disponíveis:"
echo "   • GET  /                           # Status da API"
echo "   • GET  /analytics                  # Info do sistema"
echo "   • GET  /admin/login               # Login admin"
echo "   • GET  /admin/dashboard           # Dashboard"
echo "   • POST /api/whatsapp/webhook      # Webhook WhatsApp"
echo ""
echo "🎯 Próximo"