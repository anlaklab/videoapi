/**
 * Editor Store - Zustand Global State Management
 * 
 * Manages global state for:
 * - Timeline playhead position
 * - Upload progress tracking
 * - Editor UI state
 * - Project settings
 * - Selection states
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

const useEditorStore = create(
  subscribeWithSelector((set, get) => ({
    // Timeline State
    timeline: {
      position: 0, // Current playhead position in seconds
      duration: 30, // Total timeline duration
      zoomLevel: 1, // Timeline zoom level
      isPlaying: false, // Playback state
      playbackRate: 1, // Playback speed (0.25x to 2x)
      snapToGrid: true, // Snap to grid enabled
      gridSize: 0.5, // Grid snap interval in seconds
      loopRegion: null, // { start: number, end: number } or null
    },

    // Upload State
    uploads: {
      active: [], // Array of active uploads
      completed: [], // Array of completed uploads
      failed: [], // Array of failed uploads
      totalProgress: 0, // Overall progress percentage
      isUploading: false, // Global upload state
    },

    // Selection State
    selection: {
      selectedClips: [], // Array of selected clip IDs
      selectedTracks: [], // Array of selected track IDs
      selectedAssets: [], // Array of selected asset IDs
      multiSelectMode: false, // Multi-select mode enabled
    },

    // UI State
    ui: {
      sidebarCollapsed: false,
      inspectorCollapsed: false,
      jsonViewerCollapsed: true,
      mergeFieldsOpen: false,
      fullscreenMode: false,
      darkMode: true,
    },

    // Project State
    project: {
      id: null,
      name: 'Untitled Project',
      lastSaved: null,
      isDirty: false, // Has unsaved changes
      autoSaveEnabled: true,
    },

    // Actions - Timeline
    setPlayheadPosition: (position) => set((state) => ({
      timeline: { ...state.timeline, position: Math.max(0, Math.min(position, state.timeline.duration)) }
    })),

    setTimelineDuration: (duration) => set((state) => ({
      timeline: { ...state.timeline, duration: Math.max(1, duration) }
    })),

    setZoomLevel: (zoomLevel) => set((state) => ({
      timeline: { ...state.timeline, zoomLevel: Math.max(0.1, Math.min(10, zoomLevel)) }
    })),

    setPlaybackState: (isPlaying) => set((state) => ({
      timeline: { ...state.timeline, isPlaying }
    })),

    setPlaybackRate: (playbackRate) => set((state) => ({
      timeline: { ...state.timeline, playbackRate: Math.max(0.25, Math.min(2, playbackRate)) }
    })),

    toggleSnapToGrid: () => set((state) => ({
      timeline: { ...state.timeline, snapToGrid: !state.timeline.snapToGrid }
    })),

    setLoopRegion: (loopRegion) => set((state) => ({
      timeline: { ...state.timeline, loopRegion }
    })),

    // Actions - Upload Management
    startUpload: (uploadData) => set((state) => {
      const newUpload = {
        id: `upload-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        filename: uploadData.filename,
        fileSize: uploadData.fileSize,
        fileType: uploadData.fileType,
        progress: 0,
        status: 'uploading', // 'uploading', 'processing', 'completed', 'failed'
        startTime: Date.now(),
        estimatedTime: null,
        speed: 0,
        error: null,
        thumbnail: uploadData.thumbnail || null,
        ...uploadData
      };

      return {
        uploads: {
          ...state.uploads,
          active: [...state.uploads.active, newUpload],
          isUploading: true,
        }
      };
    }),

    updateUploadProgress: (uploadId, progress, additionalData = {}) => set((state) => ({
      uploads: {
        ...state.uploads,
        active: state.uploads.active.map(upload => 
          upload.id === uploadId 
            ? { 
                ...upload, 
                progress: Math.min(100, Math.max(0, progress)),
                ...additionalData,
                speed: additionalData.speed || upload.speed,
                estimatedTime: additionalData.estimatedTime || upload.estimatedTime
              }
            : upload
        ),
        totalProgress: state.uploads.active.length > 0 
          ? state.uploads.active.reduce((sum, upload) => 
              sum + (upload.id === uploadId ? Math.min(100, Math.max(0, progress)) : upload.progress), 0
            ) / state.uploads.active.length
          : 0
      }
    })),

    completeUpload: (uploadId, resultData) => set((state) => {
      const completedUpload = state.uploads.active.find(upload => upload.id === uploadId);
      if (!completedUpload) return state;

      const updatedCompletedUpload = {
        ...completedUpload,
        progress: 100,
        status: 'completed',
        completedTime: Date.now(),
        result: resultData,
      };

      return {
        uploads: {
          ...state.uploads,
          active: state.uploads.active.filter(upload => upload.id !== uploadId),
          completed: [...state.uploads.completed, updatedCompletedUpload],
          isUploading: state.uploads.active.length > 1,
          totalProgress: state.uploads.active.length > 1 
            ? state.uploads.active.filter(u => u.id !== uploadId).reduce((sum, upload) => sum + upload.progress, 0) / (state.uploads.active.length - 1)
            : 0
        }
      };
    }),

    failUpload: (uploadId, error) => set((state) => {
      const failedUpload = state.uploads.active.find(upload => upload.id === uploadId);
      if (!failedUpload) return state;

      const updatedFailedUpload = {
        ...failedUpload,
        status: 'failed',
        error: error.message || error,
        failedTime: Date.now(),
      };

      return {
        uploads: {
          ...state.uploads,
          active: state.uploads.active.filter(upload => upload.id !== uploadId),
          failed: [...state.uploads.failed, updatedFailedUpload],
          isUploading: state.uploads.active.length > 1,
          totalProgress: state.uploads.active.length > 1 
            ? state.uploads.active.filter(u => u.id !== uploadId).reduce((sum, upload) => sum + upload.progress, 0) / (state.uploads.active.length - 1)
            : 0
        }
      };
    }),

    clearCompletedUploads: () => set((state) => ({
      uploads: { ...state.uploads, completed: [] }
    })),

    clearFailedUploads: () => set((state) => ({
      uploads: { ...state.uploads, failed: [] }
    })),

    retryFailedUpload: (uploadId) => set((state) => {
      const failedUpload = state.uploads.failed.find(upload => upload.id === uploadId);
      if (!failedUpload) return state;

      const retriedUpload = {
        ...failedUpload,
        status: 'uploading',
        progress: 0,
        error: null,
        retryCount: (failedUpload.retryCount || 0) + 1,
        startTime: Date.now(),
      };

      return {
        uploads: {
          ...state.uploads,
          active: [...state.uploads.active, retriedUpload],
          failed: state.uploads.failed.filter(upload => upload.id !== uploadId),
          isUploading: true,
        }
      };
    }),

    // Actions - Selection Management
    selectClips: (clipIds, multiSelect = false) => set((state) => ({
      selection: {
        ...state.selection,
        selectedClips: multiSelect 
          ? [...new Set([...state.selection.selectedClips, ...clipIds])]
          : clipIds
      }
    })),

    deselectClips: (clipIds) => set((state) => ({
      selection: {
        ...state.selection,
        selectedClips: state.selection.selectedClips.filter(id => !clipIds.includes(id))
      }
    })),

    clearClipSelection: () => set((state) => ({
      selection: { ...state.selection, selectedClips: [] }
    })),

    selectTracks: (trackIds, multiSelect = false) => set((state) => ({
      selection: {
        ...state.selection,
        selectedTracks: multiSelect 
          ? [...new Set([...state.selection.selectedTracks, ...trackIds])]
          : trackIds
      }
    })),

    clearTrackSelection: () => set((state) => ({
      selection: { ...state.selection, selectedTracks: [] }
    })),

    // Actions - UI State
    toggleSidebar: () => set((state) => ({
      ui: { ...state.ui, sidebarCollapsed: !state.ui.sidebarCollapsed }
    })),

    toggleInspector: () => set((state) => ({
      ui: { ...state.ui, inspectorCollapsed: !state.ui.inspectorCollapsed }
    })),

    toggleJsonViewer: () => set((state) => ({
      ui: { ...state.ui, jsonViewerCollapsed: !state.ui.jsonViewerCollapsed }
    })),

    setMergeFieldsOpen: (open) => set((state) => ({
      ui: { ...state.ui, mergeFieldsOpen: open }
    })),

    toggleFullscreen: () => set((state) => ({
      ui: { ...state.ui, fullscreenMode: !state.ui.fullscreenMode }
    })),

    // Actions - Project Management
    setProjectName: (name) => set((state) => ({
      project: { ...state.project, name, isDirty: true }
    })),

    markProjectSaved: () => set((state) => ({
      project: { ...state.project, lastSaved: new Date().toISOString(), isDirty: false }
    })),

    markProjectDirty: () => set((state) => ({
      project: { ...state.project, isDirty: true }
    })),

    // Utility Actions
    resetEditor: () => set(() => ({
      timeline: {
        position: 0,
        duration: 30,
        zoomLevel: 1,
        isPlaying: false,
        playbackRate: 1,
        snapToGrid: true,
        gridSize: 0.5,
        loopRegion: null,
      },
      selection: {
        selectedClips: [],
        selectedTracks: [],
        selectedAssets: [],
        multiSelectMode: false,
      },
      project: {
        id: null,
        name: 'Untitled Project',
        lastSaved: null,
        isDirty: false,
        autoSaveEnabled: true,
      }
    })),

    // Computed getters
    getActiveUploads: () => get().uploads.active,
    getCompletedUploads: () => get().uploads.completed,
    getFailedUploads: () => get().uploads.failed,
    getTotalUploadProgress: () => get().uploads.totalProgress,
    isUploading: () => get().uploads.isUploading,
    hasActiveUploads: () => get().uploads.active.length > 0,
    getSelectedClips: () => get().selection.selectedClips,
    getSelectedTracks: () => get().selection.selectedTracks,
    getPlayheadPosition: () => get().timeline.position,
    getTimelineDuration: () => get().timeline.duration,
    isPlaying: () => get().timeline.isPlaying,
    getZoomLevel: () => get().timeline.zoomLevel,
  }))
);

export default useEditorStore; 