#!/usr/bin/env node

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');

// Configuración
const API_BASE = 'http://localhost:3000';
const API_KEY = 'dev-key-12345';
const OUTPUT_DIR = './output';

// Headers con autenticación
const headers = {
    'x-api-key': API_KEY,
    'Content-Type': 'application/json'
};

// Utilidades
function log(message, type = 'INFO') {
    const timestamp = new Date().toISOString();
    const emoji = {
        'INFO': 'ℹ️',
        'SUCCESS': '✅',
        'ERROR': '❌',
        'WARN': '⚠️'
    };
    console.log(`${emoji[type]} [${type}] ${timestamp}: ${message}`);
}

function createTestAEP(filename) {
    const aepContent = `FLV\x01\x05\x00\x00\x00\x09After Effects Project Data
Project Name: ${filename}
Version: 18.0
Duration: 30.0
Width: 1920
Height: 1080
Frame Rate: 30.0
Background Color: #000000

Composition "Main Comp" {
    Duration: 30.0
    Width: 1920
    Height: 1080
    
    Layer 1 "Text Layer" {
        Type: Text
        Text: "{{TITULO}}"
        Position: [960, 540]
        Font: Arial
        Size: 72
        Color: #FFFFFF
    }
    
    Layer 2 "Background" {
        Type: Solid
        Color: #1a1a1a
        Duration: 30.0
    }
}`;
    
    const filepath = path.join('./temp', filename);
    if (!fs.existsSync('./temp')) {
        fs.mkdirSync('./temp', { recursive: true });
    }
    fs.writeFileSync(filepath, aepContent);
    return filepath;
}

async function caso1_AE_a_JSON() {
    log('🎬 CASO 1: After Effects → JSON Template', 'INFO');
    log('==========================================', 'INFO');
    
    try {
        // 1. Crear archivo AE de prueba
        const aeFile = createTestAEP('caso1-marketing-template.aep');
        log(`📁 Archivo AE creado: ${aeFile}`, 'INFO');
        
        // 2. Preparar formulario
        const form = new FormData();
        form.append('file', fs.createReadStream(aeFile), {
            filename: 'caso1-marketing-template.aep',
            contentType: 'application/octet-stream'
        });
        
        // 3. Enviar para conversión usando el endpoint correcto
        log('🚀 Convirtiendo AE → JSON...', 'INFO');
        const response = await axios.post(`${API_BASE}/api/ae-to-template`, form, {
            headers: {
                ...form.getHeaders(),
                'x-api-key': API_KEY
            }
        });
        
        if (response.data.success) {
            const outputFile = `${OUTPUT_DIR}/caso1-marketing-template.json`;
            
            // Guardar el JSON generado con nombre claro
            if (response.data.data && response.data.data.template) {
                fs.writeFileSync(outputFile, JSON.stringify(response.data.data.template, null, 2));
                log(`✅ JSON generado: ${outputFile}`, 'SUCCESS');
            }
            
            log(`📊 Job ID: ${response.data.data.jobId}`, 'INFO');
            log(`📝 Template generado: ${response.data.success}`, 'INFO');
            
            return { success: true, outputFile, jobId: response.data.data.jobId };
        } else {
            throw new Error('Conversión falló');
        }
        
    } catch (error) {
        log(`❌ Error en Caso 1: ${error.message}`, 'ERROR');
        return { success: false, error: error.message };
    }
}

async function caso2_AE_a_Video() {
    log('🎥 CASO 2: After Effects → Video MP4 (Pipeline Completo)', 'INFO');
    log('=======================================================', 'INFO');
    
    try {
        // 1. Crear archivo AE de prueba
        const aeFile = createTestAEP('caso2-video-desde-ae.aep');
        log(`📁 Archivo AE creado: ${aeFile}`, 'INFO');
        
        // 2. Configuración de merge fields
        const mergeFields = {
            "TITULO": "Mi Video Corporativo"
        };
        
        const outputConfig = {
            format: "mp4",
            resolution: { width: 1920, height: 1080 },
            fps: 30
        };
        
        // 3. Pipeline completo: AE → Video usando el endpoint correcto
        log('🔄 Ejecutando pipeline completo AE → Video...', 'INFO');
        
        const form = new FormData();
        form.append('file', fs.createReadStream(aeFile), {
            filename: 'caso2-video-desde-ae.aep',
            contentType: 'application/octet-stream'
        });
        form.append('mergeFields', JSON.stringify(mergeFields));
        form.append('outputConfig', JSON.stringify(outputConfig));
        
        const response = await axios.post(`${API_BASE}/api/ae-to-video`, form, {
            headers: {
                ...form.getHeaders(),
                'x-api-key': API_KEY
            },
            timeout: 120000 // 2 minutos timeout
        });
        
        if (response.data.success) {
            // Renombrar archivo con nombre claro
            const originalFile = response.data.data.video.result.filename;
            const outputFile = `${OUTPUT_DIR}/caso2-video-desde-ae.mp4`;
            
            // Copiar y renombrar archivo
            if (fs.existsSync(path.join(OUTPUT_DIR, originalFile))) {
                fs.copyFileSync(
                    path.join(OUTPUT_DIR, originalFile),
                    outputFile
                );
                log(`✅ Video generado: ${outputFile}`, 'SUCCESS');
            }
            
            log(`📊 Pipeline ID: ${response.data.data.pipelineId}`, 'INFO');
            log(`⏱️ Tiempo total: ${response.data.data.processingTime.total}s`, 'INFO');
            
            return { success: true, outputFile, pipelineId: response.data.data.pipelineId };
        } else {
            throw new Error('Pipeline falló');
        }
        
    } catch (error) {
        log(`❌ Error en Caso 2: ${error.message}`, 'ERROR');
        return { success: false, error: error.message };
    }
}

async function caso3_JSON_Complejo_a_Video() {
    log('🎬 CASO 3: JSON Complejo (3 min) → Video MP4', 'INFO');
    log('=============================================', 'INFO');
    
    try {
        // 1. Crear timeline complejo de 3 minutos
        const timelineComplejo = {
            tracks: [
                // Track 1: Video principal con texto
                {
                    clips: [
                        {
                            type: "text",
                            start: 0,
                            duration: 60,
                            content: "{{main_title}}",
                            style: {
                                fontSize: 84,
                                fontFamily: "Arial Bold",
                                color: "#ffffff",
                                x: 960,
                                y: 300
                            }
                        },
                        {
                            type: "text",
                            start: 60,
                            duration: 60,
                            content: "{{section_2_title}}",
                            style: {
                                fontSize: 72,
                                color: "#00ff88",
                                x: 960,
                                y: 400
                            }
                        },
                        {
                            type: "text",
                            start: 120,
                            duration: 60,
                            content: "{{conclusion}}",
                            style: {
                                fontSize: 64,
                                color: "#ffaa00",
                                x: 960,
                                y: 500
                            }
                        }
                    ]
                },
                // Track 2: Background
                {
                    clips: [
                        {
                            type: "background",
                            start: 0,
                            duration: 180,
                            color: "#1a1a2e"
                        }
                    ]
                }
            ]
        };
        
        // 2. Merge fields para personalización
        const mergeFields = {
            main_title: "Presentación Corporativa Premium",
            section_2_title: "Innovación y Tecnología",
            conclusion: "Construyendo el Futuro Juntos",
            company_name: "TechCorp Solutions",
            year: "2024"
        };
        
        // 3. Configuración de salida
        const output = {
            format: "mp4",
            resolution: { width: 1920, height: 1080 },
            fps: 30
        };
        
        log(`🎬 Creando video de 180s con ${timelineComplejo.tracks.length} tracks`, 'INFO');
        log(`📊 Clips totales: ${timelineComplejo.tracks.reduce((acc, track) => acc + track.clips.length, 0)}`, 'INFO');
        
        // 4. Enviar para renderizado
        const payload = {
            timeline: timelineComplejo,
            mergeFields: mergeFields,
            output: output
        };
        
        log('🚀 Iniciando renderizado (esto puede tomar 2-5 minutos)...', 'INFO');
        
        const response = await axios.post(`${API_BASE}/api/template-to-video`, payload, { 
            headers,
            timeout: 300000 // 5 minutos timeout
        });
        
        if (response.data.success) {
            // Renombrar archivo con nombre claro
            const originalFile = response.data.data.result.filename;
            const outputFile = `${OUTPUT_DIR}/caso3-video-complejo-3min.mp4`;
            
            // Copiar y renombrar archivo
            if (fs.existsSync(path.join(OUTPUT_DIR, originalFile))) {
                fs.copyFileSync(
                    path.join(OUTPUT_DIR, originalFile),
                    outputFile
                );
                log(`✅ Video complejo generado: ${outputFile}`, 'SUCCESS');
            }
            
            log(`📊 Job ID: ${response.data.data.id}`, 'INFO');
            log(`⏱️ Duración: 3 minutos`, 'INFO');
            log(`📏 Resolución: 1920x1080`, 'INFO');
            
            return { success: true, outputFile, jobId: response.data.data.id };
        } else {
            throw new Error('Renderizado falló');
        }
        
    } catch (error) {
        log(`❌ Error en Caso 3: ${error.message}`, 'ERROR');
        return { success: false, error: error.message };
    }
}

async function verificarOutputs() {
    log('📁 VERIFICANDO ARCHIVOS GENERADOS', 'INFO');
    log('=================================', 'INFO');
    
    const expectedFiles = [
        'caso1-marketing-template.json',
        'caso2-video-desde-ae.mp4', 
        'caso3-video-complejo-3min.mp4'
    ];
    
    expectedFiles.forEach(file => {
        const filepath = path.join(OUTPUT_DIR, file);
        if (fs.existsSync(filepath)) {
            const stats = fs.statSync(filepath);
            const size = (stats.size / 1024).toFixed(1);
            log(`✅ ${file} - ${size} KB`, 'SUCCESS');
        } else {
            log(`❌ ${file} - NO ENCONTRADO`, 'ERROR');
        }
    });
    
    // También mostrar archivos existentes con timestamp
    log('\n📋 ARCHIVOS TIMESTAMP EN OUTPUT:', 'INFO');
    const files = fs.readdirSync(OUTPUT_DIR).filter(f => f.endsWith('.mp4') || f.endsWith('.json'));
    files.forEach(file => {
        const filepath = path.join(OUTPUT_DIR, file);
        const stats = fs.statSync(filepath);
        const size = (stats.size / 1024).toFixed(1);
        log(`📄 ${file} - ${size} KB`, 'INFO');
    });
}

async function main() {
    log('🚀 VALIDACIÓN DE 3 CASOS DE USO PRINCIPALES', 'INFO');
    log('===========================================', 'INFO');
    
    // Verificar servidor
    try {
        await axios.get(`${API_BASE}/api/health`, { headers });
        log('✅ Servidor accesible', 'SUCCESS');
    } catch (error) {
        log('❌ Servidor no accesible. Asegúrate de que esté ejecutándose.', 'ERROR');
        return;
    }
    
    const results = [];
    
    // Ejecutar casos de uso
    log('\n🎬 Ejecutando Casos de Uso...', 'INFO');
    
    results.push(await caso1_AE_a_JSON());
    results.push(await caso2_AE_a_Video());
    results.push(await caso3_JSON_Complejo_a_Video());
    
    // Verificar outputs
    log('\n📁 Verificando archivos generados...', 'INFO');
    await verificarOutputs();
    
    // Resumen final
    const exitosos = results.filter(r => r.success).length;
    const total = results.length;
    
    log('\n📊 RESUMEN FINAL', 'INFO');
    log('===============', 'INFO');
    log(`Casos de uso ejecutados: ${total}`, 'INFO');
    log(`Exitosos: ${exitosos}`, 'SUCCESS');
    log(`Fallidos: ${total - exitosos}`, exitosos === total ? 'SUCCESS' : 'ERROR');
    log(`Tasa de éxito: ${((exitosos/total) * 100).toFixed(1)}%`, 'INFO');
    
    if (exitosos === total) {
        log('🎉 ¡TODOS LOS CASOS DE USO FUNCIONAN CORRECTAMENTE!', 'SUCCESS');
    } else {
        log('⚠️ Algunos casos de uso necesitan atención', 'WARN');
    }
    
    log('\n📋 ARCHIVOS ESPERADOS EN OUTPUT:', 'INFO');
    log('• caso1-marketing-template.json (Template JSON desde AE)', 'INFO');
    log('• caso2-video-desde-ae.mp4 (Video directo desde AE)', 'INFO'); 
    log('• caso3-video-complejo-3min.mp4 (Video desde JSON complejo)', 'INFO');
}

// Ejecutar
main().catch(console.error); 