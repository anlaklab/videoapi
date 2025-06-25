/**
 * Render Service - Cloud Rendering API Integration
 * 
 * Handles communication with external rendering services
 * including Shotstack, AWS Elemental, and custom FFmpeg backend
 * following cloud-native patterns.
 */

class RenderService {
  constructor() {
    this.baseURL = process.env.REACT_APP_API_URL || 'http://localhost:5000';
    this.apiKey = process.env.REACT_APP_API_KEY || 'dev-key-12345';
    this.defaultHeaders = {
      'Content-Type': 'application/json',
      'x-api-key': this.apiKey
    };
  }

  /**
   * Render video with advanced effects using Shotstack
   */
  async renderAdvanced(timeline, options = {}) {
    const requestData = {
      timeline,
      transitions: options.transitions || [],
      animations: options.animations || [],
      settings: {
        quality: options.quality || 'high',
        format: options.format || 'mp4',
        resolution: options.resolution || { width: 1920, height: 1080 },
        fps: options.fps || 30,
        ...options.settings
      }
    };

    try {
      const response = await fetch(`${this.baseURL}/api/shotstack/render-advanced`, {
        method: 'POST',
        headers: this.defaultHeaders,
        body: JSON.stringify(requestData)
      });

      if (!response.ok) {
        throw new Error(`Render failed: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Render failed');
      }

      return {
        success: true,
        renderJob: {
          id: result.data.result.filename,
          url: result.data.result.url,
          status: 'completed',
          progress: 100,
          metadata: result.data.metadata,
          effects: result.data.effects
        }
      };
    } catch (error) {
      console.error('Advanced render failed:', error);
      throw new Error(`Render service error: ${error.message}`);
    }
  }

  /**
   * Generate quick preview for timeline
   */
  async renderPreview(timeline, options = {}) {
    const requestData = {
      timeline,
      segment: options.segment || null,
      transitions: (options.transitions || []).slice(0, 3), // Limit for preview
      animations: (options.animations || []).slice(0, 3)   // Limit for preview
    };

    try {
      const response = await fetch(`${this.baseURL}/api/shotstack/preview`, {
        method: 'POST',
        headers: this.defaultHeaders,
        body: JSON.stringify(requestData)
      });

      if (!response.ok) {
        throw new Error(`Preview failed: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Preview failed');
      }

      return {
        success: true,
        preview: {
          url: result.data.result.url,
          filename: result.data.result.filename,
          size: result.data.result.size,
          isPreview: true
        }
      };
    } catch (error) {
      console.error('Preview render failed:', error);
      throw new Error(`Preview service error: ${error.message}`);
    }
  }

  /**
   * Convert timeline format between different services
   */
  async convertTimeline(timeline, targetFormat = 'shotstack') {
    try {
      const response = await fetch(`${this.baseURL}/api/shotstack/convert`, {
        method: 'POST',
        headers: this.defaultHeaders,
        body: JSON.stringify({
          timeline,
          targetFormat
        })
      });

      if (!response.ok) {
        throw new Error(`Conversion failed: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Timeline conversion failed');
      }

      return {
        success: true,
        convertedTimeline: result.data.timeline,
        metadata: result.data.conversion
      };
    } catch (error) {
      console.error('Timeline conversion failed:', error);
      throw new Error(`Conversion service error: ${error.message}`);
    }
  }

  /**
   * Get render job status (for async operations)
   */
  async getRenderStatus(jobId) {
    try {
      const response = await fetch(`${this.baseURL}/api/render/status/${jobId}`, {
        method: 'GET',
        headers: this.defaultHeaders
      });

      if (!response.ok) {
        throw new Error(`Status check failed: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      
      return {
        success: true,
        job: {
          id: jobId,
          status: result.status, // queued, processing, completed, failed
          progress: result.progress || 0,
          url: result.url || null,
          error: result.error || null,
          estimatedTime: result.estimatedTime || null
        }
      };
    } catch (error) {
      console.error('Status check failed:', error);
      throw new Error(`Status service error: ${error.message}`);
    }
  }

  /**
   * Cancel render job
   */
  async cancelRender(jobId) {
    try {
      const response = await fetch(`${this.baseURL}/api/render/cancel/${jobId}`, {
        method: 'POST',
        headers: this.defaultHeaders
      });

      if (!response.ok) {
        throw new Error(`Cancel failed: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      
      return {
        success: result.success,
        message: result.message
      };
    } catch (error) {
      console.error('Cancel render failed:', error);
      throw new Error(`Cancel service error: ${error.message}`);
    }
  }

  /**
   * Batch render multiple timelines
   */
  async batchRender(timelines, options = {}) {
    const batchData = {
      timelines,
      settings: options.settings || {},
      priority: options.priority || 'normal'
    };

    try {
      const response = await fetch(`${this.baseURL}/api/render/batch`, {
        method: 'POST',
        headers: this.defaultHeaders,
        body: JSON.stringify(batchData)
      });

      if (!response.ok) {
        throw new Error(`Batch render failed: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      
      return {
        success: true,
        batchId: result.batchId,
        jobs: result.jobs || []
      };
    } catch (error) {
      console.error('Batch render failed:', error);
      throw new Error(`Batch service error: ${error.message}`);
    }
  }

  /**
   * Get available render templates
   */
  async getTemplates(category = null) {
    try {
      const url = category 
        ? `${this.baseURL}/api/templates?category=${category}`
        : `${this.baseURL}/api/templates`;

      const response = await fetch(url, {
        method: 'GET',
        headers: this.defaultHeaders
      });

      if (!response.ok) {
        throw new Error(`Templates fetch failed: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      
      return {
        success: true,
        templates: result.data || []
      };
    } catch (error) {
      console.error('Templates fetch failed:', error);
      throw new Error(`Templates service error: ${error.message}`);
    }
  }

  /**
   * Render from template with data
   */
  async renderFromTemplate(templateId, data, options = {}) {
    const requestData = {
      templateId,
      data,
      settings: options.settings || {}
    };

    try {
      const response = await fetch(`${this.baseURL}/api/templates/render`, {
        method: 'POST',
        headers: this.defaultHeaders,
        body: JSON.stringify(requestData)
      });

      if (!response.ok) {
        throw new Error(`Template render failed: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Template render failed');
      }

      return {
        success: true,
        renderJob: result.data
      };
    } catch (error) {
      console.error('Template render failed:', error);
      throw new Error(`Template service error: ${error.message}`);
    }
  }

  /**
   * Export timeline to various formats
   */
  async exportTimeline(timeline, format, options = {}) {
    const exportData = {
      timeline,
      format, // 'json', 'fcpxml', 'aaf', 'edl'
      options
    };

    try {
      const response = await fetch(`${this.baseURL}/api/export`, {
        method: 'POST',
        headers: this.defaultHeaders,
        body: JSON.stringify(exportData)
      });

      if (!response.ok) {
        throw new Error(`Export failed: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      
      return {
        success: true,
        exportUrl: result.url,
        filename: result.filename,
        format: result.format
      };
    } catch (error) {
      console.error('Export failed:', error);
      throw new Error(`Export service error: ${error.message}`);
    }
  }

  /**
   * Get render cost estimate
   */
  async getRenderCost(timeline, options = {}) {
    const costData = {
      timeline,
      settings: options.settings || {},
      region: options.region || 'us-east-1'
    };

    try {
      const response = await fetch(`${this.baseURL}/api/render/cost`, {
        method: 'POST',
        headers: this.defaultHeaders,
        body: JSON.stringify(costData)
      });

      if (!response.ok) {
        throw new Error(`Cost estimate failed: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      
      return {
        success: true,
        cost: result.cost,
        currency: result.currency,
        breakdown: result.breakdown,
        estimatedTime: result.estimatedTime
      };
    } catch (error) {
      console.error('Cost estimate failed:', error);
      throw new Error(`Cost service error: ${error.message}`);
    }
  }

  /**
   * Upload and process video assets
   */
  async processAsset(file, options = {}) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('options', JSON.stringify(options));

    try {
      const response = await fetch(`${this.baseURL}/api/assets/process`, {
        method: 'POST',
        headers: {
          'x-api-key': this.apiKey
          // Don't set Content-Type for FormData
        },
        body: formData
      });

      if (!response.ok) {
        throw new Error(`Asset processing failed: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      
      return {
        success: true,
        asset: result.data
      };
    } catch (error) {
      console.error('Asset processing failed:', error);
      throw new Error(`Asset service error: ${error.message}`);
    }
  }

  /**
   * Real-time render progress with WebSocket
   */
  subscribeToRenderProgress(jobId, onProgress, onComplete, onError) {
    const wsUrl = `${this.baseURL.replace('http', 'ws')}/ws/render/${jobId}`;
    const websocket = new WebSocket(wsUrl);

    websocket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        switch (data.type) {
          case 'progress':
            onProgress(data.progress, data.stage);
            break;
          case 'complete':
            onComplete(data.result);
            websocket.close();
            break;
          case 'error':
            onError(new Error(data.error));
            websocket.close();
            break;
        }
      } catch (error) {
        onError(new Error('WebSocket message parse error'));
      }
    };

    websocket.onerror = (error) => {
      onError(new Error('WebSocket connection error'));
    };

    return {
      close: () => websocket.close(),
      readyState: websocket.readyState
    };
  }

  /**
   * Health check for render service
   */
  async healthCheck() {
    try {
      const response = await fetch(`${this.baseURL}/api/render/health`, {
        method: 'GET',
        headers: this.defaultHeaders
      });

      if (!response.ok) {
        throw new Error(`Health check failed: ${response.status}`);
      }

      const result = await response.json();
      
      return {
        success: true,
        status: result.status,
        services: result.services,
        performance: result.performance
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}

// Export singleton instance
export default new RenderService(); 