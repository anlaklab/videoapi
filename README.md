# JSON2VIDEO API - Arquitectura Modular de Renderización de Video

Una API REST modular y escalable para renderización de video construida en Node.js con Express, diseñada para crear videos complejos a partir de definiciones JSON con múltiples pistas, efectos, transiciones y plantillas dinámicas.

## 🚀 Características Principales

### 🎬 Sistema de Timeline Multicapa
- **Múltiples pistas paralelas** con clips secuenciales y superpuestos
- **Z-index y posicionamiento** preciso de elementos
- **Soporte completo de medios**: videos, imágenes, audio, texto y HTML
- **Animaciones y transiciones** con múltiples efectos disponibles

### 🎨 Procesamiento Avanzado
- **Filtros de video**: grayscale, sepia, blur, brightness, contrast, chroma key
- **Efectos de texto**: sombras, contornos, fuentes personalizadas
- **Chroma key configurable** para efectos de pantalla verde
- **Mezcla de audio** con múltiples fuentes y efectos

### 🏗️ Arquitectura Escalable
- **BullMQ + Redis** para procesamiento en cola
- **Workers independientes** para renderizado asíncrono
- **Firebase Storage** para gestión de activos y resultados
- **Rate limiting** y autenticación con API keys

### 📋 Plantillas Dinámicas
- **Merge fields** para personalización automática
- **Sistema de templates** reutilizables
- **Validación de campos** y tipos de datos
- **Import/export** de plantillas

## 📦 Instalación y Configuración

### Prerequisitos
- Node.js 16+ 
- FFmpeg
- Redis (para colas)
- Firebase Account (opcional, para almacenamiento)

### Instalación Rápida

```bash
# Clonar repositorio
git clone <repository-url>
cd json2video-api

# Ejecutar script de configuración
chmod +x scripts/setup.sh
./scripts/setup.sh

# Configurar variables de entorno
cp env.example .env
# Editar .env con tus configuraciones

# Iniciar servidor
npm start

# En otra terminal, iniciar worker
npm run worker
```

### Docker (Recomendado)

```bash
# Construir y ejecutar con Docker Compose
docker-compose up -d

# Ver logs
docker-compose logs -f api
docker-compose logs -f worker
```

## 🔧 Configuración

### Variables de Entorno Principales

```env
# Servidor
PORT=3000
NODE_ENV=development

# Redis (BullMQ)
REDIS_HOST=localhost
REDIS_PORT=6379

# Firebase (opcional)
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----..."
FIREBASE_CLIENT_EMAIL=service-account@project.iam.gserviceaccount.com
FIREBASE_STORAGE_BUCKET=project.appspot.com

# Workers
WORKER_CONCURRENCY=2

# API Keys
DEV_API_KEY=dev-key-12345

# Rate Limiting
RATE_LIMIT_MAX=100
```

## 📚 Uso de la API

### Autenticación

Todas las requests requieren una API key:

```bash
curl -H "x-api-key: dev-key-12345" http://localhost:3000/api/video/formats
```

### Endpoints Principales

#### 🎬 Renderizar Video

```http
POST /api/video/render
Content-Type: application/json
x-api-key: your-api-key

{
  "timeline": {
    "tracks": [
      {
        "clips": [
          {
            "type": "video",
            "src": "https://example.com/video.mp4",
            "start": 0,
            "duration": 10,
            "position": "center",
            "scale": 1.0
          }
        ]
      },
      {
        "clips": [
          {
            "type": "text",
            "content": "¡Hola {NOMBRE}!",
            "start": 2,
            "duration": 3,
            "position": "bottom",
            "fontSize": 48,
            "color": "#FFFFFF"
          }
        ]
      }
    ],
    "soundtrack": {
      "src": "https://example.com/music.mp3",
      "volume": 50
    }
  },
  "output": {
    "format": "mp4",
    "resolution": { "width": 1920, "height": 1080 },
    "quality": "high"
  },
  "merge": {
    "NOMBRE": "Juan"
  },
  "callback": "https://your-site.com/webhook"
}
```

**Respuesta:**
```json
{
  "success": true,
  "videoId": "abc123",
  "status": "enqueued",
  "message": "Video encolado para renderizado",
  "eta": 30,
  "statusUrl": "/api/video/abc123/status",
  "downloadUrl": "/api/video/abc123"
}
```

#### 📊 Consultar Estado

```http
GET /api/video/{videoId}/status
x-api-key: your-api-key
```

**Respuesta:**
```json
{
  "videoId": "abc123",
  "status": "processing",
  "progress": 75,
  "message": "Procesando video... 75%",
  "eta": 8,
  "createdAt": "2024-01-01T12:00:00.000Z"
}
```

#### ⬇️ Descargar Video

```http
GET /api/video/{videoId}
x-api-key: your-api-key
```

Redirige a la URL de Firebase Storage o sirve el archivo directamente.

#### ✅ Validar Timeline

```http
POST /api/video/validate
Content-Type: application/json
x-api-key: your-api-key

{
  "timeline": { ... }
}
```

### 📋 Sistema de Plantillas

#### Crear Template

```http
POST /api/templates
Content-Type: application/json
x-api-key: your-api-key

{
  "name": "Video de Bienvenida",
  "description": "Template para videos de bienvenida personalizados",
  "timeline": {
    "tracks": [
      {
        "clips": [
          {
            "type": "text",
            "content": "Bienvenido {NOMBRE} a {EMPRESA}",
            "start": 0,
            "duration": 5,
            "fontSize": 48
          }
        ]
      }
    ]
  },
  "mergeFields": {
    "NOMBRE": {
      "type": "text",
      "required": true,
      "description": "Nombre del usuario"
    },
    "EMPRESA": {
      "type": "text",
      "required": true,
      "description": "Nombre de la empresa"
    }
  }
}
```

#### Renderizar desde Template

```http
POST /api/templates/{templateId}/render
Content-Type: application/json
x-api-key: your-api-key

{
  "mergeFields": {
    "NOMBRE": "María",
    "EMPRESA": "TechCorp"
  },
  "output": {
    "format": "mp4",
    "quality": "high"
  }
}
```

## 🎨 Ejemplos de Timeline

### Video Básico con Texto

```json
{
  "timeline": {
    "tracks": [
      {
        "clips": [
          {
            "type": "image",
            "src": "https://example.com/background.jpg",
            "start": 0,
            "duration": 10,
            "position": "center",
            "scale": 1.2
          }
        ]
      },
      {
        "clips": [
          {
            "type": "text",
            "content": "Mi Video Increíble",
            "start": 1,
            "duration": 8,
            "position": "center",
            "fontSize": 64,
            "color": "#FFFFFF",
            "shadow": {
              "color": "#000000",
              "offsetX": 2,
              "offsetY": 2,
              "blur": 4
            },
            "animations": [
              {
                "type": "fade-in",
                "duration": 1,
                "easing": "ease-out"
              }
            ]
          }
        ]
      }
    ]
  },
  "output": {
    "format": "mp4",
    "resolution": { "width": 1920, "height": 1080 },
    "fps": 30,
    "quality": "high"
  }
}
```

### Video con Chroma Key

```json
{
  "timeline": {
    "tracks": [
      {
        "clips": [
          {
            "type": "image",
            "src": "https://example.com/background.jpg",
            "start": 0,
            "duration": 15
          }
        ]
      },
      {
        "clips": [
          {
            "type": "video",
            "src": "https://example.com/presenter-greenscreen.mp4",
            "start": 0,
            "duration": 15,
            "position": "right",
            "scale": 0.8,
            "chromaKey": {
              "color": "#00ff00",
              "threshold": 0.1,
              "halo": 0.05
            }
          }
        ]
      }
    ],
    "soundtrack": {
      "src": "https://example.com/background-music.mp3",
      "volume": 30,
      "fadeIn": 2,
      "fadeOut": 2
    }
  }
}
```

## 🔐 Administración

### Panel de Administración

Accede al panel de administración en `/api/admin/dashboard` (requiere permisos de admin).

### Gestión de API Keys

```http
# Listar API keys
GET /api/admin/api-keys

# Crear nueva API key
POST /api/admin/api-keys
{
  "name": "Cliente ABC",
  "clientId": "abc-corp",
  "rateLimit": 500,
  "permissions": ["*"]
}

# Revocar API key
DELETE /api/admin/api-keys/{keyId}
```

### Monitoreo de Cola

```http
# Estadísticas de cola
GET /api/admin/queue/detailed

# Pausar cola
POST /api/admin/queue/pause

# Reanudar cola
POST /api/admin/queue/resume

# Limpiar trabajos antiguos
POST /api/admin/queue/clean
{
  "olderThan": 24
}
```

## 🏗️ Arquitectura

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Client App    │───▶│  Express API    │───▶│   BullMQ/Redis  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │                       │
                                ▼                       ▼
                       ┌─────────────────┐    ┌─────────────────┐
                       │ Firebase Storage│    │     Workers     │
                       └─────────────────┘    └─────────────────┘
                                                       │
                                                       ▼
                                              ┌─────────────────┐
                                              │     FFmpeg      │
                                              └─────────────────┘
```

### Componentes Principales

- **Express API**: Servidor principal que maneja requests HTTP
- **BullMQ + Redis**: Sistema de colas para trabajos asíncronos
- **Workers**: Procesos independientes que renderizan videos
- **Firebase Storage**: Almacenamiento de activos y resultados
- **FFmpeg**: Motor de procesamiento multimedia

## 🚀 Despliegue

### Docker en Producción

```bash
# Configurar variables de entorno de producción
cp env.example .env.production

# Construir y desplegar
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# Escalar workers
docker-compose up -d --scale worker=3
```

### Coolify (Recomendado)

1. Crear nuevo proyecto en Coolify
2. Conectar repositorio Git
3. Configurar variables de entorno
4. Desplegar automáticamente

### Variables de Entorno para Producción

```env
NODE_ENV=production
REDIS_HOST=your-redis-host
FIREBASE_PROJECT_ID=your-project
FIREBASE_PRIVATE_KEY="..."
FIREBASE_CLIENT_EMAIL=service@project.iam.gserviceaccount.com
FIREBASE_STORAGE_BUCKET=project.appspot.com
RATE_LIMIT_MAX=1000
WORKER_CONCURRENCY=4
```

## 📊 Monitoreo y Logs

### Health Check

```http
GET /health
```

### Métricas del Sistema

```http
GET /api/admin/system/info
GET /api/admin/storage/stats
GET /api/admin/queue/detailed
```

### Logs

Los logs se almacenan en:
- `./logs/app.log` - Logs de aplicación
- `./logs/error.log` - Logs de errores
- Docker logs: `docker-compose logs -f api worker`

## 🤝 Contribución

1. Fork el proyecto
2. Crear feature branch (`git checkout -b feature/nueva-funcionalidad`)
3. Commit cambios (`git commit -am 'Agregar nueva funcionalidad'`)
4. Push al branch (`git push origin feature/nueva-funcionalidad`)
5. Crear Pull Request

## 📄 Licencia

MIT License - ver archivo [LICENSE](LICENSE) para detalles.

## 🆘 Soporte

- **Documentación**: Este README y comentarios en código
- **Issues**: Crear issue en GitHub para bugs o feature requests
- **Logs**: Revisar logs de aplicación para debugging

## 🔗 Enlaces Útiles

- [FFmpeg Documentation](https://ffmpeg.org/documentation.html)
- [BullMQ Documentation](https://docs.bullmq.io/)
- [Firebase Admin SDK](https://firebase.google.com/docs/admin/setup)
- [Express.js Guide](https://expressjs.com/guide/)

---

**JSON2VIDEO API** - Transformando JSON en videos increíbles 🎬✨ 