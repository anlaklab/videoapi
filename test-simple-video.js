#!/usr/bin/env node

const axios = require('axios');

const API_BASE = 'http://localhost:3000/api';
const API_KEY = 'dev-key-12345';

async function testSimpleVideo() {
  try {
    console.log('🧪 Testing Simple Text-Only Video...\n');

    const videoData = {
      timeline: {
        tracks: [
          {
            clips: [
              {
                type: 'text',
                text: '🎉 AFTER EFFECTS TEMPLATE-WORKER SYNC WORKING! 🎉',
                start: 0,
                duration: 6,
                position: { x: 960, y: 400 },
                style: {
                  fontSize: 24,
                  color: '#FFFFFF',
                  textAlign: 'center'
                }
              },
              {
                type: 'text',
                text: '✅ Templates Load Correctly ✅ Merge Fields Process ✅ Videos Render',
                start: 0.5,
                duration: 6,
                position: { x: 960, y: 500 },
                style: {
                  fontSize: 24,
                  color: '#FFFFFF',
                  textAlign: 'center'
                }
              }
            ]
          }
        ],
        background: { color: '#0D4F8C' }
      },
      output: {
        format: 'mp4',
        resolution: { width: 1920, height: 1080 },
        fps: 30
      }
    };

    console.log('🎬 Rendering simple video...');
    const renderResponse = await axios.post(
      `${API_BASE}/video/render`,
      videoData,
      {
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const jobId = renderResponse.data.videoId;
    console.log(`✅ Render job created: ${jobId}`);

    // Poll for status
    console.log('\n⏳ Polling for completion...');
    let attempts = 0;
    const maxAttempts = 20;

    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      attempts++;

      try {
        const statusResponse = await axios.get(
          `${API_BASE}/video/${jobId}/status`,
          {
            headers: {
              'Authorization': `Bearer ${API_KEY}`
            }
          }
        );

        const status = statusResponse.data;
        console.log(`📊 Status (${attempts}/${maxAttempts}): ${status.status} - Progress: ${status.progress || 0}%`);

        if (status.status === 'completed') {
          console.log('\n🎉 Simple video rendered successfully!');
          const result = {
            videoId: status.videoId,
            url: status.resultUrl,
            duration: status.duration,
            size: status.size,
            format: status.format,
            resolution: status.resolution
          };
          console.log('📁 Result:', JSON.stringify(result, null, 2));
          return result;
        } else if (status.status === 'failed') {
          console.error('\n❌ Simple video rendering failed:');
          console.error('Error:', status.error);
          return null;
        }
      } catch (statusError) {
        console.log(`⚠️  Status check ${attempts}: ${statusError.message}`);
      }
    }

    console.log('\n⏰ Timeout waiting for completion');
    return null;

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
    return null;
  }
}

// Run the test
if (require.main === module) {
  testSimpleVideo()
    .then(result => {
      if (result) {
        console.log('\n✅ Test completed successfully!');
        process.exit(0);
      } else {
        console.log('\n❌ Test failed!');
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('\n💥 Test crashed:', error);
      process.exit(1);
    });
}

module.exports = testSimpleVideo; 