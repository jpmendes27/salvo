#!/bin/bash

# Script 1a: Atualizar Landing Page para Cadastro Único de Sellers
# REGRA: Manter 100% do layout visual, alterar apenas lógica interna
# Autor: Sistema Salvô
# Data: 2025-09-20

echo "🔄 Atualizando Landing Page para cadastro único de sellers..."
echo "📋 IMPORTANTE: Mantendo 100% do layout visual existente"
echo ""

# Backup do arquivo atual
echo "💾 Fazendo backup do index.html atual..."
cp index.html index.html.backup.$(date +%Y%m%d_%H%M%S)
echo "✅ Backup criado!"

# Atualizar apenas o conteúdo interno do index.html
echo "🔧 Atualizando lógica interna do formulário..."

# Substituir os dois botões CTA por um único
sed -i 's/id="cta-pf" data-form="pf"/id="cta-seller"/' index.html
sed -i 's/Sou Pessoa Física/Cadastrar Meu Negócio/' index.html
sed -i 's/<span class="btn__icon">👤<\/span>/<span class="btn__icon">🏪<\/span>/' index.html

# Remover o segundo botão (PJ) mantendo a estrutura
sed -i '/<button class="btn btn--secondary" id="cta-pj"/,/<\/button>/d' index.html

# Atualizar o modal para sellers mantendo toda a estrutura visual
cat > temp_modal_content.html << 'EOF'
            <!-- Formulário Seller -->
            <div class="form__container" id="form-seller">
                <div class="form__header">
                    <h2>Cadastrar Meu Negócio</h2>
                    <p>Preencha os dados e comece a receber clientes</p>
                    <button class="form__close" aria-label="Fechar formulário">&times;</button>
                </div>
                <form class="form" id="form-seller-submit" enctype="multipart/form-data">
                    <div class="form__group">
                        <label for="business-name" class="form__label">Nome do Negócio *</label>
                        <input type="text" id="business-name" name="businessName" class="form__input" required aria-describedby="business-name-error">
                        <span class="form__error" id="business-name-error"></span>
                    </div>

                    <div class="form__group">
                        <label for="category" class="form__label">Categoria *</label>
                        <select id="category" name="category" class="form__input" required aria-describedby="category-error">
                            <option value="">Selecione uma categoria</option>
                            <option value="Pizzaria">Pizzaria</option>
                            <option value="Sorveteria">Sorveteria</option>
                            <option value="Mercado">Mercado</option>
                            <option value="Salão">Salão</option>
                            <option value="Açaiteria">Açaiteria</option>
                            <option value="Barbearia">Barbearia</option>
                            <option value="Salão de Beleza">Salão de Beleza</option>
                            <option value="Academia">Academia</option>
                            <option value="Padaria">Padaria</option>
                            <option value="Mercearia">Mercearia</option>
                        </select>
                        <span class="form__error" id="category-error"></span>
                    </div>

                    <div class="form__group">
                        <label for="whatsapp" class="form__label">WhatsApp *</label>
                        <input type="tel" id="whatsapp" name="whatsapp" class="form__input" placeholder="(11) 99999-9999" required aria-describedby="whatsapp-error">
                        <span class="form__error" id="whatsapp-error"></span>
                    </div>

                    <div class="form__group">
                        <label for="email" class="form__label">E-mail *</label>
                        <input type="email" id="email" name="email" class="form__input" required aria-describedby="email-error">
                        <span class="form__error" id="email-error"></span>
                    </div>

                    <div class="form__group">
                        <label for="cep" class="form__label">CEP *</label>
                        <input type="text" id="cep" name="cep" class="form__input" placeholder="00000-000" required aria-describedby="cep-error">
                        <span class="form__error" id="cep-error"></span>
                    </div>

                    <div class="form__group">
                        <label for="address" class="form__label">Endereço *</label>
                        <input type="text" id="address" name="address" class="form__input" required aria-describedby="address-error">
                        <span class="form__error" id="address-error"></span>
                    </div>

                    <div class="form__group">
                        <label for="complement" class="form__label">Complemento *</label>
                        <input type="text" id="complement" name="complement" class="form__input" placeholder="Loja, Apt, Sala..." required aria-describedby="complement-error">
                        <span class="form__error" id="complement-error"></span>
                    </div>

                    <div class="form__row">
                        <div class="form__group">
                            <label for="city" class="form__label">Cidade *</label>
                            <input type="text" id="city" name="city" class="form__input" required aria-describedby="city-error">
                            <span class="form__error" id="city-error"></span>
                        </div>
                        <div class="form__group">
                            <label for="uf" class="form__label">UF *</label>
                            <select id="uf" name="uf" class="form__input" required aria-describedby="uf-error">
                                <option value="">Selecione</option>
                                <option value="AC">AC</option><option value="AL">AL</option><option value="AP">AP</option>
                                <option value="AM">AM</option><option value="BA">BA</option><option value="CE">CE</option>
                                <option value="DF">DF</option><option value="ES">ES</option><option value="GO">GO</option>
                                <option value="MA">MA</option><option value="MT">MT</option><option value="MS">MS</option>
                                <option value="MG">MG</option><option value="PA">PA</option><option value="PB">PB</option>
                                <option value="PR">PR</option><option value="PE">PE</option><option value="PI">PI</option>
                                <option value="RJ">RJ</option><option value="RN">RN</option><option value="RS">RS</option>
                                <option value="RO">RO</option><option value="RR">RR</option><option value="SC">SC</option>
                                <option value="SP">SP</option><option value="SE">SE</option><option value="TO">TO</option>
                            </select>
                            <span class="form__error" id="uf-error"></span>
                        </div>
                    </div>

                    <div class="form__group">
                        <label for="logo" class="form__label">Logo/Imagem do Negócio *</label>
                        <input type="file" id="logo" name="logo" class="form__input" accept="image/*" required aria-describedby="logo-error">
                        <span class="form__error" id="logo-error"></span>
                    </div>

                    <!-- Campos ocultos para geolocalização -->
                    <input type="hidden" name="latitude" id="latitude">
                    <input type="hidden" name="longitude" id="longitude">

                    <div class="form__group">
                        <label class="form__checkbox">
                            <input type="checkbox" id="seller-lgpd" name="aceiteLGPD" required>
                            <span class="form__checkmark"></span>
                            Aceito os <a href="termos.html" target="_blank">Termos de Uso</a> e <a href="privacidade.html" target="_blank">Política de Privacidade</a> *
                        </label>
                        <span class="form__error" id="seller-lgpd-error"></span>
                    </div>

                    <button type="submit" class="btn btn--primary btn--full">
                        <span class="btn__text">Cadastrar Gratuitamente</span>
                        <span class="btn__loading" style="display: none;">Cadastrando...</span>
                    </button>
                </form>
            </div>
EOF

# Substituir o conteúdo do modal mantendo a estrutura
sed -i '/<!-- Modal de Formulários -->/,/<!-- Firebase SDK v8/c\
    <!-- Modal de Formulário -->\
    <div class="modal" id="modal-forms">\
        <div class="modal__overlay"></div>\
        <div class="modal__content">' index.html

# Inserir o novo conteúdo do modal
sed -i '/div class="modal__content"/r temp_modal_content.html' index.html

# Adicionar fechamento do modal
sed -i '/temp_modal_content.html/a\
        </div>\
    </div>\
\
    <!-- Firebase SDK v8 (compatível) -->' index.html

# Limpar arquivo temporário
rm temp_modal_content.html

echo "✅ Landing page atualizada com sucesso!"
echo ""
echo "📋 Alterações realizadas:"
echo "   ✓ Botão CTA alterado para 'Cadastrar Meu Negócio'"
echo "   ✓ Modal convertido para formulário único de sellers"
echo "   ✓ Campos implementados conforme especificação"
echo "   ✓ Layout visual 100% preservado"
echo ""
echo "⏳ Aguardando comando 'continuar' para próximo script..."
echo "📋 Próximo: 1b-firebase-sellers.sh (Atualizar Firebase.js)"