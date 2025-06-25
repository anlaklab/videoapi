/**
 * Timeline Editor - Editor de timeline profesional
 * 
 * Características:
 * - Drag & Drop de clips
 * - Multi-track con diferentes tipos
 * - Zoom y navegación
 * - Cutting y trimming
 * - Keyframes y animaciones
 * - Snap to grid
 * - Undo/Redo
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import styled from 'styled-components';
import { 
  Play, 
  Pause, 
  Square, 
  SkipBack, 
  SkipForward, 
  Volume2,
  ZoomIn,
  ZoomOut,
  Scissors,
  Copy,
  Trash2,
  Move,
  RotateCcw,
  RotateCw
} from 'lucide-react';

const TimelineContainer = styled.div`
  height: 280px;
  background: #1a1a1a;
  border-top: 1px solid #333;
  display: flex;
  flex-direction: column;
  user-select: none;
`;

const TimelineHeader = styled.div`
  height: 50px;
  background: #2a2a2a;
  border-bottom: 1px solid #333;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 1rem;
`;

const PlaybackControls = styled.div`
  display: flex;
  gap: 0.5rem;
  align-items: center;
`;

const TimeDisplay = styled.div`
  font-family: 'Monaco', 'Courier New', monospace;
  font-size: 0.9rem;
  color: #00d4ff;
  min-width: 120px;
  text-align: center;
`;

const ZoomControls = styled.div`
  display: flex;
  gap: 0.5rem;
  align-items: center;
`;

const ZoomSlider = styled.input`
  width: 100px;
  height: 4px;
  background: #444;
  outline: none;
  border-radius: 2px;
  
  &::-webkit-slider-thumb {
    appearance: none;
    width: 12px;
    height: 12px;
    background: #00d4ff;
    border-radius: 50%;
    cursor: pointer;
  }
`;

const TimelineRuler = styled.div`
  height: 30px;
  background: #2a2a2a;
  border-bottom: 1px solid #333;
  position: relative;
  overflow: hidden;
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

const Playhead = styled.div`
  position: absolute;
  top: 0;
  bottom: 0;
  width: 2px;
  background: #ff6b6b;
  z-index: 10;
  pointer-events: none;
  
  &::before {
    content: '';
    position: absolute;
    top: -6px;
    left: -6px;
    width: 14px;
    height: 14px;
    background: #ff6b6b;
    clip-path: polygon(50% 100%, 0 0, 100% 0);
  }
`;

const TimelineTracks = styled.div`
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  background: #1a1a1a;
`;

const Track = styled.div`
  height: 60px;
  border-bottom: 1px solid #333;
  display: flex;
  align-items: center;
  position: relative;
  background: ${props => props.selected ? 'rgba(0, 212, 255, 0.1)' : 'transparent'};
  
  &:hover {
    background: rgba(255, 255, 255, 0.02);
  }
`;

const TrackLabel = styled.div`
  width: 120px;
  padding: 0 1rem;
  background: #2a2a2a;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-right: 1px solid #333;
  font-size: 0.8rem;
  font-weight: 500;
  flex-shrink: 0;
`;

const TrackContent = styled.div`
  flex: 1;
  height: 100%;
  position: relative;
  overflow: hidden;
  min-width: 0;
`;

const Clip = styled.div`
  position: absolute;
  height: 40px;
  top: 10px;
  background: ${props => {
    switch (props.$type) {
      case 'video': return 'linear-gradient(45deg, #ff6b6b, #ff8e8e)';
      case 'audio': return 'linear-gradient(45deg, #4ecdc4, #6ee5e0)';
      case 'text': return 'linear-gradient(45deg, #00d4ff, #33e0ff)';
      case 'image': return 'linear-gradient(45deg, #ffaa00, #ffbb33)';
      default: return 'linear-gradient(45deg, #666, #888)';
    }
  }};
  border-radius: 4px;
  border: 2px solid ${props => props.$selected ? '#fff' : 'transparent'};
  cursor: ${props => props.$dragging ? 'grabbing' : 'grab'};
  display: flex;
  align-items: center;
  padding: 0 0.5rem;
  font-size: 0.7rem;
  font-weight: 500;
  color: white;
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.5);
  transition: ${props => props.$dragging ? 'none' : 'all 0.2s ease'};
  z-index: ${props => props.$selected ? 5 : 1};
  
  &:hover {
    border-color: ${props => props.$selected ? '#fff' : 'rgba(255, 255, 255, 0.5)'};
    transform: ${props => props.$dragging ? 'none' : 'scale(1.02)'};
  }
  
  /* Resize handles */
  &::before,
  &::after {
    content: '';
    position: absolute;
    top: 0;
    bottom: 0;
    width: 6px;
    background: rgba(255, 255, 255, 0.3);
    opacity: ${props => props.$selected ? 1 : 0};
    cursor: ew-resize;
    transition: opacity 0.2s ease;
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
`;

const ClipText = styled.span`
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  margin: 0 6px;
`;

const Button = styled.button`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem;
  background: rgba(255, 255, 255, 0.1);
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.8rem;
  transition: all 0.2s ease;
  
  &:hover {
    background: rgba(255, 255, 255, 0.2);
    border-color: #00d4ff;
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const TimelineEditor = ({
  timeline,
  onTimelineChange,
  playhead,
  isPlaying,
  onPlayheadChange,
  onPlaybackToggle,
  selectedClip,
  onClipSelect,
  onClipUpdate,
  onClipDelete
}) => {
  // Estados locales
  const [zoom, setZoom] = useState(1);
  const [dragState, setDragState] = useState(null);
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [gridSize, setGridSize] = useState(1); // segundos
  const [undoStack, setUndoStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);

  // Referencias
  const timelineRef = useRef(null);
  const rulerRef = useRef(null);
  const tracksRef = useRef(null);

  // Constantes
  const PIXELS_PER_SECOND = 50 * zoom;
  const TIMELINE_WIDTH = timeline.duration * PIXELS_PER_SECOND;

  // Efectos
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!dragState) return;
      
      e.preventDefault();
      handleDrag(e);
    };

    const handleMouseUp = () => {
      if (dragState) {
        endDrag();
      }
    };

    if (dragState) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragState]);

  // Funciones de playback
  const handlePlaybackToggle = () => {
    onPlaybackToggle();
  };

  const handleStop = () => {
    onPlayheadChange(0);
  };

  const handleSkipBack = () => {
    onPlayheadChange(Math.max(0, playhead - 10));
  };

  const handleSkipForward = () => {
    onPlayheadChange(Math.min(timeline.duration, playhead + 10));
  };

  // Funciones de zoom
  const handleZoomChange = (newZoom) => {
    setZoom(Math.max(0.1, Math.min(5, newZoom)));
  };

  const handleZoomIn = () => {
    handleZoomChange(zoom * 1.5);
  };

  const handleZoomOut = () => {
    handleZoomChange(zoom / 1.5);
  };

  // Funciones de snap
  const snapToGridTime = (time) => {
    if (!snapToGrid) return time;
    return Math.round(time / gridSize) * gridSize;
  };

  const timeToPixels = (time) => {
    return time * PIXELS_PER_SECOND;
  };

  const pixelsToTime = (pixels) => {
    return pixels / PIXELS_PER_SECOND;
  };

  // Funciones de drag
  const startDrag = (clipId, trackId, dragType, startX) => {
    const clip = findClip(clipId);
    if (!clip) return;

    setDragState({
      clipId,
      trackId,
      dragType, // 'move', 'resize-left', 'resize-right'
      startX,
      startTime: clip.start,
      startDuration: clip.duration,
      originalClip: { ...clip }
    });

    onClipSelect(clipId);
  };

  const handleDrag = (e) => {
    if (!dragState || !tracksRef.current) return;

    const rect = tracksRef.current.getBoundingClientRect();
    const currentX = e.clientX - rect.left - 120; // Restar ancho del label
    const deltaX = currentX - dragState.startX;
    const deltaTime = pixelsToTime(deltaX);

    const clip = findClip(dragState.clipId);
    if (!clip) return;

    let newStart = clip.start;
    let newDuration = clip.duration;

    switch (dragState.dragType) {
      case 'move':
        newStart = snapToGridTime(Math.max(0, dragState.startTime + deltaTime));
        break;
      
      case 'resize-left':
        const newStartTime = snapToGridTime(Math.max(0, dragState.startTime + deltaTime));
        const maxStart = dragState.startTime + dragState.startDuration - 0.1;
        newStart = Math.min(newStartTime, maxStart);
        newDuration = dragState.startTime + dragState.startDuration - newStart;
        break;
      
      case 'resize-right':
        newDuration = snapToGridTime(Math.max(0.1, dragState.startDuration + deltaTime));
        break;
    }

    // Actualizar clip temporalmente
    onClipUpdate(dragState.clipId, {
      start: newStart,
      duration: newDuration
    });
  };

  const endDrag = () => {
    if (dragState) {
      // Guardar estado para undo
      saveToUndoStack();
      setDragState(null);
    }
  };

  // Funciones de clip
  const findClip = (clipId) => {
    for (const track of timeline.tracks) {
      const clip = track.clips.find(c => c.id === clipId);
      if (clip) return clip;
    }
    return null;
  };

  const handleClipMouseDown = (e, clipId, trackId) => {
    e.stopPropagation();
    
    const rect = tracksRef.current.getBoundingClientRect();
    const startX = e.clientX - rect.left - 120;
    
    // Determinar tipo de drag basado en posición del mouse
    const clipElement = e.currentTarget;
    const clipRect = clipElement.getBoundingClientRect();
    const relativeX = e.clientX - clipRect.left;
    
    let dragType = 'move';
    if (relativeX < 6) {
      dragType = 'resize-left';
    } else if (relativeX > clipRect.width - 6) {
      dragType = 'resize-right';
    }
    
    startDrag(clipId, trackId, dragType, startX);
  };

  const handleClipClick = (clipId) => {
    onClipSelect(clipId);
  };

  const handleClipDoubleClick = (clipId) => {
    // Ir al inicio del clip
    const clip = findClip(clipId);
    if (clip) {
      onPlayheadChange(clip.start);
    }
  };

  // Funciones de timeline
  const handleTimelineClick = (e) => {
    if (!rulerRef.current) return;
    
    const rect = rulerRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const time = snapToGridTime(pixelsToTime(clickX));
    
    onPlayheadChange(Math.max(0, Math.min(timeline.duration, time)));
  };

  // Funciones de undo/redo
  const saveToUndoStack = () => {
    setUndoStack(prev => [...prev.slice(-9), { ...timeline }]);
    setRedoStack([]);
  };

  const handleUndo = () => {
    if (undoStack.length === 0) return;
    
    const previousState = undoStack[undoStack.length - 1];
    setRedoStack(prev => [timeline, ...prev.slice(0, 9)]);
    setUndoStack(prev => prev.slice(0, -1));
    onTimelineChange(previousState);
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    
    const nextState = redoStack[0];
    setUndoStack(prev => [...prev, timeline]);
    setRedoStack(prev => prev.slice(1));
    onTimelineChange(nextState);
  };

  // Funciones de edición
  const handleSplitClip = () => {
    if (!selectedClip) return;
    
    const clip = findClip(selectedClip);
    if (!clip) return;
    
    const splitTime = playhead;
    if (splitTime <= clip.start || splitTime >= clip.start + clip.duration) return;
    
    saveToUndoStack();
    
    // Crear dos clips
    const firstClip = {
      ...clip,
      duration: splitTime - clip.start
    };
    
    const secondClip = {
      ...clip,
      id: `clip-${Date.now()}`,
      start: splitTime,
      duration: clip.start + clip.duration - splitTime
    };
    
    // Actualizar timeline
    const newTimeline = {
      ...timeline,
      tracks: timeline.tracks.map(track => ({
        ...track,
        clips: track.clips.map(c => {
          if (c.id === selectedClip) {
            return firstClip;
          }
          return c;
        }).concat(track.clips.some(c => c.id === selectedClip) ? [secondClip] : [])
      }))
    };
    
    onTimelineChange(newTimeline);
  };

  const handleDeleteClip = () => {
    if (!selectedClip) return;
    
    saveToUndoStack();
    onClipDelete(selectedClip);
  };

  const handleCopyClip = () => {
    if (!selectedClip) return;
    
    const clip = findClip(selectedClip);
    if (!clip) return;
    
    // Guardar en localStorage para simplificar
    localStorage.setItem('copiedClip', JSON.stringify(clip));
  };

  const handlePasteClip = () => {
    const copiedClipData = localStorage.getItem('copiedClip');
    if (!copiedClipData) return;
    
    try {
      const copiedClip = JSON.parse(copiedClipData);
      const newClip = {
        ...copiedClip,
        id: `clip-${Date.now()}`,
        start: playhead
      };
      
      saveToUndoStack();
      
      // Agregar a la primera pista del tipo apropiado
      const targetTrack = timeline.tracks.find(track => track.type === newClip.type);
      if (targetTrack) {
        const newTimeline = {
          ...timeline,
          tracks: timeline.tracks.map(track => 
            track.id === targetTrack.id
              ? { ...track, clips: [...track.clips, newClip] }
              : track
          )
        };
        onTimelineChange(newTimeline);
      }
    } catch (error) {
      console.error('Error pasting clip:', error);
    }
  };

  // Render de ruler marks
  const renderRulerMarks = () => {
    const marks = [];
    const secondsPerMark = Math.max(1, Math.round(10 / zoom));
    
    for (let i = 0; i <= timeline.duration; i += secondsPerMark) {
      const x = timeToPixels(i);
      const isMajor = i % (secondsPerMark * 5) === 0;
      
      marks.push(
        <RulerMark
          key={i}
          $major={isMajor}
          $label={isMajor ? `${Math.floor(i / 60)}:${(i % 60).toString().padStart(2, '0')}` : ''}
          style={{ left: x }}
        />
      );
    }
    
    return marks;
  };

  return (
    <TimelineContainer ref={timelineRef}>
      {/* Header */}
      <TimelineHeader>
        <PlaybackControls>
          <Button onClick={handlePlaybackToggle}>
            {isPlaying ? <Pause size={16} /> : <Play size={16} />}
          </Button>
          <Button onClick={handleStop}>
            <Square size={16} />
          </Button>
          <Button onClick={handleSkipBack}>
            <SkipBack size={16} />
          </Button>
          <Button onClick={handleSkipForward}>
            <SkipForward size={16} />
          </Button>
        </PlaybackControls>

        <TimeDisplay>
          {Math.floor(playhead / 60)}:{(playhead % 60).toFixed(1).padStart(4, '0')} / {Math.floor(timeline.duration / 60)}:{(timeline.duration % 60).toString().padStart(2, '0')}
        </TimeDisplay>

        <ZoomControls>
          <Button onClick={handleZoomOut}>
            <ZoomOut size={16} />
          </Button>
          <ZoomSlider
            type="range"
            min="0.1"
            max="5"
            step="0.1"
            value={zoom}
            onChange={(e) => handleZoomChange(parseFloat(e.target.value))}
          />
          <Button onClick={handleZoomIn}>
            <ZoomIn size={16} />
          </Button>
          
          <div style={{ width: '1px', height: '20px', background: '#555', margin: '0 0.5rem' }} />
          
          <Button onClick={handleSplitClip} disabled={!selectedClip}>
            <Scissors size={16} />
          </Button>
          <Button onClick={handleCopyClip} disabled={!selectedClip}>
            <Copy size={16} />
          </Button>
          <Button onClick={handlePasteClip}>
            Paste
          </Button>
          <Button onClick={handleDeleteClip} disabled={!selectedClip}>
            <Trash2 size={16} />
          </Button>
          
          <div style={{ width: '1px', height: '20px', background: '#555', margin: '0 0.5rem' }} />
          
          <Button onClick={handleUndo} disabled={undoStack.length === 0}>
            <RotateCcw size={16} />
          </Button>
          <Button onClick={handleRedo} disabled={redoStack.length === 0}>
            <RotateCw size={16} />
          </Button>
        </ZoomControls>
      </TimelineHeader>

      {/* Ruler */}
      <TimelineRuler ref={rulerRef} onClick={handleTimelineClick}>
        <RulerMarks>
          {renderRulerMarks()}
        </RulerMarks>
        <Playhead style={{ left: timeToPixels(playhead) }} />
      </TimelineRuler>

      {/* Tracks */}
      <TimelineTracks ref={tracksRef}>
        {timeline.tracks.map(track => (
          <Track key={track.id}>
            <TrackLabel>
              <span>{track.name}</span>
              <div style={{ display: 'flex', gap: '0.25rem' }}>
                <Button style={{ padding: '0.25rem' }}>
                  <Volume2 size={12} />
                </Button>
                <Button style={{ padding: '0.25rem' }}>
                  <Move size={12} />
                </Button>
              </div>
            </TrackLabel>
            <TrackContent style={{ width: TIMELINE_WIDTH }}>
              {track.clips.map(clip => (
                <Clip
                  key={clip.id}
                  $type={clip.type}
                  $selected={selectedClip === clip.id}
                  $dragging={dragState?.clipId === clip.id}
                  style={{
                    left: timeToPixels(clip.start),
                    width: timeToPixels(clip.duration)
                  }}
                  onMouseDown={(e) => handleClipMouseDown(e, clip.id, track.id)}
                  onClick={() => handleClipClick(clip.id)}
                  onDoubleClick={() => handleClipDoubleClick(clip.id)}
                >
                  <ClipText>
                    {clip.text || clip.name || clip.src?.split('/').pop() || clip.type}
                  </ClipText>
                </Clip>
              ))}
            </TrackContent>
          </Track>
        ))}
      </TimelineTracks>
    </TimelineContainer>
  );
};

export default TimelineEditor; 