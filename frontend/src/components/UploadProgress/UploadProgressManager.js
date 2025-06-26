/**
 * Upload Progress Manager - Modern Upload Progress Component
 * 
 * Features:
 * - Real-time progress tracking
 * - Multiple file upload support
 * - Modern glassmorphism design
 * - Animated progress indicators
 * - Speed and ETA calculations
 * - Retry functionality for failed uploads
 * - Thumbnail previews
 */

import React, { useEffect, useState } from 'react';
import styled, { keyframes, css } from 'styled-components';
import { 
  Upload, 
  CheckCircle, 
  XCircle, 
  RefreshCw, 
  X, 
  File, 
  Image, 
  Video, 
  Music,
  FileText,
  Minimize2,
  Maximize2
} from 'lucide-react';
import useEditorStore from '../../store/useEditorStore';

// Animations
const slideInUp = keyframes`
  from {
    transform: translateY(100%);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
`;

const progressAnimation = keyframes`
  0% {
    background-position: 0% 50%;
  }
  50% {
    background-position: 100% 50%;
  }
  100% {
    background-position: 0% 50%;
  }
`;

const pulseGlow = keyframes`
  0%, 100% {
    box-shadow: 0 0 20px rgba(0, 212, 255, 0.3);
  }
  50% {
    box-shadow: 0 0 30px rgba(0, 212, 255, 0.6);
  }
`;

const spinLoader = keyframes`
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
`;

// Styled Components
const UploadContainer = styled.div`
  position: fixed;
  bottom: 20px;
  right: 20px;
  width: 420px;
  max-height: 80vh;
  z-index: 1000;
  animation: ${slideInUp} 0.3s ease-out;
  
  ${props => props.$minimized && css`
    width: 300px;
    max-height: 120px;
  `}
  
  @media (max-width: 768px) {
    width: calc(100vw - 40px);
    right: 20px;
    left: 20px;
  }
`;

const UploadPanel = styled.div`
  background: rgba(26, 26, 26, 0.95);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  box-shadow: 
    0 20px 40px rgba(0, 0, 0, 0.3),
    0 0 0 1px rgba(255, 255, 255, 0.05);
  overflow: hidden;
  
  ${props => props.$isActive && css`
    animation: ${pulseGlow} 2s ease-in-out infinite;
  `}
`;

const UploadHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  background: linear-gradient(135deg, rgba(0, 212, 255, 0.1), rgba(0, 150, 200, 0.1));
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
`;

const HeaderTitle = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  font-weight: 600;
  color: white;
  font-size: 0.95rem;
`;

const HeaderControls = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const ControlButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: rgba(255, 255, 255, 0.1);
  border: none;
  border-radius: 8px;
  color: #ccc;
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    background: rgba(255, 255, 255, 0.2);
    color: white;
    transform: scale(1.05);
  }
  
  &:active {
    transform: scale(0.95);
  }
`;

const OverallProgress = styled.div`
  padding: 16px 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
`;

const ProgressLabel = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  font-size: 0.85rem;
  color: #ccc;
`;

const ProgressBar = styled.div`
  width: 100%;
  height: 8px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  overflow: hidden;
  position: relative;
`;

const ProgressFill = styled.div`
  height: 100%;
  background: linear-gradient(
    90deg,
    #00d4ff 0%,
    #0099cc 50%,
    #00d4ff 100%
  );
  background-size: 200% 100%;
  border-radius: 4px;
  width: ${props => props.$progress}%;
  transition: width 0.3s ease;
  
  ${props => props.$animated && css`
    animation: ${progressAnimation} 2s linear infinite;
  `}
`;

const UploadList = styled.div`
  max-height: 400px;
  overflow-y: auto;
  
  &::-webkit-scrollbar {
    width: 6px;
  }
  
  &::-webkit-scrollbar-track {
    background: rgba(255, 255, 255, 0.05);
  }
  
  &::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.2);
    border-radius: 3px;
  }
`;

const UploadItem = styled.div`
  display: flex;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  transition: background 0.2s ease;
  
  &:hover {
    background: rgba(255, 255, 255, 0.02);
  }
  
  &:last-child {
    border-bottom: none;
  }
`;

const FileIcon = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 8px;
  margin-right: 12px;
  flex-shrink: 0;
  
  ${props => {
    switch (props.$type) {
      case 'video':
        return css`
          background: linear-gradient(135deg, #ff6b6b, #ff8e8e);
          color: white;
        `;
      case 'image':
        return css`
          background: linear-gradient(135deg, #4ecdc4, #6ee5e0);
          color: white;
        `;
      case 'audio':
        return css`
          background: linear-gradient(135deg, #45b7d1, #96ceb4);
          color: white;
        `;
      default:
        return css`
          background: linear-gradient(135deg, #666, #888);
          color: white;
        `;
    }
  }}
`;

const FileThumbnail = styled.img`
  width: 40px;
  height: 40px;
  object-fit: cover;
  border-radius: 8px;
  margin-right: 12px;
  flex-shrink: 0;
`;

const FileInfo = styled.div`
  flex: 1;
  min-width: 0;
`;

const FileName = styled.div`
  font-weight: 500;
  color: white;
  font-size: 0.85rem;
  margin-bottom: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const FileDetails = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.75rem;
  color: #999;
`;

const FileSize = styled.span`
  color: #999;
`;

const UploadSpeed = styled.span`
  color: #00d4ff;
`;

const StatusIcon = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  margin-left: 12px;
  flex-shrink: 0;
  
  ${props => props.$status === 'uploading' && css`
    animation: ${spinLoader} 1s linear infinite;
  `}
  
  ${props => props.$status === 'completed' && css`
    color: #4ade80;
  `}
  
  ${props => props.$status === 'failed' && css`
    color: #f87171;
  `}
`;

const RetryButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  background: rgba(248, 113, 113, 0.2);
  border: 1px solid #f87171;
  border-radius: 4px;
  color: #f87171;
  cursor: pointer;
  margin-left: 8px;
  transition: all 0.2s ease;
  
  &:hover {
    background: rgba(248, 113, 113, 0.3);
    transform: scale(1.05);
  }
`;

const ItemProgress = styled.div`
  width: 100%;
  height: 3px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
  overflow: hidden;
  margin-top: 8px;
`;

const ItemProgressFill = styled.div`
  height: 100%;
  background: linear-gradient(90deg, #00d4ff, #0099cc);
  border-radius: 2px;
  width: ${props => props.$progress}%;
  transition: width 0.3s ease;
`;

const EmptyState = styled.div`
  padding: 40px 20px;
  text-align: center;
  color: #666;
  font-size: 0.9rem;
`;

// Helper functions
const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

const formatSpeed = (bytesPerSecond) => {
  return `${formatFileSize(bytesPerSecond)}/s`;
};

const formatTime = (seconds) => {
  if (!seconds || seconds === Infinity) return '--';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const getFileIcon = (fileType) => {
  if (fileType.startsWith('video/')) return Video;
  if (fileType.startsWith('image/')) return Image;
  if (fileType.startsWith('audio/')) return Music;
  if (fileType.startsWith('text/')) return FileText;
  return File;
};

const getFileTypeCategory = (fileType) => {
  if (fileType.startsWith('video/')) return 'video';
  if (fileType.startsWith('image/')) return 'image';
  if (fileType.startsWith('audio/')) return 'audio';
  return 'file';
};

// Main Component
const UploadProgressManager = () => {
  const [minimized, setMinimized] = useState(false);
  
  const {
    uploads,
    updateUploadProgress,
    completeUpload,
    failUpload,
    retryFailedUpload,
    clearCompletedUploads,
    clearFailedUploads,
    hasActiveUploads,
    getTotalUploadProgress
  } = useEditorStore();

  const { active, completed, failed, isUploading, totalProgress } = uploads;

  // Don't render if no uploads
  if (!hasActiveUploads() && completed.length === 0 && failed.length === 0) {
    return null;
  }

  const allUploads = [...active, ...completed, ...failed];
  const activeCount = active.length;
  const completedCount = completed.length;
  const failedCount = failed.length;

  const handleRetry = (uploadId) => {
    retryFailedUpload(uploadId);
  };

  const handleClearCompleted = () => {
    clearCompletedUploads();
  };

  const handleClearFailed = () => {
    clearFailedUploads();
  };

  const renderUploadItem = (upload) => {
    const FileIconComponent = getFileIcon(upload.fileType);
    const fileTypeCategory = getFileTypeCategory(upload.fileType);
    
    return (
      <UploadItem key={upload.id}>
        {upload.thumbnail ? (
          <FileThumbnail src={upload.thumbnail} alt={upload.filename} />
        ) : (
          <FileIcon $type={fileTypeCategory}>
            <FileIconComponent size={20} />
          </FileIcon>
        )}
        
        <FileInfo>
          <FileName>{upload.filename}</FileName>
          <FileDetails>
            <FileSize>{formatFileSize(upload.fileSize)}</FileSize>
            {upload.status === 'uploading' && upload.speed > 0 && (
              <UploadSpeed>{formatSpeed(upload.speed)}</UploadSpeed>
            )}
            {upload.status === 'uploading' && upload.estimatedTime && (
              <span>ETA: {formatTime(upload.estimatedTime)}</span>
            )}
          </FileDetails>
          
          {upload.status === 'uploading' && (
            <ItemProgress>
              <ItemProgressFill $progress={upload.progress} />
            </ItemProgress>
          )}
        </FileInfo>
        
        <StatusIcon $status={upload.status}>
          {upload.status === 'uploading' && <Upload size={16} />}
          {upload.status === 'completed' && <CheckCircle size={16} />}
          {upload.status === 'failed' && <XCircle size={16} />}
        </StatusIcon>
        
        {upload.status === 'failed' && (
          <RetryButton onClick={() => handleRetry(upload.id)}>
            <RefreshCw size={12} />
          </RetryButton>
        )}
      </UploadItem>
    );
  };

  return (
    <UploadContainer $minimized={minimized}>
      <UploadPanel $isActive={isUploading}>
        <UploadHeader>
          <HeaderTitle>
            <Upload size={18} />
            {isUploading ? 'Uploading Files' : 'Upload Complete'}
            {activeCount > 0 && (
              <span style={{ color: '#00d4ff', fontSize: '0.8rem' }}>
                ({activeCount} active)
              </span>
            )}
          </HeaderTitle>
          
          <HeaderControls>
            {completedCount > 0 && (
              <ControlButton onClick={handleClearCompleted} title="Clear completed">
                <CheckCircle size={14} />
              </ControlButton>
            )}
            {failedCount > 0 && (
              <ControlButton onClick={handleClearFailed} title="Clear failed">
                <XCircle size={14} />
              </ControlButton>
            )}
            <ControlButton 
              onClick={() => setMinimized(!minimized)}
              title={minimized ? 'Expand' : 'Minimize'}
            >
              {minimized ? <Maximize2 size={14} /> : <Minimize2 size={14} />}
            </ControlButton>
          </HeaderControls>
        </UploadHeader>
        
        {!minimized && (
          <>
            {isUploading && (
              <OverallProgress>
                <ProgressLabel>
                  <span>Overall Progress</span>
                  <span>{Math.round(totalProgress)}%</span>
                </ProgressLabel>
                <ProgressBar>
                  <ProgressFill 
                    $progress={totalProgress} 
                    $animated={isUploading}
                  />
                </ProgressBar>
              </OverallProgress>
            )}
            
            <UploadList>
              {allUploads.length > 0 ? (
                allUploads.map(renderUploadItem)
              ) : (
                <EmptyState>
                  No uploads in progress
                </EmptyState>
              )}
            </UploadList>
          </>
        )}
      </UploadPanel>
    </UploadContainer>
  );
};

export default UploadProgressManager; 