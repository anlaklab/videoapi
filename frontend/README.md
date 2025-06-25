# JSON2VIDEO Cloud Studio - Frontend

A professional, cloud-native video editor built with React, featuring real-time collaboration, Firebase integration, and advanced timeline editing capabilities.

## 🚀 Features

- **Professional Video Editor**: Timeline-based editing with multi-track support
- **Cloud-Native Architecture**: Real-time collaboration with Firebase/Firestore
- **Asset Management**: Upload, organize, and manage video, audio, and image assets
- **Authentication**: Secure login with email/password, Google, and GitHub OAuth
- **Project Management**: Save, load, and share projects with versioning
- **Drag & Drop**: Intuitive asset-to-timeline workflow
- **Real-time Preview**: Live video preview with timeline synchronization
- **Responsive Design**: Professional dark theme with modern UI/UX

## 📋 Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Firebase project with Firestore and Storage enabled
- Backend API running (see root README.md)

## 🛠️ Installation

1. **Clone the repository** (if not already done):
   ```bash
   git clone <repository-url>
   cd ffmpeg-copia/frontend
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure environment variables**:
   ```bash
   cp .env.example .env.local
   ```
   
   Edit `.env.local` with your configuration:
   ```env
   # Firebase Configuration (required)
   REACT_APP_FIREBASE_API_KEY=your_firebase_api_key
   REACT_APP_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
   REACT_APP_FIREBASE_PROJECT_ID=your_project_id
   REACT_APP_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
   REACT_APP_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
   REACT_APP_FIREBASE_APP_ID=your_app_id
   
   # API Configuration (required)
   REACT_APP_API_URL=http://localhost:3000/api
   ```

4. **Start the development server**:
   ```bash
   npm start
   ```

5. **Open your browser** to `http://localhost:3001`

## 🔧 Configuration

### Firebase Setup

1. **Create a Firebase project** at [Firebase Console](https://console.firebase.google.com)

2. **Enable Authentication**:
   - Go to Authentication > Sign-in method
   - Enable Email/Password, Google, and GitHub providers

3. **Enable Firestore**:
   - Go to Firestore Database
   - Create database in production mode
   - Set up security rules (see below)

4. **Enable Storage**:
   - Go to Storage
   - Set up storage bucket
   - Configure CORS (see below)

5. **Get configuration**:
   - Go to Project Settings > General
   - Copy the Firebase config object
   - Add values to your `.env.local` file

### Firestore Security Rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can read/write their own data
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Projects - users can read/write their own projects
    match /projects/{projectId} {
      allow read, write: if request.auth != null && 
        (request.auth.uid == resource.data.metadata.createdBy || 
         request.auth.uid in resource.data.metadata.collaborators);
    }
    
    // Assets - users can read/write their own assets
    match /assets/{assetId} {
      allow read, write: if request.auth != null;
    }
  }
}
```

### Storage CORS Configuration

Create a `cors.json` file:
```json
[
  {
    "origin": ["http://localhost:3001", "https://yourdomain.com"],
    "method": ["GET", "POST", "PUT", "DELETE"],
    "maxAgeSeconds": 3600
  }
]
```

Apply CORS settings:
```bash
gsutil cors set cors.json gs://your-bucket-name.appspot.com
```

## 🏗️ Architecture

### Component Structure

```
src/
├── components/
│   ├── Auth/                 # Authentication components
│   │   └── AuthModal.js      # Login/signup modal
│   ├── Canvas/               # Video preview canvas
│   │   └── Canvas.js
│   ├── Timeline/             # Timeline editing components
│   │   ├── Timeline.js       # Main timeline
│   │   ├── TimelineEditor.js # Advanced timeline
│   │   └── AdvancedTimelineControls.js
│   ├── Sidebar/              # Asset management
│   │   └── Sidebar.js
│   ├── Inspector/            # Property inspector
│   │   └── Inspector.js
│   └── CloudVideoEditor.js   # Main editor component
├── hooks/                    # Custom React hooks
│   ├── useTimeline.js        # Timeline state management
│   ├── useTracks.js          # Track management
│   ├── useClips.js           # Clip operations
│   └── usePlayer.js          # Video playback
├── services/                 # Business logic services
│   ├── AuthService.js        # Firebase authentication
│   ├── AssetManager.js       # Asset management
│   ├── ProjectManager.js     # Project CRUD operations
│   └── renderService.js      # Video rendering
├── store/                    # Global state management
│   └── useEditorStore.js     # Zustand store
└── config/                   # Configuration
    └── firebase.js           # Firebase initialization
```

### State Management

The application uses a hybrid approach:
- **Zustand** for global UI state (timeline position, upload progress)
- **Custom hooks** for domain-specific logic (tracks, clips, player)
- **Firebase** for persistent data (projects, assets, user profiles)

### Data Flow

1. **Authentication**: User logs in via AuthService
2. **Project Loading**: ProjectManager loads user projects from Firestore
3. **Asset Management**: AssetManager handles file uploads and organization
4. **Timeline Editing**: Custom hooks manage timeline state and operations
5. **Real-time Sync**: Firebase listeners update UI in real-time
6. **Rendering**: RenderService processes timeline for video output

## 🧪 Testing

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### Test Structure

```
src/
├── components/
│   └── __tests__/           # Component tests
├── hooks/
│   └── __tests__/           # Hook tests
├── services/
│   └── __tests__/           # Service tests
└── utils/
    └── __tests__/           # Utility tests
```

## 📦 Building for Production

1. **Build the application**:
   ```bash
   npm run build
   ```

2. **Test the production build**:
   ```bash
   npm install -g serve
   serve -s build -l 3001
   ```

3. **Deploy** (example with Netlify):
   ```bash
   npm install -g netlify-cli
   netlify deploy --prod --dir=build
   ```

## 🔍 Debugging

### Development Tools

- **React Developer Tools**: Browser extension for React debugging
- **Redux DevTools**: For Zustand store inspection (if enabled)
- **Firebase Emulator**: Local Firebase development

### Common Issues

1. **Firebase Connection Issues**:
   - Check your API keys in `.env.local`
   - Verify Firebase project settings
   - Check browser console for CORS errors

2. **Asset Upload Failures**:
   - Verify Firebase Storage rules
   - Check file size limits
   - Ensure CORS is configured

3. **Authentication Problems**:
   - Enable authentication providers in Firebase Console
   - Check domain authorization
   - Verify OAuth app configurations

### Logging

The application includes configurable logging:
- Set `REACT_APP_DEBUG_MODE=true` for detailed logs
- Set `REACT_APP_SHOW_CONSOLE_LOGS=false` for production

## 🚀 Deployment

### Environment Variables for Production

```env
REACT_APP_FIREBASE_API_KEY=your_production_api_key
REACT_APP_FIREBASE_AUTH_DOMAIN=your_production_domain
REACT_APP_API_URL=https://your-api-domain.com/api
REACT_APP_ENVIRONMENT=production
REACT_APP_DEBUG_MODE=false
REACT_APP_SHOW_CONSOLE_LOGS=false
```

### Performance Optimization

1. **Code Splitting**: Components are lazy-loaded where appropriate
2. **Asset Optimization**: Images and videos are compressed
3. **Caching**: Aggressive caching for static assets
4. **CDN**: Use a CDN for global distribution

## 🤝 Contributing

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature/amazing-feature`
3. **Follow code style**: Run `npm run lint` and `npm run format`
4. **Write tests**: Ensure your code is well-tested
5. **Commit changes**: Use conventional commit messages
6. **Push to branch**: `git push origin feature/amazing-feature`
7. **Open a Pull Request**

### Code Style

- **ESLint**: Enforces code quality rules
- **Prettier**: Automatic code formatting
- **Husky**: Pre-commit hooks for quality checks

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](../LICENSE) file for details.

## 🆘 Support

- **Documentation**: Check this README and code comments
- **Issues**: Report bugs via GitHub Issues
- **Discussions**: Join GitHub Discussions for questions
- **Email**: Contact the development team

## 🔄 Changelog

### v1.0.0 (Current)
- Initial release with full video editing capabilities
- Firebase integration for authentication and data storage
- Real-time collaboration features
- Professional UI/UX with dark theme
- Comprehensive asset management system 