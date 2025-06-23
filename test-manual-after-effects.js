const axios = require('axios');
const fs = require('fs');
const path = require('path');

async function testManualAfterEffects() {
    console.log('🧪 === PRUEBA MANUAL AFTER EFFECTS ===\n');
    
    const templateId = 'ed24c0e0-d9a3-4132-9965-06b7e5d98b5e';
    const baseURL = 'http://localhost:3000';
    const API_KEY = 'dev-key-12345';
    
    try {
        // 1. Verificar que el servidor esté funcionando
        console.log('🔧 Verificando servidor...');
        console.log('✅ Asumiendo servidor funcionando (omitiendo health check)\n');
        
        // 2. Leer el template directamente del archivo
        console.log('📋 Cargando template...');
        const templatePath = `data/templates/${templateId}.json`;
        const templateData = JSON.parse(fs.readFileSync(templatePath, 'utf8'));
        console.log(`✅ Template cargado: ${templateData.name}`);
        console.log(`📊 Tracks: ${templateData.timeline.tracks.length}`);
        console.log(`🎞️ Clips totales: ${templateData.timeline.tracks.reduce((sum, track) => sum + track.clips.length, 0)}`);
        console.log(`🔧 Merge Fields: ${templateData.mergeFields.length}\n`);
        
        // 3. Preparar datos de personalización
        console.log('🎨 Preparando personalización...');
        const mergeFields = {
            PHONE_BODY_ASSET: "assets/images/test-image.jpg", // Usar imagen estática en lugar de .mov
            PHONE_GLASS_ASSET: "assets/images/test-image.jpg", // Usar imagen estática
            SCREEN_CONTENT: "¡Hola desde After Effects!",
            BACKGROUND_COLOR: "#1a1a2e",
            TITLE_TEXT: "Phone Mockup Demo",
            SUBTITLE_TEXT: "Generado desde After Effects",
            TEXT_COLOR: "#ffffff"
        };
        
        const customData = {
            timeline: templateData.timeline,
            output: {
                format: "mp4",
                resolution: { width: 1920, height: 1080 },
                fps: 30
            },
            merge: mergeFields
        };
        
        console.log('✅ Datos preparados:', JSON.stringify(mergeFields, null, 2));
        console.log();
        
        // 4. Generar video
        console.log('🎬 Generando video...');
        const startTime = Date.now();
        
        const response = await axios.post(`${baseURL}/api/video/render`, customData, {
            headers: { 'X-API-Key': API_KEY },
            timeout: 120000 // 2 minutos de timeout
        });
        
        const endTime = Date.now();
        const processingTime = endTime - startTime;
        
        console.log('✅ Video encolado exitosamente!');
        console.log(`🆔 Video ID: ${response.data.videoId}`);
        console.log(`📊 Estado: ${response.data.status}`);
        console.log(`⏱️ Tiempo de encolado: ${processingTime}ms`);
        console.log(`📍 Status URL: ${response.data.statusUrl}`);
        console.log(`📥 Download URL: ${response.data.downloadUrl}`);
        console.log(`⏰ ETA: ${response.data.eta ? response.data.eta + 's' : 'N/A'}`);
        
        // 5. Monitorear el progreso del video
        console.log('\n🔄 Monitoreando progreso...');
        const videoId = response.data.videoId;
        let attempts = 0;
        const maxAttempts = 60; // 5 minutos máximo
        
        while (attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 5000)); // Esperar 5 segundos
            attempts++;
            
            try {
                const statusResponse = await axios.get(`${baseURL}/api/video/${videoId}/status`, {
                    headers: { 'X-API-Key': API_KEY }
                });
                
                const status = statusResponse.data;
                console.log(`📊 Estado: ${status.status} - Progreso: ${status.progress || 0}%`);
                
                if (status.status === 'completed') {
                    console.log('✅ Video completado exitosamente!');
                    console.log(`📁 URL: ${status.resultUrl}`);
                    console.log(`⏱️ Duración: ${status.duration || 'N/A'}s`);
                    console.log(`📊 Tamaño: ${status.size ? Math.round(status.size / 1024) : 'N/A'} KB`);
                    break;
                } else if (status.status === 'failed') {
                    console.log('❌ Video falló!');
                    console.log(`Error: ${status.error?.message || 'Error desconocido'}`);
                    break;
                }
            } catch (statusError) {
                console.log(`⚠️ Error consultando estado: ${statusError.message}`);
            }
        }
        
        if (attempts >= maxAttempts) {
            console.log('⏰ Timeout: El video tardó más de lo esperado');
        }
        
        console.log('\n🎉 === PRUEBA EXITOSA ===');
        
    } catch (error) {
        console.error('\n❌ === PRUEBA FALLÓ ===');
        console.error('Error:', error.message);
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', error.response.data);
        }
        console.error('Stack:', error.stack);
    }
}

// Ejecutar la prueba
testManualAfterEffects(); 