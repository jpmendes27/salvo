#!/bin/bash

# Script 2a: CSS da Landing Page do Salvô
# Autor: Rafael Ferreira
# Data: 2025-08-09

echo "🎨 Criando estilos CSS da Landing Page..."

# Criar arquivo CSS principal
echo "📄 Criando style.css..."
cat > salvo-landing/public/assets/css/style.css << 'EOF'
/* ==========================================================================
   Salvô Landing Page - Estilos CSS
   ========================================================================== */

/* Reset e Variáveis CSS */
:root {
  /* Cores WhatsApp */
  --whatsapp-green: #25D366;
  --whatsapp-dark: #075E54;
  --whatsapp-medium: #128C7E;
  
  /* Cores neutras */
  --color-dark: #111111;
  --color-white: #ffffff;
  --color-light: #ECE5DD;
  --color-gray-100: #f8f9fa;
  --color-gray-200: #e9ecef;
  --color-gray-300: #dee2e6;
  --color-gray-400: #ced4da;
  --color-gray-500: #adb5bd;
  --color-gray-600: #6c757d;
  --color-gray-700: #495057;
  --color-gray-800: #343a40;
  --color-gray-900: #212529;
  
  /* Gradientes */
  --gradient-primary: linear-gradient(135deg, var(--whatsapp-green) 0%, var(--whatsapp-medium) 100%);
  --gradient-dark: linear-gradient(135deg, var(--whatsapp-dark) 0%, var(--whatsapp-medium) 100%);
  
  /* Tipografia */
  --font-primary: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --font-secondary: 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  
  /* Tamanhos */
  --container-max-width: 1200px;
  --border-radius: 8px;
  --border-radius-lg: 16px;
  --shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  --shadow-lg: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
  
  /* Transições */
  --transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  --transition-fast: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
}

/* Reset CSS */
*,
*::before,
*::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html {
  scroll-behavior: smooth;
  font-size: 16px;
}

body {
  font-family: var(--font-primary);
  font-size: 1rem;
  line-height: 1.6;
  color: var(--color-dark);
  background-color: var(--color-white);
  overflow-x: hidden;
}

/* Tipografia */
h1, h2, h3, h4, h5, h6 {
  font-family: var(--font-secondary);
  font-weight: 600;
  line-height: 1.2;
  margin-bottom: 0.5em;
}

h1 { font-size: clamp(2.5rem, 5vw, 4rem); }
h2 { font-size: clamp(2rem, 4vw, 3rem); }
h3 { font-size: clamp(1.5rem, 3vw, 2rem); }
h4 { font-size: clamp(1.25rem, 2.5vw, 1.5rem); }

p {
  margin-bottom: 1rem;
}

a {
  color: var(--whatsapp-green);
  text-decoration: none;
  transition: var(--transition-fast);
}

a:hover {
  color: var(--whatsapp-medium);
  text-decoration: underline;
}

/* Container */
.container {
  max-width: var(--container-max-width);
  margin: 0 auto;
  padding: 0 1rem;
}

@media (min-width: 640px) {
  .container { padding: 0 2rem; }
}

/* Buttons */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.875rem 1.5rem;
  font-family: var(--font-secondary);
  font-size: 1rem;
  font-weight: 500;
  line-height: 1;
  text-align: center;
  text-decoration: none;
  border: 2px solid transparent;
  border-radius: var(--border-radius);
  cursor: pointer;
  transition: var(--transition);
  user-select: none;
  white-space: nowrap;
}

.btn:focus {
  outline: 2px solid var(--whatsapp-green);
  outline-offset: 2px;
}

.btn--primary {
  background: var(--gradient-primary);
  color: var(--color-white);
  border-color: var(--whatsapp-green);
}

.btn--primary:hover {
  background: var(--whatsapp-medium);
  transform: translateY(-2px);
  box-shadow: var(--shadow-lg);
  text-decoration: none;
  color: var(--color-white);
}

.btn--secondary {
  background: transparent;
  color: var(--whatsapp-green);
  border-color: var(--whatsapp-green);
}

.btn--secondary:hover {
  background: var(--whatsapp-green);
  color: var(--color-white);
  transform: translateY(-2px);
  text-decoration: none;
}

.btn--full {
  width: 100%;
}

.btn__icon {
  font-size: 1.125rem;
}

.btn__loading {
  display: none;
}

.btn.loading .btn__text {
  display: none;
}

.btn.loading .btn__loading {
  display: inline;
}

/* Header */
.header {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid var(--color-gray-200);
  z-index: 1000;
  transition: var(--transition);
}

.header.scrolled {
  background: rgba(255, 255, 255, 0.98);
  box-shadow: var(--shadow);
}

.nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 0;
}

.nav__logo-img {
  height: 40px;
  width: auto;
}

.nav__menu {
  display: none;
  gap: 2rem;
}

@media (min-width: 768px) {
  .nav__menu {
    display: flex;
  }
}

.nav__link {
  font-weight: 500;
  color: var(--color-dark);
  transition: var(--transition-fast);
}

.nav__link:hover {
  color: var(--whatsapp-green);
  text-decoration: none;
}

.nav__toggle {
  display: flex;
  flex-direction: column;
  gap: 4px;
  background: none;
  border: none;
  cursor: pointer;
  padding: 8px;
}

@media (min-width: 768px) {
  .nav__toggle {
    display: none;
  }
}

.nav__toggle span {
  width: 25px;
  height: 3px;
  background: var(--color-dark);
  border-radius: 2px;
  transition: var(--transition-fast);
}

/* Hero Section */
.hero {
  padding: 8rem 0 4rem;
  background: linear-gradient(135deg, 
    var(--color-white) 0%, 
    var(--color-gray-100) 50%, 
    var(--color-light) 100%);
  overflow: hidden;
}

.hero .container {
  display: grid;
  grid-template-columns: 1fr;
  gap: 3rem;
  align-items: center;
}

@media (min-width: 768px) {
  .hero .container {
    grid-template-columns: 1fr 1fr;
    gap: 4rem;
  }
}

.hero__title {
  font-size: clamp(2.5rem, 6vw, 4rem);
  font-weight: 700;
  line-height: 1.1;
  margin-bottom: 1.5rem;
}

.hero__title-highlight {
  background: var(--gradient-primary);
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  display: inline-block;
}

.hero__description {
  font-size: 1.25rem;
  color: var(--color-gray-700);
  margin-bottom: 2rem;
  max-width: 600px;
}

.hero__cta {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

@media (min-width: 640px) {
  .hero__cta {
    flex-direction: row;
    gap: 1.5rem;
  }
}

/* Hero Phone */
.hero__phone {
  position: relative;
  max-width: 300px;
  margin: 0 auto;
}

.phone__screen {
  background: var(--color-dark);
  border-radius: 30px;
  padding: 20px;
  aspect-ratio: 9 / 19.5;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
}

.phone__screen::before {
  content: '';
  position: absolute;
  top: 10px;
  left: 50%;
  transform: translateX(-50%);
  width: 60px;
  height: 6px;
  background: var(--color-gray-800);
  border-radius: 3px;
}

.whatsapp__chat {
  background: var(--color-light);
  border-radius: 20px;
  padding: 1.5rem;
  width: 100%;
  height: 80%;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  justify-content: center;
}

.chat__message {
  max-width: 80%;
  padding: 0.75rem 1rem;
  border-radius: 18px;
  font-size: 0.875rem;
  line-height: 1.4;
  animation: fadeInUp 0.6s ease-out;
}

.chat__message--received {
  background: var(--color-white);
  align-self: flex-start;
  border-bottom-left-radius: 6px;
}

.chat__message--sent {
  background: var(--whatsapp-green);
  color: var(--color-white);
  align-self: flex-end;
  border-bottom-right-radius: 6px;
}

/* Sections */
.section {
  padding: 4rem 0;
}

.section__title {
  text-align: center;
  font-size: clamp(2rem, 4vw, 3rem);
  font-weight: 700;
  margin-bottom: 3rem;
  color: var(--color-dark);
}

/* Como Funciona */
.how-it-works {
  background: var(--color-white);
}

.how-it-works__tabs {
  display: flex;
  gap: 1rem;
  justify-content: center;
  margin-bottom: 3rem;
}

.tab__btn {
  padding: 0.875rem 1.5rem;
  background: transparent;
  border: 2px solid var(--color-gray-300);
  border-radius: var(--border-radius);
  font-family: var(--font-secondary);
  font-weight: 500;
  color: var(--color-gray-600);
  cursor: pointer;
  transition: var(--transition);
}

.tab__btn--active,
.tab__btn:hover {
  border-color: var(--whatsapp-green);
  color: var(--whatsapp-green);
  background: rgba(37, 211, 102, 0.1);
}

.tab__content {
  display: none;
}

.tab__content--active {
  display: block;
}

.steps {
  display: grid;
  grid-template-columns: 1fr;
  gap: 2rem;
  max-width: 800px;
  margin: 0 auto;
}

@media (min-width: 768px) {
  .steps {
    grid-template-columns: repeat(3, 1fr);
    gap: 3rem;
  }
}

.step {
  text-align: center;
  padding: 2rem 1rem;
}

.step__number {
  width: 60px;
  height: 60px;
  background: var(--gradient-primary);
  color: var(--color-white);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
  font-weight: 700;
  margin: 0 auto 1.5rem;
}

.step__content h3 {
  font-size: 1.25rem;
  margin-bottom: 0.5rem;
  color: var(--color-dark);
}

.step__content p {
  color: var(--color-gray-600);
  margin-bottom: 0;
}

/* Benefícios */
.benefits {
  background: var(--color-gray-100);
}

.benefits__grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 2rem;
}

@media (min-width: 640px) {
  .benefits__grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (min-width: 1024px) {
  .benefits__grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

.benefit {
  background: var(--color-white);
  padding: 2rem;
  border-radius: var(--border-radius-lg);
  box-shadow: var(--shadow);
  text-align: center;
  transition: var(--transition);
}

.benefit:hover {
  transform: translateY(-4px);
  box-shadow: var(--shadow-lg);
}

.benefit__icon {
  font-size: 3rem;
  margin-bottom: 1rem;
  display: block;
}

.benefit h3 {
  font-size: 1.25rem;
  margin-bottom: 1rem;
  color: var(--color-dark);
}

.benefit p {
  color: var(--color-gray-600);
  margin-bottom: 0;
}

/* Animações */
@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.fade-in-up {
  animation: fadeInUp 0.6s ease-out;
}

/* Responsive */
@media (max-width: 767px) {
  .hero {
    padding: 6rem 0 3rem;
  }
  
  .hero__cta {
    gap: 0.75rem;
  }
  
  .btn {
    padding: 1rem 1.25rem;
    font-size: 0.9rem;
  }
  
  .section {
    padding: 3rem 0;
  }
}

/* Utilities */
.text-center { text-align: center; }
.text-left { text-align: left; }
.text-right { text-align: right; }

.mb-0 { margin-bottom: 0; }
.mb-1 { margin-bottom: 0.5rem; }
.mb-2 { margin-bottom: 1rem; }
.mb-3 { margin-bottom: 1.5rem; }
.mb-4 { margin-bottom: 2rem; }

.mt-0 { margin-top: 0; }
.mt-1 { margin-top: 0.5rem; }
.mt-2 { margin-top: 1rem; }
.mt-3 { margin-top: 1.5rem; }
.mt-4 { margin-top: 2rem; }

.hidden { display: none; }
.block { display: block; }
.flex { display: flex; }
.grid { display: grid; }

/* Acessibilidade */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

/* Focus para acessibilidade */
*:focus {
  outline: 2px solid var(--whatsapp-green);
  outline-offset: 2px;
}

/* Print styles */
@media print {
  .header,
  .nav__toggle,
  .btn,
  .forms {
    display: none !important;
  }
  
  body {
    font-size: 12pt;
    line-height: 1.4;
  }
  
  .hero,
  .section {
    padding: 1rem 0;
  }
}
EOF

echo ""
echo "✅ CSS da Landing Page criado com sucesso!"
echo ""
echo "🎨 Estilos incluídos:"
echo "   ├── Reset CSS moderno"
echo "   ├── Variáveis CSS (cores WhatsApp)"
echo "   ├── Tipografia responsiva (Inter/Poppins)"
echo "   ├── Sistema de grid flexível"
echo "   ├── Componentes de UI (botões, cards)"
echo "   ├── Seções Hero, Benefícios, Como Funciona"
echo "   ├── Animações e transições suaves"
echo "   ├── Design responsivo (mobile-first)"
echo "   ├── Acessibilidade (focus, contraste)"
echo "   └── Utilitários CSS"
echo ""
echo "📱 Breakpoints:"
echo "   ├── Mobile: < 640px"
echo "   ├── Tablet: 640px - 1024px"
echo "   └── Desktop: > 1024px"
echo ""
echo "🎯 Próximo passo:"
echo "   Execute: chmod +x 2b_landing_html.sh && ./2b_landing_html.sh"
echo ""
echo "✨ Estilos prontos para a landing page!"