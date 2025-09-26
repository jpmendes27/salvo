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
