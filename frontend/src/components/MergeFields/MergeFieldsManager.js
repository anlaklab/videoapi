/**
 * MergeFieldsManager Component - Professional Merge Fields System
 * 
 * Implements dynamic video generation by replacing placeholders with variables
 * via API or workflows, following the professional pattern shown in reference
 */

import React, { useState, useCallback, useEffect } from 'react';
import styled from 'styled-components';
import { 
  Plus, Minus, X, Save, Download, Upload, 
  Play, Zap, Code, Database, Settings,
  ChevronDown, ChevronRight, Copy, Trash2
} from 'lucide-react';

const MergeFieldsContainer = styled.div`
  position: fixed;
  top: 0;
  right: 0;
  width: 400px;
  height: 100vh;
  background: #1a1a1a;
  border-left: 1px solid #333;
  display: flex;
  flex-direction: column;
  z-index: 1000;
  transform: translateX(${props => props.$isOpen ? '0' : '100%'});
  transition: transform 0.3s ease;
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem;
  border-bottom: 1px solid #333;
  background: linear-gradient(90deg, #2a2a2a 0%, #1a1a1a 100%);
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

const CloseButton = styled.button`
  background: none;
  border: none;
  color: #666;
  cursor: pointer;
  padding: 0.25rem;
  border-radius: 4px;
  
  &:hover {
    background: rgba(255, 255, 255, 0.1);
    color: white;
  }
`;

const TabsContainer = styled.div`
  display: flex;
  border-bottom: 1px solid #333;
`;

const Tab = styled.button`
  flex: 1;
  padding: 0.75rem 0.5rem;
  background: ${props => props.$active ? '#2a2a2a' : 'transparent'};
  border: none;
  border-bottom: 2px solid ${props => props.$active ? '#00d4ff' : 'transparent'};
  color: ${props => props.$active ? 'white' : '#666'};
  font-size: 0.8rem;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
  
  &:hover {
    background: #2a2a2a;
    color: white;
  }
`;

const Content = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
`;

const MergeFieldRow = styled.div`
  display: flex;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
  align-items: center;
`;

const FieldInput = styled.input`
  flex: 1;
  padding: 0.5rem;
  background: #2a2a2a;
  border: 1px solid #444;
  border-radius: 4px;
  color: white;
  font-size: 0.8rem;
  font-family: monospace;
  
  &:focus {
    outline: none;
    border-color: #00d4ff;
  }
  
  &::placeholder {
    color: #666;
  }
`;

const ValueInput = styled.input`
  flex: 1.5;
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

const ActionButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: ${props => {
    if (props.$danger) return 'rgba(255, 107, 107, 0.1)';
    if (props.$success) return 'rgba(0, 255, 136, 0.1)';
    return 'rgba(255, 255, 255, 0.1)';
  }};
  border: 1px solid ${props => {
    if (props.$danger) return '#ff6b6b';
    if (props.$success) return '#00ff88';
    return '#444';
  }};
  border-radius: 4px;
  color: ${props => {
    if (props.$danger) return '#ff6b6b';
    if (props.$success) return '#00ff88';
    return '#ccc';
  }};
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    background: ${props => {
      if (props.$danger) return 'rgba(255, 107, 107, 0.2)';
      if (props.$success) return 'rgba(0, 255, 136, 0.2)';
      return 'rgba(255, 255, 255, 0.2)';
    }};
    transform: translateY(-1px);
  }
`;

const Section = styled.div`
  margin-bottom: 1.5rem;
`;

const SectionHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.75rem;
`;

const SectionTitle = styled.h4`
  margin: 0;
  font-size: 0.85rem;
  font-weight: 600;
  color: #ccc;
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const AddFieldButton = styled.button`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: linear-gradient(45deg, #00d4ff, #0099cc);
  border: none;
  border-radius: 6px;
  color: white;
  font-size: 0.8rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  width: 100%;
  justify-content: center;
  margin-bottom: 1rem;
  
  &:hover {
    background: linear-gradient(45deg, #00b8e6, #0088bb);
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(0, 212, 255, 0.3);
  }
`;

const PreviewSection = styled.div`
  background: #2a2a2a;
  border-radius: 8px;
  padding: 1rem;
  margin-bottom: 1rem;
`;

const PreviewTitle = styled.h5`
  margin: 0 0 0.5rem 0;
  font-size: 0.8rem;
  color: #ccc;
  text-transform: uppercase;
`;

const PreviewContent = styled.div`
  background: #1a1a1a;
  border-radius: 4px;
  padding: 0.75rem;
  font-family: monospace;
  font-size: 0.75rem;
  color: #00d4ff;
  white-space: pre-wrap;
  max-height: 150px;
  overflow-y: auto;
`;

const InfoBox = styled.div`
  background: rgba(0, 212, 255, 0.1);
  border: 1px solid rgba(0, 212, 255, 0.3);
  border-radius: 6px;
  padding: 0.75rem;
  margin-bottom: 1rem;
  font-size: 0.8rem;
  color: #ccc;
  line-height: 1.4;
`;

const ActionRow = styled.div`
  display: flex;
  gap: 0.5rem;
  margin-top: 1rem;
`;

const ActionButtonLarge = styled.button`
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.75rem;
  background: ${props => {
    if (props.$primary) return 'linear-gradient(45deg, #00d4ff, #0099cc)';
    if (props.$success) return 'linear-gradient(45deg, #00ff88, #00cc66)';
    return 'rgba(255, 255, 255, 0.1)';
  }};
  border: none;
  border-radius: 6px;
  color: white;
  font-size: 0.8rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(0, 212, 255, 0.3);
  }
`;

const TemplateSelector = styled.select`
  width: 100%;
  padding: 0.5rem;
  background: #2a2a2a;
  border: 1px solid #444;
  border-radius: 4px;
  color: white;
  font-size: 0.8rem;
  margin-bottom: 1rem;
  
  &:focus {
    outline: none;
    border-color: #00d4ff;
  }
  
  option {
    background: #2a2a2a;
    color: white;
  }
`;

const MergeFieldsManager = ({ isOpen, onClose, onApplyMergeFields }) => {
  const [activeTab, setActiveTab] = useState('fields');
  const [mergeFields, setMergeFields] = useState([
    { id: 1, name: 'MY_IMAGE', value: 'https://my.domain.com/image.png' },
    { id: 2, name: 'MY_IMAGE', value: 'https://my.domain.com/image.png' },
    { id: 3, name: 'MY_IMAGE', value: 'https://my.domain.com/image.png' },
    { id: 4, name: 'MY_IMAGE', value: 'https://my.domain.com/image.png' }
  ]);
  
  const [selectedTemplate, setSelectedTemplate] = useState('default');
  const [isConnected, setIsConnected] = useState(false);

  const tabs = [
    { id: 'fields', label: 'Fields', icon: Database },
    { id: 'connect', label: 'Connect', icon: Zap },
    { id: 'automate', label: 'Automate', icon: Settings }
  ];

  const addMergeField = useCallback(() => {
    const newField = {
      id: Date.now(),
      name: 'NEW_FIELD',
      value: 'placeholder value'
    };
    setMergeFields(prev => [...prev, newField]);
  }, []);

  const removeMergeField = useCallback((fieldId) => {
    setMergeFields(prev => prev.filter(field => field.id !== fieldId));
  }, []);

  const updateMergeField = useCallback((fieldId, updates) => {
    setMergeFields(prev => prev.map(field =>
      field.id === fieldId ? { ...field, ...updates } : field
    ));
  }, []);

  const generatePreview = useCallback(() => {
    const preview = {
      mergeFields: mergeFields.reduce((acc, field) => {
        acc[field.name] = field.value;
        return acc;
      }, {}),
      template: selectedTemplate,
      timestamp: new Date().toISOString()
    };
    return JSON.stringify(preview, null, 2);
  }, [mergeFields, selectedTemplate]);

  const handleSave = useCallback(() => {
    const mergeData = {
      fields: mergeFields,
      template: selectedTemplate,
      savedAt: new Date().toISOString()
    };
    
    // Save to localStorage for persistence
    localStorage.setItem('mergeFields', JSON.stringify(mergeData));
    
    console.log('✅ Merge fields saved:', mergeData);
  }, [mergeFields, selectedTemplate]);

  const handleApply = useCallback(() => {
    if (onApplyMergeFields) {
      onApplyMergeFields(mergeFields);
    }
    console.log('🔄 Applying merge fields to timeline:', mergeFields);
  }, [mergeFields, onApplyMergeFields]);

  const renderFieldsTab = () => (
    <>
      <InfoBox>
        Build dynamic videos by replacing placeholders with variables via the API or workflows.
        <br /><br />
        Assign a merge field to a clip property using the merge button {`{ }`} in the clip properties panel or wrap text in double braces.
      </InfoBox>

      <AddFieldButton onClick={addMergeField}>
        <Plus size={16} />
        Add a merge field
      </AddFieldButton>

      <Section>
        <SectionHeader>
          <SectionTitle>Merge Fields ({mergeFields.length})</SectionTitle>
        </SectionHeader>

        {mergeFields.map(field => (
          <MergeFieldRow key={field.id}>
            <FieldInput
              type="text"
              placeholder="MERGE FIELD"
              value={field.name}
              onChange={(e) => updateMergeField(field.id, { name: e.target.value.toUpperCase() })}
            />
            <ValueInput
              type="text"
              placeholder="PLACEHOLDER VALUE"
              value={field.value}
              onChange={(e) => updateMergeField(field.id, { value: e.target.value })}
            />
            <ActionButton $danger onClick={() => removeMergeField(field.id)}>
              <Minus size={14} />
            </ActionButton>
          </MergeFieldRow>
        ))}
      </Section>

      <PreviewSection>
        <PreviewTitle>JSON Preview</PreviewTitle>
        <PreviewContent>
          {generatePreview()}
        </PreviewContent>
      </PreviewSection>

      <ActionRow>
        <ActionButtonLarge onClick={handleSave}>
          <Save size={16} />
          Save
        </ActionButtonLarge>
        <ActionButtonLarge $primary onClick={handleApply}>
          <Play size={16} />
          Apply
        </ActionButtonLarge>
      </ActionRow>
    </>
  );

  const renderConnectTab = () => (
    <>
      <InfoBox>
        Connect your merge fields to external data sources and APIs for dynamic content generation.
      </InfoBox>

      <Section>
        <SectionTitle>Data Sources</SectionTitle>
        <TemplateSelector
          value={selectedTemplate}
          onChange={(e) => setSelectedTemplate(e.target.value)}
        >
          <option value="default">Default Template</option>
          <option value="api">External API</option>
          <option value="csv">CSV Import</option>
          <option value="json">JSON Data</option>
          <option value="database">Database</option>
        </TemplateSelector>
      </Section>

      <Section>
        <SectionTitle>Connection Status</SectionTitle>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '0.5rem',
          padding: '0.75rem',
          background: isConnected ? 'rgba(0, 255, 136, 0.1)' : 'rgba(255, 107, 107, 0.1)',
          border: `1px solid ${isConnected ? '#00ff88' : '#ff6b6b'}`,
          borderRadius: '6px',
          marginBottom: '1rem'
        }}>
          <div style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: isConnected ? '#00ff88' : '#ff6b6b'
          }} />
          <span style={{ fontSize: '0.8rem', color: '#ccc' }}>
            {isConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
      </Section>

      <ActionRow>
        <ActionButtonLarge 
          $success={!isConnected}
          onClick={() => setIsConnected(!isConnected)}
        >
          <Zap size={16} />
          {isConnected ? 'Disconnect' : 'Connect'}
        </ActionButtonLarge>
        <ActionButtonLarge>
          <Settings size={16} />
          Configure
        </ActionButtonLarge>
      </ActionRow>
    </>
  );

  const renderAutomateTab = () => (
    <>
      <InfoBox>
        Set up automated workflows to generate videos at scale using your merge fields and templates.
      </InfoBox>

      <Section>
        <SectionTitle>Automation Rules</SectionTitle>
        <div style={{ 
          padding: '2rem 1rem',
          textAlign: 'center',
          color: '#666',
          fontSize: '0.9rem'
        }}>
          <Settings size={32} style={{ marginBottom: '1rem', opacity: 0.5 }} />
          <div>Automation workflows coming soon</div>
          <div style={{ fontSize: '0.8rem', marginTop: '0.5rem' }}>
            Set triggers, conditions, and actions for automatic video generation
          </div>
        </div>
      </Section>

      <ActionRow>
        <ActionButtonLarge>
          <Plus size={16} />
          Create Workflow
        </ActionButtonLarge>
        <ActionButtonLarge>
          <Upload size={16} />
          Import Rules
        </ActionButtonLarge>
      </ActionRow>
    </>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case 'fields':
        return renderFieldsTab();
      case 'connect':
        return renderConnectTab();
      case 'automate':
        return renderAutomateTab();
      default:
        return renderFieldsTab();
    }
  };

  return (
    <MergeFieldsContainer $isOpen={isOpen}>
      <Header>
        <Title>
          <Code size={16} />
          Merge Fields
        </Title>
        <CloseButton onClick={onClose}>
          <X size={16} />
        </CloseButton>
      </Header>

      <TabsContainer>
        {tabs.map(tab => (
          <Tab
            key={tab.id}
            $active={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
          >
            <tab.icon size={14} />
            {tab.label}
          </Tab>
        ))}
      </TabsContainer>

      <Content>
        {renderTabContent()}
      </Content>
    </MergeFieldsContainer>
  );
};

export default MergeFieldsManager; 