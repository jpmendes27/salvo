"""
Sistema de Autenticação Simples para Analytics
"""

import json
import os
from pathlib import Path
from flask import session
import logging

logger = logging.getLogger(__name__)

class SimpleAuth:
    """Sistema de autenticação simples baseado em sessões Flask"""
    
    def __init__(self):
        # Corrigir caminho - voltar para raiz do projeto
        current_dir = os.path.dirname(os.path.abspath(__file__))
        project_root = os.path.dirname(os.path.dirname(os.path.dirname(current_dir)))
        self.users_file = os.path.join(project_root, "data", "users", "clients.json")
        logger.info(f"📁 Caminho do arquivo de usuários: {self.users_file}")
    
    def login(self, username, password, user_type="admin"):
        """
        Realiza login do usuário
        """
        try:
            logger.info(f"Tentativa de login: username={username}, user_type={user_type}")
            
            users_data = self._load_users()
            logger.info(f"Dados carregados: {users_data}")
            
            if user_type == "admin":
                admin_data = users_data.get("admin", {})
                logger.info(f"Admin data: {admin_data}")
                
                admin_username = admin_data.get("username")
                admin_password = admin_data.get("password")
                
                logger.info(f"Comparando: '{username}' == '{admin_username}' and '{password}' == '{admin_password}'")
                
                if admin_username == username and admin_password == password:
                    session["user_id"] = username
                    session["user_type"] = "admin"
                    session["logged_in"] = True
                    logger.info(f"✅ Login admin bem-sucedido: {username}")
                    return True
                else:
                    logger.error(f"❌ Credenciais incorretas - Username match: {admin_username == username}, Password match: {admin_password == password}")
            
            elif user_type == "client":
                clients = users_data.get("clients", {})
                for client_id, client_data in clients.items():
                    if client_data.get("username") == username and client_data.get("password") == password:
                        session["user_id"] = client_id
                        session["user_type"] = "client"
                        session["logged_in"] = True
                        session["plan"] = client_data.get("plan", "basic")
                        logger.info(f"✅ Login cliente bem-sucedido: {username}")
                        return True
            
            logger.error(f"❌ Login falhou para: {username}")
            return False
            
        except Exception as e:
            logger.error(f"❌ Erro no login: {e}")
            return False
    
    def logout(self):
        """Realiza logout do usuário"""
        session.clear()
        logger.info("✅ Logout realizado")
    
    def is_logged_in(self):
        """Verifica se usuário está logado"""
        logged_in = session.get("logged_in", False)
        logger.info(f"Verificação de login: {logged_in}")
        return logged_in
    
    def is_admin(self):
        """Verifica se usuário é admin"""
        is_admin = session.get("user_type") == "admin"
        logger.info(f"Verificação de admin: {is_admin}")
        return is_admin
    
    def is_client(self):
        """Verifica se usuário é cliente"""
        return session.get("user_type") == "client"
    
    def get_user_plan(self):
        """Retorna plano do cliente"""
        return session.get("plan", "basic")
    
    def _load_users(self):
        """Carrega dados de usuários"""
        try:
            logger.info(f"🔍 Tentando carregar arquivo: {self.users_file}")
            logger.info(f"📁 Arquivo existe? {os.path.exists(self.users_file)}")
            
            if os.path.exists(self.users_file):
                with open(self.users_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    logger.info(f"✅ Arquivo de usuários carregado com sucesso!")
                    logger.info(f"📄 Conteúdo: {data}")
                    return data
            else:
                logger.error(f"❌ Arquivo não encontrado: {self.users_file}")
                
        except Exception as e:
            logger.error(f"❌ Erro ao carregar usuários: {e}")
        
        logger.warning("⚠️ Retornando estrutura de usuários vazia")
        return {"admin": {}, "clients": {}}
