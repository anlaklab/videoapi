/**
 * Canvas Component - Enhanced Video Preview Canvas
 * 
 * Professional video preview canvas with rendering capabilities
 * Now supports multiple track types and real-time preview
 */

import React, { forwardRef, useEffect, useRef, useState, useCallback } from 'react';
import styled from 'styled-components';
import { Play, Pause, Volume2, VolumeX, Maximize2 } from 'lucide-react';

const CanvasContainer = styled.div`
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #000;
  border-radius: 8px;
  overflow: hidden;
  min-height: 300px;
`;

const VideoElement = styled.video`
  max-width: 100%;
  max-height: 100%;
  width: auto;
  height: auto;
  object-fit: contain;
  border-radius: 4px;
`;

const ImageElement = styled.img`
  max-width: 100%;
  max-height: 100%;
  width: auto;
  height: auto;
  object-fit: contain;
  border-radius: 4px;
`;

const TextOverlay = styled.div`
  position: absolute;
  color: white;
  font-size: ${props => props.$fontSize || 24}px;
  font-family: ${props => props.$fontFamily || 'Arial'};
  opacity: ${props => props.$opacity || 1};
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.8);
  pointer-events: none;
  z-index: 10;
  text-align: center;
`;

const PreviewOverlay = styled.div`
  position: absolute;
  top: 1rem;
  left: 1rem;
  background: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  font-size: 0.85rem;
  font-family: monospace;
  backdrop-filter: blur(4px);
`;

const ControlsOverlay = styled.div`
  position: absolute;
  bottom: 1rem;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 0.5rem;
  background: rgba(0, 0, 0, 0.8);
  padding: 0.5rem;
  border-radius: 8px;
  backdrop-filter: blur(4px);
  opacity: 0;
  transition: opacity 0.3s ease;
  
  ${CanvasContainer}:hover & {
    opacity: 1;
  }
`;

const ControlButton = styled.button`
  background: rgba(255, 255, 255, 0.1);
  border: none;
  border-radius: 4px;
  color: white;
  padding: 0.5rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s ease;
  
  &:hover {
    background: rgba(255, 255, 255, 0.2);
  }
`;

const NoPreviewMessage = styled.div`
  color: #666;
  text-align: center;
  font-size: 1.1rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
`;

const Canvas = forwardRef(({ 
  timeline,
  tracks = [],
  currentTime = 0,
  resolution = { width: 1920, height: 1080 },
  onVideoLoad,
  ...props 
}, ref) => {
  
  const videoRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [previewData, setPreviewData] = useState(null);

  // Get clips that should be visible at current time
  const getActiveClips = useCallback((time) => {
    if (!tracks || !Array.isArray(tracks)) return [];
    
    const activeClips = [];
    tracks.forEach(track => {
      if (track.clips && track.enabled !== false) {
        track.clips.forEach(clip => {
          if (clip.start <= time && clip.end > time) {
            activeClips.push({
              ...clip,
              trackId: track.id,
              trackType: track.type
            });
          }
        });
      }
    });
    
    return activeClips.sort((a, b) => {
      const aIsVideo = a.type === 'video' || a.type === 'image';
      const bIsVideo = b.type === 'video' || b.type === 'image';
      if (aIsVideo && !bIsVideo) return -1;
      if (!aIsVideo && bIsVideo) return 1;
      return a.start - b.start;
    });
  }, [tracks]);

  // Update active clips when time changes
  useEffect(() => {
    const activeClips = getActiveClips(currentTime);
    
    if (activeClips.length > 0) {
      const primaryClip = activeClips.find(clip => 
        clip.type === 'video' || clip.type === 'image'
      ) || activeClips[0];
      
      setPreviewData({
        clip: primaryClip,
        overlays: activeClips.filter(clip => 
          clip.type === 'text' || clip.type === 'font'
        ),
        audio: activeClips.filter(clip => 
          clip.type === 'audio'
        )
      });
    } else {
      setPreviewData(null);
    }
  }, [currentTime, getActiveClips]);

  const handlePlay = useCallback(() => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  }, [isPlaying]);

  const handleMute = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  }, [isMuted]);

  const handleFullscreen = useCallback(() => {
    if (videoRef.current) {
      if (videoRef.current.requestFullscreen) {
        videoRef.current.requestFullscreen();
      }
    }
  }, []);

  // Update video time when timeline position changes
  useEffect(() => {
    if (videoRef.current && previewData?.clip?.type === 'video') {
      const clipRelativeTime = currentTime - previewData.clip.start;
      const videoTime = Math.max(0, clipRelativeTime + (previewData.clip.trimStart || 0));
      
      if (Math.abs(videoRef.current.currentTime - videoTime) > 0.1) {
        videoRef.current.currentTime = videoTime;
      }
    }
  }, [currentTime, previewData]);

  // Handle video load
  useEffect(() => {
    if (videoRef.current && onVideoLoad) {
      const handleLoadedMetadata = () => {
        onVideoLoad(videoRef.current);
      };
      
      videoRef.current.addEventListener('loadedmetadata', handleLoadedMetadata);
      return () => {
        if (videoRef.current) {
          videoRef.current.removeEventListener('loadedmetadata', handleLoadedMetadata);
        }
      };
    }
  }, [onVideoLoad, previewData]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const renderPreviewContent = () => {
    if (!previewData || !previewData.clip) {
      return (
        <NoPreviewMessage>
          <div style={{ fontSize: '2rem', opacity: 0.3 }}>📹</div>
          <div>No content to preview</div>
          <div style={{ fontSize: '0.9rem', color: '#555' }}>
            Drag assets to the timeline to see them here
          </div>
        </NoPreviewMessage>
      );
    }

    const { clip, overlays } = previewData;

    // Render based on clip type
    switch (clip.type) {
      case 'video':
        return (
          <>
            <VideoElement
              ref={videoRef}
              src={clip.source}
              muted={isMuted}
              style={{
                opacity: clip.opacity || 1,
                transform: `
                  translate(${clip.position?.x || 0}px, ${clip.position?.y || 0}px)
                  scale(${clip.scale?.x || 1}, ${clip.scale?.y || 1})
                  rotate(${clip.rotation || 0}deg)
                `
              }}
            />
            {/* Render text overlays */}
            {overlays && overlays.map(overlay => (
              <TextOverlay
                key={overlay.id}
                $fontSize={overlay.fontSize}
                $fontFamily={overlay.fontFamily}
                $opacity={overlay.opacity}
                style={{ color: overlay.color }}
              >
                {overlay.text || overlay.name}
              </TextOverlay>
            ))}
          </>
        );

      case 'image':
        return (
          <>
            <ImageElement
              src={clip.source}
              alt={clip.name}
              style={{
                opacity: clip.opacity || 1,
                transform: `
                  translate(${clip.position?.x || 0}px, ${clip.position?.y || 0}px)
                  scale(${clip.scale?.x || 1}, ${clip.scale?.y || 1})
                  rotate(${clip.rotation || 0}deg)
                `
              }}
            />
            {/* Render text overlays */}
            {overlays && overlays.map(overlay => (
              <TextOverlay
                key={overlay.id}
                $fontSize={overlay.fontSize}
                $fontFamily={overlay.fontFamily}
                $opacity={overlay.opacity}
                style={{ color: overlay.color }}
              >
                {overlay.text || overlay.name}
              </TextOverlay>
            ))}
          </>
        );

      case 'text':
      case 'font':
        return (
          <TextOverlay
            $fontSize={clip.fontSize}
            $fontFamily={clip.fontFamily}
            $opacity={clip.opacity}
            style={{ 
              color: clip.color,
              position: 'static',
              transform: 'none'
            }}
          >
            {clip.text || clip.name}
          </TextOverlay>
        );

      default:
        return (
          <NoPreviewMessage>
            <div>Unsupported content type: {clip.type}</div>
          </NoPreviewMessage>
        );
    }
  };

  return (
    <CanvasContainer ref={ref} {...props}>
      {renderPreviewContent()}
      
      {/* Preview Information Overlay */}
      {previewData && (
        <PreviewOverlay>
          <div>{previewData.clip.name}</div>
          <div>{formatTime(currentTime)} / {formatTime(timeline?.duration || 0)}</div>
          <div>{resolution.width}×{resolution.height}</div>
        </PreviewOverlay>
      )}
      
      {/* Playback Controls */}
      {previewData?.clip?.type === 'video' && (
        <ControlsOverlay>
          <ControlButton onClick={handlePlay}>
            {isPlaying ? <Pause size={16} /> : <Play size={16} />}
          </ControlButton>
          <ControlButton onClick={handleMute}>
            {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </ControlButton>
          <ControlButton onClick={handleFullscreen}>
            <Maximize2 size={16} />
          </ControlButton>
        </ControlsOverlay>
      )}
    </CanvasContainer>
  );
});

Canvas.displayName = 'Canvas';

export default Canvas; 