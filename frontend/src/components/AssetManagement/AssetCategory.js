/**
 * Componente de Categoría de Asset - Genérico y Reutilizable
 * Sistema escalable para las pestañas del sidebar
 */

import React from 'react';
import styled from 'styled-components';
import { DynamicIcon } from './iconMap';

const CategoryTab = styled.button`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex: 1;
  min-width: 100px;
  padding: 1rem 1.25rem;
  background: ${({ $active, $color }) => 
    $active 
      ? `linear-gradient(135deg, ${$color}25, ${$color}15)`
      : 'rgba(42, 42, 42, 0.5)'
  };
  border: 1px solid ${({ $active, $color }) => 
    $active ? $color : 'rgba(255, 255, 255, 0.1)'
  };
  border-radius: 12px 12px 0 0;
  color: ${({ $active }) => $active ? '#fff' : '#999'};
  cursor: pointer;
  font-size: 0.875rem;
  font-weight: ${({ $active }) => $active ? '600' : '500'};
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;
  backdrop-filter: blur(10px);

  &:hover {
    background: ${({ $active, $color }) => 
      $active 
        ? `linear-gradient(135deg, ${$color}35, ${$color}25)`
        : `linear-gradient(135deg, ${$color}20, ${$color}10)`
    };
    color: #fff;
    transform: translateY(-2px);
    border-color: ${({ $color }) => $color};
    box-shadow: 0 8px 25px ${({ $color }) => `${$color}30`};
  }

  &:before {
    content: '';
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(
      90deg,
      transparent,
      ${({ $color }) => `${$color}20`},
      transparent
    );
    transition: left 0.6s ease;
  }

  &:hover:before {
    left: 100%;
  }

  .icon {
    transition: all 0.3s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
  }

  &:hover .icon {
    transform: scale(1.15) rotate(5deg);
    filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3));
  }

  .badge {
    background: ${({ $active, $color }) => 
      $active ? '#fff' : $color
    };
    color: ${({ $active, $color }) => 
      $active ? $color : '#000'
    };
    font-size: 0.75rem;
    font-weight: 700;
    padding: 0.25rem 0.5rem;
    border-radius: 16px;
    margin-left: auto;
    min-width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    text-align: center;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
    transition: all 0.3s ease;
  }

  &:hover .badge {
    transform: scale(1.1);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  }

  /* Ripple effect */
  &:active {
    transform: translateY(0);
  }

  &:active:before {
    animation: ripple 0.6s ease-out;
  }

  @keyframes ripple {
    0% {
      transform: scale(0);
      opacity: 1;
    }
    100% {
      transform: scale(4);
      opacity: 0;
    }
  }
`;

const CategoryLabel = styled.span`
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const AssetCategory = ({ 
  category, 
  active, 
  onSelect, 
  assetCount = 0,
  showBadge = true 
}) => {
  const handleClick = () => {
    onSelect(category.id);
  };

  return (
    <CategoryTab 
      $active={active} 
      $color={category.color}
      onClick={handleClick}
      title={category.description}
    >
      <DynamicIcon 
        name={category.icon} 
        size={16}
        className="icon"
        color={active ? category.color : 'currentColor'}
      />
      <CategoryLabel>{category.label}</CategoryLabel>
      {showBadge && assetCount > 0 && (
        <span className="badge">{assetCount}</span>
      )}
    </CategoryTab>
  );
};

export default AssetCategory; 