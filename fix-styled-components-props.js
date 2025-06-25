#!/usr/bin/env node

/**
 * Fix Styled Components Props - Automated Script
 * 
 * This script systematically fixes styled-components prop warnings
 * by converting custom props to transient props ($ prefix)
 */

const fs = require('fs');
const path = require('path');

// Define the props that need to be converted to transient props
const propsToFix = [
  'active',
  'primary',
  'secondary', 
  'danger',
  'success',
  'warning',
  'shimmer',
  'collapsed',
  'expanded',
  'loading',
  'disabled',
  'selected',
  'highlighted',
  'focused',
  'hovered',
  'pressed',
  'show',
  'hide',
  'visible',
  'hidden',
  'major',
  'minor',
  'position',
  'isOpen',
  'isClosed',
  'isActive',
  'isDisabled',
  'isSelected',
  'isLoading',
  'variant',
  'size',
  'color',
  'theme',
  'minimized',
  'animated',
  'progress',
  'status',
  'type'
];

// Files to process
const filesToProcess = [
  'frontend/src/components/CloudVideoEditor.js',
  'frontend/src/components/UploadProgress/UploadProgressManager.js',
  'frontend/src/components/Timeline/AdvancedTimelineControls.js',
  'frontend/src/components/AssetManagement/AssetCategory.js',
  'frontend/src/components/Inspector/Inspector.js',
  'frontend/src/components/MergeFields/MergeFieldsManager.js',
  'frontend/src/components/Animations/AnimationManager.js',
  'frontend/src/components/Sidebar/Sidebar.js',
  'frontend/src/components/Transitions/TransitionManager.js',
  'frontend/src/components/Timeline/Timeline.js',
  'frontend/src/components/Timeline/TimelineEditor.js'
];

function fixStyledComponentsProps() {
  console.log('🔧 Starting styled-components props fix...\n');

  let totalFiles = 0;
  let totalFixes = 0;

  filesToProcess.forEach(filePath => {
    if (!fs.existsSync(filePath)) {
      console.log(`⚠️  File not found: ${filePath}`);
      return;
    }

    console.log(`📝 Processing: ${filePath}`);
    
    let content = fs.readFileSync(filePath, 'utf8');
    let fileFixed = false;
    let fileFixes = 0;

    // Fix styled component definitions (in template literals)
    propsToFix.forEach(prop => {
      // Fix props in styled component definitions
      const styledRegex = new RegExp(`\\$\\{\\s*props\\s*=>\\s*props\\.${prop}`, 'g');
      const styledReplacements = content.match(styledRegex);
      if (styledReplacements) {
        content = content.replace(styledRegex, `\${props => props.$${prop}`);
        fileFixes += styledReplacements.length;
        fileFixed = true;
      }

      // Fix destructured props in styled components
      const destructuredRegex = new RegExp(`\\$\\{\\s*\\(\\s*\\{[^}]*${prop}[^}]*\\}\\s*\\)`, 'g');
      const destructuredMatches = content.match(destructuredRegex);
      if (destructuredMatches) {
        destructuredMatches.forEach(match => {
          const fixed = match.replace(new RegExp(`\\b${prop}\\b`, 'g'), `$${prop}`);
          content = content.replace(match, fixed);
          fileFixes++;
          fileFixed = true;
        });
      }

      // Fix component usage (JSX props)
      const jsxRegex = new RegExp(`\\s${prop}=\\{`, 'g');
      const jsxReplacements = content.match(jsxRegex);
      if (jsxReplacements) {
        content = content.replace(jsxRegex, ` $${prop}={`);
        fileFixes += jsxReplacements.length;
        fileFixed = true;
      }

      // Fix boolean props without values
      const booleanRegex = new RegExp(`\\s${prop}\\s`, 'g');
      const booleanMatches = content.match(booleanRegex);
      if (booleanMatches) {
        content = content.replace(booleanRegex, ` $${prop} `);
        fileFixes += booleanMatches.length;
        fileFixed = true;
      }
    });

    if (fileFixed) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`  ✅ Fixed ${fileFixes} prop issues`);
      totalFiles++;
      totalFixes += fileFixes;
    } else {
      console.log(`  ℹ️  No issues found`);
    }
  });

  console.log(`\n📊 Summary:`);
  console.log(`Files processed: ${filesToProcess.length}`);
  console.log(`Files fixed: ${totalFiles}`);
  console.log(`Total fixes applied: ${totalFixes}`);

  if (totalFixes > 0) {
    console.log(`\n🎉 All styled-components prop warnings should now be resolved!`);
    console.log(`\n💡 Next steps:`);
    console.log(`1. Restart your React development server`);
    console.log(`2. Check the browser console for any remaining warnings`);
    console.log(`3. Test the application functionality`);
  } else {
    console.log(`\n✨ No prop issues found - your components are already clean!`);
  }
}

// Run the fix
if (require.main === module) {
  try {
    fixStyledComponentsProps();
  } catch (error) {
    console.error('❌ Error running styled-components fix:', error);
    process.exit(1);
  }
}

module.exports = fixStyledComponentsProps; 