const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

class CompleteAfterEffectsWorkflow {
    constructor() {
        this.baseURL = 'http://localhost:3000';
        this.API_KEY = 'dev-key-12345';
        this.serverProcess = null;
        this.templateId = null;
        this.videoId = null;
    }

    async run() {
        console.log('🚀 === FLUJO COMPLETO AFTER EFFECTS ===\n');
        
        try {
            // Paso 1: Inicializar servidor
            await this.step1_InitializeServer();
            
            // Paso 2: Convertir After Effects
            await this.step2_ConvertAfterEffects();
            
            // Paso 3: Corregir template generado
            await this.step3_FixTemplate();
            
            // Paso 4: Renderizar video
            await this.step4_RenderVideo();
            
            // Paso 5: Descargar video
            await this.step5_DownloadVideo();
            
            console.log('\n🎉 === FLUJO COMPLETADO EXITOSAMENTE ===');
            
        } catch (error) {
            console.error('\n❌ === FLUJO FALLÓ ===');
            console.error('Error:', error.message);
            console.error('Stack:', error.stack);
        } finally {
            // Limpiar servidor
            await this.cleanup();
        }
    }

    async step1_InitializeServer() {
        console.log('🔧 PASO 1: Inicializando servidor...');
        
        // Verificar si el servidor ya está ejecutándose
        try {
            await axios.get(`${this.baseURL}/health`);
            console.log('✅ Servidor ya está ejecutándose');
            return;
        } catch (error) {
            console.log('📡 Servidor no detectado, intentando iniciar...');
        }
        
        // Matar cualquier proceso que esté usando el puerto 3000
        console.log('🔌 Liberando puerto 3000...');
        try {
            await this.killPortProcess(3000);
        } catch (error) {
            console.log('ℹ️ No se encontraron procesos en puerto 3000');
        }
        
        // Iniciar servidor en background
        console.log('🚀 Iniciando servidor...');
        this.serverProcess = spawn('npm', ['start'], {
            stdio: ['ignore', 'pipe', 'pipe'],
            detached: false
        });
        
        // Capturar errores del servidor
        this.serverProcess.stderr.on('data', (data) => {
            console.log(`⚠️ Server stderr: ${data.toString().trim()}`);
        });
        
        this.serverProcess.on('error', (error) => {
            console.log(`❌ Server error: ${error.message}`);
        });
        
        // Esperar a que el servidor esté listo
        let attempts = 0;
        const maxAttempts = 40; // Aumentar timeout
        
        while (attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 3000)); // Esperar más tiempo
            attempts++;
            
            try {
                const response = await axios.get(`${this.baseURL}/health`, { timeout: 5000 });
                console.log('✅ Servidor iniciado correctamente');
                console.log(`📊 Status: ${response.status}`);
                return;
            } catch (error) {
                console.log(`⏳ Esperando servidor... (${attempts}/${maxAttempts})`);
                
                // Mostrar más información en los últimos intentos
                if (attempts > maxAttempts - 5) {
                    console.log(`   Error: ${error.code || error.message}`);
                }
            }
        }
        
        throw new Error('Timeout: El servidor no se pudo iniciar después de 2 minutos');
    }
    
    async killPortProcess(port) {
        return new Promise((resolve, reject) => {
            const { exec } = require('child_process');
            exec(`lsof -ti:${port} | xargs kill -9`, (error, stdout, stderr) => {
                if (error) {
                    reject(error);
                } else {
                    resolve();
                }
            });
        });
    }

    async step2_ConvertAfterEffects() {
        console.log('\n🎬 PASO 2: Convirtiendo After Effects...');
        
        const aepPath = 'assets/aftereffects/Animated Phone Mockup Kit CC (15.x).aep';
        
        // Verificar que el archivo existe
        if (!fs.existsSync(aepPath)) {
            throw new Error(`Archivo After Effects no encontrado: ${aepPath}`);
        }
        
        console.log(`📁 Archivo encontrado: ${aepPath}`);
        
        // Crear FormData para subir archivo
        const FormData = require('form-data');
        const form = new FormData();
        form.append('file', fs.createReadStream(aepPath));
        form.append('templateName', 'Phone Mockup Kit - Complete Workflow');
        form.append('description', 'Template generado automáticamente desde workflow completo');
        
        console.log('🔄 Convirtiendo archivo...');
        
        const response = await axios.post(`${this.baseURL}/api/aftereffects/convert`, form, {
            headers: {
                'X-API-Key': this.API_KEY,
                ...form.getHeaders()
            },
            timeout: 60000 // 1 minuto
        });
        
        this.templateId = response.data.templateId;
        console.log('✅ Conversión exitosa!');
        console.log(`🆔 Template ID: ${this.templateId}`);
        console.log(`📊 Tracks: ${response.data.details.tracks || 'N/A'}`);
        console.log(`🎞️ Clips: ${response.data.details.clips || 'N/A'}`);
        console.log(`🔧 Merge Fields: ${response.data.details.mergeFields || 'N/A'}`);
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
        
        console.log('🎨 Datos de personalización preparados');
        console.log('🚀 Iniciando renderizado...');
        
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
                    console.log(`📁 URL: ${status.resultUrl}`);
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
                console.log(`⚠️ Error consultando estado: ${statusError.message}`);
            }
        }
        
        throw new Error('Timeout: El video tardó más de lo esperado');
    }

    async step5_DownloadVideo() {
        console.log('\n📥 PASO 5: Descargando video...');
        
        try {
            // Intentar descargar desde la URL directa si está disponible
            if (this.downloadUrl) {
                console.log('📡 Descargando desde URL directa...');
                await this.downloadFromUrl(this.downloadUrl);
                return;
            }
            
            // Si no, usar el endpoint de descarga
            console.log('📡 Descargando desde endpoint...');
            const response = await axios.get(`${this.baseURL}/api/video/${this.videoId}`, {
                headers: { 'X-API-Key': this.API_KEY },
                maxRedirects: 0,
                validateStatus: (status) => status === 302 || status === 200
            });
            
            if (response.status === 302) {
                const redirectUrl = response.headers.location;
                console.log('🔗 Redirigiendo a:', redirectUrl);
                await this.downloadFromUrl(redirectUrl);
            } else {
                throw new Error('Respuesta inesperada del servidor');
            }
            
        } catch (error) {
            console.error('❌ Error descargando video:', error.message);
            
            // Como fallback, intentar encontrar el archivo en la carpeta output
            console.log('🔍 Buscando archivo en carpeta output...');
            const outputDir = './output';
            const files = fs.readdirSync(outputDir).filter(f => f.endsWith('.mp4'));
            
            if (files.length > 0) {
                // Tomar el archivo más reciente
                const latestFile = files
                    .map(f => ({ name: f, time: fs.statSync(path.join(outputDir, f)).mtime }))
                    .sort((a, b) => b.time - a.time)[0];
                
                console.log(`✅ Archivo encontrado: ${latestFile.name}`);
                const stats = fs.statSync(path.join(outputDir, latestFile.name));
                console.log(`📊 Tamaño: ${Math.round(stats.size / 1024)} KB`);
                console.log(`📁 Ubicación: ${path.join(outputDir, latestFile.name)}`);
            } else {
                console.log('❌ No se encontraron archivos de video');
            }
        }
    }

    async downloadFromUrl(url) {
        const response = await axios.get(url, {
            responseType: 'stream'
        });
        
        const filename = `after-effects-demo-${Date.now()}.mp4`;
        const outputPath = path.join('./output', filename);
        
        // Asegurar que el directorio existe
        if (!fs.existsSync('./output')) {
            fs.mkdirSync('./output', { recursive: true });
        }
        
        const writer = fs.createWriteStream(outputPath);
        response.data.pipe(writer);
        
        return new Promise((resolve, reject) => {
            writer.on('finish', () => {
                const stats = fs.statSync(outputPath);
                console.log('✅ Video descargado exitosamente!');
                console.log(`📁 Archivo: ${filename}`);
                console.log(`📊 Tamaño: ${Math.round(stats.size / 1024)} KB`);
                console.log(`📍 Ubicación: ${outputPath}`);
                resolve();
            });
            writer.on('error', reject);
        });
    }

    async cleanup() {
        console.log('\n🧹 Limpiando recursos...');
        
        if (this.serverProcess) {
            console.log('🔌 Deteniendo servidor...');
            this.serverProcess.kill('SIGTERM');
            
            // Esperar un momento para que el proceso termine
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            if (!this.serverProcess.killed) {
                console.log('🔨 Forzando cierre del servidor...');
                this.serverProcess.kill('SIGKILL');
            }
        }
        
        console.log('✅ Limpieza completada');
    }
}

// Ejecutar el flujo completo
const workflow = new CompleteAfterEffectsWorkflow();
workflow.run(); 