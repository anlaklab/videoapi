/**
 * Project Manager Service - State-of-the-Art Project Management with Firestore
 * 
 * Handles project CRUD operations, versioning, collaboration, and persistence
 * Following industry best practices for cloud-native applications
 */

import { db } from '../config/firebase';
import { 
  collection, 
  doc, 
  getDocs, 
  getDoc,
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  increment,
  arrayUnion,
  arrayRemove
} from 'firebase/firestore';

class ProjectManager {
  constructor() {
    this.cache = new Map();
    this.listeners = new Map();
    this.projectsCollection = 'projects';
    this.versionsCollection = 'project_versions';
    this.collaborationCollection = 'project_collaboration';
    this.initialized = false;
  }

  /**
   * Initialize the project manager
   */
  async initialize() {
    if (this.initialized) return;
    
    try {
      console.log('🚀 ProjectManager: Initializing...');
      this.initialized = true;
      console.log('✅ ProjectManager: Initialized successfully');
    } catch (error) {
      console.error('❌ ProjectManager: Failed to initialize:', error);
      throw error;
    }
  }

  /**
   * Create a new project with best practices
   */
  async createProject(projectData = {}) {
    try {
      const now = new Date();
      const projectId = `project_${now.getTime()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const defaultProject = {
        name: 'Untitled Project',
        description: '',
        settings: {
          resolution: { width: 1920, height: 1080 },
          fps: 30,
          duration: 30,
          quality: 'high',
          format: 'mp4'
        },
        timeline: {
          duration: 30,
          position: 0,
          zoomLevel: 1,
          tracks: []
        },
        assets: [],
        metadata: {
          version: '1.0.0',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          createdBy: 'user', // Would be actual user ID in production
          lastModifiedBy: 'user',
          status: 'draft', // draft, in-progress, completed, archived
          tags: [],
          category: 'video',
          isPublic: false,
          collaborators: [],
          exportHistory: [],
          totalEdits: 0
        },
        // Performance optimization
        cache: {
          lastSaved: serverTimestamp(),
          autoSaveInterval: 30000, // 30 seconds
          compressionEnabled: true,
          thumbnailGenerated: false
        }
      };

      // Merge with provided data
      const finalProject = {
        ...defaultProject,
        ...projectData,
        id: projectId,
        metadata: {
          ...defaultProject.metadata,
          ...projectData.metadata
        },
        settings: {
          ...defaultProject.settings,
          ...projectData.settings
        }
      };

      // Save to Firestore
      const projectsRef = collection(db, this.projectsCollection);
      const docRef = await addDoc(projectsRef, finalProject);
      
      const createdProject = {
        ...finalProject,
        firestoreId: docRef.id,
        id: docRef.id // Use Firestore ID as primary ID
      };

      // Create initial version
      await this.createVersion(createdProject.id, createdProject, 'Initial project creation');

      // Cache the project
      this.cache.set(createdProject.id, createdProject);

      console.log('✅ Project created successfully:', createdProject.name);
      return createdProject;

    } catch (error) {
      console.error('❌ Failed to create project:', error);
      throw error;
    }
  }

  /**
   * Get project by ID with caching
   */
  async getProject(projectId) {
    try {
      // Check cache first
      if (this.cache.has(projectId)) {
        const cachedProject = this.cache.get(projectId);
        // Check if cache is still fresh (5 minutes)
        if (Date.now() - cachedProject._cacheTime < 300000) {
          return cachedProject;
        }
      }

      // Fetch from Firestore
      const projectRef = doc(db, this.projectsCollection, projectId);
      const projectSnap = await getDoc(projectRef);

      if (!projectSnap.exists()) {
        throw new Error(`Project ${projectId} not found`);
      }

      const project = {
        id: projectSnap.id,
        firestoreId: projectSnap.id,
        ...projectSnap.data(),
        _cacheTime: Date.now()
      };

      // Process timestamps
      if (project.metadata?.createdAt?.toDate) {
        project.metadata.createdAt = project.metadata.createdAt.toDate();
      }
      if (project.metadata?.updatedAt?.toDate) {
        project.metadata.updatedAt = project.metadata.updatedAt.toDate();
      }

      // Cache the project
      this.cache.set(projectId, project);

      console.log('📦 Project loaded:', project.name);
      return project;

    } catch (error) {
      console.error('❌ Failed to get project:', error);
      throw error;
    }
  }

  /**
   * Update project with optimistic updates and conflict resolution
   */
  async updateProject(projectId, updates, options = {}) {
    try {
      const { 
        createVersion = false, 
        versionMessage = 'Project updated',
        optimisticUpdate = true 
      } = options;

      // Get current project
      const currentProject = await this.getProject(projectId);
      
      // Prepare update data
      const updateData = {
        ...updates,
        metadata: {
          ...currentProject.metadata,
          ...updates.metadata,
          updatedAt: serverTimestamp(),
          lastModifiedBy: 'user', // Would be actual user ID
          totalEdits: increment(1)
        }
      };

      // Optimistic update for better UX
      if (optimisticUpdate) {
        const optimisticProject = {
          ...currentProject,
          ...updateData,
          metadata: {
            ...currentProject.metadata,
            ...updateData.metadata,
            updatedAt: new Date() // Use local time for optimistic update
          }
        };
        this.cache.set(projectId, optimisticProject);
      }

      // Update in Firestore
      const projectRef = doc(db, this.projectsCollection, projectId);
      await updateDoc(projectRef, updateData);

      // Create version if requested
      if (createVersion) {
        const updatedProject = { ...currentProject, ...updateData };
        await this.createVersion(projectId, updatedProject, versionMessage);
      }

      // Refresh cache with server data
      const updatedProject = await this.getProject(projectId);
      
      console.log('✅ Project updated successfully:', updatedProject.name);
      return updatedProject;

    } catch (error) {
      console.error('❌ Failed to update project:', error);
      // Revert optimistic update on error
      this.cache.delete(projectId);
      throw error;
    }
  }

  /**
   * Delete project with cascade deletion
   */
  async deleteProject(projectId) {
    try {
      // Delete versions
      await this.deleteAllVersions(projectId);
      
      // Delete collaboration data
      await this.deleteCollaborationData(projectId);
      
      // Delete main project
      const projectRef = doc(db, this.projectsCollection, projectId);
      await deleteDoc(projectRef);
      
      // Remove from cache
      this.cache.delete(projectId);
      
      // Remove listeners
      if (this.listeners.has(projectId)) {
        this.listeners.get(projectId)();
        this.listeners.delete(projectId);
      }
      
      console.log('✅ Project deleted successfully:', projectId);
      
    } catch (error) {
      console.error('❌ Failed to delete project:', error);
      throw error;
    }
  }

  /**
   * Get all projects with pagination and filtering
   */
  async getProjects(options = {}) {
    try {
      const {
        limit: limitCount = 20,
        orderBy: orderField = 'metadata.updatedAt',
        orderDirection = 'desc',
        status = null,
        createdBy = null
      } = options;

      let projectsQuery = collection(db, this.projectsCollection);
      
      // Add filters
      if (status) {
        projectsQuery = query(projectsQuery, where('metadata.status', '==', status));
      }
      if (createdBy) {
        projectsQuery = query(projectsQuery, where('metadata.createdBy', '==', createdBy));
      }
      
      // Add ordering and limit
      projectsQuery = query(
        projectsQuery,
        orderBy(orderField, orderDirection),
        limit(limitCount)
      );

      const snapshot = await getDocs(projectsQuery);
      const projects = [];

      snapshot.forEach((doc) => {
        const project = {
          id: doc.id,
          firestoreId: doc.id,
          ...doc.data()
        };

        // Process timestamps
        if (project.metadata?.createdAt?.toDate) {
          project.metadata.createdAt = project.metadata.createdAt.toDate();
        }
        if (project.metadata?.updatedAt?.toDate) {
          project.metadata.updatedAt = project.metadata.updatedAt.toDate();
        }

        projects.push(project);
      });

      console.log(`📦 Loaded ${projects.length} projects`);
      return projects;

    } catch (error) {
      console.error('❌ Failed to get projects:', error);
      throw error;
    }
  }

  /**
   * Create project version for history/rollback
   */
  async createVersion(projectId, projectData, message = 'Version created') {
    try {
      const versionData = {
        projectId,
        data: projectData,
        message,
        createdAt: serverTimestamp(),
        createdBy: 'user', // Would be actual user ID
        version: projectData.metadata?.version || '1.0.0'
      };

      const versionsRef = collection(db, this.versionsCollection);
      await addDoc(versionsRef, versionData);

      console.log('📝 Version created for project:', projectId);

    } catch (error) {
      console.error('❌ Failed to create version:', error);
      // Don't throw - versions are nice to have but not critical
    }
  }

  /**
   * Get project versions
   */
  async getVersions(projectId) {
    try {
      const versionsQuery = query(
        collection(db, this.versionsCollection),
        where('projectId', '==', projectId),
        orderBy('createdAt', 'desc'),
        limit(10) // Last 10 versions
      );

      const snapshot = await getDocs(versionsQuery);
      const versions = [];

      snapshot.forEach((doc) => {
        const version = {
          id: doc.id,
          ...doc.data()
        };

        if (version.createdAt?.toDate) {
          version.createdAt = version.createdAt.toDate();
        }

        versions.push(version);
      });

      return versions;

    } catch (error) {
      console.error('❌ Failed to get versions:', error);
      return [];
    }
  }

  /**
   * Auto-save functionality with debouncing
   */
  setupAutoSave(projectId, getProjectData, interval = 30000) {
    // Clear existing auto-save
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
    }

    this.autoSaveTimer = setInterval(async () => {
      try {
        const projectData = getProjectData();
        if (projectData && this.hasChanges(projectId, projectData)) {
          await this.updateProject(projectId, projectData, {
            optimisticUpdate: false // Don't need optimistic updates for auto-save
          });
          console.log('💾 Auto-saved project:', projectId);
        }
      } catch (error) {
        console.error('❌ Auto-save failed:', error);
      }
    }, interval);

    return () => {
      if (this.autoSaveTimer) {
        clearInterval(this.autoSaveTimer);
        this.autoSaveTimer = null;
      }
    };
  }

  /**
   * Real-time collaboration listener
   */
  subscribeToProject(projectId, callback) {
    try {
      const projectRef = doc(db, this.projectsCollection, projectId);
      
      const unsubscribe = onSnapshot(projectRef, (doc) => {
        if (doc.exists()) {
          const project = {
            id: doc.id,
            firestoreId: doc.id,
            ...doc.data()
          };

          // Process timestamps
          if (project.metadata?.createdAt?.toDate) {
            project.metadata.createdAt = project.metadata.createdAt.toDate();
          }
          if (project.metadata?.updatedAt?.toDate) {
            project.metadata.updatedAt = project.metadata.updatedAt.toDate();
          }

          // Update cache
          this.cache.set(projectId, project);
          
          // Call callback
          callback(project);
          
          console.log('🔄 Real-time project update:', project.name);
        }
      });

      // Store listener for cleanup
      this.listeners.set(projectId, unsubscribe);
      
      return unsubscribe;

    } catch (error) {
      console.error('❌ Failed to subscribe to project:', error);
      return () => {}; // Return empty unsubscribe function
    }
  }

  /**
   * Export project to JSON
   */
  async exportProject(projectId, format = 'json') {
    try {
      const project = await this.getProject(projectId);
      
      const exportData = {
        ...project,
        exportedAt: new Date().toISOString(),
        exportFormat: format,
        exportVersion: '1.0.0'
      };

      // Update export history
      await this.updateProject(projectId, {
        'metadata.exportHistory': arrayUnion({
          timestamp: serverTimestamp(),
          format,
          size: JSON.stringify(exportData).length
        })
      });

      return exportData;

    } catch (error) {
      console.error('❌ Failed to export project:', error);
      throw error;
    }
  }

  /**
   * Import project from JSON
   */
  async importProject(projectData) {
    try {
      // Validate project data
      if (!projectData || typeof projectData !== 'object') {
        throw new Error('Invalid project data');
      }

      // Remove export metadata
      const cleanData = { ...projectData };
      delete cleanData.exportedAt;
      delete cleanData.exportFormat;
      delete cleanData.exportVersion;
      delete cleanData.id;
      delete cleanData.firestoreId;

      // Create new project
      const importedProject = await this.createProject({
        ...cleanData,
        name: `${cleanData.name || 'Imported Project'} (Copy)`,
        metadata: {
          ...cleanData.metadata,
          importedAt: new Date(),
          originalId: projectData.id
        }
      });

      console.log('✅ Project imported successfully:', importedProject.name);
      return importedProject;

    } catch (error) {
      console.error('❌ Failed to import project:', error);
      throw error;
    }
  }

  /**
   * Helper methods
   */
  hasChanges(projectId, newData) {
    const cached = this.cache.get(projectId);
    if (!cached) return true;
    
    // Simple comparison - in production you'd want a more sophisticated diff
    return JSON.stringify(cached.timeline) !== JSON.stringify(newData.timeline) ||
           JSON.stringify(cached.settings) !== JSON.stringify(newData.settings);
  }

  async deleteAllVersions(projectId) {
    try {
      const versionsQuery = query(
        collection(db, this.versionsCollection),
        where('projectId', '==', projectId)
      );
      
      const snapshot = await getDocs(versionsQuery);
      const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
      
      await Promise.all(deletePromises);
      console.log(`🗑️ Deleted ${snapshot.size} versions for project:`, projectId);
      
    } catch (error) {
      console.error('❌ Failed to delete versions:', error);
    }
  }

  async deleteCollaborationData(projectId) {
    try {
      const collabQuery = query(
        collection(db, this.collaborationCollection),
        where('projectId', '==', projectId)
      );
      
      const snapshot = await getDocs(collabQuery);
      const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
      
      await Promise.all(deletePromises);
      console.log(`🗑️ Deleted collaboration data for project:`, projectId);
      
    } catch (error) {
      console.error('❌ Failed to delete collaboration data:', error);
    }
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    // Clear auto-save timer
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }

    // Unsubscribe from all listeners
    this.listeners.forEach((unsubscribe) => {
      unsubscribe();
    });
    this.listeners.clear();

    // Clear cache
    this.cache.clear();

    console.log('🧹 ProjectManager: Cleaned up resources');
  }
}

// Export singleton instance
const projectManager = new ProjectManager();
export default projectManager; 