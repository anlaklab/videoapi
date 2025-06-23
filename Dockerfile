# JSON2VIDEO API - Dockerfile
FROM node:18-alpine

# Instalar FFmpeg y dependencias del sistema
RUN apk add --no-cache \
    ffmpeg \
    ffmpeg-dev \
    imagemagick \
    imagemagick-dev \
    python3 \
    make \
    g++ \
    cairo-dev \
    jpeg-dev \
    pango-dev \
    musl-dev \
    giflib-dev \
    pixman-dev \
    pangomm-dev \
    libjpeg-turbo-dev \
    freetype-dev

# Crear directorio de la aplicación
WORKDIR /app

# Copiar archivos de configuración de Node.js
COPY package*.json ./

# Instalar dependencias
RUN npm ci --only=production && npm cache clean --force

# Copiar código fuente
COPY . .

# Crear directorios necesarios
RUN mkdir -p temp output assets logs data/templates

# Configurar permisos
RUN chmod +x scripts/setup.sh

# Variables de entorno por defecto
ENV NODE_ENV=production
ENV PORT=3000
ENV TEMP_DIR=/app/temp
ENV OUTPUT_DIR=/app/output
ENV ASSETS_DIR=/app/assets
ENV LOGS_DIR=/app/logs

# Exponer puerto
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Comando por defecto
CMD ["npm", "start"] 