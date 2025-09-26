"""
Serviço de busca por localização - Salvô
Encontra negócios próximos usando geolocalização
"""

import json
import logging
import math
from typing import List, Dict, Optional
from haversine import haversine, Unit

logger = logging.getLogger(__name__)

class LocationSearchService:
    """Busca negócios por proximidade geográfica"""
    
    def __init__(self):
        self.sellers_file = "data/sellers/sellers.json"
        self.max_results = 3
        self.default_radius = 5.0  # km
    
    def search_nearby_businesses(
        self, 
        user_lat: float, 
        user_lng: float, 
        radius_km: float = None,
        category: str = None
    ) -> List[Dict]:
        """
        Busca negócios próximos à localização do usuário
        
        Args:
            user_lat: Latitude do usuário
            user_lng: Longitude do usuário
            radius_km: Raio de busca em km (default: 5)
            category: Categoria específica (opcional)
        
        Returns:
            Lista de negócios próximos ordenados por distância
        """
        
        if radius_km is None:
            radius_km = self.default_radius
        
        try:
            # Carregar dados dos sellers
            sellers_data = self._load_sellers_data()
            
            if not sellers_data or 'sellers' not in sellers_data:
                logger.warning("⚠️ Nenhum seller encontrado no banco de dados")
                return []
            
            nearby_businesses = []
            user_location = (user_lat, user_lng)
            
            for seller in sellers_data['sellers']:
                try:
                    # Verificar se seller está ativo
                    if seller.get('status') != 'active':
                        continue
                    
                    # Obter coordenadas do seller
                    seller_lat = seller.get('latitude')
                    seller_lng = seller.get('longitude')
                    
                    if seller_lat is None or seller_lng is None:
                        logger.debug(f"Seller {seller.get('id')} sem coordenadas")
                        continue
                    
                    seller_location = (seller_lat, seller_lng)
                    
                    # Calcular distância
                    distance_km = haversine(user_location, seller_location, unit=Unit.KILOMETERS)
                    
                    # Verificar se está dentro do raio
                    if distance_km <= radius_km:
                        
                        # Filtrar por categoria se especificado
                        if category and not self._matches_category(seller, category):
                            continue
                        
                        # Adicionar distância aos dados do seller
                        seller_with_distance = seller.copy()
                        seller_with_distance['distance_km'] = round(distance_km, 1)
                        seller_with_distance['distance_meters'] = round(distance_km * 1000)
                        
                        nearby_businesses.append(seller_with_distance)
                
                except Exception as e:
                    logger.error(f"❌ Erro processando seller {seller.get('id', 'N/A')}: {e}")
                    continue
            
            # Ordenar por distância e limitar resultados
            nearby_businesses.sort(key=lambda x: x['distance_km'])
            
            logger.info(f"🎯 Encontrados {len(nearby_businesses)} negócios próximos")
            
            return nearby_businesses[:self.max_results]
        
        except Exception as e:
            logger.error(f"❌ Erro na busca por localização: {e}")
            return []
    
    def search_by_text_and_location(
        self, 
        user_lat: float, 
        user_lng: float, 
        search_text: str,
        radius_km: float = None
    ) -> List[Dict]:
        """
        Busca negócios por texto e proximidade
        
        Args:
            user_lat: Latitude do usuário
            user_lng: Longitude do usuário  
            search_text: Texto de busca
            radius_km: Raio de busca em km
        
        Returns:
            Lista de negócios que correspondem ao texto e localização
        """
        
        # Primeiro buscar por proximidade
        nearby_businesses = self.search_nearby_businesses(user_lat, user_lng, radius_km)
        
        if not nearby_businesses:
            return []
        
        # Filtrar por relevância do texto
        relevant_businesses = []
        search_keywords = self._extract_keywords(search_text)
        
        for business in nearby_businesses:
            relevance_score = self._calculate_text_relevance(business, search_keywords)
            
            if relevance_score > 0:
                business['relevance_score'] = relevance_score
                relevant_businesses.append(business)
        
        # Ordenar por relevância e depois por distância
        relevant_businesses.sort(key=lambda x: (-x['relevance_score'], x['distance_km']))
        
        return relevant_businesses[:self.max_results]
    
    def _load_sellers_data(self) -> Dict:
        """Carrega dados dos sellers do arquivo JSON"""
        try:
            with open(self.sellers_file, 'r', encoding='utf-8') as file:
                return json.load(file)
        except FileNotFoundError:
            logger.error(f"❌ Arquivo {self.sellers_file} não encontrado")
            return {}
        except json.JSONDecodeError as e:
            logger.error(f"❌ Erro ao decodificar JSON: {e}")
            return {}
        except Exception as e:
            logger.error(f"❌ Erro ao carregar sellers: {e}")
            return {}
    
    def _matches_category(self, seller: Dict, category: str) -> bool:
        """Verifica se seller corresponde à categoria"""
        seller_category = seller.get('categoria', '').lower()
        return category.lower() in seller_category
    
    def _extract_keywords(self, text: str) -> List[str]:
        """Extrai palavras-chave do texto de busca"""
        # Normalizar texto
        normalized = text.lower().strip()
        
        # Mapa de palavras-chave para categorias
        keyword_map = {
            'pizza': ['pizza', 'pizzaria'],
            'farmacia': ['farmacia', 'farmácia', 'remedio', 'medicamento'],
            'mercado': ['mercado', 'supermercado', 'compras'],
            'posto': ['posto', 'gasolina', 'combustivel'],
            'padaria': ['padaria', 'pão', 'pao'],
            'restaurante': ['restaurante', 'comida', 'almoço', 'jantar'],
            'lanchonete': ['lanchonete', 'lanche', 'sanduiche'],
            'barbearia': ['barbearia', 'cabelo', 'barba'],
            'salao': ['salao', 'salão', 'beleza', 'manicure'],
            'oficina': ['oficina', 'mecanica', 'carro', 'auto']
        }
        
        keywords = []
        
        # Procurar palavras-chave no texto
        for category, terms in keyword_map.items():
            for term in terms:
                if term in normalized:
                    keywords.append(category)
                    break
        
        # Se não encontrou categoria específica, usar palavras do texto
        if not keywords:
            words = normalized.split()
            keywords = [word for word in words if len(word) > 2][:3]
        
        return keywords
    
    def _calculate_text_relevance(self, business: Dict, keywords: List[str]) -> float:
        """Calcula relevância do negócio para as palavras-chave"""
        if not keywords:
            return 1.0  # Se não há keywords, considera relevante
        
        business_text = (
            business.get('nome', '') + ' ' + 
            business.get('categoria', '')
        ).lower()
        
        relevance = 0.0
        
        for keyword in keywords:
            if keyword in business_text:
                # Categoria tem peso maior que nome
                if keyword in business.get('categoria', '').lower():
                    relevance += 2.0
                else:
                    relevance += 1.0
        
        return relevance
