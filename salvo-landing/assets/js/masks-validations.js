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

// Atualização da função submitForm para usar Firebase
SalvoMasks.submitForm = async function(form) {
    const submitBtn = form.querySelector('button[type="submit"]');
    const btnText = submitBtn.querySelector('.btn__text');
    const btnLoading = submitBtn.querySelector('.btn__loading');

    // Verificar reCAPTCHA v1 se configurado
    if (window.SalvoRecaptcha && window.SalvoRecaptcha.useV1) {
        if (!window.SalvoRecaptcha.verifyV1()) {
            return;
        }
    }

    // Mostrar loading
    submitBtn.disabled = true;
    submitBtn.classList.add('loading');
    if (btnText) btnText.style.display = 'none';
    if (btnLoading) btnLoading.style.display = 'inline';

    try {
        // Coletar dados
        const formData = new FormData(form);
        const dados = Object.fromEntries(formData.entries());

        // Determinar tipo de formulário
        const tipo = dados.tipo || 'PF';

        // Obter token reCAPTCHA v3 se configurado
        let recaptchaToken = null;
        if (window.SalvoRecaptcha && !window.SalvoRecaptcha.useV1) {
            recaptchaToken = await window.SalvoRecaptcha.executeV3('cadastro');
            dados.recaptcha_token = recaptchaToken;
        }

        // Salvar no Firebase
        const result = await window.SalvoFirebase.saveCadastro(dados, tipo);

        if (result.success) {
            // Sucesso - redirecionar

            // Resetar reCAPTCHA
            if (window.SalvoRecaptcha) {
                window.SalvoRecaptcha.reset();
            }

            // Fechar modal e redirecionar
            SalvoModal.close();
            setTimeout(() => {
                window.location.href = 'obrigado.html';
            }, 500);

        } else {
            // Erro
            alert(result.message || 'Erro ao realizar cadastro. Tente novamente.');

            // Resetar reCAPTCHA
            if (window.SalvoRecaptcha) {
                window.SalvoRecaptcha.reset();
            }
        }

    } catch (error) {
        alert('Erro inesperado. Tente novamente.');

        // Resetar reCAPTCHA
        if (window.SalvoRecaptcha) {
            window.SalvoRecaptcha.reset();
        }
    } finally {
        // Remover loading
        submitBtn.disabled = false;
        submitBtn.classList.remove('loading');
        if (btnText) btnText.style.display = 'inline';
        if (btnLoading) btnLoading.style.display = 'none';
    }
};
