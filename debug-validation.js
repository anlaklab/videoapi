const { validateVideoRequest, videoClipSchema } = require('./src/validation/schemas');

// Test simple video clip
const testVideoClip = {
  type: "video",
  src: "./assets/videos/test-video.mp4",
  start: 0,
  duration: 5,
  position: {
    x: 0,
    y: 0
  }
};

console.log('Testing video clip validation:');
const clipResult = videoClipSchema.validate(testVideoClip);
console.log('Clip validation result:', clipResult.error ? clipResult.error.details : 'SUCCESS');

// Test full request
const testRequest = {
  timeline: {
    background: {
      color: "#1a1a2e"
    },
    tracks: [
      {
        clips: [testVideoClip]
      }
    ]
  },
  output: {
    format: "mp4",
    resolution: {
      width: 1920,
      height: 1080
    },
    fps: 30
  }
};

console.log('\nTesting full request validation:');
const requestResult = validateVideoRequest.validate(testRequest);
console.log('Request validation result:', requestResult.error ? requestResult.error.details : 'SUCCESS'); 