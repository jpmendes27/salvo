#!/bin/bash

# Script 1d: Configurar Regras Firebase para Sellers
# REGRA: Criar regras de segurança para coleção sellers
# Autor: Sistema Salvô
# Data: 2025-09-20

echo "🛡️ Configurando regras de segurança Firebase para sellers..."
echo "📋 IMPORTANTE: Aplicar manualmente no Firebase Console"
echo ""

# Criar arquivo com as regras do Firestore
echo "📄 Criando arquivo de regras do Firestore..."

cat > firestore_rules_sellers.rules << 'EOF'
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // REGRAS PARA SELLERS
    match /sellers/{document} {
      // Permitir criação de novos sellers
      allow create: if request.auth == null 
        && resource == null 
        && isValidSeller(request.resource.data);
      
      // Permitir leitura para busca (futuro)
      allow read: if true;
      
      // Não permitir alteração ou exclusão
      allow update, delete: if false;
    }
    
    // FUNÇÃO DE VALIDAÇÃO PARA SELLERS
    function isValidSeller(data) {
      return data.keys().hasAll([
        'businessName', 'category', 'whatsapp', 'email', 
        'cep', 'address', 'complement', 'city', 'uf',
        'latitude', 'longitude', 'logoUrl', 'createdAt'
      ]) &&
      
      // Validar tipos e tamanhos
      data.businessName is string && 
      data.businessName.size() >= 2 && 
      data.businessName.size() <= 100 &&
      
      data.category is string && 
      data.category in [
        'Pizzaria', 'Sorveteria', 'Mercado', 'Salão', 
        'Açaiteria', 'Barbearia', 'Salão de Beleza', 
        'Academia', 'Padaria', 'Mercearia'
      ] &&
      
      data.whatsapp is string && 
      data.whatsapp.size() >= 10 && 
      data.whatsapp.size() <= 15 &&
      
      data.email is string && 
      data.email.size() >= 5 && 
      data.email.size() <= 100 &&
      data.email.matches('.*@.*\\..*') &&
      
      data.cep is string && 
      data.cep.size() >= 8 && 
      data.cep.size() <= 10 &&
      
      data.address is string && 
      data.address.size() >= 5 && 
      data.address.size() <= 200 &&
      
      data.complement is string && 
      data.complement.size() >= 1 && 
      data.complement.size() <= 50 &&
      
      data.city is string && 
      data.city.size() >= 2 && 
      data.city.size() <= 100 &&
      
      data.uf is string && 
      data.uf.size() == 2 &&
      
      data.latitude is number && 
      data.latitude >= -90 && 
      data.latitude <= 90 &&
      
      data.longitude is number && 
      data.longitude >= -180 && 
      data.longitude <= 180 &&
      
      data.logoUrl is string && 
      data.logoUrl.size() >= 10 && 
      data.logoUrl.size() <= 500 &&
      
      data.status is string && 
      data.status == 'ativo' &&
      
      data.source is string && 
      data.source == 'landing_page';
    }
    
    // BLOQUEAR COLEÇÕES ANTIGAS (PF/PJ)
    match /cadastros/{document} {
      allow read, write: if false;
    }
    
    match /leads_pf/{document} {
      allow read, write: if false;
    }
    
    match /leads_pj/{document} {
      allow read, write: if false;
    }
    
    // NEGAR ACESSO A OUTRAS COLEÇÕES
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
EOF

echo "✅ Arquivo de regras criado: firestore_rules_sellers.rules"
echo ""

# Criar arquivo com regras do Storage
echo "📄 Criando regras do Firebase Storage..."

cat > storage_rules_sellers.rules << 'EOF'
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    
    // REGRAS PARA LOGOS DOS SELLERS
    match /logos/{fileName} {
      // Permitir upload apenas de imagens
      allow write: if request.auth == null &&
        request.resource.size < 5 * 1024 * 1024 && // Máximo 5MB
        request.resource.contentType.matches('image/.*') && // Apenas imagens
        fileName.matches('.*\\.(jpg|jpeg|png|gif|webp)$'); // Extensões válidas
      
      // Permitir leitura para exibição
      allow read: if true;
    }
    
    // NEGAR ACESSO A OUTROS DIRETÓRIOS
    match /{allPaths=**} {
      allow read, write: if false;
    }
  }
}
EOF

echo "✅ Arquivo de regras do Storage criado: storage_rules_sellers.rules"
echo ""

# Criar script de instruções
echo "📋 Criando instruções para aplicar as regras..."

cat > aplicar_regras_firebase.txt << 'EOF'
🔥 INSTRUÇÕES PARA APLICAR REGRAS NO FIREBASE CONSOLE

PASSO 1 - REGRAS DO FIRESTORE:
1. Acesse: https://console.firebase.google.com/
2. Selecione o projeto: salvo-vancouvertec
3. Vá em "Firestore Database" no menu lateral
4. Clique na aba "Rules" (Regras)
5. Substitua o conteúdo atual pelo conteúdo do arquivo: firestore_rules_sellers.rules
6. Clique em "Publish" (Publicar)

PASSO 2 - REGRAS DO STORAGE:
1. No mesmo console Firebase
2. Vá em "Storage" no menu lateral
3. Clique na aba "Rules" (Regras)
4. Substitua o conteúdo atual pelo conteúdo do arquivo: storage_rules_sellers.rules
5. Clique em "Publish" (Publicar)

PASSO 3 - ATIVAR STORAGE (se não estiver ativo):
1. Se o Storage não estiver configurado, clique em "Get Started"
2. Escolha "Start in production mode"
3. Selecione uma localização (recomendado: southamerica-east1)
4. Clique em "Done"

PASSO 4 - VERIFICAR SEGURANÇA:
✅ Apenas criação de sellers permitida
✅ Validação rigorosa de todos os campos
✅ Upload apenas de imagens (máx. 5MB)
✅ Coleções antigas (PF/PJ) bloqueadas
✅ Acesso negado a outras coleções

OBSERVAÇÕES IMPORTANTES:
- As regras entram em vigor imediatamente após publicação
- Teste o cadastro de um seller após aplicar
- Monitore o console para verificar se não há erros
- As validações são aplicadas tanto no frontend quanto no backend
EOF

echo "✅ Instruções criadas: aplicar_regras_firebase.txt"
echo ""

# Mostrar resumo das regras
echo "📊 RESUMO DAS REGRAS DE SEGURANÇA:"
echo ""
echo "🔒 FIRESTORE:"
echo "   ✓ Sellers: Apenas criação com validação rigorosa"
echo "   ✓ Validação de todos os campos obrigatórios"
echo "   ✓ Categorias restritas às 10 definidas"
echo "   ✓ Coordenadas dentro dos limites válidos"
echo "   ✓ Coleções antigas (PF/PJ) bloqueadas"
echo ""
echo "🔒 STORAGE:"
echo "   ✓ Upload apenas na pasta /logos/"
echo "   ✓ Apenas arquivos de imagem"
echo "   ✓ Máximo 5MB por arquivo"
echo "   ✓ Extensões: jpg, jpeg, png, gif, webp"
echo ""
echo "📋 PRÓXIMOS PASSOS:"
echo "   1. Leia o arquivo: aplicar_regras_firebase.txt"
echo "   2. Aplique as regras no Firebase Console"
echo "   3. Teste o cadastro de um seller"
echo ""
echo "⏳ Aguardando comando 'continuar' para próximo script..."
echo "📋 Próximo: 1e-test-integration.sh (Teste de integração)"