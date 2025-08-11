#!/bin/bash

# Script para gerar ícones PWA a partir do favicon SVG
# Requer ImageMagick instalado: sudo apt install imagemagick

echo "📱 Gerando ícones PWA..."

# Verificar se ImageMagick está instalado
if ! command -v convert &> /dev/null; then
    echo "❌ ImageMagick não encontrado. Instale com:"
    echo "sudo apt install imagemagick"
    exit 1
fi

# Tamanhos dos ícones
sizes=(72 96 128 144 152 192 384 512)

# Gerar ícones
for size in "${sizes[@]}"; do
    echo "📦 Gerando ícone ${size}x${size}..."
    convert favicon.svg -resize ${size}x${size} icons/icon-${size}x${size}.png
done

echo "✅ Ícones PWA gerados com sucesso!"
echo "📂 Arquivos criados em: icons/"
