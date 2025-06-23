const { 
  validateVideoRequest, 
  videoClipSchema, 
  trackSchema,
  timelineSchema 
} = require('./src/validation/schemas');

// Test data
const testVideoClip = {
  type: "video",
  src: "/Users/miguelsuredasuau/ffmpeg/assets/videos/test-video.mp4",
  start: 0,
  duration: 5,
  position: {
    x: 0,
    y: 0
  }
};

const testTrack = {
  clips: [testVideoClip]
};

const testTimeline = {
  timeline: {
    background: {
      color: "#1a1a2e"
    },
    tracks: [testTrack]
  }
};

const testRequest = {
  ...testTimeline,
  output: {
    format: "mp4",
    resolution: {
      width: 1920,
      height: 1080
    },
    fps: 30
  }
};

console.log('=== DETAILED VALIDATION TEST ===\n');

console.log('1. Testing video clip validation:');
const clipResult = videoClipSchema.validate(testVideoClip);
if (clipResult.error) {
  console.log('❌ Clip validation failed:', clipResult.error.details);
} else {
  console.log('✅ Clip validation success');
}

console.log('\n2. Testing track validation:');
const trackResult = trackSchema.validate(testTrack);
if (trackResult.error) {
  console.log('❌ Track validation failed:', trackResult.error.details);
} else {
  console.log('✅ Track validation success');
}

console.log('\n3. Testing timeline validation:');
const timelineResult = timelineSchema.validate(testTimeline);
if (timelineResult.error) {
  console.log('❌ Timeline validation failed:', timelineResult.error.details);
} else {
  console.log('✅ Timeline validation success');
}

console.log('\n4. Testing full request validation:');
const requestResult = validateVideoRequest.validate(testRequest);
if (requestResult.error) {
  console.log('❌ Request validation failed:', requestResult.error.details);
} else {
  console.log('✅ Request validation success');
}

console.log('\n5. Testing with debug options:');
const debugResult = validateVideoRequest.validate(testRequest, { 
  abortEarly: false, 
  allowUnknown: false,
  debug: true 
});
if (debugResult.error) {
  console.log('❌ Debug validation failed:');
  debugResult.error.details.forEach((detail, index) => {
    console.log(`   ${index + 1}. Path: ${detail.path.join('.')}`);
    console.log(`      Message: ${detail.message}`);
    console.log(`      Value: ${JSON.stringify(detail.context?.value)}`);
  });
} else {
  console.log('✅ Debug validation success');
} 