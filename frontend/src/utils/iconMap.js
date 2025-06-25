/**
 * Icon Map - Professional Icon Mapping System
 * 
 * Maps animation icon names to Lucide React components
 * Provides fallbacks and validation for icon references
 */

import React from 'react';
import {
  // Camera Effects
  Camera,
  Focus,
  Aperture,
  
  // Transform Effects
  ZoomIn,
  ZoomOut,
  RotateCw,
  RotateCcw,
  Move,
  ArrowRight,
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  
  // Effects & Visual
  Layers,
  Shuffle,
  Zap,
  Sparkles,
  Eye,
  EyeOff,
  
  // Animation Controls
  Play,
  Pause,
  Square,
  SkipForward,
  SkipBack,
  
  // Motion & Dynamics
  Wind,
  Waves,
  Activity,
  TrendingUp,
  TrendingDown,
  
  // Special Effects
  Star,
  Sun,
  Moon,
  CloudLightning,
  Flame,
  Droplets,
  
  // UI & Controls
  Settings,
  Sliders,
  ToggleLeft,
  ToggleRight,
  
  // Geometry & Shapes
  Circle,
  Square as SquareIcon,
  Triangle,
  Pentagon,
  Hexagon,
  
  // Technical
  Cpu,
  Zap as Lightning,
  Radio,
  Wifi,
  
  // Fallback
  Image,
  Film,
  Video
} from 'lucide-react';

/**
 * Complete icon mapping with fallbacks
 */
const iconMap = {
  // Camera Effects
  'Camera': Camera,
  'camera': Camera,
  'Focus': Focus,
  'focus': Focus,
  'Aperture': Aperture,
  'aperture': Aperture,
  'Vibrate': Activity, // Camera shake
  'vibrate': Activity,
  
  // Transform Animations
  'ZoomIn': ZoomIn,
  'zoom-in': ZoomIn,
  'ZoomOut': ZoomOut,
  'zoom-out': ZoomOut,
  'RotateCw': RotateCw,
  'rotate-cw': RotateCw,
  'RotateCcw': RotateCcw,
  'rotate-ccw': RotateCcw,
  'Move': Move,
  'move': Move,
  
  // Directional Movements
  'ArrowRight': ArrowRight,
  'arrow-right': ArrowRight,
  'ArrowLeft': ArrowLeft,
  'arrow-left': ArrowLeft,
  'ArrowUp': ArrowUp,
  'arrow-up': ArrowUp,
  'ArrowDown': ArrowDown,
  'arrow-down': ArrowDown,
  
  // Visual Effects
  'Layers': Layers,
  'layers': Layers,
  'Shuffle': Shuffle,
  'shuffle': Shuffle,
  'morph': Shuffle,
  'Zap': Zap,
  'zap': Zap,
  'glitch': Zap,
  'lightning': Lightning,
  'Sparkles': Sparkles,
  'sparkles': Sparkles,
  'particles': Sparkles,
  
  // Visibility & Masking
  'Eye': Eye,
  'eye': Eye,
  'visible': Eye,
  'EyeOff': EyeOff,
  'eye-off': EyeOff,
  'hidden': EyeOff,
  
  // Playback Controls
  'Play': Play,
  'play': Play,
  'Pause': Pause,
  'pause': Pause,
  'Stop': Square,
  'stop': Square,
  'SkipForward': SkipForward,
  'skip-forward': SkipForward,
  'SkipBack': SkipBack,
  'skip-back': SkipBack,
  
  // Motion Dynamics
  'Wind': Wind,
  'wind': Wind,
  'breeze': Wind,
  'Waves': Waves,
  'waves': Waves,
  'ripple': Waves,
  'Activity': Activity,
  'activity': Activity,
  'pulse': Activity,
  'TrendingUp': TrendingUp,
  'trending-up': TrendingUp,
  'rise': TrendingUp,
  'TrendingDown': TrendingDown,
  'trending-down': TrendingDown,
  'fall': TrendingDown,
  
  // Environmental Effects
  'Star': Star,
  'star': Star,
  'twinkle': Star,
  'Sun': Sun,
  'sun': Sun,
  'brightness': Sun,
  'Moon': Moon,
  'moon': Moon,
  'night': Moon,
  'CloudLightning': CloudLightning,
  'cloud-lightning': CloudLightning,
  'storm': CloudLightning,
  'Flame': Flame,
  'flame': Flame,
  'fire': Flame,
  'burn': Flame,
  'Droplets': Droplets,
  'droplets': Droplets,
  'water': Droplets,
  'rain': Droplets,
  
  // UI Controls
  'Settings': Settings,
  'settings': Settings,
  'config': Settings,
  'Sliders': Sliders,
  'sliders': Sliders,
  'controls': Sliders,
  'ToggleLeft': ToggleLeft,
  'toggle-left': ToggleLeft,
  'ToggleRight': ToggleRight,
  'toggle-right': ToggleRight,
  
  // Geometric Shapes
  'Circle': Circle,
  'circle': Circle,
  'round': Circle,
  'Square': SquareIcon,
  'square': SquareIcon,
  'rect': SquareIcon,
  'Triangle': Triangle,
  'triangle': Triangle,
  'Pentagon': Pentagon,
  'pentagon': Pentagon,
  'Hexagon': Hexagon,
  'hexagon': Hexagon,
  
  // Technical/Digital
  'Cpu': Cpu,
  'cpu': Cpu,
  'processing': Cpu,
  'Radio': Radio,
  'radio': Radio,
  'signal': Radio,
  'Wifi': Wifi,
  'wifi': Wifi,
  'wireless': Wifi,
  
  // Media Fallbacks
  'Image': Image,
  'image': Image,
  'picture': Image,
  'Film': Film,
  'film': Film,
  'movie': Film,
  'Video': Video,
  'video': Video,
  'clip': Video
};

/**
 * Get icon component by name with fallback
 */
export const getIcon = (iconName, fallback = Video) => {
  if (!iconName) return fallback;
  
  const IconComponent = iconMap[iconName] || iconMap[iconName.toLowerCase()];
  return IconComponent || fallback;
};

/**
 * Check if icon exists in map
 */
export const hasIcon = (iconName) => {
  if (!iconName) return false;
  return !!(iconMap[iconName] || iconMap[iconName.toLowerCase()]);
};

/**
 * Get all available icon names
 */
export const getAvailableIcons = () => {
  return Object.keys(iconMap).filter(key => key === key.toLowerCase());
};

/**
 * Create icon component with props
 */
export const createIcon = (iconName, props = {}) => {
  const IconComponent = getIcon(iconName);
  return React.createElement(IconComponent, {
    size: 16,
    ...props
  });
};

/**
 * Icon categories for UI organization
 */
export const iconCategories = {
  camera: ['Camera', 'Focus', 'Aperture', 'Vibrate'],
  transform: ['ZoomIn', 'ZoomOut', 'RotateCw', 'RotateCcw', 'Move'],
  directional: ['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown'],
  effects: ['Layers', 'Shuffle', 'Zap', 'Sparkles', 'Eye', 'EyeOff'],
  playback: ['Play', 'Pause', 'Stop', 'SkipForward', 'SkipBack'],
  motion: ['Wind', 'Waves', 'Activity', 'TrendingUp', 'TrendingDown'],
  environmental: ['Star', 'Sun', 'Moon', 'CloudLightning', 'Flame', 'Droplets'],
  controls: ['Settings', 'Sliders', 'ToggleLeft', 'ToggleRight'],
  shapes: ['Circle', 'Square', 'Triangle', 'Pentagon', 'Hexagon'],
  technical: ['Cpu', 'Radio', 'Wifi'],
  media: ['Image', 'Film', 'Video']
};

/**
 * Get icons by category
 */
export const getIconsByCategory = (category) => {
  const categoryIcons = iconCategories[category] || [];
  return categoryIcons.map(iconName => ({
    name: iconName,
    component: getIcon(iconName)
  }));
};

/**
 * Search icons by name or keywords
 */
export const searchIcons = (query) => {
  if (!query || query.length < 2) return [];
  
  const lowerQuery = query.toLowerCase();
  const matches = [];
  
  Object.keys(iconMap).forEach(iconName => {
    if (iconName.toLowerCase().includes(lowerQuery)) {
      matches.push({
        name: iconName,
        component: iconMap[iconName],
        score: iconName.toLowerCase() === lowerQuery ? 10 : 
               iconName.toLowerCase().startsWith(lowerQuery) ? 5 : 1
      });
    }
  });
  
  return matches
    .sort((a, b) => b.score - a.score)
    .slice(0, 20); // Limit results
};

/**
 * Validate icon configuration for animations
 */
export const validateIconConfig = (animations) => {
  const issues = [];
  
  Object.keys(animations).forEach(category => {
    animations[category].forEach(animation => {
      if (animation.icon && !hasIcon(animation.icon)) {
        issues.push({
          animation: animation.id,
          category,
          issue: `Icon "${animation.icon}" not found`,
          suggestion: `Use one of: ${getAvailableIcons().slice(0, 5).join(', ')}...`
        });
      }
    });
  });
  
  return issues;
};

export default iconMap; 