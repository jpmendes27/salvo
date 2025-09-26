"""
Webhook do WhatsApp Business API - Salvô
"""

from flask import Blueprint, request, jsonify, current_app
import json
import logging
from app.services.whatsapp.message_processor import MessageProcessor

whatsapp_bp = Blueprint('whatsapp', __name__)
logger = logging.getLogger(__name__)

@whatsapp_bp.route('/webhook', methods=['GET'])
def verify_webhook():
    """Verificação do webhook pelo Facebook"""
    verify_token = request.args.get('hub.verify_token')
    challenge = request.args.get('hub.challenge')
    
    expected_token = current_app.config.get('WHATSAPP_VERIFY_TOKEN')
    
    if verify_token == expected_token:
        logger.info("✅ Webhook verificado com sucesso")
        return challenge
    else:
        logger.error("❌ Token de verificação inválido")
        return "Token inválido", 403

@whatsapp_bp.route('/webhook', methods=['POST'])
def handle_webhook():
    """Processa mensagens recebidas do WhatsApp"""
    try:
        data = request.get_json()
        logger.info(f"📨 Mensagem recebida: {json.dumps(data, indent=2)}")
        
        if not data:
            return jsonify({"error": "No data received"}), 400
        
        # Verificar se é uma mensagem válida
        if 'entry' not in data:
            return jsonify({"status": "no_entry"}), 200
            
        for entry in data['entry']:
            if 'changes' not in entry:
                continue
                
            for change in entry['changes']:
                if change.get('field') == 'messages':
                    message_data = change.get('value', {})
                    if 'messages' in message_data:
                        processor = MessageProcessor()
                        processor.process_messages(message_data['messages'])
        
        return jsonify({"status": "success"}), 200
        
    except Exception as e:
        logger.error(f"❌ Erro no webhook: {str(e)}")
        return jsonify({"error": str(e)}), 500

@whatsapp_bp.route('/test', methods=['POST'])
def test_send():
    """Endpoint de teste para enviar mensagens"""
    try:
        data = request.get_json()
        phone = data.get('phone')
        message = data.get('message')
        
        if not phone or not message:
            return jsonify({"error": "Phone and message required"}), 400
        
        from app.services.whatsapp.sender import WhatsAppSender
        sender = WhatsAppSender()
        result = sender.send_text_message(phone, message)
        
        return jsonify(result), 200
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500
