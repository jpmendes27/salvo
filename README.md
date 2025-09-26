# 🤖 Salvô - Assistente WhatsApp para Comércios Locais

## 📋 Sobre o Projeto

O Salvô é um assistente de inteligência artificial que conecta clientes e comércios locais através do WhatsApp, utilizando geolocalização para facilitar descobertas de negócios próximos.

### 🎯 Missão
Impulsionar as vendas de pequenos negócios ao posicioná-los digitalmente, ajudando pessoas a encontrarem o que precisam de forma rápida, local e automatizada.

## 🚀 Funcionalidades

### Para Lojistas
- ✅ Cadastro simples via WhatsApp
- 📍 Geolocalização automática
- 🏪 Categorização de negócios
- 📞 Integração com contato direto

### Para Clientes
- 🔍 Busca por comércios próximos
- 📱 Interface 100% WhatsApp
- 📍 Busca baseada em localização
- 🎯 Sugestões personalizadas

## 🛠️ Tecnologias

- **Backend:** Python 3.8+ com Flask
- **Banco de Dados:** Firebase Realtime Database
- **APIs:** WhatsApp Business API, Google Maps API
- **Hospedagem:** Servidor Linux com SSL

## 📁 Estrutura do Projeto

```
salvo/
├── app/
│   ├── api/                    # Endpoints da API
│   │   ├── whatsapp/          # Integração WhatsApp
│   │   └── business/          # APIs de negócio
│   ├── models/                # Modelos de dados
│   ├── services/              # Lógica de negócio
│   │   ├── firebase/          # Conexão Firebase
│   │   ├── location/          # Serviços de geolocalização
│   │   └── matching/          # Sistema de correspondência
│   ├── utils/                 # Utilitários
│   ├── config/                # Configurações
│   └── main.py               # Aplicação principal
├── tests/                     # Testes automatizados
├── docs/                      # Documentação
├── scripts/                   # Scripts de deployment
├── static/                    # Arquivos estáticos
├── templates/                 # Templates HTML
└── logs/                      # Logs da aplicação
```

## 🔧 Instalação e Configuração

### Pré-requisitos
- Python 3.8+
- Conta Firebase
- WhatsApp Business API
- Google Maps API Key

### Passo a Passo

1. **Clone o repositório:**
```bash
git clone <repository-url>
cd salvo
```

2. **Execute os scripts de configuração:**
```bash
chmod +x scripts/1_create_project_structure.sh
./scripts/1_create_project_structure.sh
```

3. **Configure as variáveis de ambiente:**
```bash
cp .env.example .env
# Edite o arquivo .env com suas credenciais
```

4. **Instale as dependências:**
```bash
pip install -r requirements.txt
```

5. **Execute a aplicação:**
```bash
python3 app/main.py
```

## 📋 Fases de Desenvolvimento

### ✅ Fase 1: Estrutura Base (2-3 dias)
- [x] Configuração do ambiente Python
- [x] Estrutura de pastas
- [ ] Configuração Firebase
- [ ] Configuração inicial WhatsApp API

### 🔄 Fase 2: Backend Core (3-4 dias)
- [ ] Modelos de dados
- [ ] Conexão com Firebase
- [ ] Sistema de geolocalização
- [ ] API de processamento de mensagens

### ⏳ Fase 3: Lógica de Negócio (4-5 dias)
- [ ] Fluxo de cadastro de lojistas
- [ ] Fluxo de busca de clientes
- [ ] Sistema de matching por palavras-chave
- [ ] Cálculo de distâncias

### ⏳ Fase 4: Integração WhatsApp (3-4 dias)
- [ ] Webhooks WhatsApp
- [ ] Processamento de mensagens
- [ ] Envio de respostas
- [ ] Tratamento de mídias (localização)

### ⏳ Fase 5: Testes e Deploy (2-3 dias)
- [ ] Testes unitários
- [ ] Testes de integração
- [ ] Deploy em servidor
- [ ] Configuração domínio/SSL

**⏱️ Total Estimado: 14-19 dias**

## 🔐 Variáveis de Ambiente

```env
# Flask
SECRET_KEY=your-secret-key
DEBUG=False

# Firebase
FIREBASE_CREDENTIALS_PATH=path/to/firebase-credentials.json
FIREBASE_DATABASE_URL=https://your-project.firebaseio.com

# WhatsApp
WHATSAPP_TOKEN=your-whatsapp-token
WHATSAPP_VERIFY_TOKEN=your-verify-token
WHATSAPP_PHONE_NUMBER_ID=your-phone-number-id

# Google Maps
GOOGLE_MAPS_API_KEY=your-google-maps-key
```

## 🤝 Contribuição

1. Fork o projeto
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

## 📝 Licença

Este projeto está sob a licença MIT. Veja o arquivo `LICENSE` para mais detalhes.

## 📞 Contato

Rafael Ferreira - [@rafaelferreira2312](https://github.com/rafaelferreira2312)

Link do Projeto: [https://github.com/rafaelferreira2312/salvo](https://github.com/rafaelferreira2312/salvo)

---

⭐ **Salvô - Conectando seu negócio ao mundo digital!** ⭐
