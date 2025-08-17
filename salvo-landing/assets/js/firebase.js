/* ========================================
   SALVÔ - CONFIGURAÇÃO FIREBASE
======================================== */

// Configuração do Firebase (substitua pelas suas credenciais)
const firebaseConfig = {
  apiKey: "SUA_API_KEY_AQUI",
  authDomain: "salvo-landing.firebaseapp.com",
  projectId: "salvo-landing",
  storageBucket: "salvo-landing.appspot.com",
  messagingSenderId: "123456789",
  appId: "SUA_APP_ID_AQUI"
};

// Classe para gerenciar Firebase
class SalvoFirebase {
  static isConfigured = false;
  static db = null;

  static init() {
    try {
      // Verificar se Firebase está disponível
      if (typeof firebase === 'undefined') {
        return false;
      }

      // Verificar se já foi inicializado
      if (firebase.apps.length === 0) {
        firebase.initializeApp(firebaseConfig);
      }

      // Inicializar Firestore
      this.db = firebase.firestore();
      this.isConfigured = true;

      return true;
    } catch (error) {
      return false;
    }
  }

  // Salvar cadastro no Firestore
  static async saveCadastro(dados, tipo) {
    try {
      if (!this.isConfigured) {
        return this.simulateSave(dados, tipo);
      }

      // Adicionar timestamp e tipo
      const cadastroData = {
        ...dados,
        tipo: tipo,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        status: 'ativo',
        source: 'landing_page'
      };

      // Salvar no Firestore
      const docRef = await this.db.collection('cadastros').add(cadastroData);


      // Enviar para webhook (opcional)
      this.sendToWebhook(cadastroData);

      return {
        success: true,
        id: docRef.id,
        message: 'Cadastro realizado com sucesso!'
      };

    } catch (error) {

      return {
        success: false,
        error: error.message,
        message: 'Erro ao realizar cadastro. Tente novamente.'
      };
    }
  }

  // Simular salvamento quando Firebase não está configurado
  static async simulateSave(dados, tipo) {

    // Simular delay de rede
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Simular sucesso na maioria das vezes
    const success = Math.random() > 0.1; // 90% de sucesso

    if (success) {
      return {
        success: true,
        id: 'sim_' + Date.now(),
        message: 'Cadastro realizado com sucesso! (modo simulação)'
      };
    } else {
      return {
        success: false,
        error: 'Erro simulado',
        message: 'Erro simulado. Tente novamente.'
      };
    }
  }

  // Enviar para webhook (integração externa)
  static async sendToWebhook(dados) {
    try {
      const webhookUrl = 'https://seu-webhook.com/salvao-cadastro'; // Substitua pela sua URL

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(dados)
      });

      if (response.ok) {
      } else {
      }
    } catch (error) {
    }
  }

  // Estatísticas (futuro)
  static async getStats() {
    if (!this.isConfigured) return null;

    try {
      const snapshot = await this.db.collection('cadastros').get();
      return {
        total: snapshot.size,
        pf: snapshot.docs.filter(doc => doc.data().tipo === 'PF').length,
        pj: snapshot.docs.filter(doc => doc.data().tipo === 'PJ').length
      };
    } catch (error) {
      return null;
    }
  }
}

// Classe para gerenciar reCAPTCHA
class SalvoRecaptcha {
  static siteKey = '6LfxYZ4pAAAAAH-tYs9D1v9XrG7ZQk5QY8xP2wX7'; // Substitua pela sua chave
  static isLoaded = false;
  static useV1 = true; // Usar reCAPTCHA v1 (checkbox)

  static init() {
    if (typeof grecaptcha === 'undefined') {
      return false;
    }

    this.isLoaded = true;
    return true;
  }

  // Executar reCAPTCHA v3
  static async executeV3(action = 'submit') {
    if (!this.isLoaded || this.useV1) {
      return 'no-recaptcha';
    }

    try {
      const token = await grecaptcha.execute(this.siteKey, { action });
      return token;
    } catch (error) {
      return null;
    }
  }

  // Verificar reCAPTCHA v1 (checkbox)
  static verifyV1() {
    if (!this.isLoaded || !this.useV1) {
      return true; // Pular verificação se não configurado
    }

    const response = grecaptcha.getResponse();
    if (!response) {
      alert('Por favor, confirme que você não é um robô.');
      return false;
    }

    return true;
  }

  // Resetar reCAPTCHA
  static reset() {
    if (this.isLoaded && this.useV1) {
      grecaptcha.reset();
    }
  }
}

// Inicializar quando DOM estiver pronto
document.addEventListener('DOMContentLoaded', function() {
  // Aguardar um pouco para garantir que scripts externos carregaram
  setTimeout(() => {
    SalvoFirebase.init();
    SalvoRecaptcha.init();
  }, 1000);
});

// Expor classes globalmente
window.SalvoFirebase = SalvoFirebase;
window.SalvoRecaptcha = SalvoRecaptcha;
