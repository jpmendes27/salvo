/**
 * Sistema de salvamento local via Flask Backend
 * Versão: 2.2 - Sem upload de imagem
 */

class SalvoLocalStorage {
    constructor() {
        // Detectar ambiente automaticamente
        this.backendUrl = this.getBackendUrl();
        this.apiEndpoint = `${this.backendUrl}/api/sellers`;
        this.checkWhatsappEndpoint = `${this.backendUrl}/api/check_whatsapp`;
        
        console.log('🔥 Sistema Flask v2.2 inicializado!');
        console.log('🌐 Backend URL:', this.backendUrl);
        console.log('🔧 Ambiente:', this.getEnvironment());
        
        this.testConnection();
    }

    getEnvironment() {
        const hostname = window.location.hostname;
        if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0') {
            return 'local';
        }
        return 'production';
    }

    getBackendUrl() {
        const env = this.getEnvironment();
        if (env === 'local') {
            return 'http://127.0.0.1:5000';
        }
        // Em produção, usar a mesma origem (same origin)
        return `${window.location.protocol}//${window.location.host}`;
    }

    async testConnection() {
        try {
            const response = await fetch(`${this.backendUrl}/api/health`);
            if (response.ok) {
                const data = await response.json();
                console.log('✅ Backend conectado:', data.service, data.version);
                console.log('✨ Features:', data.features);
            } else {
                throw new Error(`HTTP ${response.status}`);
            }
        } catch (error) {
            console.warn('⚠️ Backend não está rodando');
            console.warn('💡 Execute: ./start_backend_venv.sh');
        }
    }

    async checkWhatsAppExists(whatsapp) {
        try {
            const response = await fetch(this.checkWhatsappEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ whatsapp })
            });

            const result = await response.json();
            return result.exists;
        } catch (error) {
            console.error('❌ Erro ao verificar WhatsApp:', error);
            return false;
        }
    }

    async saveSeller(sellerData) {
        console.log('📊 Salvando seller...');
        
        try {
            // Verificar WhatsApp único antes de enviar
            const whatsappExists = await this.checkWhatsAppExists(sellerData.whatsapp);
            if (whatsappExists) {
                return {
                    success: false,
                    error: 'Este WhatsApp já está cadastrado no sistema',
                    message: 'WhatsApp já cadastrado'
                };
            }

            // Preparar dados para envio (sem FormData - apenas JSON)
            const dataToSend = {
                nome: sellerData.businessName || sellerData.nome,
                categoria: sellerData.category || sellerData.categoria,
                whatsapp: sellerData.whatsapp,
                email: sellerData.email,
                cep: sellerData.cep,
                endereco: sellerData.address || sellerData.endereco,
                complemento: sellerData.complement || sellerData.complemento,
                cidade: sellerData.city || sellerData.cidade,
                uf: sellerData.uf
            };

            // Adicionar geolocalização se disponível
            if (sellerData.latitude && sellerData.longitude) {
                dataToSend.latitude = parseFloat(sellerData.latitude);
                dataToSend.longitude = parseFloat(sellerData.longitude);
                console.log('📍 Geolocalização incluída:', dataToSend.latitude, dataToSend.longitude);
            }

            console.log('📤 Enviando dados via JSON:', dataToSend);

            const response = await fetch(this.apiEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(dataToSend)
            });

            const responseText = await response.text();
            console.log('📊 Resposta:', responseText);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${responseText}`);
            }

            const result = JSON.parse(responseText);
            console.log('✅ Seller salvo:', result);

            return {
                success: true,
                data: result,
                sellerId: result.seller_id,
                hasLocation: !!(sellerData.latitude && sellerData.longitude)
            };

        } catch (error) {
            console.error('❌ Erro no salvamento:', error);
            return {
                success: false,
                error: error.message,
                message: 'Erro ao salvar dados. Verifique sua conexão.'
            };
        }
    }
}

// Instanciar sistema
const salvoStorage = new SalvoLocalStorage();

// Exportar para uso global
window.SalvoStorage = salvoStorage;
window.salvarSeller = async function(data) {
    return await salvoStorage.saveSeller(data);
};

console.log('✅ SalvoLocalStorage v2.2 inicializado (sem upload)');