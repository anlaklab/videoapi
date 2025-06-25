/**
 * Componente de Item de Asset - Individual y Reutilizable
 * Representa un asset individual en el grid con thumbnail y metadata
 */

import React, { useState } from 'react';
import styled from 'styled-components';
import { DynamicIcon } from './iconMap';

const AssetCard = styled.div`
  position: relative;
  background: #2a2a2a;
  border-radius: 8px;
  overflow: hidden;
  cursor: grab;
  transition: all 0.3s ease;
  border: 2px solid transparent;
  user-select: none;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 25px rgba(0, 0, 0, 0.3);
    border-color: #00d4ff;
  }

  &.selected {
    border-color: #00d4ff;
    box-shadow: 0 0 20px rgba(0, 212, 255, 0.3);
  }

  &.dragging {
    opacity: 0.7;
    transform: rotate(2deg) scale(0.95);
    cursor: grabbing;
    z-index: 1000;
  }

  &:active {
    cursor: grabbing;
  }
`;

const ThumbnailContainer = styled.div`
  position: relative;
  width: 100%;
  height: 80px;
  background: #1a1a1a;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  canvas {
    width: 100%;
    height: 100%;
  }
`;

const ThumbnailOverlay = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.3s ease;

  ${AssetCard}:hover & {
    opacity: 1;
  }
`;

const PlayButton = styled.button`
  background: rgba(0, 212, 255, 0.9);
  border: none;
  border-radius: 50%;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: transform 0.2s ease;

  &:hover {
    transform: scale(1.1);
  }
`;

const AssetInfo = styled.div`
  padding: 0.75rem;
`;

const AssetName = styled.div`
  font-size: 0.75rem;
  font-weight: 500;
  color: #fff;
  margin-bottom: 0.25rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const AssetMeta = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.625rem;
  color: #888;
`;

const TypeBadge = styled.span`
  background: ${({ color }) => color || '#666'};
  color: #000;
  padding: 0.125rem 0.375rem;
  border-radius: 4px;
  font-weight: 600;
  text-transform: uppercase;
`;

const Duration = styled.span`
  display: flex;
  align-items: center;
  gap: 0.25rem;
`;

const LoadingSpinner = styled.div`
  width: 20px;
  height: 20px;
  border: 2px solid #333;
  border-top: 2px solid #00d4ff;
  border-radius: 50%;
  animation: spin 1s linear infinite;

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;

const AssetItem = ({ 
  asset, 
  onClick, 
  onPlay,
  selected = false,
  dragging = false 
}) => {
  const [imageLoading, setImageLoading] = useState(true);
  const [imageError, setImageError] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const handleClick = (e) => {
    e.stopPropagation();
    onClick?.(asset);
  };

  const handlePlay = (e) => {
    e.stopPropagation();
    onPlay?.(asset);
  };

  const handleDragStart = (e) => {
    console.log('🎯 Starting drag for asset:', asset.name);
    
    // Preparar datos del asset para el drag
    const dragData = {
      id: asset.id,
      name: asset.name,
      type: asset.type,
      url: asset.url || asset.src || asset.downloadURL,
      thumbnail: asset.thumbnail || asset.thumbnailURL,
      duration: asset.duration || (asset.type === 'image' ? 5 : 3),
      size: asset.size,
      file: asset.file,
      ...asset // Incluir todos los datos del asset
    };
    
    e.dataTransfer.setData('application/json', JSON.stringify(dragData));
    e.dataTransfer.effectAllowed = 'copy';
    
    // Visual feedback
    setIsDragging(true);
    
    // Crear imagen de drag personalizada
    const dragImage = new Image();
    dragImage.src = asset.thumbnail || 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiByeD0iOCIgZmlsbD0iIzAwZDRmZiIvPgo8L3N2Zz4K';
    e.dataTransfer.setDragImage(dragImage, 20, 20);
  };

  const handleDragEnd = (e) => {
    console.log('🏁 Drag ended for asset:', asset.name);
    setIsDragging(false);
  };

  const handleMouseDown = (e) => {
    // Prevenir que el click interfiera con el drag
    if (e.button === 0) { // Solo botón izquierdo
      e.currentTarget.style.cursor = 'grabbing';
    }
  };

  const handleMouseUp = (e) => {
    e.currentTarget.style.cursor = 'grab';
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const formatDuration = (duration) => {
    if (!duration) return null;
    const minutes = Math.floor(duration / 60);
    const seconds = Math.floor(duration % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const renderThumbnail = () => {
    if (asset.thumbnail) {
      return (
        <>
          <img 
            src={asset.thumbnail} 
            alt={asset.name}
            onLoad={() => setImageLoading(false)}
            onError={() => {
              setImageError(true);
              setImageLoading(false);
            }}
          />
          {imageLoading && <LoadingSpinner />}
        </>
      );
    }

    // Fallback icon based on type
    const iconName = asset.type === 'video' ? 'Video' :
                    asset.type === 'audio' ? 'Music' :
                    asset.type === 'image' ? 'Image' :
                    asset.type === 'text' ? 'Type' : 'FileText';

    return (
      <DynamicIcon 
        name={iconName} 
        size={24} 
        color="#666" 
      />
    );
  };

  return (
    <AssetCard 
      className={`${selected ? 'selected' : ''} ${isDragging || dragging ? 'dragging' : ''}`}
      onClick={handleClick}
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      style={{
        cursor: isDragging ? 'grabbing' : 'grab',
        opacity: isDragging ? 0.7 : 1,
        transform: isDragging ? 'rotate(2deg) scale(0.95)' : 'none'
      }}
    >
      <ThumbnailContainer>
        {renderThumbnail()}
        
        {(asset.type === 'video' || asset.type === 'audio') && (
          <ThumbnailOverlay>
            <PlayButton onClick={handlePlay}>
              <DynamicIcon name="Play" size={14} color="#000" />
            </PlayButton>
          </ThumbnailOverlay>
        )}
      </ThumbnailContainer>

      <AssetInfo>
        <AssetName title={asset.name}>
          {asset.name}
        </AssetName>
        
        <AssetMeta>
          <TypeBadge color={asset.categoryColor}>
            {asset.type}
          </TypeBadge>
          
          {asset.duration && (
            <Duration>
              <DynamicIcon name="Clock" size={10} />
              {formatDuration(asset.duration)}
            </Duration>
          )}
          
          {asset.size && (
            <span>{formatFileSize(asset.size)}</span>
          )}
        </AssetMeta>
      </AssetInfo>
    </AssetCard>
  );
};

export default AssetItem; 