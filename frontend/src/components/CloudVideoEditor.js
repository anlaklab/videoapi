/**
 * Cloud Video Editor - Professional State-of-the-Art Editor
 * 
 * Main editor component following the professional architecture:
 * - Clear separation between UI components and logic hooks
 * - Modular service layer for API integration
 * - Professional timeline with multi-track support
 * - Real-time collaboration features
 * - Cloud-native asset management
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import styled from 'styled-components';
import { 
  Play, Pause, Square, SkipBack, SkipForward,
  Zap, Save, Upload, Download, Settings,
  Plus, Trash2, Copy, Scissors, 
  ZoomIn, ZoomOut, Maximize2
} from 'lucide-react';

// Custom Hooks
import { useTimeline } from '../hooks/useTimeline';
import { useTracks } from '../hooks/useTracks';
import { useClips } from '../hooks/useClips';
import { usePlayer } from '../hooks/usePlayer';

// UI Components (Pure Visual Components)
import Canvas from './Canvas/Canvas';
import Timeline from './Timeline/Timeline';
import Toolbar from './Toolbar/Toolbar';
import Sidebar from './Sidebar/Sidebar';
import Inspector from './Inspector/Inspector';
import MergeFieldsManager from './MergeFields/MergeFieldsManager';
import JsonViewer from './JsonViewer';
import UploadProgressManager from './UploadProgress/UploadProgressManager';
import useEditorStore from '../store/useEditorStore';
import AdvancedTimelineControls from './Timeline/AdvancedTimelineControls';

// Services
import renderService from '../services/renderService';
import storageService from '../services/storageService';
import assetManager from '../services/AssetManager';
import { allSampleAssets } from '../data/sampleAssets';

// Styled Components
const EditorContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #0a0a0a;
  color: white;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
`;

const HeaderBar = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  background: linear-gradient(90deg, #1a1a1a 0%, #2a2a2a 100%);
  border-bottom: 1px solid #333;
  min-height: 60px;
`;

const EditorTitle = styled.h1`
  margin: 0;
  font-size: 1.2rem;
  font-weight: 600;
  background: linear-gradient(45deg, #00d4ff, #0099cc);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
`;

const MainLayout = styled.div`
  display: flex;
  flex: 1;
  overflow: hidden;
`;

const LeftPanel = styled.div`
  width: 300px;
  background: #1a1a1a;
  border-right: 1px solid #333;
  display: flex;
  flex-direction: column;
`;

const CenterPanel = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  background: #111;
`;

const RightPanel = styled.div`
  width: 320px;
  background: #1a1a1a;
  border-left: 1px solid #333;
  display: flex;
  flex-direction: column;
`;

const CanvasContainer = styled.div`
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #000;
  position: relative;
  min-height: 400px;
`;

const TimelineContainer = styled.div`
  height: 300px;
  background: #1a1a1a;
  border-top: 1px solid #333;
  display: flex;
  flex-direction: column;
`;

const StatusBar = styled.div`
  height: 32px;
  background: #2a2a2a;
  border-top: 1px solid #333;
  display: flex;
  align-items: center;
  justify-content: between;
  padding: 0 1rem;
  font-size: 0.8rem;
  color: #666;
`;

const ActionButton = styled.button`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: ${props => {
    if (props.$primary) return 'linear-gradient(45deg, #00d4ff, #0099cc)';
    if (props.$success) return 'linear-gradient(45deg, #00ff88, #00cc66)';
    if (props.$danger) return 'linear-gradient(45deg, #ff6b6b, #ff5252)';
    return 'rgba(255, 255, 255, 0.1)';
  }};
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.85rem;
  font-weight: 500;
  transition: all 0.2s ease;
  
  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(0, 212, 255, 0.3);
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
  }
`;

const BottomPanel = styled.div`
  height: ${props => props.$collapsed ? '40px' : '300px'};
  min-height: ${props => props.$collapsed ? '40px' : '200px'};
  max-height: ${props => props.$collapsed ? '40px' : '400px'};
  background: #1a1a1a;
  border-top: 1px solid #333;
  transition: height 0.3s ease;
  overflow: hidden;
  display: flex;
  flex-direction: column;
`;

const PanelHeader = styled.div`
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 1rem;
  background: #222;
  border-bottom: 1px solid #333;
  cursor: pointer;
  
  &:hover {
    background: #2a2a2a;
  }
`;

const PanelTitle = styled.h3`
  margin: 0;
  font-size: 0.875rem;
  font-weight: 600;
  color: #fff;
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const PanelContent = styled.div`
  flex: 1;
  overflow: hidden;
`;

const CloudVideoEditor = () => {
  // Zustand store
  const {
    timeline: timelineState,
    setPlayheadPosition,
    setTimelineDuration,
    setZoomLevel,
    setPlaybackState,
    startUpload,
    updateUploadProgress,
    completeUpload,
    failUpload,
    markProjectDirty,
    markProjectSaved
  } = useEditorStore();

  // Local state (keeping existing state that doesn't need to be global)
  const [project, setProject] = useState({
    id: 'project-' + Date.now(),
    name: 'Untitled Project',
    settings: {
      resolution: { width: 1920, height: 1080 },
      fps: 30,
      duration: 30
    },
    createdAt: new Date().toISOString()
  });

  const [assets, setAssets] = useState([]);
  const [selectedAssets, setSelectedAssets] = useState([]);
  const [assetsLoading, setAssetsLoading] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const [renderProgress, setRenderProgress] = useState(null);
  const [mergeFields, setMergeFields] = useState([]);
  const [isMergeFieldsOpen, setIsMergeFieldsOpen] = useState(false);
  const [jsonPanelCollapsed, setJsonPanelCollapsed] = useState(true);

  // Initialize hooks (updated to work with Zustand)
  const timeline = {
    position: timelineState.position,
    duration: timelineState.duration,
    zoomLevel: timelineState.zoomLevel,
    movePlayhead: setPlayheadPosition,
    updateDuration: setTimelineDuration,
    zoomIn: () => setZoomLevel(timelineState.zoomLevel * 1.2),
    zoomOut: () => setZoomLevel(timelineState.zoomLevel / 1.2)
  };

  const tracks = useTracks([]);
  const clips = useClips(tracks.tracks, tracks.updateTrack);
  const player = usePlayer({
    duration: timeline.duration,
    onTimeUpdate: timeline.movePlayhead
  });

  // Refs
  const canvasRef = useRef(null);
  const timelineRef = useRef(null);

  // Initialize project (only once on mount)
  useEffect(() => {
    // Set initial timeline duration
    timeline.updateDuration(30);
    
    // Create default tracks
    tracks.createTrack('video');
    tracks.createTrack('audio');
  }, []); // Empty dependency array to run only once

  // Enhanced asset upload handler with progress tracking and improved error handling
  const handleAssetUpload = useCallback(async (processedAssets) => {
    if (!processedAssets || processedAssets.length === 0) return;
    
    console.log('📥 Starting upload for assets:', processedAssets.length);
    
    try {
      const uploadPromises = processedAssets.map(async (asset) => {
        // Start upload tracking
        const uploadId = startUpload({
          filename: asset.name,
          fileSize: asset.size,
          fileType: asset.type,
          thumbnail: asset.thumbnail
        });

        try {
          // Simulate upload progress for demo
          const simulateProgress = async () => {
            for (let progress = 0; progress <= 100; progress += Math.random() * 15) {
              const clampedProgress = Math.min(100, progress);
              
              // Calculate speed and ETA
              const elapsed = Date.now() - Date.now(); // This would be actual elapsed time
              const speed = (asset.size * clampedProgress / 100) / Math.max(elapsed / 1000, 1);
              const remaining = asset.size - (asset.size * clampedProgress / 100);
              const estimatedTime = remaining / speed;

              updateUploadProgress(uploadId, clampedProgress, {
                speed: speed,
                estimatedTime: estimatedTime
              });

              if (clampedProgress >= 100) break;
              await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));
            }
          };

          // Run progress simulation
          await simulateProgress();

          // Try Firebase upload with improved error handling
          let uploadedAsset;
          try {
            uploadedAsset = await assetManager.uploadAsset(asset.file, {
              onProgress: (progress) => {
                updateUploadProgress(uploadId, progress);
              }
            });
            console.log('✅ Firebase upload successful for:', asset.name);
          } catch (firebaseError) {
            console.warn('⚠️ Firebase upload failed, using local version:', firebaseError);
            
            // Create local asset object with blob URL for immediate use
            uploadedAsset = {
              ...asset,
              id: `local-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              url: asset.file ? URL.createObjectURL(asset.file) : asset.url,
              downloadURL: asset.file ? URL.createObjectURL(asset.file) : asset.url,
              source: 'local',
              uploadStatus: 'local-fallback'
            };
            console.log('✅ Created local asset fallback:', uploadedAsset.name);
          }

          // Complete upload
          completeUpload(uploadId, uploadedAsset);
          
          return uploadedAsset;
        } catch (error) {
          console.error('❌ Upload processing failed for', asset.name, ':', error);
          failUpload(uploadId, error);
          
          // Return a fallback asset even if upload completely fails
          return {
            ...asset,
            id: `fallback-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            url: asset.file ? URL.createObjectURL(asset.file) : asset.url,
            downloadURL: asset.file ? URL.createObjectURL(asset.file) : asset.url,
            source: 'fallback',
            uploadStatus: 'failed-with-fallback'
          };
        }
      });

      const uploadResults = await Promise.all(uploadPromises);
      
      // Update local assets state
      setAssets(prev => {
        const newAssets = [...uploadResults, ...prev];
        console.log('✅ Updated assets state:', newAssets.length, 'total assets');
        return newAssets;
      });

      markProjectDirty();
      
      return uploadResults;
    } catch (error) {
      console.error('❌ Asset upload processing failed:', error);
      // Don't throw the error, just log it and return empty array
      return [];
    }
  }, [startUpload, updateUploadProgress, completeUpload, failUpload, markProjectDirty]);

  /**
   * Project Management Functions
   */
  const createNewProject = useCallback(() => {
    const newProject = {
      id: `project-${Date.now()}`,
      name: 'New Project',
      settings: {
        resolution: { width: 1920, height: 1080 },
        fps: 30,
        duration: 30
      },
      createdAt: new Date().toISOString()
    };
    
    setProject(newProject);
    timeline.updateDuration(30);
    tracks.clearSelection();
    clips.clearClipSelection();
    player.stop();
  }, [timeline, tracks, clips, player]);

  // Función para actualizar el proyecto y sincronizar con timeline
  const updateProject = useCallback((updatedProject) => {
    setProject(updatedProject);
    
    // Sincronizar duración con timeline si cambió
    if (updatedProject.settings?.duration !== project.settings?.duration) {
      console.log('🔄 Syncing timeline duration:', updatedProject.settings.duration);
      timeline.updateDuration(updatedProject.settings.duration);
    }
    
    console.log('✅ Project updated:', updatedProject.name);
  }, [project.settings?.duration, timeline]);

  const saveProject = useCallback(async () => {
    setIsLoading(true);
    
    try {
      const projectData = {
        ...project,
        timeline: {
          duration: timeline.duration,
          position: timeline.position,
          tracks: tracks.tracks
        },
        settings: project.settings,
        updatedAt: new Date().toISOString()
      };

      // Try to save to cloud storage first
      try {
        await storageService.saveProject(project.id, projectData);
        setLastSaved(new Date().toISOString());
        markProjectSaved();
        console.log('✅ Project saved to cloud successfully');
      } catch (cloudError) {
        console.warn('⚠️ Cloud save failed, using local storage fallback:', cloudError);
        
        // Fallback to localStorage
        const localData = {
          ...projectData,
          savedLocally: true,
          lastSaved: new Date().toISOString()
        };
        
        localStorage.setItem(`project_${project.id}`, JSON.stringify(localData));
        setLastSaved(new Date().toISOString());
        markProjectSaved();
        console.log('✅ Project saved to local storage as fallback');
      }
    } catch (error) {
      console.error('❌ Failed to save project:', error);
      // Don't throw the error, just log it so the UI doesn't break
    } finally {
      setIsLoading(false);
    }
  }, [project, timeline, tracks, markProjectSaved]);

  const loadProject = useCallback(async (projectId) => {
    setIsLoading(true);
    
    try {
      const projectData = await storageService.loadProject(projectId);
      
      setProject(projectData);
      timeline.updateDuration(projectData.timeline.duration);
      timeline.movePlayhead(projectData.timeline.position);
      // tracks.loadTracks(projectData.timeline.tracks); // Would need to implement
      
      console.log('✅ Project loaded successfully');
    } catch (error) {
      console.error('❌ Failed to load project:', error);
    } finally {
      setIsLoading(false);
    }
  }, [timeline]);

  /**
   * Rendering Functions
   */
  const renderVideo = useCallback(async () => {
    if (tracks.trackCount === 0) {
      console.warn('No tracks to render');
      return;
    }

    setIsLoading(true);
    setRenderProgress({ stage: 'Initializing', progress: 0 });

    try {
      // Prepare timeline data for rendering
      const renderData = {
        timeline: {
          duration: timeline.duration,
          fps: project.settings.fps,
          resolution: project.settings.resolution,
          tracks: tracks.tracks
        },
        settings: {
          quality: 'high',
          format: 'mp4'
        }
      };

      // Start render with progress tracking
      const renderJob = await renderService.renderAdvanced(
        renderData.timeline,
        renderData.settings
      );

      setRenderProgress({ stage: 'Completed', progress: 100 });
      
      console.log('✅ Video rendered successfully:', renderJob.renderJob.url);
      
      // Auto-download or display result
      if (renderJob.renderJob.url) {
        window.open(renderJob.renderJob.url, '_blank');
      }

    } catch (error) {
      console.error('❌ Render failed:', error);
      setRenderProgress(null);
    } finally {
      setIsLoading(false);
    }
  }, [timeline, tracks, project.settings]);

  const generatePreview = useCallback(async () => {
    setIsLoading(true);
    
    try {
      const previewData = {
        timeline: {
          duration: Math.min(timeline.duration, 10), // Limit preview to 10s
          fps: project.settings.fps,
          resolution: { width: 854, height: 480 }, // Lower res for preview
          tracks: tracks.tracks
        }
      };

      const preview = await renderService.renderPreview(
        previewData.timeline,
        { segment: { start: 0, duration: 10 } }
      );

      console.log('✅ Preview generated:', preview.preview.url);
      
      // Load preview in player
      if (preview.preview.url && player.videoRef.current) {
        player.videoRef.current.src = preview.preview.url;
      }

    } catch (error) {
      console.error('❌ Preview generation failed:', error);
    } finally {
      setIsLoading(false);
    }
  }, [timeline, tracks, project.settings, player]);

  /**
   * Asset Management with Sample Assets Fallback
   */
  const loadAssets = useCallback(async () => {
    setAssetsLoading(true);
    try {
      // Try to load assets from Firebase first
      const assetsFromFirebase = await assetManager.getAssets();
      
      // Combine Firebase assets with sample assets
      const combinedAssets = [...allSampleAssets, ...assetsFromFirebase];
      
      setAssets(combinedAssets);
      console.log('✅ Loaded assets:', {
        sample: allSampleAssets.length,
        firebase: assetsFromFirebase.length,
        total: combinedAssets.length
      });
    } catch (error) {
      console.warn('⚠️ Firebase assets failed, using sample assets only:', error);
      // Fallback to sample assets only
      setAssets(allSampleAssets);
      console.log('✅ Loaded sample assets only:', allSampleAssets.length);
    } finally {
      setAssetsLoading(false);
    }
  }, []);

  const handleAssetSelect = useCallback((asset) => {
    // Single selection for now
    setSelectedAssets([asset.id]);
    console.log('Selected asset:', asset.name);
  }, []);

  const handleAssetPlay = useCallback((asset) => {
    if (asset.type === 'video' || asset.type === 'audio') {
      // Create temporary player for preview
      const audio = new Audio(asset.downloadURL);
      audio.play().catch(console.error);
    }
  }, []);

  const handleAssetDrop = useCallback((asset, trackId, position) => {
    console.log('🎯 handleAssetDrop called with:', { asset: asset?.name, trackId, position });
    
    if (!asset) {
      console.error('❌ No asset provided to handleAssetDrop');
      return;
    }
    
    if (!trackId) {
      console.error('❌ No trackId provided to handleAssetDrop');
      return;
    }
    
    try {
      // Preparar datos del asset para el clip
      const assetForClip = {
        ...asset,
        file: asset.file || null,
        url: asset.url || asset.src || asset.downloadURL,
        src: asset.url || asset.src || asset.downloadURL,
        thumbnail: asset.thumbnail || asset.thumbnailURL
      };
      
      console.log('📦 Prepared asset for clip:', assetForClip);
      
      // Use the addClipFromAsset function
      const clipId = clips.addClipFromAsset(trackId, assetForClip, position);
      
      if (clipId) {
        console.log('✅ Asset successfully added to timeline:', {
          assetName: asset.name,
          trackId,
          position,
          clipId
        });
      } else {
        console.error('❌ Failed to get clipId from addClipFromAsset');
      }
      
      return clipId;
    } catch (error) {
      console.error('❌ Failed to add asset to timeline:', error);
      console.error('Asset data:', asset);
      console.error('Track ID:', trackId);
      console.error('Position:', position);
    }
  }, [clips]);

  /**
   * Merge Fields Management
   */
  const handleOpenMergeFields = useCallback(() => {
    setIsMergeFieldsOpen(true);
  }, []);

  const handleCloseMergeFields = useCallback(() => {
    setIsMergeFieldsOpen(false);
  }, []);

  const handleApplyMergeFields = useCallback((fields) => {
    setMergeFields(fields);
    
    // Apply merge fields to timeline clips
    const mergeFieldsMap = fields.reduce((acc, field) => {
      acc[field.name] = field.value;
      return acc;
    }, {});

    // Update clips with merge field values
    clips.getAllClips().forEach(clip => {
      if (clip.name && clip.name.includes('{{') && clip.name.includes('}}')) {
        let updatedName = clip.name;
        Object.entries(mergeFieldsMap).forEach(([key, value]) => {
          updatedName = updatedName.replace(new RegExp(`{{\\s*${key}\\s*}}`, 'g'), value);
        });
        clips.updateClip(clip.id, { name: updatedName });
      }
      
      if (clip.source && clip.source.includes('{{') && clip.source.includes('}}')) {
        let updatedSource = clip.source;
        Object.entries(mergeFieldsMap).forEach(([key, value]) => {
          updatedSource = updatedSource.replace(new RegExp(`{{\\s*${key}\\s*}}`, 'g'), value);
        });
        clips.updateClip(clip.id, { source: updatedSource });
      }
    });

    console.log('🔄 Applied merge fields to timeline:', fields.length);
  }, [clips]);

  /**
   * Enhanced handlers for advanced timeline operations
   */
  const handleAdvancedClipOperation = useCallback((operation, clipIds, options = {}) => {
    console.log(`🎬 Advanced clip operation: ${operation}`, { clipIds, options });
    
    switch (operation) {
      case 'copy':
        clips.copyClips();
        break;
        
      case 'cut':
        clips.cutClips();
        break;
        
      case 'paste':
        clips.pasteClips(options.position);
        break;
        
      case 'split':
        clipIds.forEach(clipId => {
          clips.splitClip(clipId, options.position);
        });
        break;
        
      case 'merge':
        // Implement merge logic
        console.log('Merging clips:', clipIds);
        break;
        
      case 'align':
        // Implement alignment logic
        console.log('Aligning clips:', clipIds, 'to', options.alignment);
        break;
        
      case 'speed':
        clipIds.forEach(clipId => {
          clips.updateClip(clipId, { 
            playbackRate: options.speed,
            duration: clips.findClipById(clipId)?.duration / options.speed 
          });
        });
        break;
        
      case 'selectAll':
        const allClipIds = clips.getAllClips().map(clip => clip.id);
        clips.selectClips(allClipIds);
        break;
        
      case 'undo':
        // Implement undo logic
        console.log('Undo operation');
        break;
        
      case 'redo':
        // Implement redo logic
        console.log('Redo operation');
        break;
        
      default:
        console.warn('Unknown clip operation:', operation);
    }
    
    markProjectDirty();
  }, [clips, markProjectDirty]);

  const handleAdvancedTrackOperation = useCallback((operation, trackIds) => {
    console.log(`🎵 Advanced track operation: ${operation}`, { trackIds });
    
    switch (operation) {
      case 'mute':
        trackIds.forEach(trackId => {
          tracks.toggleMute(trackId);
        });
        break;
        
      case 'solo':
        trackIds.forEach(trackId => {
          tracks.toggleSolo(trackId);
        });
        break;
        
      case 'lock':
        trackIds.forEach(trackId => {
          tracks.toggleLock(trackId);
        });
        break;
        
      default:
        console.warn('Unknown track operation:', operation);
    }
    
    markProjectDirty();
  }, [tracks, markProjectDirty]);

  /**
   * Keyboard Shortcuts Integration
   */
  useEffect(() => {
    const handleKeyPress = (event) => {
      // Handle player shortcuts
      player.handleKeyPress(event);
      
      // Handle editor shortcuts
      if (event.ctrlKey || event.metaKey) {
        switch (event.key) {
          case 's':
            event.preventDefault();
            saveProject();
            break;
          case 'z':
            event.preventDefault();
            // Implement undo
            break;
          case 'y':
            event.preventDefault();
            // Implement redo
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [player, saveProject]);

  /**
   * Auto-save functionality
   */
  useEffect(() => {
    const autoSaveTimer = setTimeout(() => {
      if (project.id && tracks.trackCount > 0) {
        saveProject();
      }
    }, 30000); // Auto-save every 30 seconds

    return () => clearTimeout(autoSaveTimer);
  }, [project, tracks.trackCount, saveProject]);

  // Load assets on component mount
  useEffect(() => {
    loadAssets();
  }, [loadAssets]);

  // Helper functions
  const getTrackTypeFromFile = (file) => {
    if (file.type.startsWith('video/')) return 'video';
    if (file.type.startsWith('audio/')) return 'audio';
    if (file.type.startsWith('image/')) return 'video'; // Images go to video track
    return 'video';
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <EditorContainer>
      {/* Header Bar */}
      <HeaderBar>
        <EditorTitle>JSON2VIDEO Cloud Studio</EditorTitle>
        
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <span style={{ fontSize: '0.8rem', color: '#666' }}>
            {project.name} {lastSaved && `• Saved ${formatTime((Date.now() - new Date(lastSaved)) / 1000)} ago`}
          </span>
          
          <ActionButton onClick={createNewProject}>
            <Plus size={16} />
            New
          </ActionButton>
          
          <ActionButton onClick={saveProject} disabled={isLoading}>
            <Save size={16} />
            Save
          </ActionButton>
          
          <ActionButton onClick={generatePreview}>
            <Play size={16} />
            Preview
          </ActionButton>
          
          <ActionButton $primary onClick={renderVideo} disabled={isLoading}>
            <Zap size={16} />
            {renderProgress ? `${renderProgress.stage} ${renderProgress.progress}%` : 'Render'}
          </ActionButton>
        </div>
      </HeaderBar>

      {/* Main Layout */}
      <MainLayout>
        {/* Left Sidebar - Assets & Libraries */}
        <LeftPanel>
          <Sidebar 
            onAssetUpload={handleAssetUpload}
            onAssetSelect={handleAssetSelect}
            onAssetPlay={handleAssetPlay}
            onOpenMergeFields={handleOpenMergeFields}
            assets={assets}
            selectedAssets={selectedAssets}
            loading={assetsLoading}
          />
        </LeftPanel>

        {/* Center Panel - Canvas & Timeline */}
        <CenterPanel>
          {/* Video Canvas */}
          <CanvasContainer>
            <Canvas
              ref={canvasRef}
              timeline={timeline}
              tracks={tracks.tracks}
              currentTime={timeline.position}
              resolution={project.settings.resolution}
              onVideoLoad={player.handleVideoLoad}
            />
          </CanvasContainer>

          {/* Timeline */}
          <TimelineContainer>
            <Toolbar
              tracks={tracks}
              clips={clips}
              onAddTrack={tracks.createTrack}
              onDeleteTrack={tracks.deleteTrack}
            />
            
            {/* Advanced Timeline Controls */}
            <AdvancedTimelineControls
              selectedClips={clips.selectedClipIds || []}
              onClipOperation={handleAdvancedClipOperation}
              onTrackOperation={handleAdvancedTrackOperation}
              clipboard={clips.clipboardClips || []}
              undoStack={[]} // Would need to implement undo stack
              redoStack={[]} // Would need to implement redo stack
            />
            
            <Timeline
              tracks={tracks}
              clips={clips}
              player={player}
              onClipSelect={clips.selectClip}
              onClipMove={clips.moveClip}
              onClipTrim={clips.trimClip}
              onClipSplit={clips.splitClip}
              onAssetDrop={handleAssetDrop}
              onTrackUpdate={tracks.updateTrack}
              selectedClips={clips.selectedClipIds || []}
            />
          </TimelineContainer>
        </CenterPanel>

        {/* Right Panel - Inspector & Properties */}
        <RightPanel>
          <Inspector
            selectedClips={clips.selectedClips}
            selectedTracks={tracks.getSelectedTracks()}
            onClipUpdate={clips.updateClip}
            onTrackUpdate={tracks.updateTrack}
            project={project}
            onProjectUpdate={updateProject}
          />
        </RightPanel>
      </MainLayout>

      {/* Status Bar */}
      <StatusBar>
        <div>
          {formatTime(timeline.position)} / {formatTime(timeline.duration)} • 
          {tracks.trackCount} tracks • {clips.totalClipCount} clips • 
          Zoom: {Math.round(timeline.zoomLevel * 100)}%
          {mergeFields.length > 0 && ` • Merge Fields: ${mergeFields.length} active`}
        </div>
        
        <div>
          {isLoading && 'Processing...'}
          {renderProgress && `${renderProgress.stage}: ${renderProgress.progress}%`}
        </div>
      </StatusBar>

      {/* Upload Progress Manager */}
      <UploadProgressManager />

      {/* Merge Fields Manager */}
      <MergeFieldsManager
        isOpen={isMergeFieldsOpen}
        onClose={handleCloseMergeFields}
        onApplyMergeFields={handleApplyMergeFields}
      />

      {/* Bottom Panel - JSON Viewer */}
      <BottomPanel $collapsed={jsonPanelCollapsed}>
        <JsonViewer 
          json={project} 
          title="Project Timeline JSON"
          editable={false}
          collapsed={jsonPanelCollapsed}
          onToggleCollapse={() => setJsonPanelCollapsed(!jsonPanelCollapsed)}
        />
      </BottomPanel>
    </EditorContainer>
  );
};

export default CloudVideoEditor; 