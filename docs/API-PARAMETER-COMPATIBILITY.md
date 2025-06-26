# 🔄 JSON2VIDEO API Parameter Compatibility Analysis

## 🎯 **COMPATIBILITY STATUS: ✅ FULLY COMPATIBLE**

The simplified `/api/render` endpoint **accepts the same JSON structure** that the video editor produces, with some additional flexibility for different naming conventions.

## 📊 **PARAMETER COMPARISON**

### **✅ Core Timeline Structure**

| Component | Video Editor Format | API Accepts | Status |
|-----------|-------------------|-------------|--------|
| **Timeline Root** | `{ timeline: {...} }` | `{ timeline: {...} }` | ✅ **Identical** |
| **Tracks Array** | `timeline.tracks[]` | `timeline.tracks[]` | ✅ **Identical** |
| **Clips Array** | `track.clips[]` | `track.clips[]` | ✅ **Identical** |
| **Duration** | `timeline.duration` | `timeline.duration` | ✅ **Identical** |
| **Resolution** | `timeline.resolution` | `timeline.resolution` | ✅ **Identical** |
| **FPS** | `timeline.fps` | `timeline.fps` | ✅ **Identical** |

### **✅ Track Properties**

| Property | Video Editor | API Support | Notes |
|----------|-------------|-------------|-------|
| **Track ID** | `track.id` | ✅ Supported | Required for identification |
| **Track Type** | `track.type` | ✅ Supported | `video`, `audio`, `text`, `image` |
| **Track Name** | `track.name` | ✅ Supported | Optional, for organization |
| **Clips** | `track.clips[]` | ✅ Supported | Array of clip objects |
| **Enabled** | `track.enabled` | ✅ Supported | Track on/off state |
| **Muted** | `track.muted` | ✅ Supported | Audio mute state |
| **Volume** | `track.volume` | ✅ Supported | Audio volume (0-2) |
| **Color** | `track.color` | ✅ Supported | UI visualization |

### **✅ Clip Properties**

| Property | Video Editor | API Support | Examples |
|----------|-------------|-------------|----------|
| **Clip ID** | `clip.id` | ✅ Supported | `"clip-123456"` |
| **Type** | `clip.type` | ✅ Supported | `video`, `audio`, `text`, `image` |
| **Start Time** | `clip.start` | ✅ Supported | `0`, `5.5`, `10` |
| **Duration** | `clip.duration` | ✅ Supported | `3`, `5.5`, `10` |
| **Source** | `clip.src` | ✅ Supported | URLs, file paths |
| **Text Content** | `clip.text` | ✅ Supported | For text clips |
| **Position** | `clip.position` | ✅ Supported | `{x: 100, y: 200}` or `"center"` |
| **Scale** | `clip.scale` | ✅ Supported | `1.0`, `0.5`, `1.5` |
| **Style** | `clip.style` | ✅ Supported | Font properties, colors |

## 🎬 **EXACT FORMAT COMPATIBILITY**

### **Video Editor Output Example:**
```json
{
  "timeline": {
    "duration": 15,
    "fps": 30,
    "resolution": { "width": 1920, "height": 1080 },
    "tracks": [
      {
        "id": "video-1",
        "type": "video",
        "name": "Video Track",
        "clips": [
          {
            "id": "clip-1",
            "type": "video",
            "src": "test-video.mp4",
            "start": 0,
            "duration": 8,
            "position": { "x": 0, "y": 0 },
            "scale": 1.0
          }
        ]
      },
      {
        "id": "text-1", 
        "type": "text",
        "name": "Text Track",
        "clips": [
          {
            "id": "text-clip-1",
            "type": "text",
            "text": "Hello {{name}}!",
            "start": 1,
            "duration": 3,
            "style": {
              "fontSize": 72,
              "color": "#ffffff",
              "fontFamily": "Arial"
            },
            "position": { "x": 960, "y": 300 }
          }
        ]
      }
    ]
  },
  "output": {
    "format": "mp4",
    "quality": "high"
  },
  "mergeFields": {
    "name": "World"
  }
}
```

### **API Accepts - SAME FORMAT! ✅**
```json
{
  "timeline": {
    "duration": 15,
    "fps": 30,
    "resolution": { "width": 1920, "height": 1080 },
    "tracks": [
      {
        "id": "video-1",
        "type": "video", 
        "name": "Video Track",
        "clips": [
          {
            "id": "clip-1",
            "type": "video",
            "src": "test-video.mp4",
            "start": 0,
            "duration": 8,
            "position": { "x": 0, "y": 0 },
            "scale": 1.0
          }
        ]
      },
      {
        "id": "text-1",
        "type": "text", 
        "name": "Text Track",
        "clips": [
          {
            "id": "text-clip-1",
            "type": "text",
            "text": "Hello {{name}}!",
            "start": 1,
            "duration": 3,
            "style": {
              "fontSize": 72,
              "color": "#ffffff", 
              "fontFamily": "Arial"
            },
            "position": { "x": 960, "y": 300 }
          }
        ]
      }
    ]
  },
  "output": {
    "format": "mp4",
    "quality": "high"
  },
  "mergeFields": {
    "name": "World"
  }
}
```

## 🎨 **ADDITIONAL API FEATURES**

### **Enhanced Merge Field Support**
The API supports multiple template syntaxes:

```json
{
  "mergeFields": {
    "title": "My Video",
    "company": "JSON2VIDEO Inc",
    "date": "2025"
  }
}
```

**Supported in text clips:**
- `{{title}}` ← Standard syntax
- `{title}` ← Alternative
- `${title}` ← JavaScript style
- `[title]` ← Bracket style  
- `%title%` ← Percent style

### **Output Configuration**
```json
{
  "output": {
    "format": "mp4",        // mp4, webm, mov
    "quality": "high",      // low, medium, high
    "resolution": {...},    // Custom if different from timeline
    "fps": 30              // Custom if different from timeline
  }
}
```

## 🔧 **API REQUEST FORMAT**

### **Headers Required:**
```
Content-Type: application/json
x-api-key: dev-key-12345
```

### **Endpoint:**
```
POST /api/render
```

### **Complete Request Example:**
```bash
curl -X POST http://localhost:3000/api/render \
  -H "Content-Type: application/json" \
  -H "x-api-key: dev-key-12345" \
  -d '{
    "timeline": {
      # ... same format as video editor output
    },
    "output": {
      "format": "mp4",
      "quality": "medium"
    },
    "mergeFields": {
      "variable": "value"
    }
  }'
```

## ✅ **VALIDATION RULES**

### **Required Fields:**
- ✅ `timeline` object
- ✅ `timeline.tracks` array (minimum 1 track)
- ✅ Each track needs `clips` array
- ✅ Each clip needs `type`, `start`, `duration`

### **Optional Fields:**
- ✅ `output` configuration (defaults applied)
- ✅ `mergeFields` for dynamic content
- ✅ Track and clip metadata (names, IDs, etc.)

## 📊 **RESPONSE FORMAT**

### **Successful Response:**
```json
{
  "success": true,
  "message": "Video rendered successfully",
  "data": {
    "jobId": "render-1234567890",
    "videoUrl": "http://localhost:3000/output/render-1234567890.mp4",
    "thumbnailUrl": "http://localhost:3000/output/render-1234567890_thumb.jpg",
    "duration": 15,
    "processingTime": 2.5,
    "format": "mp4",
    "resolution": { "width": 1920, "height": 1080 },
    "status": "completed"
  }
}
```

## 🎯 **INTEGRATION WORKFLOW**

### **From Video Editor to API:**

1. **Export from Editor:**
   ```javascript
   const projectData = editor.exportProject();
   ```

2. **Send to API:**
   ```javascript
   const response = await fetch('/api/render', {
     method: 'POST',
     headers: {
       'Content-Type': 'application/json',
       'x-api-key': 'dev-key-12345'
     },
     body: JSON.stringify(projectData)
   });
   ```

3. **Get Video URL:**
   ```javascript
   const result = await response.json();
   const videoUrl = result.data.videoUrl;
   ```

## 🏆 **CONCLUSION**

### ✅ **ANSWER: YES, FULLY COMPATIBLE!**

The `/api/render` endpoint accepts **exactly the same JSON structure** that the video editor produces. No conversion or transformation is needed.

### **Key Benefits:**
- 🎯 **Direct compatibility** - Editor output → API input
- 🔄 **No data transformation** required
- 📝 **Enhanced merge fields** with multiple syntaxes
- ⚙️ **Flexible output options** beyond editor defaults
- 🎬 **Professional video rendering** with same timeline structure

### **Migration Path:**
```javascript
// Video Editor Export
const editorData = editor.exportProject();

// Direct API Call - NO CHANGES NEEDED!
const video = await renderVideo(editorData);
```

**The API is designed to be a drop-in replacement for any JSON2VIDEO timeline processing, maintaining 100% parameter compatibility with the video editor while adding enhanced features for merge fields and output customization.** 