/**
 * Servicio para comunicación con JSON2VIDEO API
 * 
 * Maneja todas las llamadas a nuestra API de renderizado de videos
 */

import axios from 'axios';

class JSON2VideoAPI {
  constructor() {
    this.baseURL = process.env.REACT_APP_API_BASE || 'http://localhost:3000/api';
    this.apiKey = process.env.REACT_APP_API_KEY || 'dev-key-12345';
    
    // Configurar axios con interceptores
    this.api = axios.create({
      baseURL: this.baseURL,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey
      },
      timeout: 300000 // 5 minutos para renderizado
    });

    this.setupInterceptors();
  }

  /**
   * Configurar interceptores para logging y manejo de errores
   */
  setupInterceptors() {
    // Request interceptor
    this.api.interceptors.request.use(
      (config) => {
        console.log(`🚀 ${config.method?.toUpperCase()} ${config.url}`);
        console.log('📤 Request data:', config.data);
        return config;
      },
      (error) => {
        console.error('❌ Request error:', error);
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.api.interceptors.response.use(
      (response) => {
        console.log(`✅ ${response.status} ${response.config.url}`);
        console.log('📥 Response data:', response.data);
        return response;
      },
      (error) => {
        console.error('❌ Response error:', error.response?.data || error.message);
        return Promise.reject(error);
      }
    );
  }

  /**
   * Verificar estado del servidor
   */
  async healthCheck() {
    try {
      const response = await this.api.get('/health');
      return {
        success: true,
        data: response.data,
        message: 'Servidor funcionando correctamente'
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || error.message,
        message: 'Error de conexión con el servidor'
      };
    }
  }

  /**
   * Renderizar video desde timeline JSON2VIDEO
   */
  async renderVideo(timelineData, options = {}) {
    try {
      console.log('🎬 Iniciando renderizado de video...');
      console.log('📊 Timeline data:', timelineData);

      const requestData = {
        timeline: timelineData.timeline,
        mergeFields: timelineData.mergeFields || {},
        output: {
          format: options.format || 'mp4',
          resolution: options.resolution || { width: 1920, height: 1080 },
          fps: options.fps || 30,
          quality: options.quality || 'high'
        },
        priority: options.priority || 'normal',
        generateThumbnail: options.generateThumbnail !== false
      };

      const response = await this.api.post('/template-to-video', requestData);

      if (response.data.success) {
        return {
          success: true,
          data: response.data.data,
          message: 'Video renderizado exitosamente',
          videoUrl: this.getVideoURL(response.data.data.result.filename),
          filename: response.data.data.result.filename,
          duration: response.data.data.result.duration,
          size: response.data.data.result.size
        };
      } else {
        throw new Error(response.data.error || 'Error desconocido en renderizado');
      }

    } catch (error) {
      console.error('❌ Error renderizando video:', error);
      
      return {
        success: false,
        error: error.response?.data?.error || error.message,
        message: 'Error durante el renderizado del video',
        details: error.response?.data
      };
    }
  }

  /**
   * Pipeline completo: After Effects → Video
   */
  async renderFromAfterEffects(file, mergeFields = {}, outputConfig = {}) {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('mergeFields', JSON.stringify(mergeFields));
      formData.append('outputConfig', JSON.stringify(outputConfig));

      const response = await this.api.post('/ae-to-video', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'x-api-key': this.apiKey
        }
      });

      if (response.data.success) {
        return {
          success: true,
          data: response.data.data,
          message: 'Pipeline AE → Video completado',
          videoUrl: this.getVideoURL(response.data.data.video.result.filename)
        };
      } else {
        throw new Error(response.data.error || 'Error en pipeline AE → Video');
      }

    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || error.message,
        message: 'Error en pipeline After Effects → Video'
      };
    }
  }

  /**
   * Obtener estadísticas del sistema
   */
  async getStats() {
    try {
      const response = await this.api.get('/stats');
      return {
        success: true,
        data: response.data,
        message: 'Estadísticas obtenidas correctamente'
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || error.message,
        message: 'Error obteniendo estadísticas'
      };
    }
  }

  /**
   * Obtener expresiones de After Effects soportadas
   */
  async getAfterEffectsExpressions() {
    try {
      const response = await this.api.get('/aftereffects/expressions');
      return {
        success: true,
        data: response.data,
        message: 'Expresiones AE obtenidas correctamente'
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || error.message,
        message: 'Error obteniendo expresiones AE'
      };
    }
  }

  /**
   * Construir URL completa para acceso a video
   */
  getVideoURL(filename) {
    if (!filename) return null;
    
    // Si ya es una URL completa, devolverla
    if (filename.startsWith('http')) {
      return filename;
    }
    
    // Construir URL completa
    const baseURL = this.baseURL.replace('/api', '');
    return `${baseURL}/output/${filename}`;
  }

  /**
   * Descargar video
   */
  async downloadVideo(filename) {
    try {
      const videoURL = this.getVideoURL(filename);
      
      // Crear enlace temporal para descarga
      const link = document.createElement('a');
      link.href = videoURL;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      return { success: true, message: 'Descarga iniciada' };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: 'Error iniciando descarga'
      };
    }
  }

  /**
   * Generar preview de video (thumbnail)
   */
  async generatePreview(timelineData) {
    try {
      // Para el preview, renderizamos solo los primeros 3 segundos
      const previewTimeline = {
        ...timelineData,
        timeline: {
          ...timelineData.timeline,
          duration: Math.min(timelineData.timeline.duration, 3)
        }
      };

      const result = await this.renderVideo(previewTimeline, {
        quality: 'medium',
        generateThumbnail: true
      });

      return result;
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: 'Error generando preview'
      };
    }
  }

  /**
   * Validar timeline antes de renderizar
   */
  validateTimeline(timelineData) {
    const errors = [];

    if (!timelineData.timeline) {
      errors.push('Timeline es requerido');
    }

    if (!timelineData.timeline.tracks || timelineData.timeline.tracks.length === 0) {
      errors.push('Al menos una pista es requerida');
    }

    if (timelineData.timeline.duration <= 0) {
      errors.push('Duración debe ser mayor a 0');
    }

    // Validar clips
    timelineData.timeline.tracks?.forEach((track, trackIndex) => {
      if (!track.clips || track.clips.length === 0) {
        errors.push(`Track ${trackIndex} debe tener al menos un clip`);
      }

      track.clips?.forEach((clip, clipIndex) => {
        if (!clip.type) {
          errors.push(`Clip ${clipIndex} en track ${trackIndex} debe tener tipo`);
        }

        if (clip.start < 0) {
          errors.push(`Clip ${clipIndex} no puede empezar antes de 0`);
        }

        if (clip.duration <= 0) {
          errors.push(`Clip ${clipIndex} debe tener duración mayor a 0`);
        }
      });
    });

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

export default JSON2VideoAPI; 