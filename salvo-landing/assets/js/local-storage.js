/* ========================================
   SALVÔ - BACKEND LOCAL PYTHON
   Sistema integrado com Flask local
======================================== */

class SalvoLocalStorage {
  static isConfigured = true;
  static backendUrl = 'http://localhost:5000';

  static init() {
    console.log('🐍 Sistema Flask local inicializado!');
    console.log('🌐 Backend URL:', this.backendUrl);
    return true;
  }

  static async saveSeller(sellerData, logoFile) {
    try {
      console.log('📊 Salvando via Flask local...');

      const validation = this.validateSeller(sellerData);
      if (!validation.valid) {
        return {
          success: false,
          error: validation.error,
          message: `Erro de validação: ${validation.error}`
        };
      }

      const formData = new FormData();
      Object.keys(sellerData).forEach(key => {
        if (sellerData[key] !== null && sellerData[key] !== undefined) {
          formData.append(key, sellerData[key]);
        }
      });
      
      if (logoFile) {
        formData.append('logo', logoFile);
      }

      const response = await fetch(`${this.backendUrl}/api/save_seller`, {
        method: 'POST',
        body: formData
      });

      const result = await response.json();

      if (result.success) {
        console.log('✅ Seller salvo via Flask local!');
        console.log('📋 ID:', result.id);
        console.log('📄 Dados salvos em: data/sellers/sellers.json');
      } else {
        console.error('❌ Erro Flask:', result.error);
      }

      return result;

    } catch (error) {
      console.error('❌ Erro requisição:', error);
      
      // Verificar se é erro de conexão
      if (error.message.includes('fetch')) {
        return {
          success: false,
          error: 'Backend não disponível',
          message: 'O backend Python não está rodando. Execute: python app/main.py'
        };
      }
      
      return {
        success: false,
        error: error.message,
        message: 'Erro de conectividade. Verifique se o backend está rodando.'
      };
    }
  }

  static validateSeller(data) {
    if (!data.businessName || data.businessName.length < 2) {
      return { valid: false, error: 'Nome do negócio é obrigatório' };
    }
    if (!data.category) {
      return { valid: false, error: 'Categoria é obrigatória' };
    }
    if (!data.whatsapp || data.whatsapp.replace(/\D/g, '').length < 10) {
      return { valid: false, error: 'WhatsApp é obrigatório' };
    }
    if (!data.email || !data.email.includes('@')) {
      return { valid: false, error: 'E-mail é obrigatório' };
    }
    if (!data.cep || data.cep.replace(/\D/g, '').length !== 8) {
      return { valid: false, error: 'CEP é obrigatório' };
    }
    if (!data.address || data.address.length < 5) {
      return { valid: false, error: 'Endereço é obrigatório' };
    }
    if (!data.complement || data.complement.length < 1) {
      return { valid: false, error: 'Complemento é obrigatório' };
    }
    if (!data.city || data.city.length < 2) {
      return { valid: false, error: 'Cidade é obrigatória' };
    }
    if (!data.uf) {
      return { valid: false, error: 'UF é obrigatório' };
    }
    if (!data.latitude || !data.longitude) {
      return { valid: false, error: 'Localização é obrigatória' };
    }
    return { valid: true };
  }

  static async listSellers(filters = {}) {
    try {
      const params = new URLSearchParams();
      if (filters.category) params.append('category', filters.category);
      if (filters.status) params.append('status', filters.status);
      if (filters.limit) params.append('limit', filters.limit);

      const response = await fetch(`${this.backendUrl}/api/list_sellers?${params}`);
      const result = await response.json();

      return result.success ? result.sellers : [];
    } catch (error) {
      console.error('❌ Erro ao listar:', error);
      return [];
    }
  }

  static async getStats() {
    try {
      const response = await fetch(`${this.backendUrl}/api/stats`);
      const result = await response.json();

      return result.success ? result.stats : null;
    } catch (error) {
      console.error('❌ Erro estatísticas:', error);
      return null;
    }
  }

  static async checkBackend() {
    try {
      const response = await fetch(`${this.backendUrl}/health`);
      const result = await response.json();
      
      if (result.status === 'healthy') {
        console.log('✅ Backend Flask conectado!');
        console.log('📊 Sellers cadastrados:', result.sellers_count);
        return true;
      }
      
      return false;
    } catch (error) {
      console.warn('⚠️ Backend não está rodando');
      console.warn('💡 Execute: python app/main.py');
      return false;
    }
  }
}

// Manter compatibilidade
window.SalvoFirebaseSellers = SalvoLocalStorage;
window.SalvoLocalStorage = SalvoLocalStorage;

// Inicializar e verificar backend
document.addEventListener('DOMContentLoaded', function() {
  setTimeout(async () => {
    SalvoLocalStorage.init();
    await SalvoLocalStorage.checkBackend();
  }, 1000);
});

// APIs externas (ViaCEP e Geolocalização)
class ViaCEPService {
  static async getAddressByCEP(cep) {
    try {
      const cleanCEP = cep.replace(/\D/g, '');
      
      if (cleanCEP.length !== 8) {
        throw new Error('CEP deve ter 8 dígitos');
      }

      const response = await fetch(`https://viacep.com.br/ws/${cleanCEP}/json/`);
      const data = await response.json();

      if (data.erro) {
        throw new Error('CEP não encontrado');
      }

      return {
        success: true,
        data: {
          address: `${data.logradouro}`,
          city: data.localidade,
          uf: data.uf,
          neighborhood: data.bairro || '',
          cep: data.cep
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}

class GeolocationService {
  static async getCurrentPosition() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocalização não suportada'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        position => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          });
        },
        error => {
          reject(new Error('Erro ao obter localização'));
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000
        }
      );
    });
  }
}

window.ViaCEPService = ViaCEPService;
window.GeolocationService = GeolocationService;
window.BUSINESS_CATEGORIES = [
  "Pizzaria", "Sorveteria", "Mercado", "Salão", "Açaiteria",
  "Barbearia", "Salão de Beleza", "Academia", "Padaria", "Mercearia"
];
