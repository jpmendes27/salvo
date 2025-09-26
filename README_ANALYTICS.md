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
