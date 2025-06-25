/**
 * Asset Manager Service - Firestore Integration with Sample Assets Fallback
 * 
 * Manages asset loading, caching, and integration with Firebase Firestore
 * Stores sample assets in Firestore for dynamic fetching
 */

import { getSampleAssets, getAssetsByCategory, searchAssets } from '../data/sampleAssets';
import { db, storage } from '../config/firebase';
import { 
  collection, 
  doc, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy,
  onSnapshot 
} from 'firebase/firestore';
import { 
  ref, 
  uploadBytes, 
  getDownloadURL, 
  deleteObject 
} from 'firebase/storage';

class AssetManager {
  constructor() {
    this.cache = new Map();
    this.loadingStates = new Map();
    this.thumbnailCache = new Map();
    this.initialized = false;
    this.firestoreCollection = 'assets';
    this.storageFolder = 'user-assets';
    this.sampleAssetsInitialized = false;
  }

  /**
   * Initialize with Firestore assets and ensure sample assets are stored
   */
  async initialize() {
    if (this.initialized) return;
    
    try {
      console.log('🚀 AssetManager: Initializing with Firestore integration...');
      const startTime = performance.now();
      
      // First, ensure sample assets are in Firestore
      await this.ensureSampleAssetsInFirestore();
      
      // Load assets from Firestore
      const firestoreAssets = await this.getAssetsFromFirestore();
      
      // Cache Firestore assets
      this.cache.set('firestore', firestoreAssets);
      this.initialized = true;
      
      const loadTime = performance.now() - startTime;
      console.log(`✅ AssetManager: Initialized with ${firestoreAssets.length} assets in ${loadTime.toFixed(2)}ms`);
      
      return firestoreAssets;
    } catch (error) {
      console.error('❌ AssetManager: Failed to initialize with Firestore:', error);
      
      // Fallback to local sample assets
      console.log('🔄 AssetManager: Falling back to local sample assets...');
      const sampleAssets = await getSampleAssets(true);
      const flatAssets = Object.values(sampleAssets).flat();
      
      this.cache.set('fallback', flatAssets);
      this.initialized = true;
      
      return flatAssets;
    }
  }

  /**
   * Ensure sample assets are stored in Firestore (run once)
   */
  async ensureSampleAssetsInFirestore() {
    if (this.sampleAssetsInitialized) return;
    
    try {
      // Check if we already have sample assets in Firestore
      const assetsRef = collection(db, this.firestoreCollection);
      const sampleQuery = query(assetsRef, where('source', '==', 'sample'));
      const existingSamples = await getDocs(sampleQuery);
      
      if (existingSamples.size > 0) {
        console.log(`✅ Found ${existingSamples.size} sample assets already in Firestore`);
        this.sampleAssetsInitialized = true;
        return;
      }
      
      console.log('📦 Importing sample assets to Firestore...');
      
      // Get all sample assets
      const sampleAssets = await getSampleAssets(true);
      const allSampleAssets = Object.values(sampleAssets).flat();
      
      // Add each sample asset to Firestore
      const batch = [];
      for (const asset of allSampleAssets) {
        const assetDoc = {
          ...asset,
          source: 'sample',
          createdAt: new Date(),
          updatedAt: new Date(),
          downloadURL: asset.url,
          thumbnailURL: asset.thumbnail,
          isPublic: true,
          verified: true
        };
        
        batch.push(addDoc(assetsRef, assetDoc));
      }
      
      await Promise.all(batch);
      console.log(`✅ Successfully imported ${allSampleAssets.length} sample assets to Firestore`);
      this.sampleAssetsInitialized = true;
      
    } catch (error) {
      console.warn('⚠️ Failed to ensure sample assets in Firestore:', error);
      // Don't throw - we can still work with local assets
    }
  }

  /**
   * Get all assets from Firestore
   */
  async getAssetsFromFirestore() {
    try {
      const assetsRef = collection(db, this.firestoreCollection);
      const assetsQuery = query(assetsRef, orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(assetsQuery);
      
      const assets = [];
      snapshot.forEach((doc) => {
        assets.push({
          id: doc.id,
          firestoreId: doc.id,
          ...doc.data()
        });
      });
      
      console.log(`📦 Loaded ${assets.length} assets from Firestore`);
      return assets;
      
    } catch (error) {
      console.error('❌ Failed to load assets from Firestore:', error);
      throw error;
    }
  }

  /**
   * Get all assets (with Firestore integration)
   */
  async getAllAssets(forceReload = false) {
    const cacheKey = 'all';
    
    if (!forceReload && this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    try {
      console.log('📦 AssetManager: Loading all assets from Firestore...');
      
      // Initialize if not already done
      if (!this.initialized) {
        await this.initialize();
      }
      
      // Get assets from Firestore
      const firestoreAssets = await this.getAssetsFromFirestore();
      
      // Process assets for better performance
      const processedAssets = firestoreAssets.map(asset => this.processAsset(asset));
      
      this.cache.set(cacheKey, processedAssets);
      return processedAssets;
      
    } catch (error) {
      console.error('❌ AssetManager: Failed to load assets from Firestore:', error);
      
      // Fallback to local sample assets
      console.log('🔄 AssetManager: Using local sample assets as fallback');
      const sampleAssets = await getSampleAssets(true);
      const flatAssets = Object.values(sampleAssets).flat();
      const processedAssets = flatAssets.map(asset => this.processAsset(asset));
      
      this.cache.set('fallback', processedAssets);
      return processedAssets;
    }
  }

  /**
   * Get assets by category with Firestore
   */
  async getAssetsByCategory(category) {
    try {
      const allAssets = await this.getAllAssets();
      
      if (category === 'all') {
        return allAssets;
      }
      
      return allAssets.filter(asset => 
        asset.category === category || asset.tags?.includes(category)
      );
      
    } catch (error) {
      console.error(`❌ AssetManager: Failed to load category ${category}:`, error);
      return [];
    }
  }

  /**
   * Search assets with Firestore
   */
  async searchAssets(query) {
    if (!query || query.trim() === '') {
      return this.getAllAssets();
    }

    try {
      const allAssets = await this.getAllAssets();
      const searchTerm = query.toLowerCase();
      
      return allAssets.filter(asset =>
        asset.name?.toLowerCase().includes(searchTerm) ||
        asset.category?.toLowerCase().includes(searchTerm) ||
        asset.tags?.some(tag => tag.toLowerCase().includes(searchTerm))
      );
      
    } catch (error) {
      console.error('❌ AssetManager: Search failed:', error);
      return [];
    }
  }

  /**
   * Upload asset to Firebase Storage and save metadata to Firestore
   */
  async uploadAsset(file, options = {}) {
    try {
      console.log('📤 Uploading asset:', file.name);
      
      // Create unique filename
      const timestamp = Date.now();
      const filename = `${timestamp}-${file.name}`;
      const storageRef = ref(storage, `${this.storageFolder}/${filename}`);
      
      // Track progress if callback provided
      if (options.onProgress) {
        options.onProgress(50); // Start at 50%
      }
      
      // Try Firebase upload with enhanced error handling
      let downloadURL;
      try {
        const uploadTask = uploadBytes(storageRef, file);
        const snapshot = await uploadTask;
        downloadURL = await getDownloadURL(snapshot.ref);
        
        if (options.onProgress) {
          options.onProgress(100);
        }
        
        console.log('✅ Firebase upload successful:', downloadURL);
      } catch (firebaseError) {
        console.warn('⚠️ Firebase upload failed (likely CORS or permissions):', firebaseError.message);
        
        // Create a local blob URL as fallback
        downloadURL = URL.createObjectURL(file);
        console.log('🔄 Using local blob URL as fallback:', downloadURL);
        
        if (options.onProgress) {
          options.onProgress(100);
        }
      }
      
      // Create asset metadata
      const assetMetadata = {
        name: file.name,
        type: this.getAssetTypeFromFile(file),
        category: this.getCategoryFromFile(file),
        size: file.size,
        mimeType: file.type,
        downloadURL,
        thumbnailURL: downloadURL,
        source: downloadURL.startsWith('blob:') ? 'local-fallback' : 'firebase-upload',
        filename,
        storagePath: downloadURL.startsWith('blob:') ? null : `${this.storageFolder}/${filename}`,
        createdAt: new Date(),
        updatedAt: new Date(),
        tags: this.generateTagsFromFile(file),
        isPublic: false,
        verified: false,
        localFile: downloadURL.startsWith('blob:') ? file : null // Store file reference for local assets
      };
      
      // Try to save metadata to Firestore (with fallback)
      let finalAsset;
      try {
        const assetsRef = collection(db, this.firestoreCollection);
        const docRef = await addDoc(assetsRef, {
          ...assetMetadata,
          localFile: null // Don't store file object in Firestore
        });
        
        finalAsset = {
          id: docRef.id,
          firestoreId: docRef.id,
          ...assetMetadata
        };
        
        console.log('✅ Asset metadata saved to Firestore');
      } catch (firestoreError) {
        console.warn('⚠️ Firestore save failed, using local-only asset:', firestoreError.message);
        
        // Create local-only asset
        finalAsset = {
          id: `local-${timestamp}-${Math.random().toString(36).substr(2, 9)}`,
          firestoreId: null,
          ...assetMetadata,
          source: 'local-only'
        };
      }
      
      console.log('✅ Asset processed successfully:', finalAsset.name);
      
      // Clear cache to force reload
      this.cache.clear();
      
      return finalAsset;
      
    } catch (error) {
      console.error('❌ Asset upload failed completely:', error);
      
      // Last resort: create a minimal local asset
      const fallbackAsset = {
        id: `fallback-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: file.name,
        type: this.getAssetTypeFromFile(file),
        category: this.getCategoryFromFile(file),
        size: file.size,
        mimeType: file.type,
        downloadURL: URL.createObjectURL(file),
        thumbnailURL: URL.createObjectURL(file),
        source: 'fallback-local',
        createdAt: new Date(),
        tags: this.generateTagsFromFile(file),
        localFile: file,
        uploadError: error.message
      };
      
      console.log('🆘 Created fallback local asset:', fallbackAsset.name);
      return fallbackAsset;
    }
  }

  /**
   * Delete asset from both Storage and Firestore
   */
  async deleteAsset(assetId) {
    try {
      // Get asset metadata
      const asset = await this.getAssetById(assetId);
      if (!asset) {
        throw new Error('Asset not found');
      }
      
      // Delete from Storage (only for user uploads)
      if (asset.source === 'user-upload' && asset.storagePath) {
        const storageRef = ref(storage, asset.storagePath);
        await deleteObject(storageRef);
      }
      
      // Delete from Firestore
      const docRef = doc(db, this.firestoreCollection, asset.firestoreId);
      await deleteDoc(docRef);
      
      console.log('✅ Asset deleted successfully:', asset.name);
      
      // Clear cache
      this.cache.clear();
      
    } catch (error) {
      console.error('❌ Asset deletion failed:', error);
      throw error;
    }
  }

  /**
   * Get asset by ID
   */
  async getAssetById(assetId) {
    try {
      const allAssets = await this.getAllAssets();
      return allAssets.find(asset => asset.id === assetId || asset.firestoreId === assetId);
    } catch (error) {
      console.error('❌ Failed to get asset by ID:', error);
      return null;
    }
  }

  /**
   * Helper methods
   */
  processAsset(asset) {
    return {
      ...asset,
      id: asset.id || asset.firestoreId || `asset-${Date.now()}`,
      name: asset.name || 'Unnamed Asset',
      type: asset.type || 'unknown',
      url: asset.downloadURL || asset.url || '',
      thumbnail: asset.thumbnailURL || asset.thumbnail || asset.downloadURL || asset.url || '',
      duration: asset.duration || (asset.type === 'image' ? 5 : 10),
      size: asset.size || 0,
      category: asset.category || asset.type || 'other',
      tags: asset.tags || [],
      loadTime: Date.now(),
      processed: true
    };
  }

  getAssetTypeFromFile(file) {
    if (file.type.startsWith('video/')) return 'video';
    if (file.type.startsWith('audio/')) return 'audio';
    if (file.type.startsWith('image/')) return 'image';
    return 'other';
  }

  getCategoryFromFile(file) {
    return this.getAssetTypeFromFile(file);
  }

  generateTagsFromFile(file) {
    const tags = [this.getAssetTypeFromFile(file)];
    const name = file.name.toLowerCase();
    
    if (name.includes('background')) tags.push('background');
    if (name.includes('music')) tags.push('music');
    if (name.includes('nature')) tags.push('nature');
    if (name.includes('urban')) tags.push('urban');
    
    return tags;
  }

  /**
   * Real-time listener for assets
   */
  subscribeToAssets(callback) {
    try {
      const assetsRef = collection(db, this.firestoreCollection);
      const assetsQuery = query(assetsRef, orderBy('createdAt', 'desc'));
      
      return onSnapshot(assetsQuery, (snapshot) => {
        const assets = [];
        snapshot.forEach((doc) => {
          assets.push({
            id: doc.id,
            firestoreId: doc.id,
            ...doc.data()
          });
        });
        
        console.log(`🔄 Real-time update: ${assets.length} assets`);
        
        // Update cache
        this.cache.set('firestore', assets);
        
        // Call callback with processed assets
        const processedAssets = assets.map(asset => this.processAsset(asset));
        callback(processedAssets);
      });
      
    } catch (error) {
      console.error('❌ Failed to subscribe to assets:', error);
      return () => {}; // Return empty unsubscribe function
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
      initialized: this.initialized,
      sampleAssetsInitialized: this.sampleAssetsInitialized
    };
  }
}

// Export singleton instance
const assetManager = new AssetManager();
export default assetManager; 