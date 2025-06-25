/**
 * JSON Viewer Component - Visor profesional de JSON
 * 
 * Características:
 * - Syntax highlighting
 * - Plegado de código
 * - Edición en tiempo real
 * - Validación de sintaxis
 * - Exportar/Importar JSON
 */

import React, { useState, useRef, useEffect } from 'react';
import styled from 'styled-components';
import { 
  Eye, 
  EyeOff, 
  Copy, 
  Download, 
  Upload, 
  Check,
  AlertCircle,
  Code,
  Maximize2,
  Minimize2
} from 'lucide-react';

const ViewerContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #0a0a0a;
  border: 1px solid #333;
  border-radius: 8px;
  overflow: hidden;
`;

const ViewerHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1rem;
  background: #1a1a1a;
  border-bottom: 1px solid #333;
`;

const ViewerTitle = styled.h3`
  margin: 0;
  font-size: 0.9rem;
  font-weight: 600;
  color: #00d4ff;
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const ViewerControls = styled.div`
  display: flex;
  gap: 0.5rem;
  align-items: center;
`;

const Button = styled.button`
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.375rem 0.75rem;
  background: rgba(255, 255, 255, 0.1);
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.75rem;
  transition: all 0.2s ease;
  
  &:hover {
    background: rgba(255, 255, 255, 0.2);
    border-color: #00d4ff;
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const ViewerContent = styled.div`
  flex: 1;
  position: relative;
  overflow: hidden;
`;

const JsonDisplay = styled.pre`
  margin: 0;
  padding: 1rem;
  font-family: 'Monaco', 'Courier New', monospace;
  font-size: 0.8rem;
  line-height: 1.4;
  background: #0a0a0a;
  color: #f8f8f2;
  overflow: auto;
  height: 100%;
  white-space: pre-wrap;
  word-break: break-word;
  
  /* Scrollbar styling */
  &::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }
  
  &::-webkit-scrollbar-track {
    background: #1a1a1a;
  }
  
  &::-webkit-scrollbar-thumb {
    background: #444;
    border-radius: 4px;
  }
  
  &::-webkit-scrollbar-thumb:hover {
    background: #666;
  }
`;

const JsonEditor = styled.textarea`
  width: 100%;
  height: 100%;
  padding: 1rem;
  font-family: 'Monaco', 'Courier New', monospace;
  font-size: 0.8rem;
  line-height: 1.4;
  background: #0a0a0a;
  color: #f8f8f2;
  border: none;
  outline: none;
  resize: none;
  
  &:focus {
    background: #111;
  }
`;

const StatusBar = styled.div`
  padding: 0.5rem 1rem;
  background: #1a1a1a;
  border-top: 1px solid #333;
  font-size: 0.75rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const StatusIndicator = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: ${props => {
    switch (props.status) {
      case 'valid': return '#00ff88';
      case 'invalid': return '#ff6b6b';
      case 'editing': return '#ffaa00';
      default: return '#666';
    }
  }};
`;

const JsonViewer = ({ 
  json, 
  onDataChange, 
  title = 'JSON Timeline',
  editable = false,
  collapsed = false,
  onToggleCollapse
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isExpanded, setIsExpanded] = useState(!collapsed);
  const [editContent, setEditContent] = useState('');
  const [validationStatus, setValidationStatus] = useState('valid');
  const [validationMessage, setValidationMessage] = useState('');
  const [copySuccess, setCopySuccess] = useState(false);
  
  const fileInputRef = useRef(null);

  // Usar 'json' en lugar de 'data' con validación adicional
  const data = json || {};
  
  // Validar que tengamos datos válidos al inicio
  useEffect(() => {
    if (!json) {
      console.warn('JsonViewer: No data provided, using empty object');
    }
  }, [json]);

  // Sincronizar isExpanded con prop collapsed
  useEffect(() => {
    setIsExpanded(!collapsed);
  }, [collapsed]);

  // Formatear JSON con syntax highlighting
  const formatJson = (obj) => {
    try {
      if (obj === null || obj === undefined) {
        return 'null';
      }
      return JSON.stringify(obj, null, 2);
    } catch (error) {
      return 'Error: Invalid JSON';
    }
  };

  // Aplicar syntax highlighting
  const highlightJson = (jsonString) => {
    // Validar que jsonString existe y es string
    if (!jsonString || typeof jsonString !== 'string') {
      return 'null';
    }
    
    try {
      return jsonString
        .replace(/(".*?")\s*:/g, '<span style="color: #66d9ef;">$1</span>:')
        .replace(/:\s*(".*?")/g, ': <span style="color: #a6e22e;">$1</span>')
        .replace(/:\s*(\d+\.?\d*)/g, ': <span style="color: #ae81ff;">$1</span>')
        .replace(/:\s*(true|false|null)/g, ': <span style="color: #fd971f;">$1</span>')
        .replace(/\{/g, '<span style="color: #f92672;">{</span>')
        .replace(/\}/g, '<span style="color: #f92672;">}</span>')
        .replace(/\[/g, '<span style="color: #f92672;">[</span>')
        .replace(/\]/g, '<span style="color: #f92672;">]</span>');
    } catch (error) {
      console.error('Error in highlightJson:', error);
      return jsonString || 'null';
    }
  };

  // Validar JSON
  const validateJson = (jsonString) => {
    try {
      const parsed = JSON.parse(jsonString);
      setValidationStatus('valid');
      setValidationMessage('JSON válido');
      return parsed;
    } catch (error) {
      setValidationStatus('invalid');
      setValidationMessage(`Error: ${error.message}`);
      return null;
    }
  };

  // Manejar cambios en el editor
  const handleEditChange = (e) => {
    const value = e.target.value;
    setEditContent(value);
    
    if (value.trim()) {
      const parsed = validateJson(value);
      if (parsed && onDataChange) {
        onDataChange(parsed);
      }
    }
  };

  // Iniciar edición
  const startEditing = () => {
    setEditContent(formatJson(data));
    setIsEditing(true);
    setValidationStatus('editing');
    setValidationMessage('Editando...');
  };

  // Finalizar edición
  const finishEditing = () => {
    if (validationStatus === 'valid' || validationStatus === 'editing') {
      const parsed = validateJson(editContent);
      if (parsed && onDataChange) {
        onDataChange(parsed);
      }
    }
    setIsEditing(false);
  };

  // Cancelar edición
  const cancelEditing = () => {
    setIsEditing(false);
    setEditContent('');
    setValidationStatus('valid');
    setValidationMessage('');
  };

  // Copiar JSON
  const copyJson = async () => {
    try {
      const jsonString = formatJson(data);
      await navigator.clipboard.writeText(jsonString);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (error) {
      console.error('Error copiando JSON:', error);
    }
  };

  // Exportar JSON
  const exportJson = () => {
    const jsonString = formatJson(data);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `timeline-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Importar JSON
  const importJson = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target.result;
        const parsed = JSON.parse(content);
        if (onDataChange) {
          onDataChange(parsed);
        }
        setValidationStatus('valid');
        setValidationMessage('JSON importado correctamente');
      } catch (error) {
        setValidationStatus('invalid');
        setValidationMessage(`Error importando: ${error.message}`);
      }
    };
    reader.readAsText(file);
    
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Estadísticas del JSON
  const getJsonStats = () => {
    if (!data) return null;
    
    const jsonString = formatJson(data);
    const lines = jsonString.split('\n').length;
    const chars = jsonString.length;
    const size = new Blob([jsonString]).size;
    
    return { lines, chars, size };
  };

  const stats = getJsonStats();

  return (
    <ViewerContainer>
      <ViewerHeader>
        <ViewerTitle>
          <Code size={16} />
          {title}
        </ViewerTitle>
        
        <ViewerControls>
          {editable && (
            <>
              {isEditing ? (
                <>
                  <Button onClick={finishEditing} disabled={validationStatus === 'invalid'}>
                    <Check size={14} />
                    Guardar
                  </Button>
                  <Button onClick={cancelEditing}>
                    Cancelar
                  </Button>
                </>
              ) : (
                <Button onClick={startEditing}>
                  <Code size={14} />
                  Editar
                </Button>
              )}
            </>
          )}
          
          <Button onClick={copyJson}>
            {copySuccess ? <Check size={14} /> : <Copy size={14} />}
            {copySuccess ? 'Copiado!' : 'Copiar'}
          </Button>
          
          <Button onClick={exportJson}>
            <Download size={14} />
            Exportar
          </Button>
          
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={importJson}
            style={{ display: 'none' }}
          />
          <Button onClick={() => fileInputRef.current?.click()}>
            <Upload size={14} />
            Importar
          </Button>
          
          <Button onClick={() => {
            if (onToggleCollapse) {
              onToggleCollapse();
            } else {
              setIsExpanded(!isExpanded);
            }
          }}>
            {isExpanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            {isExpanded ? 'Colapsar' : 'Expandir'}
          </Button>
        </ViewerControls>
      </ViewerHeader>

      {isExpanded && (
        <>
          <ViewerContent>
            {isEditing ? (
              <JsonEditor
                value={editContent}
                onChange={handleEditChange}
                placeholder="Ingresa JSON válido..."
                spellCheck={false}
              />
            ) : (
              <JsonDisplay
                dangerouslySetInnerHTML={{
                  __html: highlightJson(formatJson(data))
                }}
              />
            )}
          </ViewerContent>

          <StatusBar>
            <StatusIndicator status={validationStatus}>
              {validationStatus === 'invalid' && <AlertCircle size={14} />}
              {validationStatus === 'valid' && <Check size={14} />}
              {validationMessage}
            </StatusIndicator>
            
            {stats && (
              <div style={{ color: '#666' }}>
                {stats.lines} líneas • {stats.chars} caracteres • {(stats.size / 1024).toFixed(1)} KB
              </div>
            )}
          </StatusBar>
        </>
      )}
    </ViewerContainer>
  );
};

export default JsonViewer; 