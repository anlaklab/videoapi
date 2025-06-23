const axios = require('axios');
const fs = require('fs');
const path = require('path');

class SimpleAfterEffectsWorkflow {
    constructor() {
        this.baseURL = 'http://localhost:3000';
        this.API_KEY = 'dev-key-12345';
        this.templateId = null;
        this.videoId = null;
    }

    async run() {
        console.log('🚀 === FLUJO SIMPLE AFTER EFFECTS ===\n');
        
        try {
            // Paso 1: Verificar servidor
            await this.step1_CheckServer();
            
            // Paso 2: Convertir After Effects
            await this.step2_ConvertAfterEffects();
            
            // Paso 3: Corregir template generado
            await this.step3_FixTemplate();
            
            // Paso 4: Renderizar video
            await this.step4_RenderVideo();
            
            // Paso 5: Verificar descarga
            await this.step5_CheckDownload();
            
            console.log('\n🎉 === FLUJO COMPLETADO EXITOSAMENTE ===');
            
        } catch (error) {
            console.error('\n❌ === FLUJO FALLÓ ===');
            console.error('Error:', error.message);
            if (error.response) {
                console.error('Status:', error.response.status);
                console.error('Data:', JSON.stringify(error.response.data, null, 2));
            }
        }
    }

    async step1_CheckServer() {
        console.log('🔧 PASO 1: Verificando servidor...');
        
        try {
            const response = await axios.get(`${this.baseURL}/health`);
            console.log('✅ Servidor funcionando correctamente');
            console.log(`📊 Status: ${response.status}`);
        } catch (error) {
            throw new Error(`Servidor no disponible en ${this.baseURL}. Por favor, ejecuta 'npm start' en otra terminal.`);
        }
    }

    async step2_ConvertAfterEffects() {
        console.log('\n🎬 PASO 2: Convirtiendo After Effects...');
        
        const aepPath = 'assets/aftereffects/Animated Phone Mockup Kit CC (15.x).aep';
        
        // Verificar que el archivo existe
        if (!fs.existsSync(aepPath)) {
            throw new Error(`Archivo After Effects no encontrado: ${aepPath}`);
        }
        
        console.log(`📁 Archivo encontrado: ${aepPath}`);
        const stats = fs.statSync(aepPath);
        console.log(`📊 Tamaño: ${Math.round(stats.size / 1024 / 1024)} MB`);
        
        // Crear FormData para subir archivo
        const FormData = require('form-data');
        const form = new FormData();
        form.append('aepFile', fs.createReadStream(aepPath));
        form.append('templateName', 'Phone Mockup Kit - Simple Workflow');
        form.append('templateDescription', 'Template generado desde workflow simplificado');
        
        console.log('🔄 Convirtiendo archivo... (esto puede tardar un momento)');
        
        const response = await axios.post(`${this.baseURL}/api/aftereffects/convert`, form, {
            headers: {
                'X-API-Key': this.API_KEY,
                ...form.getHeaders()
            },
            timeout: 120000 // 2 minutos
        });
        
        this.templateId = response.data.template?.id;
        console.log('✅ Conversión exitosa!');
        console.log(`🆔 Template ID: ${this.templateId}`);
        console.log(`📊 Tracks: ${response.data.conversion?.tracks || 'N/A'}`);
        console.log(`🎞️ Clips: ${response.data.conversion?.layers || 'N/A'}`);
        console.log(`🔧 Merge Fields: ${response.data.conversion?.mergeFields || 'N/A'}`);
        console.log(`📁 Archivo original: ${response.data.conversion?.originalFile || 'N/A'}`);
        console.log(`💾 Guardado: ${response.data.saved ? 'Sí' : 'No'}`);
    }

    async step3_FixTemplate() {
        console.log('\n🔧 PASO 3: Corrigiendo template...');
        
        const templatePath = `data/templates/${this.templateId}.json`;
        
        if (!fs.existsSync(templatePath)) {
            throw new Error(`Template no encontrado: ${templatePath}`);
        }
        
        // Leer template
        const templateData = JSON.parse(fs.readFileSync(templatePath, 'utf8'));
        console.log('📋 Template cargado');
        
        // Corregir IDs numéricos a strings
        let fixed = false;
        if (templateData.timeline && templateData.timeline.tracks) {
            templateData.timeline.tracks.forEach((track, index) => {
                if (typeof track.id === 'number') {
                    track.id = track.id.toString();
                    fixed = true;
                }
            });
        }
        
        if (fixed) {
            // Guardar template corregido
            fs.writeFileSync(templatePath, JSON.stringify(templateData, null, 2));
            console.log('✅ Template corregido (IDs convertidos a strings)');
        } else {
            console.log('✅ Template ya está correcto');
        }
        
        console.log(`📊 Tracks: ${templateData.timeline.tracks.length}`);
        console.log(`🎞️ Clips totales: ${templateData.timeline.tracks.reduce((sum, track) => sum + track.clips.length, 0)}`);
        console.log(`🔧 Merge Fields: ${templateData.mergeFields.length}`);
        
        // Mostrar algunos merge fields
        console.log('🏷️ Merge Fields disponibles:');
        templateData.mergeFields.slice(0, 3).forEach(field => {
            console.log(`   • ${field.key} (${field.type}): ${field.description}`);
        });
        if (templateData.mergeFields.length > 3) {
            console.log(`   ... y ${templateData.mergeFields.length - 3} más`);
        }
    }

    async step4_RenderVideo() {
        console.log('\n🎬 PASO 4: Renderizando video...');
        
        // Leer template para obtener estructura
        const templatePath = `data/templates/${this.templateId}.json`;
        const templateData = JSON.parse(fs.readFileSync(templatePath, 'utf8'));
        
        // Preparar datos de personalización
        const mergeFields = {
            PHONE_BODY_ASSET: "assets/images/test-image.jpg",
            PHONE_GLASS_ASSET: "assets/images/test-image.jpg", 
            SCREEN_CONTENT: "¡Hola desde After Effects!",
            BACKGROUND_COLOR: "#1a1a2e",
            TITLE_TEXT: "Phone Mockup Demo",
            SUBTITLE_TEXT: "Generado automáticamente",
            TEXT_COLOR: "#ffffff"
        };
        
        const renderData = {
            timeline: templateData.timeline,
            output: {
                format: "mp4",
                resolution: { width: 1920, height: 1080 },
                fps: 30
            },
            merge: mergeFields
        };
        
        console.log('🎨 Datos de personalización:');
        Object.entries(mergeFields).forEach(([key, value]) => {
            console.log(`   • ${key}: ${value}`);
        });
        
        console.log('\n🚀 Iniciando renderizado...');
        
        const startTime = Date.now();
        
        const response = await axios.post(`${this.baseURL}/api/video/render`, renderData, {
            headers: { 'X-API-Key': this.API_KEY },
            timeout: 120000
        });
        
        this.videoId = response.data.videoId;
        const processingTime = Date.now() - startTime;
        
        console.log('✅ Video encolado exitosamente!');
        console.log(`🆔 Video ID: ${this.videoId}`);
        console.log(`📊 Estado: ${response.data.status}`);
        console.log(`⏱️ Tiempo de encolado: ${processingTime}ms`);
        console.log(`⏰ ETA: ${response.data.eta ? response.data.eta + 's' : 'N/A'}`);
        
        // Monitorear progreso
        console.log('\n🔄 Monitoreando progreso...');
        let attempts = 0;
        const maxAttempts = 60; // 5 minutos máximo
        
        while (attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 5000)); // Esperar 5 segundos
            attempts++;
            
            try {
                const statusResponse = await axios.get(`${this.baseURL}/api/video/${this.videoId}/status`, {
                    headers: { 'X-API-Key': this.API_KEY }
                });
                
                const status = statusResponse.data;
                console.log(`📊 Estado: ${status.status} - Progreso: ${status.progress || 0}%`);
                
                if (status.status === 'completed') {
                    console.log('✅ Video completado exitosamente!');
                    console.log(`📁 URL: ${status.resultUrl || 'N/A'}`);
                    console.log(`⏱️ Duración: ${status.duration || 'N/A'}s`);
                    console.log(`📊 Tamaño: ${status.size ? Math.round(status.size / 1024) : 'N/A'} KB`);
                    this.downloadUrl = status.resultUrl;
                    return;
                } else if (status.status === 'failed') {
                    throw new Error(`Video falló: ${status.error?.message || 'Error desconocido'}`);
                }
            } catch (statusError) {
                if (statusError.message.includes('Video falló')) {
                    throw statusError;
                }
                console.log(`⚠️ Error consultando estado (intento ${attempts}): ${statusError.message}`);
            }
        }
        
        throw new Error('Timeout: El video tardó más de lo esperado');
    }

    async step5_CheckDownload() {
        console.log('\n📥 PASO 5: Verificando descarga...');
        
        // Buscar archivo en la carpeta output
        console.log('🔍 Buscando archivo en carpeta output...');
        const outputDir = './output';
        
        if (!fs.existsSync(outputDir)) {
            console.log('📁 Creando carpeta output...');
            fs.mkdirSync(outputDir, { recursive: true });
        }
        
        const files = fs.readdirSync(outputDir).filter(f => f.endsWith('.mp4'));
        
        if (files.length > 0) {
            // Tomar el archivo más reciente
            const latestFile = files
                .map(f => ({ name: f, time: fs.statSync(path.join(outputDir, f)).mtime }))
                .sort((a, b) => b.time - a.time)[0];
            
            console.log(`✅ Video encontrado: ${latestFile.name}`);
            const stats = fs.statSync(path.join(outputDir, latestFile.name));
            console.log(`📊 Tamaño: ${Math.round(stats.size / 1024)} KB`);
            console.log(`📁 Ubicación: ${path.join(outputDir, latestFile.name)}`);
            console.log(`🕒 Creado: ${latestFile.time.toLocaleString()}`);
            
            // Verificar que el archivo no esté vacío
            if (stats.size > 1000) { // Al menos 1KB
                console.log('✅ El archivo parece válido');
            } else {
                console.log('⚠️ El archivo parece muy pequeño, puede estar corrupto');
            }
        } else {
            console.log('❌ No se encontraron archivos de video en output/');
            console.log('💡 El video puede estar disponible en Firebase Storage');
            
            if (this.downloadUrl) {
                console.log(`🔗 URL de descarga: ${this.downloadUrl}`);
            }
        }
    }
}

// Ejecutar el flujo simplificado
const workflow = new SimpleAfterEffectsWorkflow();
workflow.run(); 