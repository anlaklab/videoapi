/**
 * Sample Assets for Video Editor
 * Optimized for fast loading with lazy loading support
 */

// Lazy loading helper
const createLazyAsset = (id, name, type, url, options = {}) => ({
  id,
  name,
  type,
  url,
  thumbnail: options.thumbnail || url,
  duration: options.duration || (type === 'image' ? 5 : type === 'audio' ? 30 : 10),
  size: options.size || 1000000,
  category: options.category || type,
  resolution: options.resolution || (type === 'image' || type === 'video' ? { width: 1920, height: 1080 } : undefined),
  tags: options.tags || [],
  lazy: true, // Mark for lazy loading
  ...options
});

// Essential assets loaded immediately (smaller set)
const essentialAssets = {
  videos: [
    createLazyAsset(
      'vid-1',
      'Ocean Waves',
      'video',
      'https://player.vimeo.com/external/370467553.sd.mp4?s=e90dcaba73c19e0e36f03406b47bbd6d9946b5c2&profile_id=164&oauth2_token_id=57447761',
      {
        thumbnail: 'https://images.unsplash.com/photo-1505142468610-359e7d316be0?w=300&h=200&fit=crop',
        duration: 15,
        category: 'nature',
        tags: ['ocean', 'waves', 'nature', 'blue']
      }
    ),
    createLazyAsset(
      'vid-2',
      'City Traffic',
      'video',
      'https://player.vimeo.com/external/395433493.sd.mp4?s=b76c7c5f9b1c7e8d2f4a5c6d7e8f9g0h&profile_id=164',
      {
        thumbnail: 'https://images.unsplash.com/photo-1449824913935-59a10b8d2000?w=300&h=200&fit=crop',
        duration: 12,
        category: 'urban',
        tags: ['city', 'traffic', 'urban', 'motion']
      }
    )
  ],
  
  images: [
    createLazyAsset(
      'img-1',
      'Mountain Landscape',
      'image',
      'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1920&h=1080&fit=crop',
      {
        thumbnail: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=300&h=200&fit=crop',
        category: 'nature',
        tags: ['mountain', 'landscape', 'nature', 'scenic']
      }
    ),
    createLazyAsset(
      'img-2',
      'Urban Architecture',
      'image',
      'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=1920&h=1080&fit=crop',
      {
        thumbnail: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=300&h=200&fit=crop',
        category: 'architecture',
        tags: ['building', 'architecture', 'urban', 'modern']
      }
    )
  ],
  
  audio: [
    createLazyAsset(
      'aud-1',
      'Ambient Background',
      'audio',
      'https://www.soundjay.com/misc/sounds/magic-chime-02.wav',
      {
        thumbnail: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300&h=200&fit=crop',
        duration: 30,
        category: 'ambient',
        tags: ['ambient', 'background', 'calm', 'peaceful']
      }
    )
  ]
};

// Additional assets loaded on demand
const additionalAssets = {
  videos: [
    createLazyAsset('vid-3', 'Forest Walk', 'video', 'https://player.vimeo.com/external/370467553.sd.mp4', {
      thumbnail: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=300&h=200&fit=crop',
      duration: 20, category: 'nature', tags: ['forest', 'walk', 'nature', 'trees']
    }),
    createLazyAsset('vid-4', 'Technology Abstract', 'video', 'https://player.vimeo.com/external/395433493.sd.mp4', {
      thumbnail: 'https://images.unsplash.com/photo-1518709268805-4e9042af2176?w=300&h=200&fit=crop',
      duration: 18, category: 'technology', tags: ['tech', 'abstract', 'digital', 'modern']
    }),
    createLazyAsset('vid-5', 'Cooking Process', 'video', 'https://player.vimeo.com/external/370467553.sd.mp4', {
      thumbnail: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=300&h=200&fit=crop',
      duration: 25, category: 'lifestyle', tags: ['cooking', 'food', 'kitchen', 'lifestyle']
    })
  ],
  
  images: [
    createLazyAsset('img-3', 'Sunset Beach', 'image', 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1920&h=1080&fit=crop', {
      thumbnail: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=300&h=200&fit=crop',
      category: 'nature', tags: ['sunset', 'beach', 'ocean', 'golden']
    }),
    createLazyAsset('img-4', 'Coffee Shop', 'image', 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=1920&h=1080&fit=crop', {
      thumbnail: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=300&h=200&fit=crop',
      category: 'lifestyle', tags: ['coffee', 'shop', 'interior', 'cozy']
    }),
    createLazyAsset('img-5', 'Abstract Geometric', 'image', 'https://images.unsplash.com/photo-1557683316-973673baf926?w=1920&h=1080&fit=crop', {
      thumbnail: 'https://images.unsplash.com/photo-1557683316-973673baf926?w=300&h=200&fit=crop',
      category: 'abstract', tags: ['abstract', 'geometric', 'colorful', 'modern']
    })
  ],
  
  audio: [
    createLazyAsset('aud-2', 'Upbeat Electronic', 'audio', 'https://www.soundjay.com/misc/sounds/bell-ringing-05.wav', {
      thumbnail: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300&h=200&fit=crop',
      duration: 45, category: 'electronic', tags: ['upbeat', 'electronic', 'energetic', 'modern']
    }),
    createLazyAsset('aud-3', 'Nature Sounds', 'audio', 'https://www.soundjay.com/misc/sounds/magic-chime-02.wav', {
      thumbnail: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=300&h=200&fit=crop',
      duration: 60, category: 'nature', tags: ['nature', 'birds', 'forest', 'peaceful']
    })
  ]
};

// Text templates (lightweight, loaded immediately)
const textAssets = [
  { id: 'txt-1', name: 'Title Text', type: 'text', content: 'Your Title Here', fontSize: 48, fontWeight: 'bold', color: '#ffffff', category: 'title', tags: ['title', 'header', 'large'] },
  { id: 'txt-2', name: 'Subtitle', type: 'text', content: 'Your subtitle text', fontSize: 24, fontWeight: 'normal', color: '#cccccc', category: 'subtitle', tags: ['subtitle', 'secondary', 'medium'] },
  { id: 'txt-3', name: 'Body Text', type: 'text', content: 'Body text content', fontSize: 16, fontWeight: 'normal', color: '#ffffff', category: 'body', tags: ['body', 'paragraph', 'content'] },
  { id: 'txt-4', name: 'Call to Action', type: 'text', content: 'Click Here!', fontSize: 32, fontWeight: 'bold', color: '#00d4ff', category: 'cta', tags: ['cta', 'button', 'action'] },
  { id: 'txt-5', name: 'Caption', type: 'text', content: 'Image caption text', fontSize: 14, fontWeight: 'normal', color: '#999999', category: 'caption', tags: ['caption', 'small', 'description'] }
];

// Font assets (lightweight metadata)
const fontAssets = [
  { id: 'font-1', name: 'Arial', type: 'font', fontFamily: 'Arial, sans-serif', category: 'sans-serif', tags: ['clean', 'modern', 'readable'] },
  { id: 'font-2', name: 'Georgia', type: 'font', fontFamily: 'Georgia, serif', category: 'serif', tags: ['elegant', 'traditional', 'readable'] },
  { id: 'font-3', name: 'Helvetica', type: 'font', fontFamily: 'Helvetica, Arial, sans-serif', category: 'sans-serif', tags: ['clean', 'swiss', 'minimal'] },
  { id: 'font-4', name: 'Times New Roman', type: 'font', fontFamily: 'Times New Roman, serif', category: 'serif', tags: ['classic', 'formal', 'traditional'] },
  { id: 'font-5', name: 'Courier New', type: 'font', fontFamily: 'Courier New, monospace', category: 'monospace', tags: ['code', 'typewriter', 'technical'] }
];

// Asset loading state management
let additionalAssetsLoaded = false;
let loadingPromise = null;

// Lazy loading function
const loadAdditionalAssets = async () => {
  if (additionalAssetsLoaded || loadingPromise) {
    return loadingPromise || Promise.resolve();
  }
  
  loadingPromise = new Promise((resolve) => {
    // Simulate network delay for additional assets
    setTimeout(() => {
      additionalAssetsLoaded = true;
      resolve();
    }, 100); // Very short delay to simulate loading
  });
  
  return loadingPromise;
};

// Get sample assets with lazy loading support
export const getSampleAssets = async (loadAll = false) => {
  const baseAssets = {
    videos: essentialAssets.videos,
    images: essentialAssets.images,
    audio: essentialAssets.audio,
    text: textAssets,
    fonts: fontAssets
  };
  
  if (loadAll) {
    await loadAdditionalAssets();
    return {
      videos: [...essentialAssets.videos, ...additionalAssets.videos],
      images: [...essentialAssets.images, ...additionalAssets.images],
      audio: [...essentialAssets.audio, ...additionalAssets.audio],
      text: textAssets,
      fonts: fontAssets
    };
  }
  
  return baseAssets;
};

// Get assets by category with lazy loading
export const getAssetsByCategory = async (category, loadAll = false) => {
  const assets = await getSampleAssets(loadAll);
  
  if (category === 'all') {
    return Object.values(assets).flat();
  }
  
  return Object.values(assets).flat().filter(asset => 
    asset.category === category || asset.tags?.includes(category)
  );
};

// Search assets
export const searchAssets = async (query, loadAll = true) => {
  const assets = await getSampleAssets(loadAll);
  const allAssets = Object.values(assets).flat();
  
  if (!query) return allAssets;
  
  const searchTerm = query.toLowerCase();
  return allAssets.filter(asset =>
    asset.name.toLowerCase().includes(searchTerm) ||
    asset.category.toLowerCase().includes(searchTerm) ||
    asset.tags?.some(tag => tag.toLowerCase().includes(searchTerm))
  );
};

// Export for immediate use (essential assets only)
export const sampleAssets = essentialAssets;

// Export all functions
export default {
  getSampleAssets,
  getAssetsByCategory,
  searchAssets,
  loadAdditionalAssets,
  sampleAssets
}; 