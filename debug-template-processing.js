#!/usr/bin/env node

const TemplateManager = require('./src/services/templateManager');
const fs = require('fs-extra');

async function debugTemplateProcessing() {
  try {
    console.log('🔍 Debugging Template Processing...\n');

    // Initialize template manager
    const templateManager = new TemplateManager();
    await templateManager.initialize();

    // Load the After Effects template
    const templateId = 'cdea0e91-07c2-4dd3-8ee5-70c8ad674881';
    const template = templateManager.getTemplate(templateId);

    if (!template) {
      console.error('❌ Template not found!');
      return;
    }

    console.log('📋 Original template timeline:');
    console.log(JSON.stringify(template.timeline, null, 2));

    // Prepare merge fields
    const mergeFields = {
      TITLE: '¡Proyecto After Effects Exitoso!',
      BG_COLOR: '#0D4F8C',
      LOGO_URL: 'assets/images/test-image.jpg'
    };

    console.log('\n📝 Merge fields:');
    console.log(JSON.stringify(mergeFields, null, 2));

    // Apply merge fields
    console.log('\n🔄 Applying merge fields...');
    const processedTimeline = templateManager.applyMergeFields(template.timeline, mergeFields);

    console.log('\n📋 Processed timeline:');
    console.log(JSON.stringify(processedTimeline, null, 2));

    // Check specific clips for issues
    console.log('\n🔍 Checking specific clips:');
    processedTimeline.tracks?.forEach((track, trackIndex) => {
      track.clips?.forEach((clip, clipIndex) => {
        if (clip.type === 'image' && clip.src) {
          console.log(`Track ${trackIndex}, Clip ${clipIndex} (${clip.type}): src = "${clip.src}"`);
        }
        if (clip.type === 'text' && clip.text) {
          console.log(`Track ${trackIndex}, Clip ${clipIndex} (${clip.type}): text = "${clip.text}"`);
        }
      });
    });

    console.log('\n✅ Debug completed successfully!');

  } catch (error) {
    console.error('\n❌ Debug failed:', error);
  }
}

// Run the debug
if (require.main === module) {
  debugTemplateProcessing()
    .then(() => {
      console.log('\n🏁 Debug session finished');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n💥 Debug crashed:', error);
      process.exit(1);
    });
}

module.exports = debugTemplateProcessing; 