#!/bin/bash

# Script para iniciar el servidor JSON2VIDEO con configuración correcta

echo "🚀 Iniciando JSON2VIDEO API Server..."
echo "======================================"

# Configurar variables de entorno
export FFMPEG_PATH=/opt/homebrew/bin/ffmpeg
export NODE_ENV=development
export PORT=3000
export API_KEY=dev-key-12345

# Verificar FFmpeg
echo "🔧 Verificando FFmpeg..."
if command -v $FFMPEG_PATH &> /dev/null; then
    echo "✅ FFmpeg encontrado en: $FFMPEG_PATH"
    $FFMPEG_PATH -version | head -1
else
    echo "❌ FFmpeg no encontrado en: $FFMPEG_PATH"
    echo "💡 Instalando FFmpeg con Homebrew..."
    brew install ffmpeg
fi

# Crear directorios necesarios
echo "📁 Creando directorios..."
mkdir -p temp/aep-uploads
mkdir -p output
mkdir -p data/templates

# Iniciar servidor
echo "🌟 Iniciando servidor en puerto $PORT..."
echo "📡 Endpoints disponibles:"
echo "  - POST /api/aftereffects/convert (nuevo modular)"
echo "  - POST /api/ae-to-template"
echo "  - POST /api/template-to-video"
echo "  - GET /api/health"
echo "  - GET /api/stats"
echo ""

node src/server.js 