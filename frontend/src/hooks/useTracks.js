/**
 * useTracks Hook - Track Management
 * 
 * Manages timeline tracks including creation, ordering, deletion,
 * muting, soloing, and track-level operations following professional
 * video editor patterns.
 */

import { useState, useCallback, useRef } from 'react';

const DEFAULT_TRACK_TYPES = ['video', 'audio', 'text', 'overlay'];
const MAX_TRACKS = 20;

export const useTracks = (initialTracks = []) => {
  const [tracks, setTracks] = useState(initialTracks);
  const [selectedTrackIds, setSelectedTrackIds] = useState([]);
  const [expandedTracks, setExpandedTracks] = useState(new Set());
  const [trackHeights, setTrackHeights] = useState(new Map());
  
  const draggedTrackRef = useRef(null);
  const dropIndicatorRef = useRef(null);

  /**
   * Create new track with intelligent type assignment
   */
  const createTrack = useCallback((type = null, options = {}) => {
    if (tracks.length >= MAX_TRACKS) {
      console.warn('Maximum number of tracks reached');
      return null;
    }

    // Auto-assign type if not specified
    if (!type) {
      const typeCounts = tracks.reduce((acc, track) => {
        acc[track.type] = (acc[track.type] || 0) + 1;
        return acc;
      }, {});
      
      type = DEFAULT_TRACK_TYPES.find(t => (typeCounts[t] || 0) === 0) || 'video';
    }

    const newTrack = {
      id: `track-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      name: options.name || `${type.charAt(0).toUpperCase() + type.slice(1)} ${tracks.filter(t => t.type === type).length + 1}`,
      clips: [],
      order: tracks.length,
      
      // Track properties
      enabled: true,
      locked: false,
      muted: false,
      solo: false,
      visible: true,
      
      // Visual properties
      color: options.color || getDefaultTrackColor(type),
      height: options.height || getDefaultTrackHeight(type),
      
      // Audio properties (for audio tracks)
      volume: type === 'audio' ? 1.0 : null,
      pan: type === 'audio' ? 0 : null,
      
      // Metadata
      createdAt: new Date().toISOString(),
      ...options
    };

    setTracks(prev => [...prev, newTrack]);
    return newTrack.id;
  }, [tracks]);

  /**
   * Delete track by ID
   */
  const deleteTrack = useCallback((trackId) => {
    setTracks(prev => {
      const filtered = prev.filter(track => track.id !== trackId);
      // Reorder remaining tracks
      return filtered.map((track, index) => ({
        ...track,
        order: index
      }));
    });
    
    // Remove from selection if selected
    setSelectedTrackIds(prev => prev.filter(id => id !== trackId));
  }, []);

  /**
   * Duplicate track with all clips
   */
  const duplicateTrack = useCallback((trackId) => {
    const track = tracks.find(t => t.id === trackId);
    if (!track) return null;

    const duplicatedTrack = {
      ...track,
      id: `track-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: `${track.name} Copy`,
      order: tracks.length,
      clips: track.clips.map(clip => ({
        ...clip,
        id: `clip-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      }))
    };

    setTracks(prev => [...prev, duplicatedTrack]);
    return duplicatedTrack.id;
  }, [tracks]);

  /**
   * Reorder tracks (drag and drop)
   */
  const reorderTracks = useCallback((fromIndex, toIndex) => {
    setTracks(prev => {
      const newTracks = [...prev];
      const [movedTrack] = newTracks.splice(fromIndex, 1);
      newTracks.splice(toIndex, 0, movedTrack);
      
      // Update order property
      return newTracks.map((track, index) => ({
        ...track,
        order: index
      }));
    });
  }, []);

  /**
   * Update track properties
   */
  const updateTrack = useCallback((trackId, updates) => {
    setTracks(prev => prev.map(track => 
      track.id === trackId 
        ? { ...track, ...updates }
        : track
    ));
  }, []);

  /**
   * Toggle track mute
   */
  const toggleMute = useCallback((trackId) => {
    updateTrack(trackId, { 
      muted: !tracks.find(t => t.id === trackId)?.muted 
    });
  }, [tracks, updateTrack]);

  /**
   * Toggle track solo
   */
  const toggleSolo = useCallback((trackId) => {
    const track = tracks.find(t => t.id === trackId);
    if (!track) return;

    const newSoloState = !track.solo;
    
    setTracks(prev => prev.map(t => ({
      ...t,
      solo: t.id === trackId ? newSoloState : (newSoloState ? false : t.solo)
    })));
  }, [tracks]);

  /**
   * Toggle track lock
   */
  const toggleLock = useCallback((trackId) => {
    updateTrack(trackId, { 
      locked: !tracks.find(t => t.id === trackId)?.locked 
    });
  }, [tracks, updateTrack]);

  /**
   * Toggle track visibility
   */
  const toggleVisibility = useCallback((trackId) => {
    updateTrack(trackId, { 
      visible: !tracks.find(t => t.id === trackId)?.visible 
    });
  }, [tracks, updateTrack]);

  /**
   * Set track volume (audio tracks only)
   */
  const setTrackVolume = useCallback((trackId, volume) => {
    const clampedVolume = Math.max(0, Math.min(2, volume));
    updateTrack(trackId, { volume: clampedVolume });
  }, [updateTrack]);

  /**
   * Set track pan (audio tracks only)
   */
  const setTrackPan = useCallback((trackId, pan) => {
    const clampedPan = Math.max(-1, Math.min(1, pan));
    updateTrack(trackId, { pan: clampedPan });
  }, [updateTrack]);

  /**
   * Track selection management
   */
  const selectTrack = useCallback((trackId, multiSelect = false) => {
    setSelectedTrackIds(prev => {
      if (multiSelect) {
        return prev.includes(trackId) 
          ? prev.filter(id => id !== trackId)
          : [...prev, trackId];
      } else {
        return [trackId];
      }
    });
  }, []);

  /**
   * Clear track selection
   */
  const clearSelection = useCallback(() => {
    setSelectedTrackIds([]);
  }, []);

  /**
   * Select all tracks
   */
  const selectAllTracks = useCallback(() => {
    setSelectedTrackIds(tracks.map(t => t.id));
  }, [tracks]);

  /**
   * Expand/collapse track
   */
  const toggleTrackExpansion = useCallback((trackId) => {
    setExpandedTracks(prev => {
      const newSet = new Set(prev);
      if (newSet.has(trackId)) {
        newSet.delete(trackId);
      } else {
        newSet.add(trackId);
      }
      return newSet;
    });
  }, []);

  /**
   * Set track height
   */
  const setTrackHeight = useCallback((trackId, height) => {
    setTrackHeights(prev => new Map(prev.set(trackId, height)));
  }, []);

  /**
   * Get tracks by type
   */
  const getTracksByType = useCallback((type) => {
    return tracks.filter(track => track.type === type);
  }, [tracks]);

  /**
   * Get selected tracks
   */
  const getSelectedTracks = useCallback(() => {
    return tracks.filter(track => selectedTrackIds.includes(track.id));
  }, [tracks, selectedTrackIds]);

  /**
   * Check if any audio tracks are soloed
   */
  const hasAudioSolo = useCallback(() => {
    return tracks.some(track => track.type === 'audio' && track.solo);
  }, [tracks]);

  /**
   * Get effective audio state for playback
   */
  const getAudioPlaybackState = useCallback(() => {
    const audioTracks = getTracksByType('audio');
    const hasSolo = hasAudioSolo();
    
    return audioTracks.map(track => ({
      id: track.id,
      shouldPlay: track.enabled && !track.muted && (!hasSolo || track.solo),
      volume: track.volume || 1.0,
      pan: track.pan || 0
    }));
  }, [getTracksByType, hasAudioSolo]);

  /**
   * Bulk track operations
   */
  const bulkUpdateTracks = useCallback((trackIds, updates) => {
    setTracks(prev => prev.map(track =>
      trackIds.includes(track.id)
        ? { ...track, ...updates }
        : track
    ));
  }, []);

  /**
   * Move selected tracks up
   */
  const moveSelectedTracksUp = useCallback(() => {
    const selectedTracks = getSelectedTracks();
    if (selectedTracks.length === 0) return;

    const minOrder = Math.min(...selectedTracks.map(t => t.order));
    if (minOrder === 0) return;

    setTracks(prev => {
      const newTracks = [...prev];
      selectedTracks.forEach(track => {
        const currentIndex = newTracks.findIndex(t => t.id === track.id);
        if (currentIndex > 0) {
          [newTracks[currentIndex], newTracks[currentIndex - 1]] = 
          [newTracks[currentIndex - 1], newTracks[currentIndex]];
        }
      });
      
      return newTracks.map((track, index) => ({
        ...track,
        order: index
      }));
    });
  }, [getSelectedTracks]);

  /**
   * Move selected tracks down
   */
  const moveSelectedTracksDown = useCallback(() => {
    const selectedTracks = getSelectedTracks();
    if (selectedTracks.length === 0) return;

    const maxOrder = Math.max(...selectedTracks.map(t => t.order));
    if (maxOrder === tracks.length - 1) return;

    setTracks(prev => {
      const newTracks = [...prev];
      selectedTracks.reverse().forEach(track => {
        const currentIndex = newTracks.findIndex(t => t.id === track.id);
        if (currentIndex < newTracks.length - 1) {
          [newTracks[currentIndex], newTracks[currentIndex + 1]] = 
          [newTracks[currentIndex + 1], newTracks[currentIndex]];
        }
      });
      
      return newTracks.map((track, index) => ({
        ...track,
        order: index
      }));
    });
  }, [getSelectedTracks, tracks.length]);

  // Helper functions
  const getDefaultTrackColor = (type) => {
    const colors = {
      video: '#ff6b6b',
      audio: '#4ecdc4',
      text: '#45b7d1',
      overlay: '#f39c12'
    };
    return colors[type] || '#666666';
  };

  const getDefaultTrackHeight = (type) => {
    const heights = {
      video: 80,
      audio: 60,
      text: 50,
      overlay: 70
    };
    return heights[type] || 60;
  };

  // Computed values
  const sortedTracks = tracks.sort((a, b) => a.order - b.order);
  const trackCount = tracks.length;
  const selectedTrackCount = selectedTrackIds.length;
  const audioTracks = getTracksByType('audio');
  const videoTracks = getTracksByType('video');

  return {
    // Core state
    tracks: sortedTracks,
    selectedTrackIds,
    expandedTracks,
    trackHeights,
    
    // Computed values
    trackCount,
    selectedTrackCount,
    audioTracks,
    videoTracks,
    
    // Track CRUD operations
    createTrack,
    deleteTrack,
    duplicateTrack,
    updateTrack,
    reorderTracks,
    
    // Track properties
    toggleMute,
    toggleSolo,
    toggleLock,
    toggleVisibility,
    setTrackVolume,
    setTrackPan,
    
    // Selection management
    selectTrack,
    clearSelection,
    selectAllTracks,
    getSelectedTracks,
    
    // UI state
    toggleTrackExpansion,
    setTrackHeight,
    
    // Bulk operations
    bulkUpdateTracks,
    moveSelectedTracksUp,
    moveSelectedTracksDown,
    
    // Utilities
    getTracksByType,
    hasAudioSolo,
    getAudioPlaybackState
  };
}; 