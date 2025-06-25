/**
 * Advanced Timeline Controls - Professional Video Editing Tools
 * 
 * Features:
 * - Clip splitting and cutting
 * - Copy/Cut/Paste operations
 * - Multi-select and bulk operations
 * - Keyframe editing
 * - Transition management
 * - Audio waveform editing
 * - Speed/duration adjustment
 * - Color correction timeline
 */

import React, { useState, useCallback } from 'react';
import styled, { keyframes } from 'styled-components';
import {
  Scissors,
  Copy,
  Clipboard,
  Move,
  RotateCcw,
  RotateCw,
  Layers,
  Volume2,
  VolumeX,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Zap,
  Sliders,
  Palette,
  Clock,
  Split,
  Merge,
  AlignLeft,
  AlignCenter,
  AlignRight,
  ChevronDown,
  ChevronUp,
  Settings
} from 'lucide-react';
import useEditorStore from '../../store/useEditorStore';

const shimmer = keyframes`
  0% { background-position: -200px 0; }
  100% { background-position: calc(200px + 100%) 0; }
`;

const ControlsContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: #2a2a2a;
  border-bottom: 1px solid #333;
  border-top: 1px solid #333;
  overflow-x: auto;
  
  &::-webkit-scrollbar {
    height: 4px;
  }
  
  &::-webkit-scrollbar-track {
    background: #1a1a1a;
  }
  
  &::-webkit-scrollbar-thumb {
    background: #555;
    border-radius: 2px;
  }
`;

const ControlGroup = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 0 8px;
  border-right: 1px solid #444;
  
  &:last-child {
    border-right: none;
  }
`;

const ControlButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: ${props => props.$active ? '#00d4ff' : 'rgba(255, 255, 255, 0.1)'};
  border: none;
  border-radius: 6px;
  color: ${props => props.$active ? '#000' : '#ccc'};
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
  
  &:hover {
    background: ${props => props.$active ? '#00b8e6' : 'rgba(255, 255, 255, 0.2)'};
    color: ${props => props.$active ? '#000' : 'white'};
    transform: scale(1.05);
  }
  
  &:active {
    transform: scale(0.95);
  }
  
  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
    transform: none;
  }
  
  ${props => props.$shimmer && `
    background: linear-gradient(
      90deg,
      rgba(255, 255, 255, 0.1) 0%,
      rgba(255, 255, 255, 0.3) 50%,
      rgba(255, 255, 255, 0.1) 100%
    );
    background-size: 200px 100%;
    animation: ${shimmer} 1.5s infinite;
  `}
`;

const DropdownButton = styled.div`
  position: relative;
  display: inline-block;
`;

const DropdownContent = styled.div`
  position: absolute;
  top: 100%;
  left: 0;
  background: #2a2a2a;
  border: 1px solid #444;
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
  min-width: 200px;
  z-index: 1000;
  display: ${props => props.$show ? 'block' : 'none'};
  animation: slideDown 0.2s ease;
  
  @keyframes slideDown {
    from { opacity: 0; transform: translateY(-10px); }
    to { opacity: 1; transform: translateY(0); }
  }
`;

const DropdownItem = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  color: #ccc;
  cursor: pointer;
  transition: background 0.2s ease;
  
  &:hover {
    background: rgba(0, 212, 255, 0.1);
    color: #00d4ff;
  }
  
  &:first-child {
    border-top-left-radius: 8px;
    border-top-right-radius: 8px;
  }
  
  &:last-child {
    border-bottom-left-radius: 8px;
    border-bottom-right-radius: 8px;
  }
`;

const AdvancedSlider = styled.input`
  width: 80px;
  height: 4px;
  background: #444;
  outline: none;
  border-radius: 2px;
  margin: 0 8px;
  
  &::-webkit-slider-thumb {
    appearance: none;
    width: 12px;
    height: 12px;
    background: #00d4ff;
    border-radius: 50%;
    cursor: pointer;
    transition: all 0.2s ease;
  }
  
  &::-webkit-slider-thumb:hover {
    transform: scale(1.2);
  }
`;

const AdvancedTimelineControls = ({ 
  selectedClips = [], 
  onClipOperation,
  onTrackOperation,
  clipboard,
  undoStack,
  redoStack 
}) => {
  const [activeDropdown, setActiveDropdown] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const {
    timeline,
    selection,
    selectClips,
    clearClipSelection
  } = useEditorStore();

  // Clipboard operations
  const handleCopy = useCallback(() => {
    if (selectedClips.length === 0) return;
    setIsProcessing(true);
    
    setTimeout(() => {
      onClipOperation?.('copy', selectedClips);
      setIsProcessing(false);
    }, 500);
  }, [selectedClips, onClipOperation]);

  const handleCut = useCallback(() => {
    if (selectedClips.length === 0) return;
    setIsProcessing(true);
    
    setTimeout(() => {
      onClipOperation?.('cut', selectedClips);
      setIsProcessing(false);
    }, 500);
  }, [selectedClips, onClipOperation]);

  const handlePaste = useCallback(() => {
    if (!clipboard || clipboard.length === 0) return;
    setIsProcessing(true);
    
    setTimeout(() => {
      onClipOperation?.('paste', [], { position: timeline.position });
      setIsProcessing(false);
    }, 500);
  }, [clipboard, timeline.position, onClipOperation]);

  // Advanced editing operations
  const handleSplit = useCallback(() => {
    if (selectedClips.length === 0) return;
    onClipOperation?.('split', selectedClips, { position: timeline.position });
  }, [selectedClips, timeline.position, onClipOperation]);

  const handleMerge = useCallback(() => {
    if (selectedClips.length < 2) return;
    onClipOperation?.('merge', selectedClips);
  }, [selectedClips, onClipOperation]);

  const handleAlign = useCallback((alignment) => {
    if (selectedClips.length === 0) return;
    onClipOperation?.('align', selectedClips, { alignment });
    setActiveDropdown(null);
  }, [selectedClips, onClipOperation]);

  const handleSpeedChange = useCallback((speed) => {
    if (selectedClips.length === 0) return;
    onClipOperation?.('speed', selectedClips, { speed: parseFloat(speed) });
  }, [selectedClips, onClipOperation]);

  // Track operations
  const handleTrackMute = useCallback(() => {
    onTrackOperation?.('mute', selection.selectedTracks);
  }, [selection.selectedTracks, onTrackOperation]);

  const handleTrackSolo = useCallback(() => {
    onTrackOperation?.('solo', selection.selectedTracks);
  }, [selection.selectedTracks, onTrackOperation]);

  const handleTrackLock = useCallback(() => {
    onTrackOperation?.('lock', selection.selectedTracks);
  }, [selection.selectedTracks, onTrackOperation]);

  // Undo/Redo
  const handleUndo = useCallback(() => {
    onClipOperation?.('undo');
  }, [onClipOperation]);

  const handleRedo = useCallback(() => {
    onClipOperation?.('redo');
  }, [onClipOperation]);

  // Multi-select operations
  const handleSelectAll = useCallback(() => {
    onClipOperation?.('selectAll');
  }, [onClipOperation]);

  const handleDeselectAll = useCallback(() => {
    clearClipSelection();
  }, [clearClipSelection]);

  const toggleDropdown = (dropdownName) => {
    setActiveDropdown(activeDropdown === dropdownName ? null : dropdownName);
  };

  const hasSelection = selectedClips.length > 0;
  const hasMultipleSelection = selectedClips.length > 1;
  const hasClipboard = clipboard && clipboard.length > 0;
  const canUndo = undoStack && undoStack.length > 0;
  const canRedo = redoStack && redoStack.length > 0;

  return (
    <ControlsContainer>
      {/* Selection Controls */}
      <ControlGroup>
        <ControlButton
          onClick={handleSelectAll}
          title="Select All (Ctrl+A)"
        >
          <Layers size={16} />
        </ControlButton>
        <ControlButton
          onClick={handleDeselectAll}
          disabled={!hasSelection}
          title="Deselect All (Ctrl+D)"
        >
          <Move size={16} />
        </ControlButton>
      </ControlGroup>

      {/* Clipboard Operations */}
      <ControlGroup>
        <ControlButton
          onClick={handleCopy}
          disabled={!hasSelection}
          $shimmer={isProcessing}
          title="Copy (Ctrl+C)"
        >
          <Copy size={16} />
        </ControlButton>
        <ControlButton
          onClick={handleCut}
          disabled={!hasSelection}
          $shimmer={isProcessing}
          title="Cut (Ctrl+X)"
        >
          <Scissors size={16} />
        </ControlButton>
        <ControlButton
          onClick={handlePaste}
          disabled={!hasClipboard}
          $shimmer={isProcessing}
          title="Paste (Ctrl+V)"
        >
          <Clipboard size={16} />
        </ControlButton>
      </ControlGroup>

      {/* Editing Operations */}
      <ControlGroup>
        <ControlButton
          onClick={handleSplit}
          disabled={!hasSelection}
          title="Split at Playhead (S)"
        >
          <Split size={16} />
        </ControlButton>
        <ControlButton
          onClick={handleMerge}
          disabled={!hasMultipleSelection}
          title="Merge Selected Clips"
        >
          <Merge size={16} />
        </ControlButton>
        
        {/* Alignment Dropdown */}
        <DropdownButton>
          <ControlButton
            onClick={() => toggleDropdown('align')}
            disabled={!hasSelection}
            title="Alignment Options"
          >
            <AlignCenter size={16} />
            <ChevronDown size={12} style={{ marginLeft: 2 }} />
          </ControlButton>
          <DropdownContent $show={activeDropdown === 'align'}>
            <DropdownItem onClick={() => handleAlign('left')}>
              <AlignLeft size={16} />
              Align Left
            </DropdownItem>
            <DropdownItem onClick={() => handleAlign('center')}>
              <AlignCenter size={16} />
              Align Center
            </DropdownItem>
            <DropdownItem onClick={() => handleAlign('right')}>
              <AlignRight size={16} />
              Align Right
            </DropdownItem>
          </DropdownContent>
        </DropdownButton>
      </ControlGroup>

      {/* Speed Control */}
      <ControlGroup>
        <Clock size={16} style={{ color: '#666' }} />
        <AdvancedSlider
          type="range"
          min="0.25"
          max="4"
          step="0.25"
          defaultValue="1"
          disabled={!hasSelection}
          onChange={(e) => handleSpeedChange(e.target.value)}
          title="Speed Control"
        />
        <span style={{ fontSize: '0.7rem', color: '#666', minWidth: '30px' }}>
          1.0x
        </span>
      </ControlGroup>

      {/* Track Controls */}
      <ControlGroup>
        <ControlButton
          onClick={handleTrackMute}
          title="Mute Selected Tracks"
        >
          <VolumeX size={16} />
        </ControlButton>
        <ControlButton
          onClick={handleTrackSolo}
          title="Solo Selected Tracks"
        >
          <Volume2 size={16} />
        </ControlButton>
        <ControlButton
          onClick={handleTrackLock}
          title="Lock Selected Tracks"
        >
          <Lock size={16} />
        </ControlButton>
      </ControlGroup>

      {/* Effects & Color */}
      <ControlGroup>
        <ControlButton
          disabled={!hasSelection}
          title="Effects Panel"
        >
          <Zap size={16} />
        </ControlButton>
        <ControlButton
          disabled={!hasSelection}
          title="Color Correction"
        >
          <Palette size={16} />
        </ControlButton>
        <ControlButton
          disabled={!hasSelection}
          title="Audio Levels"
        >
          <Sliders size={16} />
        </ControlButton>
      </ControlGroup>

      {/* Undo/Redo */}
      <ControlGroup>
        <ControlButton
          onClick={handleUndo}
          disabled={!canUndo}
          title="Undo (Ctrl+Z)"
        >
          <RotateCcw size={16} />
        </ControlButton>
        <ControlButton
          onClick={handleRedo}
          disabled={!canRedo}
          title="Redo (Ctrl+Y)"
        >
          <RotateCw size={16} />
        </ControlButton>
      </ControlGroup>

      {/* Advanced Settings */}
      <ControlGroup>
        <DropdownButton>
          <ControlButton
            onClick={() => toggleDropdown('settings')}
            title="Advanced Settings"
          >
            <Settings size={16} />
            <ChevronDown size={12} style={{ marginLeft: 2 }} />
          </ControlButton>
          <DropdownContent $show={activeDropdown === 'settings'}>
            <DropdownItem>
              <Eye size={16} />
              Show Waveforms
            </DropdownItem>
            <DropdownItem>
              <Layers size={16} />
              Show Keyframes
            </DropdownItem>
            <DropdownItem>
              <Clock size={16} />
              Snap to Grid
            </DropdownItem>
            <DropdownItem>
              <Volume2 size={16} />
              Auto-Duck Audio
            </DropdownItem>
          </DropdownContent>
        </DropdownButton>
      </ControlGroup>
    </ControlsContainer>
  );
};

export default AdvancedTimelineControls; 