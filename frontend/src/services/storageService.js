/**
 * Storage Service - Cloud Storage & Collaboration
 * 
 * Handles project persistence, asset management, and real-time
 * collaboration features using Firebase/Firestore or similar
 * cloud-native storage solutions.
 */

class StorageService {
  constructor() {
    this.baseURL = process.env.REACT_APP_API_URL || 'http://localhost:5000';
    this.userId = this.getUserId();
    this.collaborationSocket = null;
  }

  /**
   * Project Management with Improved Error Handling
   */
  async saveProject(projectId, projectData) {
    try {
      const response = await fetch(`${this.baseURL}/api/projects/${projectId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getAuthToken()}`
        },
        body: JSON.stringify({
          ...projectData,
          userId: this.userId,
          lastModified: new Date().toISOString()
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to save project: ${response.statusText}`);
      }

      const result = await response.json();
      
      // Trigger collaboration sync
      this.syncProjectUpdate(projectId, projectData);
      
      return result;
    } catch (error) {
      console.warn('⚠️ Cloud save failed, using local storage fallback:', error);
      
      // Fallback to localStorage for development/offline mode
      try {
        const localData = {
          ...projectData,
          userId: this.userId,
          lastModified: new Date().toISOString(),
          savedLocally: true
        };
        
        localStorage.setItem(`project_${projectId}`, JSON.stringify(localData));
        console.log('✅ Project saved to local storage as fallback');
        
        return { success: true, savedLocally: true };
      } catch (localError) {
        console.error('❌ Both cloud and local save failed:', localError);
        throw new Error('Failed to save project to cloud or local storage');
      }
    }
  }

  async loadProject(projectId) {
    try {
      const response = await fetch(`${this.baseURL}/api/projects/${projectId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.getAuthToken()}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to load project: ${response.statusText}`);
      }

      const projectData = await response.json();
      
      // Initialize collaboration session
      this.initCollaboration(projectId);
      
      return projectData;
    } catch (error) {
      console.error('Load project failed:', error);
      throw error;
    }
  }

  async createProject(projectData) {
    try {
      const response = await fetch(`${this.baseURL}/api/projects`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getAuthToken()}`
        },
        body: JSON.stringify({
          ...projectData,
          userId: this.userId,
          createdAt: new Date().toISOString(),
          collaborators: [this.userId]
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to create project: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Create project failed:', error);
      throw error;
    }
  }

  async deleteProject(projectId) {
    try {
      const response = await fetch(`${this.baseURL}/api/projects/${projectId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${this.getAuthToken()}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to delete project: ${response.statusText}`);
      }

      return true;
    } catch (error) {
      console.error('Delete project failed:', error);
      throw error;
    }
  }

  async listProjects(filter = {}) {
    try {
      const queryParams = new URLSearchParams({
        userId: this.userId,
        ...filter
      });

      const response = await fetch(`${this.baseURL}/api/projects?${queryParams}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.getAuthToken()}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to list projects: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('List projects failed:', error);
      throw error;
    }
  }

  /**
   * Asset Management
   */
  async uploadAsset(file, metadata = {}) {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('metadata', JSON.stringify({
        ...metadata,
        userId: this.userId,
        uploadedAt: new Date().toISOString()
      }));

      const response = await fetch(`${this.baseURL}/api/assets/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.getAuthToken()}`
        },
        body: formData
      });

      if (!response.ok) {
        throw new Error(`Failed to upload asset: ${response.statusText}`);
      }

      const result = await response.json();
      
      // Generate thumbnail and extract metadata
      await this.processAssetMetadata(result.assetId);
      
      return result;
    } catch (error) {
      console.error('Upload asset failed:', error);
      throw error;
    }
  }

  async listAssets(category = null, search = '') {
    try {
      const queryParams = new URLSearchParams({
        userId: this.userId,
        ...(category && { category }),
        ...(search && { search })
      });

      const response = await fetch(`${this.baseURL}/api/assets?${queryParams}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.getAuthToken()}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to list assets: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('List assets failed:', error);
      throw error;
    }
  }

  async deleteAsset(assetId) {
    try {
      const response = await fetch(`${this.baseURL}/api/assets/${assetId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${this.getAuthToken()}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to delete asset: ${response.statusText}`);
      }

      return true;
    } catch (error) {
      console.error('Delete asset failed:', error);
      throw error;
    }
  }

  async processAssetMetadata(assetId) {
    try {
      const response = await fetch(`${this.baseURL}/api/assets/${assetId}/process`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.getAuthToken()}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to process asset: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Process asset failed:', error);
      throw error;
    }
  }

  /**
   * Real-time Collaboration
   */
  initCollaboration(projectId) {
    if (this.collaborationSocket) {
      this.collaborationSocket.close();
    }

    const wsUrl = `${this.baseURL.replace('http', 'ws')}/ws/collaboration/${projectId}`;
    this.collaborationSocket = new WebSocket(wsUrl);

    this.collaborationSocket.onopen = () => {
      console.log('🤝 Collaboration session started');
      this.sendCollaborationMessage({
        type: 'join',
        userId: this.userId,
        timestamp: Date.now()
      });
    };

    this.collaborationSocket.onmessage = (event) => {
      const message = JSON.parse(event.data);
      this.handleCollaborationMessage(message);
    };

    this.collaborationSocket.onerror = (error) => {
      console.error('Collaboration error:', error);
    };

    return this.collaborationSocket;
  }

  sendCollaborationMessage(message) {
    if (this.collaborationSocket?.readyState === WebSocket.OPEN) {
      this.collaborationSocket.send(JSON.stringify({
        ...message,
        userId: this.userId,
        timestamp: Date.now()
      }));
    }
  }

  handleCollaborationMessage(message) {
    // Emit events for different collaboration actions
    const event = new CustomEvent('collaboration', {
      detail: message
    });
    window.dispatchEvent(event);
  }

  syncProjectUpdate(projectId, changes) {
    this.sendCollaborationMessage({
      type: 'project_update',
      projectId,
      changes,
      version: Date.now()
    });
  }

  syncCursorPosition(position) {
    this.sendCollaborationMessage({
      type: 'cursor_position',
      position,
      throttle: true
    });
  }

  syncSelection(selection) {
    this.sendCollaborationMessage({
      type: 'selection_change',
      selection
    });
  }

  /**
   * Templates & Libraries
   */
  async saveTemplate(templateData) {
    try {
      const response = await fetch(`${this.baseURL}/api/templates`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getAuthToken()}`
        },
        body: JSON.stringify({
          ...templateData,
          userId: this.userId,
          createdAt: new Date().toISOString()
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to save template: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Save template failed:', error);
      throw error;
    }
  }

  async listTemplates(category = null) {
    try {
      const queryParams = new URLSearchParams({
        ...(category && { category })
      });

      const response = await fetch(`${this.baseURL}/api/templates?${queryParams}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.getAuthToken()}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to list templates: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('List templates failed:', error);
      throw error;
    }
  }

  /**
   * Version Control & History
   */
  async saveVersion(projectId, versionData) {
    try {
      const response = await fetch(`${this.baseURL}/api/projects/${projectId}/versions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getAuthToken()}`
        },
        body: JSON.stringify({
          ...versionData,
          userId: this.userId,
          timestamp: new Date().toISOString()
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to save version: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Save version failed:', error);
      throw error;
    }
  }

  async listVersions(projectId) {
    try {
      const response = await fetch(`${this.baseURL}/api/projects/${projectId}/versions`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.getAuthToken()}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to list versions: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('List versions failed:', error);
      throw error;
    }
  }

  async restoreVersion(projectId, versionId) {
    try {
      const response = await fetch(`${this.baseURL}/api/projects/${projectId}/versions/${versionId}/restore`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.getAuthToken()}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to restore version: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Restore version failed:', error);
      throw error;
    }
  }

  /**
   * Sharing & Permissions
   */
  async shareProject(projectId, collaborators, permissions = 'view') {
    try {
      const response = await fetch(`${this.baseURL}/api/projects/${projectId}/share`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getAuthToken()}`
        },
        body: JSON.stringify({
          collaborators,
          permissions, // 'view', 'edit', 'admin'
          sharedBy: this.userId,
          sharedAt: new Date().toISOString()
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to share project: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Share project failed:', error);
      throw error;
    }
  }

  async generateShareLink(projectId, options = {}) {
    try {
      const response = await fetch(`${this.baseURL}/api/projects/${projectId}/share-link`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getAuthToken()}`
        },
        body: JSON.stringify({
          ...options,
          createdBy: this.userId,
          createdAt: new Date().toISOString()
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to generate share link: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Generate share link failed:', error);
      throw error;
    }
  }

  /**
   * Utility Methods
   */
  getUserId() {
    // In a real app, this would come from authentication
    return localStorage.getItem('userId') || 'anonymous-user';
  }

  getAuthToken() {
    // In a real app, this would come from authentication
    return localStorage.getItem('authToken') || 'dev-token';
  }

  /**
   * Offline Support
   */
  async syncOfflineChanges() {
    const offlineChanges = this.getOfflineChanges();
    
    for (const change of offlineChanges) {
      try {
        await this.applyOfflineChange(change);
        this.removeOfflineChange(change.id);
      } catch (error) {
        console.error('Failed to sync offline change:', error);
      }
    }
  }

  saveOfflineChange(change) {
    const changes = this.getOfflineChanges();
    changes.push({
      ...change,
      id: Date.now().toString(),
      timestamp: new Date().toISOString()
    });
    localStorage.setItem('offlineChanges', JSON.stringify(changes));
  }

  getOfflineChanges() {
    try {
      return JSON.parse(localStorage.getItem('offlineChanges') || '[]');
    } catch {
      return [];
    }
  }

  removeOfflineChange(changeId) {
    const changes = this.getOfflineChanges();
    const filtered = changes.filter(c => c.id !== changeId);
    localStorage.setItem('offlineChanges', JSON.stringify(filtered));
  }

  async applyOfflineChange(change) {
    switch (change.type) {
      case 'project_save':
        return this.saveProject(change.projectId, change.data);
      case 'asset_upload':
        return this.uploadAsset(change.file, change.metadata);
      default:
        console.warn('Unknown offline change type:', change.type);
    }
  }

  /**
   * Cleanup
   */
  cleanup() {
    if (this.collaborationSocket) {
      this.collaborationSocket.close();
      this.collaborationSocket = null;
    }
  }
}

// Export singleton instance
export default new StorageService(); 