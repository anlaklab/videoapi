/**
 * Firebase Configuration for Frontend
 * 
 * Configures Firebase services for the video editor:
 * - Firestore for asset metadata
 * - Firebase Storage for file uploads
 * - Authentication (optional)
 */

import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getAuth } from 'firebase/auth';

// Firebase configuration
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY || "demo-api-key",
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN || "json2video-demo.firebaseapp.com",
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID || "json2video-demo",
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET || "json2video-demo.appspot.com",
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || "123456789",
  appId: process.env.REACT_APP_FIREBASE_APP_ID || "1:123456789:web:abcdef"
};

// Initialize Firebase
let app, db, storage, auth;

try {
  app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  storage = getStorage(app);
  auth = getAuth(app);
  
  console.log('🔥 Firebase initialized successfully');
} catch (error) {
  console.warn('⚠️ Firebase initialization failed, using mock services:', error.message);
  
  // Mock services for development
  db = {
    collection: () => ({
      add: () => Promise.resolve({ id: 'mock-id' }),
      get: () => Promise.resolve({ docs: [] }),
      doc: () => ({
        get: () => Promise.resolve({ data: () => null }),
        update: () => Promise.resolve(),
        delete: () => Promise.resolve()
      })
    })
  };
  
  storage = {
    ref: () => ({
      put: () => ({
        on: (event, progress, error, complete) => {
          // Mock upload progress
          setTimeout(() => progress({ bytesTransferred: 50, totalBytes: 100 }), 100);
          setTimeout(() => complete(), 500);
        }
      }),
      getDownloadURL: () => Promise.resolve('https://via.placeholder.com/200')
    })
  };
  
  auth = {
    currentUser: null,
    signInAnonymously: () => Promise.resolve({ user: { uid: 'anonymous' } })
  };
}

export { db, storage, auth };
export default app; 