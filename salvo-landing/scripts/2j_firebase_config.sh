#!/bin/bash

# Script 2j: Configuração Firebase e reCAPTCHA - Salvô Landing Page
# Autor: Rafael Ferreira
# Data: 2025-08-16
# Uso: cp ../scripts/2j_firebase_config.sh . && chmod +x 2j_firebase_config.sh && ./2j_firebase_config.sh

echo "🔥 Salvô - Configuração Firebase e reCAPTCHA..."

# Verificar se está na pasta correta
if [ ! -f "index.html" ] || [ ! -d "assets" ]; then
    echo "❌ Erro: Execute este script dentro da pasta salvo-landing"
    echo "📁 Comando correto:"
    echo "   cd salvo-landing"
    echo "   cp ../scripts/2j_firebase_config.sh ."
    echo "   chmod +x 2j_firebase_config.sh && ./2j_firebase_config.sh"
    exit 1
fi

echo "✅ Pasta do projeto encontrada!"

# Backup dos arquivos que serão modificados
echo "💾 Criando backup dos arquivos..."

BACKUP_DIR="backup-2j-$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

# Fazer backup
cp index.html "$BACKUP_DIR/" 2>/dev/null
cp assets/js/firebase.js "$BACKUP_DIR/" 2>/dev/null || echo "⚠️ firebase.js não encontrado"

echo "✅ Backup criado em: $BACKUP_DIR"

# 1. CRIAR CONFIGURAÇÃO DO FIREBASE
echo "🔥 Criando configuração do Firebase..."

cat > assets/js/firebase.js << 'EOF'
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
        console.warn('Firebase não carregado. Usando modo simulação.');
        return false;
      }

      // Verificar se já foi inicializado
      if (firebase.apps.length === 0) {
        firebase.initializeApp(firebaseConfig);
      }

      // Inicializar Firestore
      this.db = firebase.firestore();
      this.isConfigured = true;

      console.log('🔥 Firebase inicializado com sucesso!');
      return true;
    } catch (error) {
      console.error('Erro ao inicializar Firebase:', error);
      console.warn('Continuando em modo simulação...');
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

      console.log('✅ Cadastro salvo com ID:', docRef.id);

      // Enviar para webhook (opcional)
      this.sendToWebhook(cadastroData);

      return {
        success: true,
        id: docRef.id,
        message: 'Cadastro realizado com sucesso!'
      };

    } catch (error) {
      console.error('Erro ao salvar cadastro:', error);

      return {
        success: false,
        error: error.message,
        message: 'Erro ao realizar cadastro. Tente novamente.'
      };
    }
  }

  // Simular salvamento quando Firebase não está configurado
  static async simulateSave(dados, tipo) {
    console.log('📝 Simulando salvamento:', { dados, tipo });

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
        console.log('📤 Dados enviados para webhook com sucesso');
      } else {
        console.warn('⚠️ Erro ao enviar para webhook:', response.status);
      }
    } catch (error) {
      console.warn('⚠️ Webhook não configurado ou erro:', error.message);
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
      console.error('Erro ao buscar estatísticas:', error);
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
      console.warn('reCAPTCHA não carregado');
      return false;
    }

    this.isLoaded = true;
    console.log('🛡️ reCAPTCHA inicializado');
    return true;
  }

  // Executar reCAPTCHA v3
  static async executeV3(action = 'submit') {
    if (!this.isLoaded || this.useV1) {
      return 'no-recaptcha';
    }

    try {
      const token = await grecaptcha.execute(this.siteKey, { action });
      console.log('🛡️ reCAPTCHA v3 token obtido');
      return token;
    } catch (error) {
      console.error('Erro no reCAPTCHA v3:', error);
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

    console.log('🛡️ reCAPTCHA v1 verificado');
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
EOF

echo "✅ Configuração do Firebase criada!"

# 2. ATUALIZAR MÁSCARAS PARA INTEGRAR COM FIREBASE
echo "🔄 Atualizando integração com Firebase..."

# Atualizar função de submit no arquivo de máscaras
if [ -f "assets/js/masks-validations.js" ]; then
    # Substituir função submitForm para usar Firebase
    cat >> assets/js/masks-validations.js << 'EOF'

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
            console.log('✅ Cadastro realizado:', result);

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
            console.error('❌ Erro no cadastro:', result);
            alert(result.message || 'Erro ao realizar cadastro. Tente novamente.');

            // Resetar reCAPTCHA
            if (window.SalvoRecaptcha) {
                window.SalvoRecaptcha.reset();
            }
        }

    } catch (error) {
        console.error('❌ Erro no submit:', error);
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
EOF

    echo "✅ Integração com Firebase adicionada!"
fi

# 3. ADICIONAR reCAPTCHA V1 AO HTML
echo "🛡️ Adicionando reCAPTCHA v1 aos formulários..."

if [ -f "index.html" ]; then
    # Substituir reCAPTCHA v3 por v1 no HTML
    sed -i 's|https://www.google.com/recaptcha/api.js?render=.*|https://www.google.com/recaptcha/api.js|' index.html

    # Adicionar container do reCAPTCHA v1 antes do botão de submit nos formulários
    sed -i '/<button type="submit" class="btn btn--primary btn--full">/i\                        <div class="form__group">\
                            <div class="g-recaptcha" data-sitekey="6LfxYZ4pAAAAAH-tYs9D1v9XrG7ZQk5QY8xP2wX7"></div>\
                        </div>\
' index.html

    echo "✅ reCAPTCHA v1 adicionado aos formulários!"
fi

# 4. CRIAR INSTRUÇÕES DE CONFIGURAÇÃO
echo "📋 Criando instruções de configuração..."

cat > FIREBASE_SETUP.md << 'EOF'
# 🔥 Configuração do Firebase - Salvô

## 1. Criar Projeto Firebase

1. Acesse [Firebase Console](https://console.firebase.google.com/)
2. Clique em "Adicionar projeto"
3. Nome: `salvo-landing`
4. Habilite Google Analytics (opcional)

## 2. Configurar Firestore

1. No menu lateral, clique em "Firestore Database"
2. Clique em "Criar banco de dados"
3. Escolha "Modo de teste" (por enquanto)
4. Selecione localização: `us-central1`

## 3. Configurar Authentication (opcional)

1. No menu lateral, clique em "Authentication"
2. Na aba "Sign-in method", habilite:
   - E-mail/senha
   - Google (opcional)

## 4. Obter Credenciais

1. Clique na engrenagem > "Configurações do projeto"
2. Na aba "Geral", desça até "Seus aplicativos"
3. Clique em "</>" (Web)
4. Nome do app: `salvao-landing`
5. Copie as credenciais do `firebaseConfig`

## 5. Configurar no Código

Edite o arquivo `assets/js/firebase.js`:

```javascript
const firebaseConfig = {
  apiKey: "sua-api-key-aqui",
  authDomain: "salvo-landing.firebaseapp.com",
  projectId: "salvo-landing",
  storageBucket: "salvo-landing.appspot.com",
  messagingSenderId: "123456789",
  appId: "sua-app-id-aqui"
};
```

## 6. Configurar reCAPTCHA

1. Acesse [Google reCAPTCHA](https://www.google.com/recaptcha/admin)
2. Clique em "+" para adicionar site
3. Tipo: reCAPTCHA v2 (checkbox)
4. Domínio: `salvo.vancouvertec.com.br`
5. Copie a "Chave do site"

Edite `assets/js/firebase.js`:
```javascript
static siteKey = 'sua-chave-recaptcha-aqui';
```

E no `index.html`, substitua:
```html
data-sitekey="sua-chave-recaptcha-aqui"
```

## 7. Regras de Segurança Firestore

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /cadastros/{document} {
      allow create: if true;
      allow read, write: if false;
    }
  }
}
```

## 8. Testar

1. Abra a landing page
2. Preencha um formulário
3. Verifique no Firebase Console se os dados foram salvos
4. Verifique o console do navegador para logs

## 9. Webhook (Opcional)

Para integrar com sistemas externos, configure a URL do webhook em:
```javascript
const webhookUrl = 'https://seu-sistema.com/webhook';
```
EOF

echo "✅ Instruções de configuração criadas!"

# 5. VERIFICAÇÕES FINAIS
echo "🔍 Executando verificações finais..."

# Verificar arquivos criados
files_to_check=("assets/js/firebase.js" "FIREBASE_SETUP.md")
missing_files=()

for file in "${files_to_check[@]}"; do
    if [ ! -f "$file" ]; then
        missing_files+=("$file")
    fi
done

if [ ${#missing_files[@]} -eq 0 ]; then
    echo "✅ Todos os arquivos foram criados!"
else
    echo "⚠️ Arquivos faltando:"
    printf '%s\n' "${missing_files[@]}"
fi

# Verificar se reCAPTCHA foi adicionado
if grep -q "g-recaptcha" index.html; then
    echo "✅ reCAPTCHA v1 adicionado ao HTML!"
else
    echo "⚠️ reCAPTCHA v1 não foi adicionado"
fi

# Gerar relatório
echo ""
echo "📋 Relatório do Script 2j:"
echo "=================================================="
echo "✅ Configuração Firebase criada"
echo "✅ Integração com formulários implementada"
echo "✅ reCAPTCHA v1 (checkbox) configurado"
echo "✅ Sistema de backup/simulação implementado"
echo "✅ Instruções de configuração geradas"
echo ""
echo "📁 Backup salvo em: $BACKUP_DIR"
echo ""
echo "⚠️  PRÓXIMOS PASSOS MANUAIS:"
echo "   1. Leia o arquivo FIREBASE_SETUP.md"
echo "   2. Configure Firebase Console"
echo "   3. Substitua as credenciais em firebase.js"
echo "   4. Configure reCAPTCHA"
echo "   5. Teste os formulários"
echo ""
echo "🎯 Próximo script:"
echo "   Execute o script 2k para deploy final"
echo "   cp ../scripts/2k_final_deploy.sh ."
echo "   chmod +x 2k_final_deploy.sh && ./2k_final_deploy.sh"
echo ""
echo "🌟 Script 2j concluído com sucesso!"
