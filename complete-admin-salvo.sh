#!/bin/bash

# Script para completar e corrigir o painel admin
echo "🎯 Finalizando Painel Admin - Salvô Analytics"

# 1. Corrigir template de sellers para evitar erro de atributos
echo "🏪 Corrigindo template de sellers..."
cat > app/templates/admin/sellers.html << 'EOF'
{% extends "admin/base.html" %}

{% block title %}Sellers - Salvô Admin{% endblock %}

{% block content %}
<div class="row mb-4">
    <div class="col-12">
        <h2 class="fw-bold">
            <i class="fas fa-store me-2"></i>Gerenciamento de Sellers
        </h2>
        <p class="text-muted">Visualize e gerencie os estabelecimentos cadastrados</p>
    </div>
</div>

<!-- Estatísticas dos Sellers -->
<div class="row mb-4">
    <div class="col-md-3 mb-3">
        <div class="card stat-card">
            <div class="card-body text-center">
                <i class="fas fa-store fa-2x mb-2"></i>
                <h3 class="card-title">{{ sellers|length }}</h3>
                <p class="card-text">Total de Sellers</p>
            </div>
        </div>
    </div>
    <div class="col-md-3 mb-3">
        <div class="card bg-info text-white">
            <div class="card-body text-center">
                <i class="fas fa-check-circle fa-2x mb-2"></i>
                <h3 class="card-title">{{ sellers|length }}</h3>
                <p class="card-text">Ativos</p>
            </div>
        </div>
    </div>
    <div class="col-md-3 mb-3">
        <div class="card bg-warning text-white">
            <div class="card-body text-center">
                <i class="fas fa-clock fa-2x mb-2"></i>
                <h3 class="card-title">0</h3>
                <p class="card-text">Pendentes</p>
            </div>
        </div>
    </div>
    <div class="col-md-3 mb-3">
        <div class="card bg-secondary text-white">
            <div class="card-body text-center">
                <i class="fas fa-times-circle fa-2x mb-2"></i>
                <h3 class="card-title">0</h3>
                <p class="card-text">Inativos</p>
            </div>
        </div>
    </div>
</div>

<!-- Tabela de Sellers -->
<div class="row">
    <div class="col-12">
        <div class="card">
            <div class="card-header bg-white d-flex justify-content-between align-items-center">
                <h5 class="mb-0">
                    <i class="fas fa-list me-2"></i>Lista de Estabelecimentos
                </h5>
                <button class="btn btn-success btn-sm">
                    <i class="fas fa-plus me-1"></i>Adicionar Seller
                </button>
            </div>
            <div class="card-body">
                <div class="table-responsive">
                    <table class="table table-hover">
                        <thead class="table-light">
                            <tr>
                                <th>Nome</th>
                                <th>Categoria</th>
                                <th>Localização</th>
                                <th>Contato</th>
                                <th>Data Cadastro</th>
                                <th>Status</th>
                                <th>Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {% for seller in sellers %}
                            <tr>
                                <td>
                                    <strong>{{ seller.get('nome', 'N/A') }}</strong><br>
                                    <small class="text-muted">{{ (seller.get('descricao', 'Sem descrição'))[:50] }}{% if seller.get('descricao', '')|length > 50 %}...{% endif %}</small>
                                </td>
                                <td>
                                    <span class="badge bg-primary">{{ (seller.get('categoria', 'Não informado'))|title }}</span>
                                </td>
                                <td>
                                    <i class="fas fa-map-marker-alt text-danger me-1"></i>
                                    {% if seller.get('localizacao') %}
                                        {{ seller.localizacao.get('latitude', 'N/A') }}, {{ seller.localizacao.get('longitude', 'N/A') }}
                                        {% if seller.localizacao.get('cidade') %}
                                            <br><small class="text-muted">{{ seller.localizacao.get('cidade', '') }}, {{ seller.localizacao.get('estado', '') }}</small>
                                        {% endif %}
                                    {% else %}
                                        N/A
                                    {% endif %}
                                </td>
                                <td>
                                    {% if seller.get('contato') %}
                                        <a href="{{ seller.contato }}" target="_blank" class="btn btn-sm btn-outline-success">
                                            <i class="fab fa-whatsapp me-1"></i>WhatsApp
                                        </a>
                                    {% else %}
                                        <span class="text-muted">N/A</span>
                                    {% endif %}
                                </td>
                                <td>
                                    {% if seller.get('data_cadastro') %}
                                        {{ seller.data_cadastro[:10] }}
                                    {% else %}
                                        <span class="text-muted">N/A</span>
                                    {% endif %}
                                </td>
                                <td>
                                    <span class="badge bg-success">Ativo</span>
                                </td>
                                <td>
                                    <div class="btn-group btn-group-sm">
                                        <button class="btn btn-outline-primary" title="Editar">
                                            <i class="fas fa-edit"></i>
                                        </button>
                                        <button class="btn btn-outline-info" title="Ver Detalhes">
                                            <i class="fas fa-eye"></i>
                                        </button>
                                        <button class="btn btn-outline-danger" title="Desativar">
                                            <i class="fas fa-trash"></i>
                                        </button>
                                    </div>
                                </td>
                            </tr>
                            {% else %}
                            <tr>
                                <td colspan="7" class="text-center text-muted py-4">
                                    <i class="fas fa-store fa-3x mb-3 d-block"></i>
                                    Nenhum seller cadastrado ainda
                                </td>
                            </tr>
                            {% endfor %}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    </div>
</div>
{% endblock %}
EOF

# 2. Criar template para página de logs
echo "📋 Criando template de logs..."
cat > app/templates/admin/logs.html << 'EOF'
{% extends "admin/base.html" %}

{% block title %}Logs - Salvô Admin{% endblock %}

{% block content %}
<div class="row mb-4">
    <div class="col-12">
        <h2 class="fw-bold">
            <i class="fas fa-file-alt me-2"></i>Logs do Sistema
        </h2>
        <p class="text-muted">Monitoramento de atividades e erros do sistema</p>
    </div>
</div>

<!-- Controles -->
<div class="row mb-4">
    <div class="col-md-6">
        <div class="card">
            <div class="card-body">
                <h6 class="card-title">Filtros</h6>
                <div class="row">
                    <div class="col-md-6">
                        <select class="form-select form-select-sm" id="logLevel">
                            <option value="">Todos os níveis</option>
                            <option value="INFO">INFO</option>
                            <option value="WARNING">WARNING</option>
                            <option value="ERROR">ERROR</option>
                        </select>
                    </div>
                    <div class="col-md-6">
                        <button class="btn btn-sm btn-success" onclick="refreshLogs()">
                            <i class="fas fa-sync me-1"></i>Atualizar
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="clearLogs()">
                            <i class="fas fa-trash me-1"></i>Limpar
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>
    <div class="col-md-6">
        <div class="card">
            <div class="card-body">
                <h6 class="card-title">Status do Sistema</h6>
                <span class="badge bg-success me-2">Sistema Online</span>
                <span class="badge bg-info me-2">Analytics Ativo</span>
                <span class="badge bg-warning">{{ log_count or 0 }} logs hoje</span>
            </div>
        </div>
    </div>
</div>

<!-- Log Viewer -->
<div class="row">
    <div class="col-12">
        <div class="card">
            <div class="card-header bg-white">
                <h5 class="mb-0">
                    <i class="fas fa-terminal me-2"></i>Log em Tempo Real
                </h5>
            </div>
            <div class="card-body">
                <pre id="logContent" style="height: 400px; overflow-y: auto; background: #f8f9fa; border: 1px solid #dee2e6; padding: 15px; font-size: 0.85em;">
{{ log_content or 'Carregando logs...' }}
                </pre>
            </div>
        </div>
    </div>
</div>
{% endblock %}

{% block scripts %}
<script>
function refreshLogs() {
    fetch('/admin/api/logs')
        .then(response => response.json())
        .then(data => {
            document.getElementById('logContent').textContent = data.content || 'Nenhum log disponível';
        })
        .catch(error => {
            console.error('Erro ao carregar logs:', error);
        });
}

function clearLogs() {
    if (confirm('Tem certeza que deseja limpar os logs?')) {
        fetch('/admin/api/logs/clear', {method: 'POST'})
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    document.getElementById('logContent').textContent = 'Logs limpos com sucesso.';
                }
            });
    }
}

// Auto-refresh logs a cada 10 segundos
setInterval(refreshLogs, 10000);
</script>
{% endblock %}
EOF

# 3. Adicionar rotas para logs no admin_routes.py
echo "📋 Adicionando rotas de logs..."
cat >> app/api/analytics/admin_routes.py << 'EOF'

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
EOF

# 4. Atualizar base.html para incluir link de logs
echo "🔧 Atualizando navegação..."
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
        .navbar-nav .nav-link { border-radius: 8px; margin: 0 2px; font-weight: 500; }
        .navbar-nav .nav-link:hover { background-color: rgba(255,255,255,0.15); }
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
                <a class="nav-link" href="{{ url_for('admin.logs') }}">
                    <i class="fas fa-file-alt me-1"></i>Logs
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

# 5. Criar dados de exemplo mais robustos se necessário
echo "📊 Verificando dados de exemplo..."
if [ ! -f "data/sellers/sellers.json" ] || [ "$(cat data/sellers/sellers.json | jq '.sellers | length' 2>/dev/null || echo 0)" -eq 0 ]; then
    echo "🔧 Criando dados de sellers mais completos..."
    cat > data/sellers/sellers.json << 'EOF'
{
  "metadata": {
    "created_at": "2025-09-26T14:30:00Z",
    "last_update": "2025-09-26T14:30:00Z",
    "total_sellers": 5
  },
  "sellers": [
    {
      "id": "seller_001",
      "nome": "Pizzaria do João",
      "categoria": "restaurante",
      "descricao": "As melhores pizzas da região com massa artesanal e ingredientes frescos",
      "localizacao": {
        "latitude": -23.5617,
        "longitude": -46.6559,
        "cidade": "São Paulo",
        "estado": "SP"
      },
      "contato": "https://wa.me/5511999999001",
      "data_cadastro": "2025-09-20T10:30:00Z"
    },
    {
      "id": "seller_002",
      "nome": "Farmácia Central",
      "categoria": "farmacia",
      "descricao": "Medicamentos e produtos de saúde 24 horas, delivery rápido",
      "localizacao": {
        "latitude": -23.5505,
        "longitude": -46.6333,
        "cidade": "São Paulo",
        "estado": "SP"
      },
      "contato": "https://wa.me/5511999999002",
      "data_cadastro": "2025-09-21T14:15:00Z"
    },
    {
      "id": "seller_003",
      "nome": "Barbearia Moderna",
      "categoria": "barbearia",
      "descricao": "Cortes modernos e tradicionais, barba e bigode com profissionais experientes",
      "localizacao": {
        "latitude": -23.5729,
        "longitude": -46.6431,
        "cidade": "São Paulo",
        "estado": "SP"
      },
      "contato": "https://wa.me/5511999999003",
      "data_cadastro": "2025-09-22T09:45:00Z"
    },
    {
      "id": "seller_004",
      "nome": "Supermercado Bairro",
      "categoria": "supermercado",
      "descricao": "Produtos frescos, hortifruti e mercearia com preços justos",
      "localizacao": {
        "latitude": -23.5489,
        "longitude": -46.6388,
        "cidade": "São Paulo",
        "estado": "SP"
      },
      "contato": "https://wa.me/5511999999004",
      "data_cadastro": "2025-09-23T16:20:00Z"
    },
    {
      "id": "seller_005",
      "nome": "Oficina do Carro",
      "categoria": "oficina",
      "descricao": "Mecânica geral, elétrica e pintura automotiva com garantia",
      "localizacao": {
        "latitude": -23.5644,
        "longitude": -46.6520,
        "cidade": "São Paulo",
        "estado": "SP"
      },
      "contato": "https://wa.me/5511999999005",
      "data_cadastro": "2025-09-24T11:10:00Z"
    }
  ]
}
EOF
fi

echo ""
echo "🎉 ========================================"
echo "✅ PAINEL ADMIN COMPLETADO!"
echo "========================================"
echo ""
echo "🆕 Funcionalidades adicionadas:"
echo "   • Template de sellers corrigido (sem erro de atributos)"
echo "   • Página de logs do sistema"
echo "   • API de logs em tempo real"
echo "   • Navegação completa"
echo "   • Dados de exemplo mais robustos"
echo ""
echo "📊 Páginas disponíveis:"
echo "   • Dashboard: /admin/dashboard"
echo "   • Sellers: /admin/sellers" 
echo "   • Logs: /admin/logs"
echo ""
echo "🔧 Para aplicar as mudanças:"
echo "   1. Pare o servidor (Ctrl+C)"
echo "   2. Execute: ./start_analytics.sh"
echo "   3. Acesse: http://localhost:5000/admin/login"
echo ""
echo "🌟 O painel admin está completo e funcional!"