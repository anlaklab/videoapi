/**
 * Mapeo Dinámico de Iconos - Sistema Escalable
 * Gestión centralizada de iconos para el sidebar de assets
 */

import { 
  Video, Music, Image, Type, FileText, FolderOpen, 
  Upload, Download, Trash2, Edit3, Copy, Share2,
  Play, Pause, Square, SkipForward, SkipBack,
  Volume2, VolumeX, Settings, Search, Filter,
  Grid, List, Eye, EyeOff, Lock, Unlock,
  Plus, Minus, RotateCw, Move, Maximize2,
  Calendar, Clock, User, Tag, Star,
  AlertCircle, CheckCircle, XCircle, Info,
  ChevronDown, ChevronUp, ChevronLeft, ChevronRight,
  MoreVertical, MoreHorizontal, Menu, X
} from 'lucide-react';

// Mapeo principal de iconos
const iconMap = {
  // Asset Categories
  Video,
  Music, 
  Image,
  Type,
  FileText,
  FolderOpen,
  
  // Actions
  Upload,
  Download,
  Trash2,
  Edit3,
  Copy,
  Share2,
  
  // Player Controls
  Play,
  Pause,
  Square, // Stop replacement
  SkipForward,
  SkipBack,
  Volume2,
  VolumeX,
  
  // Interface
  Settings,
  Search,
  Filter,
  Grid,
  List,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  
  // Edit Controls
  Plus,
  Minus,
  RotateCw,
  Move,
  Maximize2,
  
  // Metadata
  Calendar,
  Clock,
  User,
  Tag,
  Star,
  
  // Status
  AlertCircle,
  CheckCircle,
  XCircle,
  Info,
  
  // Navigation
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  MoreHorizontal,
  Menu,
  X
};

/**
 * Obtiene un componente de icono dinámicamente
 * @param {string} iconName - Nombre del icono
 * @param {number} size - Tamaño del icono (default: 16)
 * @param {string} color - Color del icono
 * @param {object} props - Props adicionales
 * @returns {JSX.Element} Componente de icono
 */
export const getIcon = (iconName, { size = 16, color, className, ...props } = {}) => {
  const IconComponent = iconMap[iconName] || FolderOpen;
  
  return (
    <IconComponent 
      size={size} 
      color={color}
      className={className}
      {...props}
    />
  );
};

/**
 * Verifica si existe un icono
 * @param {string} iconName - Nombre del icono
 * @returns {boolean} True si existe
 */
export const hasIcon = (iconName) => {
  return iconName in iconMap;
};

/**
 * Obtiene todos los iconos disponibles
 * @returns {string[]} Lista de nombres de iconos
 */
export const getAvailableIcons = () => {
  return Object.keys(iconMap);
};

/**
 * Componente de icono con fallback automático
 */
export const DynamicIcon = ({ 
  name, 
  size = 16, 
  color = 'currentColor', 
  fallback = 'FolderOpen',
  className = '',
  ...props 
}) => {
  const IconComponent = iconMap[name] || iconMap[fallback] || FolderOpen;
  
  return (
    <IconComponent 
      size={size} 
      color={color}
      className={className}
      {...props}
    />
  );
};

export default iconMap; 