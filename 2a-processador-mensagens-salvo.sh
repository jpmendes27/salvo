#!/bin/bash

# =================================================================
# SCRIPT 2a: PROCESSADOR DE MENSAGENS WHATSAPP - PROJETO SALVÔ
# Parte 2: Processamento de mensagens e envio
# Autor: Claude Assistant
# Data: 2025-09-26
# =================================================================

echo "🤖 PROCESSADOR DE MENSAGENS WHATSAPP - PARTE 2a"
echo "==============================================="

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Verificações iniciais
log_info "Verificando se Parte 1 foi executada..."

if [ ! -f "app/api/whatsapp/webhook.py" ]; then
    log_error "webhook.py não encontrado! Execute primeiro 2-integracao-whatsapp-salvo.sh"
    exit 1
fi

log_success "Estrutura WhatsApp básica encontrada!"

# =================================================================
# 1. CRIAR PROCESSADOR DE MENSAGENS
# =================================================================

log_info "Criando processador de mensagens..."

cat > app/services/whatsapp/message_processor.py << 'EOF'
"""
Processador de mensagens do WhatsApp - Salvô
Identifica intenções e processa diferentes tipos de mensagem
"""

import logging
import json
from typing import Dict, List, Optional
from app.services.whatsapp.sender import WhatsAppSender
from app.utils.message_parser import MessageParser

logger = logging.getLogger(__name__)

class MessageProcessor:
    """Processa mensagens recebidas do WhatsApp"""
    
    def __init__(self):
        self.sender = WhatsAppSender()
        self.parser = MessageParser()
    
    def process_messages(self, messages: List[Dict]):
        """Processa lista de mensagens"""
        for message in messages:
            try:
                self.process_single_message(message)
            except Exception as e:
                logger.error(f"❌ Erro processando mensagem: {e}")
    
    def process_single_message(self, message: Dict):
        """Processa uma mensagem individual"""
        
        # Extrair dados básicos
        phone = message.get('from', '')
        message_id = message.get('id', '')
        timestamp = message.get('timestamp', '')
        
        logger.info(f"📨 Processando mensagem de {phone}: {message_id}")
        
        # Verificar tipo de mensagem
        message_type = message.get('type', '')
        
        if message_type == 'text':
            self._handle_text_message(phone, message, message_id)
        elif message_type == 'location':
            self._handle_location_message(phone, message, message_id)
        elif message_type == 'interactive':
            self._handle_interactive_message(phone, message, message_id)
        else:
            # Mensagem não suportada
            self.sender.send_text_message(
                phone, 
                "Desculpe, ainda não consigo processar esse tipo de mensagem. "
                "Envie uma mensagem de texto ou sua localização! 😊"
            )
    
    def _handle_text_message(self, phone: str, message: Dict, message_id: str):
        """Processa mensagens de texto"""
        text_content = message.get('text', {}).get('body', '').lower().strip()
        
        if not text_content:
            return
        
        # Identificar intenção
        intent = self.parser.identify_intent(text_content)
        
        logger.info(f"🎯 Intenção identificada: {intent} para: {text_content}")
        
        if intent == 'greeting':
            self._send_welcome_message(phone)
        elif intent == 'search':
            self._handle_search_request(phone, text_content)
        elif intent == 'register':
            self._handle_registration_request(phone)
        elif intent == 'help':
            self._send_help_message(phone)
        else:
            # Intenção não identificada - assumir busca
            self._handle_search_request(phone, text_content)
    
    def _handle_location_message(self, phone: str, message: Dict, message_id: str):
        """Processa mensagens de localização"""
        location_data = message.get('location', {})
        latitude = location_data.get('latitude')
        longitude = location_data.get('longitude')
        
        if not latitude or not longitude:
            self.sender.send_text_message(
                phone,
                "📍 Não consegui obter sua localização. Tente enviar novamente!"
            )
            return
        
        logger.info(f"📍 Localização recebida: {latitude}, {longitude}")
        
        # Por enquanto, enviar mensagem que em breve teremos busca
        self.sender.send_text_message(
            phone,
            f"📍 *Localização recebida!*\n\n"
            f"Lat: {latitude}\nLng: {longitude}\n\n"
            f"🔄 Sistema de busca será implementado no próximo script!\n\n"
            f"Por enquanto, digite o que você procura (ex: 'pizza', 'farmácia')"
        )
    
    def _handle_interactive_message(self, phone: str, message: Dict, message_id: str):
        """Processa mensagens interativas (botões)"""
        interactive = message.get('interactive', {})
        button_reply = interactive.get('button_reply', {})
        button_id = button_reply.get('id', '')
        
        if button_id == 'new_search':
            self._send_search_instructions(phone)
        elif button_id == 'register_business':
            self._handle_registration_request(phone)
        elif button_id == 'help':
            self._send_help_message(phone)
    
    def _send_welcome_message(self, phone: str):
        """Envia mensagem de boas-vindas"""
        welcome_text = (
            "🤖 Olá! Eu sou o *Salvô*, seu assistente para encontrar comércios locais!\n\n"
            "Como posso te ajudar hoje?\n\n"
            "📍 *Envie sua localização* para encontrar negócios próximos\n"
            "💬 *Digite o que procura* (ex: 'pizzaria', 'farmácia')\n"
            "🏪 *Quer cadastrar seu negócio?* Digite 'cadastrar'"
        )
        
        # Enviar com botões interativos
        self.sender.send_interactive_message(
            phone,
            welcome_text,
            buttons=[
                {"id": "new_search", "title": "🔍 Buscar"},
                {"id": "register_business", "title": "🏪 Cadastrar"},
                {"id": "help", "title": "❓ Ajuda"}
            ]
        )
    
    def _handle_search_request(self, phone: str, search_term: str):
        """Lida com solicitações de busca por texto"""
        self.sender.send_text_message(
            phone,
            f"🔍 Entendi que você está procurando por: *{search_term}*\n\n"
            "Para te ajudar melhor, preciso da sua localização! 📍\n\n"
            "👆 Toque no clipe (📎) > Localização > Enviar localização atual\n\n"
            "🔄 *Sistema de busca real será implementado no próximo script!*"
        )
    
    def _handle_registration_request(self, phone: str):
        """Inicia processo de cadastro de negócio"""
        self.sender.send_text_message(
            phone,
            "🏪 *Cadastro de Negócio*\n\n"
            "Que legal! Vamos cadastrar seu negócio no Salvô!\n\n"
            "📝 Por enquanto, use nosso formulário online:\n"
            "👉 https://salvo.vancouvertec.com.br\n\n"
            "Em breve teremos o cadastro 100% pelo WhatsApp! 🚀"
        )
    
    def _send_help_message(self, phone: str):
        """Envia mensagem de ajuda"""
        help_text = (
            "❓ *Como usar o Salvô:*\n\n"
            "🔍 *Para buscar negócios:*\n"
            "• Envie sua localização 📍\n"
            "• Ou digite o que procura (ex: 'pizza')\n\n"
            "🏪 *Para cadastrar seu negócio:*\n"
            "• Digite 'cadastrar'\n"
            "• Acesse nosso formulário online\n\n"
            "💬 *Precisa de ajuda?*\n"
            "• Digite 'ajuda' a qualquer momento"
        )
        
        self.sender.send_text_message(phone, help_text)
    
    def _send_search_instructions(self, phone: str):
        """Envia instruções para busca"""
        self.sender.send_text_message(
            phone,
            "🔍 *Como fazer uma busca:*\n\n"
            "1️⃣ Envie sua localização atual 📍\n"
            "2️⃣ Ou digite o que você procura\n\n"
            "💡 *Exemplos:*\n"
            "• 'pizzaria'\n"
            "• 'farmácia'\n"
            "• 'mercado'\n"
            "• 'posto de gasolina'\n\n"
            "Vou buscar os 3 mais próximos de você! 🎯"
        )
EOF

# =================================================================
# 2. CRIAR SERVIÇO DE ENVIO WHATSAPP
# =================================================================

log_info "Criando serviço de envio WhatsApp..."

cat > app/services/whatsapp/sender.py << 'EOF'
"""
Serviço para enviar mensagens via WhatsApp Business API - Salvô
"""

import requests
import json
import logging
from flask import current_app
from typing import List, Dict, Optional

logger = logging.getLogger(__name__)

class WhatsAppSender:
    """Envia mensagens via WhatsApp Business API"""
    
    def __init__(self):
        self.base_url = "https://graph.facebook.com/v18.0"
        self.phone_number_id = current_app.config.get('WHATSAPP_PHONE_NUMBER_ID')
        self.access_token = current_app.config.get('WHATSAPP_TOKEN')
    
    def send_text_message(self, phone: str, message: str) -> Dict:
        """Envia mensagem de texto simples"""
        
        if not self.phone_number_id or not self.access_token:
            logger.error("❌ WhatsApp não configurado - tokens ausentes")
            return {"error": "WhatsApp não configurado"}
        
        url = f"{self.base_url}/{self.phone_number_id}/messages"
        
        headers = {
            "Authorization": f"Bearer {self.access_token}",
            "Content-Type": "application/json"
        }
        
        # Limpar número de telefone
        clean_phone = self._clean_phone_number(phone)
        
        payload = {
            "messaging_product": "whatsapp",
            "to": clean_phone,
            "type": "text",
            "text": {
                "body": message
            }
        }
        
        try:
            logger.info(f"📤 Enviando mensagem para {clean_phone}")
            
            response = requests.post(url, headers=headers, json=payload, timeout=30)
            
            if response.status_code == 200:
                logger.info(f"✅ Mensagem enviada para {clean_phone}")
                return {"success": True, "response": response.json()}
            else:
                logger.error(f"❌ Erro ao enviar: {response.status_code} - {response.text}")
                return {"error": f"HTTP {response.status_code}", "details": response.text}
                
        except requests.RequestException as e:
            logger.error(f"❌ Erro de conexão: {e}")
            return {"error": "Erro de conexão", "details": str(e)}
    
    def send_interactive_message(self, phone: str, message: str, buttons: List[Dict]) -> Dict:
        """Envia mensagem com botões interativos"""
        
        if not self.phone_number_id or not self.access_token:
            logger.error("❌ WhatsApp não configurado")
            return {"error": "WhatsApp não configurado"}
        
        url = f"{self.base_url}/{self.phone_number_id}/messages"
        
        headers = {
            "Authorization": f"Bearer {self.access_token}",
            "Content-Type": "application/json"
        }
        
        clean_phone = self._clean_phone_number(phone)
        
        # Construir botões (máximo 3 botões)
        button_components = []
        for i, btn in enumerate(buttons[:3]):
            button_components.append({
                "type": "button",
                "button": {
                    "type": "reply",
                    "reply": {
                        "id": btn["id"],
                        "title": btn["title"][:20]  # Máximo 20 caracteres
                    }
                }
            })
        
        payload = {
            "messaging_product": "whatsapp",
            "to": clean_phone,
            "type": "interactive",
            "interactive": {
                "type": "button",
                "body": {
                    "text": message
                },
                "action": {
                    "buttons": button_components
                }
            }
        }
        
        try:
            response = requests.post(url, headers=headers, json=payload, timeout=30)
            
            if response.status_code == 200:
                logger.info(f"✅ Mensagem interativa enviada para {clean_phone}")
                return {"success": True, "response": response.json()}
            else:
                logger.error(f"❌ Erro mensagem interativa: {response.status_code}")
                return {"error": f"HTTP {response.status_code}", "details": response.text}
                
        except requests.RequestException as e:
            logger.error(f"❌ Erro de conexão: {e}")
            return {"error": "Erro de conexão", "details": str(e)}
    
    def _clean_phone_number(self, phone: str) -> str:
        """Limpa e formata número de telefone"""
        # Remover todos os caracteres não numéricos
        clean = ''.join(filter(str.isdigit, phone))
        
        # Se começar com 0, remover
        if clean.startswith('0'):
            clean = clean[1:]
        
        # Se não começar com 55 (Brasil), adicionar
        if not clean.startswith('55'):
            clean = '55' + clean
        
        return clean
EOF

# =================================================================
# 3. CRIAR PARSER DE MENSAGENS (IDENTIFICAÇÃO DE INTENÇÕES)
# =================================================================

log_info "Criando parser de identificação de intenções..."

cat > app/utils/message_parser.py << 'EOF'
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
EOF

# =================================================================
# 4. CRIAR ARQUIVOS __INIT__.PY NECESSÁRIOS
# =================================================================

log_info "Criando arquivos __init__.py..."

cat > app/services/whatsapp/__init__.py << 'EOF'
"""
Serviços WhatsApp do Salvô
"""
from .message_processor import MessageProcessor
from .sender import WhatsAppSender

__all__ = ['MessageProcessor', 'WhatsAppSender']
EOF

cat > app/utils/__init__.py << 'EOF'
"""
Utilitários do Salvô
"""
from .message_parser import MessageParser

__all__ = ['MessageParser']
EOF

# =================================================================
# FINALIZAÇÃO PARTE 2a
# =================================================================

log_success "Processador de mensagens criado!"

echo ""
echo "✅ PARTE 2a CONCLUÍDA COM SUCESSO!"
echo "=================================="
echo ""
echo "🤖 O que foi implementado:"
echo "   ✅ MessageProcessor - processa mensagens recebidas"
echo "   ✅ WhatsAppSender - envia mensagens e botões" 
echo "   ✅ MessageParser - identifica intenções do usuário"
echo "   ✅ Suporte a texto, localização e botões interativos"
echo ""
echo "🎯 Funcionalidades ativas:"
echo "   📨 Recebimento de mensagens"
echo "   🤝 Saudações e boas-vindas"
echo "   🔍 Identificação de intenções de busca"
echo "   🏪 Solicitações de cadastro"
echo "   ❓ Sistema de ajuda"
echo "   📍 Recebimento de localização"
echo ""
echo "🧪 Para testar agora:"
echo "   1. Configure tokens no .env"
echo "   2. python app/main.py"
echo "   3. POST /api/whatsapp/test"
echo "   4. Configure webhook no Facebook"
echo ""
echo "🚀 Próximo passo:"
echo "   ./2b-sistema-busca-salvo.sh"
echo "   (Sistema de busca por geolocalização)"
echo ""