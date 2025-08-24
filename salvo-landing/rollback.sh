#!/bin/bash

# Script de rollback para versão anterior

VPS_HOST="212.85.1.55"
VPS_USER="salvo-vtec"
VPS_PASSWORD="Bj4hwtmpSXA0ELI32nsI"
VPS_PATH="/home/salvo-vtec/htdocs/salvo.vancouvertec.com.br"

echo "🔄 Fazendo rollback para versão anterior..."

# Listar backups disponíveis
echo "📋 Backups disponíveis:"
sshpass -p "$VPS_PASSWORD" ssh -o StrictHostKeyChecking=no "$VPS_USER@$VPS_HOST" "ls -la /home/$VPS_USER/backups/ | grep landing"

echo ""
echo "Para fazer rollback manual:"
echo "1. ssh $VPS_USER@$VPS_HOST"
echo "2. cp -r /home/$VPS_USER/backups/landing-YYYYMMDD_HHMMSS/* $VPS_PATH/"
echo "3. Confirme a restauração"
