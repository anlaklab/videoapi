/**
 * Inspector Component - Pure UI Component
 * 
 * Professional properties panel for clips, tracks, and project settings
 * Follows the pure visual component pattern without internal state
 */

import React, { useState } from 'react';
import styled from 'styled-components';
import { 
  Settings, Layers, Sliders, 
  Eye, EyeOff, Volume2, VolumeX,
  RotateCw, Move, Palette
} from 'lucide-react';

const InspectorContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #1a1a1a;
`;

const InspectorHeader = styled.div`
  padding: 1rem;
  border-bottom: 1px solid #333;
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const Title = styled.h3`
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: white;
`;

const TabContainer = styled.div`
  display: flex;
  border-bottom: 1px solid #333;
`;

const Tab = styled.button`
  flex: 1;
  padding: 0.75rem 0.5rem;
  background: ${props => props.$active ? '#2a2a2a' : 'transparent'};
  border: none;
  border-bottom: 2px solid ${props => props.$active ? '#00d4ff' : 'transparent'};
  color: ${props => props.$active ? 'white' : '#666'};
  font-size: 0.8rem;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
  
  &:hover {
    background: #2a2a2a;
    color: white;
  }
`;

const ContentArea = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
`;

const PropertyGroup = styled.div`
  margin-bottom: 1.5rem;
`;

const GroupTitle = styled.h4`
  margin: 0 0 0.75rem 0;
  font-size: 0.85rem;
  font-weight: 600;
  color: #ccc;
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const PropertyRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.75rem;
`;

const PropertyLabel = styled.label`
  font-size: 0.8rem;
  color: #999;
  flex: 1;
`;

const PropertyControl = styled.div`
  flex: 1;
  margin-left: 0.5rem;
`;

const Slider = styled.input`
  width: 100%;
  height: 4px;
  background: #333;
  border-radius: 2px;
  outline: none;
  -webkit-appearance: none;
  
  &::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 16px;
    height: 16px;
    background: #00d4ff;
    border-radius: 50%;
    cursor: pointer;
  }
  
  &::-moz-range-thumb {
    width: 16px;
    height: 16px;
    background: #00d4ff;
    border-radius: 50%;
    cursor: pointer;
    border: none;
  }
`;

const NumberInput = styled.input`
  width: 100%;
  padding: 0.4rem;
  background: #2a2a2a;
  border: 1px solid #444;
  border-radius: 4px;
  color: white;
  font-size: 0.8rem;
  
  &:focus {
    outline: none;
    border-color: #00d4ff;
  }
`;

const ToggleButton = styled.button`
  width: 32px;
  height: 20px;
  background: ${props => props.active ? '#00d4ff' : '#444'};
  border: none;
  border-radius: 10px;
  position: relative;
  cursor: pointer;
  transition: all 0.2s ease;
  
  &::after {
    content: '';
    position: absolute;
    top: 2px;
    left: ${props => props.active ? '14px' : '2px'};
    width: 16px;
    height: 16px;
    background: white;
    border-radius: 50%;
    transition: all 0.2s ease;
  }
`;

const ColorPicker = styled.input`
  width: 40px;
  height: 24px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  background: transparent;
`;

const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 200px;
  color: #666;
  text-align: center;
  gap: 0.5rem;
`;

const Inspector = ({ 
  selectedClips, 
  selectedTracks, 
  onClipUpdate, 
  onTrackUpdate,
  project,
  onProjectUpdate 
}) => {
  const [activeTab, setActiveTab] = useState('properties');

  const tabs = [
    { id: 'properties', label: 'Properties', icon: Settings },
    { id: 'transform', label: 'Transform', icon: Move },
    { id: 'effects', label: 'Effects', icon: Sliders }
  ];

  const renderPropertiesTab = () => {
    if (selectedClips && selectedClips.length > 0) {
      const clip = selectedClips[0]; // Show first selected clip
      
      return (
        <>
          <PropertyGroup>
            <GroupTitle>Clip Properties</GroupTitle>
            
            <PropertyRow>
              <PropertyLabel>Opacity</PropertyLabel>
              <PropertyControl>
                <Slider
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={clip.opacity || 1}
                  onChange={(e) => onClipUpdate?.(clip.id, { opacity: parseFloat(e.target.value) })}
                />
              </PropertyControl>
            </PropertyRow>
            
            <PropertyRow>
              <PropertyLabel>Volume</PropertyLabel>
              <PropertyControl>
                <Slider
                  type="range"
                  min="0"
                  max="2"
                  step="0.01"
                  value={clip.volume || 1}
                  onChange={(e) => onClipUpdate?.(clip.id, { volume: parseFloat(e.target.value) })}
                />
              </PropertyControl>
            </PropertyRow>
            
            <PropertyRow>
              <PropertyLabel>Muted</PropertyLabel>
              <PropertyControl>
                <ToggleButton
                  active={clip.muted}
                  onClick={() => onClipUpdate?.(clip.id, { muted: !clip.muted })}
                />
              </PropertyControl>
            </PropertyRow>
          </PropertyGroup>
          
          <PropertyGroup>
            <GroupTitle>Timing</GroupTitle>
            
            <PropertyRow>
              <PropertyLabel>Start</PropertyLabel>
              <PropertyControl>
                <NumberInput
                  type="number"
                  step="0.1"
                  value={clip.start || 0}
                  onChange={(e) => onClipUpdate?.(clip.id, { start: parseFloat(e.target.value) })}
                />
              </PropertyControl>
            </PropertyRow>
            
            <PropertyRow>
              <PropertyLabel>Duration</PropertyLabel>
              <PropertyControl>
                <NumberInput
                  type="number"
                  step="0.1"
                  value={clip.duration || 3}
                  onChange={(e) => onClipUpdate?.(clip.id, { duration: parseFloat(e.target.value) })}
                />
              </PropertyControl>
            </PropertyRow>
          </PropertyGroup>
        </>
      );
    }
    
    if (selectedTracks && selectedTracks.length > 0) {
      const track = selectedTracks[0]; // Show first selected track
      
      return (
        <>
          <PropertyGroup>
            <GroupTitle>Track Properties</GroupTitle>
            
            <PropertyRow>
              <PropertyLabel>Name</PropertyLabel>
              <PropertyControl>
                <NumberInput
                  type="text"
                  value={track.name || ''}
                  onChange={(e) => onTrackUpdate?.(track.id, { name: e.target.value })}
                />
              </PropertyControl>
            </PropertyRow>
            
            <PropertyRow>
              <PropertyLabel>Color</PropertyLabel>
              <PropertyControl>
                <ColorPicker
                  type="color"
                  value={track.color || '#00d4ff'}
                  onChange={(e) => onTrackUpdate?.(track.id, { color: e.target.value })}
                />
              </PropertyControl>
            </PropertyRow>
            
            <PropertyRow>
              <PropertyLabel>Enabled</PropertyLabel>
              <PropertyControl>
                <ToggleButton
                  active={track.enabled}
                  onClick={() => onTrackUpdate?.(track.id, { enabled: !track.enabled })}
                />
              </PropertyControl>
            </PropertyRow>
            
            <PropertyRow>
              <PropertyLabel>Locked</PropertyLabel>
              <PropertyControl>
                <ToggleButton
                  active={track.locked}
                  onClick={() => onTrackUpdate?.(track.id, { locked: !track.locked })}
                />
              </PropertyControl>
            </PropertyRow>
          </PropertyGroup>
        </>
      );
    }
    
    if (project) {
      return (
        <>
          <PropertyGroup>
            <GroupTitle>Project Settings</GroupTitle>
            
            <PropertyRow>
              <PropertyLabel>Name</PropertyLabel>
              <PropertyControl>
                <NumberInput
                  type="text"
                  value={project.name || ''}
                  onChange={(e) => onProjectUpdate?.({ ...project, name: e.target.value })}
                />
              </PropertyControl>
            </PropertyRow>
            
            <PropertyRow>
              <PropertyLabel>Duration</PropertyLabel>
              <PropertyControl>
                <NumberInput
                  type="number"
                  step="0.1"
                  value={project.settings?.duration || 30}
                  onChange={(e) => onProjectUpdate?.({
                    ...project,
                    settings: { ...project.settings, duration: parseFloat(e.target.value) }
                  })}
                />
              </PropertyControl>
            </PropertyRow>
            
            <PropertyRow>
              <PropertyLabel>FPS</PropertyLabel>
              <PropertyControl>
                <NumberInput
                  type="number"
                  value={project.settings?.fps || 30}
                  onChange={(e) => onProjectUpdate?.({
                    ...project,
                    settings: { ...project.settings, fps: parseInt(e.target.value) }
                  })}
                />
              </PropertyControl>
            </PropertyRow>
          </PropertyGroup>
          
          <PropertyGroup>
            <GroupTitle>Resolution</GroupTitle>
            
            <PropertyRow>
              <PropertyLabel>Width</PropertyLabel>
              <PropertyControl>
                <NumberInput
                  type="number"
                  value={project.settings?.resolution?.width || 1920}
                  onChange={(e) => onProjectUpdate?.({
                    ...project,
                    settings: {
                      ...project.settings,
                      resolution: {
                        ...project.settings?.resolution,
                        width: parseInt(e.target.value)
                      }
                    }
                  })}
                />
              </PropertyControl>
            </PropertyRow>
            
            <PropertyRow>
              <PropertyLabel>Height</PropertyLabel>
              <PropertyControl>
                <NumberInput
                  type="number"
                  value={project.settings?.resolution?.height || 1080}
                  onChange={(e) => onProjectUpdate?.({
                    ...project,
                    settings: {
                      ...project.settings,
                      resolution: {
                        ...project.settings?.resolution,
                        height: parseInt(e.target.value)
                      }
                    }
                  })}
                />
              </PropertyControl>
            </PropertyRow>
          </PropertyGroup>
        </>
      );
    }
    
    return (
      <EmptyState>
        <Settings size={32} color="#666" />
        <div>No Selection</div>
        <div style={{ fontSize: '0.8rem', color: '#555' }}>
          Select clips, tracks, or project to edit properties
        </div>
      </EmptyState>
    );
  };

  const renderTransformTab = () => {
    if (selectedClips && selectedClips.length > 0) {
      const clip = selectedClips[0];
      
      return (
        <>
          <PropertyGroup>
            <GroupTitle>Position</GroupTitle>
            
            <PropertyRow>
              <PropertyLabel>X</PropertyLabel>
              <PropertyControl>
                <NumberInput
                  type="number"
                  value={clip.position?.x || 0}
                  onChange={(e) => onClipUpdate?.(clip.id, {
                    position: { ...clip.position, x: parseFloat(e.target.value) }
                  })}
                />
              </PropertyControl>
            </PropertyRow>
            
            <PropertyRow>
              <PropertyLabel>Y</PropertyLabel>
              <PropertyControl>
                <NumberInput
                  type="number"
                  value={clip.position?.y || 0}
                  onChange={(e) => onClipUpdate?.(clip.id, {
                    position: { ...clip.position, y: parseFloat(e.target.value) }
                  })}
                />
              </PropertyControl>
            </PropertyRow>
          </PropertyGroup>
          
          <PropertyGroup>
            <GroupTitle>Scale</GroupTitle>
            
            <PropertyRow>
              <PropertyLabel>Scale X</PropertyLabel>
              <PropertyControl>
                <Slider
                  type="range"
                  min="0.1"
                  max="3"
                  step="0.01"
                  value={clip.scale?.x || 1}
                  onChange={(e) => onClipUpdate?.(clip.id, {
                    scale: { ...clip.scale, x: parseFloat(e.target.value) }
                  })}
                />
              </PropertyControl>
            </PropertyRow>
            
            <PropertyRow>
              <PropertyLabel>Scale Y</PropertyLabel>
              <PropertyControl>
                <Slider
                  type="range"
                  min="0.1"
                  max="3"
                  step="0.01"
                  value={clip.scale?.y || 1}
                  onChange={(e) => onClipUpdate?.(clip.id, {
                    scale: { ...clip.scale, y: parseFloat(e.target.value) }
                  })}
                />
              </PropertyControl>
            </PropertyRow>
          </PropertyGroup>
          
          <PropertyGroup>
            <GroupTitle>Rotation</GroupTitle>
            
            <PropertyRow>
              <PropertyLabel>Angle</PropertyLabel>
              <PropertyControl>
                <Slider
                  type="range"
                  min="0"
                  max="360"
                  step="1"
                  value={clip.rotation || 0}
                  onChange={(e) => onClipUpdate?.(clip.id, {
                    rotation: parseFloat(e.target.value)
                  })}
                />
              </PropertyControl>
            </PropertyRow>
          </PropertyGroup>
        </>
      );
    }
    
    return (
      <EmptyState>
        <Move size={32} color="#666" />
        <div>No Clip Selected</div>
        <div style={{ fontSize: '0.8rem', color: '#555' }}>
          Select a clip to adjust transform properties
        </div>
      </EmptyState>
    );
  };

  const renderEffectsTab = () => {
    return (
      <EmptyState>
        <Sliders size={32} color="#666" />
        <div>Effects Coming Soon</div>
        <div style={{ fontSize: '0.8rem', color: '#555' }}>
          Effects and filters will be available in the next update
        </div>
      </EmptyState>
    );
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'properties':
        return renderPropertiesTab();
      case 'transform':
        return renderTransformTab();
      case 'effects':
        return renderEffectsTab();
      default:
        return renderPropertiesTab();
    }
  };

  return (
    <InspectorContainer>
      <InspectorHeader>
        <Title>Inspector</Title>
      </InspectorHeader>

      <TabContainer>
        {tabs.map(tab => (
          <Tab
            key={tab.id}
            $active={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
          >
            <tab.icon size={14} />
            {tab.label}
          </Tab>
        ))}
      </TabContainer>

      <ContentArea>
        {renderTabContent()}
      </ContentArea>
    </InspectorContainer>
  );
};

export default Inspector; 