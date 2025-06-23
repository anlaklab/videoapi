const axios = require('axios');

async function testSimpleRender() {
    console.log('🧪 === PRUEBA SIMPLE DE RENDERIZADO ===\n');
    
    const baseURL = 'http://localhost:3000';
    const API_KEY = 'dev-key-12345';
    
    try {
        // Timeline básico sin clips background
        const simpleTimeline = {
            timeline: {
                tracks: [
                    {
                        id: "1",
                        clips: [
                            {
                                id: "text1",
                                type: "text",
                                start: 0,
                                duration: 5,
                                text: "¡Video desde After Effects!",
                                fontSize: 48,
                                color: "#ffffff",
                                fontFamily: "Arial",
                                position: { x: 960, y: 540 }
                            }
                        ]
                    }
                ],
                background: {
                    color: "#1a1a2e"
                }
            },
            output: {
                format: "mp4",
                resolution: { width: 1920, height: 1080 },
                fps: 30
            }
        };
        
        console.log('🚀 Iniciando renderizado simple...');
        
        const response = await axios.post(`${baseURL}/api/video/render`, simpleTimeline, {
            headers: { 'X-API-Key': API_KEY },
            timeout: 120000
        });
        
        console.log('✅ Video encolado exitosamente!');
        console.log(`🆔 Video ID: ${response.data.videoId}`);
        console.log(`📊 Estado: ${response.data.status}`);
        
        // Monitorear progreso
        const videoId = response.data.videoId;
        let attempts = 0;
        const maxAttempts = 30;
        
        while (attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 3000));
            attempts++;
            
            try {
                const statusResponse = await axios.get(`${baseURL}/api/video/${videoId}/status`, {
                    headers: { 'X-API-Key': API_KEY }
                });
                
                const status = statusResponse.data;
                console.log(`📊 Estado: ${status.status} - Progreso: ${status.progress || 0}%`);
                
                if (status.status === 'completed') {
                    console.log('✅ Video completado exitosamente!');
                    console.log(`📁 URL: ${status.resultUrl || 'N/A'}`);
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
        
        console.log('\n🎉 === PRUEBA COMPLETADA ===');
        
    } catch (error) {
        console.error('\n❌ === PRUEBA FALLÓ ===');
        console.error('Error:', error.message);
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', JSON.stringify(error.response.data, null, 2));
        }
    }
}

testSimpleRender(); 