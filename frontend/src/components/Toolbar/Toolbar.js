/**
 * Toolbar Component - Pure UI Component
 * 
 * Professional playback controls and timeline toolbar
 * Follows the pure visual component pattern without internal state
 */

import React from 'react';
import styled from 'styled-components';
import { 
  Play, Pause, Square, SkipBack, SkipForward,
  ZoomIn, ZoomOut, Plus, Settings
} from 'lucide-react';
import useEditorStore from '../../store/useEditorStore';

const ToolbarContainer = styled.div`
  display: flex;
  align-items: center;
  padding: 0.75rem 1rem;
  background: #2a2a2a;
  border-bottom: 1px solid #333;
  gap: 1rem;
`;

const ControlGroup = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const ControlButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: ${props => props.$primary ? 'linear-gradient(45deg, #00d4ff, #0099cc)' : 'rgba(255, 255, 255, 0.1)'};
  border: none;
  border-radius: 6px;
  color: white;
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    background: ${props => props.$primary ? 'linear-gradient(45deg, #00b8e6, #0088bb)' : 'rgba(255, 255, 255, 0.2)'};
    transform: translateY(-1px);
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
  }
`;

const TimeDisplay = styled.div`
  font-family: monospace;
  color: white;
  font-size: 0.9rem;
  min-width: 120px;
`;

const Divider = styled.div`
  width: 1px;
  height: 24px;
  background: #444;
`;

const ZoomDisplay = styled.div`
  color: #666;
  font-size: 0.8rem;
  min-width: 60px;
  text-align: center;
`;

const Toolbar = ({ 
  tracks, 
  clips, 
  onAddTrack, 
  onDeleteTrack 
}) => {
  // Use Zustand store instead of props
  const {
    timeline,
    setPlaybackState,
    setPlayheadPosition,
    setZoomLevel,
    getPlayheadPosition,
    getTimelineDuration,
    isPlaying,
    getZoomLevel
  } = useEditorStore();

  const currentPosition = getPlayheadPosition();
  const duration = getTimelineDuration();
  const currentlyPlaying = isPlaying();
  const zoomLevel = getZoomLevel();

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handlePlayPause = () => {
    setPlaybackState(!currentlyPlaying);
  };

  const handleStop = () => {
    setPlaybackState(false);
    setPlayheadPosition(0);
  };

  const handleSkipBack = () => {
    setPlayheadPosition(Math.max(0, currentPosition - 10));
  };

  const handleSkipForward = () => {
    setPlayheadPosition(Math.min(duration, currentPosition + 10));
  };

  const handleZoomIn = () => {
    setZoomLevel(zoomLevel * 1.2);
  };

  const handleZoomOut = () => {
    setZoomLevel(zoomLevel / 1.2);
  };

  return (
    <ToolbarContainer>
      {/* Playback Controls */}
      <ControlGroup>
        <ControlButton onClick={handleSkipBack}>
          <SkipBack size={16} />
        </ControlButton>
        
        <ControlButton 
          $primary
          onClick={handlePlayPause}
        >
          {currentlyPlaying ? <Pause size={16} /> : <Play size={16} />}
        </ControlButton>
        
        <ControlButton onClick={handleStop}>
          <Square size={16} />
        </ControlButton>
        
        <ControlButton onClick={handleSkipForward}>
          <SkipForward size={16} />
        </ControlButton>
      </ControlGroup>

      <Divider />

      {/* Time Display */}
      <TimeDisplay>
        {formatTime(currentPosition)} / {formatTime(duration)}
      </TimeDisplay>

      <Divider />

      {/* Zoom Controls */}
      <ControlGroup>
        <ControlButton onClick={handleZoomOut}>
          <ZoomOut size={16} />
        </ControlButton>
        
        <ZoomDisplay>
          {Math.round(zoomLevel * 100)}%
        </ZoomDisplay>
        
        <ControlButton onClick={handleZoomIn}>
          <ZoomIn size={16} />
        </ControlButton>
      </ControlGroup>

      <Divider />

      {/* Track Controls */}
      <ControlGroup>
        <ControlButton onClick={() => onAddTrack?.()}>
          <Plus size={16} />
        </ControlButton>
      </ControlGroup>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Settings */}
      <ControlButton>
        <Settings size={16} />
      </ControlButton>
    </ToolbarContainer>
  );
};

export default Toolbar; 