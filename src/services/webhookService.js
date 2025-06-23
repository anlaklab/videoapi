const axios = require('axios');
const crypto = require('crypto');
const logger = require('../utils/logger');

class WebhookService {
  constructor() {
    this.timeout = parseInt(process.env.WEBHOOK_TIMEOUT) || 30000;
    this.maxRetries = parseInt(process.env.WEBHOOK_RETRIES) || 3;
    this.secret = process.env.WEBHOOK_SECRET;
  }

  async sendWebhook(url, payload, options = {}) {
    const {
      retries = this.maxRetries,
      timeout = this.timeout,
      secret = this.secret
    } = options;

    let lastError;

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        logger.info(`Sending webhook (attempt ${attempt}/${retries}): ${url}`);

        const headers = {
          'Content-Type': 'application/json',
          'User-Agent': 'JSON2VIDEO-API-Webhook/1.0',
          'X-Webhook-Timestamp': Date.now().toString(),
          'X-Webhook-Attempt': attempt.toString()
        };

        // Agregar firma si hay secret configurado
        if (secret) {
          const signature = this.generateSignature(payload, secret);
          headers['X-Webhook-Signature'] = signature;
        }

        const response = await axios.post(url, payload, {
          headers,
          timeout,
          validateStatus: (status) => status >= 200 && status < 300
        });

        logger.info(`Webhook sent successfully: ${url}`, {
          status: response.status,
          attempt,
          responseTime: response.headers['x-response-time']
        });

        return {
          success: true,
          status: response.status,
          attempt,
          response: response.data
        };

      } catch (error) {
        lastError = error;
        
        const isRetryable = this.isRetryableError(error);
        const shouldRetry = attempt < retries && isRetryable;

        logger.warn(`Webhook failed (attempt ${attempt}/${retries}): ${url}`, {
          error: error.message,
          status: error.response?.status,
          retryable: isRetryable,
          willRetry: shouldRetry
        });

        if (!shouldRetry) {
          break;
        }

        // Esperar antes del siguiente intento (backoff exponencial)
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 30000);
        await this.sleep(delay);
      }
    }

    // Todos los intentos fallaron
    logger.error(`Webhook failed after ${retries} attempts: ${url}`, {
      error: lastError?.message,
      status: lastError?.response?.status
    });

    return {
      success: false,
      error: lastError?.message || 'Unknown error',
      status: lastError?.response?.status,
      attempts: retries
    };
  }

  generateSignature(payload, secret) {
    const body = typeof payload === 'string' ? payload : JSON.stringify(payload);
    return 'sha256=' + crypto
      .createHmac('sha256', secret)
      .update(body)
      .digest('hex');
  }

  verifySignature(payload, signature, secret) {
    if (!signature || !secret) {
      return false;
    }

    const expectedSignature = this.generateSignature(payload, secret);
    
    // Usar comparación segura para evitar timing attacks
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  }

  isRetryableError(error) {
    // Errores de red o timeouts son reinentables
    if (error.code === 'ECONNREFUSED' || 
        error.code === 'ENOTFOUND' || 
        error.code === 'ETIMEDOUT' ||
        error.code === 'ECONNRESET') {
      return true;
    }

    // Errores HTTP 5xx son reinentables
    if (error.response && error.response.status >= 500) {
      return true;
    }

    // Errores HTTP 429 (rate limit) son reinentables
    if (error.response && error.response.status === 429) {
      return true;
    }

    // Otros errores no son reinentables
    return false;
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Enviar webhook para diferentes eventos
  async sendJobCompleted(url, jobData, result) {
    const payload = {
      event: 'job.completed',
      timestamp: new Date().toISOString(),
      data: {
        jobId: jobData.jobId || jobData.id,
        status: 'completed',
        result,
        completedAt: new Date().toISOString(),
        metadata: {
          clientId: jobData.clientId,
          processingTime: result.processingTime,
          outputSize: result.size
        }
      }
    };

    return await this.sendWebhook(url, payload);
  }

  async sendJobFailed(url, jobData, error) {
    const payload = {
      event: 'job.failed',
      timestamp: new Date().toISOString(),
      data: {
        jobId: jobData.jobId || jobData.id,
        status: 'failed',
        error: {
          message: error.message,
          code: error.code || 'PROCESSING_ERROR'
        },
        failedAt: new Date().toISOString(),
        metadata: {
          clientId: jobData.clientId,
          attempts: jobData.attempts || 1
        }
      }
    };

    return await this.sendWebhook(url, payload);
  }

  async sendJobProgress(url, jobData, progress) {
    const payload = {
      event: 'job.progress',
      timestamp: new Date().toISOString(),
      data: {
        jobId: jobData.jobId || jobData.id,
        status: 'processing',
        progress: {
          percentage: progress,
          stage: this.getProgressStage(progress)
        },
        metadata: {
          clientId: jobData.clientId
        }
      }
    };

    return await this.sendWebhook(url, payload);
  }

  getProgressStage(percentage) {
    if (percentage < 10) return 'initializing';
    if (percentage < 30) return 'downloading_assets';
    if (percentage < 90) return 'processing_video';
    if (percentage < 100) return 'uploading_result';
    return 'completed';
  }

  // Validar URL de webhook
  validateWebhookUrl(url) {
    try {
      const urlObj = new URL(url);
      
      // Solo permitir HTTP y HTTPS
      if (!['http:', 'https:'].includes(urlObj.protocol)) {
        throw new Error('Protocolo no soportado. Solo HTTP y HTTPS están permitidos.');
      }

      // No permitir localhost en producción
      if (process.env.NODE_ENV === 'production') {
        const hostname = urlObj.hostname.toLowerCase();
        if (hostname === 'localhost' || 
            hostname === '127.0.0.1' || 
            hostname.startsWith('192.168.') ||
            hostname.startsWith('10.') ||
            hostname.startsWith('172.')) {
          throw new Error('URLs locales no están permitidas en producción.');
        }
      }

      return true;

    } catch (error) {
      throw new Error(`URL de webhook inválida: ${error.message}`);
    }
  }

  // Probar webhook
  async testWebhook(url, secret) {
    try {
      this.validateWebhookUrl(url);

      const testPayload = {
        event: 'webhook.test',
        timestamp: new Date().toISOString(),
        data: {
          message: 'Este es un webhook de prueba desde JSON2VIDEO API',
          version: '1.0.0'
        }
      };

      const result = await this.sendWebhook(url, testPayload, { 
        secret, 
        retries: 1 
      });

      return {
        success: result.success,
        message: result.success ? 
          'Webhook de prueba enviado exitosamente' : 
          'Webhook de prueba falló',
        details: result
      };

    } catch (error) {
      logger.error('Error testing webhook:', error);
      return {
        success: false,
        message: `Error probando webhook: ${error.message}`,
        details: { error: error.message }
      };
    }
  }

  // Obtener estadísticas de webhooks
  getWebhookStats() {
    // En una implementación real, esto vendría de una base de datos
    // Por ahora devolvemos datos simulados
    return {
      totalSent: 0,
      totalSuccessful: 0,
      totalFailed: 0,
      successRate: 0,
      averageResponseTime: 0,
      lastSent: null
    };
  }

  // Crear payload estándar para eventos
  createEventPayload(event, data, metadata = {}) {
    return {
      event,
      timestamp: new Date().toISOString(),
      data,
      metadata: {
        apiVersion: '1.0.0',
        source: 'json2video-api',
        ...metadata
      }
    };
  }

  // Middleware para validar webhooks entrantes (si la API recibe webhooks)
  createWebhookValidator(secret) {
    return (req, res, next) => {
      try {
        const signature = req.headers['x-webhook-signature'];
        const timestamp = req.headers['x-webhook-timestamp'];
        
        if (!signature) {
          return res.status(401).json({
            success: false,
            error: 'Missing webhook signature'
          });
        }

        // Verificar timestamp (no más de 5 minutos de diferencia)
        if (timestamp) {
          const now = Date.now();
          const webhookTime = parseInt(timestamp);
          const timeDiff = Math.abs(now - webhookTime);
          
          if (timeDiff > 5 * 60 * 1000) { // 5 minutos
            return res.status(401).json({
              success: false,
              error: 'Webhook timestamp too old'
            });
          }
        }

        // Verificar firma
        const isValid = this.verifySignature(req.body, signature, secret);
        
        if (!isValid) {
          return res.status(401).json({
            success: false,
            error: 'Invalid webhook signature'
          });
        }

        next();

      } catch (error) {
        logger.error('Webhook validation error:', error);
        res.status(500).json({
          success: false,
          error: 'Webhook validation failed'
        });
      }
    };
  }
}

module.exports = WebhookService; 