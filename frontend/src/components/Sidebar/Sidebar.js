/**
 * Sidebar Component - Arquitectura Escalable y Data-Driven
 * 
 * Sistema profesional de gestión de assets con:
 * - Configuración centralizada
 * - Componentes genéricos reutilizables
 * - Thumbnails automáticos
 * - Búsqueda y filtrado avanzado
 */

import React, { useState, useCallback, useRef } from 'react';
import styled from 'styled-components';
import { Upload, Search, Code } from 'lucide-react';

// Nuevos componentes escalables
import { assetCategories, getCategoryById, getAcceptedTypes } from '../../config/sidebarConfig';
import AssetCategory from '../AssetManagement/AssetCategory';
import AssetGrid from '../AssetManagement/AssetGrid';
import { DynamicIcon } from '../AssetManagement/iconMap';
import { useThumbnailGenerator } from '../ThumbnailGenerator/ThumbnailGenerator';

const SidebarContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  background: linear-gradient(180deg, #1a1a1a 0%, #1e1e1e 100%);
  border-right: 1px solid #333;
`;

const SidebarHeader = styled.div`
  padding: 1.25rem;
  border-bottom: 1px solid #333;
  display: flex;
  flex-direction: column;
  gap: 1rem;
`;

const Title = styled.h3`
  margin: 0;
  font-size: 1.125rem;
  font-weight: 700;
  color: white;
  background: linear-gradient(135deg, #00d4ff, #0ea5e9);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
`;

const SearchBox = styled.div`
  position: relative;
  display: flex;
  align-items: center;
`;

const SearchInput = styled.input`
  width: 100%;
  padding: 0.75rem 2.5rem 0.75rem 1rem;
  background: #2a2a2a;
  border: 1px solid #444;
  border-radius: 8px;
  color: white;
  font-size: 0.875rem;
  transition: all 0.3s ease;
  
  &:focus {
    outline: none;
    border-color: #00d4ff;
    box-shadow: 0 0 0 3px rgba(0, 212, 255, 0.1);
  }
  
  &::placeholder {
    color: #666;
  }
`;

const SearchIcon = styled(Search)`
  position: absolute;
  right: 0.75rem;
  color: #666;
  cursor: pointer;
  transition: color 0.2s ease;
  
  &:hover {
    color: #00d4ff;
  }
`;

const UploadArea = styled.div`
  padding: 1.5rem;
  border: 2px dashed #444;
  border-radius: 12px;
  text-align: center;
  cursor: pointer;
  transition: all 0.3s ease;
  background: rgba(42, 42, 42, 0.3);
  
  &:hover {
    border-color: #00d4ff;
    background: rgba(0, 212, 255, 0.05);
    transform: translateY(-1px);
  }
  
  &.dragover {
    border-color: #00d4ff;
    background: rgba(0, 212, 255, 0.1);
    box-shadow: 0 0 20px rgba(0, 212, 255, 0.2);
  }
`;

const UploadIcon = styled.div`
  margin-bottom: 0.75rem;
  color: #666;
  transition: color 0.3s ease;
  
  ${UploadArea}:hover & {
    color: #00d4ff;
  }
`;

const UploadText = styled.div`
  color: #888;
  font-size: 0.875rem;
  font-weight: 500;
  
  .highlight {
    color: #00d4ff;
    font-weight: 600;
  }
`;

const MergeFieldsButton = styled.button`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.875rem 1.25rem;
  background: linear-gradient(135deg, #6b46c1, #8b5cf6);
  border: none;
  border-radius: 8px;
  color: white;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  width: 100%;
  justify-content: center;
  
  &:hover {
    background: linear-gradient(135deg, #7c3aed, #a855f7);
    transform: translateY(-1px);
    box-shadow: 0 6px 20px rgba(139, 92, 246, 0.3);
  }
  
  &:active {
    transform: translateY(0);
  }
`;

const CategoryTabs = styled.div`
  display: flex;
  gap: 0.25rem;
  padding: 0.75rem 1rem 0 1rem;
  background: rgba(26, 26, 26, 0.95);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: none;
  position: relative;
  
  &::-webkit-scrollbar {
    display: none;
  }

  /* Scroll shadows */
  &:before,
  &:after {
    content: '';
    position: absolute;
    top: 0;
    bottom: 0;
    width: 20px;
    pointer-events: none;
    z-index: 2;
    transition: opacity 0.3s ease;
  }

  &:before {
    left: 0;
    background: linear-gradient(90deg, rgba(26, 26, 26, 1), transparent);
  }

  &:after {
    right: 0;
    background: linear-gradient(270deg, rgba(26, 26, 26, 1), transparent);
  }

  /* Smooth scrollbar track */
  &:hover {
    scrollbar-width: thin;
    scrollbar-color: rgba(255, 255, 255, 0.2) transparent;
  }

  &::-webkit-scrollbar:hover {
    height: 4px;
  }

  &::-webkit-scrollbar-track:hover {
    background: rgba(255, 255, 255, 0.05);
    border-radius: 2px;
  }

  &::-webkit-scrollbar-thumb:hover {
    background: rgba(255, 255, 255, 0.2);
    border-radius: 2px;
  }
`;

const HiddenFileInput = styled.input`
  display: none;
`;

const Sidebar = ({ 
  onAssetUpload, 
  onAssetSelect, 
  onAssetPlay,
  onOpenMergeFields,
  assets = [],
  selectedAssets = [],
  loading = false 
}) => {
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef(null);
  const [assetsLoading, setAssetsLoading] = useState(false);
  
  const { generateThumbnail } = useThumbnailGenerator();

  // Utilidades de archivo
  const getFileType = (file) => {
    const type = file.type.split('/')[0];
    if (['video', 'audio', 'image'].includes(type)) return type;
    if (file.name.match(/\.(ttf|otf|woff|woff2)$/i)) return 'font';
    if (file.name.match(/\.(txt|json|srt|vtt|md)$/i)) return 'text';
    return 'document';
  };

  const getCategoryColor = (type) => {
    const category = assetCategories.find(cat => cat.id === type);
    return category?.color || '#666';
  };

  // Manejo de archivos
  const handleFileUpload = useCallback(async (files) => {
    const fileArray = Array.from(files);
    
    try {
      setAssetsLoading(true);
      
      const processedAssets = await Promise.all(
        fileArray.map(async (file) => {
          const type = getFileType(file);
          const asset = {
            id: Date.now() + Math.random(),
            name: file.name,
            type: type,
            file: file,
            size: file.size,
            uploadedAt: new Date().toISOString(),
            categoryColor: getCategoryColor(type),
            // Crear URL temporal para preview
            url: URL.createObjectURL(file),
            src: URL.createObjectURL(file),
            downloadURL: URL.createObjectURL(file)
          };

          // Generar thumbnail automáticamente
          try {
            const thumbnail = await generateThumbnail(file, {
              width: 150,
              height: 100,
              quality: 0.8
            });
            asset.thumbnail = thumbnail.url;
            asset.thumbnailURL = thumbnail.url;
          } catch (error) {
            console.warn('Thumbnail generation failed for', file.name, error);
          }

          return asset;
        })
      );

      console.log('✅ Processed assets:', processedAssets);

      // Llamar al callback del padre para actualizar el estado
      if (onAssetUpload) {
        await onAssetUpload(processedAssets);
      }
      
    } catch (error) {
      console.error('❌ Error processing files:', error);
    } finally {
      setAssetsLoading(false);
    }
  }, [onAssetUpload, generateThumbnail, getFileType, getCategoryColor]);

  // Event handlers
  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileUpload(files);
    }
  }, [handleFileUpload]);

  const handleUploadClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileInputChange = useCallback((e) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileUpload(files);
    }
    e.target.value = '';
  }, [handleFileUpload]);

  // Filtrado de assets
  const filteredAssets = assets.filter(asset => {
    const matchesCategory = activeCategory === 'all' || asset.type === activeCategory;
    const matchesSearch = !searchTerm || 
      asset.name.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  // Contador de assets por categoría
  const getAssetCount = (categoryId) => {
    if (categoryId === 'all') return assets.length;
    return assets.filter(asset => asset.type === categoryId).length;
  };

  return (
    <SidebarContainer>
      <SidebarHeader>
        <Title>Asset Library</Title>
        
        <SearchBox>
          <SearchInput
            type="text"
            placeholder="Buscar assets..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <SearchIcon size={16} />
        </SearchBox>
        
        <MergeFieldsButton onClick={onOpenMergeFields}>
          <Code size={16} />
          Merge Fields
        </MergeFieldsButton>

        <UploadArea
          className={isDragOver ? 'dragover' : ''}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={handleUploadClick}
        >
          <UploadIcon>
            <DynamicIcon name="Upload" size={28} />
          </UploadIcon>
          <UploadText>
            <span className="highlight">Arrastra y suelta</span> archivos o <span className="highlight">haz clic</span> para subir
          </UploadText>
        </UploadArea>
        
        <HiddenFileInput
          ref={fileInputRef}
          type="file"
          multiple
          accept={getAcceptedTypes()}
          onChange={handleFileInputChange}
        />
      </SidebarHeader>

      <CategoryTabs>
        {assetCategories.map(category => (
          <AssetCategory
            key={category.id}
            category={category}
            active={activeCategory === category.id}
            onSelect={setActiveCategory}
            assetCount={getAssetCount(category.id)}
            showBadge={true}
          />
        ))}
      </CategoryTabs>

      <AssetGrid
        assets={filteredAssets}
        onAssetClick={onAssetSelect}
        onAssetPlay={onAssetPlay}
        selectedAssets={selectedAssets}
        loading={loading}
        searchQuery={searchTerm}
        activeCategory={activeCategory}
        emptyStateConfig={{
          title: 'Tu biblioteca está vacía',
          description: 'Comienza subiendo videos, imágenes, audio o texto para crear contenido increíble'
        }}
      />
    </SidebarContainer>
  );
};

export default Sidebar; 