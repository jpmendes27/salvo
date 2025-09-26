// Salvô Landing Page - JavaScript Principal
// Versão: 2.1 - Formulário único de sellers
// Autor: Rafael Ferreira
// Data: 2025-09-25

document.addEventListener('DOMContentLoaded', function() {
    // Inicializar aplicação
    App.init();
});

// Objeto principal da aplicação
const App = {
    // Configurações
    config: {
        whatsappNumber: '5511999999999'
    },
    
    // Elementos DOM
    elements: {
        header: null,
        navToggle: null,
        navMenu: null,
        modal: null,
        modalOverlay: null,
        ctaSeller: null,
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
    },
    
    // Cache dos elementos DOM
    cacheElements() {
        this.elements = {
            header: document.getElementById('header'),
            navToggle: document.getElementById('nav-toggle'),
            navMenu: document.getElementById('nav-menu'),
            modal: document.getElementById('modal-forms'),
            modalOverlay: document.querySelector('.modal__overlay'),
            ctaSeller: document.getElementById('cta-seller'),
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
        
        // CTA para abrir formulário (já gerenciado pelo masks-validations.js)
        // Removido daqui para evitar conflito
        
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
    },
    
    // Toggle menu mobile
    toggleMobileMenu() {
        if (this.elements.navMenu) {
            this.elements.navMenu.classList.toggle('nav__menu--active');
            this.elements.navToggle.classList.toggle('nav__toggle--active');
        }
    },
    
    // Fechar modal
    closeModal() {
        if (!this.elements.modal) return;
        
        this.elements.modal.classList.remove('modal--active');
        document.body.style.overflow = 'auto';
        
        // Limpar formulário
        const form = document.getElementById('form-seller-submit');
        if (form) {
            form.reset();
            // Limpar erros
            document.querySelectorAll('.form__error').forEach(error => {
                error.textContent = '';
            });
            document.querySelectorAll('.form__input').forEach(input => {
                input.classList.remove('form__input--error');
            });
        }
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
    }
};

// Estilos CSS para o modal e componentes
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
        display: flex !important;
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