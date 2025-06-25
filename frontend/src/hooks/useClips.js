/**
 * useClips Hook - Clip Management
 * 
 * Manages timeline clips including creation, positioning, trimming,
 * cutting, drag & drop operations, and clip-level transformations
 * following professional video editor patterns.
 */

import { useState, useCallback, useRef, useMemo } from 'react';

const SNAP_THRESHOLD = 0.1; // seconds
const MIN_CLIP_DURATION = 0.1; // minimum clip duration

export const useClips = (tracks, updateTracks) => {
  const [selectedClipIds, setSelectedClipIds] = useState([]);
  const [clipboardClips, setClipboardClips] = useState([]);
  const [dragState, setDragState] = useState(null);
  const [resizeState, setResizeState] = useState(null);
  const [multiSelectRange, setMultiSelectRange] = useState(null);
  
  const dragStartRef = useRef(null);
  const snapPointsRef = useRef([]);

  // Helper functions (defined early to avoid hoisting issues)
  const findClipById = useCallback((clipId, tracks) => {
    for (const track of tracks) {
      const clip = track.clips.find(c => c.id === clipId);
      if (clip) return { ...clip, trackId: track.id };
    }
    return null;
  }, []);

  const getAllClips = useCallback(() => {
    return tracks.flatMap(track => 
      track.clips.map(clip => ({ ...clip, trackId: track.id }))
    );
  }, [tracks]);

  const getSelectedClips = useCallback(() => {
    return selectedClipIds.map(id => findClipById(id, tracks)).filter(Boolean);
  }, [selectedClipIds, findClipById, tracks]);

  const getClipsAtTime = useCallback((time) => {
    return getAllClips().filter(clip => clip.start <= time && clip.end > time);
  }, [getAllClips]);

  // Collision detection and resolution
  const resolveClipCollision = useCallback((newClip, tracks) => {
    const track = tracks.find(t => t.id === newClip.trackId);
    if (!track) return newClip;

    const overlapping = track.clips.find(clip => 
      clip.id !== newClip.id &&
      clip.start < newClip.end && 
      clip.end > newClip.start
    );

    if (overlapping) {
      // Move to end of overlapping clip
      return {
        ...newClip,
        start: overlapping.end,
        end: overlapping.end + newClip.duration
      };
    }

    return newClip;
  }, []);

  // Snapping logic
  const applySnapping = useCallback((targetTime, excludeClipId, tracks) => {
    const snapPoints = [];
    
    // Add clip boundaries as snap points
    tracks.forEach(track => {
      track.clips.forEach(clip => {
        if (clip.id !== excludeClipId) {
          snapPoints.push(clip.start, clip.end);
        }
      });
    });

    // Add timeline markers (if any)
    snapPoints.push(...snapPointsRef.current);

    // Find closest snap point
    const closest = snapPoints.reduce((prev, curr) => 
      Math.abs(curr - targetTime) < Math.abs(prev - targetTime) ? curr : prev
    , targetTime);

    return Math.abs(closest - targetTime) <= SNAP_THRESHOLD ? closest : targetTime;
  }, []);

  /**
   * Add clip to specific track from asset
   */
  const addClipFromAsset = useCallback((trackId, asset, position = 0) => {
    // Extract duration from asset metadata or use defaults
    let duration = asset.duration || 3;
    
    // Set appropriate duration based on asset type
    if (asset.type === 'image') {
      duration = 5; // 5 seconds for images
    } else if (asset.type === 'text') {
      duration = 3; // 3 seconds for text
    } else if (asset.type === 'font') {
      duration = 3; // 3 seconds for font preview
    }

    // Handle source URL properly - don't use createObjectURL for external URLs
    let sourceUrl = asset.url || asset.src || asset.thumbnail;
    let thumbnailUrl = asset.thumbnail;
    
    // Only use createObjectURL for File objects
    if (asset.file && asset.file instanceof File) {
      try {
        sourceUrl = URL.createObjectURL(asset.file);
        if (asset.type === 'image') {
          thumbnailUrl = sourceUrl;
        }
      } catch (error) {
        console.warn('Failed to create object URL for file:', error);
        // Fall back to original URL if available
        sourceUrl = asset.url || asset.src || asset.thumbnail || '';
      }
    }

    const newClip = {
      id: `clip-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      trackId,
      start: position,
      duration: duration,
      end: position + duration,
      
      // Asset properties
      type: asset.type,
      source: sourceUrl,
      name: asset.name || 'New Clip',
      assetId: asset.id,
      
      // Content properties based on type
      ...(asset.type === 'video' && {
        thumbnail: thumbnailUrl,
        volume: 1.0,
        muted: false
      }),
      ...(asset.type === 'audio' && {
        volume: 1.0,
        muted: false,
        waveform: asset.waveform
      }),
      ...(asset.type === 'image' && {
        opacity: 1.0,
        thumbnail: thumbnailUrl
      }),
      ...(asset.type === 'text' && {
        text: asset.content || asset.name,
        fontSize: 24,
        fontFamily: 'Arial',
        color: '#ffffff',
        opacity: 1.0
      }),
      ...(asset.type === 'font' && {
        text: 'Sample Text',
        fontSize: 24,
        fontFamily: asset.name,
        color: '#ffffff',
        opacity: 1.0
      }),
      
      // Transform properties
      position: { x: 0, y: 0 },
      scale: { x: 1, y: 1 },
      rotation: 0,
      
      // Trim properties
      trimStart: 0,
      trimEnd: 0,
      
      // Effects and filters
      effects: [],
      transitions: {
        in: null,
        out: null
      },
      
      // Metadata
      createdAt: new Date().toISOString(),
      fileSize: asset.size,
      originalAsset: asset
    };

    // Check for collisions and adjust position if needed
    const adjustedClip = resolveClipCollision(newClip, tracks);
    
    updateTracks(prev => prev.map(track =>
      track.id === trackId
        ? { ...track, clips: [...track.clips, adjustedClip].sort((a, b) => a.start - b.start) }
        : track
    ));

    return adjustedClip.id;
  }, [tracks, updateTracks, resolveClipCollision]);

  /**
   * Add clip to specific track
   */
  const addClip = useCallback((trackId, clipData, position = 0) => {
    const newClip = {
      id: `clip-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      trackId,
      start: position,
      duration: clipData.duration || 3,
      end: position + (clipData.duration || 3),
      
      // Content properties
      type: clipData.type || 'video',
      source: clipData.source || clipData.src,
      name: clipData.name || 'New Clip',
      
      // Visual properties
      opacity: clipData.opacity || 1.0,
      volume: clipData.volume || 1.0,
      muted: false,
      
      // Transform properties
      position: { x: 0, y: 0 },
      scale: { x: 1, y: 1 },
      rotation: 0,
      
      // Trim properties
      trimStart: 0, // How much to trim from source start
      trimEnd: 0,   // How much to trim from source end
      
      // Effects and filters
      effects: [],
      transitions: {
        in: null,
        out: null
      },
      
      // Metadata
      createdAt: new Date().toISOString(),
      ...clipData
    };

    // Check for collisions and adjust position if needed
    const adjustedClip = resolveClipCollision(newClip, tracks);
    
    updateTracks(prev => prev.map(track =>
      track.id === trackId
        ? { ...track, clips: [...track.clips, adjustedClip].sort((a, b) => a.start - b.start) }
        : track
    ));

    return adjustedClip.id;
  }, [tracks, updateTracks, resolveClipCollision]);

  /**
   * Remove clip by ID
   */
  const removeClip = useCallback((clipId) => {
    updateTracks(prev => prev.map(track => ({
      ...track,
      clips: track.clips.filter(clip => clip.id !== clipId)
    })));
    
    setSelectedClipIds(prev => prev.filter(id => id !== clipId));
  }, [updateTracks]);

  /**
   * Update clip properties
   */
  const updateClip = useCallback((clipId, updates) => {
    updateTracks(prev => prev.map(track => ({
      ...track,
      clips: track.clips.map(clip =>
        clip.id === clipId
          ? { ...clip, ...updates, end: updates.start ? updates.start + (updates.duration || clip.duration) : clip.end }
          : clip
      )
    })));
  }, [updateTracks]);

  /**
   * Move clip to new position with collision detection
   */
  const moveClip = useCallback((clipId, newStart, targetTrackId = null, shouldSnap = true) => {
    const clip = findClipById(clipId, tracks);
    if (!clip) return;

    let adjustedStart = Math.max(0, newStart);
    
    // Apply snapping to other clips and markers
    if (shouldSnap) {
      adjustedStart = applySnapping(adjustedStart, clipId, tracks);
    }

    const updates = {
      start: adjustedStart,
      end: adjustedStart + clip.duration
    };

    // If moving to different track
    if (targetTrackId && targetTrackId !== clip.trackId) {
      // Remove from current track
      updateTracks(prev => prev.map(track => ({
        ...track,
        clips: track.clips.filter(c => c.id !== clipId)
      })));
      
      // Add to new track
      updateTracks(prev => prev.map(track =>
        track.id === targetTrackId
          ? { 
              ...track, 
              clips: [...track.clips, { ...clip, ...updates, trackId: targetTrackId }]
                .sort((a, b) => a.start - b.start)
            }
          : track
      ));
    } else {
      updateClip(clipId, updates);
    }
  }, [tracks, updateClip, updateTracks, findClipById, applySnapping]);

  /**
   * Trim clip from start or end (resize functionality)
   */
  const trimClip = useCallback((clipId, newStart = null, newDuration = null) => {
    const clip = findClipById(clipId, tracks);
    if (!clip) return;

    let updates = {};

    // If newStart is provided, we're resizing from the left
    if (newStart !== null) {
      const clampedStart = Math.max(0, newStart);
      const maxStart = clip.start + clip.duration - MIN_CLIP_DURATION;
      const finalStart = Math.min(clampedStart, maxStart);
      
      updates.start = finalStart;
      updates.duration = clip.start + clip.duration - finalStart;
      updates.end = finalStart + updates.duration;
    }
    // If newDuration is provided, we're resizing from the right
    else if (newDuration !== null) {
      const clampedDuration = Math.max(MIN_CLIP_DURATION, newDuration);
      updates.duration = clampedDuration;
      updates.end = clip.start + clampedDuration;
    }

    if (Object.keys(updates).length > 0) {
      updateClip(clipId, updates);
    }
  }, [tracks, updateClip, findClipById]);

  /**
   * Split clip at specific time
   */
  const splitClip = useCallback((clipId, splitTime) => {
    const clip = findClipById(clipId, tracks);
    if (!clip || splitTime <= clip.start || splitTime >= clip.end) return null;

    const relativeTime = splitTime - clip.start;
    const firstClipDuration = relativeTime;
    const secondClipDuration = clip.duration - relativeTime;

    if (firstClipDuration < MIN_CLIP_DURATION || secondClipDuration < MIN_CLIP_DURATION) {
      return null;
    }

    // Update first clip
    updateClip(clipId, {
      duration: firstClipDuration,
      end: clip.start + firstClipDuration
    });

    // Create second clip
    const secondClipId = addClip(clip.trackId, {
      ...clip,
      start: splitTime,
      duration: secondClipDuration,
      trimStart: clip.trimStart + relativeTime,
      name: `${clip.name} (2)`
    }, splitTime);

    return { firstClipId: clipId, secondClipId };
  }, [tracks, updateClip, addClip, findClipById]);

  /**
   * Duplicate clip
   */
  const duplicateClip = useCallback((clipId, offset = null) => {
    const clip = findClipById(clipId, tracks);
    if (!clip) return null;

    const duplicateStart = offset !== null ? offset : clip.end + 0.1;
    
    return addClip(clip.trackId, {
      ...clip,
      name: `${clip.name} Copy`,
      effects: [...clip.effects], // Deep copy effects
    }, duplicateStart);
  }, [tracks, addClip, findClipById]);

  /**
   * Copy selected clips to clipboard
   */
  const copyClips = useCallback(() => {
    const selectedClips = getSelectedClips();
    setClipboardClips(selectedClips.map(clip => ({ ...clip })));
  }, [getSelectedClips]);

  /**
   * Cut selected clips to clipboard
   */
  const cutClips = useCallback(() => {
    copyClips();
    selectedClipIds.forEach(clipId => removeClip(clipId));
  }, [copyClips, selectedClipIds, removeClip]);

  /**
   * Paste clips from clipboard
   */
  const pasteClips = useCallback((targetTime = 0, targetTrackId = null) => {
    if (clipboardClips.length === 0) return [];

    const pastedClipIds = [];
    const minStart = Math.min(...clipboardClips.map(c => c.start));
    
    clipboardClips.forEach(clip => {
      const relativeStart = clip.start - minStart;
      const newStart = targetTime + relativeStart;
      const trackId = targetTrackId || clip.trackId;
      
      const newClipId = addClip(trackId, {
        ...clip,
        name: `${clip.name} (Pasted)`
      }, newStart);
      
      pastedClipIds.push(newClipId);
    });

    setSelectedClipIds(pastedClipIds);
    return pastedClipIds;
  }, [clipboardClips, addClip]);

  /**
   * Clip selection management
   */
  const selectClip = useCallback((clipId, multiSelect = false, rangeSelect = false) => {
    if (rangeSelect && selectedClipIds.length > 0) {
      // Range selection logic
      const lastSelected = selectedClipIds[selectedClipIds.length - 1];
      const allClips = getAllClips();
      const start = allClips.findIndex(c => c.id === lastSelected);
      const end = allClips.findIndex(c => c.id === clipId);
      
      if (start !== -1 && end !== -1) {
        const rangeStart = Math.min(start, end);
        const rangeEnd = Math.max(start, end);
        const rangeClipIds = allClips.slice(rangeStart, rangeEnd + 1).map(c => c.id);
        setSelectedClipIds(rangeClipIds);
        return;
      }
    }

    setSelectedClipIds(prev => {
      if (multiSelect) {
        return prev.includes(clipId)
          ? prev.filter(id => id !== clipId)
          : [...prev, clipId];
      } else {
        return [clipId];
      }
    });
  }, [selectedClipIds, getAllClips]);

  /**
   * Select clips in time range
   */
  const selectClipsInRange = useCallback((startTime, endTime, trackIds = null) => {
    const clipsInRange = getAllClips().filter(clip => {
      const inTimeRange = clip.start < endTime && clip.end > startTime;
      const inTrackRange = !trackIds || trackIds.includes(clip.trackId);
      return inTimeRange && inTrackRange;
    });

    setSelectedClipIds(clipsInRange.map(c => c.id));
  }, [getAllClips]);

  /**
   * Clear clip selection
   */
  const clearClipSelection = useCallback(() => {
    setSelectedClipIds([]);
  }, []);

  /**
   * Delete selected clips
   */
  const deleteSelectedClips = useCallback(() => {
    selectedClipIds.forEach(clipId => removeClip(clipId));
    setSelectedClipIds([]);
  }, [selectedClipIds, removeClip]);

  /**
   * Bulk update selected clips
   */
  const bulkUpdateSelectedClips = useCallback((updates) => {
    selectedClipIds.forEach(clipId => {
      updateClip(clipId, updates);
    });
  }, [selectedClipIds, updateClip]);

  /**
   * Select multiple clips (batch selection)
   */
  const selectClips = useCallback((clipIds, multiSelect = false) => {
    if (multiSelect) {
      setSelectedClipIds(prev => [...new Set([...prev, ...clipIds])]);
    } else {
      setSelectedClipIds(clipIds);
    }
  }, []);

  // Computed values
  const selectedClipCount = selectedClipIds.length;
  const totalClipCount = useMemo(() => 
    tracks.reduce((sum, track) => sum + track.clips.length, 0)
  , [tracks]);

  const selectedClips = getSelectedClips();
  const hasClipboardContent = clipboardClips.length > 0;

  return {
    // Core state
    selectedClipIds,
    selectedClips,
    selectedClipCount,
    totalClipCount,
    hasClipboardContent,
    
    // Clip CRUD operations
    addClip,
    removeClip,
    updateClip,
    duplicateClip,
    
    // Clip manipulation
    moveClip,
    trimClip,
    splitClip,
    
    // Selection management
    selectClip,
    selectClips,
    selectClipsInRange,
    clearClipSelection,
    deleteSelectedClips,
    bulkUpdateSelectedClips,
    
    // Clipboard operations
    copyClips,
    cutClips,
    pasteClips,
    
    // Utilities
    findClipById,
    getAllClips,
    getSelectedClips,
    getClipsAtTime,
    
    // Drag state management
    dragState,
    setDragState,
    resizeState,
    setResizeState,
    
    // New operations
    addClipFromAsset
  };
}; 