#!/bin/bash

# Script 2h: Corrigir Formulários e Fontes WhatsApp - Salvô Landing Page
# Autor: Rafael Ferreira
# Data: 2025-08-16
# Uso: cp ../scripts/2h_fix_forms_fonts.sh . && chmod +x 2h_fix_forms_fonts.sh && ./2h_fix_forms_fonts.sh

echo "🔤 Salvô - Correção de Formulários e Fontes WhatsApp..."

# Verificar se está na pasta correta
if [ ! -f "index.html" ] || [ ! -d "assets" ]; then
    echo "❌ Erro: Execute este script dentro da pasta salvo-landing"
    echo "📁 Comando correto:"
    echo "   cd salvo-landing"
    echo "   cp ../scripts/2h_fix_forms_fonts.sh ."
    echo "   chmod +x 2h_fix_forms_fonts.sh && ./2h_fix_forms_fonts.sh"
    exit 1
fi

echo "✅ Pasta do projeto encontrada!"

# Backup dos arquivos que serão modificados
echo "💾 Criando backup dos arquivos..."

BACKUP_DIR="backup-2h-$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

# Fazer backup dos arquivos principais
cp index.html "$BACKUP_DIR/" 2>/dev/null
cp assets/css/style.css "$BACKUP_DIR/" 2>/dev/null

echo "✅ Backup criado em: $BACKUP_DIR"

# 1. CRIAR FONTES PADRÃO WHATSAPP
echo "🔤 Configurando fontes no padrão WhatsApp..."

cat > assets/css/whatsapp-fonts.css << 'EOF'
/* ========================================
   SALVÔ - FONTES PADRÃO WHATSAPP
======================================== */

@import url('https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;600;700&display=swap');

:root {
  /* Fontes WhatsApp */
  --font-whatsapp: 'Roboto', -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
  
  /* Pesos das fontes */
  --font-weight-light: 300;
  --font-weight-normal: 400;
  --font-weight-medium: 500;
  --font-weight-semibold: 600;
  --font-weight-bold: 700;
  
  /* Tamanhos de fonte */
  --font-size-xs: 0.75rem;     /* 12px */
  --font-size-sm: 0.875rem;    /* 14px */
  --font-size-base: 1rem;      /* 16px */
  --font-size-lg: 1.125rem;    /* 18px */
  --font-size-xl: 1.25rem;     /* 20px */
  --font-size-2xl: 1.5rem;     /* 24px */
  --font-size-3xl: 1.875rem;   /* 30px */
  --font-size-4xl: 2.25rem;    /* 36px */
}

/* Aplicar fontes aos elementos */
body {
  font-family: var(--font-whatsapp);
  font-weight: var(--font-weight-normal);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

h1, h2, h3, h4, h5, h6 {
  font-family: var(--font-whatsapp);
  font-weight: var(--font-weight-semibold);
}

.btn {
  font-family: var(--font-whatsapp);
  font-weight: var(--font-weight-medium);
}

.form__label {
  font-family: var(--font-whatsapp);
  font-weight: var(--font-weight-medium);
  font-size: var(--font-size-sm);
}

.form__input {
  font-family: var(--font-whatsapp);
  font-weight: var(--font-weight-normal);
  font-size: var(--font-size-base);
}

.nav__link {
  font-family: var(--font-whatsapp);
  font-weight: var(--font-weight-medium);
}

.chat__message {
  font-family: var(--font-whatsapp);
  font-weight: var(--font-weight-normal);
}

/* Responsivo */
@media (max-width: 768px) {
  :root {
    --font-size-4xl: 2rem;
    --font-size-3xl: 1.625rem;
    --font-size-2xl: 1.375rem;
  }
}
EOF

echo "✅ Fontes WhatsApp configuradas!"

# 2. CRIAR ESTILOS MELHORADOS PARA FORMULÁRIOS
echo "📝 Criando estilos melhorados para formulários..."

cat > assets/css/forms-improved.css << 'EOF'
/* ========================================
   SALVÔ - FORMULÁRIOS MELHORADOS
======================================== */

/* Modal aprimorado */
.modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  padding: 1rem;
  opacity: 0;
  visibility: hidden;
  transition: all 0.3s ease;
}

.modal.active {
  opacity: 1;
  visibility: visible;
}

.modal__content {
  background: var(--color-white);
  border-radius: 20px;
  max-width: 500px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
  transform: scale(0.9) translateY(20px);
  transition: all 0.3s ease;
}

.modal.active .modal__content {
  transform: scale(1) translateY(0);
}

/* Header do formulário */
.form__header {
  background: linear-gradient(135deg, #25D366 0%, #128C7E 100%);
  color: white;
  padding: 2rem 2rem 1.5rem;
  border-radius: 20px 20px 0 0;
  position: relative;
  text-align: center;
}

.form__header h2 {
  font-size: 1.5rem;
  font-weight: var(--font-weight-semibold);
  margin-bottom: 0.5rem;
  color: white;
}

.form__header p {
  font-size: 0.9rem;
  opacity: 0.9;
  margin-bottom: 0;
}

.form__close {
  position: absolute;
  top: 1rem;
  right: 1rem;
  background: rgba(255, 255, 255, 0.2);
  border: none;
  color: white;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 1.25rem;
  transition: all 0.2s ease;
}

.form__close:hover {
  background: rgba(255, 255, 255, 0.3);
  transform: scale(1.1);
}

/* Container do formulário */
.form {
  padding: 2rem;
}

/* Grupos de campos */
.form__group {
  margin-bottom: 1.5rem;
}

.form__row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

@media (max-width: 640px) {
  .form__row {
    grid-template-columns: 1fr;
  }
}

/* Labels */
.form__label {
  display: block;
  color: #374151;
  margin-bottom: 0.5rem;
  transition: color 0.2s ease;
}

/* Inputs */
.form__input {
  width: 100%;
  padding: 12px 16px;
  border: 2px solid #D1D5DB;
  border-radius: 12px;
  font-size: 1rem;
  color: #111827;
  background: white;
  transition: all 0.2s ease;
  box-sizing: border-box;
}

.form__input::placeholder {
  color: #9CA3AF;
}

.form__input:focus {
  outline: none;
  border-color: #25D366;
  box-shadow: 0 0 0 3px rgba(37, 211, 102, 0.1);
}

/* Select */
select.form__input {
  cursor: pointer;
}

/* Checkbox */
.form__checkbox {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  cursor: pointer;
  font-size: 0.875rem;
  line-height: 1.5;
  color: #374151;
}

.form__checkbox input[type="checkbox"] {
  width: 18px;
  height: 18px;
  cursor: pointer;
  margin: 0;
}

.form__checkbox a {
  color: #25D366;
  text-decoration: none;
  font-weight: var(--font-weight-medium);
}

.form__checkbox a:hover {
  text-decoration: underline;
}

/* Mensagens de erro */
.form__error {
  display: block;
  color: #EF4444;
  font-size: 0.75rem;
  margin-top: 0.25rem;
  min-height: 1rem;
}

/* Estados de validação */
.form__group.error .form__input {
  border-color: #EF4444;
  background: rgba(239, 68, 68, 0.05);
}

.form__group.success .form__input {
  border-color: #25D366;
  background: rgba(37, 211, 102, 0.05);
}

/* Responsivo */
@media (max-width: 768px) {
  .form__header {
    padding: 1.5rem 1.5rem 1rem;
  }
  
  .form {
    padding: 1.5rem;
  }
  
  .form__input {
    font-size: 16px; /* Evita zoom no iOS */
  }
}
EOF

echo "✅ Estilos de formulários criados!"

# 3. CORRIGIR LINKS DE TERMOS E PRIVACIDADE
echo "📋 Corrigindo links de termos e privacidade..."

if [ -f "index.html" ]; then
    # Corrigir todos os links de termos e privacidade
    sed -i 's|href="/termos"|href="termos.html"|g' index.html
    sed -i 's|href="/privacidade"|href="privacidade.html"|g' index.html
    
    echo "✅ Links de termos e privacidade corrigidos!"
fi

# 4. INTEGRAR NOVOS ESTILOS AO CSS PRINCIPAL
echo "🔗 Integrando estilos ao CSS principal..."

if [ -f "assets/css/style.css" ]; then
    # Adicionar importação no início do arquivo
    sed -i '1i/* Importar estilos WhatsApp */\n@import url("whatsapp-fonts.css");\n@import url("forms-improved.css");\n' assets/css/style.css
    
    echo "✅ Estilos integrados!"
else
    echo "❌ Arquivo CSS principal não encontrado!"
fi

# 5. VERIFICAÇÕES FINAIS
echo "🔍 Executando verificações finais..."

# Verificar arquivos criados
created_files=("assets/css/whatsapp-fonts.css" "assets/css/forms-improved.css")
missing_files=()

for file in "${created_files[@]}"; do
    if [ ! -f "$file" ]; then
        missing_files+=("$file")
    fi
done

if [ ${#missing_files[@]} -eq 0 ]; then
    echo "✅ Todos os arquivos foram criados!"
else
    echo "⚠️ Arquivos faltando:"
    printf '%s\n' "${missing_files[@]}"
fi

# Gerar relatório
echo ""
echo "📋 Relatório do Script 2h:"
echo "=================================================="
echo "✅ Fontes WhatsApp configuradas"
echo "✅ Estilos de formulários melhorados"
echo "✅ Links de termos/privacidade corrigidos"
echo "✅ Integração com CSS principal"
echo ""
echo "📁 Backup salvo em: $BACKUP_DIR"
echo ""
echo "🎯 Próximo passo:"
echo "   Execute o script 2i para validações JavaScript"
echo "   cp ../scripts/2i_javascript_validations.sh ."
echo "   chmod +x 2i_javascript_validations.sh && ./2i_javascript_validations.sh"
echo ""
echo "🌟 Script 2h concluído com sucesso!"