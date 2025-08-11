// Salvô Landing Page - JavaScript Principal
// Autor: Rafael Ferreira
// Data: 2025-08-09

document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Salvô Landing Page carregada!');
    
    // Inicializar aplicação
    App.init();
});

// Objeto principal da aplicação
const App = {
    // Configurações
    config: {
        recaptchaSiteKey: '6LfxYZ4pAAAAAH-tYs9D1v9XrG7ZQk5QY8xP2wX7',
        whatsappNumber: '5511999999999'
    },
    
    // Elementos DOM
    elements: {
        header: null,
        navToggle: null,
        navMenu: null,
        modal: null,
        modalOverlay: null,
        ctaPF: null,
        ctaPJ: null,
        formPF: null,
        formPJ: null,
        formContainerPF: null,
        formContainerPJ: null,
        tabBtns: null,
        tabContents: null,
        faqItems: null
    },
    
    // Inicializar aplicação
    init() {
        this.cacheElements();
        this.bindEvents();
        this.setupUTMTracking();
        this.setupScrollEffects();
        this.setupTabs();
        this.setupFAQ();
        this.setupFormValidation();
        this.setupMasks();
    },
    
    // Cache dos elementos DOM
    cacheElements() {
        this.elements = {
            header: document.getElementById('header'),
            navToggle: document.getElementById('nav-toggle'),
            navMenu: document.getElementById('nav-menu'),
            modal: document.getElementById('modal-forms'),
            modalOverlay: document.querySelector('.modal__overlay'),
            ctaPF: document.getElementById('cta-pf'),
            ctaPJ: document.getElementById('cta-pj'),
            formPF: document.getElementById('form-pessoa-fisica'),
            formPJ: document.getElementById('form-pessoa-juridica'),
            formContainerPF: document.getElementById('form-pf'),
            formContainerPJ: document.getElementById('form-pj'),
            tabBtns: document.querySelectorAll('.tab__btn'),
            tabContents: document.querySelectorAll('.tab__content'),
            faqItems: document.querySelectorAll('.faq__item')
        };
    },
    
    // Vincular eventos
    bindEvents() {
        // Navegação mobile
        if (this.elements.navToggle) {
            this.elements.navToggle.addEventListener('click', this.toggleMobileMenu.bind(this));
        }
        
        // CTAs para abrir formulários
        if (this.elements.ctaPF) {
            this.elements.ctaPF.addEventListener('click', () => this.openModal('pf'));
        }
        if (this.elements.ctaPJ) {
            this.elements.ctaPJ.addEventListener('click', () => this.openModal('pj'));
        }
        
        // Fechar modal
        if (this.elements.modalOverlay) {
            this.elements.modalOverlay.addEventListener('click', this.closeModal.bind(this));
        }
        
        // Botões de fechar formulário
        document.querySelectorAll('.form__close').forEach(btn => {
            btn.addEventListener('click', this.closeModal.bind(this));
        });
        
        // Escape para fechar modal
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') this.closeModal();
        });
        
        // Smooth scroll para links internos
        document.querySelectorAll('a[href^="#"]').forEach(link => {
            link.addEventListener('click', this.smoothScroll.bind(this));
        });
        
        // Submit dos formulários
        if (this.elements.formPF) {
            this.elements.formPF.addEventListener('submit', (e) => this.handleFormSubmit(e, 'PF'));
        }
        if (this.elements.formPJ) {
            this.elements.formPJ.addEventListener('submit', (e) => this.handleFormSubmit(e, 'PJ'));
        }
    },
    
    // Toggle menu mobile
    toggleMobileMenu() {
        if (this.elements.navMenu) {
            this.elements.navMenu.classList.toggle('nav__menu--active');
            this.elements.navToggle.classList.toggle('nav__toggle--active');
        }
    },
    
    // Abrir modal com formulário
    openModal(tipo) {
        if (!this.elements.modal) return;
        
        // Mostrar modal
        this.elements.modal.classList.add('modal--active');
        document.body.classList.add('modal-open');
        
        // Mostrar formulário correto
        if (tipo === 'pf') {
            this.elements.formContainerPF.style.display = 'block';
            this.elements.formContainerPJ.style.display = 'none';
        } else {
            this.elements.formContainerPF.style.display = 'none';
            this.elements.formContainerPJ.style.display = 'block';
        }
        
        // Focar no primeiro campo
        setTimeout(() => {
            const firstInput = this.elements.modal.querySelector('input:not([type="hidden"])');
            if (firstInput) firstInput.focus();
        }, 300);
    },
    
    // Fechar modal
    closeModal() {
        if (!this.elements.modal) return;
        
        this.elements.modal.classList.remove('modal--active');
        document.body.classList.remove('modal-open');
        
        // Limpar formulários
        if (this.elements.formPF) this.elements.formPF.reset();
        if (this.elements.formPJ) this.elements.formPJ.reset();
        
        // Limpar erros
        this.clearAllErrors();
    },
    
    // Smooth scroll
    smoothScroll(e) {
        const href = e.currentTarget.getAttribute('href');
        if (href.startsWith('#')) {
            e.preventDefault();
            const target = document.querySelector(href);
            if (target) {
                const offsetTop = target.offsetTop - 80; // Compensar header fixo
                window.scrollTo({
                    top: offsetTop,
                    behavior: 'smooth'
                });
                
                // Fechar menu mobile se aberto
                this.elements.navMenu?.classList.remove('nav__menu--active');
                this.elements.navToggle?.classList.remove('nav__toggle--active');
            }
        }
    },
    
    // Configurar tracking UTM
    setupUTMTracking() {
        const urlParams = new URLSearchParams(window.location.search);
        const utmParams = {
            utm_source: urlParams.get('utm_source') || 'direct',
            utm_medium: urlParams.get('utm_medium') || 'none',
            utm_campaign: urlParams.get('utm_campaign') || 'none'
        };
        
        // Preencher campos ocultos nos formulários
        Object.keys(utmParams).forEach(param => {
            document.querySelectorAll(`input[name="${param}"]`).forEach(input => {
                input.value = utmParams[param];
            });
        });
        
        // Salvar no sessionStorage para uso posterior
        sessionStorage.setItem('utmParams', JSON.stringify(utmParams));
    },
    
    // Efeitos de scroll
    setupScrollEffects() {
        let lastScrollTop = 0;
        
        window.addEventListener('scroll', () => {
            const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
            
            // Header background no scroll
            if (this.elements.header) {
                if (scrollTop > 100) {
                    this.elements.header.classList.add('scrolled');
                } else {
                    this.elements.header.classList.remove('scrolled');
                }
            }
            
            lastScrollTop = scrollTop;
        });
    },
    
    // Configurar tabs "Como funciona"
    setupTabs() {
        this.elements.tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const target = btn.getAttribute('data-tab');
                
                // Remover classe ativa de todos
                this.elements.tabBtns.forEach(b => b.classList.remove('tab__btn--active'));
                this.elements.tabContents.forEach(c => c.classList.remove('tab__content--active'));
                
                // Adicionar classe ativa
                btn.classList.add('tab__btn--active');
                const targetContent = document.getElementById(target);
                if (targetContent) {
                    targetContent.classList.add('tab__content--active');
                }
            });
        });
    },
    
    // Configurar FAQ accordion
    setupFAQ() {
        this.elements.faqItems.forEach(item => {
            const question = item.querySelector('.faq__question');
            const answer = item.querySelector('.faq__answer');
            const icon = item.querySelector('.faq__icon');
            
            if (question && answer) {
                question.addEventListener('click', () => {
                    const isOpen = question.getAttribute('aria-expanded') === 'true';
                    
                    // Fechar todos os outros
                    this.elements.faqItems.forEach(otherItem => {
                        const otherQuestion = otherItem.querySelector('.faq__question');
                        const otherAnswer = otherItem.querySelector('.faq__answer');
                        const otherIcon = otherItem.querySelector('.faq__icon');
                        
                        if (otherItem !== item) {
                            otherQuestion.setAttribute('aria-expanded', 'false');
                            otherAnswer.style.maxHeight = null;
                            if (otherIcon) otherIcon.textContent = '+';
                        }
                    });
                    
                    // Toggle atual
                    if (isOpen) {
                        question.setAttribute('aria-expanded', 'false');
                        answer.style.maxHeight = null;
                        if (icon) icon.textContent = '+';
                    } else {
                        question.setAttribute('aria-expanded', 'true');
                        answer.style.maxHeight = answer.scrollHeight + 'px';
                        if (icon) icon.textContent = '−';
                    }
                });
            }
        });
    },
    
    // Configurar máscaras de input
    setupMasks() {
        // Máscara para WhatsApp
        document.querySelectorAll('input[name="whatsapp"]').forEach(input => {
            input.addEventListener('input', (e) => {
                let value = e.target.value.replace(/\D/g, '');
                if (value.length <= 11) {
                    value = value.replace(/^(\d{2})(\d)/g, '($1) $2');
                    value = value.replace(/(\d)(\d{4})$/, '$1-$2');
                }
                e.target.value = value;
            });
        });
        
        // Máscara para CNPJ
        const cnpjInput = document.getElementById('pj-cnpj');
        if (cnpjInput) {
            cnpjInput.addEventListener('input', (e) => {
                let value = e.target.value.replace(/\D/g, '');
                value = value.replace(/^(\d{2})(\d)/, '$1.$2');
                value = value.replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3');
                value = value.replace(/\.(\d{3})(\d)/, '.$1/$2');
                value = value.replace(/(\d{4})(\d)/, '$1-$2');
                e.target.value = value;
            });
        }
    },
    
    // Validação de formulários
    setupFormValidation() {
        // Validação em tempo real
        document.querySelectorAll('.form__input').forEach(input => {
            input.addEventListener('blur', () => this.validateField(input));
            input.addEventListener('input', () => this.clearFieldError(input));
        });
    },
    
    // Validar campo individual
    validateField(field) {
        const value = field.value.trim();
        const name = field.name;
        let error = '';
        
        // Validações específicas
        switch (name) {
            case 'nomeCompleto':
            case 'razaoSocial':
            case 'nomeFantasia':
                if (!value) error = 'Este campo é obrigatório';
                else if (value.length < 2) error = 'Deve ter pelo menos 2 caracteres';
                break;
                
            case 'whatsapp':
                if (!value) error = 'WhatsApp é obrigatório';
                else if (!/^\(\d{2}\) \d{4,5}-\d{4}$/.test(value)) error = 'Formato inválido';
                break;
                
            case 'email':
                if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
                    error = 'E-mail inválido';
                }
                break;
                
            case 'cnpj':
                if (!value) error = 'CNPJ é obrigatório';
                else if (!this.validarCNPJ(value)) error = 'CNPJ inválido';
                break;
                
            case 'cidade':
                if (!value) error = 'Cidade é obrigatória';
                break;
                
            case 'uf':
                if (!value) error = 'UF é obrigatório';
                break;
        }
        
        this.showFieldError(field, error);
        return !error;
    },
    
    // Mostrar erro do campo
    showFieldError(field, message) {
        const errorElement = document.getElementById(field.id + '-error');
        if (errorElement) {
            errorElement.textContent = message;
            errorElement.style.display = message ? 'block' : 'none';
        }
        
        if (message) {
            field.classList.add('form__input--error');
        } else {
            field.classList.remove('form__input--error');
        }
    },
    
    // Limpar erro do campo
    clearFieldError(field) {
        this.showFieldError(field, '');
    },
    
    // Limpar todos os erros
    clearAllErrors() {
        document.querySelectorAll('.form__error').forEach(error => {
            error.textContent = '';
            error.style.display = 'none';
        });
        document.querySelectorAll('.form__input--error').forEach(input => {
            input.classList.remove('form__input--error');
        });
    },
    
    // Validar CNPJ
    validarCNPJ(cnpj) {
        cnpj = cnpj.replace(/[^\d]+/g, '');
        
        if (cnpj.length !== 14) return false;
        
        // Eliminar CNPJs inválidos conhecidos
        if (/^(\d)\1{13}$/.test(cnpj)) return false;
        
        // Validar dígitos verificadores
        let tamanho = cnpj.length - 2;
        let numeros = cnpj.substring(0, tamanho);
        let digitos = cnpj.substring(tamanho);
        let soma = 0;
        let pos = tamanho - 7;
        
        for (let i = tamanho; i >= 1; i--) {
            soma += numeros.charAt(tamanho - i) * pos--;
            if (pos < 2) pos = 9;
        }
        
        let resultado = soma % 11 < 2 ? 0 : 11 - soma % 11;
        if (resultado != digitos.charAt(0)) return false;
        
        tamanho = tamanho + 1;
        numeros = cnpj.substring(0, tamanho);
        soma = 0;
        pos = tamanho - 7;
        
        for (let i = tamanho; i >= 1; i--) {
            soma += numeros.charAt(tamanho - i) * pos--;
            if (pos < 2) pos = 9;
        }
        
        resultado = soma % 11 < 2 ? 0 : 11 - soma % 11;
        return resultado == digitos.charAt(1);
    },
    
    // Processar submit do formulário
    async handleFormSubmit(e, tipo) {
        e.preventDefault();
        
        const form = e.target;
        const submitBtn = form.querySelector('button[type="submit"]');
        const btnText = submitBtn.querySelector('.btn__text');
        const btnLoading = submitBtn.querySelector('.btn__loading');
        
        // Validar formulário
        let isValid = true;
        const fields = form.querySelectorAll('.form__input:not([type="hidden"])');
        
        fields.forEach(field => {
            if (!this.validateField(field)) {
                isValid = false;
            }
        });
        
        // Verificar LGPD
        const lgpdCheckbox = form.querySelector('input[name="aceiteLGPD"]');
        if (!lgpdCheckbox.checked) {
            isValid = false;
            this.showFieldError(lgpdCheckbox, 'Você deve aceitar os termos para continuar');
        }
        
        if (!isValid) {
            // Focar no primeiro campo com erro
            const firstError = form.querySelector('.form__input--error');
            if (firstError) firstError.focus();
            return;
        }
        
        try {
            // Mostrar loading
            submitBtn.disabled = true;
            submitBtn.classList.add('loading');
            
            // Executar reCAPTCHA
            const recaptchaToken = await this.executeRecaptcha();
            
            // Coletar dados do formulário
            const formData = new FormData(form);
            const dados = Object.fromEntries(formData.entries());
            dados.recaptchaToken = recaptchaToken;
            dados.timestamp = new Date().toISOString();
            
            // Salvar no Firebase
            const resultado = await window.Firebase.salvarLead(dados);
            
            if (resultado.success) {
                // Sucesso - redirecionar para página de obrigado
                window.location.href = '/obrigado.html';
            } else {
                throw new Error(resultado.error || 'Erro ao salvar dados');
            }
            
        } catch (error) {
            console.error('Erro no envio:', error);
            alert('Ocorreu um erro ao enviar o formulário. Tente novamente.');
        } finally {
            // Remover loading
            submitBtn.disabled = false;
            submitBtn.classList.remove('loading');
        }
    },
    
    // Executar reCAPTCHA
    async executeRecaptcha() {
        return new Promise((resolve, reject) => {
            if (typeof grecaptcha !== 'undefined') {
                grecaptcha.ready(() => {
                    grecaptcha.execute(this.config.recaptchaSiteKey, { action: 'submit' })
                        .then(resolve)
                        .catch(reject);
                });
            } else {
                reject(new Error('reCAPTCHA não carregado'));
            }
        });
    }
};

// Adicionar estilos CSS específicos para formulários e modal
const modalStyles = `
    .modal {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 9999;
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: 0;
        visibility: hidden;
        transition: all 0.3s ease;
    }
    
    .modal--active {
        opacity: 1;
        visibility: visible;
    }
    
    .modal__overlay {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.7);
        backdrop-filter: blur(4px);
    }
    
    .modal__content {
        position: relative;
        background: white;
        border-radius: 16px;
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
        max-width: 500px;
        width: 90%;
        max-height: 90vh;
        overflow-y: auto;
        transform: scale(0.9);
        transition: transform 0.3s ease;
    }
    
    .modal--active .modal__content {
        transform: scale(1);
    }
    
    .form__container {
        padding: 2rem;
    }
    
    .form__header {
        text-align: center;
        margin-bottom: 2rem;
        position: relative;
    }
    
    .form__close {
        position: absolute;
        top: -1rem;
        right: -1rem;
        background: #f1f5f9;
        border: none;
        border-radius: 50%;
        width: 40px;
        height: 40px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 1.5rem;
        cursor: pointer;
        transition: all 0.2s ease;
    }
    
    .form__close:hover {
        background: #e2e8f0;
        transform: scale(1.1);
    }
    
    .form__group {
        margin-bottom: 1.5rem;
    }
    
    .form__row {
        display: grid;
        grid-template-columns: 1fr 120px;
        gap: 1rem;
    }
    
    .form__label {
        display: block;
        margin-bottom: 0.5rem;
        font-weight: 500;
        color: #374151;
    }
    
    .form__input {
        width: 100%;
        padding: 0.875rem 1rem;
        border: 2px solid #e5e7eb;
        border-radius: 8px;
        font-size: 1rem;
        transition: all 0.2s ease;
    }
    
    .form__input:focus {
        outline: none;
        border-color: #25D366;
        box-shadow: 0 0 0 3px rgba(37, 211, 102, 0.1);
    }
    
    .form__input--error {
        border-color: #ef4444;
    }
    
    .form__error {
        display: none;
        color: #ef4444;
        font-size: 0.875rem;
        margin-top: 0.25rem;
    }
    
    .form__checkbox {
        display: flex;
        align-items: flex-start;
        gap: 0.75rem;
        cursor: pointer;
        font-size: 0.9rem;
        line-height: 1.5;
    }
    
    .form__checkbox input {
        margin: 0;
    }
    
    .form__checkmark {
        flex-shrink: 0;
        width: 20px;
        height: 20px;
        border: 2px solid #d1d5db;
        border-radius: 4px;
        margin-top: 2px;
    }
    
    .nav__menu--active {
        display: flex;
        position: absolute;
        top: 100%;
        left: 0;
        right: 0;
        flex-direction: column;
        background: white;
        box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1);
        padding: 1rem;
        gap: 1rem;
    }
    
    .modal-open {
        overflow: hidden;
    }
    
    .testimonials__grid {
        display: grid;
        grid-template-columns: 1fr;
        gap: 2rem;
    }
    
    @media (min-width: 768px) {
        .testimonials__grid {
            grid-template-columns: repeat(3, 1fr);
        }
    }
    
    .testimonial {
        background: white;
        padding: 2rem;
        border-radius: 16px;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    }
    
    .testimonial__content {
        margin-bottom: 1.5rem;
    }
    
    .testimonial__author {
        display: flex;
        align-items: center;
        gap: 1rem;
    }
    
    .testimonial__avatar {
        width: 48px;
        height: 48px;
        background: #25D366;
        color: white;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 600;
        font-size: 1.125rem;
    }
    
    .faq__answer {
        max-height: 0;
        overflow: hidden;
        transition: max-height 0.3s ease;
    }
    
    .faq__question {
        width: 100%;
        background: none;
        border: none;
        padding: 1.5rem 0;
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 1.125rem;
        font-weight: 600;
        cursor: pointer;
        border-bottom: 1px solid #e5e7eb;
    }
    
    .faq__question:hover {
        color: #25D366;
    }
    
    .faq__icon {
        font-size: 1.5rem;
        color: #25D366;
        transition: transform 0.3s ease;
    }
`;

// Adicionar estilos ao head
const styleSheet = document.createElement('style');
styleSheet.textContent = modalStyles;
document.head.appendChild(styleSheet);

console.log('✅ JavaScript da Landing Page carregado!');
