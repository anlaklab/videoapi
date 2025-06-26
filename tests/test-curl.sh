#!/bin/bash

# Test del nuevo endpoint AE → Template usando curl

echo "🧪 PROBANDO NUEVO ENDPOINT CON CURL"
echo "==================================="

# Verificar que el servidor está corriendo
echo "🔍 Verificando servidor..."
if curl -s http://localhost:3000/api/health > /dev/null 2>&1; then
    echo "✅ Servidor respondiendo"
else
    echo "❌ Servidor no responde. Iniciarlo con: ./start-server.sh"
    exit 1
fi

# Verificar que el archivo AE existe
AE_FILE="assets/aftereffects/Animated Phone Mockup Kit CC (15.x).aep"
if [ -f "$AE_FILE" ]; then
    echo "✅ Archivo AE encontrado: $AE_FILE"
    echo "📊 Tamaño: $(du -h "$AE_FILE" | cut -f1)"
else
    echo "❌ Archivo AE no encontrado: $AE_FILE"
    exit 1
fi

echo ""
echo "🚀 Enviando archivo al nuevo endpoint..."
echo "📡 URL: http://localhost:3000/api/aftereffects/convert"
echo ""

# Hacer la petición con curl
curl -X 'POST' \
  'http://localhost:3000/api/aftereffects/convert' \
  -H 'accept: application/json' \
  -H 'x-api-key: dev-key-12345' \
  -H 'x-correlation-id: curl-test-'$(date +%s) \
  -H 'Content-Type: multipart/form-data' \
  -F "aepFile=@$AE_FILE" \
  -F 'templateName=Test Template from Curl' \
  -F 'templateDescription=Template generado usando curl y el nuevo endpoint modular' \
  -F 'saveTemplate=true' \
  -w "\n\n📊 Tiempo total: %{time_total}s\n📈 Status: %{http_code}\n" \
  -s

echo ""
echo "🎉 Test completado!" 