# 🎬 JSON2VIDEO Simple API

**Convert JSON timeline specifications into professional videos with a single endpoint.**

## 🚀 Quick Start

### 1. Start the Simple Server
```bash
npm run simple
```

### 2. Test the API
```bash
npm run test:simple
```

### 3. Access Documentation
- **API Docs**: http://localhost:3000/api-docs
- **Health Check**: http://localhost:3000/api/health
- **API Info**: http://localhost:3000/api/info

## 📋 API Endpoints

### Core Endpoint

#### `POST /api/render`
Convert JSON timeline to video

**Headers:**
```
Content-Type: application/json
x-api-key: dev-key-12345
```

**Request Body:**
```json
{
  "timeline": {
    "duration": 10,
    "fps": 30,
    "resolution": {
      "width": 1920,
      "height": 1080
    },
    "tracks": [
      {
        "id": "text-track",
        "type": "text",
        "clips": [
          {
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
          }
        ]
      }
    ]
  },
  "output": {
    "format": "mp4",
    "quality": "medium"
  },
  "mergeFields": {
    "title": "Hello JSON2VIDEO!"
  }
}
```

**Response:**
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
    "resolution": {
      "width": 1920,
      "height": 1080
    }
  }
}
```

### System Endpoints

#### `GET /api/health`
Check API health status

#### `GET /api/info`
Get API information and available endpoints

## 🎨 Features

### Timeline Support
- **Multi-track timelines** with unlimited tracks
- **Text overlays** with custom fonts, colors, and positioning
- **Image and video assets** with positioning and scaling
- **Audio tracks** with volume control
- **Background colors** and gradients

### Output Formats
- **MP4** (default)
- **WebM**
- **MOV**

### Quality Settings
- **Low** - Fast rendering, smaller file size
- **Medium** - Balanced quality and size (default)
- **High** - Best quality, larger file size

### Merge Fields
Dynamic content replacement using templates:
- `{{variable}}` - Standard template syntax
- `{variable}` - Alternative syntax
- `${variable}` - JavaScript-style syntax
- `[variable]` - Bracket syntax
- `%variable%` - Percent syntax

## 📖 Examples

### Simple Text Video
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
          "text": "Hello World!",
          "position": "center",
          "style": {
            "fontSize": 72,
            "color": "#ffffff"
          }
        }]
      }]
    },
    "output": { "format": "mp4", "quality": "medium" }
  }'
```

### Video with Multiple Elements
```bash
curl -X POST http://localhost:3000/api/render \
  -H "Content-Type: application/json" \
  -H "x-api-key: dev-key-12345" \
  -d '{
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
          "id": "title",
          "type": "text",
          "clips": [{
            "type": "text",
            "start": 1,
            "duration": 8,
            "text": "{{company}}",
            "position": { "x": 100, "y": 200 },
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
  }'
```

## 🔧 Configuration

### Environment Variables
```bash
PORT=3000                    # Server port
NODE_ENV=development         # Environment
FFMPEG_PATH=/usr/bin/ffmpeg  # FFmpeg binary path
```

### API Key
For development, use: `dev-key-12345`

For production, set your own API key validation logic in `src/api/simpleRoutes.js`

## 🛠️ Development

### Run in Development Mode
```bash
npm run dev:simple
```

### Test the API
```bash
npm run test:simple
```

### Lint Code
```bash
npm run lint
```

## 📂 Project Structure
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

test-simple-api.js          # API tests
```

## 🧪 Testing

The test suite validates:
- ✅ Health check endpoint
- ✅ API information endpoint
- ✅ Simple text video rendering
- ✅ Complex multimedia video rendering
- ✅ Authentication (API key validation)
- ✅ Error handling (invalid requests)
- ✅ 404 handling (non-existent endpoints)

Run tests with: `npm run test:simple`

## 🎯 Use Cases

### Content Creation
- Social media videos
- Marketing content
- Educational materials
- Product demonstrations

### Automation
- Bulk video generation
- Template-based content
- Dynamic personalization
- Automated publishing

### Integration
- CMS integration
- E-commerce platforms
- Marketing automation
- Custom applications

## 📞 Support

- **Documentation**: http://localhost:3000/api-docs
- **Health Check**: http://localhost:3000/api/health
- **API Information**: http://localhost:3000/api/info

---

**🎬 JSON2VIDEO Simple API** - Convert JSON to professional videos with ease! 