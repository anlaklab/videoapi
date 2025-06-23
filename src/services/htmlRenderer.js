const puppeteer = require('puppeteer');
const fs = require('fs-extra');
const path = require('path');
const logger = require('../utils/logger');
const { generateTempPath } = require('../utils/fileManager');

class HtmlRenderer {
  constructor() {
    this.browser = null;
    this.page = null;
    this.isInitialized = false;
  }

  async initialize() {
    if (this.isInitialized) return;

    try {
      logger.info('Initializing HTML renderer with Puppeteer');
      
      this.browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu'
        ]
      });

      this.page = await this.browser.newPage();
      this.isInitialized = true;
      
      logger.info('HTML renderer initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize HTML renderer:', error);
      throw error;
    }
  }

  async renderHtml(htmlClip) {
    try {
      await this.initialize();
      
      logger.info('Rendering HTML content');

      // Set viewport size
      await this.page.setViewport({
        width: htmlClip.width || 1920,
        height: htmlClip.height || 1080,
        deviceScaleFactor: 1
      });

      // Build complete HTML document
      const htmlDocument = this.buildHtmlDocument(htmlClip);

      // Set content
      await this.page.setContent(htmlDocument, {
        waitUntil: 'networkidle0',
        timeout: 30000
      });

      // Wait for any animations or dynamic content
      await this.page.waitForTimeout(1000);

      // Take screenshot
      const outputPath = generateTempPath('.png');
      
      const screenshotOptions = {
        path: outputPath,
        type: 'png',
        fullPage: false,
        clip: {
          x: 0,
          y: 0,
          width: htmlClip.width || 1920,
          height: htmlClip.height || 1080
        }
      };

      // Handle transparency
      if (htmlClip.transparent) {
        screenshotOptions.omitBackground = true;
      }

      await this.page.screenshot(screenshotOptions);

      logger.info(`HTML rendered successfully: ${outputPath}`);
      return outputPath;

    } catch (error) {
      logger.error('Error rendering HTML:', error);
      throw new Error(`HTML rendering failed: ${error.message}`);
    }
  }

  buildHtmlDocument(htmlClip) {
    const defaultCSS = `
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }
      
      body {
        width: ${htmlClip.width || 1920}px;
        height: ${htmlClip.height || 1080}px;
        overflow: hidden;
        font-family: Arial, sans-serif;
        ${htmlClip.transparent ? 'background: transparent;' : 'background: white;'}
      }
      
      .container {
        width: 100%;
        height: 100%;
        position: relative;
      }
    `;

    const customCSS = htmlClip.css || '';
    
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>HTML Clip</title>
        <style>
          ${defaultCSS}
          ${customCSS}
        </style>
      </head>
      <body>
        <div class="container">
          ${htmlClip.html}
        </div>
        <script>
          // Disable scrolling
          document.body.style.overflow = 'hidden';
          
          // Wait for fonts and images to load
          window.addEventListener('load', () => {
            console.log('HTML content loaded');
          });
          
          // Handle dynamic content
          if (typeof window.onHtmlReady === 'function') {
            window.onHtmlReady();
          }
        </script>
      </body>
      </html>
    `;
  }

  async renderHtmlWithAnimations(htmlClip, duration) {
    try {
      await this.initialize();
      
      logger.info('Rendering HTML with animations');

      // Set viewport
      await this.page.setViewport({
        width: htmlClip.width || 1920,
        height: htmlClip.height || 1080,
        deviceScaleFactor: 1
      });

      // Build HTML with animation support
      const htmlDocument = this.buildAnimatedHtmlDocument(htmlClip, duration);
      
      await this.page.setContent(htmlDocument, {
        waitUntil: 'networkidle0',
        timeout: 30000
      });

      // Record frames for animation
      const frames = [];
      const fps = 30;
      const totalFrames = Math.ceil(duration * fps);
      const frameInterval = 1000 / fps;

      for (let frame = 0; frame < totalFrames; frame++) {
        const timestamp = (frame / fps) * 1000;
        
        // Update animation time
        await this.page.evaluate((time) => {
          if (window.updateAnimationTime) {
            window.updateAnimationTime(time);
          }
        }, timestamp);

        // Take screenshot
        const frameBuffer = await this.page.screenshot({
          type: 'png',
          omitBackground: htmlClip.transparent,
          clip: {
            x: 0,
            y: 0,
            width: htmlClip.width || 1920,
            height: htmlClip.height || 1080
          }
        });

        frames.push(frameBuffer);
        
        // Small delay between frames
        await this.page.waitForTimeout(frameInterval / 10);
      }

      // Convert frames to video (this would need additional processing)
      // For now, return the first frame
      const outputPath = generateTempPath('.png');
      await fs.writeFile(outputPath, frames[0]);

      logger.info(`Animated HTML rendered: ${frames.length} frames`);
      return outputPath;

    } catch (error) {
      logger.error('Error rendering animated HTML:', error);
      throw error;
    }
  }

  buildAnimatedHtmlDocument(htmlClip, duration) {
    const animationCSS = `
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      
      @keyframes slideIn {
        from { transform: translateX(-100%); }
        to { transform: translateX(0); }
      }
      
      @keyframes zoomIn {
        from { transform: scale(0); }
        to { transform: scale(1); }
      }
      
      .animate-fade-in {
        animation: fadeIn ${duration}s ease-in-out;
      }
      
      .animate-slide-in {
        animation: slideIn ${duration}s ease-in-out;
      }
      
      .animate-zoom-in {
        animation: zoomIn ${duration}s ease-in-out;
      }
    `;

    const defaultCSS = `
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }
      
      body {
        width: ${htmlClip.width || 1920}px;
        height: ${htmlClip.height || 1080}px;
        overflow: hidden;
        font-family: Arial, sans-serif;
        ${htmlClip.transparent ? 'background: transparent;' : 'background: white;'}
      }
      
      .container {
        width: 100%;
        height: 100%;
        position: relative;
      }
      
      ${animationCSS}
    `;

    const customCSS = htmlClip.css || '';
    
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Animated HTML Clip</title>
        <style>
          ${defaultCSS}
          ${customCSS}
        </style>
      </head>
      <body>
        <div class="container">
          ${htmlClip.html}
        </div>
        <script>
          let animationStartTime = Date.now();
          
          window.updateAnimationTime = function(timestamp) {
            // Update CSS custom properties for time-based animations
            document.documentElement.style.setProperty('--animation-time', timestamp + 'ms');
            
            // Trigger any custom animation updates
            if (typeof window.onAnimationUpdate === 'function') {
              window.onAnimationUpdate(timestamp);
            }
          };
          
          // Initialize animations
          document.addEventListener('DOMContentLoaded', () => {
            console.log('Animated HTML content loaded');
          });
        </script>
      </body>
      </html>
    `;
  }

  async renderMultipleHtml(htmlClips) {
    const renderPromises = htmlClips.map(clip => this.renderHtml(clip));
    return await Promise.all(renderPromises);
  }

  async cleanup() {
    try {
      if (this.page) {
        await this.page.close();
        this.page = null;
      }
      
      if (this.browser) {
        await this.browser.close();
        this.browser = null;
      }
      
      this.isInitialized = false;
      logger.info('HTML renderer cleaned up');
    } catch (error) {
      logger.error('Error cleaning up HTML renderer:', error);
    }
  }

  async restart() {
    await this.cleanup();
    await this.initialize();
  }

  getStatus() {
    return {
      initialized: this.isInitialized,
      browserConnected: this.browser && this.browser.isConnected(),
      pageReady: this.page && !this.page.isClosed()
    };
  }
}

// Singleton instance
let htmlRendererInstance = null;

module.exports = {
  HtmlRenderer,
  getInstance: () => {
    if (!htmlRendererInstance) {
      htmlRendererInstance = new HtmlRenderer();
    }
    return htmlRendererInstance;
  }
}; 