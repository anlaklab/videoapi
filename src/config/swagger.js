const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'JSON2VIDEO API',
      version: '1.0.0',
      description: 'API avanzada para convertir JSON en videos con soporte para timeline multi-track, plantillas dinámicas y efectos profesionales.',
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
        Timeline: {
          type: 'object',
          required: ['tracks'],
          properties: {
            tracks: {
              type: 'array',
              items: { $ref: '#/components/schemas/Track' },
              description: 'Array de pistas de video'
            },
            background: {
              $ref: '#/components/schemas/Background'
            },
            soundtrack: {
              $ref: '#/components/schemas/Soundtrack'
            },
            filters: {
              type: 'array',
              items: { $ref: '#/components/schemas/Filter' }
            }
          }
        },
        Track: {
          type: 'object',
          required: ['clips'],
          properties: {
            clips: {
              type: 'array',
              items: { $ref: '#/components/schemas/Clip' }
            }
          }
        },
        Clip: {
          type: 'object',
          required: ['type', 'start', 'duration'],
          properties: {
            type: {
              type: 'string',
              enum: ['image', 'video', 'text', 'html', 'audio'],
              description: 'Tipo de clip'
            },
            start: {
              type: 'number',
              description: 'Tiempo de inicio en segundos'
            },
            duration: {
              type: 'number',
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
            position: {
              $ref: '#/components/schemas/Position'
            },
            scale: {
              type: 'number',
              default: 1,
              description: 'Factor de escala'
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
            }
          }
        },
        Position: {
          type: 'object',
          properties: {
            x: { type: 'number', default: 0 },
            y: { type: 'number', default: 0 }
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
            }
          }
        },
        OutputConfig: {
          type: 'object',
          properties: {
            format: {
              type: 'string',
              enum: ['mp4', 'webm', 'mov', 'avi'],
              default: 'mp4'
            },
            resolution: {
              type: 'object',
              properties: {
                width: { type: 'integer', default: 1920 },
                height: { type: 'integer', default: 1080 }
              }
            },
            fps: {
              type: 'integer',
              default: 30,
              description: 'Frames por segundo'
            },
            bitrate: {
              type: 'string',
              default: '5M',
              description: 'Bitrate del video'
            },
            codec: {
              type: 'string',
              default: 'libx264',
              description: 'Codec de video'
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
              description: 'URL para notificación webhook cuando termine el procesamiento'
            },
            mergeFields: {
              type: 'object',
              description: 'Campos para reemplazar en plantillas'
            }
          }
        },
        JobStatus: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            status: {
              type: 'string',
              enum: ['queued', 'processing', 'completed', 'failed']
            },
            message: { type: 'string' },
            progress: {
              type: 'number',
              minimum: 0,
              maximum: 100
            },
            result: {
              type: 'object',
              properties: {
                url: { type: 'string' },
                filename: { type: 'string' },
                duration: { type: 'number' },
                size: { type: 'number' },
                format: { type: 'string' }
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
            name: { type: 'string' },
            description: { type: 'string' },
            category: { type: 'string' },
            tags: {
              type: 'array',
              items: { type: 'string' }
            },
            timeline: { $ref: '#/components/schemas/Timeline' },
            mergeFields: {
              type: 'object',
              description: 'Definición de campos dinámicos'
            }
          }
        },
        ApiResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            error: { type: 'string' }
          }
        },
        TextStyle: {
          type: 'object',
          properties: {
            fontSize: { type: 'number', default: 48 },
            fontFamily: { type: 'string', default: 'Arial' },
            color: { type: 'string', default: '#ffffff' },
            backgroundColor: { type: 'string' },
            borderColor: { type: 'string' },
            borderWidth: { type: 'number', default: 0 },
            shadow: {
              type: 'object',
              properties: {
                offsetX: { type: 'number', default: 2 },
                offsetY: { type: 'number', default: 2 },
                blur: { type: 'number', default: 4 },
                color: { type: 'string', default: '#000000' }
              }
            },
            stroke: {
              type: 'object',
              properties: {
                width: { type: 'number', default: 0 },
                color: { type: 'string', default: '#000000' }
              }
            }
          }
        },
        Animation: {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              enum: ['fadeIn', 'fadeOut', 'slideIn', 'slideOut', 'scaleIn', 'scaleOut', 'rotateIn', 'rotateOut']
            },
            duration: { type: 'number', default: 1 },
            easing: {
              type: 'string',
              enum: ['linear', 'easeIn', 'easeOut', 'easeInOut'],
              default: 'easeOut'
            },
            delay: { type: 'number', default: 0 }
          }
        },
        Transition: {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              enum: ['fade', 'slide', 'wipe', 'dissolve', 'pixelize']
            },
            duration: { type: 'number', default: 1 },
            direction: {
              type: 'string',
              enum: ['left', 'right', 'up', 'down'],
              default: 'right'
            }
          }
        }
      }
    },
    security: [
      {
        ApiKeyAuth: []
      }
    ]
  },
  apis: ['./src/routes/*.js'], // Rutas donde están los comentarios JSDoc
};

const specs = swaggerJsdoc(options);

module.exports = {
  swaggerUi,
  specs
}; 