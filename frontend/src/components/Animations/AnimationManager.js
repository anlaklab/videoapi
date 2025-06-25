/**
 * AnimationManager - Professional Animation Management System
 * 
 * Provides comprehensive animation management with:
 * - Dynamic loading from file structure
 * - FFmpeg integration and validation
 * - Professional UI with thumbnails
 * - Real-time preview generation
 * - Category organization
 * - Search and filtering
 */

import React, { useState, useCallback, useEffect } from 'react';
import styled from 'styled-components';
import { 
  Search, Play, Download, Upload, Settings,
  AlertTriangle, CheckCircle, Loader, 
  Film, Database, Code, Zap
} from 'lucide-react';
import { useAnimations } from '../../hooks/useAnimations';
import { getIcon } from '../../utils/iconMap';

const ManagerContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #1a1a1a;
  border-radius: 8px;
  overflow: hidden;
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem;
  background: linear-gradient(90deg, #2a2a2a 0%, #1a1a1a 100%);
  border-bottom: 1px solid #333;
`;

const Title = styled.h3`
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: white;
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const StatsContainer = styled.div`
  display: flex;
  gap: 1rem;
  font-size: 0.8rem;
  color: #666;
`;

const Stat = styled.div`
  display: flex;
  align-items: center;
  gap: 0.25rem;
`;

const Controls = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 1rem;
  background: #222;
  border-bottom: 1px solid #333;
`;

const SearchInput = styled.input`
  flex: 1;
  padding: 0.5rem;
  background: #2a2a2a;
  border: 1px solid #444;
  border-radius: 4px;
  color: white;
  font-size: 0.8rem;
  
  &:focus {
    outline: none;
    border-color: #00d4ff;
  }
  
  &::placeholder {
    color: #666;
  }
`;

const FilterButton = styled.button`
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.5rem 0.75rem;
  background: ${props => props.active ? '#00d4ff' : '#333'};
  color: ${props => props.active ? 'white' : '#ccc'};
  border: none;
  border-radius: 4px;
  font-size: 0.75rem;
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    background: ${props => props.active ? '#00b8e6' : '#444'};
  }
`;

const ActionButton = styled.button`
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.5rem;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid #444;
  border-radius: 4px;
  color: #ccc;
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    background: rgba(255, 255, 255, 0.2);
    border-color: #00d4ff;
  }
`;

const Content = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
`;

const CategorySection = styled.div`
  margin-bottom: 2rem;
`;

const CategoryHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid #333;
`;

const CategoryTitle = styled.h4`
  margin: 0;
  font-size: 0.9rem;
  font-weight: 600;
  color: #ccc;
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const CategoryCount = styled.span`
  background: #333;
  color: #ccc;
  padding: 0.25rem 0.5rem;
  border-radius: 12px;
  font-size: 0.7rem;
`;

const AnimationGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 0.75rem;
`;

const AnimationCard = styled.div`
  background: ${props => props.selected ? '#333' : '#2a2a2a'};
  border: 1px solid ${props => props.selected ? '#00d4ff' : '#444'};
  border-radius: 6px;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
  
  &:hover {
    border-color: #00d4ff;
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 212, 255, 0.2);
  }
`;

const AnimationThumbnail = styled.div`
  height: 80px;
  background: ${props => props.gradient || 'linear-gradient(45deg, #667eea, #764ba2)'};
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  
  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
`;

const AnimationIcon = styled.div`
  color: white;
  opacity: 0.8;
`;

const PlayOverlay = styled.div`
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  background: rgba(0, 0, 0, 0.7);
  border-radius: 50%;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.2s ease;
  
  ${AnimationCard}:hover & {
    opacity: 1;
  }
`;

const AnimationInfo = styled.div`
  padding: 0.75rem;
`;

const AnimationName = styled.h5`
  margin: 0 0 0.25rem 0;
  font-size: 0.8rem;
  font-weight: 600;
  color: white;
`;

const AnimationDescription = styled.p`
  margin: 0;
  font-size: 0.7rem;
  color: #999;
  line-height: 1.3;
`;

const FFmpegInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 0.25rem;
  margin-top: 0.5rem;
  font-size: 0.6rem;
  color: #666;
`;

const CompatibilityBadge = styled.div`
  display: flex;
  align-items: center;
  gap: 0.25rem;
  background: ${props => props.compatible ? 'rgba(0, 255, 136, 0.1)' : 'rgba(255, 107, 107, 0.1)'};
  border: 1px solid ${props => props.compatible ? '#00ff88' : '#ff6b6b'};
  color: ${props => props.compatible ? '#00ff88' : '#ff6b6b'};
  padding: 0.125rem 0.25rem;
  border-radius: 3px;
  font-size: 0.6rem;
`;

const LoadingState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  color: #666;
  font-size: 0.9rem;
`;

const ErrorState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  color: #ff6b6b;
  font-size: 0.9rem;
  text-align: center;
`;

const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  color: #666;
  font-size: 0.9rem;
  text-align: center;
`;

const AnimationManager = ({ isOpen, onClose, onApplyAnimation }) => {
  const {
    animations,
    totalAnimations,
    categories,
    isLoading,
    error,
    stats,
    searchAnimations,
    selectedAnimations,
    selectAnimation,
    clearSelection,
    applyAnimation,
    generatePreview,
    validateAnimations,
    exportAnimations
  } = useAnimations();

  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchResults, setSearchResults] = useState([]);
  const [previewCache, setPreviewCache] = useState(new Map());

  // Search functionality
  useEffect(() => {
    if (searchQuery.length >= 2) {
      const results = searchAnimations(searchQuery);
      setSearchResults(results);
    } else {
      setSearchResults([]);
    }
  }, [searchQuery, searchAnimations]);

  const handleAnimationSelect = useCallback((animationId, event) => {
    const multiSelect = event.ctrlKey || event.metaKey;
    selectAnimation(animationId, multiSelect);
  }, [selectAnimation]);

  const handleAnimationApply = useCallback(async (animationId) => {
    try {
      if (onApplyAnimation) {
        const animationConfig = await applyAnimation(animationId, {
          id: 'current-clip',
          source: 'current-source.mp4'
        });
        onApplyAnimation(animationConfig);
      }
    } catch (error) {
      console.error('Failed to apply animation:', error);
    }
  }, [applyAnimation, onApplyAnimation]);

  const handlePreviewGeneration = useCallback(async (animationId) => {
    try {
      const preview = await generatePreview(animationId);
      setPreviewCache(prev => new Map(prev).set(animationId, preview));
    } catch (error) {
      console.error('Failed to generate preview:', error);
    }
  }, [generatePreview]);

  const handleExport = useCallback((format) => {
    const exportData = exportAnimations(format);
    const blob = new Blob([exportData], { 
      type: format === 'json' ? 'application/json' : 'text/csv' 
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `animations.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  }, [exportAnimations]);

  const getFilteredAnimations = useCallback(() => {
    if (searchQuery.length >= 2) {
      return searchResults;
    }
    
    if (activeCategory === 'all') {
      return animations;
    }
    
    return { [activeCategory]: animations[activeCategory] || [] };
  }, [searchQuery, searchResults, activeCategory, animations]);

  const renderAnimationCard = useCallback((animation, category) => {
    const isSelected = selectedAnimations.includes(animation.id);
    const IconComponent = getIcon(animation.icon);
    const preview = previewCache.get(animation.id);

    return (
      <AnimationCard
        key={animation.id}
        selected={isSelected}
        onClick={(e) => handleAnimationSelect(animation.id, e)}
      >
        <AnimationThumbnail gradient={animation.ui?.gradient}>
          {preview ? (
            <img src={preview.thumbnail} alt={animation.name} />
          ) : (
            <AnimationIcon>
              <IconComponent size={24} />
            </AnimationIcon>
          )}
          
          <PlayOverlay onClick={(e) => {
            e.stopPropagation();
            handleAnimationApply(animation.id);
          }}>
            <Play size={12} color="white" />
          </PlayOverlay>
        </AnimationThumbnail>
        
        <AnimationInfo>
          <AnimationName>{animation.name}</AnimationName>
          <AnimationDescription>{animation.description}</AnimationDescription>
          
          <FFmpegInfo>
            <Code size={10} />
            FFmpeg {animation.version || '1.0.0'}
            
            <CompatibilityBadge compatible={animation.compatibility?.web !== false}>
              {animation.compatibility?.web !== false ? (
                <CheckCircle size={8} />
              ) : (
                <AlertTriangle size={8} />
              )}
              {animation.compatibility?.web !== false ? 'Web' : 'Server'}
            </CompatibilityBadge>
          </FFmpegInfo>
        </AnimationInfo>
      </AnimationCard>
    );
  }, [selectedAnimations, previewCache, handleAnimationSelect, handleAnimationApply]);

  if (!isOpen) return null;

  if (isLoading) {
    return (
      <ManagerContainer>
        <Header>
          <Title>
            <Film size={16} />
            Animation Manager
          </Title>
        </Header>
        <LoadingState>
          <Loader size={32} className="spin" />
          <div>Loading animations...</div>
        </LoadingState>
      </ManagerContainer>
    );
  }

  if (error) {
    return (
      <ManagerContainer>
        <Header>
          <Title>
            <Film size={16} />
            Animation Manager
          </Title>
        </Header>
        <ErrorState>
          <AlertTriangle size={32} />
          <div>Failed to load animations</div>
          <div style={{ fontSize: '0.8rem', marginTop: '0.5rem' }}>{error}</div>
        </ErrorState>
      </ManagerContainer>
    );
  }

  const filteredAnimations = getFilteredAnimations();
  const hasResults = searchQuery.length >= 2 ? searchResults.length > 0 : totalAnimations > 0;

  return (
    <ManagerContainer>
      <Header>
        <Title>
          <Film size={16} />
          Animation Manager
        </Title>
        <StatsContainer>
          <Stat>
            <Database size={12} />
            {totalAnimations} animations
          </Stat>
          {stats && (
            <Stat>
              <Zap size={12} />
              {stats.source}
            </Stat>
          )}
        </StatsContainer>
      </Header>

      <Controls>
        <SearchInput
          type="text"
          placeholder="Search animations..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        
        <FilterButton
          active={activeCategory === 'all'}
          onClick={() => setActiveCategory('all')}
        >
          All
        </FilterButton>
        
        {categories.map(category => (
          <FilterButton
            key={category}
            active={activeCategory === category}
            onClick={() => setActiveCategory(category)}
          >
            {category} ({animations[category]?.length || 0})
          </FilterButton>
        ))}
        
        <ActionButton onClick={() => handleExport('json')}>
          <Download size={14} />
        </ActionButton>
        
        <ActionButton onClick={() => handleExport('csv')}>
          <Upload size={14} />
        </ActionButton>
      </Controls>

      <Content>
        {!hasResults ? (
          <EmptyState>
            <Film size={48} style={{ opacity: 0.3, marginBottom: '1rem' }} />
            <div>No animations found</div>
            {searchQuery.length >= 2 && (
              <div style={{ fontSize: '0.8rem', marginTop: '0.5rem' }}>
                Try a different search term
              </div>
            )}
          </EmptyState>
        ) : searchQuery.length >= 2 ? (
          <CategorySection>
            <CategoryHeader>
              <CategoryTitle>Search Results</CategoryTitle>
              <CategoryCount>{searchResults.length}</CategoryCount>
            </CategoryHeader>
            <AnimationGrid>
              {searchResults.map(animation => 
                renderAnimationCard(animation, animation.category)
              )}
            </AnimationGrid>
          </CategorySection>
        ) : (
          Object.keys(filteredAnimations).map(category => {
            const categoryAnimations = filteredAnimations[category];
            if (!categoryAnimations || categoryAnimations.length === 0) return null;

            return (
              <CategorySection key={category}>
                <CategoryHeader>
                  <CategoryTitle>{category}</CategoryTitle>
                  <CategoryCount>{categoryAnimations.length}</CategoryCount>
                </CategoryHeader>
                <AnimationGrid>
                  {categoryAnimations.map(animation => 
                    renderAnimationCard(animation, category)
                  )}
                </AnimationGrid>
              </CategorySection>
            );
          })
        )}
      </Content>
    </ManagerContainer>
  );
};

export default AnimationManager; 