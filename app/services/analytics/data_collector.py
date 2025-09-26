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
