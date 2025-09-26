#!/bin/bash

# Script 3d: Sistema de Analytics - Finalização e Integração (Parte Final)
# Autor: Sistema Analytics
# Data: 2025-09-26
# Descrição: Finalização da instalação e integração completa

echo "📊 Iniciando Finalização do Sistema de Analytics - Salvô (Parte Final)..."

# Verificar se a parte 1c foi executada
if [ ! -f "app/templates/admin/dashboard.html" ]; then
    echo "❌ Execute primeiro: ./3c-analytics-dashboard-salvo.sh"
    exit 1
fi

echo "✅ Dashboard verificado"

# Criar requirements.txt completo
echo "📦 Criando requirements.txt completo..."
cat > requirements.txt << 'EOF'
# Salvô Analytics - Requirements
Flask>=2.3.0
python-dotenv>=1.0.0
requests>=2.31.0
gunicorn>=21.2.0

# Analytics específicas
pandas>=1.5.0
plotly>=5.17.0

# Desenvolvimento
Werkzeug>=2.3.0
click>=8.1.0
itsdangerous>=2.1.0
Jinja2>=3.1.0
MarkupSafe>=2.1.0
EOF

# Criar arquivo de dados de sellers se não existir
echo "🏪 Verificando dados de sellers..."
if [ ! -f "data/sellers/sellers.json" ]; then
    mkdir -p data/sellers
    cat > data/sellers/sellers.json << 'EOF'
{
  "metadata": {
    "created_at": "2025-09-26T14:30:00Z",
    "last_update": "2025-09-26T14:30:00Z",
    "total_sellers": 3
  },
  "sellers": [
    {
      "id": "seller_001",
      "nome": "Pizzaria do João",
      "categoria": "restaurante",
      "descricao": "As melhores pizzas da região com massa artesanal",
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
      "descricao": "Medicamentos e produtos de saúde 24 horas",
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
      "descricao": "Cortes modernos e tradicionais, barba e bigode",
      "localizacao": {
        "latitude": -23.5729,
        "longitude": -46.6431,
        "cidade": "São Paulo",
        "estado": "SP"
      },
      "contato": "https://wa.me/5511999999003",
      "data_cadastro": "2025-09-22T09:45:00Z"
    }
  ]
}
EOF
fi

# Criar dados de exemplo para analytics
echo "📈 Criando dados de exemplo para analytics..."
cat > data/analytics/interactions.json << 'EOF'
{
  "metadata": {
    "created_at": "2025-09-26T14:30:00Z",
    "last_update": "2025-09-26T15:45:00Z",
    "version": "1.0.0",
    "total_interactions": 12
  },
  "interactions": [
    {
      "interaction_id": "int_001",
      "timestamp": "2025-09-26T08:30:00Z",
      "phone": "5511999998001",
      "location": {"latitude": -23.5617, "longitude": -46.6559, "city": "São Paulo", "state": "SP"},
      "search_type": "text",
      "search_term": "pizza",
      "results_count": 1,
      "results_clicked": 1,
      "hour": 8,
      "day_of_week": "thursday",
      "city": "São Paulo",
      "state": "SP"
    },
    {
      "interaction_id": "int_002",
      "timestamp": "2025-09-26T10:15:00Z",
      "phone": "5511999998002",
      "location": {"latitude": -23.5505, "longitude": -46.6333, "city": "São Paulo", "state": "SP"},
      "search_type": "text",
      "search_term": "farmacia",
      "results_count": 1,
      "results_clicked": 1,
      "hour": 10,
      "day_of_week": "thursday",
      "city": "São Paulo",
      "state": "SP"
    },
    {
      "interaction_id": "int_003",
      "timestamp": "2025-09-26T12:20:00Z",
      "phone": "5511999998003",
      "location": {"latitude": -23.5729, "longitude": -46.6431, "city": "São Paulo", "state": "SP"},
      "search_type": "text",
      "search_term": "barbearia",
      "results_count": 1,
      "results_clicked": 1,
      "hour": 12,
      "day_of_week": "thursday",
      "city": "São Paulo",
      "state": "SP"
    },
    {
      "interaction_id": "int_004",
      "timestamp": "2025-09-26T14:45:00Z",
      "phone": "5511999998004",
      "location": {"latitude": -23.5617, "longitude": -46.6559, "city": "São Paulo", "state": "SP"},
      "search_type": "text",
      "search_term": "comida",
      "results_count": 1,
      "results_clicked": 0,
      "hour": 14,
      "day_of_week": "thursday",
      "city": "São Paulo",
      "state": "SP"
    },
    {
      "interaction_id": "int_005",
      "timestamp": "2025-09-26T15:30:00Z",
      "phone": "5511999998005",
      "location": {"latitude": -23.5505, "longitude": -46.6333, "city": "São Paulo", "state": "SP"},
      "search_type": "text",
      "search_term": "remedio",
      "results_count": 1,
      "results_clicked": 1,
      "hour": 15,
      "day_of_week": "thursday",
      "city": "São Paulo",
      "state": "SP"
    }
  ]
}
EOF

# Atualizar estatísticas diárias
cat > data/analytics/daily_stats.json << 'EOF'
{
  "metadata": {
    "created_at": "2025-09-26T14:30:00Z",
    "last_update": "2025-09-26T15:45:00Z"
  },
  "daily_stats": {
    "2025-09-26": {
      "total_interactions": 5,
      "search_types": {
        "text": 5
      },
      "cities": {
        "São Paulo": 5
      },
      "hours": {
        "8": 1,
        "10": 1,
        "12": 1,
        "14": 1,
        "15": 1
      }
    }
  }
}
EOF

# Criar script de instalação das dependências
echo "📦 Criando script de instalação..."
cat > scripts/install_analytics.sh << 'EOF'
#!/bin/bash

echo "📦 Instalando dependências do Sistema de Analytics..."

# Verificar se pip está disponível
if ! command -v pip3 &> /dev/null; then
    echo "❌ pip3 não encontrado. Instale o Python 3 e pip primeiro."
    exit 1
fi

# Verificar se Python 3 está disponível
if ! command -v python3 &> /dev/null; then
    echo "❌ python3 não encontrado. Instale o Python 3 primeiro."
    exit 1
fi

echo "✅ Python 3 encontrado: $(python3 --version)"

# Instalar dependências
echo "📦 Instalando dependências..."
pip3 install -r requirements.txt

echo ""
echo "✅ Dependências instaladas com sucesso!"
echo ""
echo "🚀 Para iniciar o servidor:"
echo "python3 app/main.py"
echo ""
echo "🔐 Acesso Admin:"
echo "URL: http://localhost:5000/admin/login"
echo "Usuário: admin"
echo "Senha: salvo2025admin"
EOF

chmod +x scripts/install_analytics.sh

# Criar script de teste do sistema
echo "🧪 Criando script de teste..."
cat > scripts/test_analytics.sh << 'EOF'
#!/bin/bash

echo "🧪 Testando Sistema de Analytics..."

# Verificar se o servidor está rodando
if ! curl -s http://localhost:5000/health > /dev/null; then
    echo "❌ Servidor não está rodando. Execute primeiro:"
    echo "python3 app/main.py"
    exit 1
fi

echo "✅ Servidor está rodando"

# Testar endpoints
echo "🔍 Testando endpoints..."

# Testar endpoint principal
if curl -s http://localhost:5000/ | grep -q "Salvô"; then
    echo "✅ Endpoint principal funcionando"
else
    echo "❌ Erro no endpoint principal"
fi

# Testar health check
if curl -s http://localhost:5000/health | grep -q "healthy"; then
    echo "✅ Health check funcionando"
else
    echo "❌ Erro no health check"
fi

# Testar página de login admin
if curl -s http://localhost:5000/admin/login | grep -q "Login"; then
    echo "✅ Página de login funcionando"
else
    echo "❌ Erro na página de login"
fi

echo ""
echo "🎉 Testes concluídos!"
echo "🔗 Acesse: http://localhost:5000/admin/login"
EOF

chmod +x scripts/test_analytics.sh

# Criar script de backup dos dados
echo "💾 Criando script de backup..."
cat > scripts/backup_data.sh << 'EOF'
#!/bin/bash

echo "💾 Criando backup dos dados..."

# Criar diretório de backup com timestamp
BACKUP_DIR="backups/$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

# Fazer backup dos dados
cp -r data/ "$BACKUP_DIR/"
cp -r logs/ "$BACKUP_DIR/" 2>/dev/null || echo "⚠️ Diretório logs não encontrado"

# Criar arquivo de informações do backup
cat > "$BACKUP_DIR/backup_info.txt" << EOL
Backup criado em: $(date)
Versão: Salvô Analytics v1.0.0
Diretórios incluídos:
- data/ (todos os dados do sistema)
- logs/ (logs da aplicação)

Para restaurar:
1. Pare o servidor
2. Substitua o diretório data/ pelo backup
3. Reinicie o servidor
EOL

echo "✅ Backup criado em: $BACKUP_DIR"
echo "📁 Arquivos incluídos:"
find "$BACKUP_DIR" -type f | head -10
EOF

chmod +x scripts/backup_data.sh

# Criar README específico do Analytics
echo "📝 Criando README do Analytics..."
cat > README_ANALYTICS.md << 'EOF'
# 📊 Salvô Analytics - Sistema de Dados Monetizável

## 🎯 Visão Geral

O Salvô Analytics é um sistema completo de coleta, processamento e visualização de dados das interações do WhatsApp Business, desenvolvido para monetizar insights de comportamento de busca local.

## ✨ Funcionalidades

### 🔧 Painel Administrativo (Gratuito)
- Dashboard com métricas em tempo real
- Gerenciamento de sellers cadastrados
- Visualização de logs do sistema
- Estatísticas de uso detalhadas
- Gráficos interativos (Chart.js)

### 💰 Recursos de Monetização (Futuros)
- Heatmaps de buscas por região
- Análises demográficas avançadas
- API comercial para terceiros
- Relatórios customizados
- Exportação de dados

## 🚀 Instalação Rápida

```bash
# 1. Instalar dependências
chmod +x scripts/install_analytics.sh
./scripts/install_analytics.sh

# 2. Iniciar servidor
python3 app/main.py

# 3. Acessar painel admin
# URL: http://localhost:5000/admin/login
# Usuário: admin
# Senha: salvo2025admin
```

## 🗂️ Estrutura de Dados

### Interações Coletadas
```json
{
  "interaction_id": "uuid",
  "timestamp": "2025-09-26T14:30:00Z",
  "phone": "5511999999999",
  "location": {
    "latitude": -23.5617,
    "longitude": -46.6559,
    "city": "São Paulo",
    "state": "SP"
  },
  "search_type": "text|location|category",
  "search_term": "pizza",
  "results_count": 3,
  "results_clicked": 1,
  "hour": 14,
  "day_of_week": "thursday"
}
```

## 📊 Métricas Disponíveis

- **Total de interações** - Contador geral
- **Interações diárias** - Atividade por dia
- **Top termos de busca** - Palavras mais procuradas
- **Cidades mais ativas** - Distribuição geográfica
- **Padrões horários** - Picos de uso
- **Taxa de conversão** - Cliques vs visualizações

## 🔧 Endpoints da API

```
GET  /                     # Status da aplicação
GET  /health              # Health check
GET  /admin/login         # Login administrativo
GET  /admin/dashboard     # Dashboard principal
GET  /admin/sellers       # Gestão de sellers
GET  /admin/api/stats     # API de estatísticas
```

## 📁 Estrutura de Arquivos

```
├── app/
│   ├── api/analytics/           # APIs do sistema
│   ├── services/analytics/      # Lógica de negócio
│   └── templates/admin/         # Templates HTML
├── data/
│   ├── analytics/              # Dados de interações
│   ├── sellers/               # Base de estabelecimentos
│   └── users/                 # Usuários do sistema
├── static/admin/              # CSS/JS do painel
├── scripts/                   # Scripts de manutenção
└── logs/                      # Logs da aplicação
```

## 🛠️ Scripts Úteis

```bash
# Testar sistema
./scripts/test_analytics.sh

# Fazer backup
./scripts/backup_data.sh

# Instalar dependências
./scripts/install_analytics.sh
```

## 🔐 Segurança

- Autenticação baseada em sessões Flask
- Validação de dados de entrada
- Logs de acesso administrativo
- Separação de dados por tipo de usuário

## 📈 Roadmap de Monetização

### Fase 1 (Atual) - MVP
- [x] Coleta básica de dados
- [x] Dashboard administrativo
- [x] Visualizações essenciais

### Fase 2 - Premium
- [ ] Dashboards para clientes
- [ ] Heatmaps avançados
- [ ] API comercial
- [ ] Sistema de billing

### Fase 3 - Enterprise
- [ ] IA para insights
- [ ] Predições de tendência
- [ ] Integração com CRM
- [ ] White label

## 🤝 Suporte

Para questões técnicas ou melhorias, consulte a documentação ou entre em contato com a equipe de desenvolvimento.

---

**Salvô Analytics v1.0.0** - Sistema de Dados Monetizável
Desenvolvido para maximizar o valor dos dados de interação WhatsApp Business.
EOF

echo ""
echo "🎉 ========================================"
echo "✅ SISTEMA DE ANALYTICS COMPLETO!"
echo "========================================"
echo ""
echo "📊 Sistema criado com sucesso:"
echo "   • Base de dados estruturada"
echo "   • Dashboard administrativo completo"
echo "   • Gráficos interativos (Chart.js)"
echo "   • Sistema de autenticação"
echo "   • Dados de exemplo incluídos"
echo "   • Scripts de manutenção"
echo ""
echo "🚀 Para iniciar:"
echo "   1. ./scripts/install_analytics.sh"
echo "   2. python3 app/main.py"
echo "   3. http://localhost:5000/admin/login"
echo ""
echo "🔐 Credenciais Admin:"
echo "   Usuário: admin"
echo "   Senha: salvo2025admin"
echo ""
echo "📊 Funcionalidades ativas:"
echo "   • Dashboard em tempo real"
echo "   • Gestão de sellers"
echo "   • Coleta de interações"
echo "   • Estatísticas avançadas"
echo "   • Backup automático"
echo ""
echo "💰 Pronto para monetização!"
echo "📈 Base sólida para expansão"