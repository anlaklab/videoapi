/**
 * Timeline Component - Pure UI Component with Zustand Integration
 * 
 * Professional multi-track timeline with clips, rulers, and scrubber
 * Now uses Zustand for global state management
 */

import React, { forwardRef, useCallback, useState, useEffect } from 'react';
import styled from 'styled-components';
import useEditorStore from '../../store/useEditorStore';

const TimelineContainer = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  background: #1a1a1a;
  overflow: hidden;
`;

const TimelineRuler = styled.div`
  height: 30px;
  background: #2a2a2a;
  border-bottom: 1px solid #333;
  position: relative;
  display: flex;
  align-items: center;
  padding: 0 1rem;
  font-size: 0.8rem;
  color: #666;
  overflow: hidden;
  cursor: pointer;
`;

const RulerMarks = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
`;

const RulerMark = styled.div`
  position: absolute;
  top: 0;
  width: 1px;
  background: #555;
  height: ${props => props.$major ? '20px' : '10px'};
  
  &::after {
    content: '${props => props.$label || ''}';
    position: absolute;
    top: -2px;
    left: 4px;
    font-size: 0.7rem;
    color: #999;
    white-space: nowrap;
  }
`;

const TracksContainer = styled.div`
  flex: 1;
  overflow-y: auto;
  background: #1a1a1a;
`;

const TrackRow = styled.div`
  display: flex;
  min-height: 60px;
  border-bottom: 1px solid #333;
  
  &:hover {
    background: rgba(255, 255, 255, 0.02);
  }
`;

const TrackHeader = styled.div`
  width: 150px;
  background: #2a2a2a;
  border-right: 1px solid #333;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 0.75rem;
  font-size: 0.85rem;
  color: white;
  position: sticky;
  left: 0;
  z-index: 10;
  cursor: pointer;
  
  &:hover {
    background: #333;
  }
`;

const TrackName = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex: 1;
`;

const TrackNameInput = styled.input`
  background: transparent;
  border: none;
  color: white;
  font-size: 0.85rem;
  outline: none;
  width: 100%;
  
  &:focus {
    background: #444;
    border-radius: 2px;
    padding: 2px 4px;
  }
`;

const TrackControls = styled.div`
  display: flex;
  gap: 0.25rem;
  opacity: 0;
  transition: opacity 0.2s ease;
  
  ${TrackHeader}:hover & {
    opacity: 1;
  }
`;

const TrackButton = styled.button`
  background: none;
  border: none;
  color: #666;
  cursor: pointer;
  padding: 2px;
  border-radius: 2px;
  
  &:hover {
    color: #00d4ff;
    background: rgba(0, 212, 255, 0.1);
  }
`;

const TrackContent = styled.div`
  flex: 1;
  position: relative;
  background: repeating-linear-gradient(
    90deg,
    transparent,
    transparent 49px,
    #333 49px,
    #333 50px
  );
  min-height: 60px;
  transition: background-color 0.2s ease;
  
  &.drag-over {
    background-color: rgba(0, 212, 255, 0.1);
    border: 2px dashed #00d4ff;
    border-radius: 4px;
  }
`;

const ClipElement = styled.div`
  position: absolute;
  top: 8px;
  bottom: 8px;
  background: ${props => props.$color || '#00d4ff'};
  border-radius: 4px;
  display: flex;
  align-items: center;
  padding: 0 0.5rem;
  color: white;
  font-size: 0.75rem;
  font-weight: 500;
  cursor: ${props => props.$resizing ? 'ew-resize' : 'grab'};
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  border: 2px solid ${props => props.$selected ? '#fff' : 'transparent'};
  user-select: none;
  transition: all 0.2s ease;
  
  &:hover {
    filter: brightness(1.1);
    transform: translateY(-1px);
    border-color: ${props => props.$selected ? '#fff' : 'rgba(255, 255, 255, 0.5)'};
  }
  
  /* Resize handles */
  &::before,
  &::after {
    content: '';
    position: absolute;
    top: 0;
    bottom: 0;
    width: 8px;
    background: rgba(255, 255, 255, 0.3);
    opacity: ${props => props.$selected ? 1 : 0};
    cursor: ew-resize;
    transition: opacity 0.2s ease;
    z-index: 2;
  }
  
  &::before {
    left: 0;
    border-top-left-radius: 4px;
    border-bottom-left-radius: 4px;
  }
  
  &::after {
    right: 0;
    border-top-right-radius: 4px;
    border-bottom-right-radius: 4px;
  }
  
  &:hover::before,
  &:hover::after {
    opacity: 1;
    background: rgba(255, 255, 255, 0.6);
  }
`;

const PlayheadLine = styled.div`
  position: absolute;
  top: 0;
  bottom: 0;
  width: 2px;
  background: #ff4444;
  left: ${props => props.$position}px;
  z-index: 20;
  pointer-events: none;
  
  &::before {
    content: '';
    position: absolute;
    top: -8px;
    left: -6px;
    width: 14px;
    height: 16px;
    background: #ff4444;
    clip-path: polygon(50% 100%, 0 0, 100% 0);
  }
`;

const EmptyState = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  height: 200px;
  color: #666;
  font-size: 1rem;
  text-align: center;
  flex-direction: column;
  gap: 0.5rem;
`;

const Timeline = forwardRef(({ 
  tracks, 
  clips, 
  player,
  onClipSelect,
  onClipMove,
  onClipTrim,
  onClipSplit,
  onAssetDrop,
  onTrackUpdate,
  selectedClips = [],
  ...props 
}, ref) => {
  
  const [editingTrack, setEditingTrack] = useState(null);
  const [dragState, setDragState] = useState(null);
  
  // Zustand store
  const {
    timeline,
    setPlayheadPosition,
    getPlayheadPosition,
    getZoomLevel,
    getTimelineDuration
  } = useEditorStore();

  // Get timeline values from Zustand
  const playheadPosition = getPlayheadPosition();
  const zoomLevel = getZoomLevel();
  const timelineDuration = getTimelineDuration();
  
  const pixelsPerSecond = 50 * zoomLevel;
  const playheadPixelPosition = playheadPosition * pixelsPerSecond + 150; // 150px for track header width

  // Drag and drop handlers
  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  const handleDrop = useCallback((e, trackId) => {
    e.preventDefault();
    console.log('🎯 Drop detected on track:', trackId);
    
    try {
      const jsonData = e.dataTransfer.getData('application/json');
      console.log('📦 Raw drag data:', jsonData);
      
      if (!jsonData) {
        console.error('❌ No drag data found');
        return;
      }
      
      const assetData = JSON.parse(jsonData);
      console.log('✅ Parsed asset data:', assetData);
      
      const rect = e.currentTarget.getBoundingClientRect();
      const relativeX = e.clientX - rect.left - 150; // Subtract track header width
      const timePosition = Math.max(0, relativeX / pixelsPerSecond);
      
      // Snap to grid (0.5 second intervals)
      const snappedPosition = Math.round(timePosition * 2) / 2;
      
      console.log(`🎯 Drop position: ${timePosition.toFixed(2)}s → snapped to: ${snappedPosition}s`);
      
      if (onAssetDrop) {
        console.log('🚀 Calling onAssetDrop with:', { assetData, trackId, snappedPosition });
        onAssetDrop(assetData, trackId, snappedPosition);
      } else {
        console.error('❌ onAssetDrop callback not provided');
      }
    } catch (error) {
      console.error('❌ Failed to parse dropped asset:', error);
    }
  }, [pixelsPerSecond, onAssetDrop]);

  const handleTrackDragOver = useCallback((e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    e.currentTarget.classList.add('drag-over');
  }, []);

  const handleTrackDragLeave = useCallback((e) => {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');
  }, []);

  const handleTrackDragEnter = useCallback((e) => {
    e.preventDefault();
    e.currentTarget.classList.add('drag-over');
  }, []);

  // Clip interaction handlers
  const handleClipMouseDown = useCallback((e, clip, trackId) => {
    e.stopPropagation();
    
    const rect = e.currentTarget.getBoundingClientRect();
    const relativeX = e.clientX - rect.left;
    
    // Determine interaction type based on cursor position
    let interactionType = 'move';
    if (relativeX < 8) {
      interactionType = 'resize-left';
    } else if (relativeX > rect.width - 8) {
      interactionType = 'resize-right';
    }
    
    setDragState({
      clipId: clip.id,
      trackId,
      interactionType,
      startX: e.clientX,
      startPosition: clip.start,
      startDuration: clip.duration,
      initialRect: rect
    });
    
    // Select clip
    if (onClipSelect) {
      onClipSelect(clip.id, e.ctrlKey || e.metaKey);
    }
  }, [onClipSelect]);

  const handleClipClick = useCallback((clipId) => {
    if (onClipSelect) {
      onClipSelect(clipId, false);
    }
  }, [onClipSelect]);

  // Track editing handlers
  const handleTrackNameClick = useCallback((trackId, e) => {
    e.stopPropagation();
    setEditingTrack(trackId);
  }, []);

  const handleTrackNameChange = useCallback((trackId, newName) => {
    if (onTrackUpdate) {
      onTrackUpdate(trackId, { name: newName });
    }
    setEditingTrack(null);
  }, [onTrackUpdate]);

  const handleTrackNameKeyPress = useCallback((e, trackId) => {
    if (e.key === 'Enter') {
      handleTrackNameChange(trackId, e.target.value);
    } else if (e.key === 'Escape') {
      setEditingTrack(null);
    }
  }, [handleTrackNameChange]);

  // Timeline click handler for playhead positioning
  const handleTimelineClick = useCallback((e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left - 150; // Subtract track header width
    const timePosition = Math.max(0, clickX / pixelsPerSecond);
    const clampedPosition = Math.min(timePosition, timelineDuration);
    
    setPlayheadPosition(clampedPosition);
  }, [pixelsPerSecond, timelineDuration, setPlayheadPosition]);

  // Mouse handlers for clip resizing/moving
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!dragState) return;
      
      const deltaX = e.clientX - dragState.startX;
      const deltaTime = deltaX / pixelsPerSecond;
      
      switch (dragState.interactionType) {
        case 'move':
          if (onClipMove) {
            const newPosition = Math.max(0, dragState.startPosition + deltaTime);
            onClipMove(dragState.clipId, newPosition);
          }
          break;
          
        case 'resize-left':
          if (onClipTrim) {
            const newStart = Math.max(0, dragState.startPosition + deltaTime);
            const maxStart = dragState.startPosition + dragState.startDuration - 0.1;
            const clampedStart = Math.min(newStart, maxStart);
            const newDuration = dragState.startPosition + dragState.startDuration - clampedStart;
            onClipTrim(dragState.clipId, clampedStart, newDuration);
          }
          break;
          
        case 'resize-right':
          if (onClipTrim) {
            const newDuration = Math.max(0.1, dragState.startDuration + deltaTime);
            onClipTrim(dragState.clipId, dragState.startPosition, newDuration);
          }
          break;
      }
    };

    const handleMouseUp = () => {
      setDragState(null);
    };

    if (dragState) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [dragState, pixelsPerSecond, onClipMove, onClipTrim]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const generateTimeMarkers = () => {
    const markers = [];
    const interval = Math.max(1, Math.round(5 / zoomLevel)); // Adjust interval based on zoom
    
    for (let i = 0; i <= timelineDuration; i += interval) {
      const x = i * pixelsPerSecond + 150;
      const isMajor = i % (interval * 2) === 0;
      
      markers.push(
        <RulerMark
          key={i}
          $major={isMajor}
          $label={isMajor ? formatTime(i) : ''}
          style={{ left: x }}
        />
      );
    }
    
    return markers;
  };

  return (
    <TimelineContainer ref={ref} {...props}>
      {/* Timeline Ruler */}
      <TimelineRuler onClick={handleTimelineClick}>
        <RulerMarks>
          {generateTimeMarkers()}
        </RulerMarks>
        
        {/* Playhead */}
        <PlayheadLine $position={playheadPixelPosition} />
        
        <div style={{ width: 150, flexShrink: 0 }}>Timeline</div>
        <div style={{ flex: 1, position: 'relative' }}>
          {/* Time markers are rendered above */}
        </div>
      </TimelineRuler>

      {/* Tracks */}
      <TracksContainer>
        {(!tracks?.tracks || tracks.tracks.length === 0) ? (
          <EmptyState>
            <div>No tracks available</div>
            <div style={{ fontSize: '0.8rem', color: '#555' }}>
              Add tracks to start editing your timeline
            </div>
          </EmptyState>
        ) : (
          tracks.tracks.map(track => (
            <TrackRow key={track.id}>
              <TrackHeader style={{ background: track.color + '20' }}>
                <TrackName>
                  <div
                    style={{
                      width: 12,
                      height: 12,
                      background: track.color,
                      borderRadius: '50%'
                    }}
                  />
                  {editingTrack === track.id ? (
                    <TrackNameInput
                      defaultValue={track.name}
                      onBlur={(e) => handleTrackNameChange(track.id, e.target.value)}
                      onKeyPress={(e) => handleTrackNameKeyPress(e, track.id)}
                    />
                  ) : (
                    <span 
                      onClick={(e) => handleTrackNameClick(track.id, e)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          handleTrackNameClick(track.id, e);
                        }
                      }}
                      role="button"
                      tabIndex={0}
                    >
                      {track.name}
                    </span>
                  )}
                </TrackName>
                
                <TrackControls>
                  <TrackButton
                    onClick={() => onTrackUpdate?.(track.id, { enabled: !track.enabled })}
                    style={{ color: track.enabled ? '#00d4ff' : '#666' }}
                  >
                    👁
                  </TrackButton>
                  <TrackButton
                    onClick={() => onTrackUpdate?.(track.id, { locked: !track.locked })}
                    style={{ color: track.locked ? '#ff6b6b' : '#666' }}
                  >
                    🔒
                  </TrackButton>
                </TrackControls>
              </TrackHeader>
              
              <TrackContent
                onDragOver={handleTrackDragOver}
                onDragEnter={handleTrackDragEnter}
                onDragLeave={handleTrackDragLeave}
                onDrop={(e) => {
                  handleTrackDragLeave(e);
                  handleDrop(e, track.id);
                }}
                style={{ position: 'relative' }}
              >
                {/* Playhead line extends through track content */}
                <PlayheadLine $position={playheadPixelPosition - 150} />
                
                {track.clips && track.clips.map((clip, index) => {
                  const isSelected = selectedClips.includes(clip.id);
                  const isDragging = dragState?.clipId === clip.id;
                  
                  return (
                    <ClipElement
                      key={clip.id || index}
                      $color={track.color}
                      $selected={isSelected}
                      $resizing={isDragging && dragState?.interactionType?.includes('resize')}
                      style={{
                        left: (clip.start || 0) * pixelsPerSecond,
                        width: (clip.duration || 3) * pixelsPerSecond,
                        opacity: isDragging ? 0.8 : 1
                      }}
                      onMouseDown={(e) => handleClipMouseDown(e, clip, track.id)}
                      onClick={() => handleClipClick(clip.id)}
                    >
                      {clip.name || `Clip ${index + 1}`}
                    </ClipElement>
                  );
                })}
              </TrackContent>
            </TrackRow>
          ))
        )}
      </TracksContainer>
    </TimelineContainer>
  );
});

Timeline.displayName = 'Timeline';

export default Timeline; 