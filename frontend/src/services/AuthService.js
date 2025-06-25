/**
 * Firebase Authentication Service
 * 
 * Handles user authentication, session management, and user profiles
 * Provides secure access to Firestore and Storage
 */

import { 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  updateProfile,
  sendPasswordResetEmail,
  GoogleAuthProvider,
  GithubAuthProvider
} from 'firebase/auth';
import { doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase';

class AuthService {
  constructor() {
    this.currentUser = null;
    this.authStateListeners = [];
    this.initialized = false;
    
    // Initialize auth state listener
    this.initializeAuthListener();
  }

  /**
   * Initialize authentication state listener
   */
  initializeAuthListener() {
    onAuthStateChanged(auth, async (user) => {
      if (user) {
        // User is signed in
        this.currentUser = {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
          emailVerified: user.emailVerified,
          createdAt: user.metadata.creationTime,
          lastLoginAt: user.metadata.lastSignInTime
        };

        // Update user profile in Firestore
        await this.updateUserProfile(this.currentUser);
        
        console.log('✅ User authenticated:', this.currentUser.email);
      } else {
        // User is signed out
        this.currentUser = null;
        console.log('👋 User signed out');
      }

      // Notify all listeners
      this.authStateListeners.forEach(callback => callback(this.currentUser));
      this.initialized = true;
    });
  }

  /**
   * Sign in with email and password
   */
  async signInWithEmail(email, password) {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      console.log('✅ Email sign-in successful:', user.email);
      return {
        success: true,
        user: this.currentUser,
        message: 'Successfully signed in'
      };
    } catch (error) {
      console.error('❌ Email sign-in failed:', error.message);
      return {
        success: false,
        error: error.code,
        message: this.getErrorMessage(error.code)
      };
    }
  }

  /**
   * Sign up with email and password
   */
  async signUpWithEmail(email, password, displayName) {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Update display name
      if (displayName) {
        await updateProfile(user, { displayName });
      }

      console.log('✅ Email sign-up successful:', user.email);
      return {
        success: true,
        user: this.currentUser,
        message: 'Account created successfully'
      };
    } catch (error) {
      console.error('❌ Email sign-up failed:', error.message);
      return {
        success: false,
        error: error.code,
        message: this.getErrorMessage(error.code)
      };
    }
  }

  /**
   * Sign in with Google
   */
  async signInWithGoogle() {
    try {
      const provider = new GoogleAuthProvider();
      provider.addScope('profile');
      provider.addScope('email');
      
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      
      console.log('✅ Google sign-in successful:', user.email);
      return {
        success: true,
        user: this.currentUser,
        message: 'Successfully signed in with Google'
      };
    } catch (error) {
      console.error('❌ Google sign-in failed:', error.message);
      return {
        success: false,
        error: error.code,
        message: this.getErrorMessage(error.code)
      };
    }
  }

  /**
   * Sign in with GitHub
   */
  async signInWithGithub() {
    try {
      const provider = new GithubAuthProvider();
      provider.addScope('user:email');
      
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      
      console.log('✅ GitHub sign-in successful:', user.email);
      return {
        success: true,
        user: this.currentUser,
        message: 'Successfully signed in with GitHub'
      };
    } catch (error) {
      console.error('❌ GitHub sign-in failed:', error.message);
      return {
        success: false,
        error: error.code,
        message: this.getErrorMessage(error.code)
      };
    }
  }

  /**
   * Sign out current user
   */
  async signOutUser() {
    try {
      await signOut(auth);
      console.log('✅ User signed out successfully');
      return {
        success: true,
        message: 'Successfully signed out'
      };
    } catch (error) {
      console.error('❌ Sign out failed:', error.message);
      return {
        success: false,
        error: error.code,
        message: 'Failed to sign out'
      };
    }
  }

  /**
   * Send password reset email
   */
  async resetPassword(email) {
    try {
      await sendPasswordResetEmail(auth, email);
      console.log('✅ Password reset email sent:', email);
      return {
        success: true,
        message: 'Password reset email sent successfully'
      };
    } catch (error) {
      console.error('❌ Password reset failed:', error.message);
      return {
        success: false,
        error: error.code,
        message: this.getErrorMessage(error.code)
      };
    }
  }

  /**
   * Update user profile in Firestore
   */
  async updateUserProfile(userData) {
    if (!userData?.uid) return;

    try {
      const userRef = doc(db, 'users', userData.uid);
      const userDoc = await getDoc(userRef);

      const profileData = {
        uid: userData.uid,
        email: userData.email,
        displayName: userData.displayName,
        photoURL: userData.photoURL,
        emailVerified: userData.emailVerified,
        lastLoginAt: new Date(),
        updatedAt: new Date()
      };

      if (userDoc.exists()) {
        // Update existing user
        await updateDoc(userRef, {
          ...profileData,
          loginCount: (userDoc.data().loginCount || 0) + 1
        });
      } else {
        // Create new user profile
        await setDoc(userRef, {
          ...profileData,
          createdAt: new Date(),
          loginCount: 1,
          preferences: {
            theme: 'dark',
            autoSave: true,
            notifications: true
          },
          subscription: {
            plan: 'free',
            startDate: new Date(),
            features: ['basic-editor', 'sample-assets']
          }
        });
      }

      console.log('✅ User profile updated in Firestore');
    } catch (error) {
      console.error('❌ Failed to update user profile:', error);
    }
  }

  /**
   * Get current user profile from Firestore
   */
  async getUserProfile(uid = null) {
    const userId = uid || this.currentUser?.uid;
    if (!userId) return null;

    try {
      const userRef = doc(db, 'users', userId);
      const userDoc = await getDoc(userRef);
      
      if (userDoc.exists()) {
        return userDoc.data();
      }
      return null;
    } catch (error) {
      console.error('❌ Failed to get user profile:', error);
      return null;
    }
  }

  /**
   * Subscribe to authentication state changes
   */
  onAuthStateChange(callback) {
    this.authStateListeners.push(callback);
    
    // If already initialized, call immediately
    if (this.initialized) {
      callback(this.currentUser);
    }

    // Return unsubscribe function
    return () => {
      this.authStateListeners = this.authStateListeners.filter(cb => cb !== callback);
    };
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated() {
    return !!this.currentUser;
  }

  /**
   * Get current user
   */
  getCurrentUser() {
    return this.currentUser;
  }

  /**
   * Check if user has specific permission
   */
  hasPermission(permission) {
    if (!this.currentUser) return false;
    
    // Basic permissions for now - can be extended
    const permissions = {
      'upload-assets': true,
      'create-projects': true,
      'share-projects': this.currentUser.emailVerified,
      'export-video': true,
      'admin-access': false // Would check admin role
    };

    return permissions[permission] || false;
  }

  /**
   * Get user-friendly error messages
   */
  getErrorMessage(errorCode) {
    const errorMessages = {
      'auth/user-not-found': 'No account found with this email address.',
      'auth/wrong-password': 'Incorrect password. Please try again.',
      'auth/email-already-in-use': 'An account already exists with this email address.',
      'auth/weak-password': 'Password should be at least 6 characters long.',
      'auth/invalid-email': 'Please enter a valid email address.',
      'auth/user-disabled': 'This account has been disabled.',
      'auth/too-many-requests': 'Too many failed attempts. Please try again later.',
      'auth/popup-closed-by-user': 'Sign-in popup was closed before completion.',
      'auth/cancelled-popup-request': 'Sign-in was cancelled.',
      'auth/popup-blocked': 'Sign-in popup was blocked by your browser.',
      'auth/operation-not-allowed': 'This sign-in method is not enabled.',
      'auth/invalid-credential': 'The provided credentials are invalid.',
      'auth/network-request-failed': 'Network error. Please check your connection.'
    };

    return errorMessages[errorCode] || 'An unexpected error occurred. Please try again.';
  }

  /**
   * Wait for authentication to initialize
   */
  async waitForAuth() {
    if (this.initialized) return this.currentUser;

    return new Promise((resolve) => {
      const unsubscribe = this.onAuthStateChange((user) => {
        unsubscribe();
        resolve(user);
      });
    });
  }
}

// Export singleton instance
const authService = new AuthService();
export default authService; 