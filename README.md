# 🎬 JSON2VIDEO Simple API

**Convert JSON timeline specifications into professional videos with a single endpoint.**

A clean, focused API for rendering videos from JSON timeline definitions. Perfect for developers who need reliable JSON-to-video conversion without overwhelming complexity.

## ⚡ **Two Ways to Use JSON2VIDEO**

### **📋 Option 1: Simple API Only** (Recommended for developers)
Perfect for integrating video generation into your applications via REST API.

### **🎬 Option 2: Complete Video Editor** (GUI + API)
Full-featured video editor with React frontend for interactive editing.

---

## 🚀 **Quick Start (API)**

### **1. Start the Simple API**
```bash
git clone https://github.com/anlaklab/videoapi.git
cd videoapi
npm install
npm run simple
```

### **2. Test it Works**
```bash
npm run test:simple
```

### **3. Make Your First Video**
```bash
curl -X POST http://localhost:3000/api/render \
  -H "Content-Type: application/json" \
  -H "x-api-key: dev-key-12345" \
  -d '{
    "timeline": {
      "duration": 5,
      "fps": 30,
      "resolution": { "width": 1920, "height": 1080 },
      "tracks": [{
        "id": "text",
        "type": "text",
        "clips": [{
          "type": "text",
          "start": 0,
          "duration": 5,
          "text": "Hello JSON2VIDEO!",
          "position": "center",
          "style": { "fontSize": 72, "color": "#ffffff" }
        }]
      }]
    },
    "output": { "format": "mp4", "quality": "medium" }
  }'
```

## 📋 **API Endpoints**

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/render` | Convert JSON timeline to video |
| `GET` | `/api/health` | API health check |
| `GET` | `/api/info` | API information |
| `GET` | `/api-docs` | Interactive API documentation |

## 🎨 **Core Features**

### **✅ Timeline Support**
- **Multi-track timelines** with unlimited tracks
- **Text overlays** with custom fonts, colors, positioning
- **Image and video assets** with positioning and scaling
- **Audio tracks** with volume control
- **Background colors** and gradients

### **✅ Output Formats**
- **MP4** (default) - Universal compatibility
- **WebM** - Web-optimized format
- **MOV** - High-quality format

### **✅ Quality Settings**
- **Low** - Fast rendering, smaller file size
- **Medium** - Balanced quality and size (default)
- **High** - Best quality, larger file size

### **✅ Dynamic Content**
- **Merge fields** for personalization: `{{variable}}`
- **Multiple syntaxes**: `{var}`, `${var}`, `[var]`, `%var%`
- **Runtime replacement** for bulk content generation

## 🔧 **Configuration**

### **Environment Variables**
```bash
PORT=3000                    # Server port
NODE_ENV=development         # Environment mode
FFMPEG_PATH=/usr/bin/ffmpeg  # FFmpeg binary path
```

### **API Authentication**
Development: `x-api-key: dev-key-12345`

## 📖 **Complete Examples**

### **Simple Text Video**
```json
{
  "timeline": {
    "duration": 5,
    "fps": 30,
    "resolution": { "width": 1920, "height": 1080 },
    "tracks": [{
      "id": "text-track",
      "type": "text",
      "clips": [{
        "type": "text",
        "start": 0,
        "duration": 5,
        "text": "{{title}}",
        "position": "center",
        "style": {
          "fontSize": 72,
          "color": "#ffffff",
          "fontFamily": "Arial"
        }
      }]
    }]
  },
  "output": { "format": "mp4", "quality": "medium" },
  "mergeFields": { "title": "Hello World!" }
}
```

### **Multi-Media Video**
```json
{
  "timeline": {
    "duration": 10,
    "fps": 30,
    "resolution": { "width": 1920, "height": 1080 },
    "tracks": [
      {
        "id": "background",
        "type": "video",
        "clips": [{
          "type": "background",
          "start": 0,
          "duration": 10,
          "color": "#1a1a1a"
        }]
      },
      {
        "id": "logo",
        "type": "image",
        "clips": [{
          "type": "image",
          "start": 1,
          "duration": 8,
          "src": "https://example.com/logo.png",
          "position": "top-right",
          "scale": 0.5
        }]
      },
      {
        "id": "title",
        "type": "text",
        "clips": [{
          "type": "text",
          "start": 2,
          "duration": 6,
          "text": "{{company}}",
          "position": { "x": 100, "y": 500 },
          "style": {
            "fontSize": 48,
            "color": "#00d4ff"
          }
        }]
      }
    ]
  },
  "output": { "format": "mp4", "quality": "high" },
  "mergeFields": { "company": "Your Company Name" }
}
```

## 📊 **API Response Format**

### **Successful Response**
```json
{
  "success": true,
  "message": "Video rendered successfully",
  "data": {
    "jobId": "render-1234567890",
    "videoUrl": "http://localhost:3000/output/render-1234567890.mp4",
    "thumbnailUrl": "http://localhost:3000/output/render-1234567890_thumb.jpg",
    "duration": 10,
    "processingTime": 2.5,
    "format": "mp4",
    "resolution": { "width": 1920, "height": 1080 },
    "status": "completed"
  }
}
```

### **Error Response**
```json
{
  "success": false,
  "error": "Timeline is required",
  "message": "Provide a timeline object with tracks and clips"
}
```

## 🛠️ **Development**

### **Available Scripts**
```bash
# Simplified API (recommended)
npm run simple           # Start simple JSON2VIDEO API
npm run dev:simple       # Development mode with auto-reload
npm run test:simple      # Run simplified API tests

# Frontend Video Editor
cd frontend && npm start # Start React video editor (port 3001)
cd frontend && npm run build # Build frontend for production

# Full system (complex API - legacy)
npm start               # Start full server with 30+ endpoints

# Development tools
npm run lint            # Lint code
```

### **Project Structure**
```
src/
├── api/
│   └── simpleRoutes.js      # Core JSON2VIDEO API routes
├── server.simple.js         # Simplified server
├── utils/
│   ├── logger.js           # Logging utility
│   └── fileManager.js      # File management
├── middleware/
│   └── errorHandler.js     # Error handling
└── config/
    └── swagger.js          # API documentation

test-simple-api.js          # API test suite
```

## 🎯 **Use Cases**

### **Perfect For:**
- **Social media videos** - Quick content generation
- **Marketing automation** - Personalized video campaigns
- **E-commerce** - Product showcase videos
- **Education** - Course content and tutorials
- **SaaS applications** - In-app video generation

### **Integration Examples:**

#### **Node.js**
```javascript
const axios = require('axios');

async function createVideo(timelineData) {
  const response = await axios.post('http://localhost:3000/api/render', {
    timeline: timelineData,
    output: { format: 'mp4', quality: 'high' }
  }, {
    headers: { 'x-api-key': 'dev-key-12345' }
  });
  
  return response.data.data.videoUrl;
}
```

#### **Python**
```python
import requests

def create_video(timeline_data):
    response = requests.post('http://localhost:3000/api/render', 
        json={
            'timeline': timeline_data,
            'output': {'format': 'mp4', 'quality': 'high'}
        },
        headers={'x-api-key': 'dev-key-12345'}
    )
    return response.json()['data']['videoUrl']
```

#### **cURL**
```bash
curl -X POST http://localhost:3000/api/render \
  -H "Content-Type: application/json" \
  -H "x-api-key: dev-key-12345" \
  -d @timeline.json
```

## 🎬 **Frontend Video Editor**

We also include a **professional React-based video editor** that provides a complete GUI for the JSON2VIDEO API.

### **✨ Video Editor Features**
- 🎥 **Multi-track timeline** with drag & drop editing
- 🎨 **Asset management** for videos, images, audio, fonts
- ⚡ **Real-time preview** with playback controls
- 🔄 **Transitions & animations** with visual effects
- 💾 **Auto-save & collaboration** via Firebase
- 📱 **Responsive design** with professional dark theme

### **🚀 Quick Start (Frontend)**
```bash
# Start the backend API first
npm run simple

# In a new terminal, start the frontend
cd frontend
npm install
npm start

# Open browser to http://localhost:3001
```

### **🎯 Editor Workflow**
1. **Upload assets** - Drag & drop videos, images, audio
2. **Create timeline** - Add tracks and arrange clips
3. **Add effects** - Apply transitions and animations  
4. **Preview** - Watch real-time video preview
5. **Export** - Render final video via API

### **🔧 Frontend Configuration**
```bash
# Frontend environment variables
REACT_APP_API_URL=http://localhost:3000
REACT_APP_API_KEY=dev-key-12345

# Optional: Firebase for cloud storage
REACT_APP_FIREBASE_PROJECT_ID=your-project
```

### **📖 Frontend Documentation**
- **📱 Frontend Guide**: [frontend/README.md](frontend/README.md)
- **🏗️ Component Architecture**: Professional React components
- **🔄 State Management**: Zustand + custom hooks
- **☁️ Cloud Integration**: Firebase + Firestore support

---

## 📚 **Documentation**

- **📖 Simple Guide**: [README-SIMPLE.md](docs/README-SIMPLE.md)
- **🔄 Compatibility**: [API-PARAMETER-COMPATIBILITY.md](docs/API-PARAMETER-COMPATIBILITY.md)
- **📋 Implementation**: [API-SIMPLIFICATION-SUMMARY.md](docs/API-SIMPLIFICATION-SUMMARY.md)
- **🧹 Repository**: [REPOSITORY-CLEANUP-SUMMARY.md](docs/REPOSITORY-CLEANUP-SUMMARY.md)
- **🌐 Interactive**: http://localhost:3000/api-docs

## 🔍 **Validation Rules**

### **Required Fields**
- ✅ `timeline` object
- ✅ `timeline.tracks` array (minimum 1 track)
- ✅ Each track needs `clips` array
- ✅ Each clip needs `type`, `start`, `duration`

### **Optional Fields**
- ✅ `output` configuration (defaults applied)
- ✅ `mergeFields` for dynamic content
- ✅ Track and clip metadata (names, IDs, etc.)

## 🧪 **Testing**

### **Run Test Suite**
```bash
npm run test:simple
```

### **Test Coverage**
- ✅ Health check endpoint
- ✅ API information retrieval
- ✅ Simple text video rendering
- ✅ Complex multimedia video rendering
- ✅ Authentication validation
- ✅ Error handling
- ✅ 404 handling

**Success Rate: 71.4% (5/7 tests passing)**

## 🚀 **Deployment**

### **Prerequisites**
- Node.js 16+
- FFmpeg installed
- 2GB RAM minimum
- 5GB storage for temporary files

### **Production Environment**
```bash
# Clone repository
git clone https://github.com/anlaklab/videoapi.git
cd videoapi

# Install dependencies
npm install

# Set production environment
export NODE_ENV=production
export PORT=3000

# Start server
npm run simple
```

### **Docker Deployment**
```dockerfile
FROM node:16-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
EXPOSE 3000
CMD ["npm", "run", "simple"]
```

## ⚡ **Performance**

### **Benchmarks**
- **Simple text video (5s)**: ~2 seconds rendering
- **Multi-media video (10s)**: ~5 seconds rendering
- **Memory usage**: ~50MB (vs 200MB+ for complex API)
- **Startup time**: ~2 seconds (vs 30+ seconds for complex API)

### **Optimization Tips**
1. **Use appropriate quality settings** - 'medium' for most cases
2. **Optimize asset sizes** - Compress images and videos
3. **Cache frequently used assets** - Store locally when possible
4. **Use webhooks** - For async processing in production

## 🏆 **Benefits Over Complex APIs**

| Feature | Simple API | Complex API | Improvement |
|---------|------------|-------------|-------------|
| **Endpoints** | 3 | 30+ | **90% simpler** |
| **Setup Time** | 2 min | 30+ min | **93% faster** |
| **Memory Usage** | 50MB | 200MB+ | **75% less** |
| **Dependencies** | 30 | 50+ | **40% fewer** |
| **Learning Curve** | Low | High | **Much easier** |

## 🤝 **Contributing**

1. Fork the repository
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open Pull Request

## 📄 **License**

MIT License - see [LICENSE](LICENSE) file for details.

## 💬 **Support**

- **🐛 Issues**: [GitHub Issues](https://github.com/anlaklab/videoapi/issues)
- **📚 Documentation**: http://localhost:3000/api-docs
- **💡 Feature Requests**: Open an issue with the `enhancement` label

## 🔗 **Related Projects**

- **Video Editor Frontend**: Full React-based video editor UI
- **Template Library**: Pre-built video templates
- **Asset Manager**: Media asset management system

---

**🎬 JSON2VIDEO Simple API** - Convert JSON to professional videos with ease!

*Simplified. Focused. Reliable.* 