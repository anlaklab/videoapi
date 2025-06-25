/**
 * useTimeline Hook - Timeline Management
 * 
 * Manages timeline state including playhead position, zoom level,
 * duration, and timeline interactions following professional
 * video editor patterns.
 */

import { useState, useCallback, useRef, useEffect } from 'react';

const ZOOM_LEVELS = [0.1, 0.25, 0.5, 0.75, 1.0, 1.5, 2.0, 3.0, 5.0, 10.0];
const SNAP_THRESHOLD = 0.5; // seconds

export const useTimeline = (initialDuration = 30) => {
  // Core timeline state
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(initialDuration);
  const [zoomLevel, setZoomLevel] = useState(1.0);
  const [isSnapping, setIsSnapping] = useState(true);
  const [selectedRange, setSelectedRange] = useState(null);
  const [markers, setMarkers] = useState([]);
  
  // Animation frame for smooth playback
  const animationRef = useRef(null);
  const lastUpdateRef = useRef(0);

  /**
   * Move playhead to specific position with optional snapping
   */
  const movePlayhead = useCallback((newPosition, forceNoSnap = false) => {
    let targetPosition = Math.max(0, Math.min(newPosition, duration));
    
    // Apply snapping if enabled
    if (isSnapping && !forceNoSnap) {
      const snapGrid = SNAP_THRESHOLD / zoomLevel;
      targetPosition = Math.round(targetPosition / snapGrid) * snapGrid;
    }
    
    setPosition(targetPosition);
  }, [duration, isSnapping, zoomLevel]);

  /**
   * Zoom timeline with bounds checking
   */
  const zoomTimeline = useCallback((newZoom) => {
    const clampedZoom = Math.max(ZOOM_LEVELS[0], Math.min(ZOOM_LEVELS[ZOOM_LEVELS.length - 1], newZoom));
    setZoomLevel(clampedZoom);
  }, []);

  /**
   * Zoom in to next level
   */
  const zoomIn = useCallback(() => {
    const currentIndex = ZOOM_LEVELS.findIndex(level => level >= zoomLevel);
    const nextIndex = Math.min(currentIndex + 1, ZOOM_LEVELS.length - 1);
    setZoomLevel(ZOOM_LEVELS[nextIndex]);
  }, [zoomLevel]);

  /**
   * Zoom out to previous level
   */
  const zoomOut = useCallback(() => {
    const currentIndex = ZOOM_LEVELS.findIndex(level => level > zoomLevel) - 1;
    const prevIndex = Math.max(currentIndex - 1, 0);
    setZoomLevel(ZOOM_LEVELS[prevIndex]);
  }, [zoomLevel]);

  /**
   * Fit timeline to container width
   */
  const zoomToFit = useCallback((containerWidth) => {
    const pixelsPerSecond = containerWidth / duration;
    const optimalZoom = pixelsPerSecond / 50; // Assuming 50px per second at 1x zoom
    zoomTimeline(optimalZoom);
  }, [duration, zoomTimeline]);

  /**
   * Jump to specific time markers
   */
  const jumpToMarker = useCallback((markerId) => {
    const marker = markers.find(m => m.id === markerId);
    if (marker) {
      movePlayhead(marker.time);
    }
  }, [markers, movePlayhead]);

  /**
   * Add time marker
   */
  const addMarker = useCallback((time, label = '', color = '#00d4ff') => {
    const newMarker = {
      id: `marker-${Date.now()}`,
      time: time ?? position,
      label,
      color
    };
    setMarkers(prev => [...prev, newMarker].sort((a, b) => a.time - b.time));
    return newMarker.id;
  }, [position]);

  /**
   * Remove time marker
   */
  const removeMarker = useCallback((markerId) => {
    setMarkers(prev => prev.filter(m => m.id !== markerId));
  }, []);

  /**
   * Set time selection range
   */
  const setTimeRange = useCallback((startTime, endTime) => {
    if (startTime >= endTime) return;
    setSelectedRange({
      start: Math.max(0, startTime),
      end: Math.min(duration, endTime)
    });
  }, [duration]);

  /**
   * Clear time selection
   */
  const clearTimeRange = useCallback(() => {
    setSelectedRange(null);
  }, []);

  /**
   * Get timeline scale information
   */
  const getTimelineScale = useCallback(() => {
    const pixelsPerSecond = 50 * zoomLevel;
    const secondsPerPixel = 1 / pixelsPerSecond;
    const visibleDuration = 1000 / pixelsPerSecond; // Assuming 1000px container
    
    return {
      pixelsPerSecond,
      secondsPerPixel,
      visibleDuration,
      totalPixels: duration * pixelsPerSecond
    };
  }, [zoomLevel, duration]);

  /**
   * Convert time to pixel position
   */
  const timeToPixels = useCallback((time) => {
    return time * 50 * zoomLevel;
  }, [zoomLevel]);

  /**
   * Convert pixel position to time
   */
  const pixelsToTime = useCallback((pixels) => {
    return pixels / (50 * zoomLevel);
  }, [zoomLevel]);

  /**
   * Smooth animation for playhead movement
   */
  const animateToPosition = useCallback((targetPosition, duration = 300) => {
    const startPosition = position;
    const startTime = Date.now();
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Ease-out animation
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      const currentPosition = startPosition + (targetPosition - startPosition) * easeProgress;
      
      setPosition(currentPosition);
      
      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      }
    };
    
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    
    animationRef.current = requestAnimationFrame(animate);
  }, [position]);

  /**
   * Update timeline duration
   */
  const updateDuration = useCallback((newDuration) => {
    const clampedDuration = Math.max(1, newDuration);
    setDuration(clampedDuration);
    
    // Adjust position if it exceeds new duration
    if (position > clampedDuration) {
      setPosition(clampedDuration);
    }
  }, [position]);

  /**
   * Toggle snapping
   */
  const toggleSnapping = useCallback(() => {
    setIsSnapping(prev => !prev);
  }, []);

  // Cleanup animation on unmount
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  // Calculate derived values
  const progress = duration > 0 ? (position / duration) * 100 : 0;
  const timelineScale = getTimelineScale();
  const isAtStart = position <= 0;
  const isAtEnd = position >= duration;

  return {
    // Core state
    position,
    duration,
    zoomLevel,
    isSnapping,
    selectedRange,
    markers,
    
    // Derived values
    progress,
    timelineScale,
    isAtStart,
    isAtEnd,
    
    // Actions
    movePlayhead,
    zoomTimeline,
    zoomIn,
    zoomOut,
    zoomToFit,
    updateDuration,
    toggleSnapping,
    animateToPosition,
    
    // Markers
    addMarker,
    removeMarker,
    jumpToMarker,
    
    // Selection
    setTimeRange,
    clearTimeRange,
    
    // Utilities
    timeToPixels,
    pixelsToTime,
    getTimelineScale
  };
}; 