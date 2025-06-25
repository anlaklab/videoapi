/**
 * Transition Manager - Gestor profesional de transiciones
 * 
 * Características:
 * - Múltiples tipos de transiciones
 * - Preview en tiempo real
 * - Configuración avanzada
 * - Easing functions
 * - Duración personalizable
 */

import React, { useState, useRef, useEffect } from 'react';
import styled from 'styled-components';
import { 
  Zap, 
  Play, 
  Settings, 
  ChevronDown,
  ChevronUp,
  Eye,
  Clock,
  Sliders
} from 'lucide-react';

const TransitionContainer = styled.div`
  background: #1a1a1a;
  border: 1px solid #333;
  border-radius: 8px;
  overflow: hidden;
`;

const TransitionHeader = styled.div`
  padding: 1rem;
  background: #2a2a2a;
  border-bottom: 1px solid #333;
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const TransitionTitle = styled.h3`
  margin: 0;
  font-size: 0.9rem;
  font-weight: 600;
  color: #00d4ff;
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const TransitionGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 0.75rem;
  padding: 1rem;
`;

const TransitionCard = styled.div`
  background: #333;
  border: 2px solid ${props => props.$selected ? '#00d4ff' : 'transparent'};
  border-radius: 6px;
  padding: 0.75rem;
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: center;
  
  &:hover {
    border-color: #00d4ff;
    transform: scale(1.02);
  }
`;

const TransitionIcon = styled.div`
  width: 40px;
  height: 40px;
  margin: 0 auto 0.5rem;
  background: ${props => props.$gradient};
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 1.2rem;
`;

const TransitionName = styled.div`
  font-size: 0.8rem;
  font-weight: 500;
  color: #ccc;
`;

const TransitionDuration = styled.div`
  font-size: 0.7rem;
  color: #666;
  margin-top: 0.25rem;
`;

const ConfigPanel = styled.div`
  padding: 1rem;
  background: #111;
  border-top: 1px solid #333;
  display: ${props => props.$show ? 'block' : 'none'};
`;

const ConfigGroup = styled.div`
  margin-bottom: 1rem;
`;

const ConfigLabel = styled.label`
  display: block;
  margin-bottom: 0.5rem;
  font-size: 0.8rem;
  color: #ccc;
  font-weight: 500;
`;

const ConfigSlider = styled.input`
  width: 100%;
  height: 4px;
  background: #444;
  outline: none;
  border-radius: 2px;
  
  &::-webkit-slider-thumb {
    appearance: none;
    width: 16px;
    height: 16px;
    background: #00d4ff;
    border-radius: 50%;
    cursor: pointer;
  }
`;

const ConfigSelect = styled.select`
  width: 100%;
  padding: 0.5rem;
  background: #333;
  color: white;
  border: 1px solid #555;
  border-radius: 4px;
  
  &:focus {
    outline: none;
    border-color: #00d4ff;
  }
`;

const PreviewContainer = styled.div`
  width: 100%;
  height: 60px;
  background: #000;
  border-radius: 4px;
  position: relative;
  overflow: hidden;
  margin-top: 1rem;
`;

const PreviewElement = styled.div`
  position: absolute;
  top: 50%;
  left: 20px;
  width: 30px;
  height: 30px;
  background: #00d4ff;
  border-radius: 4px;
  transform: translateY(-50%);
  transition: all ${props => props.$duration}s ${props => props.$easing};
`;

const Button = styled.button`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: rgba(255, 255, 255, 0.1);
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.8rem;
  transition: all 0.2s ease;
  
  &:hover {
    background: rgba(255, 255, 255, 0.2);
    border-color: #00d4ff;
  }
`;

// Definir transiciones disponibles
const TRANSITIONS = [
  {
    id: 'fade',
    name: 'Fade',
    icon: '○',
    gradient: 'linear-gradient(45deg, #667eea, #764ba2)',
    description: 'Desvanecimiento gradual',
    defaultDuration: 1.0,
    properties: ['opacity']
  },
  {
    id: 'slide-right',
    name: 'Slide Right',
    icon: '→',
    gradient: 'linear-gradient(45deg, #f093fb, #f5576c)',
    description: 'Deslizamiento hacia la derecha',
    defaultDuration: 0.8,
    properties: ['transform']
  },
  {
    id: 'slide-left',
    name: 'Slide Left',
    icon: '←',
    gradient: 'linear-gradient(45deg, #4facfe, #00f2fe)',
    description: 'Deslizamiento hacia la izquierda',
    defaultDuration: 0.8,
    properties: ['transform']
  },
  {
    id: 'slide-up',
    name: 'Slide Up',
    icon: '↑',
    gradient: 'linear-gradient(45deg, #43e97b, #38f9d7)',
    description: 'Deslizamiento hacia arriba',
    defaultDuration: 0.8,
    properties: ['transform']
  },
  {
    id: 'slide-down',
    name: 'Slide Down',
    icon: '↓',
    gradient: 'linear-gradient(45deg, #fa709a, #fee140)',
    description: 'Deslizamiento hacia abajo',
    defaultDuration: 0.8,
    properties: ['transform']
  },
  {
    id: 'zoom-in',
    name: 'Zoom In',
    icon: '+',
    gradient: 'linear-gradient(45deg, #a8edea, #fed6e3)',
    description: 'Acercamiento gradual',
    defaultDuration: 1.2,
    properties: ['transform']
  },
  {
    id: 'zoom-out',
    name: 'Zoom Out',
    icon: '−',
    gradient: 'linear-gradient(45deg, #d299c2, #fef9d7)',
    description: 'Alejamiento gradual',
    defaultDuration: 1.2,
    properties: ['transform']
  },
  {
    id: 'rotate',
    name: 'Rotate',
    icon: '↻',
    gradient: 'linear-gradient(45deg, #89f7fe, #66a6ff)',
    description: 'Rotación completa',
    defaultDuration: 1.5,
    properties: ['transform']
  },
  {
    id: 'flip-horizontal',
    name: 'Flip H',
    icon: '⟷',
    gradient: 'linear-gradient(45deg, #fdbb2d, #22c1c3)',
    description: 'Volteo horizontal',
    defaultDuration: 1.0,
    properties: ['transform']
  },
  {
    id: 'flip-vertical',
    name: 'Flip V',
    icon: '⟺',
    gradient: 'linear-gradient(45deg, #e96443, #904e95)',
    description: 'Volteo vertical',
    defaultDuration: 1.0,
    properties: ['transform']
  },
  {
    id: 'wipe-right',
    name: 'Wipe Right',
    icon: '▶',
    gradient: 'linear-gradient(45deg, #2196F3, #21CBF3)',
    description: 'Barrido hacia la derecha',
    defaultDuration: 1.0,
    properties: ['clip-path']
  },
  {
    id: 'wipe-left',
    name: 'Wipe Left',
    icon: '◀',
    gradient: 'linear-gradient(45deg, #673AB7, #512DA8)',
    description: 'Barrido hacia la izquierda',
    defaultDuration: 1.0,
    properties: ['clip-path']
  }
];

// Funciones de easing
const EASING_FUNCTIONS = [
  { value: 'ease', label: 'Ease' },
  { value: 'ease-in', label: 'Ease In' },
  { value: 'ease-out', label: 'Ease Out' },
  { value: 'ease-in-out', label: 'Ease In Out' },
  { value: 'linear', label: 'Linear' },
  { value: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)', label: 'Bounce' },
  { value: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)', label: 'Back' },
  { value: 'cubic-bezier(0.55, 0.085, 0.68, 0.53)', label: 'Elastic' }
];

const TransitionManager = ({ 
  selectedClip,
  onTransitionAdd,
  onTransitionUpdate,
  onTransitionRemove 
}) => {
  const [selectedTransition, setSelectedTransition] = useState(null);
  const [showConfig, setShowConfig] = useState(false);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const [config, setConfig] = useState({
    duration: 1.0,
    easing: 'ease-in-out',
    delay: 0,
    direction: 'normal'
  });

  const previewRef = useRef(null);

  // Actualizar configuración cuando cambia la transición seleccionada
  useEffect(() => {
    if (selectedTransition) {
      setConfig(prev => ({
        ...prev,
        duration: selectedTransition.defaultDuration
      }));
    }
  }, [selectedTransition]);

  // Seleccionar transición
  const handleTransitionSelect = (transition) => {
    setSelectedTransition(transition);
    setShowConfig(true);
  };

  // Aplicar transición al clip
  const handleApplyTransition = () => {
    if (!selectedTransition || !selectedClip) return;

    const transitionData = {
      id: `transition-${Date.now()}`,
      type: selectedTransition.id,
      clipId: selectedClip,
      config: { ...config },
      properties: selectedTransition.properties
    };

    onTransitionAdd(transitionData);
  };

  // Preview de transición
  const playPreview = () => {
    if (!selectedTransition || !previewRef.current) return;

    setIsPreviewPlaying(true);
    const element = previewRef.current;
    
    // Reset
    element.style.transition = 'none';
    element.style.transform = 'translateY(-50%) translateX(0)';
    element.style.opacity = '1';

    // Trigger reflow
    element.offsetHeight;

    // Apply transition
    element.style.transition = `all ${config.duration}s ${config.easing}`;
    
    switch (selectedTransition.id) {
      case 'fade':
        element.style.opacity = '0';
        break;
      case 'slide-right':
        element.style.transform = 'translateY(-50%) translateX(200px)';
        break;
      case 'slide-left':
        element.style.transform = 'translateY(-50%) translateX(-200px)';
        break;
      case 'zoom-in':
        element.style.transform = 'translateY(-50%) scale(2)';
        break;
      case 'zoom-out':
        element.style.transform = 'translateY(-50%) scale(0)';
        break;
      case 'rotate':
        element.style.transform = 'translateY(-50%) rotate(360deg)';
        break;
      default:
        element.style.transform = 'translateY(-50%) translateX(100px)';
    }

    // Reset after animation
    setTimeout(() => {
      element.style.transition = 'none';
      element.style.transform = 'translateY(-50%) translateX(0)';
      element.style.opacity = '1';
      setIsPreviewPlaying(false);
    }, config.duration * 1000 + 100);
  };

  // Actualizar configuración
  const updateConfig = (key, value) => {
    setConfig(prev => ({
      ...prev,
      [key]: value
    }));
  };

  return (
    <TransitionContainer>
      <TransitionHeader>
        <TransitionTitle>
          <Zap size={16} />
          Transiciones
        </TransitionTitle>
        <Button onClick={() => setShowConfig(!showConfig)}>
          <Settings size={14} />
          {showConfig ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </Button>
      </TransitionHeader>

      <TransitionGrid>
        {TRANSITIONS.map(transition => (
          <TransitionCard
            key={transition.id}
            $selected={selectedTransition?.id === transition.id}
            onClick={() => handleTransitionSelect(transition)}
          >
            <TransitionIcon $gradient={transition.gradient}>
              {transition.icon}
            </TransitionIcon>
            <TransitionName>{transition.name}</TransitionName>
            <TransitionDuration>{transition.defaultDuration}s</TransitionDuration>
          </TransitionCard>
        ))}
      </TransitionGrid>

      <ConfigPanel $show={showConfig && selectedTransition}>
        {selectedTransition && (
          <>
            <h4 style={{ margin: '0 0 1rem 0', color: '#00d4ff' }}>
              {selectedTransition.name}
            </h4>
            
            <ConfigGroup>
              <ConfigLabel>
                Duración: {config.duration}s
              </ConfigLabel>
              <ConfigSlider
                type="range"
                min="0.1"
                max="5"
                step="0.1"
                value={config.duration}
                onChange={(e) => updateConfig('duration', parseFloat(e.target.value))}
              />
            </ConfigGroup>

            <ConfigGroup>
              <ConfigLabel>Función de Easing</ConfigLabel>
              <ConfigSelect
                value={config.easing}
                onChange={(e) => updateConfig('easing', e.target.value)}
              >
                {EASING_FUNCTIONS.map(func => (
                  <option key={func.value} value={func.value}>
                    {func.label}
                  </option>
                ))}
              </ConfigSelect>
            </ConfigGroup>

            <ConfigGroup>
              <ConfigLabel>
                Retraso: {config.delay}s
              </ConfigLabel>
              <ConfigSlider
                type="range"
                min="0"
                max="2"
                step="0.1"
                value={config.delay}
                onChange={(e) => updateConfig('delay', parseFloat(e.target.value))}
              />
            </ConfigGroup>

            <PreviewContainer>
              <PreviewElement
                ref={previewRef}
                $duration={config.duration}
                $easing={config.easing}
              />
            </PreviewContainer>

            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
              <Button onClick={playPreview} disabled={isPreviewPlaying}>
                <Play size={14} />
                Preview
              </Button>
              
              <Button 
                onClick={handleApplyTransition}
                disabled={!selectedClip}
                style={{ background: 'linear-gradient(45deg, #00d4ff, #0099cc)' }}
              >
                <Zap size={14} />
                Aplicar
              </Button>
            </div>

            {!selectedClip && (
              <div style={{ 
                marginTop: '1rem', 
                padding: '0.5rem', 
                background: 'rgba(255, 171, 0, 0.1)', 
                border: '1px solid #ffab00',
                borderRadius: '4px',
                fontSize: '0.8rem',
                color: '#ffab00'
              }}>
                Selecciona un clip para aplicar transiciones
              </div>
            )}
          </>
        )}
      </ConfigPanel>
    </TransitionContainer>
  );
};

export default TransitionManager; 