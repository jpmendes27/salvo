#!/bin/bash

# Script 3a: Sistema de Analytics - Serviços de Dados (Parte 1a)
# Autor: Sistema Analytics
# Data: 2025-09-26
# Descrição: Criação dos serviços de coleta e processamento de dados

echo "📊 Iniciando criação dos Serviços de Dados - Salvô (Parte 1a)..."

# Verificar se a parte 1 foi executada
if [ ! -d "app/api/analytics" ]; then
    echo "❌ Execute primeiro: ./3-analytics-base-salvo.sh"
    exit 1
fi

echo "✅ Estrutura base verificada"

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

# Criar processador de dados
echo "📈 Criando processador de dados..."
cat > app/services/analytics/data_processor.py << 'EOF'
"""
Data Processor - Processamento e agregação de dados analytics
"""

import json
from pathlib import Path
from datetime import datetime, timedelta
from collections import defaultdict, Counter
import logging

logger = logging.getLogger(__name__)

class DataProcessor:
    """Processa e agrega dados de analytics para relatórios"""
    
    def __init__(self):
        self.analytics_file = Path("data/analytics/interactions.json")
        self.daily_stats_file = Path("data/analytics/daily_stats.json")
    
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
    
    def get_search_trends(self, days=30):
        """Retorna tendências de busca dos últimos N dias"""
        try:
            analytics_data = self._load_analytics_data()
            interactions = analytics_data.get("interactions", [])
            
            cutoff_date = (datetime.now() - timedelta(days=days)).strftime('%Y-%m-%d')
            recent_interactions = [
                i for i in interactions 
                if i.get('timestamp', '')[:10] >= cutoff_date
            ]
            
            # Agrupar por data
            daily_searches = defaultdict(list)
            for interaction in recent_interactions:
                date = interaction.get('timestamp', '')[:10]
                search_term = interaction.get('search_term', '').lower()
                if search_term:
                    daily_searches[date].append(search_term)
            
            # Contar termos únicos por dia
            trend_data = {}
            for date, searches in daily_searches.items():
                trend_data[date] = {
                    'total_searches': len(searches),
                    'unique_terms': len(set(searches)),
                    'top_term': Counter(searches).most_common(1)[0] if searches else None
                }
            
            return trend_data
            
        except Exception as e:
            logger.error(f"Erro ao processar tendências de busca: {e}")
            return {}
    
    def get_location_stats(self):
        """Retorna estatísticas por localização"""
        try:
            analytics_data = self._load_analytics_data()
            interactions = analytics_data.get("interactions", [])
            
            # Agrupar por cidade e estado
            city_stats = defaultdict(int)
            state_stats = defaultdict(int)
            
            for interaction in interactions:
                city = interaction.get('city', '')
                state = interaction.get('state', '')
                
                if city:
                    city_stats[city] += 1
                if state:
                    state_stats[state] += 1
            
            return {
                'cities': dict(Counter(city_stats).most_common(10)),
                'states': dict(Counter(state_stats).most_common(10))
            }
            
        except Exception as e:
            logger.error(f"Erro ao processar estatísticas de localização: {e}")
            return {'cities': {}, 'states': {}}
    
    def _load_analytics_data(self):
        """Carrega dados de analytics"""
        try:
            if self.analytics_file.exists():
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

echo ""
echo "✅ PARTE 1a CONCLUÍDA!"
echo "📊 Serviços de dados criados:"
echo "   • DataCollector - Coleta de interações"
echo "   • SimpleAuth - Autenticação"
echo "   • DataProcessor - Processamento de dados"
echo ""
echo "🚀 Execute a Parte 1b:"
echo "chmod +x 3b-analytics-routes-salvo.sh && ./3b-analytics-routes-salvo.sh"