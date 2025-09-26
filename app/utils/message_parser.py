"""
Parser de mensagens - Identifica intenções do usuário - Salvô
"""

import re
import logging
from typing import str

logger = logging.getLogger(__name__)

class MessageParser:
    """Identifica intenções em mensagens de texto"""
    
    def __init__(self):
        # Padrões de saudação
        self.greeting_patterns = [
            r'\b(oi|olá|ola|hey|ei|bom dia|boa tarde|boa noite)\b',
            r'\b(tchau|até logo|falou|obrigad[ao])\b'
        ]
        
        # Padrões de busca
        self.search_patterns = [
            r'\b(procur[oaei]|quero|preciso|busco|onde)\b',
            r'\b(pizza|farmacia|mercado|posto|padaria|restaurante)\b',
            r'\b(comida|remedio|gasolina|pão|lanche)\b'
        ]
        
        # Padrões de cadastro
        self.register_patterns = [
            r'\b(cadastr[oaei]|registr[oaei]|anunci[oaei])\b',
            r'\b(meu negocio|minha empresa|minha loja)\b',
            r'\b(divulgar|promover|vender)\b'
        ]
        
        # Padrões de ajuda
        self.help_patterns = [
            r'\b(ajuda|help|como|tutorial|duvida)\b',
            r'\b(não entendi|não sei|me explica)\b'
        ]
    
    def identify_intent(self, text: str) -> str:
        """
        Identifica a intenção principal do texto
        
        Returns:
            'greeting', 'search', 'register', 'help', ou 'unknown'
        """
        
        if not text or not text.strip():
            return 'unknown'
        
        text_lower = text.lower().strip()
        
        # Verificar saudações primeiro
        if self._matches_patterns(text_lower, self.greeting_patterns):
            logger.debug("🤝 Intenção: saudação")
            return 'greeting'
        
        # Verificar cadastro
        if self._matches_patterns(text_lower, self.register_patterns):
            logger.debug("🏪 Intenção: cadastro")
            return 'register'
        
        # Verificar ajuda
        if self._matches_patterns(text_lower, self.help_patterns):
            logger.debug("❓ Intenção: ajuda")
            return 'help'
        
        # Verificar busca
        if self._matches_patterns(text_lower, self.search_patterns):
            logger.debug("🔍 Intenção: busca")
            return 'search'
        
        # Se não identificou, assumir que é busca (comportamento padrão)
        logger.debug("🔍 Intenção: busca (padrão)")
        return 'search'
    
    def _matches_patterns(self, text: str, patterns: list) -> bool:
        """Verifica se texto corresponde a algum padrão da lista"""
        for pattern in patterns:
            if re.search(pattern, text, re.IGNORECASE):
                return True
        return False
    
    def extract_search_terms(self, text: str) -> list:
        """Extrai termos de busca do texto"""
        # Palavras comuns a ignorar
        stop_words = [
            'o', 'a', 'os', 'as', 'um', 'uma', 'de', 'do', 'da', 'dos', 'das',
            'em', 'no', 'na', 'nos', 'nas', 'para', 'por', 'com', 'sem',
            'que', 'qual', 'quais', 'onde', 'como', 'quando', 'porque',
            'eu', 'você', 'ele', 'ela', 'nós', 'vocês', 'eles', 'elas',
            'meu', 'minha', 'seu', 'sua', 'nosso', 'nossa',
            'procuro', 'quero', 'preciso', 'busco', 'procurar', 'encontrar'
        ]
        
        # Limpar e dividir texto
        words = re.findall(r'\b\w+\b', text.lower())
        
        # Filtrar palavras relevantes
        search_terms = [
            word for word in words 
            if len(word) > 2 and word not in stop_words
        ]
        
        return search_terms[:5]  # Máximo 5 termos
