#!/bin/bash

# Script 3c: Sistema de Analytics - Dashboard Completo (Parte 1c)
# Autor: Sistema Analytics
# Data: 2025-09-26
# Descrição: Criação do dashboard completo com gráficos e estatísticas

echo "📊 Iniciando criação do Dashboard Completo - Salvô (Parte 1c)..."

# Verificar se a parte 1b foi executada
if [ ! -f "app/templates/admin/login.html" ]; then
    echo "❌ Execute primeiro: ./3b-analytics-routes-salvo.sh"
    exit 1
fi

echo "✅ Templates base verificados"

# Criar template do dashboard
echo "🎨 Criando template do dashboard..."
cat > app/templates/admin/dashboard.html << 'EOF'
{% extends "admin/base.html" %}

{% block title %}Dashboard - Salvô Admin{% endblock %}

{% block content %}
<div class="row mb-4">
    <div class="col-12">
        <h2 class="fw-bold">
            <i class="fas fa-tachometer-alt me-2"></i>Dashboard Analytics
        </h2>
        <p class="text-muted">Visão geral do sistema Salvô em tempo real</p>
    </div>
</div>

<!-- Cards de Estatísticas -->
<div class="row mb-4">
    <div class="col-md-3 mb-3">
        <div class="card stat-card">
            <div class="card-body text-center">
                <i class="fas fa-comments fa-2x mb-2"></i>
                <h3 class="card-title">{{ stats.total_interactions or 0 }}</h3>
                <p class="card-text">Total de Interações</p>
            </div>
        </div>
    </div>
    <div class="col-md-3 mb-3">
        <div class="card stat-card">
            <div class="card-body text-center">
                <i class="fas fa-calendar-day fa-2x mb-2"></i>
                <h3 class="card-title">{{ stats.interactions_today or 0 }}</h3>
                <p class="card-text">Interações Hoje</p>
            </div>
        </div>
    </div>
    <div class="col-md-3 mb-3">
        <div class="card stat-card">
            <div class="card-body text-center">
                <i class="fas fa-chart-line fa-2x mb-2"></i>
                <h3 class="card-title">{{ stats.interactions_week or 0 }}</h3>
                <p class="card-text">Esta Semana</p>
            </div>
        </div>
    </div>
    <div class="col-md-3 mb-3">
        <div class="card stat-card">
            <div class="card-body text-center">
                <i class="fas fa-clock fa-2x mb-2"></i>
                <h3 class="card-title" id="realTimeCounter">0</h3>
                <p class="card-text">Tempo Real</p>
            </div>
        </div>
    </div>
</div>

<!-- Gráficos -->
<div class="row mb-4">
    <div class="col-md-8 mb-3">
        <div class="card">
            <div class="card-header bg-white">
                <h5 class="mb-0">
                    <i class="fas fa-chart-bar me-2"></i>Interações por Hora (24h)
                </h5>
            </div>
            <div class="card-body">
                <canvas id="hourlyChart" height="100"></canvas>
            </div>
        </div>
    </div>
    <div class="col-md-4 mb-3">
        <div class="card">
            <div class="card-header bg-white">
                <h5 class="mb-0">
                    <i class="fas fa-search me-2"></i>Top Buscas
                </h5>
            </div>
            <div class="card-body">
                <canvas id="searchChart" height="200"></canvas>
            </div>
        </div>
    </div>
</div>

<!-- Tabelas de Dados -->
<div class="row">
    <div class="col-md-6 mb-3">
        <div class="card">
            <div class="card-header bg-white">
                <h5 class="mb-0">
                    <i class="fas fa-map-marker-alt me-2"></i>Cidades Mais Ativas
                </h5>
            </div>
            <div class="card-body">
                <div class="table-responsive">
                    <table class="table table-sm">
                        <thead>
                            <tr>
                                <th>Cidade</th>
                                <th>Buscas</th>
                                <th>%</th>
                            </tr>
                        </thead>
                        <tbody id="citiesTable">
                            {% for city, count in stats.top_cities[:5] %}
                            <tr>
                                <td>{{ city }}</td>
                                <td>{{ count }}</td>
                                <td>{{ "%.1f"|format(count / stats.total_interactions * 100 if stats.total_interactions > 0 else 0) }}%</td>
                            </tr>
                            {% else %}
                            <tr>
                                <td colspan="3" class="text-muted text-center">Nenhum dado disponível</td>
                            </tr>
                            {% endfor %}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    </div>
    <div class="col-md-6 mb-3">
        <div class="card">
            <div class="card-header bg-white">
                <h5 class="mb-0">
                    <i class="fas fa-tags me-2"></i>Termos Mais Buscados
                </h5>
            </div>
            <div class="card-body">
                <div class="table-responsive">
                    <table class="table table-sm">
                        <thead>
                            <tr>
                                <th>Termo</th>
                                <th>Quantidade</th>
                                <th>%</th>
                            </tr>
                        </thead>
                        <tbody id="searchTable">
                            {% for term, count in stats.top_searches[:5] %}
                            <tr>
                                <td>{{ term|title }}</td>
                                <td>{{ count }}</td>
                                <td>{{ "%.1f"|format(count / stats.total_interactions * 100 if stats.total_interactions > 0 else 0) }}%</td>
                            </tr>
                            {% else %}
                            <tr>
                                <td colspan="3" class="text-muted text-center">Nenhum dado disponível</td>
                            </tr>
                            {% endfor %}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    </div>
</div>

<!-- Status do Sistema -->
<div class="row">
    <div class="col-12">
        <div class="card">
            <div class="card-header bg-white">
                <h5 class="mb-0">
                    <i class="fas fa-info-circle me-2"></i>Status do Sistema
                </h5>
            </div>
            <div class="card-body">
                <div class="row">
                    <div class="col-md-4">
                        <small class="text-muted">Última Atualização:</small><br>
                        <span id="lastUpdate">{{ stats.last_update or 'Nunca' }}</span>
                    </div>
                    <div class="col-md-4">
                        <small class="text-muted">Sistema:</small><br>
                        <span class="badge bg-success">Online</span>
                    </div>
                    <div class="col-md-4">
                        <small class="text-muted">Analytics:</small><br>
                        <span class="badge bg-success">Ativo</span>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>
{% endblock %}

{% block scripts %}
<script>
// Configurações dos gráficos
const chartColors = {
    primary: '#25D366',
    secondary: '#075E54',
    background: 'rgba(37, 211, 102, 0.1)',
    border: 'rgba(37, 211, 102, 0.8)'
};

// Gráfico de interações por hora
const hourlyCtx = document.getElementById('hourlyChart').getContext('2d');
const hourlyChart = new Chart(hourlyCtx, {
    type: 'line',
    data: {
        labels: Array.from({length: 24}, (_, i) => i + 'h'),
        datasets: [{
            label: 'Interações',
            data: [],
            backgroundColor: chartColors.background,
            borderColor: chartColors.border,
            borderWidth: 2,
            fill: true,
            tension: 0.4
        }]
    },
    options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
            y: {
                beginAtZero: true,
                ticks: {
                    stepSize: 1
                }
            }
        },
        plugins: {
            legend: {
                display: false
            }
        }
    }
});

// Gráfico de top buscas
const searchCtx = document.getElementById('searchChart').getContext('2d');
const searchChart = new Chart(searchCtx, {
    type: 'doughnut',
    data: {
        labels: [],
        datasets: [{
            data: [],
            backgroundColor: [
                '#25D366',
                '#075E54',
                '#128C7E',
                '#34B7F1',
                '#ECE5DD'
            ]
        }]
    },
    options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'bottom',
                labels: {
                    boxWidth: 12,
                    fontSize: 10
                }
            }
        }
    }
});

// Função para atualizar dados em tempo real
function updateDashboard() {
    fetch('/admin/api/stats')
        .then(response => response.json())
        .then(data => {
            // Atualizar dados dos gráficos
            if (data.hourly) {
                const hourlyData = Array.from({length: 24}, (_, i) => data.hourly[i] || 0);
                hourlyChart.data.datasets[0].data = hourlyData;
                hourlyChart.update();
            }
            
            // Atualizar contador em tempo real
            document.getElementById('realTimeCounter').textContent = data.dashboard.total_interactions || 0;
            
            // Atualizar última atualização
            if (data.timestamp) {
                const date = new Date(data.timestamp);
                document.getElementById('lastUpdate').textContent = date.toLocaleString('pt-BR');
            }
        })
        .catch(error => console.error('Erro ao atualizar dashboard:', error));
}

// Atualizar dashboard a cada 30 segundos
setInterval(updateDashboard, 30000);

// Primeira atualização
updateDashboard();
</script>
{% endblock %}
EOF

# Criar template de sellers
echo "🏪 Criando template de sellers..."
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
                                    <strong>{{ seller.nome }}</strong><br>
                                    <small class="text-muted">{{ seller.descricao[:50] }}...</small>
                                </td>
                                <td>
                                    <span class="badge bg-primary">{{ seller.categoria|title }}</span>
                                </td>
                                <td>
                                    <i class="fas fa-map-marker-alt text-danger me-1"></i>
                                    {{ seller.localizacao.latitude }}, {{ seller.localizacao.longitude }}
                                </td>
                                <td>
                                    <a href="{{ seller.contato }}" target="_blank" class="btn btn-sm btn-outline-success">
                                        <i class="fab fa-whatsapp me-1"></i>WhatsApp
                                    </a>
                                </td>
                                <td>
                                    {% if seller.data_cadastro %}
                                        {{ seller.data_cadastro[:10] }}
                                    {% else %}
                                        -
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

# Criar CSS customizado para admin
echo "🎨 Criando CSS customizado..."
cat > static/admin/css/admin.css << 'EOF'
/* CSS Personalizado para Painel Admin do Salvô */

:root {
    --salvo-green: #25D366;
    --salvo-dark-green: #075E54;
    --salvo-light-green: #128C7E;
}

body {
    background-color: #f8f9fa;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
}

.navbar-brand {
    font-weight: 600;
    font-size: 1.5rem;
}

.card {
    border: none;
    border-radius: 15px;
    box-shadow: 0 4px 15px rgba(0,0,0,0.08);
    transition: all 0.3s ease;
}

.card:hover {
    transform: translateY(-3px);
    box-shadow: 0 8px 25px rgba(0,0,0,0.12);
}

.stat-card {
    background: linear-gradient(135deg, var(--salvo-green), var(--salvo-light-green));
    color: white;
    border-radius: 20px;
}

.stat-card .card-title {
    font-size: 2.8rem;
    font-weight: 700;
    margin: 0;
    text-shadow: 0 2px 4px rgba(0,0,0,0.2);
}

.stat-card .card-text {
    font-size: 1rem;
    opacity: 0.95;
    font-weight: 500;
}

.table {
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 2px 8px rgba(0,0,0,0.05);
}

.table thead th {
    background-color: var(--salvo-dark-green);
    color: white;
    border: none;
    font-weight: 600;
    font-size: 0.9rem;
    letter-spacing: 0.5px;
}

.btn-success {
    background-color: var(--salvo-green);
    border-color: var(--salvo-green);
    border-radius: 10px;
    font-weight: 500;
}

.btn-success:hover {
    background-color: var(--salvo-dark-green);
    border-color: var(--salvo-dark-green);
    transform: translateY(-1px);
}

.chart-container {
    position: relative;
    height: 300px;
    width: 100%;
}

.navbar-dark .navbar-nav .nav-link {
    border-radius: 8px;
    margin: 0 2px;
    font-weight: 500;
}

.navbar-dark .navbar-nav .nav-link:hover {
    background-color: rgba(255,255,255,0.15);
}

.alert {
    border-radius: 12px;
    border: none;
    font-weight: 500;
}

.badge {
    font-weight: 500;
    padding: 0.5em 0.8em;
    border-radius: 8px;
}

.login-card {
    backdrop-filter: blur(10px);
    background: rgba(255,255,255,0.95);
}

@media (max-width: 768px) {
    .stat-card .card-title {
        font-size: 2.2rem;
    }
    
    .chart-container {
        height: 250px;
    }
    
    .navbar-brand {
        font-size: 1.2rem;
    }
}

/* Animações */
@keyframes fadeInUp {
    from {
        opacity: 0;
        transform: translateY(30px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}

.card {
    animation: fadeInUp 0.6s ease-out;
}

/* Loading spinner customizado */
.spinner-border-sm {
    width: 1rem;
    height: 1rem;
}
EOF

echo ""
echo "✅ PARTE 1c CONCLUÍDA!"
echo "🎨 Dashboard completo criado com:"
echo "   • Gráficos interativos (Chart.js)"
echo "   • Estatísticas em tempo real"
echo "   • Templates responsivos"
echo "   • CSS customizado"
echo "   • Gestão de sellers"
echo ""
echo "🚀 Execute a Parte Final:"
echo "chmod +x 3d-analytics-final-salvo.sh && ./3d-analytics-final-salvo.sh"