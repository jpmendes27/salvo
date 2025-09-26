/**
 * Sistema de validações e máscaras para formulários Salvô
 * Versão: 2.1 - Sem campo de imagem e validações corrigidas
 */

class SalvoMasksSellers {
    constructor() {
        this.init();
        console.log('🎭 SalvoMasksSellers inicializado');
    }

    init() {
        // Aplicar máscaras nos campos
        this.aplicarMascaras();
        
        // Configurar validação de CEP
        this.configurarCEP();
        
        // Configurar geolocalização opcional
        this.configurarGeolocalizacao();
    }

    aplicarMascaras() {
        // Máscara para WhatsApp
        const whatsappInput = document.getElementById('whatsapp');
        if (whatsappInput) {
            whatsappInput.addEventListener('input', (e) => {
                let value = e.target.value.replace(/\D/g, '');
                value = value.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
                e.target.value = value;
            });
        }

        // Máscara para CEP
        const cepInput = document.getElementById('cep');
        if (cepInput) {
            cepInput.addEventListener('input', (e) => {
                let value = e.target.value.replace(/\D/g, '');
                value = value.replace(/(\d{5})(\d{3})/, '$1-$2');
                e.target.value = value;
            });
        }
    }

    async buscarEnderecoPorCEP(cep) {
        try {
            const cleanCEP = cep.replace(/\D/g, '');
            if (cleanCEP.length !== 8) return null;

            const response = await fetch(`https://viacep.com.br/ws/${cleanCEP}/json/`);
            const data = await response.json();

            if (data.erro) return null;

            return {
                endereco: data.logradouro,
                cidade: data.localidade,
                uf: data.uf,
                bairro: data.bairro
            };
        } catch (error) {
            console.error('❌ Erro ao buscar CEP:', error);
            return null;
        }
    }

    configurarCEP() {
        const cepInput = document.getElementById('cep');
        const enderecoInput = document.getElementById('address');
        const cidadeInput = document.getElementById('city');
        const ufSelect = document.getElementById('uf');

        if (cepInput && enderecoInput && cidadeInput && ufSelect) {
            cepInput.addEventListener('blur', async () => {
                const cep = cepInput.value;
                if (cep.length === 9) { // formato: 00000-000
                    const endereco = await this.buscarEnderecoPorCEP(cep);
                    if (endereco) {
                        console.log('✅ Endereço encontrado via CEP');
                        enderecoInput.value = endereco.endereco;
                        cidadeInput.value = endereco.cidade;
                        ufSelect.value = endereco.uf;
                    }
                }
            });
        }
    }

    configurarGeolocalizacao() {
        console.log('📍 Configurando geolocalização opcional...');
        
        // Tentar obter localização, mas não bloquear se falhar
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    console.log('✅ Localização obtida:', {
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude
                    });
                    
                    // Salvar nos campos ocultos se existirem
                    const latInput = document.getElementById('latitude');
                    const lngInput = document.getElementById('longitude');
                    
                    if (latInput) latInput.value = position.coords.latitude;
                    if (lngInput) lngInput.value = position.coords.longitude;
                },
                (error) => {
                    console.warn('⚠️ Não foi possível obter localização:', error.message);
                    console.log('💡 Continuando sem geolocalização...');
                }
            );
        } else {
            console.warn('⚠️ Geolocalização não suportada no navegador');
        }
    }

    validarCampos(formData) {
        const errors = {};

        // Campos obrigatórios
        const requiredFields = {
            businessName: 'Nome do negócio',
            category: 'Categoria',
            whatsapp: 'WhatsApp',
            email: 'E-mail',
            cep: 'CEP',
            address: 'Endereço',
            complement: 'Complemento',
            city: 'Cidade',
            uf: 'UF'
        };

        // Validar campos obrigatórios
        for (const [field, label] of Object.entries(requiredFields)) {
            if (!formData[field] || formData[field].trim() === '') {
                errors[field] = `${label} é obrigatório`;
            }
        }

        // Validar e-mail
        if (formData.email && !this.validarEmail(formData.email)) {
            errors.email = 'E-mail inválido';
        }

        // Validar WhatsApp
        if (formData.whatsapp && !this.validarWhatsApp(formData.whatsapp)) {
            errors.whatsapp = 'WhatsApp inválido';
        }

        // Validar CEP
        if (formData.cep && !this.validarCEP(formData.cep)) {
            errors.cep = 'CEP inválido';
        }

        return errors;
    }

    validarEmail(email) {
        const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return regex.test(email);
    }

    validarWhatsApp(whatsapp) {
        const cleanPhone = whatsapp.replace(/\D/g, '');
        return cleanPhone.length >= 10;
    }

    validarCEP(cep) {
        const cleanCEP = cep.replace(/\D/g, '');
        return cleanCEP.length === 8;
    }

    mostrarErros(errors) {
        // Limpar erros anteriores
        document.querySelectorAll('.form__error').forEach(error => {
            error.textContent = '';
        });

        // Mostrar novos erros
        for (const [field, message] of Object.entries(errors)) {
            const errorElement = document.getElementById(`${field.replace('businessName', 'business-name')}-error`);
            if (errorElement) {
                errorElement.textContent = message;
            }
        }
    }

    async coletarDadosFormulario() {
        console.log('📊 Coletando dados do formulário...');

        const formData = {
            businessName: document.getElementById('business-name')?.value || '',
            category: document.getElementById('category')?.value || '',
            whatsapp: document.getElementById('whatsapp')?.value || '',
            email: document.getElementById('email')?.value || '',
            cep: document.getElementById('cep')?.value || '',
            address: document.getElementById('address')?.value || '',
            complement: document.getElementById('complement')?.value || '',
            city: document.getElementById('city')?.value || '',
            uf: document.getElementById('uf')?.value || '',
            // Campos opcionais
            latitude: document.getElementById('latitude')?.value || null,
            longitude: document.getElementById('longitude')?.value || null
        };

        console.log('📊 Dados coletados:', formData);
        return formData;
    }

    async processarSubmissao() {
        console.log('📤 Processando submissão...');

        // Coletar dados
        const formData = await this.coletarDadosFormulario();

        // Validar dados
        const errors = this.validarCampos(formData);
        if (Object.keys(errors).length > 0) {
            console.warn('⚠️ Erros de validação:', errors);
            this.mostrarErros(errors);
            return false;
        }

        // Salvar dados
        try {
            const result = await window.salvarSeller(formData);
            
            if (result.success) {
                console.log('✅ Cadastro realizado com sucesso!');
                window.location.href = 'obrigado.html';
                return true;
            } else {
                throw new Error(result.error || 'Erro desconhecido');
            }
        } catch (error) {
            console.error('❌ Erro no cadastro:', error);
            alert('Erro ao realizar cadastro. Verifique os dados e tente novamente.');
            return false;
        }
    }
}

// Modal System
class SalvoModalSellers {
    constructor() {
        this.modal = document.getElementById('modal-forms');
        this.init();
        console.log('📱 SalvoModalSellers inicializado');
    }

    init() {
        // Botão para abrir modal
        const ctaSeller = document.getElementById('cta-seller');
        if (ctaSeller) {
            ctaSeller.addEventListener('click', () => this.abrirModal());
        }

        // Botão para fechar modal
        const closeBtn = document.querySelector('.form__close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.fecharModal());
        }

        // Fechar ao clicar no overlay
        const overlay = document.querySelector('.modal__overlay');
        if (overlay) {
            overlay.addEventListener('click', () => this.fecharModal());
        }
    }

    abrirModal() {
        if (this.modal) {
            this.modal.classList.add('modal--active');
            document.body.style.overflow = 'hidden';
        }
    }

    fecharModal() {
        if (this.modal) {
            this.modal.classList.remove('modal--active');
            document.body.style.overflow = 'auto';
        }
    }
}

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
    // Inicializar sistemas
    const maskSystem = new SalvoMasksSellers();
    const modalSystem = new SalvoModalSellers();

    // Configurar submit do formulário
    const form = document.getElementById('form-seller-submit');
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const submitBtn = e.target.querySelector('button[type="submit"]');
            const btnText = submitBtn.querySelector('.btn__text');
            const btnLoading = submitBtn.querySelector('.btn__loading');

            // UI Loading
            submitBtn.disabled = true;
            btnText.style.display = 'none';
            btnLoading.style.display = 'inline';

            try {
                await maskSystem.processarSubmissao();
            } finally {
                // Restaurar UI
                submitBtn.disabled = false;
                btnText.style.display = 'inline';
                btnLoading.style.display = 'none';
            }
        });
    }

    console.log('✅ Validações sellers inicializadas');
});