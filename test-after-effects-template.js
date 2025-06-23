#!/usr/bin/env node

const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data');

const API_BASE = 'http://localhost:3000/api';
const API_KEY = 'dev-key-12345';

async function testRealAfterEffectsTemplate() {
  try {
    console.log('🎬 Testing REAL After Effects Phone Mockup with actual assets...\\n');

    // Step 1: Convertir el archivo After Effects real usando FormData
    console.log('📂 Converting real After Effects file...');
    
    const aepFilePath = './assets/aftereffects/Animated Phone Mockup Kit CC (15.x).aep';
    
    // Verificar que el archivo existe
    if (!fs.existsSync(aepFilePath)) {
      // Usar el archivo de ejemplo si no existe el real
      const examplePath = './examples/sample-project.aep';
      if (fs.existsSync(examplePath)) {
        console.log('📁 Using example AEP file for testing...');
        const form = new FormData();
        form.append('aepFile', fs.createReadStream(examplePath));
        form.append('templateName', 'Enhanced Phone Mockup Kit');
        form.append('templateDescription', 'Professional phone mockup template with enhanced features');
        
        const convertResponse = await axios.post(`${API_BASE}/aftereffects/convert`, form, {
          headers: {
            'X-API-Key': API_KEY,
            ...form.getHeaders()
          }
        });

        if (convertResponse.data.success) {
          console.log('✅ After Effects template converted successfully!');
          console.log(`📋 Template ID: ${convertResponse.data.template.id}`);
          console.log(`📋 Template Name: ${convertResponse.data.template.name}`);
          
          const templateId = convertResponse.data.template.id;

          // Step 2: Preparar merge fields con contenido realista
          const mergeFields = {
            TITLE: '📱 NextGen Mobile App',
            SUBTITLE: 'Revolutionary technology that transforms how you interact with the digital world',
            SCREEN_CONTENT: 'assets/unsplash/images/nature-scene.jpg', // Imagen para la pantalla
            BACKGROUND_IMAGE: 'assets/unsplash/images/mountain-landscape.jpg', // Fondo dinámico
            LOGO_URL: 'assets/images/test-image.jpg', // Logo de la empresa
            TEXT_COLOR: '#FFFFFF',
            SUBTITLE_COLOR: '#A0A0FF',
            TITLE_STROKE_COLOR: '#000080',
            BG_COLOR: '#0A0A2E',
            CTA_TEXT: '🚀 Download Now!',
            CTA_COLOR: '#FF6B6B'
          };

          console.log('\\n🎨 Merge fields:', JSON.stringify(mergeFields, null, 2));

          // Step 3: Renderizar el template
          console.log('\\n🎬 Rendering enhanced phone mockup template...');

          const renderResponse = await axios.post(`${API_BASE}/templates/${templateId}/render`, {
            mergeFields: mergeFields,
            output: {
              format: 'mp4',
              resolution: { width: 1920, height: 1080 },
              fps: 30,
              quality: 'high',
              bitrate: '8000k' // Alta calidad para mostrar los detalles del mockup
            }
          }, {
            headers: {
              'X-API-Key': API_KEY,
              'Content-Type': 'application/json'
            }
          });

          console.log('📋 Full render response:', JSON.stringify(renderResponse.data, null, 2));

          const jobId = renderResponse.data.jobId;
          console.log(`✅ Render job created: ${jobId}`);

          // Step 4: Monitorear el progreso
          console.log('\\n⏳ Monitoring render progress...');
          
          let status = 'waiting';
          let attempts = 0;
          const maxAttempts = 60; // 5 minutos máximo

          while (status !== 'completed' && status !== 'failed' && attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 5000)); // Esperar 5 segundos
            attempts++;

            const statusResponse = await axios.get(`${API_BASE}/video/${jobId}/status`, {
              headers: { 'X-API-Key': API_KEY }
            });

            status = statusResponse.data.status;
            console.log(`📊 Status: ${status} (attempt ${attempts}/${maxAttempts})`);

            if (statusResponse.data.progress) {
              console.log(`⚡ Progress: ${statusResponse.data.progress}%`);
            }

            if (status === 'completed') {
              console.log('\\n🎉 Real Phone Mockup video rendered successfully!');
              const result = {
                videoId: statusResponse.data.videoId,
                url: statusResponse.data.resultUrl,
                duration: statusResponse.data.duration,
                size: statusResponse.data.size,
                format: statusResponse.data.format,
                resolution: statusResponse.data.resolution
              };
              console.log('📁 Result:', JSON.stringify(result, null, 2));
              
              // Step 5: Verificar que el archivo se descargó localmente
              console.log('\\n📥 Checking local download...');
              const localPath = `./output/${jobId}.mp4`;
              
              if (fs.existsSync(localPath)) {
                const stats = fs.statSync(localPath);
                console.log(`✅ Video downloaded locally: ${localPath}`);
                console.log(`📊 Local file size: ${Math.round(stats.size / 1024)}KB`);
                console.log(`📅 Created: ${stats.birthtime}`);
              } else {
                console.log(`❌ Local file not found: ${localPath}`);
              }
              
              return result;
            } else if (status === 'failed') {
              console.error('❌ Render failed:', statusResponse.data.error);
              return null;
            }
          }

          if (attempts >= maxAttempts) {
            console.error('⏰ Render timeout - exceeded maximum wait time');
            return null;
          }

        } else {
          console.error('❌ Failed to convert After Effects file:', convertResponse.data.message);
          return null;
        }
      } else {
        console.error('❌ No After Effects file found for testing');
        return null;
      }
    }

  } catch (error) {
    console.error('💥 Error:', error.response?.data || error.message);
    return null;
  }
}

// Ejecutar el test
testRealAfterEffectsTemplate()
  .then(result => {
    if (result) {
      console.log('\\n🏆 Real After Effects Phone Mockup test completed successfully!');
      console.log('🔗 Firebase URL:', result.url);
      console.log('💾 Video Duration:', result.duration, 'seconds');
      console.log('📦 File Size:', Math.round(result.size / 1024), 'KB');
    } else {
      console.log('\\n💔 Test failed or was incomplete');
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('💥 Unhandled error:', error);
    process.exit(1);
  }); 