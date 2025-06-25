/**
 * Asset Manager - Gestión completa de assets multimedia
 * 
 * Funcionalidades:
 * - Gestión de videos, imágenes, audio y fuentes
 * - Generación de thumbnails
 * - Metadatos y análisis de archivos
 * - Cache de assets
 * - Integración con el backend
 */

import { ref, uploadBytesResumable, getDownloadURL, deleteObject, listAll } from 'firebase/storage';
import { collection, addDoc, updateDoc, deleteDoc, doc, getDocs, query, where, orderBy } from 'firebase/firestore';
import { storage, db } from '../config/firebase';
import { getSampleAssets, getAssetsByCategory, searchAssets, loadAdditionalAssets } from '../data/sampleAssets';

class AssetManager {
  constructor() {
    this.cache = new Map();
    this.loadingStates = new Map();
    this.thumbnailCache = new Map();
    this.initialized = false;
    this.supportedFormats = {
      video: ['.mp4', '.mov', '.avi', '.webm', '.mkv'],
      image: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'],
      audio: ['.mp3', '.wav', '.aac', '.ogg', '.m4a'],
      font: ['.ttf', '.otf', '.woff', '.woff2']
    };
    this.uploadTasks = new Map();
    this.listeners = new Set();
  }

  /**
   * Subscribe to asset manager events
   */
  subscribe(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  /**
   * Emit events to listeners
   */
  emit(event, data) {
    this.listeners.forEach(listener => listener(event, data));
  }

  /**
   * Initialize with essential assets only (fast loading)
   */
  async initialize() {
    if (this.initialized) return;
    
    try {
      console.log('🚀 AssetManager: Initializing with essential assets...');
      const startTime = performance.now();
      
      // Load only essential assets first
      const essentialAssets = await getSampleAssets(false);
      
      // Cache essential assets
      this.cache.set('essential', essentialAssets);
      this.initialized = true;
      
      const loadTime = performance.now() - startTime;
      console.log(`✅ AssetManager: Essential assets loaded in ${loadTime.toFixed(2)}ms`);
      
      // Start loading additional assets in background
      this.loadAdditionalAssetsInBackground();
      
      return essentialAssets;
    } catch (error) {
      console.error('❌ AssetManager: Failed to initialize:', error);
      throw error;
    }
  }

  /**
   * Load additional assets in background
   */
  async loadAdditionalAssetsInBackground() {
    try {
      console.log('🔄 AssetManager: Loading additional assets in background...');
      await loadAdditionalAssets();
      
      const allAssets = await getSampleAssets(true);
      this.cache.set('all', allAssets);
      
      console.log('✅ AssetManager: Additional assets loaded');
    } catch (error) {
      console.warn('⚠️ AssetManager: Failed to load additional assets:', error);
    }
  }

  /**
   * Get all assets (with lazy loading)
   */
  async getAllAssets(forceReload = false) {
    const cacheKey = 'all';
    
    if (!forceReload && this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    try {
      console.log('📦 AssetManager: Loading all assets...');
      const assets = await getSampleAssets(true);
      
      // Process assets for better performance
      const processedAssets = this.processAssets(assets);
      
      this.cache.set(cacheKey, processedAssets);
      return processedAssets;
    } catch (error) {
      console.error('❌ AssetManager: Failed to load assets:', error);
      
      // Fallback to essential assets
      if (this.cache.has('essential')) {
        console.log('🔄 AssetManager: Falling back to essential assets');
        return this.cache.get('essential');
      }
      
      throw error;
    }
  }

  /**
   * Get assets by category with caching
   */
  async getAssetsByCategory(category) {
    const cacheKey = `category_${category}`;
    
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    try {
      const assets = await getAssetsByCategory(category, true);
      const processedAssets = assets.map(asset => this.processAsset(asset));
      
      this.cache.set(cacheKey, processedAssets);
      return processedAssets;
    } catch (error) {
      console.error(`❌ AssetManager: Failed to load category ${category}:`, error);
      return [];
    }
  }

  /**
   * Search assets with caching
   */
  async searchAssets(query) {
    if (!query || query.trim() === '') {
      return this.getAllAssets();
    }

    const cacheKey = `search_${query.toLowerCase()}`;
    
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    try {
      const assets = await searchAssets(query, true);
      const processedAssets = assets.map(asset => this.processAsset(asset));
      
      this.cache.set(cacheKey, processedAssets);
      return processedAssets;
    } catch (error) {
      console.error('❌ AssetManager: Search failed:', error);
      return [];
    }
  }

  /**
   * Process assets for better performance and error handling
   */
  processAssets(assetsObject) {
    const processed = {};
    
    for (const [category, assets] of Object.entries(assetsObject)) {
      processed[category] = assets.map(asset => this.processAsset(asset));
    }
    
    return processed;
  }

  /**
   * Process individual asset
   */
  processAsset(asset) {
    return {
      ...asset,
      // Ensure required properties exist
      id: asset.id || `asset-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: asset.name || 'Unnamed Asset',
      type: asset.type || 'unknown',
      url: asset.url || asset.src || '',
      thumbnail: asset.thumbnail || asset.url || asset.src || '',
      duration: asset.duration || (asset.type === 'image' ? 5 : 10),
      size: asset.size || 0,
      category: asset.category || asset.type || 'other',
      tags: asset.tags || [],
      
      // Add metadata for better handling
      loadTime: Date.now(),
      processed: true
    };
  }

  /**
   * Generate thumbnail for asset (with caching)
   */
  async generateThumbnail(asset) {
    if (this.thumbnailCache.has(asset.id)) {
      return this.thumbnailCache.get(asset.id);
    }

    try {
      let thumbnailUrl = asset.thumbnail || asset.url;

      // For video assets, we might want to generate actual thumbnails
      if (asset.type === 'video' && asset.url && !asset.thumbnail) {
        // For now, use a placeholder or the video URL itself
        thumbnailUrl = asset.url;
      }

      const thumbnail = {
        url: thumbnailUrl,
        width: 300,
        height: 200,
        generated: true
      };

      this.thumbnailCache.set(asset.id, thumbnail);
      return thumbnail;
    } catch (error) {
      console.warn('⚠️ AssetManager: Failed to generate thumbnail for', asset.id, error);
      
      // Return default thumbnail
      return {
        url: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDMwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIzMDAiIGhlaWdodD0iMjAwIiBmaWxsPSIjMzMzIi8+Cjx0ZXh0IHg9IjE1MCIgeT0iMTAwIiBmaWxsPSIjNjY2IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+Tm8gSW1hZ2U8L3RleHQ+Cjwvc3ZnPg==',
        width: 300,
        height: 200,
        generated: false
      };
    }
  }

  /**
   * Get asset metadata
   */
  async getAssetMetadata(assetId) {
    try {
      const allAssets = await this.getAllAssets();
      const flatAssets = Object.values(allAssets).flat();
      const asset = flatAssets.find(a => a.id === assetId);
      
      if (!asset) {
        throw new Error(`Asset ${assetId} not found`);
      }

      return {
        ...asset,
        thumbnail: await this.generateThumbnail(asset)
      };
    } catch (error) {
      console.error('❌ AssetManager: Failed to get metadata for', assetId, error);
      throw error;
    }
  }

  /**
   * Clear cache (useful for testing or memory management)
   */
  clearCache() {
    this.cache.clear();
    this.thumbnailCache.clear();
    console.log('🧹 AssetManager: Cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      cacheSize: this.cache.size,
      thumbnailCacheSize: this.thumbnailCache.size,
      cacheKeys: Array.from(this.cache.keys()),
      initialized: this.initialized
    };
  }

  /**
   * Preload assets for better UX
   */
  async preloadAssets(assetIds) {
    const loadPromises = assetIds.map(async (id) => {
      try {
        await this.getAssetMetadata(id);
      } catch (error) {
        console.warn('⚠️ AssetManager: Failed to preload asset', id, error);
      }
    });

    await Promise.allSettled(loadPromises);
  }

  /**
   * Cargar assets desde el servidor
   */
  async loadAssets() {
    try {
      const response = await fetch('/api/assets/list', {
        headers: {
          'x-api-key': 'dev-key-12345'
        }
      });

      if (!response.ok) {
        throw new Error(`Error loading assets: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.success) {
        return this.processAssetList(result.data);
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('❌ Error cargando assets:', error);
      return this.getDefaultAssets();
    }
  }

  /**
   * Procesar lista de assets del servidor
   */
  processAssetList(assets) {
    const categorized = {
      videos: [],
      images: [],
      audio: [],
      fonts: []
    };

    assets.forEach(asset => {
      const category = this.getAssetCategory(asset.name);
      if (category && categorized[category]) {
        categorized[category].push({
          id: asset.id || `asset-${Date.now()}-${Math.random()}`,
          name: asset.name,
          path: asset.path,
          size: asset.size,
          duration: asset.duration,
          metadata: asset.metadata || {},
          thumbnail: asset.thumbnail,
          lastModified: asset.lastModified
        });
      }
    });

    return categorized;
  }

  /**
   * Obtener categoría de asset por extensión
   */
  getAssetCategory(filename) {
    const ext = '.' + filename.split('.').pop().toLowerCase();
    
    for (const [category, extensions] of Object.entries(this.supportedFormats)) {
      if (extensions.includes(ext)) {
        return category + 's'; // pluralizar
      }
    }
    
    return null;
  }

  /**
   * Assets por defecto (fallback)
   */
  getDefaultAssets() {
    return {
      videos: [
        {
          id: 'v1',
          name: 'test-video.mp4',
          path: '/assets/videos/test-video.mp4',
          duration: 10,
          metadata: { resolution: '1920x1080', fps: 30 },
          thumbnail: null
        },
        {
          id: 'v2',
          name: 'background-gradient.mp4',
          path: '/assets/unsplash/videos/background-gradient.mp4',
          duration: 15,
          metadata: { resolution: '1920x1080', fps: 30 },
          thumbnail: null
        },
        {
          id: 'v3',
          name: 'particle-wave.mp4',
          path: '/assets/unsplash/videos/particle-wave.mp4',
          duration: 12,
          metadata: { resolution: '1920x1080', fps: 30 },
          thumbnail: null
        }
      ],
      images: [
        {
          id: 'i1',
          name: 'test-image.jpg',
          path: '/assets/images/test-image.jpg',
          metadata: { resolution: '1920x1080' },
          thumbnail: '/assets/images/test-image.jpg'
        },
        {
          id: 'i2',
          name: 'city-skyline.jpg',
          path: '/assets/unsplash/images/city-skyline.jpg',
          metadata: { resolution: '1920x1080' },
          thumbnail: '/assets/unsplash/images/city-skyline.jpg'
        },
        {
          id: 'i3',
          name: 'forest-path.jpg',
          path: '/assets/unsplash/images/forest-path.jpg',
          metadata: { resolution: '1920x1080' },
          thumbnail: '/assets/unsplash/images/forest-path.jpg'
        },
        {
          id: 'i4',
          name: 'mountain-landscape.jpg',
          path: '/assets/unsplash/images/mountain-landscape.jpg',
          metadata: { resolution: '1920x1080' },
          thumbnail: '/assets/unsplash/images/mountain-landscape.jpg'
        },
        {
          id: 'i5',
          name: 'nature-scene.jpg',
          path: '/assets/unsplash/images/nature-scene.jpg',
          metadata: { resolution: '1920x1080' },
          thumbnail: '/assets/unsplash/images/nature-scene.jpg'
        },
        {
          id: 'i6',
          name: 'ocean-waves.jpg',
          path: '/assets/unsplash/images/ocean-waves.jpg',
          metadata: { resolution: '1920x1080' },
          thumbnail: '/assets/unsplash/images/ocean-waves.jpg'
        }
      ],
      audio: [
        {
          id: 'a1',
          name: 'test-music.mp3',
          path: '/assets/audio/test-music.mp3',
          duration: 120,
          metadata: { bitrate: '320kbps', channels: 2 }
        },
        {
          id: 'a2',
          name: 'ambient-music.mp3',
          path: '/assets/unsplash/audio/ambient-music.mp3',
          duration: 180,
          metadata: { bitrate: '320kbps', channels: 2 }
        }
      ],
      fonts: [
        {
          id: 'f1',
          name: 'Arial',
          path: 'Arial',
          metadata: { type: 'system', weight: 'normal' }
        },
        {
          id: 'f2',
          name: 'Helvetica',
          path: 'Helvetica',
          metadata: { type: 'system', weight: 'normal' }
        },
        {
          id: 'f3',
          name: 'Georgia',
          path: 'Georgia',
          metadata: { type: 'system', weight: 'normal' }
        },
        {
          id: 'f4',
          name: 'Times New Roman',
          path: 'Times New Roman',
          metadata: { type: 'system', weight: 'normal' }
        }
      ]
    };
  }

  /**
   * Generar thumbnail para video
   */
  async generateVideoThumbnail(videoPath) {
    if (this.thumbnailCache.has(videoPath)) {
      return this.thumbnailCache.get(videoPath);
    }

    try {
      const response = await fetch('/api/assets/thumbnail', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'dev-key-12345'
        },
        body: JSON.stringify({
          assetPath: videoPath,
          type: 'video',
          timestamp: 1 // segundo 1
        })
      });

      if (response.ok) {
        const result = await response.json();
        const thumbnailUrl = result.data.thumbnailUrl;
        this.thumbnailCache.set(videoPath, thumbnailUrl);
        return thumbnailUrl;
      }
    } catch (error) {
      console.error('Error generando thumbnail:', error);
    }

    return null;
  }

  /**
   * Obtener metadatos de asset
   */
  async getAssetMetadata(assetPath) {
    if (this.cache.has(assetPath)) {
      return this.cache.get(assetPath);
    }

    try {
      const response = await fetch('/api/assets/metadata', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'dev-key-12345'
        },
        body: JSON.stringify({ assetPath })
      });

      if (response.ok) {
        const result = await response.json();
        this.cache.set(assetPath, result.data);
        return result.data;
      }
    } catch (error) {
      console.error('Error obteniendo metadatos:', error);
    }

    return {};
  }

  /**
   * Subir nuevo asset
   */
  async uploadAsset(file, options = {}) {
    const {
      folder = 'assets',
      generateThumbnail = true,
      extractMetadata = true,
      onProgress = null
    } = options;

    try {
      // Generate unique filename
      const timestamp = Date.now();
      const randomId = Math.random().toString(36).substr(2, 9);
      const extension = file.name.split('.').pop();
      const filename = `${timestamp}-${randomId}.${extension}`;
      const storagePath = `${folder}/${filename}`;

      // Create storage reference
      const storageRef = ref(storage, storagePath);

      // Start upload with progress tracking
      const uploadTask = uploadBytesResumable(storageRef, file);
      this.uploadTasks.set(file.name, uploadTask);

      return new Promise((resolve, reject) => {
        uploadTask.on(
          'state_changed',
          (snapshot) => {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            if (onProgress) {
              onProgress(progress, snapshot);
            }
            this.emit('uploadProgress', { 
              fileName: file.name, 
              progress,
              status: snapshot.state 
            });
          },
          (error) => {
            this.uploadTasks.delete(file.name);
            this.emit('uploadError', { fileName: file.name, error });
            reject(error);
          },
          async () => {
            try {
              // Get download URL
              const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
              
              // Extract metadata
              const metadata = await this.extractAssetMetadata(file);
              
              // Generate thumbnail if needed
              let thumbnailURL = null;
              if (generateThumbnail && this.shouldGenerateThumbnail(file.type)) {
                thumbnailURL = await this.generateAndUploadThumbnail(file, storagePath);
              }

              // Save asset metadata to Firestore
              const assetData = {
                name: file.name,
                originalName: file.name,
                size: file.size,
                type: this.getAssetType(file.type),
                mimeType: file.type,
                storagePath,
                downloadURL,
                thumbnailURL,
                metadata,
                uploadedAt: new Date().toISOString(),
                lastModified: new Date(file.lastModified).toISOString(),
                ...metadata
              };

              const docRef = await addDoc(collection(db, 'assets'), assetData);
              
              const asset = {
                id: docRef.id,
                ...assetData
              };

              this.uploadTasks.delete(file.name);
              this.emit('uploadComplete', { asset });
              
              resolve(asset);
            } catch (error) {
              this.uploadTasks.delete(file.name);
              reject(error);
            }
          }
        );
      });
    } catch (error) {
      this.emit('uploadError', { fileName: file.name, error });
      throw error;
    }
  }

  /**
   * Extract metadata from file
   */
  async extractAssetMetadata(file) {
    const metadata = {
      size: file.size,
      lastModified: file.lastModified,
      type: this.getAssetType(file.type)
    };

    try {
      if (file.type.startsWith('video/')) {
        const videoMetadata = await this.extractVideoMetadata(file);
        Object.assign(metadata, videoMetadata);
      } else if (file.type.startsWith('audio/')) {
        const audioMetadata = await this.extractAudioMetadata(file);
        Object.assign(metadata, audioMetadata);
      } else if (file.type.startsWith('image/')) {
        const imageMetadata = await this.extractImageMetadata(file);
        Object.assign(metadata, imageMetadata);
      }
    } catch (error) {
      console.warn('Metadata extraction failed:', error);
    }

    return metadata;
  }

  /**
   * Extract video metadata
   */
  async extractVideoMetadata(file) {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      
      video.onloadedmetadata = () => {
        resolve({
          duration: video.duration,
          width: video.videoWidth,
          height: video.videoHeight,
          aspectRatio: video.videoWidth / video.videoHeight
        });
        URL.revokeObjectURL(video.src);
      };
      
      video.onerror = () => {
        resolve({});
        URL.revokeObjectURL(video.src);
      };
      
      video.src = URL.createObjectURL(file);
    });
  }

  /**
   * Extract audio metadata
   */
  async extractAudioMetadata(file) {
    return new Promise((resolve) => {
      const audio = document.createElement('audio');
      audio.preload = 'metadata';
      
      audio.onloadedmetadata = () => {
        resolve({
          duration: audio.duration
        });
        URL.revokeObjectURL(audio.src);
      };
      
      audio.onerror = () => {
        resolve({});
        URL.revokeObjectURL(audio.src);
      };
      
      audio.src = URL.createObjectURL(file);
    });
  }

  /**
   * Extract image metadata
   */
  async extractImageMetadata(file) {
    return new Promise((resolve) => {
      const img = document.createElement('img');
      
      img.onload = () => {
        resolve({
          width: img.naturalWidth,
          height: img.naturalHeight,
          aspectRatio: img.naturalWidth / img.naturalHeight
        });
        URL.revokeObjectURL(img.src);
      };
      
      img.onerror = () => {
        resolve({});
        URL.revokeObjectURL(img.src);
      };
      
      img.src = URL.createObjectURL(file);
    });
  }

  /**
   * Generate and upload thumbnail
   */
  async generateAndUploadThumbnail(file, originalPath) {
    try {
      const thumbnailBlob = await this.generateThumbnail(file);
      if (!thumbnailBlob) return null;

      const thumbnailPath = originalPath.replace(/(\.[^.]+)$/, '_thumb$1');
      const thumbnailRef = ref(storage, thumbnailPath);
      
      await uploadBytesResumable(thumbnailRef, thumbnailBlob);
      return await getDownloadURL(thumbnailRef);
    } catch (error) {
      console.warn('Thumbnail generation failed:', error);
      return null;
    }
  }

  /**
   * Generate thumbnail from file
   */
  async generateThumbnail(file, options = {}) {
    const { width = 200, height = 150, quality = 0.8 } = options;

    if (file.type.startsWith('video/')) {
      return this.generateVideoThumbnail(file, width, height, quality);
    } else if (file.type.startsWith('image/')) {
      return this.generateImageThumbnail(file, width, height, quality);
    }
    
    return null;
  }

  /**
   * Generate video thumbnail
   */
  async generateVideoThumbnail(file, width, height, quality) {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      video.onloadeddata = () => {
        video.currentTime = Math.min(video.duration * 0.1, 1); // 10% into video or 1 second
      };
      
      video.onseeked = () => {
        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(video, 0, 0, width, height);
        
        canvas.toBlob(resolve, 'image/jpeg', quality);
        URL.revokeObjectURL(video.src);
      };
      
      video.onerror = () => {
        resolve(null);
        URL.revokeObjectURL(video.src);
      };
      
      video.src = URL.createObjectURL(file);
    });
  }

  /**
   * Generate image thumbnail
   */
  async generateImageThumbnail(file, width, height, quality) {
    return new Promise((resolve) => {
      const img = document.createElement('img');
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      img.onload = () => {
        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);
        
        canvas.toBlob(resolve, 'image/jpeg', quality);
        URL.revokeObjectURL(img.src);
      };
      
      img.onerror = () => {
        resolve(null);
        URL.revokeObjectURL(img.src);
      };
      
      img.src = URL.createObjectURL(file);
    });
  }

  /**
   * Get all assets from Firestore
   */
  async getAssets(options = {}) {
    const {
      type = null,
      orderBy: orderField = 'uploadedAt',
      orderDirection = 'desc',
      limit = null
    } = options;

    try {
      let q = collection(db, 'assets');
      
      if (type) {
        q = query(q, where('type', '==', type));
      }
      
      q = query(q, orderBy(orderField, orderDirection));
      
      if (limit) {
        q = query(q, limit(limit));
      }

      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error('Error fetching assets:', error);
      throw error;
    }
  }

  /**
   * Delete asset
   */
  async deleteAsset(assetId) {
    try {
      // Get asset data first
      const assetDoc = await doc(db, 'assets', assetId);
      const assetData = (await assetDoc.get()).data();
      
      if (assetData) {
        // Delete from storage
        if (assetData.storagePath) {
          const storageRef = ref(storage, assetData.storagePath);
          await deleteObject(storageRef);
        }
        
        // Delete thumbnail if exists
        if (assetData.thumbnailURL) {
          const thumbnailPath = assetData.storagePath.replace(/(\.[^.]+)$/, '_thumb$1');
          const thumbnailRef = ref(storage, thumbnailPath);
          try {
            await deleteObject(thumbnailRef);
          } catch (error) {
            console.warn('Thumbnail deletion failed:', error);
          }
        }
      }
      
      // Delete from Firestore
      await deleteDoc(doc(db, 'assets', assetId));
      
      this.emit('assetDeleted', { assetId });
    } catch (error) {
      console.error('Error deleting asset:', error);
      throw error;
    }
  }

  /**
   * Update asset metadata
   */
  async updateAsset(assetId, updates) {
    try {
      await updateDoc(doc(db, 'assets', assetId), {
        ...updates,
        updatedAt: new Date().toISOString()
      });
      
      this.emit('assetUpdated', { assetId, updates });
    } catch (error) {
      console.error('Error updating asset:', error);
      throw error;
    }
  }

  /**
   * Cancel upload
   */
  cancelUpload(fileName) {
    const uploadTask = this.uploadTasks.get(fileName);
    if (uploadTask) {
      uploadTask.cancel();
      this.uploadTasks.delete(fileName);
      this.emit('uploadCancelled', { fileName });
    }
  }

  /**
   * Helper methods
   */
  getAssetType(mimeType) {
    if (mimeType.startsWith('video/')) return 'video';
    if (mimeType.startsWith('audio/')) return 'audio';
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.includes('font') || /\.(ttf|otf|woff|woff2)$/i.test(mimeType)) return 'font';
    if (mimeType.startsWith('text/') || /\.(txt|json|srt|vtt|md)$/i.test(mimeType)) return 'text';
    return 'document';
  }

  shouldGenerateThumbnail(mimeType) {
    return mimeType.startsWith('video/') || mimeType.startsWith('image/');
  }

  /**
   * Get upload progress for file
   */
  getUploadProgress(fileName) {
    const uploadTask = this.uploadTasks.get(fileName);
    if (!uploadTask) return null;
    
    const snapshot = uploadTask.snapshot;
    return {
      progress: (snapshot.bytesTransferred / snapshot.totalBytes) * 100,
      status: snapshot.state,
      bytesTransferred: snapshot.bytesTransferred,
      totalBytes: snapshot.totalBytes
    };
  }

  /**
   * Check if file is currently uploading
   */
  isUploading(fileName) {
    return this.uploadTasks.has(fileName);
  }

  /**
   * Get all active uploads
   */
  getActiveUploads() {
    return Array.from(this.uploadTasks.keys());
  }
}

// Create singleton instance
export const assetManager = new AssetManager();
export default assetManager; 