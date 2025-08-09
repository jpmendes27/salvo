.PHONY: help setup install dev prod test lint format clean

help:  ## Mostrar esta ajuda
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

setup:  ## Configurar ambiente virtual e instalar dependências
	@echo "🔧 Configurando ambiente..."
	@./scripts/setup_environment.sh

install:  ## Instalar/atualizar dependências
	@echo "📦 Instalando dependências..."
	@source venv/bin/activate && pip install -r requirements.txt

dev:  ## Executar servidor de desenvolvimento
	@echo "🚀 Iniciando servidor de desenvolvimento..."
	@./scripts/dev_server.sh

prod:  ## Executar servidor de produção
	@echo "🏭 Iniciando servidor de produção..."
	@./scripts/production_server.sh

test:  ## Executar testes
	@echo "🧪 Executando testes..."
	@./scripts/run_tests.sh

lint:  ## Verificar qualidade do código
	@echo "🧹 Verificando qualidade do código..."
	@./scripts/lint_code.sh

format:  ## Formatar código
	@echo "🎨 Formatando código..."
	@./scripts/format_code.sh

clean:  ## Limpar arquivos temporários
	@echo "🧹 Limpando arquivos temporários..."
	@find . -type f -name "*.pyc" -delete
	@find . -type d -name "__pycache__" -delete
	@find . -type f -name "*.log" -delete
	@rm -rf .pytest_cache
	@rm -rf tests/reports
	@echo "✅ Limpeza concluída!"

status:  ## Mostrar status do projeto
	@echo "📊 Status do Projeto Salvô"
	@echo "=========================="
	@echo "🐍 Python: $(shell python3 --version 2>/dev/null || echo 'Não instalado')"
	@echo "📦 pip: $(shell pip3 --version 2>/dev/null || echo 'Não instalado')"
	@echo "🔧 Ambiente virtual: $(shell [ -d venv ] && echo 'Configurado' || echo 'Não configurado')"
	@echo "⚙️ Arquivo .env: $(shell [ -f .env ] && echo 'Configurado' || echo 'Não configurado')"
	@echo ""
	@echo "📋 Comandos disponíveis:"
	@make help
