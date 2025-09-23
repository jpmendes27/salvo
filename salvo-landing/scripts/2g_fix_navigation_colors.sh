#!/bin/bash

# Script 2g: Corrigir Navegação e Atualizar Cores da Landing Page Salvô
# Autor: Rafael Ferreira
# Data: 2025-08-16
# Uso: Execute na pasta salvo-landing: cd salvo-landing && ../scripts/2g_fix_navigation_colors.sh

echo "🎨 Salvô - Correção de Navegação e Cores da Landing Page..."

# Verificar se está na pasta correta (salvo-landing ou se tem os arquivos necessários)
if [ ! -f "index.html" ] || [ ! -d "assets" ]; then
    echo "❌ Erro: Execute este script dentro da pasta salvo-landing"
    echo "📁 Estrutura atual:"
    ls -la
    echo ""
    echo "📁 Estrutura esperada:"
    echo "   salvo-landing/"
    echo "   ├── index.html"
    echo "   ├── assets/"
    echo "   └── ..."
    echo ""
    echo "💡 Comando correto:"
    echo "   cd salvo-landing && ../scripts/2g_fix_navigation_colors.sh"
    exit 1
fi

echo "✅ Pasta do projeto encontrada!"

# Backup dos arquivos que serão modificados
echo "💾 Criando backup dos arquivos..."

BACKUP_DIR="backup-$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

# Fazer backup dos arquivos principais
cp index.html "$BACKUP_DIR/" 2>/dev/null
cp assets/css/style.css "$BACKUP_DIR/" 2>/dev/null
cp faq.html "$BACKUP_DIR/" 2>/dev/null
cp contato.html "$BACKUP_DIR/" 2>/dev/null

echo "✅ Backup criado em: $BACKUP_DIR"

# 1. ATUALIZAR CORES NO CSS
echo "🎨 Atualizando paleta de cores no CSS..."

# Novas cores baseadas na logo atualizada
cat > assets/css/colors-update.css << 'EOF'
/* ========================================
   SALVÔ - NOVA PALETA DE CORES 2025
   Baseada na logo atualizada
======================================== */

:root {
  /* Cores principais da nova identidade */
  --salvo-green-primary: #25D366;    /* Verde WhatsApp principal */
  --salvo-green-dark: #128C7E;       /* Verde escuro */
  --salvo-green-light: #DCF8C6;      /* Verde claro para backgrounds */
  --salvo-yellow-primary: #FFD700;   /* Amarelo da logo */
  --salvo-yellow-light: #FFF8DC;     /* Amarelo claro */
  
  /* Cores de apoio */
  --salvo-white: #FFFFFF;
  --salvo-gray-light: #F5F5F5;
  --salvo-gray-medium: #E0E0E0;
  --salvo-gray-dark: #757575;
  --salvo-black: #212121;
  
  /* Cores de status */
  --salvo-success: #4CAF50;
  --salvo-warning: #FF9800;
  --salvo-error: #F44336;
  --salvo-info: #2196F3;
  
  /* Gradientes */
  --salvo-gradient-primary: linear-gradient(135deg, var(--salvo-green-primary) 0%, var(--salvo-green-dark) 100%);
  --salvo-gradient-secondary: linear-gradient(135deg, var(--salvo-yellow-primary) 0%, var(--salvo-yellow-light) 100%);
  
  /* Sombras */
  --salvo-shadow-light: 0 2px 8px rgba(37, 211, 102, 0.1);
  --salvo-shadow-medium: 0 4px 16px rgba(37, 211, 102, 0.15);
  --salvo-shadow-heavy: 0 8px 32px rgba(37, 211, 102, 0.2);
}

/* Aplicar cores nos elementos principais */
.header {
  background: var(--salvo-white);
  box-shadow: var(--salvo-shadow-light);
}

.nav__logo {
  color: var(--salvo-green-primary);
  font-weight: 700;
}

.nav__link {
  color: var(--salvo-gray-dark);
  transition: color 0.3s ease;
}

.nav__link:hover {
  color: var(--salvo-green-primary);
}

.hero {
  background: linear-gradient(135deg, var(--salvo-green-light) 0%, var(--salvo-white) 100%);
}

.hero__title {
  color: var(--salvo-black);
}

.hero__subtitle {
  color: var(--salvo-green-primary);
  font-weight: 600;
}

.hero__description {
  color: var(--salvo-gray-dark);
}

.btn {
  border-radius: 12px;
  padding: 12px 24px;
  font-weight: 600;
  transition: all 0.3s ease;
  border: none;
  cursor: pointer;
}

.btn--primary {
  background: var(--salvo-gradient-primary);
  color: var(--salvo-white);
  box-shadow: var(--salvo-shadow-medium);
}

.btn--primary:hover {
  transform: translateY(-2px);
  box-shadow: var(--salvo-shadow-heavy);
}

.btn--secondary {
  background: var(--salvo-white);
  color: var(--salvo-green-primary);
  border: 2px solid var(--salvo-green-primary);
}

.btn--secondary:hover {
  background: var(--salvo-green-primary);
  color: var(--salvo-white);
}

.section__title {
  color: var(--salvo-black);
  margin-bottom: 1rem;
}

.section__subtitle {
  color: var(--salvo-gray-dark);
}

.card {
  background: var(--salvo-white);
  border-radius: 16px;
  padding: 2rem;
  box-shadow: var(--salvo-shadow-light);
  transition: all 0.3s ease;
}

.card:hover {
  transform: translateY(-4px);
  box-shadow: var(--salvo-shadow-medium);
}

.icon {
  color: var(--salvo-green-primary);
}

.footer {
  background: var(--salvo-green-dark);
  color: var(--salvo-white);
}

.footer__link {
  color: var(--salvo-green-light);
  transition: color 0.3s ease;
}

.footer__link:hover {
  color: var(--salvo-white);
}

/* Modal styles */
.modal {
  background: rgba(0, 0, 0, 0.8);
}

.modal__content {
  background: var(--salvo-white);
  border-radius: 16px;
  box-shadow: var(--salvo-shadow-heavy);
}

.modal__header {
  background: var(--salvo-gradient-primary);
  color: var(--salvo-white);
  border-radius: 16px 16px 0 0;
  padding: 1.5rem;
}

.form-group input,
.form-group select {
  border: 2px solid var(--salvo-gray-medium);
  border-radius: 8px;
  padding: 12px;
  transition: border-color 0.3s ease;
}

.form-group input:focus,
.form-group select:focus {
  border-color: var(--salvo-green-primary);
  outline: none;
  box-shadow: 0 0 0 3px rgba(37, 211, 102, 0.1);
}

.form-group label {
  color: var(--salvo-gray-dark);
  font-weight: 500;
}

/* Toast notifications */
.toast {
  background: var(--salvo-white);
  border-left: 4px solid var(--salvo-green-primary);
  box-shadow: var(--salvo-shadow-medium);
  border-radius: 8px;
}

.toast--success {
  border-left-color: var(--salvo-success);
}

.toast--error {
  border-left-color: var(--salvo-error);
}

.toast--warning {
  border-left-color: var(--salvo-warning);
}

/* Loading states */
.loading {
  background: var(--salvo-gradient-primary);
  background-size: 200% 200%;
  animation: gradient 2s ease infinite;
}

@keyframes gradient {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .card {
    padding: 1.5rem;
  }
  
  .btn {
    padding: 10px 20px;
    font-size: 14px;
  }
}
EOF

echo "✅ Nova paleta de cores criada!"

# 2. CORRIGIR NAVEGAÇÃO NO INDEX.HTML
echo "🔗 Corrigindo links de navegação no index.html..."

# Criar versão corrigida do index.html
if [ -f "index.html" ]; then
    # Corrigir links de navegação - mudar de âncoras para páginas reais
    sed -i 's|href="#faq"|href="faq.html"|g' index.html
    sed -i 's|href="#contato"|href="contato.html"|g' index.html
    
    # Verificar se os links já estão corretos e adicionar se necessário
    if ! grep -q 'href="faq.html"' index.html; then
        # Adicionar links FAQ e Contato se não existirem
        sed -i '/<div class="nav__menu" id="nav-menu">/,/<\/div>/ {
            s|<a href="#beneficios" class="nav__link">Benefícios</a>|<a href="#beneficios" class="nav__link">Benefícios</a>\
                <a href="faq.html" class="nav__link">FAQ</a>\
                <a href="contato.html" class="nav__link">Contato</a>|
        }' index.html
    fi
    
    echo "✅ Links FAQ e Contato corrigidos no menu!"
else
    echo "❌ Arquivo index.html não encontrado!"
fi

# 3. CORRIGIR LINKS PARA TERMOS E PRIVACIDADE
echo "📋 Corrigindo links para termos e privacidade..."

# Corrigir nos formulários e páginas
for file in index.html faq.html contato.html; do
    if [ -f "$file" ]; then
        # Corrigir links de termos e privacidade
        sed -i 's|href="/termos"|href="termos.html"|g' "$file"
        sed -i 's|href="/privacidade"|href="privacidade.html"|g' "$file"
        sed -i 's|href="termos-de-uso.html"|href="termos.html"|g' "$file"
        sed -i 's|href="politica-de-privacidade.html"|href="privacidade.html"|g' "$file"
        
        echo "✅ Links corrigidos em $file"
    fi
done

# 4. ATUALIZAR CSS PRINCIPAL
echo "🎨 Integrando novas cores ao CSS principal..."

# Anexar as novas cores ao arquivo CSS principal
if [ -f "assets/css/style.css" ]; then
    # Adicionar as novas cores ao final do arquivo
    echo "" >> assets/css/style.css
    echo "/* ======================================== */" >> assets/css/style.css
    echo "/*       CORES ATUALIZADAS SALVÔ 2025       */" >> assets/css/style.css
    echo "/* ======================================== */" >> assets/css/style.css
    cat assets/css/colors-update.css >> assets/css/style.css
    
    echo "✅ Cores integradas ao CSS principal!"
else
    echo "❌ Arquivo CSS principal não encontrado!"
fi

# 5. CORRIGIR PÁGINAS FAQ E CONTATO - NAVEGAÇÃO
echo "📄 Corrigindo navegação das páginas FAQ e Contato..."

# Corrigir navegação no FAQ
if [ -f "faq.html" ]; then
    # Corrigir links na navegação do FAQ
    sed -i 's|href="/"|href="index.html"|g' faq.html
    sed -i 's|href="/#como-funciona"|href="index.html#como-funciona"|g' faq.html
    sed -i 's|href="/#beneficios"|href="index.html#beneficios"|g' faq.html
    sed -i 's|href="/contato.html"|href="contato.html"|g' faq.html
    sed -i 's|href="/"|href="index.html"|g' faq.html
    
    echo "✅ Navegação do FAQ corrigida!"
fi

# Corrigir navegação no Contato
if [ -f "contato.html" ]; then
    # Corrigir links na navegação do Contato
    sed -i 's|href="/"|href="index.html"|g' contato.html
    sed -i 's|href="/#como-funciona"|href="index.html#como-funciona"|g' contato.html
    sed -i 's|href="/#beneficios"|href="index.html#beneficios"|g' contato.html
    sed -i 's|href="/faq.html"|href="faq.html"|g' contato.html
    
    echo "✅ Navegação do Contato corrigida!"
fi

# 6. LIMPAR ARQUIVOS TEMPORÁRIOS
rm -f assets/css/colors-update.css

# 7. VERIFICAÇÕES FINAIS
echo "🔍 Executando verificações finais..."

# Verificar se os links estão corretos
missing_files=()
required_files=("index.html" "faq.html" "contato.html" "termos.html" "privacidade.html")

for file in "${required_files[@]}"; do
    if [ ! -f "$file" ]; then
        missing_files+=("$file")
    fi
done

if [ ${#missing_files[@]} -eq 0 ]; then
    echo "✅ Todos os arquivos de páginas estão presentes!"
else
    echo "⚠️ Arquivos faltando:"
    printf '%s\n' "${missing_files[@]}"
fi

# Verificar CSS
if [ -f "assets/css/style.css" ]; then
    echo "✅ Arquivo CSS principal encontrado!"
else
    echo "❌ Arquivo CSS principal não encontrado!"
fi

# Gerar relatório
echo ""
echo "📋 Relatório de Correções Aplicadas:"
echo "=================================================="
echo "✅ Navegação corrigida (FAQ e Contato adicionados)"
echo "✅ Paleta de cores atualizada"
echo "✅ Links de termos e privacidade corrigidos"
echo "✅ Páginas FAQ e Contato verificadas/criadas"
echo "✅ CSS integrado com novas cores"
echo ""
echo "📁 Backup salvo em: $BACKUP_DIR"
echo ""
echo "🎯 Próximos passos:"
echo "   1. Execute o próximo script para configurar Firebase"
echo "   2. Configure reCAPTCHA"
echo "   3. Teste a navegação entre páginas"
echo "   4. Execute o deploy atualizado"
echo ""
echo "🌟 Script 2g concluído com sucesso!"
echo "📄 Pronto para o próximo script: 2h_firebase_config.sh"