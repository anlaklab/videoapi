/**
 * useAnimations Hook - Professional Animation Management
 * 
 * Provides robust animation loading, caching, validation and FFmpeg integration
 * Uses the new dynamic animation loader system
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  loadAnimations, 
  getAnimationById, 
  generateFFmpegCommand,
  validateFFmpegCompatibility,
  generateAnimationThumbnail
} from '../utils/animationLoader';

export const useAnimations = () => {
  const [animations, setAnimations] = useState({ camera: [], transform: [], effects: [] });
  const [loadingState, setLoadingState] = useState({
    isLoading: true,
    error: null,
    stats: null
  });
  const [selectedAnimations, setSelectedAnimations] = useState([]);
  const [previewCache, setPreviewCache] = useState(new Map());
  
  const animationsRef = useRef(null);
  const loadPromiseRef = useRef(null);

  /**
   * Load animations on mount
   */
  useEffect(() => {
    const loadAnimationsData = async () => {
      if (loadPromiseRef.current) {
        return loadPromiseRef.current;
      }

      setLoadingState(prev => ({ ...prev, isLoading: true, error: null }));

      try {
        loadPromiseRef.current = loadAnimations();
        const result = await loadPromiseRef.current;
        
        animationsRef.current = result.animations;
        setAnimations(result.animations);
        setLoadingState({
          isLoading: false,
          error: null,
          stats: result.stats
        });

        console.log('✅ Animations loaded successfully:', result.stats);
      } catch (error) {
        console.error('❌ Failed to load animations:', error);
        setLoadingState({
          isLoading: false,
          error: error.message,
          stats: null
        });
      } finally {
        loadPromiseRef.current = null;
      }
    };

    loadAnimationsData();
  }, []);

  /**
   * Get animation by ID
   */
  const getAnimation = useCallback((animationId) => {
    return getAnimationById(animations, animationId);
  }, [animations]);

  /**
   * Get animations by category
   */
  const getAnimationsByCategory = useCallback((category) => {
    return animations[category] || [];
  }, [animations]);

  /**
   * Search animations by name or description
   */
  const searchAnimations = useCallback((query) => {
    if (!query || query.length < 2) return [];

    const lowerQuery = query.toLowerCase();
    const results = [];

    Object.keys(animations).forEach(category => {
      animations[category].forEach(animation => {
        if (
          animation.name.toLowerCase().includes(lowerQuery) ||
          animation.description.toLowerCase().includes(lowerQuery) ||
          animation.id.toLowerCase().includes(lowerQuery)
        ) {
          results.push({
            ...animation,
            category,
            score: animation.name.toLowerCase() === lowerQuery ? 10 :
                   animation.name.toLowerCase().startsWith(lowerQuery) ? 5 : 1
          });
        }
      });
    });

    return results.sort((a, b) => b.score - a.score);
  }, [animations]);

  /**
   * Apply animation to clip/track
   */
  const applyAnimation = useCallback((animationId, targetClip, customParams = {}) => {
    const animation = getAnimation(animationId);
    if (!animation) {
      throw new Error(`Animation ${animationId} not found`);
    }

    // Validate FFmpeg compatibility
    const compatibility = validateFFmpegCompatibility(animation);
    if (!compatibility.compatible) {
      console.warn('FFmpeg compatibility issues:', compatibility.warnings);
    }

    // Generate FFmpeg command
    try {
      const ffmpegCommand = generateFFmpegCommand(
        animation,
        targetClip.source,
        `${targetClip.id}_animated.mp4`,
        customParams
      );

      console.log('Generated FFmpeg command:', ffmpegCommand);

      // Return animation configuration for timeline
      return {
        animationId,
        animation,
        ffmpegCommand,
        parameters: { ...animation.ffmpeg.parameters, ...customParams },
        compatibility,
        appliedAt: new Date().toISOString()
      };
    } catch (error) {
      console.error('Failed to apply animation:', error);
      throw error;
    }
  }, [getAnimation]);

  /**
   * Generate preview for animation
   */
  const generatePreview = useCallback(async (animationId, options = {}) => {
    const cacheKey = `${animationId}-${JSON.stringify(options)}`;
    
    if (previewCache.has(cacheKey)) {
      return previewCache.get(cacheKey);
    }

    const animation = getAnimation(animationId);
    if (!animation) {
      throw new Error(`Animation ${animationId} not found`);
    }

    try {
      const thumbnail = await generateAnimationThumbnail(animation, options);
      
      const preview = {
        animationId,
        thumbnail,
        generatedAt: new Date().toISOString(),
        options
      };

      setPreviewCache(prev => new Map(prev).set(cacheKey, preview));
      return preview;
    } catch (error) {
      console.error('Failed to generate preview:', error);
      throw error;
    }
  }, [getAnimation, previewCache]);

  /**
   * Animation selection management
   */
  const selectAnimation = useCallback((animationId, multiSelect = false) => {
    setSelectedAnimations(prev => {
      if (multiSelect) {
        return prev.includes(animationId)
          ? prev.filter(id => id !== animationId)
          : [...prev, animationId];
      } else {
        return [animationId];
      }
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedAnimations([]);
  }, []);

  /**
   * Get selected animation objects
   */
  const getSelectedAnimations = useCallback(() => {
    return selectedAnimations.map(id => getAnimation(id)).filter(Boolean);
  }, [selectedAnimations, getAnimation]);

  /**
   * Validate all animations
   */
  const validateAnimations = useCallback(() => {
    const issues = [];
    
    Object.keys(animations).forEach(category => {
      animations[category].forEach(animation => {
        // Check required fields
        if (!animation.ffmpeg || !animation.ffmpeg.filter) {
          issues.push({
            animation: animation.id,
            category,
            type: 'missing_ffmpeg',
            message: 'Missing FFmpeg configuration'
          });
        }

        // Check icon availability
        if (animation.icon && !animation.iconComponent) {
          issues.push({
            animation: animation.id,
            category,
            type: 'missing_icon',
            message: `Icon "${animation.icon}" not found`
          });
        }

        // Validate FFmpeg compatibility
        const compatibility = validateFFmpegCompatibility(animation);
        if (!compatibility.compatible) {
          issues.push({
            animation: animation.id,
            category,
            type: 'ffmpeg_compatibility',
            message: compatibility.warnings.join(', ')
          });
        }
      });
    });

    return issues;
  }, [animations]);

  /**
   * Export animations configuration
   */
  const exportAnimations = useCallback((format = 'json') => {
    const exportData = {
      animations,
      stats: loadingState.stats,
      exportedAt: new Date().toISOString(),
      version: '1.0.0'
    };

    switch (format) {
      case 'json':
        return JSON.stringify(exportData, null, 2);
      case 'csv':
        // Convert to CSV format for spreadsheet import
        const csvData = [];
        Object.keys(animations).forEach(category => {
          animations[category].forEach(animation => {
            csvData.push({
              id: animation.id,
              name: animation.name,
              category,
              description: animation.description,
              ffmpegFilter: animation.ffmpeg.filter,
              duration: animation.ffmpeg.parameters.duration || 'N/A'
            });
          });
        });
        
        const csvHeaders = Object.keys(csvData[0] || {}).join(',');
        const csvRows = csvData.map(row => Object.values(row).join(','));
        return [csvHeaders, ...csvRows].join('\n');
      default:
        return exportData;
    }
  }, [animations, loadingState.stats]);

  /**
   * Reload animations
   */
  const reloadAnimations = useCallback(async () => {
    loadPromiseRef.current = null;
    setPreviewCache(new Map());
    
    setLoadingState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      const result = await loadAnimations();
      setAnimations(result.animations);
      setLoadingState({
        isLoading: false,
        error: null,
        stats: result.stats
      });
    } catch (error) {
      setLoadingState({
        isLoading: false,
        error: error.message,
        stats: null
      });
    }
  }, []);

  // Computed values
  const totalAnimations = Object.values(animations).reduce((sum, arr) => sum + arr.length, 0);
  const categories = Object.keys(animations);
  const hasAnimations = totalAnimations > 0;

  return {
    // Core data
    animations,
    totalAnimations,
    categories,
    hasAnimations,
    
    // Loading state
    isLoading: loadingState.isLoading,
    error: loadingState.error,
    stats: loadingState.stats,
    
    // Animation operations
    getAnimation,
    getAnimationsByCategory,
    searchAnimations,
    applyAnimation,
    generatePreview,
    
    // Selection management
    selectedAnimations,
    selectAnimation,
    clearSelection,
    getSelectedAnimations,
    
    // Utilities
    validateAnimations,
    exportAnimations,
    reloadAnimations,
    
    // Cache
    previewCache: previewCache.size,
    clearPreviewCache: () => setPreviewCache(new Map())
  };
}; 