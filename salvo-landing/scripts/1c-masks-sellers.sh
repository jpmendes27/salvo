#!/bin/bash

# Script 1c: Atualizar Máscaras e Validações para Sellers
# REGRA: Manter estrutura, atualizar lógica para sellers
# Autor: Sistema Salvô
# Data: 2025-09-20

echo "🎭 Atualizando máscaras e validações para sellers..."
echo "📋 IMPORTANTE: Mantendo estrutura visual existente"
echo ""

# Backup do arquivo atual
echo "💾 Fazendo backup do masks-validations.js atual..."
cp assets/js/masks-validations.js assets/js/masks-validations.js.backup.$(date +%Y%m%d_%H%M%S)
echo "✅ Backup criado!"

# Criar nova versão do masks-validations.js
echo "🔧 Criando validações para sellers..."

cat > assets/js/masks-validations.js << 'EOF'
/* ========================================
   SALVÔ - MÁSCARAS E VALIDAÇÕES SELLERS
   Integração completa com Firebase + ViaCEP + Geolocalização
======================================== */

// Classe para gerenciar máscaras para sellers
class SalvoMasksSellers {
    static init() {
        this.setupWhatsAppMask();
        this.setupCEPMask();
        this.setupCEPLookup();
        this.setupGeolocation();
        this.setupFormValidations();
        this.setupFileValidation();
        console.log('🎭 SalvoMasksSellers inicializado');
    }

    // Máscara para WhatsApp
    static setupWhatsAppMask() {
        const whatsappInput = document.getElementById('whatsapp');
        if (whatsappInput) {
            whatsappInput.addEventListener('input', function(e) {
                let value = e.target.value.replace(/\D/g, '');

                if (value.length > 11) {
                    value = value.slice(0, 11);
                }

                if (value.length <= 10) {
                    value = value.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
                } else {
                    value = value.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
                }

                e.target.value = value;
            });
        }
    }

    // Máscara para CEP
    static setupCEPMask() {
        const cepInput = document.getElementById('cep');
        if (cepInput) {
            cepInput.addEventListener('input', function(e) {
                let value = e.target.value.replace(/\D/g, '');

                if (value.length > 8) {
                    value = value.slice(0, 8);
                }

                value = value.replace(/(\d{5})(\d{3})/, '$1-$2');
                e.target.value = value;
            });
        }
    }

    // Busca automática de endereço via CEP
    static setupCEPLookup() {
        const cepInput = document.getElementById('cep');
        if (cepInput) {
            cepInput.addEventListener('blur', async function(e) {
                const cep = e.target.value.replace(/\D/g, '');
                
                if (cep.length === 8) {
                    try {
                        // Mostrar loading
                        SalvoMasksSellers.showCEPLoading(true);
                        
                        const result = await window.ViaCEPService.getAddressByCEP(cep);
                        
                        if (result.success) {
                            // Preencher campos automaticamente
                            document.getElementById('address').value = result.data.address;
                            document.getElementById('city').value = result.data.city;
                            document.getElementById('uf').value = result.data.uf;
                            
                            console.log('✅ Endereço encontrado via CEP');
                        } else {
                            SalvoMasksSellers.showFieldError(cepInput, result.error);
                        }
                    } catch (error) {
                        SalvoMasksSellers.showFieldError(cepInput, 'Erro ao buscar CEP');
                    } finally {
                        SalvoMasksSellers.showCEPLoading(false);
                    }
                }
            });
        }
    }

    // Configurar geolocalização automática
    static setupGeolocation() {
        // Obter localização quando modal abrir
        const modal = document.getElementById('modal-forms');
        if (modal) {
            const observer = new MutationObserver(async (mutations) => {
                mutations.forEach(async (mutation) => {
                    if (mutation.type === 'attributes' && 
                        mutation.attributeName === 'class' &&
                        modal.classList.contains('modal--active')) {
                        
                        try {
                            console.log('📍 Obtendo localização...');
                            const position = await window.GeolocationService.getCurrentPosition();
                            
                            document.getElementById('latitude').value = position.latitude;
                            document.getElementById('longitude').value = position.longitude;
                            
                            console.log('✅ Localização obtida:', position);
                        } catch (error) {
                            console.warn('⚠️ Erro ao obter localização:', error.message);
                        }
                    }
                });
            });
            
            observer.observe(modal, { attributes: true });
        }
    }

    // Validação de arquivos
    static setupFileValidation() {
        const logoInput = document.getElementById('logo');
        if (logoInput) {
            logoInput.addEventListener('change', function(e) {
                const file = e.target.files[0];
                
                if (file) {
                    // Validar tipo
                    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
                    if (!allowedTypes.includes(file.type)) {
                        SalvoMasksSellers.showFieldError(logoInput, 'Formato não permitido. Use JPG, PNG, GIF ou WebP');
                        logoInput.value = '';
                        return;
                    }
                    
                    // Validar tamanho (5MB)
                    if (file.size > 5 * 1024 * 1024) {
                        SalvoMasksSellers.showFieldError(logoInput, 'Arquivo muito grande. Máximo 5MB');
                        logoInput.value = '';
                        return;
                    }
                    
                    // Limpar erro se arquivo válido
                    SalvoMasksSellers.clearFieldError(logoInput);
                }
            });
        }
    }

    // Configurar validações de formulário
    static setupFormValidations() {
        document.querySelectorAll('.form__input').forEach(input => {
            input.addEventListener('blur', function() {
                if (this.value.trim()) {
                    SalvoMasksSellers.validateField(this);
                }
            });

            input.addEventListener('input', function() {
                SalvoMasksSellers.clearFieldError(this);
            });
        });

        // Configurar submit do formulário
        const form = document.getElementById('form-seller-submit');
        if (form) {
            form.addEventListener('submit', function(e) {
                e.preventDefault();
                SalvoMasksSellers.submitForm(this);
            });
        }
    }

    // Validar campo individual
    static validateField(field) {
        const value = field.value.trim();
        const name = field.name;
        let error = '';

        switch (name) {
            case 'businessName':
                if (!value) error = 'Nome do negócio é obrigatório';
                else if (value.length < 2) error = 'Deve ter pelo menos 2 caracteres';
                break;
                
            case 'category':
                if (!value) error = 'Categoria é obrigatória';
                break;
                
            case 'whatsapp':
                if (!value) error = 'WhatsApp é obrigatório';
                else if (!/^\(\d{2}\) \d{4,5}-\d{4}$/.test(value)) error = 'Formato inválido';
                break;
                
            case 'email':
                if (!value) error = 'E-mail é obrigatório';
                else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) error = 'E-mail inválido';
                break;
                
            case 'cep':
                if (!value) error = 'CEP é obrigatório';
                else if (!/^\d{5}-\d{3}$/.test(value)) error = 'CEP inválido';
                break;
                
            case 'address':
                if (!value) error = 'Endereço é obrigatório';
                break;
                
            case 'complement':
                if (!value) error = 'Complemento é obrigatório';
                break;
                
            case 'city':
                if (!value) error = 'Cidade é obrigatória';
                break;
                
            case 'uf':
                if (!value) error = 'UF é obrigatório';
                break;
        }

        if (error) {
            this.showFieldError(field, error);
            return false;
        } else {
            this.clearFieldError(field);
            return true;
        }
    }

    // Submeter formulário
    static async submitForm(form) {
        const submitBtn = form.querySelector('button[type="submit"]');
        const btnText = submitBtn.querySelector('.btn__text');
        const btnLoading = submitBtn.querySelector('.btn__loading');

        // 1. VALIDAR FORMULÁRIO
        if (!this.validateForm(form)) {
            const firstError = form.querySelector('.form__input--error');
            if (firstError) firstError.focus();
            return;
        }

        // 2. VERIFICAR GEOLOCALIZAÇÃO
        const latitude = document.getElementById('latitude').value;
        const longitude = document.getElementById('longitude').value;
        
        if (!latitude || !longitude) {
            alert('Localização é obrigatória. Permita o acesso à localização e tente novamente.');
            return;
        }

        // 3. MOSTRAR LOADING
        submitBtn.disabled = true;
        submitBtn.classList.add('loading');
        if (btnText) btnText.style.display = 'none';
        if (btnLoading) btnLoading.style.display = 'inline';

        try {
            // 4. COLETAR DADOS
            const formData = new FormData(form);
            const dados = Object.fromEntries(formData.entries());
            const logoFile = document.getElementById('logo').files[0];

            console.log('📊 Dados coletados:', dados);

            // 5. SALVAR NO FIREBASE
            const result = await window.SalvoFirebaseSellers.saveSeller(dados, logoFile);

            if (result.success) {
                console.log('✅ Seller cadastrado com sucesso!');
                
                // Fechar modal
                if (window.SalvoModal) {
                    window.SalvoModal.close();
                }

                // Redirecionar
                setTimeout(() => {
                    window.location.href = 'obrigado.html';
                }, 500);

            } else {
                console.error('❌ Erro no cadastro:', result);
                alert(result.message || 'Erro ao realizar cadastro. Tente novamente.');
            }

        } catch (error) {
            console.error('❌ Erro inesperado:', error);
            alert('Erro inesperado. Tente novamente.');
        } finally {
            // 6. REMOVER LOADING
            submitBtn.disabled = false;
            submitBtn.classList.remove('loading');
            if (btnText) btnText.style.display = 'inline';
            if (btnLoading) btnLoading.style.display = 'none';
        }
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

        // Validar arquivo
        const logoInput = document.getElementById('logo');
        if (!logoInput.files[0]) {
            this.showFieldError(logoInput, 'Logo/imagem é obrigatória');
            isValid = false;
        }

        // Validar LGPD
        const lgpdCheckbox = form.querySelector('input[name="aceiteLGPD"]');
        if (!lgpdCheckbox.checked) {
            this.showFieldError(lgpdCheckbox, 'Você deve aceitar os termos');
            isValid = false;
        }

        return isValid;
    }

    // Mostrar erro do campo
    static showFieldError(field, message) {
        const errorElement = document.getElementById(field.id + '-error');
        if (errorElement) {
            errorElement.textContent = message;
            errorElement.style.display = 'block';
        }
        field.classList.add('form__input--error');
    }

    // Limpar erro do campo
    static clearFieldError(field) {
        const errorElement = document.getElementById(field.id + '-error');
        if (errorElement) {
            errorElement.textContent = '';
            errorElement.style.display = 'none';
        }
        field.classList.remove('form__input--error');
    }

    // Mostrar loading do CEP
    static showCEPLoading(show) {
        const cepInput = document.getElementById('cep');
        if (cepInput) {
            if (show) {
                cepInput.style.backgroundImage = 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 50 50\'%3E%3Cpath d=\'M25 5A20.14 20.14 0 0 0 5 25a20.14 20.14 0 0 0 20 20 20.14 20.14 0 0 0 20-20A20.14 20.14 0 0 0 25 5Zm0 30a10 10 0 1 1 10-10 10 10 0 0 1-10 10Z\' fill=\'%23ccc\'/%3E%3C/svg%3E")';
                cepInput.style.backgroundRepeat = 'no-repeat';
                cepInput.style.backgroundPosition = 'right 10px center';
                cepInput.style.backgroundSize = '16px';
            } else {
                cepInput.style.backgroundImage = 'none';
            }
        }
    }
}

// Atualizar classe modal para sellers
class SalvoModalSellers {
    static init() {
        this.modal = document.getElementById('modal-forms');
        this.setupEvents();
        console.log('📱 SalvoModalSellers inicializado');
    }

    static setupEvents() {
        if (!this.modal) return;

        // Botão para abrir modal
        const ctaButton = document.getElementById('cta-seller');
        if (ctaButton) {
            ctaButton.addEventListener('click', () => this.open());
        }

        // Botões para fechar modal
        document.querySelectorAll('.form__close').forEach(btn => {
            btn.addEventListener('click', () => this.close());
        });

        // Fechar ao clicar fora
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal || e.target.classList.contains('modal__overlay')) {
                this.close();
            }
        });

        // Fechar com ESC
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.modal.classList.contains('modal--active')) {
                this.close();
            }
        });
    }

    static open() {
        if (!this.modal) return;

        this.modal.classList.add('modal--active');
        document.body.classList.add('modal-open');

        // Focar no primeiro campo
        setTimeout(() => {
            const firstInput = document.getElementById('business-name');
            if (firstInput) firstInput.focus();
        }, 300);
    }

    static close() {
        if (!this.modal) return;

        this.modal.classList.remove('modal--active');
        document.body.classList.remove('modal-open');

        // Limpar formulário
        const form = document.getElementById('form-seller-submit');
        if (form) {
            form.reset();
            
            // Limpar erros
            form.querySelectorAll('.form__error').forEach(error => {
                error.textContent = '';
                error.style.display = 'none';
            });
            form.querySelectorAll('.form__input').forEach(input => {
                input.classList.remove('form__input--error');
            });
        }
    }
}

// Inicializar quando DOM estiver pronto
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(() => {
        SalvoMasksSellers.init();
        SalvoModalSellers.init();
        console.log('✅ Validações sellers inicializadas');
    }, 500);
});

// Expor classes globalmente
window.SalvoMasksSellers = SalvoMasksSellers;
window.SalvoModalSellers = SalvoModalSellers;
window.SalvoModal = SalvoModalSellers; // Compatibilidade
EOF

echo "✅ Máscaras e validações atualizadas com sucesso!"
echo ""
echo "📋 Funcionalidades implementadas:"
echo "   ✓ Máscara WhatsApp e CEP"
echo "   ✓ Busca automática de endereço via ViaCEP"
echo "   ✓ Geolocalização automática"
echo "   ✓ Validação de arquivo (logo)"
echo "   ✓ Validações completas de formulário"
echo "   ✓ Integração com Firebase Sellers"
echo ""
echo "⏳ Aguardando comando 'continuar' para próximo script..."
echo "📋 Próximo: 1d-firebase-rules.sh (Configurar regras Firestore)"