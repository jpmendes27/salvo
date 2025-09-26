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
