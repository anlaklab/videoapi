const Joi = require('joi');

// Base clip schema with common properties
const baseClipSchema = {
  id: Joi.string().optional(), // Optional ID for clips
  name: Joi.string().optional(), // Optional name for clips
  type: Joi.string().valid('image', 'video', 'text', 'audio', 'html', 'background').required(),
  start: Joi.number().min(0).required(),
  duration: Joi.number().min(0.1).required(),
  position: Joi.object({
    x: Joi.alternatives().try(
      Joi.number(),
      Joi.string().pattern(/^\d+%$/)
    ).default(0),
    y: Joi.alternatives().try(
      Joi.number(),
      Joi.string().pattern(/^\d+%$/)
    ).default(0)
  }).default({ x: 0, y: 0 }),
  scale: Joi.number().min(0.1).max(10).default(1),
  opacity: Joi.number().min(0).max(100).default(100),
  rotation: Joi.number().min(-360).max(360).default(0),
  crop: Joi.object({
    x: Joi.number().min(0).default(0),
    y: Joi.number().min(0).default(0),
    width: Joi.number().min(1),
    height: Joi.number().min(1)
  }).optional(),
  offset: Joi.object({
    x: Joi.number().default(0),
    y: Joi.number().default(0)
  }).default({ x: 0, y: 0 }),
  zIndex: Joi.number().integer().min(0).default(0),
  animations: Joi.array().items(
    Joi.object({
      type: Joi.string().valid(
        'fade-in', 'fade-out', 'fadeIn', 'fadeOut', 'zoom', 'slide', 'slideIn', 'slideOut', 
        'scaleIn', 'scaleOut', 'rotateIn', 'rotateOut', 'typing', 'oscillate', 'wiggle', 
        'auto-scale', 'anchor', 'responsive', 'ease', 'fade', 'resize', 'random', 'slideDown'
      ).required(),
      duration: Joi.number().min(0.1).default(1),
      delay: Joi.number().min(0).default(0),
      direction: Joi.string().valid('left', 'right', 'up', 'down', 'center', 'normal').optional(),
      easing: Joi.string().valid('linear', 'ease-in', 'ease-out', 'ease-in-out', 'easeIn', 'easeOut', 'easeInOut').default('ease-out'),
      iterations: Joi.number().min(1).default(1),
      // Propiedades adicionales para animaciones avanzadas
      property: Joi.string().optional(),
      amplitude: Joi.number().optional(),
      frequency: Joi.number().optional(),
      waveform: Joi.string().valid('sine', 'cosine', 'square', 'triangle').optional(),
      trigger: Joi.string().optional(),
      minScale: Joi.number().optional(),
      maxScale: Joi.number().optional(),
      responsive: Joi.boolean().optional(),
      anchor: Joi.string().optional(),
      fadeIn: Joi.object({
        start: Joi.number(),
        duration: Joi.number()
      }).optional(),
      fadeOut: Joi.object({
        start: Joi.number(),
        duration: Joi.number()
      }).optional(),
      loop: Joi.boolean().optional(),
      values: Joi.array().optional(),
      changeInterval: Joi.number().optional(),
      breakpoints: Joi.object().optional()
    })
  ).default([]),
  // Permitir también animation singular para compatibilidad
  animation: Joi.object({
    type: Joi.string().valid(
      'fade-in', 'fade-out', 'fadeIn', 'fadeOut', 'zoom', 'slide', 'slideIn', 'slideOut', 
      'scaleIn', 'scaleOut', 'rotateIn', 'rotateOut', 'typing', 'oscillate', 'wiggle', 
      'auto-scale', 'anchor', 'responsive', 'ease', 'fade', 'resize', 'random', 'slideDown'
    ).required(),
    duration: Joi.number().min(0.1).default(1),
    delay: Joi.number().min(0).default(0),
    direction: Joi.string().valid('left', 'right', 'up', 'down', 'center', 'normal').optional(),
    easing: Joi.string().valid('linear', 'ease-in', 'ease-out', 'ease-in-out', 'easeIn', 'easeOut', 'easeInOut').default('ease-out'),
    iterations: Joi.number().min(1).default(1),
    // Propiedades adicionales
    property: Joi.string().optional(),
    amplitude: Joi.number().optional(),
    frequency: Joi.number().optional(),
    waveform: Joi.string().optional(),
    trigger: Joi.string().optional(),
    minScale: Joi.number().optional(),
    maxScale: Joi.number().optional(),
    responsive: Joi.boolean().optional()
  }).optional(),
  // Permitir también transition para compatibilidad
  transition: Joi.object({
    type: Joi.string().valid('fade', 'slide', 'wipe', 'dissolve', 'pixelize').required(),
    duration: Joi.number().min(0.1).default(1),
    direction: Joi.string().valid('left', 'right', 'up', 'down').optional(),
    easing: Joi.string().valid('linear', 'ease-in', 'ease-out', 'ease-in-out', 'easeIn', 'easeOut', 'easeInOut').default('ease-out')
  }).optional()
};

// Background clip schema
const backgroundClipSchema = Joi.object({
  ...baseClipSchema,
  type: Joi.string().valid('background').required(),
  color: Joi.string().pattern(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/).required(),
  width: Joi.number().min(1).optional(),
  height: Joi.number().min(1).optional()
});

// Image clip schema
const imageClipSchema = Joi.object({
  ...baseClipSchema,
  type: Joi.string().valid('image').required(),
  src: Joi.string().required(), // Changed from uri() to allow local paths
  fit: Joi.string().valid('cover', 'contain', 'fill', 'inside', 'outside').default('cover'),
  width: Joi.number().min(1).optional(),
  height: Joi.number().min(1).optional()
});

// Video clip schema
const videoClipSchema = Joi.object({
  ...baseClipSchema,
  type: Joi.string().valid('video').required(),
  src: Joi.string().required(), // Changed from uri() to allow local paths
  trim: Joi.object({
    start: Joi.number().min(0).default(0),
    end: Joi.number().min(0).optional()
  }).optional(),
  volume: Joi.number().min(0).max(100).default(100),
  mute: Joi.boolean().default(false),
  loop: Joi.boolean().default(false),
  width: Joi.number().min(1).optional(),
  height: Joi.number().min(1).optional(),
  effects: Joi.array().items(
    Joi.object({
      type: Joi.string().valid('dropShadow', 'glow', 'blur', 'brightness', 'contrast', 'saturation').required(),
      strength: Joi.number().min(0).max(10).default(1),
      color: Joi.string().pattern(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/).optional(),
      offsetX: Joi.number().optional(),
      offsetY: Joi.number().optional(),
      blur: Joi.number().min(0).optional()
    })
  ).optional()
});

// Text clip schema
const textClipSchema = Joi.object({
  ...baseClipSchema,
  type: Joi.string().valid('text').required(),
  text: Joi.string().required(),
  content: Joi.string().optional(), // Alias para compatibilidad
  fontSize: Joi.number().min(8).max(200).default(24),
  fontFamily: Joi.string().default('Arial'),
  color: Joi.string().pattern(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/).default('#FFFFFF'),
  backgroundColor: Joi.string().pattern(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/).optional(),
  font: Joi.string().default('Arial'),
  fontWeight: Joi.string().valid('normal', 'bold', '100', '200', '300', '400', '500', '600', '700', '800', '900').default('normal'),
  textAlign: Joi.string().valid('left', 'center', 'right', 'justify').default('left'),
  lineHeight: Joi.number().min(0.5).max(5).default(1.2),
  letterSpacing: Joi.number().min(-10).max(10).default(0),
  wordWrap: Joi.boolean().default(true),
  maxWidth: Joi.number().min(1).optional(),
  stroke: Joi.object({
    color: Joi.string().pattern(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/),
    width: Joi.number().min(0).max(10).default(0)
  }).optional(),
  shadow: Joi.object({
    color: Joi.string().pattern(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/),
    offsetX: Joi.number().default(2),
    offsetY: Joi.number().default(2),
    blur: Joi.number().min(0).default(4)
  }).optional(),
  // Permitir también un objeto style para compatibilidad con Swagger
  style: Joi.object({
    fontSize: Joi.number().min(8).max(200),
    fontFamily: Joi.string(),
    color: Joi.string().pattern(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/),
    backgroundColor: Joi.string().pattern(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/),
    fontWeight: Joi.string(),
    textAlign: Joi.string().valid('left', 'center', 'right', 'justify'),
    shadow: Joi.object({
      offsetX: Joi.number(),
      offsetY: Joi.number(),
      blur: Joi.number(),
      color: Joi.string().pattern(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/)
    }),
    stroke: Joi.object({
      width: Joi.number(),
      color: Joi.string().pattern(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/)
    })
  }).optional()
});

// Audio clip schema
const audioClipSchema = Joi.object({
  ...baseClipSchema,
  type: Joi.string().valid('audio').required(),
  src: Joi.string().required(), // Changed from uri() to allow local paths
  volume: Joi.number().min(0).max(100).default(100),
  fadeIn: Joi.number().min(0).default(0),
  fadeOut: Joi.number().min(0).default(0),
  loop: Joi.boolean().default(false),
  trim: Joi.object({
    start: Joi.number().min(0).default(0),
    end: Joi.number().min(0).optional()
  }).optional()
});

// HTML clip schema
const htmlClipSchema = Joi.object({
  ...baseClipSchema,
  type: Joi.string().valid('html').required(),
  html: Joi.string().required(),
  src: Joi.string().optional(), // Para URLs de HTML
  css: Joi.string().optional(),
  width: Joi.number().min(1).default(1920),
  height: Joi.number().min(1).default(1080),
  transparent: Joi.boolean().default(true)
});

// Transition schema (defined before trackSchema to avoid reference error)
const transitionSchema = Joi.object({
  type: Joi.string().valid('fade', 'slide', 'wipe', 'crossfade', 'dissolve').required(),
  duration: Joi.number().min(0.1).max(5).default(1),
  direction: Joi.string().valid('left', 'right', 'up', 'down').optional(),
  easing: Joi.string().valid('linear', 'ease-in', 'ease-out', 'ease-in-out').default('ease-out')
});

// Track schema
const trackSchema = Joi.object({
  id: Joi.string().optional(), // Optional ID for tracks
  name: Joi.string().optional(), // Nombre del track
  type: Joi.string().valid('video', 'audio', 'text', 'background').optional(), // Tipo de track
  clips: Joi.array().items(
    Joi.alternatives().try(
      backgroundClipSchema,
      imageClipSchema,
      videoClipSchema,
      textClipSchema,
      audioClipSchema,
      htmlClipSchema
    )
  ).min(1).required(),
  transitions: Joi.array().items(transitionSchema).optional(), // Transiciones específicas del track
  metadata: Joi.object().optional() // Metadatos adicionales
});

// Filter schema
const filterSchema = Joi.object({
  type: Joi.string().valid('grayscale', 'sepia', 'blur', 'brightness', 'contrast', 'saturation', 'hue', 'chromakey').required(),
  intensity: Joi.number().min(0).max(100).default(50),
  // Chroma key specific properties
  color: Joi.string().pattern(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/).when('type', {
    is: 'chromakey',
    then: Joi.required(),
    otherwise: Joi.optional()
  }),
  threshold: Joi.number().min(0).max(100).default(10).when('type', {
    is: 'chromakey',
    then: Joi.required(),
    otherwise: Joi.optional()
  }),
  smoothing: Joi.number().min(0).max(100).default(5).when('type', {
    is: 'chromakey',
    then: Joi.optional(),
    otherwise: Joi.forbidden()
  })
});

// Soundtrack schema
const soundtrackSchema = Joi.object({
  src: Joi.string().required(), // Changed from uri() to allow local paths
  start: Joi.number().min(0).default(0),
  duration: Joi.number().min(0.1).optional(),
  volume: Joi.number().min(0).max(100).default(50),
  fadeIn: Joi.number().min(0).default(0),
  fadeOut: Joi.number().min(0).default(0),
  loop: Joi.boolean().default(false)
});

// Output configuration schema
const outputSchema = Joi.object({
  format: Joi.string().valid('mp4', 'mov', 'webm', 'avi').default('mp4'),
  resolution: Joi.object({
    width: Joi.number().min(1).max(7680).default(1920),
    height: Joi.number().min(1).max(4320).default(1080)
  }).default({ width: 1920, height: 1080 }),
  fps: Joi.number().valid(24, 25, 30, 50, 60).default(30),
  bitrate: Joi.string().pattern(/^\d+[kmKM]?$/).default('2M'),
  quality: Joi.string().valid('low', 'medium', 'high', 'ultra').default('high'),
  codec: Joi.string().valid('libx264', 'libx265', 'libvpx-vp9').default('libx264')
});

// Merge fields schema for templates
const mergeFieldsSchema = Joi.object().pattern(
  Joi.string(),
  Joi.alternatives().try(
    Joi.string(),
    Joi.number(),
    Joi.boolean(),
    Joi.object()
  )
);

// Main timeline schema
const timelineSchema = Joi.object({
  timeline: Joi.object({
    tracks: Joi.array().items(trackSchema).min(1).required(),
    soundtrack: soundtrackSchema.optional(),
    background: Joi.object({
      color: Joi.string().pattern(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/).default('#000000'),
      image: Joi.string().uri().optional()
    }).default({ color: '#000000' }),
    transitions: Joi.array().items(transitionSchema).default([]),
    filters: Joi.array().items(filterSchema).default([])
  }).required(),
  output: outputSchema.default(),
  mergeFields: mergeFieldsSchema.optional(),
  cache: Joi.boolean().default(true),
  webhook: Joi.string().uri().optional()
});

// Template schema
const templateSchema = Joi.object({
  name: Joi.string().required(),
  description: Joi.string().optional(),
  timeline: Joi.object().required(),
  mergeFields: Joi.object().pattern(
    Joi.string(),
    Joi.object({
      type: Joi.string().valid('text', 'image', 'video', 'audio', 'number', 'boolean').required(),
      default: Joi.alternatives().try(Joi.string(), Joi.number(), Joi.boolean()).optional(),
      required: Joi.boolean().default(false),
      description: Joi.string().optional(),
      maxLength: Joi.number().min(1).optional(),
      minLength: Joi.number().min(0).optional(),
      validation: Joi.string().valid('url', 'email', 'color', 'number').optional(),
      min: Joi.number().optional(),
      max: Joi.number().optional(),
      pattern: Joi.string().optional(),
      options: Joi.array().items(Joi.string()).optional()
    })
  ).optional(),
  tags: Joi.array().items(Joi.string()).default([]),
  category: Joi.string().optional()
});

// Video render request schema (completo según especificación)
const validateVideoRequest = Joi.object({
  timeline: Joi.object({
    tracks: Joi.array().items(trackSchema).min(1).required(),
    soundtrack: soundtrackSchema.optional(),
    background: Joi.object({
      color: Joi.string().pattern(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/).default('#000000'),
      image: Joi.string().uri().optional()
    }).default({ color: '#000000' }),
    transitions: Joi.array().items(transitionSchema).default([]),
    filters: Joi.array().items(filterSchema).default([])
  }).required(),
  output: outputSchema.default(),
  merge: mergeFieldsSchema.optional(),
  callback: Joi.string().uri().optional(),
  priority: Joi.string().valid('low', 'normal', 'high', 'urgent').default('normal'),
  cache: Joi.boolean().default(true)
});

// Timeline validation schema (solo timeline)
const validateTimeline = Joi.object({
  timeline: Joi.object({
    tracks: Joi.array().items(trackSchema).min(1).required(),
    soundtrack: soundtrackSchema.optional(),
    background: Joi.object({
      color: Joi.string().pattern(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/).default('#000000'),
      image: Joi.string().uri().optional()
    }).default({ color: '#000000' }),
    transitions: Joi.array().items(transitionSchema).default([]),
    filters: Joi.array().items(filterSchema).default([])
  }).required(),
  output: outputSchema.optional()
});

module.exports = {
  timelineSchema,
  templateSchema,
  validateVideoRequest,
  validateTimeline,
  backgroundClipSchema,
  imageClipSchema,
  videoClipSchema,
  textClipSchema,
  audioClipSchema,
  htmlClipSchema,
  trackSchema,
  transitionSchema,
  filterSchema,
  soundtrackSchema,
  outputSchema,
  mergeFieldsSchema
}; 