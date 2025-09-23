#!/bin/bash

# Script 2i: Validações JavaScript e Máscaras - Salvô Landing Page
# Autor: Rafael Ferreira
# Data: 2025-08-16
# Uso: cp ../scripts/2i_javascript_validations.sh . && chmod +x 2i_javascript_validations.sh && ./2i_javascript_validations.sh

echo "⚡ Salvô - Validações JavaScript e Máscaras..."

# Verificar se está na pasta correta
if [ ! -f "index.html" ] || [ ! -d "assets" ]; then
    echo "❌ Erro: Execute este script dentro da pasta salvo-landing"
    echo "📁 Comando correto:"
    echo "   cd salvo-landing"
    echo "   cp ../scripts/2i_javascript_validations.sh ."
    echo "   chmod +x 2i_javascript_validations.sh && ./2i_javascript_validations.sh"
    exit 1
fi

echo "✅ Pasta do projeto encontrada!"

# Backup dos arquivos que serão modificados
echo "💾 Criando backup dos arquivos..."

BACKUP_DIR="backup-2i-$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

# Fazer backup dos arquivos JavaScript existentes
cp assets/js/app.js "$BACKUP_DIR/" 2>/dev/null
cp assets/js/firebase.js "$BACKUP_DIR/" 2>/dev/null || echo "⚠️ firebase.js não encontrado"

echo "✅ Backup criado em: $BACKUP_DIR"

# 1. CRIAR MÁSCARAS E VALIDAÇÕES JAVASCRIPT
echo "🎭 Criando máscaras para campos de formulário..."

cat > assets/js/masks-validations.js << 'EOF'
/* ========================================
   SALVÔ - MÁSCARAS E VALIDAÇÕES
======================================== */

// Classe para gerenciar máscaras
class SalvoMasks {
    static init() {
        this.setupWhatsAppMask();
        this.setupCNPJMask();
        this.setupFormValidations();
        this.setupModalBehavior();
    }

    // Máscara para WhatsApp
    static setupWhatsAppMask() {
        document.querySelectorAll('input[type="tel"]').forEach(input => {
            input.addEventListener('input', function(e) {
                let value = e.target.value.replace(/\D/g, '');

                // Limitar a 11 dígitos
                if (value.length > 11) {
                    value = value.slice(0, 11);
                }

                // Aplicar máscara
                if (value.length <= 10) {
                    value = value.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
                } else {
                    value = value.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
                }

                e.target.value = value;
            });

            // Placeholder dinâmico
            input.placeholder = '(11) 99999-9999';
        });
    }

    // Máscara para CNPJ
    static setupCNPJMask() {
        document.querySelectorAll('#pj-cnpj').forEach(input => {
            input.addEventListener('input', function(e) {
                let value = e.target.value.replace(/\D/g, '');

                // Limitar a 14 dígitos
                if (value.length > 14) {
                    value = value.slice(0, 14);
                }

                // Aplicar máscara
                value = value.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
                e.target.value = value;
            });

            // Placeholder
            input.placeholder = '00.000.000/0000-00';
        });
    }

    // Validações de formulário
    static setupFormValidations() {
        // Validação em tempo real
        document.querySelectorAll('.form__input').forEach(input => {
            input.addEventListener('blur', function() {
                if (this.value.trim()) {
                    SalvoMasks.validateField(this);
                }
            });

            input.addEventListener('input', function() {
                // Remover estado de erro ao digitar
                const fieldGroup = this.closest('.form__group');
                if (fieldGroup.classList.contains('error')) {
                    fieldGroup.classList.remove('error');
                    const errorEl = document.getElementById(this.id + '-error');
                    if (errorEl) errorEl.textContent = '';
                }
            });
        });

        // Validação no submit
        document.querySelectorAll('form').forEach(form => {
            form.addEventListener('submit', function(e) {
                e.preventDefault();

                if (SalvoMasks.validateForm(this)) {
                    SalvoMasks.submitForm(this);
                }
            });
        });
    }

    // Validar campo individual
    static validateField(field) {
        const fieldGroup = field.closest('.form__group');
        const errorElement = document.getElementById(field.id + '-error');

        // Remover estados anteriores
        fieldGroup.classList.remove('error', 'success');
        if (errorElement) errorElement.textContent = '';

        let isValid = true;
        let errorMessage = '';

        // Verificar se é obrigatório
        if (field.hasAttribute('required') && !field.value.trim()) {
            isValid = false;
            errorMessage = 'Este campo é obrigatório';
        }
        // Validar e-mail
        else if (field.type === 'email' && field.value && !this.isValidEmail(field.value)) {
            isValid = false;
            errorMessage = 'Digite um e-mail válido';
        }
        // Validar WhatsApp
        else if (field.type === 'tel' && field.value && !this.isValidPhone(field.value)) {
            isValid = false;
            errorMessage = 'Digite um WhatsApp válido';
        }
        // Validar CNPJ
        else if (field.id === 'pj-cnpj' && field.value && !this.isValidCNPJ(field.value)) {
            isValid = false;
            errorMessage = 'Digite um CNPJ válido';
        }

        if (!isValid) {
            fieldGroup.classList.add('error');
            if (errorElement) {
                errorElement.textContent = errorMessage;
            }
        } else if (field.value.trim()) {
            fieldGroup.classList.add('success');
        }

        return isValid;
    }

    // Validar formulário completo
    static validateForm(form) {
        let isValid = true;
        const requiredFields = form.querySelectorAll('[required]');

        requiredFields.forEach(field => {
            if (!this.validateField(field)) {
                isValid = false;
            }
        });

        return isValid;
    }

    // Submeter formulário
    static submitForm(form) {
        const submitBtn = form.querySelector('button[type="submit"]');
        const btnText = submitBtn.querySelector('.btn__text');
        const btnLoading = submitBtn.querySelector('.btn__loading');

        // Mostrar loading
        submitBtn.disabled = true;
        submitBtn.classList.add('loading');
        if (btnText) btnText.style.display = 'none';
        if (btnLoading) btnLoading.style.display = 'inline';

        // Coletar dados
        const formData = new FormData(form);
        const dados = Object.fromEntries(formData.entries());

        console.log('Dados do formulário:', dados);

        // Simular envio (substituir por Firebase)
        setTimeout(() => {
            // Remover loading
            submitBtn.disabled = false;
            submitBtn.classList.remove('loading');
            if (btnText) btnText.style.display = 'inline';
            if (btnLoading) btnLoading.style.display = 'none';

            // Fechar modal e redirecionar
            SalvoModal.close();
            window.location.href = 'obrigado.html';
        }, 2000);
    }

    // Validadores
    static isValidEmail(email) {
        const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return regex.test(email);
    }

    static isValidPhone(phone) {
        const cleaned = phone.replace(/\D/g, '');
        return cleaned.length >= 10 && cleaned.length <= 11;
    }

    static isValidCNPJ(cnpj) {
        const cleaned = cnpj.replace(/\D/g, '');
        return cleaned.length === 14;
    }
}

// Classe para gerenciar modal
class SalvoModal {
    static init() {
        this.modal = document.getElementById('modal-forms');
        this.formPF = document.getElementById('form-pf');
        this.formPJ = document.getElementById('form-pj');

        this.setupEvents();
    }

    static setupEvents() {
        if (!this.modal) return;

        // Botões para abrir modal
        document.querySelectorAll('[data-form]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const formType = e.target.closest('[data-form]').getAttribute('data-form');
                this.open(formType);
            });
        });

        // Botões para fechar modal
        document.querySelectorAll('.form__close').forEach(btn => {
            btn.addEventListener('click', () => this.close());
        });

        // Fechar ao clicar fora
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) {
                this.close();
            }
        });

        // Fechar com ESC
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.modal.classList.contains('active')) {
                this.close();
            }
        });
    }

    static open(formType = 'pf') {
        if (!this.modal) return;

        // Esconder todos os formulários
        if (this.formPF) this.formPF.style.display = 'none';
        if (this.formPJ) this.formPJ.style.display = 'none';

        // Mostrar formulário específico
        if (formType === 'pf' && this.formPF) {
            this.formPF.style.display = 'block';
        } else if (formType === 'pj' && this.formPJ) {
            this.formPJ.style.display = 'block';
        }

        // Mostrar modal
        this.modal.style.display = 'flex';
        setTimeout(() => {
            this.modal.classList.add('active');
        }, 10);

        // Bloquear scroll da página
        document.body.style.overflow = 'hidden';
    }

    static close() {
        if (!this.modal) return;

        this.modal.classList.remove('active');
        setTimeout(() => {
            this.modal.style.display = 'none';
            document.body.style.overflow = '';
        }, 300);
    }
}

// Inicializar quando DOM estiver pronto
document.addEventListener('DOMContentLoaded', function() {
    SalvoMasks.init();
    SalvoModal.init();
});
EOF

echo "✅ Máscaras e validações criadas!"

# 2. CRIAR MELHORIAS NO APP.JS PRINCIPAL
echo "🔧 Melhorando arquivo app.js principal..."

# Verificar se app.js existe, se não, criar
if [ ! -f "assets/js/app.js" ]; then
    echo "📝 Criando arquivo app.js..."
    mkdir -p assets/js

    cat > assets/js/app.js << 'EOF'
/* ========================================
   SALVÔ - JAVASCRIPT PRINCIPAL
======================================== */

// Variáveis globais
let currentForm = null;

// Inicialização
document.addEventListener('DOMContentLoaded', function() {
    initSalvoApp();
});

function initSalvoApp() {
    setupNavigation();
    setupScrollEffects();
    setupTabSwitching();
    trackUTMParameters();
    console.log('🟢 Salvô App inicializado!');
}

// Configurar navegação
function setupNavigation() {
    const navToggle = document.getElementById('nav-toggle');
    const navMenu = document.getElementById('nav-menu');

    if (navToggle && navMenu) {
        navToggle.addEventListener('click', () => {
            navMenu.classList.toggle('active');
        });
    }
}

// Efeitos de scroll
function setupScrollEffects() {
    const header = document.getElementById('header');

    window.addEventListener('scroll', () => {
        if (window.scrollY > 100) {
            header?.classList.add('scrolled');
        } else {
            header?.classList.remove('scrolled');
        }
    });
}

// Troca de tabs "Como Funciona"
function setupTabSwitching() {
    const tabButtons = document.querySelectorAll('.tab__btn');
    const tabContents = document.querySelectorAll('.tab__content');

    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetTab = btn.getAttribute('data-tab');

            // Remover classe ativa de todos
            tabButtons.forEach(b => b.classList.remove('tab__btn--active'));
            tabContents.forEach(c => c.classList.remove('tab__content--active'));

            // Adicionar classe ativa aos selecionados
            btn.classList.add('tab__btn--active');
            document.getElementById(targetTab)?.classList.add('tab__content--active');
        });
    });
}

// Rastrear parâmetros UTM
function trackUTMParameters() {
    const urlParams = new URLSearchParams(window.location.search);
    const utmSource = urlParams.get('utm_source');
    const utmMedium = urlParams.get('utm_medium');
    const utmCampaign = urlParams.get('utm_campaign');

    // Armazenar em campos ocultos dos formulários
    if (utmSource || utmMedium || utmCampaign) {
        document.querySelectorAll('[name="utm_source"]').forEach(input => {
            input.value = utmSource || '';
        });
        document.querySelectorAll('[name="utm_medium"]').forEach(input => {
            input.value = utmMedium || '';
        });
        document.querySelectorAll('[name="utm_campaign"]').forEach(input => {
            input.value = utmCampaign || '';
        });
    }
}

// Função para mostrar toast (futuro)
function showToast(message, type = 'info') {
    console.log(`Toast ${type}: ${message}`);
}

// Função para analytics (futuro)
function trackEvent(eventName, data = {}) {
    console.log(`Event: ${eventName}`, data);
}
EOF

    echo "✅ Arquivo app.js criado!"
else
    echo "✅ Arquivo app.js já existe!"
fi

# 3. ADICIONAR IMPORT DAS MÁSCARAS NO INDEX.HTML
echo "🔗 Adicionando import das máscaras no HTML..."

if [ -f "index.html" ]; then
    # Adicionar script de máscaras antes do fechamento do body
    sed -i 's|<script src="assets/js/app.js"></script>|<script src="assets/js/masks-validations.js"></script>\n    <script src="assets/js/app.js"></script>|' index.html

    echo "✅ Import das máscaras adicionado!"
fi

# 4. VERIFICAÇÕES FINAIS
echo "🔍 Executando verificações finais..."

# Verificar arquivos JavaScript criados
js_files=("assets/js/masks-validations.js" "assets/js/app.js")
missing_js=()

for file in "${js_files[@]}"; do
    if [ ! -f "$file" ]; then
        missing_js+=("$file")
    fi
done

if [ ${#missing_js[@]} -eq 0 ]; then
    echo "✅ Todos os arquivos JavaScript estão presentes!"
else
    echo "⚠️ Arquivos JavaScript faltando:"
    printf '%s\n' "${missing_js[@]}"
fi

# Verificar se os imports foram adicionados
if grep -q "masks-validations.js" index.html; then
    echo "✅ Import das máscaras configurado!"
else
    echo "⚠️ Import das máscaras não foi configurado"
fi

# Gerar relatório
echo ""
echo "📋 Relatório do Script 2i:"
echo "=================================================="
echo "✅ Máscaras para WhatsApp e CNPJ criadas"
echo "✅ Validações em tempo real implementadas"
echo "✅ Gerenciamento de modal melhorado"
echo "✅ App.js principal configurado"
echo "✅ Imports adicionados ao HTML"
echo ""
echo "📁 Backup salvo em: $BACKUP_DIR"
echo ""
echo "🎯 Próximo passo:"
echo "   Execute o script 2j para configurar Firebase"
echo "   cp ../scripts/2j_firebase_config.sh ."
echo "   chmod +x 2j_firebase_config.sh && ./2j_firebase_config.sh"
echo ""
echo "🌟 Script 2i concluído com sucesso!"
