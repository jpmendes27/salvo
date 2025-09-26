"""
Serviços WhatsApp do Salvô
"""
from .message_processor import MessageProcessor
from .sender import WhatsAppSender

__all__ = ['MessageProcessor', 'WhatsAppSender']
