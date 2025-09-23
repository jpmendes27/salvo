#!/bin/bash

# Script 1b: Atualizar Firebase.js para Sellers
# REGRA: Manter estrutura, alterar apenas lógica para sellers
# Autor: Sistema Salvô
# Data: 2025-09-20

echo "🔥 Atualizando Firebase.js para trabalhar com sellers..."
echo "📋 IMPORTANTE: Mantendo configurações existentes"
echo ""

# Backup do arquivo atual
echo "💾 Fazendo backup do firebase.js atual..."
cp assets/js/firebase.js assets/js/firebase.js.backup.$(date +%Y%m%d_%H%M%S)
echo "✅ Backup criado!"

# Criar novo firebase.js para sellers
echo "🔧 Criando nova versão do firebase.js..."

cat > assets/js/firebase.js << 'EOF'
/* ========================================
   SALVÔ - FIREBASE CONFIGURAÇÃO SELLERS
   Nova estrutura única para vendedores
   MANTÉM: Todas as credenciais existentes
======================================== */

// Configuração Firebase (mantendo credenciais atuais)
const firebaseConfig = {
  apiKey: "AIzaSyBgbTXNG-ZBgFWoawEyZdhXWAQiUBBcWOA",
  authDomain: "salvo-vancouvertec.firebaseapp.com",
  projectId: "salvo-vancouvertec",
  storageBucket: "salvo-vancouvertec.firebasestorage.app",
  messagingSenderId: "393597458878",
  appId: "1:393597458878:web:59aebeb2a76975099a81ef",
  measurementId: "G-89P9XGPMKC"
};

// Categorias disponíveis
const BUSINESS_CATEGORIES = [
  "Pizzaria", "Sorveteria", "Mercado", "Salão", "Açaiteria",
  "Barbearia", "Salão de Beleza", "Academia", "Padaria", "Mercearia"
];

// Classe principal do Firebase para Sellers
class SalvoFirebaseSellers {
  static isConfigured = false;
  static db = null;
  static storage = null;

  static init() {
    try {
      if (typeof firebase === 'undefined') {
        console.warn('⚠️ Firebase SDK não carregado. Usando modo simulação.');
        return false;
      }

      if (firebase.apps.length === 0) {
        firebase.initializeApp(firebaseConfig);
      }

      this.db = firebase.firestore();
      this.storage = firebase.storage();
      this.isConfigured = true;

      console.log('🔥 Firebase Sellers inicializado com sucesso!');
      return true;
    } catch (error) {
      console.error('❌ Erro ao inicializar Firebase:', error);
      return false;
    }
  }

  // Salvar seller no Firestore
  static async saveSeller(sellerData, logoFile) {
    try {
      if (!this.isConfigured) {
        console.log('📄 Firebase não configurado, usando simulação');
        return this.simulateSave(sellerData);
      }

      // 1. UPLOAD DA LOGO PRIMEIRO
      let logoUrl = '';
      if (logoFile) {
        logoUrl = await this.uploadLogo(logoFile, sellerData.businessName);
      }

      // 2. PREPARAR DADOS DO SELLER
      const sellerDocument = {
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
        logoUrl: logoUrl,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        status: 'ativo',
        source: 'landing_page'
      };

      // 3. VALIDAR DADOS
      const validation = this.validateSeller(sellerDocument);
      if (!validation.valid) {
        return {
          success: false,
          error: validation.error,
          message: `Erro de validação: ${validation.error}`
        };
      }

      // 4. SALVAR NO FIRESTORE
      const docRef = await this.db.collection('sellers').add(sellerDocument);

      console.log('✅ Seller cadastrado com sucesso!');
      console.log('📋 ID do seller:', docRef.id);

      return {
        success: true,
        id: docRef.id,
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

  // Upload da logo para Firebase Storage
  static async uploadLogo(file, businessName) {
    try {
      const timestamp = Date.now();
      const fileName = `logos/${businessName.replace(/[^a-zA-Z0-9]/g, '_')}_${timestamp}.${file.name.split('.').pop()}`;
      
      const storageRef = this.storage.ref().child(fileName);
      const snapshot = await storageRef.put(file);
      const downloadURL = await snapshot.ref.getDownloadURL();
      
      console.log('📷 Logo upload realizado:', downloadURL);
      return downloadURL;
    } catch (error) {
      console.error('❌ Erro no upload da logo:', error);
      throw new Error('Falha no upload da imagem');
    }
  }

  // Validar dados do seller
  static validateSeller(data) {
    if (!data.businessName || data.businessName.length < 2) {
      return { valid: false, error: 'Nome do negócio é obrigatório' };
    }
    if (!data.category || !BUSINESS_CATEGORIES.includes(data.category)) {
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

  // Simular salvamento quando Firebase não configurado
  static async simulateSave(sellerData) {
    console.log('📄 Simulando salvamento de seller:', sellerData);
    
    await new Promise(resolve => setTimeout(resolve, Math.random() * 2000 + 1000));
    
    const success = Math.random() > 0.1;
    
    if (success) {
      const simulatedId = 'seller_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      return {
        success: true,
        id: simulatedId,
        message: 'Negócio cadastrado com sucesso! (simulação)'
      };
    } else {
      return {
        success: false,
        error: 'Erro simulado',
        message: 'Erro temporário. Tente novamente.'
      };
    }
  }
}

// API ViaCEP para busca de endereço
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

// Serviço de Geolocalização
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
    SalvoFirebaseSellers.init();
  }, 1000);
});

// Expor classes globalmente
window.SalvoFirebaseSellers = SalvoFirebaseSellers;
window.ViaCEPService = ViaCEPService;
window.GeolocationService = GeolocationService;
window.BUSINESS_CATEGORIES = BUSINESS_CATEGORIES;
EOF

echo "✅ Firebase.js atualizado com sucesso!"
echo ""
echo "📋 Funcionalidades implementadas:"
echo "   ✓ Classe SalvoFirebaseSellers para gerenciar sellers"
echo "   ✓ Upload de logo para Firebase Storage"
echo "   ✓ Integração com ViaCEP para buscar endereço"
echo "   ✓ Serviço de geolocalização automática"
echo "   ✓ Validação completa de dados"
echo ""
echo "⏳ Aguardando comando 'continuar' para próximo script..."
echo "📋 Próximo: 1c-masks-sellers.sh (Atualizar validações e máscaras)"