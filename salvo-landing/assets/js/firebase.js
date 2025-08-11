// Configuração do Firebase para Salvô Landing Page
// Substitua pelas suas credenciais do Firebase

const firebaseConfig = {
  apiKey: "sua-api-key-aqui",
  authDomain: "seu-projeto.firebaseapp.com",
  projectId: "seu-projeto-id",
  storageBucket: "seu-projeto.appspot.com",
  messagingSenderId: "123456789",
  appId: "sua-app-id-aqui",
  measurementId: "G-XXXXXXXXXX"
};

// Inicializar Firebase
firebase.initializeApp(firebaseConfig);

// Inicializar Firestore
const db = firebase.firestore();

// Configurar App Check com reCAPTCHA v3
firebase.appCheck().activate('6LfxYZ4pAAAAAH-tYs9D1v9XrG7ZQk5QY8xP2wX7', true);

// Função para salvar lead no Firestore
async function salvarLead(dadosLead) {
  try {
    const docRef = await db.collection('leads').add({
      ...dadosLead,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      ip: await obterIP(),
      userAgent: navigator.userAgent,
      referrer: document.referrer || 'direct'
    });
    
    console.log('Lead salvo com ID:', docRef.id);
    return { success: true, id: docRef.id };
  } catch (error) {
    console.error('Erro ao salvar lead:', error);
    return { success: false, error: error.message };
  }
}

// Função auxiliar para obter IP do usuário
async function obterIP() {
  try {
    const response = await fetch('https://api.ipify.org?format=json');
    const data = await response.json();
    return data.ip;
  } catch (error) {
    console.error('Erro ao obter IP:', error);
    return 'unknown';
  }
}

// Regras de segurança do Firestore (aplicar no Console Firebase)
const firestoreRules = `
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Permitir apenas criação de leads
    match /leads/{document} {
      allow create: if request.auth == null 
        && resource == null 
        && request.resource.data.keys().hasAll(['tipo', 'createdAt'])
        && request.resource.data.tipo in ['PF', 'PJ'];
      allow read, update, delete: if false;
    }
    
    // Negar acesso a todas as outras coleções
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
`;

// Exportar para uso global
window.Firebase = {
  salvarLead,
  db
};
