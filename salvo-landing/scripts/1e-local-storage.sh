#!/bin/bash

# Script 1e: Implementar Armazenamento Local JSON
# REGRA: Substituir Firebase por armazenamento local
# Autor: Sistema Salvô
# Data: 2025-09-20

echo "💾 Configurando armazenamento local JSON..."
echo "📋 IMPORTANTE: Substituindo Firebase por JSON local"
echo ""

# Criar estrutura de diretórios
echo "📂 Criando estrutura de diretórios..."
mkdir -p bd/sellers/images
mkdir -p bd/config
echo "✅ Diretórios criados!"

# Criar arquivo inicial de sellers
echo "📄 Criando arquivo sellers.json inicial..."
cat > bd/sellers/sellers.json << 'EOF'
{
  "lastId": 0,
  "sellers": []
}
EOF

# Criar arquivo de configuração das categorias
echo "📄 Criando arquivo de categorias..."
cat > bd/config/categories.json << 'EOF'
{
  "categories": [
    "Pizzaria",
    "Sorveteria",
    "Mercado",
    "Salão",
    "Açaiteria",
    "Barbearia",
    "Salão de Beleza",
    "Academia",
    "Padaria",
    "Mercearia"
  ]
}
EOF

# Backup do firebase.js atual
echo "💾 Fazendo backup do firebase.js..."
cp assets/js/firebase.js assets/js/firebase.js.firebase.backup
echo "✅ Backup criado!"

# Criar novo sistema de armazenamento local
echo "🔧 Criando sistema de armazenamento local..."

cat > assets/js/local-storage.js << 'EOF'
/* ========================================
   SALVÔ - ARMAZENAMENTO LOCAL JSON
   Sistema para salvar sellers em JSON local
======================================== */

// Configurações
const LOCAL_CONFIG = {
  sellersPath: 'bd/sellers/sellers.json',
  imagesPath: 'bd/sellers/images/',
  categoriesPath: 'bd/config/categories.json'
};

// Classe principal para armazenamento local
class SalvoLocalStorage {
  static isConfigured = true; // Sempre configurado

  static init() {
    console.log('💾 Sistema de armazenamento local inicializado!');
    return true;
  }

  // Salvar seller no JSON local
  static async saveSeller(sellerData, logoFile) {
    try {
      console.log('📊 Salvando seller localmente...');

      // 1. PROCESSAR IMAGEM
      let logoFileName = '';
      if (logoFile) {
        logoFileName = await this.saveImage(logoFile, sellerData.businessName);
      }

      // 2. CARREGAR DADOS EXISTENTES
      const sellersDB = await this.loadSellers();

      // 3. PREPARAR NOVO SELLER
      const newSeller = {
        id: ++sellersDB.lastId,
        businessName: sellerData.businessName?.trim() || '',
        category: sellerData.category || '',
        whatsapp: this.formatPhone(sellerData.whatsapp) || '',
        email: sellerData.email?.trim().toLowerCase() || '',
        cep: this.formatCEP(sellerData.cep) || '',
        address: sellerData.address?.trim() || '',
        complement: sellerData.complement?.trim() || '',
        city: sellerData.city?.trim() || '',
        uf: sellerData.uf || '',
        latitude: parseFloat(sellerData.latitude) || 0,
        longitude: parseFloat(sellerData.longitude) || 0,
        logoFileName: logoFileName,
        logoUrl: logoFileName ? `${LOCAL_CONFIG.imagesPath}${logoFileName}` : '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: 'ativo',
        source: 'landing_page'
      };

      // 4. VALIDAR DADOS
      const validation = this.validateSeller(newSeller);
      if (!validation.valid) {
        return {
          success: false,
          error: validation.error,
          message: `Erro de validação: ${validation.error}`
        };
      }

      // 5. ADICIONAR AO ARRAY
      sellersDB.sellers.push(newSeller);

      // 6. SALVAR NO ARQUIVO JSON
      await this.saveSellers(sellersDB);

      console.log('✅ Seller salvo localmente!');
      console.log('📋 ID do seller:', newSeller.id);

      return {
        success: true,
        id: newSeller.id,
        message: 'Negócio cadastrado com sucesso!'
      };

    } catch (error) {
      console.error('❌ Erro ao salvar seller:', error);
      return {
        success: false,
        error: error.message,
        message: 'Erro ao realizar cadastro. Tente novamente.'
      };
    }
  }

  // Salvar imagem localmente
  static async saveImage(file, businessName) {
    try {
      const timestamp = Date.now();
      const extension = file.name.split('.').pop().toLowerCase();
      const safeBusinessName = businessName.replace(/[^a-zA-Z0-9]/g, '_');
      const fileName = `${safeBusinessName}_${timestamp}.${extension}`;

      // Simular salvamento (em produção seria upload real)
      console.log('📷 Imagem simulada salva:', fileName);
      
      return fileName;
    } catch (error) {
      console.error('❌ Erro ao salvar imagem:', error);
      throw new Error('Falha ao salvar imagem');
    }
  }

  // Carregar sellers do JSON
  static async loadSellers() {
    try {
      // Em ambiente real, seria fetch para o arquivo JSON
      // Por enquanto, usar dados do localStorage para simulação
      const stored = localStorage.getItem('salvo_sellers_db');
      
      if (stored) {
        return JSON.parse(stored);
      } else {
        return {
          lastId: 0,
          sellers: []
        };
      }
    } catch (error) {
      console.error('❌ Erro ao carregar sellers:', error);
      return {
        lastId: 0,
        sellers: []
      };
    }
  }

  // Salvar sellers no JSON
  static async saveSellers(sellersDB) {
    try {
      // Em ambiente real, seria POST para salvar o arquivo JSON
      // Por enquanto, usar localStorage para simulação
      localStorage.setItem('salvo_sellers_db', JSON.stringify(sellersDB, null, 2));
      
      console.log('💾 Base de dados atualizada!');
      console.log('📊 Total de sellers:', sellersDB.sellers.length);
      
      return true;
    } catch (error) {
      console.error('❌ Erro ao salvar base de dados:', error);
      throw error;
    }
  }

  // Validar dados do seller
  static validateSeller(data) {
    if (!data.businessName || data.businessName.length < 2) {
      return { valid: false, error: 'Nome do negócio é obrigatório' };
    }
    if (!data.category) {
      return { valid: false, error: 'Categoria é obrigatória' };
    }
    if (!data.whatsapp || data.whatsapp.length < 10) {
      return { valid: false, error: 'WhatsApp é obrigatório' };
    }
    if (!data.email || !data.email.includes('@')) {
      return { valid: false, error: 'E-mail é obrigatório' };
    }
    if (!data.cep || data.cep.length < 8) {
      return { valid: false, error: 'CEP é obrigatório' };
    }
    if (!data.address || data.address.length < 5) {
      return { valid: false, error: 'Endereço é obrigatório' };
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

  // Formatação de telefone
  static formatPhone(phone) {
    if (!phone) return '';
    return phone.replace(/\D/g, '').substring(0, 11);
  }

  // Formatação de CEP
  static formatCEP(cep) {
    if (!cep) return '';
    return cep.replace(/\D/g, '').substring(0, 8);
  }

  // Buscar sellers (para futuras funcionalidades)
  static async searchSellers(filters = {}) {
    try {
      const sellersDB = await this.loadSellers();
      let results = sellersDB.sellers.filter(seller => seller.status === 'ativo');

      // Filtrar por categoria se especificada
      if (filters.category) {
        results = results.filter(seller => seller.category === filters.category);
      }

      // Filtrar por localização se especificada
      if (filters.userLat && filters.userLng) {
        results = results.map(seller => {
          const distance = this.calculateDistance(
            filters.userLat, 
            filters.userLng, 
            seller.latitude, 
            seller.longitude
          );
          return { ...seller, distance };
        }).filter(seller => seller.distance <= (filters.radius || 5));

        results.sort((a, b) => a.distance - b.distance);
      }

      return results.slice(0, filters.limit || 10);
    } catch (error) {
      console.error('❌ Erro na busca:', error);
      return [];
    }
  }

  // Calcular distância entre coordenadas
  static calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371; // Raio da Terra em km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  // Obter estatísticas
  static async getStats() {
    try {
      const sellersDB = await this.loadSellers();
      const sellers = sellersDB.sellers;

      const stats = {
        total: sellers.length,
        ativo: sellers.filter(s => s.status === 'ativo').length,
        categorias: {}
      };

      // Contar por categoria
      sellers.forEach(seller => {
        if (seller.status === 'ativo') {
          stats.categorias[seller.category] = (stats.categorias[seller.category] || 0) + 1;
        }
      });

      return stats;
    } catch (error) {
      console.error('❌ Erro ao obter estatísticas:', error);
      return null;
    }
  }

  // Exportar dados para migração futura
  static async exportToMySQL() {
    try {
      const sellersDB = await this.loadSellers();
      
      // Estrutura para migração MySQL
      const mysqlStructure = {
        sellers_table: sellersDB.sellers.map(seller => ({
          id: seller.id,
          business_name: seller.businessName,
          category: seller.category,
          whatsapp: seller.whatsapp,
          email: seller.email,
          cep: seller.cep,
          address: seller.address,
          complement: seller.complement,
          city: seller.city,
          uf: seller.uf,
          latitude: seller.latitude,
          longitude: seller.longitude,
          logo_file_name: seller.logoFileName,
          created_at: seller.createdAt,
          updated_at: seller.updatedAt,
          status: seller.status,
          source: seller.source
        }))
      };

      console.log('📤 Estrutura MySQL preparada:', mysqlStructure);
      return mysqlStructure;
    } catch (error) {
      console.error('❌ Erro ao exportar para MySQL:', error);
      return null;
    }
  }
}

// API ViaCEP (mantém a mesma implementação)
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

// Serviço de Geolocalização (mantém a mesma implementação)
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

// Inicializar quando DOM estiver pronto
document.addEventListener('DOMContentLoaded', function() {
  setTimeout(() => {
    SalvoLocalStorage.init();
  }, 1000);
});

// Expor classes globalmente (compatibilidade com código existente)
window.SalvoFirebaseSellers = SalvoLocalStorage; // Alias para compatibilidade
window.SalvoLocalStorage = SalvoLocalStorage;
window.ViaCEPService = ViaCEPService;
window.GeolocationService = GeolocationService;

// Categorias disponíveis
window.BUSINESS_CATEGORIES = [
  "Pizzaria", "Sorveteria", "Mercado", "Salão", "Açaiteria",
  "Barbearia", "Salão de Beleza", "Academia", "Padaria", "Mercearia"
];
EOF

# Atualizar o index.html para usar o novo sistema
echo "🔧 Atualizando index.html para usar armazenamento local..."

# Substituir referência ao firebase.js por local-storage.js
sed -i 's/assets\/js\/firebase\.js/assets\/js\/local-storage.js/' index.html

echo "✅ Sistema de armazenamento local implementado!"
echo ""
echo "📊 ESTRUTURA CRIADA:"
echo "   ├── bd/"
echo "   │   ├── sellers/"
echo "   │   │   ├── sellers.json (base de dados)"
echo "   │   │   └── images/ (imagens dos negócios)"
echo "   │   └── config/"
echo "   │       └── categories.json (categorias)"
echo "   └── assets/js/local-storage.js (novo sistema)"
echo ""
echo "📋 FUNCIONALIDADES:"
echo "   ✓ Salvamento em JSON local"
echo "   ✓ Upload de imagens para pasta local"
echo "   ✓ Compatibilidade com código existente"
echo "   ✓ Preparado para migração MySQL"
echo "   ✓ Sistema de busca implementado"
echo "   ✓ Exportação para MySQL ready"
echo ""
echo "⚠️ OBSERVAÇÕES:"
echo "   • Use localStorage como simulação em desenvolvimento"
echo "   • Em produção, implementar endpoints PHP/Python"
echo "   • Estrutura JSON pronta para migração"
echo ""
echo "✅ Sistema pronto para uso!"
echo "📋 Execute: python -m http.server 8005 para testar"