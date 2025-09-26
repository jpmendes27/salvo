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
