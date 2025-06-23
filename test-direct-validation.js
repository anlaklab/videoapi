const express = require('express');
const { validateVideoRequest } = require('./src/validation/schemas');

// Create the exact same JSON that curl is sending
const testData = {
  "timeline": {
    "background": {
      "color": "#1a1a2e"
    },
    "tracks": [
      {
        "clips": [
          {
            "type": "video",
            "src": "/Users/miguelsuredasuau/ffmpeg/assets/videos/test-video.mp4",
            "start": 0,
            "duration": 5,
            "position": {
              "x": 0,
              "y": 0
            }
          }
        ]
      }
    ]
  },
  "output": {
    "format": "mp4",
    "resolution": {
      "width": 1920,
      "height": 1080
    },
    "fps": 30
  }
};

console.log('Testing the exact data that would come from curl:');
console.log(JSON.stringify(testData, null, 2));

console.log('\n=== VALIDATION RESULT ===');
const { error, value } = validateVideoRequest.validate(testData);

if (error) {
  console.log('❌ VALIDATION FAILED:');
  error.details.forEach((detail, index) => {
    console.log(`${index + 1}. Path: ${detail.path.join('.')}`);
    console.log(`   Message: ${detail.message}`);
    console.log(`   Value: ${JSON.stringify(detail.context?.value)}`);
    console.log(`   Type: ${detail.type}`);
  });
} else {
  console.log('✅ VALIDATION SUCCESS');
  console.log('Validated value:', JSON.stringify(value, null, 2));
} 