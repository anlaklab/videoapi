#!/bin/bash

echo "🚀 EJECUTANDO TODOS LOS TESTS DE JSON2VIDEO API"
echo "================================================"

# Detener servidor previo
echo "🛑 Deteniendo servidor previo..."
pkill -f "node src/server.js" 2>/dev/null || true
sleep 2

# Iniciar servidor con FFmpeg correcto
echo "🔄 Iniciando servidor con FFmpeg correcto..."
FFMPEG_PATH=/opt/homebrew/bin/ffmpeg node src/server.js > server.log 2>&1 &
SERVER_PID=$!
sleep 5

# Verificar que el servidor esté funcionando
if ! curl -s http://localhost:3000/health > /dev/null; then
    echo "❌ Error: Servidor no responde"
    kill $SERVER_PID 2>/dev/null
    exit 1
fi

echo "✅ Servidor iniciado correctamente (PID: $SERVER_PID)"
echo ""

# Ejecutar tests
echo "🧪 EJECUTANDO TESTS..."
echo "====================="

echo "1. Test Completo de API:"
node test-complete-api.js
echo ""

echo "2. Test Básico de Validación:"
node test-basic-validation.js
echo ""

echo "3. Test de Endpoints Individuales:"
node test-individual-endpoints.js
echo ""

echo "4. Test de Swagger:"
node test-swagger-endpoints.js
echo ""

echo "5. Demo de Funcionalidades:"
node demo-working-features.js
echo ""

# Limpiar
echo "🧹 Limpiando..."
kill $SERVER_PID 2>/dev/null || true
rm -f server.log

echo "✅ TODOS LOS TESTS COMPLETADOS" 