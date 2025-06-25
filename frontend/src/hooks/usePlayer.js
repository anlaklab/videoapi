/**
 * usePlayer Hook - Video Player Management
 * 
 * Manages video playback state, controls, and synchronization
 * with timeline following professional video editor patterns.
 */

import { useState, useCallback, useRef, useEffect } from 'react';

const PLAYBACK_RATES = [0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 2.0];
const DEFAULT_VOLUME = 1.0;

export const usePlayer = (timeline, onTimeUpdate) => {
  // Core playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(timeline?.duration || 30);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [volume, setVolume] = useState(DEFAULT_VOLUME);
  const [muted, setMuted] = useState(false);
  
  // Player state
  const [isLoading, setIsLoading] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  
  // Loop and playback modes
  const [isLooping, setIsLooping] = useState(false);
  const [playbackRegion, setPlaybackRegion] = useState(null); // { start, end }
  
  // Refs for video elements and animation
  const videoRef = useRef(null);
  const audioRefs = useRef(new Map());
  const animationFrameRef = useRef(null);
  const lastUpdateTimeRef = useRef(0);
  const playbackStartTimeRef = useRef(null);

  /**
   * Play video with proper initialization
   */
  const play = useCallback(async () => {
    if (!timeline) return;

    try {
      setIsLoading(true);
      setHasError(false);
      
      // Initialize playback start time
      playbackStartTimeRef.current = performance.now() - (currentTime * 1000);
      
      // Start video playback if video ref exists
      if (videoRef.current) {
        videoRef.current.currentTime = currentTime;
        await videoRef.current.play();
      }
      
      // Start audio playback for all audio tracks
      for (const [trackId, audioElement] of audioRefs.current) {
        if (audioElement && !audioElement.muted) {
          audioElement.currentTime = currentTime;
          try {
            await audioElement.play();
          } catch (err) {
            console.warn(`Audio track ${trackId} failed to play:`, err);
          }
        }
      }
      
      setIsPlaying(true);
      startTimeUpdateLoop();
      
    } catch (error) {
      console.error('Playback failed:', error);
      setHasError(true);
      setErrorMessage(error.message);
    } finally {
      setIsLoading(false);
    }
  }, [currentTime, timeline]);

  /**
   * Pause video playback
   */
  const pause = useCallback(() => {
    // Pause video
    if (videoRef.current) {
      videoRef.current.pause();
    }
    
    // Pause all audio tracks
    for (const [trackId, audioElement] of audioRefs.current) {
      if (audioElement) {
        audioElement.pause();
      }
    }
    
    setIsPlaying(false);
    stopTimeUpdateLoop();
  }, []);

  /**
   * Stop playback and reset to beginning
   */
  const stop = useCallback(() => {
    pause();
    seek(playbackRegion?.start || 0);
  }, [pause, playbackRegion]);

  /**
   * Seek to specific time
   */
  const seek = useCallback((time) => {
    const clampedTime = Math.max(0, Math.min(time, duration));
    setCurrentTime(clampedTime);
    
    // Update video time
    if (videoRef.current) {
      videoRef.current.currentTime = clampedTime;
    }
    
    // Update audio times
    for (const [trackId, audioElement] of audioRefs.current) {
      if (audioElement) {
        audioElement.currentTime = clampedTime;
      }
    }
    
    // Update external timeline
    if (onTimeUpdate) {
      onTimeUpdate(clampedTime);
    }
    
    // Reset playback timing if playing
    if (isPlaying) {
      playbackStartTimeRef.current = performance.now() - (clampedTime * 1000);
    }
  }, [duration, onTimeUpdate, isPlaying]);

  /**
   * Step forward by specified seconds
   */
  const stepForward = useCallback((seconds = 0.1) => {
    seek(currentTime + seconds);
  }, [currentTime, seek]);

  /**
   * Step backward by specified seconds
   */
  const stepBackward = useCallback((seconds = 0.1) => {
    seek(currentTime - seconds);
  }, [currentTime, seek]);

  /**
   * Jump to next frame (1/fps)
   */
  const nextFrame = useCallback(() => {
    const fps = timeline?.fps || 30;
    stepForward(1 / fps);
  }, [stepForward, timeline?.fps]);

  /**
   * Jump to previous frame (1/fps)
   */
  const prevFrame = useCallback(() => {
    const fps = timeline?.fps || 30;
    stepBackward(1 / fps);
  }, [stepBackward, timeline?.fps]);

  /**
   * Set playback rate
   */
  const setRate = useCallback((rate) => {
    const clampedRate = Math.max(0.1, Math.min(4.0, rate));
    setPlaybackRate(clampedRate);
    
    // Update video playback rate
    if (videoRef.current) {
      videoRef.current.playbackRate = clampedRate;
    }
    
    // Update audio playback rates
    for (const [trackId, audioElement] of audioRefs.current) {
      if (audioElement) {
        try {
          audioElement.playbackRate = clampedRate;
        } catch (err) {
          // Some browsers don't support audio playback rate
          console.warn(`Audio playback rate not supported for track ${trackId}`);
        }
      }
    }
  }, []);

  /**
   * Cycle through predefined playback rates
   */
  const cyclePlaybackRate = useCallback(() => {
    const currentIndex = PLAYBACK_RATES.findIndex(rate => Math.abs(rate - playbackRate) < 0.01);
    const nextIndex = (currentIndex + 1) % PLAYBACK_RATES.length;
    setRate(PLAYBACK_RATES[nextIndex]);
  }, [playbackRate, setRate]);

  /**
   * Set volume (0.0 to 1.0)
   */
  const setPlayerVolume = useCallback((newVolume) => {
    const clampedVolume = Math.max(0, Math.min(1, newVolume));
    setVolume(clampedVolume);
    
    // Update video volume
    if (videoRef.current) {
      videoRef.current.volume = clampedVolume;
    }
    
    // Update audio volumes
    for (const [trackId, audioElement] of audioRefs.current) {
      if (audioElement) {
        audioElement.volume = clampedVolume;
      }
    }
  }, []);

  /**
   * Toggle mute
   */
  const toggleMute = useCallback(() => {
    const newMuted = !muted;
    setMuted(newMuted);
    
    // Update video mute
    if (videoRef.current) {
      videoRef.current.muted = newMuted;
    }
    
    // Update audio mute
    for (const [trackId, audioElement] of audioRefs.current) {
      if (audioElement) {
        audioElement.muted = newMuted;
      }
    }
  }, [muted]);

  /**
   * Set playback region (loop region)
   */
  const setLoopRegion = useCallback((startTime, endTime) => {
    if (startTime >= endTime) return;
    
    setPlaybackRegion({
      start: Math.max(0, startTime),
      end: Math.min(duration, endTime)
    });
  }, [duration]);

  /**
   * Clear playback region
   */
  const clearLoopRegion = useCallback(() => {
    setPlaybackRegion(null);
  }, []);

  /**
   * Toggle loop mode
   */
  const toggleLoop = useCallback(() => {
    setIsLooping(prev => !prev);
  }, []);

  /**
   * Register audio element for track
   */
  const registerAudioElement = useCallback((trackId, audioElement) => {
    if (audioElement) {
      audioRefs.current.set(trackId, audioElement);
      
      // Sync with current player state
      audioElement.currentTime = currentTime;
      audioElement.volume = volume;
      audioElement.muted = muted;
      audioElement.playbackRate = playbackRate;
    } else {
      audioRefs.current.delete(trackId);
    }
  }, [currentTime, volume, muted, playbackRate]);

  /**
   * Time update loop for accurate playback
   */
  const startTimeUpdateLoop = useCallback(() => {
    const updateTime = () => {
      if (!isPlaying) return;
      
      const now = performance.now();
      const elapsed = (now - playbackStartTimeRef.current) / 1000 * playbackRate;
      const newTime = Math.min(elapsed, duration);
      
      // Check if we've hit the end or loop region
      const effectiveEnd = playbackRegion?.end || duration;
      
      if (newTime >= effectiveEnd) {
        if (isLooping || playbackRegion) {
          const loopStart = playbackRegion?.start || 0;
          seek(loopStart);
          playbackStartTimeRef.current = performance.now() - (loopStart * 1000);
        } else {
          pause();
          return;
        }
      } else {
        setCurrentTime(newTime);
        if (onTimeUpdate) {
          onTimeUpdate(newTime);
        }
      }
      
      animationFrameRef.current = requestAnimationFrame(updateTime);
    };
    
    animationFrameRef.current = requestAnimationFrame(updateTime);
  }, [isPlaying, playbackRate, duration, playbackRegion, isLooping, onTimeUpdate, seek, pause]);

  /**
   * Stop time update loop
   */
  const stopTimeUpdateLoop = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  }, []);

  /**
   * Handle video element load
   */
  const handleVideoLoad = useCallback((videoElement) => {
    if (videoElement) {
      videoRef.current = videoElement;
      
      // Sync with current state
      videoElement.currentTime = currentTime;
      videoElement.volume = volume;
      videoElement.muted = muted;
      videoElement.playbackRate = playbackRate;
      
      // Add event listeners
      videoElement.addEventListener('loadstart', () => setIsLoading(true));
      videoElement.addEventListener('canplay', () => setIsLoading(false));
      videoElement.addEventListener('waiting', () => setIsBuffering(true));
      videoElement.addEventListener('playing', () => setIsBuffering(false));
      videoElement.addEventListener('error', (e) => {
        setHasError(true);
        setErrorMessage(e.target.error?.message || 'Video playback error');
      });
    }
  }, [currentTime, volume, muted, playbackRate]);

  // Update duration when timeline changes
  useEffect(() => {
    if (timeline?.duration !== duration) {
      setDuration(timeline?.duration || 30);
      
      // Adjust current time if it exceeds new duration
      if (currentTime > timeline?.duration) {
        setCurrentTime(0);
      }
    }
  }, [timeline?.duration, duration, currentTime]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopTimeUpdateLoop();
      audioRefs.current.clear();
    };
  }, [stopTimeUpdateLoop]);

  // Keyboard shortcuts
  const handleKeyPress = useCallback((event) => {
    if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
      return; // Don't handle shortcuts in input fields
    }

    switch (event.key) {
      case ' ':
        event.preventDefault();
        isPlaying ? pause() : play();
        break;
      case 'ArrowLeft':
        event.preventDefault();
        event.shiftKey ? stepBackward(1) : prevFrame();
        break;
      case 'ArrowRight':
        event.preventDefault();
        event.shiftKey ? stepForward(1) : nextFrame();
        break;
      case 'Home':
        event.preventDefault();
        seek(0);
        break;
      case 'End':
        event.preventDefault();
        seek(duration);
        break;
      case 'm':
        event.preventDefault();
        toggleMute();
        break;
      case 'l':
        event.preventDefault();
        toggleLoop();
        break;
    }
  }, [isPlaying, play, pause, stepBackward, stepForward, prevFrame, nextFrame, seek, duration, toggleMute, toggleLoop]);

  // Computed values
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const isAtStart = currentTime <= 0;
  const isAtEnd = currentTime >= duration;
  const effectiveEnd = playbackRegion?.end || duration;
  const timeRemaining = effectiveEnd - currentTime;

  return {
    // Core state
    isPlaying,
    currentTime,
    duration,
    playbackRate,
    volume,
    muted,
    
    // Player state
    isLoading,
    isBuffering,
    hasError,
    errorMessage,
    
    // Loop and regions
    isLooping,
    playbackRegion,
    
    // Computed values
    progress,
    isAtStart,
    isAtEnd,
    timeRemaining,
    
    // Playback controls
    play,
    pause,
    stop,
    seek,
    stepForward,
    stepBackward,
    nextFrame,
    prevFrame,
    
    // Playback settings
    setRate,
    cyclePlaybackRate,
    setPlayerVolume,
    toggleMute,
    
    // Loop controls
    setLoopRegion,
    clearLoopRegion,
    toggleLoop,
    
    // Element management
    registerAudioElement,
    handleVideoLoad,
    videoRef,
    
    // Keyboard handling
    handleKeyPress
  };
}; 