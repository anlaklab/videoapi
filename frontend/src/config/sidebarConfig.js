/**
 * Configuración Centralizada del Sidebar
 * Sistema escalable y data-driven para gestión de assets
 */

export const assetCategories = [
  {
    id: 'all',
    label: 'Todos',
    icon: 'FolderOpen',
    color: '#00d4ff',
    accept: '*',
    extensions: ['*'],
    description: 'Todos los tipos de assets'
  },
  {
    id: 'video',
    label: 'Videos',
    icon: 'Video',
    color: '#ff6b6b',
    accept: 'video/*',
    extensions: ['mp4', 'webm', 'mov', 'avi', 'mkv'],
    description: 'Archivos de video',
    maxSize: 500 * 1024 * 1024, // 500MB
    supportedFormats: ['H.264', 'H.265', 'VP9', 'AV1']
  },
  {
    id: 'audio',
    label: 'Audio',
    icon: 'Music',
    color: '#4ecdc4',
    accept: 'audio/*',
    extensions: ['mp3', 'wav', 'aac', 'ogg', 'flac'],
    description: 'Archivos de audio',
    maxSize: 100 * 1024 * 1024, // 100MB
    supportedFormats: ['MP3', 'WAV', 'AAC', 'OGG']
  },
  {
    id: 'image',
    label: 'Imágenes',
    icon: 'Image',
    color: '#45b7d1',
    accept: 'image/*',
    extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'],
    description: 'Archivos de imagen',
    maxSize: 50 * 1024 * 1024, // 50MB
    supportedFormats: ['JPEG', 'PNG', 'GIF', 'WebP', 'SVG']
  },
  {
    id: 'text',
    label: 'Texto',
    icon: 'Type',
    color: '#96ceb4',
    accept: '.txt,.json,.srt,.vtt',
    extensions: ['txt', 'json', 'srt', 'vtt', 'md'],
    description: 'Archivos de texto y subtítulos',
    maxSize: 10 * 1024 * 1024, // 10MB
    supportedFormats: ['TXT', 'JSON', 'SRT', 'VTT', 'Markdown']
  },
  {
    id: 'font',
    label: 'Fuentes',
    icon: 'FileText',
    color: '#ffeaa7',
    accept: '.ttf,.otf,.woff,.woff2',
    extensions: ['ttf', 'otf', 'woff', 'woff2'],
    description: 'Archivos de fuentes',
    maxSize: 5 * 1024 * 1024, // 5MB
    supportedFormats: ['TTF', 'OTF', 'WOFF', 'WOFF2']
  }
];

export const uploadSettings = {
  maxConcurrentUploads: 5,
  chunkSize: 1024 * 1024, // 1MB chunks
  allowedMimeTypes: [
    // Video
    'video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo',
    // Audio
    'audio/mpeg', 'audio/wav', 'audio/aac', 'audio/ogg',
    // Image
    'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
    // Text
    'text/plain', 'application/json', 'text/vtt',
    // Font
    'font/ttf', 'font/otf', 'font/woff', 'font/woff2'
  ],
  retryAttempts: 3,
  retryDelay: 1000
};

export const assetProcessingRules = {
  video: {
    generateThumbnail: true,
    extractMetadata: true,
    compressionLevel: 'medium',
    thumbnailTime: '10%'
  },
  audio: {
    generateWaveform: true,
    extractMetadata: true,
    normalizeAudio: false
  },
  image: {
    generateThumbnail: true,
    maxDimensions: { width: 4096, height: 4096 },
    compressionQuality: 0.85
  },
  text: {
    parseContent: true,
    validateSyntax: true
  },
  font: {
    generatePreview: true,
    extractMetrics: true
  }
};

// Utilidades para la configuración
export const getCategoryById = (id) => assetCategories.find(cat => cat.id === id);
export const getCategoryByExtension = (extension) => {
  return assetCategories.find(cat => 
    cat.extensions.includes(extension.toLowerCase()) || cat.extensions.includes('*')
  );
};
export const getAcceptedTypes = () => {
  return assetCategories
    .filter(cat => cat.id !== 'all')
    .map(cat => cat.accept)
    .join(',');
}; 