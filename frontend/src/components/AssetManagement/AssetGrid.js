/**
 * Grid de Assets Genérico - Altamente Reutilizable
 * Componente para mostrar assets en formato grid con estados y filtros
 */

import React from 'react';
import styled from 'styled-components';
import AssetItem from './AssetItem';
import { DynamicIcon } from './iconMap';

const GridContainer = styled.div`
  height: 100%;
  overflow-y: auto;
  padding: 1rem;
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 1rem;
  margin-bottom: 2rem;
`;

const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 200px;
  color: #666;
  text-align: center;
  padding: 2rem;
`;

const EmptyIcon = styled.div`
  margin-bottom: 1rem;
  opacity: 0.5;
`;

const EmptyTitle = styled.h3`
  font-size: 1.25rem;
  margin: 0 0 0.5rem 0;
  color: #888;
`;

const EmptyDescription = styled.p`
  margin: 0;
  font-size: 0.875rem;
  line-height: 1.4;
`;

const LoadingGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 1rem;
`;

const LoadingCard = styled.div`
  background: #2a2a2a;
  border-radius: 8px;
  overflow: hidden;
  animation: pulse 1.5s ease-in-out infinite;

  @keyframes pulse {
    0% { opacity: 1; }
    50% { opacity: 0.5; }
    100% { opacity: 1; }
  }
`;

const LoadingThumbnail = styled.div`
  height: 80px;
  background: #1a1a1a;
`;

const LoadingInfo = styled.div`
  padding: 0.75rem;
`;

const LoadingLine = styled.div`
  height: 12px;
  background: #1a1a1a;
  border-radius: 4px;
  margin-bottom: 0.5rem;
  
  &.short {
    width: 60%;
  }
`;

const FilterInfo = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 1rem 1rem 1rem;
  font-size: 0.875rem;
  color: #888;
  border-bottom: 1px solid #333;
  margin-bottom: 1rem;
`;

const ResultCount = styled.span`
  color: #00d4ff;
  font-weight: 600;
`;

const AssetGrid = ({ 
  assets = [], 
  onAssetClick, 
  onAssetPlay,
  selectedAssets = [],
  loading = false,
  searchQuery = '',
  activeCategory = 'all',
  emptyStateConfig = {}
}) => {
  
  const isSelected = (assetId) => selectedAssets.includes(assetId);

  const getEmptyStateContent = () => {
    if (searchQuery) {
      return {
        icon: 'Search',
        title: 'No se encontraron resultados',
        description: `No hay assets que coincidan con "${searchQuery}"`
      };
    }

    if (activeCategory !== 'all') {
      const categoryNames = {
        video: 'videos',
        audio: 'archivos de audio',
        image: 'imágenes',
        text: 'archivos de texto',
        font: 'fuentes'
      };
      
      return {
        icon: 'FolderOpen',
        title: `No hay ${categoryNames[activeCategory] || 'assets'}`,
        description: `Arrastra y suelta archivos aquí o usa el botón de subida`
      };
    }

    return {
      icon: 'Upload',
      title: 'No hay assets',
      description: 'Comienza subiendo algunos archivos para tu proyecto',
      ...emptyStateConfig
    };
  };

  const renderLoadingGrid = () => {
    return (
      <LoadingGrid>
        {Array.from({ length: 8 }).map((_, index) => (
          <LoadingCard key={index}>
            <LoadingThumbnail />
            <LoadingInfo>
              <LoadingLine />
              <LoadingLine className="short" />
            </LoadingInfo>
          </LoadingCard>
        ))}
      </LoadingGrid>
    );
  };

  const renderEmptyState = () => {
    const emptyContent = getEmptyStateContent();
    
    return (
      <EmptyState>
        <EmptyIcon>
          <DynamicIcon name={emptyContent.icon} size={48} />
        </EmptyIcon>
        <EmptyTitle>{emptyContent.title}</EmptyTitle>
        <EmptyDescription>{emptyContent.description}</EmptyDescription>
      </EmptyState>
    );
  };

  if (loading) {
    return (
      <GridContainer>
        {renderLoadingGrid()}
      </GridContainer>
    );
  }

  return (
    <GridContainer>
      {assets.length > 0 && (
        <FilterInfo>
          <ResultCount>
            {assets.length} asset{assets.length !== 1 ? 's' : ''}
            {searchQuery && ` para "${searchQuery}"`}
          </ResultCount>
          {selectedAssets.length > 0 && (
            <span>{selectedAssets.length} seleccionado{selectedAssets.length !== 1 ? 's' : ''}</span>
          )}
        </FilterInfo>
      )}

      {assets.length === 0 ? (
        renderEmptyState()
      ) : (
        <Grid>
          {assets.map(asset => (
            <AssetItem
              key={asset.id}
              asset={asset}
              onClick={onAssetClick}
              onPlay={onAssetPlay}
              selected={isSelected(asset.id)}
            />
          ))}
        </Grid>
      )}
    </GridContainer>
  );
};

export default AssetGrid; 