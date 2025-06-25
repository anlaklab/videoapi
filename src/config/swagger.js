const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'JSON2VIDEO API - Clean Architecture',
      version: '2.0.0',
      description: `
# JSON2VIDEO API - Sistema de Procesamiento de Video

## 🎯 API Simplificada y Limpia

Esta API se enfoca en tres funcionalidades principales:

### 🎬 AEP2JSON
Conversión de archivos After Effects (.aep) a templates JSON optimizados
- Análisis profundo de proyectos After Effects
- Extracción de animaciones, efectos y expresiones
- Generación de merge fields automáticos

### 🎥 JSON2MP4  
Renderizado de templates JSON a videos MP4 profesionales
- Procesamiento de timeline multi-track
- Soporte completo para multimedia (video, audio, imágenes, texto)
- Filtros y efectos avanzados con FFmpeg

### 🔐 Auth
Sistema de autenticación con API Keys
- Gestión segura de acceso
- Rate limiting por cliente
- Monitoreo de uso

## 🔑 Autenticación
Todas las rutas requieren el header \`x-api-key\`. 

**En desarrollo usa:** \`dev-key-12345\`
      `,
      contact: {
        name: 'JSON2VIDEO API Support',
        email: 'support@json2video.com'
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT'
      }
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Servidor de desarrollo'
      },
      {
        url: 'https://api.json2video.com',
        description: 'Servidor de producción'
      }
    ],
    tags: [
      {
        name: 'aep2json',
        description: '🎬 Conversión After Effects → Template JSON'
      },
      {
        name: 'json2mp4',
        description: '🎥 Renderizado Template JSON → Video MP4'
      },
      {
        name: 'auth',
        description: '🔐 Autenticación y gestión de API Keys'
      },
      {
        name: 'sistema',
        description: '⚙️ Monitoreo y estadísticas del sistema'
      }
    ],
    components: {
      securitySchemes: {
        ApiKeyAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'x-api-key',
          description: 'API Key para autenticación. En desarrollo usa: dev-key-12345'
        }
      },
      schemas: {
        // Nuevos esquemas para arquitectura modular
        AEAnalysisResult: {
          type: 'object',
          description: 'Resultado del análisis profundo de After Effects',
          properties: {
            composition: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                width: { type: 'number' },
                height: { type: 'number' },
                duration: { type: 'number' },
                frameRate: { type: 'number' },
                backgroundColor: { type: 'string' }
              }
            },
            layers: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  type: { type: 'string', enum: ['text', 'shape', 'image', 'video', 'audio', 'null'] },
                  startTime: { type: 'number' },
                  duration: { type: 'number' },
                  properties: {
                    type: 'object',
                    properties: {
                      position: { type: 'array', items: { type: 'number' } },
                      scale: { type: 'array', items: { type: 'number' } },
                      rotation: { type: 'number' },
                      opacity: { type: 'number' }
                    }
                  },
                  keyframes: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        time: { type: 'number' },
                        property: { type: 'string' },
                        value: { type: 'array', items: { type: 'number' } },
                        easing: { type: 'string' }
                      }
                    }
                  },
                  effects: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        name: { type: 'string' },
                        enabled: { type: 'boolean' },
                        parameters: { type: 'object' }
                      }
                    }
                  },
                  expressions: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        property: { type: 'string' },
                        expression: { type: 'string' },
                        language: { type: 'string', default: 'javascript' }
                      }
                    }
                  }
                }
              }
            },
            assets: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  type: { type: 'string' },
                  path: { type: 'string' },
                  missing: { type: 'boolean' }
                }
              }
            },
            animations: {
              type: 'object',
              properties: {
                movement: { type: 'array', items: { type: 'string' } },
                scale: { type: 'array', items: { type: 'string' } },
                rotation: { type: 'array', items: { type: 'string' } },
                opacity: { type: 'array', items: { type: 'string' } }
              }
            },
            mergeFields: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  type: { type: 'string', enum: ['text', 'image', 'video', 'color'] },
                  defaultValue: { type: 'string' },
                  layer: { type: 'string' }
                }
              }
            }
          }
        },
        
        OptimizedTemplate: {
          type: 'object',
          description: 'Template JSON optimizado generado desde After Effects',
          properties: {
            metadata: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                description: { type: 'string' },
                version: { type: 'string' },
                createdAt: { type: 'string', format: 'date-time' },
                source: { type: 'string', enum: ['after-effects', 'manual'] },
                complexity: { type: 'string', enum: ['simple', 'medium', 'complex'] }
              }
            },
            timeline: { $ref: '#/components/schemas/Timeline' },
            mergeFields: {
              type: 'object',
              additionalProperties: {
                type: 'object',
                properties: {
                  type: { type: 'string' },
                  defaultValue: { type: 'string' },
                  description: { type: 'string' },
                  validation: {
                    type: 'object',
                    properties: {
                      required: { type: 'boolean' },
                      minLength: { type: 'number' },
                      maxLength: { type: 'number' },
                      pattern: { type: 'string' }
                    }
                  }
                }
              }
            },
            stats: {
              type: 'object',
              properties: {
                totalLayers: { type: 'number' },
                totalKeyframes: { type: 'number' },
                totalEffects: { type: 'number' },
                totalExpressions: { type: 'number' },
                estimatedRenderTime: { type: 'number' }
              }
            }
          }
        },

        ProcessingStats: {
          type: 'object',
          description: 'Estadísticas de procesamiento del sistema',
          properties: {
            aeToTemplate: {
              type: 'object',
              properties: {
                totalProcessed: { type: 'number' },
                averageProcessingTime: { type: 'number' },
                successRate: { type: 'number' },
                lastProcessed: { type: 'string', format: 'date-time' }
              }
            },
            templateToVideo: {
              type: 'object',
              properties: {
                totalRendered: { type: 'number' },
                averageRenderTime: { type: 'number' },
                successRate: { type: 'number' },
                lastRendered: { type: 'string', format: 'date-time' }
              }
            },
            system: {
              type: 'object',
              properties: {
                uptime: { type: 'number' },
                memoryUsage: { type: 'object' },
                ffmpegVersion: { type: 'string' },
                activeJobs: { type: 'number' }
              }
            }
          }
        },

        HealthCheck: {
          type: 'object',
          description: 'Estado de salud del sistema',
          properties: {
            status: { type: 'string', enum: ['healthy', 'degraded', 'unhealthy'] },
            timestamp: { type: 'string', format: 'date-time' },
            services: {
              type: 'object',
              properties: {
                ffmpeg: {
                  type: 'object',
                  properties: {
                    available: { type: 'boolean' },
                    version: { type: 'string' },
                    path: { type: 'string' }
                  }
                },
                afterEffects: {
                  type: 'object',
                  properties: {
                    available: { type: 'boolean' },
                    method: { type: 'string', enum: ['ae-to-json', 'after-effects', 'extendscript', 'binary'] }
                  }
                },
                storage: {
                  type: 'object',
                  properties: {
                    available: { type: 'boolean' },
                    freeSpace: { type: 'number' },
                    totalSpace: { type: 'number' }
                  }
                }
              }
            },
            checks: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  status: { type: 'string', enum: ['pass', 'fail', 'warn'] },
                  message: { type: 'string' },
                  duration: { type: 'number' }
                }
              }
            }
          }
        },

        // Esquemas existentes mejorados
        Timeline: {
          type: 'object',
          required: ['tracks'],
          description: 'Timeline multi-track para composición de video',
          properties: {
            tracks: {
              type: 'array',
              items: { $ref: '#/components/schemas/Track' },
              description: 'Array de pistas de video ordenadas por z-index'
            },
            background: {
              $ref: '#/components/schemas/Background'
            },
            soundtrack: {
              $ref: '#/components/schemas/Soundtrack'
            },
            filters: {
              type: 'array',
              items: { $ref: '#/components/schemas/Filter' },
              description: 'Filtros globales aplicados a todo el video'
            },
            duration: {
              type: 'number',
              description: 'Duración total del timeline en segundos'
            },
            fps: {
              type: 'number',
              default: 30,
              description: 'Frames por segundo del timeline'
            }
          }
        },

        Track: {
          type: 'object',
          required: ['clips'],
          description: 'Pista individual del timeline',
          properties: {
            clips: {
              type: 'array',
              items: { $ref: '#/components/schemas/Clip' },
              description: 'Clips ordenados cronológicamente en esta pista'
            },
            name: {
              type: 'string',
              description: 'Nombre descriptivo de la pista'
            },
            muted: {
              type: 'boolean',
              default: false,
              description: 'Si la pista está silenciada'
            },
            volume: {
              type: 'number',
              minimum: 0,
              maximum: 100,
              default: 100,
              description: 'Volumen de la pista'
            }
          }
        },

        Clip: {
          type: 'object',
          required: ['type', 'start', 'duration'],
          description: 'Elemento individual en una pista',
          properties: {
            type: {
              type: 'string',
              enum: ['image', 'video', 'text', 'html', 'audio', 'background', 'shape'],
              description: 'Tipo de clip'
            },
            start: {
              type: 'number',
              minimum: 0,
              description: 'Tiempo de inicio en segundos'
            },
            duration: {
              type: 'number',
              minimum: 0.1,
              description: 'Duración en segundos'
            },
            src: {
              type: 'string',
              description: 'URL del recurso (para image, video, audio)'
            },
            text: {
              type: 'string',
              description: 'Texto a renderizar (para type: text)'
            },
            html: {
              type: 'string',
              description: 'HTML a renderizar (para type: html)'
            },
            color: {
              type: 'string',
              description: 'Color para clips de background o shape'
            },
            position: {
              oneOf: [
                { $ref: '#/components/schemas/Position' },
                { 
                  type: 'string',
                  enum: ['center', 'top', 'bottom', 'left', 'right', 'top-left', 'top-right', 'bottom-left', 'bottom-right'],
                  description: 'Posición predefinida'
                }
              ]
            },
            scale: {
              type: 'number',
              default: 1,
              description: 'Factor de escala (1 = tamaño original)'
            },
            opacity: {
              type: 'number',
              minimum: 0,
              maximum: 100,
              default: 100,
              description: 'Opacidad en porcentaje'
            },
            rotation: {
              type: 'number',
              default: 0,
              description: 'Rotación en grados'
            },
            zIndex: {
              type: 'integer',
              default: 1,
              description: 'Índice de profundidad para layering'
            },
            style: {
              $ref: '#/components/schemas/TextStyle',
              description: 'Estilo para clips de texto'
            },
            animation: {
              $ref: '#/components/schemas/Animation',
              description: 'Animación de entrada/salida'
            },
            transition: {
              $ref: '#/components/schemas/Transition',
              description: 'Transición entre clips'
            },
            trim: {
              type: 'object',
              properties: {
                start: { type: 'number', description: 'Tiempo de inicio del recorte' },
                end: { type: 'number', description: 'Tiempo de fin del recorte' }
              },
              description: 'Recorte para clips de video/audio'
            },
            volume: {
              type: 'number',
              minimum: 0,
              maximum: 100,
              default: 100,
              description: 'Volumen para clips de audio'
            },
            filter: {
              type: 'string',
              enum: ['grayscale', 'sepia', 'blur', 'brightness', 'contrast'],
              description: 'Filtro aplicado al clip'
            },
            chromaKey: {
              type: 'object',
              properties: {
                color: { type: 'string', default: '#00ff00' },
                threshold: { type: 'number', default: 0.1 },
                halo: { type: 'number', default: 0.1 }
              },
              description: 'Configuración de chroma key'
            }
          }
        },

        Position: {
          type: 'object',
          properties: {
            x: { type: 'number', default: 0, description: 'Posición X en píxeles' },
            y: { type: 'number', default: 0, description: 'Posición Y en píxeles' }
          }
        },

        Background: {
          type: 'object',
          properties: {
            color: {
              type: 'string',
              default: '#000000',
              description: 'Color de fondo en formato hex'
            },
            image: {
              type: 'string',
              description: 'URL de imagen de fondo'
            },
            video: {
              type: 'string',
              description: 'URL de video de fondo'
            }
          }
        },

        Soundtrack: {
          type: 'object',
          required: ['src'],
          properties: {
            src: {
              type: 'string',
              description: 'URL del archivo de audio'
            },
            volume: {
              type: 'number',
              minimum: 0,
              maximum: 100,
              default: 50,
              description: 'Volumen en porcentaje'
            },
            fadeIn: {
              type: 'number',
              default: 0,
              description: 'Fade in en segundos'
            },
            fadeOut: {
              type: 'number',
              default: 0,
              description: 'Fade out en segundos'
            },
            loop: {
              type: 'boolean',
              default: false,
              description: 'Si el audio debe repetirse'
            }
          }
        },

        Filter: {
          type: 'object',
          required: ['type'],
          properties: {
            type: {
              type: 'string',
              enum: ['grayscale', 'sepia', 'blur', 'brightness', 'contrast', 'saturation', 'hue', 'chromakey']
            },
            value: {
              type: 'number',
              description: 'Valor del filtro (depende del tipo)'
            },
            target: {
              type: 'string',
              enum: ['all', 'video', 'image'],
              default: 'all',
              description: 'Tipo de clips afectados'
            }
          }
        },

        OutputConfig: {
          type: 'object',
          description: 'Configuración de salida del video',
          properties: {
            format: {
              type: 'string',
              enum: ['mp4', 'webm', 'mov', 'avi', 'mkv'],
              default: 'mp4',
              description: 'Formato de video de salida'
            },
            resolution: {
              type: 'object',
              properties: {
                width: { type: 'integer', default: 1920 },
                height: { type: 'integer', default: 1080 }
              },
              description: 'Resolución del video'
            },
            fps: {
              type: 'integer',
              default: 30,
              minimum: 1,
              maximum: 60,
              description: 'Frames por segundo'
            },
            bitrate: {
              type: 'string',
              default: '5M',
              description: 'Bitrate del video (ej: 5M, 2000k)'
            },
            codec: {
              type: 'string',
              default: 'libx264',
              enum: ['libx264', 'libx265', 'libvpx', 'libvpx-vp9'],
              description: 'Codec de video'
            },
            quality: {
              type: 'string',
              enum: ['low', 'medium', 'high', 'ultra'],
              default: 'high',
              description: 'Calidad preestablecida'
            }
          }
        },

        VideoRenderRequest: {
          type: 'object',
          required: ['timeline'],
          properties: {
            timeline: { $ref: '#/components/schemas/Timeline' },
            output: { $ref: '#/components/schemas/OutputConfig' },
            webhook: {
              type: 'string',
              format: 'uri',
              description: 'URL para notificación webhook cuando termine el procesamiento'
            },
            mergeFields: {
              type: 'object',
              additionalProperties: { type: 'string' },
              description: 'Campos para reemplazar en plantillas (formato: {"campo": "valor"})'
            }
          }
        },

        JobStatus: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'ID único del trabajo' },
            status: {
              type: 'string',
              enum: ['queued', 'processing', 'completed', 'failed'],
              description: 'Estado actual del trabajo'
            },
            message: { type: 'string', description: 'Mensaje descriptivo del estado' },
            progress: {
              type: 'number',
              minimum: 0,
              maximum: 100,
              description: 'Progreso en porcentaje'
            },
            result: {
              type: 'object',
              properties: {
                url: { type: 'string', description: 'URL del video generado' },
                filename: { type: 'string', description: 'Nombre del archivo' },
                duration: { type: 'number', description: 'Duración en segundos' },
                size: { type: 'number', description: 'Tamaño en bytes' },
                format: { type: 'string', description: 'Formato del video' },
                resolution: {
                  type: 'object',
                  properties: {
                    width: { type: 'number' },
                    height: { type: 'number' }
                  }
                }
              }
            },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' }
          }
        },

        Template: {
          type: 'object',
          required: ['name', 'timeline'],
          properties: {
            name: { type: 'string', description: 'Nombre del template' },
            description: { type: 'string', description: 'Descripción del template' },
            category: { 
              type: 'string',
              enum: ['social', 'marketing', 'presentation', 'education', 'entertainment'],
              description: 'Categoría del template'
            },
            tags: {
              type: 'array',
              items: { type: 'string' },
              description: 'Tags para búsqueda y categorización'
            },
            timeline: { $ref: '#/components/schemas/Timeline' },
            mergeFields: {
              type: 'object',
              additionalProperties: {
                type: 'object',
                properties: {
                  type: { type: 'string' },
                  defaultValue: { type: 'string' },
                  description: { type: 'string' }
                }
              },
              description: 'Definición de campos dinámicos'
            },
            thumbnail: {
              type: 'string',
              description: 'URL de imagen de vista previa'
            },
            duration: {
              type: 'number',
              description: 'Duración estimada en segundos'
            }
          }
        },

        ApiResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            data: { type: 'object' },
            error: { type: 'string' },
            timestamp: { type: 'string', format: 'date-time' }
          }
        },

        TextStyle: {
          type: 'object',
          description: 'Estilo de texto avanzado',
          properties: {
            fontSize: { type: 'number', default: 48, description: 'Tamaño de fuente en píxeles' },
            fontFamily: { 
              type: 'string', 
              default: 'Arial',
              enum: ['Arial', 'Helvetica', 'Times New Roman', 'Courier New', 'Verdana', 'Georgia', 'Comic Sans MS'],
              description: 'Familia de fuente'
            },
            color: { type: 'string', default: '#ffffff', description: 'Color del texto en hex' },
            backgroundColor: { type: 'string', description: 'Color de fondo del texto' },
            borderColor: { type: 'string', description: 'Color del borde' },
            borderWidth: { type: 'number', default: 0, description: 'Ancho del borde en píxeles' },
            textAlign: {
              type: 'string',
              enum: ['left', 'center', 'right', 'justify'],
              default: 'left',
              description: 'Alineación del texto'
            },
            fontWeight: {
              type: 'string',
              enum: ['normal', 'bold', '100', '200', '300', '400', '500', '600', '700', '800', '900'],
              default: 'normal',
              description: 'Peso de la fuente'
            },
            fontStyle: {
              type: 'string',
              enum: ['normal', 'italic', 'oblique'],
              default: 'normal',
              description: 'Estilo de la fuente'
            },
            shadow: {
              type: 'object',
              properties: {
                offsetX: { type: 'number', default: 2 },
                offsetY: { type: 'number', default: 2 },
                blur: { type: 'number', default: 4 },
                color: { type: 'string', default: '#000000' }
              },
              description: 'Configuración de sombra'
            },
            stroke: {
              type: 'object',
              properties: {
                width: { type: 'number', default: 0 },
                color: { type: 'string', default: '#000000' }
              },
              description: 'Configuración de contorno'
            }
          }
        },

        Animation: {
          type: 'object',
          description: 'Configuración de animación',
          properties: {
            type: {
              type: 'string',
              enum: ['fadeIn', 'fadeOut', 'slideIn', 'slideOut', 'scaleIn', 'scaleOut', 'rotateIn', 'rotateOut', 'bounceIn', 'bounceOut'],
              description: 'Tipo de animación'
            },
            duration: { 
              type: 'number', 
              default: 1,
              minimum: 0.1,
              maximum: 10,
              description: 'Duración de la animación en segundos'
            },
            easing: {
              type: 'string',
              enum: ['linear', 'easeIn', 'easeOut', 'easeInOut', 'easeInBack', 'easeOutBack'],
              default: 'easeOut',
              description: 'Función de easing'
            },
            delay: { 
              type: 'number', 
              default: 0,
              minimum: 0,
              description: 'Retraso antes de iniciar la animación'
            },
            direction: {
              type: 'string',
              enum: ['left', 'right', 'up', 'down'],
              description: 'Dirección para animaciones de slide'
            }
          }
        },

        Transition: {
          type: 'object',
          description: 'Configuración de transición entre clips',
          properties: {
            type: {
              type: 'string',
              enum: ['fade', 'slide', 'wipe', 'dissolve', 'pixelize', 'zoom', 'rotate'],
              description: 'Tipo de transición'
            },
            duration: { 
              type: 'number', 
              default: 1,
              minimum: 0.1,
              maximum: 5,
              description: 'Duración de la transición en segundos'
            },
            direction: {
              type: 'string',
              enum: ['left', 'right', 'up', 'down'],
              default: 'right',
              description: 'Dirección de la transición'
            },
            easing: {
              type: 'string',
              enum: ['linear', 'easeIn', 'easeOut', 'easeInOut'],
              default: 'easeInOut',
              description: 'Función de easing para la transición'
            }
          }
        }
      }
    }
  },
  apis: [
    './src/api/mainRoutes.js',
    './src/server.js'
  ]
};

const specs = swaggerJsdoc(options);

module.exports = {
  swaggerUi,
  specs
}; 