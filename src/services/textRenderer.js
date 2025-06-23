const { createCanvas, registerFont } = require('canvas');
const fs = require('fs-extra');
const path = require('path');
const logger = require('../utils/logger');
const { generateTempPath } = require('../utils/fileManager');

class TextRenderer {
  constructor() {
    this.fontCache = new Map();
    this.loadDefaultFonts();
  }

  async loadDefaultFonts() {
    // Load system fonts or custom fonts
    // This would typically load fonts from the fonts directory
    try {
      const fontsDir = path.join(__dirname, '../../fonts');
      if (await fs.pathExists(fontsDir)) {
        const fontFiles = await fs.readdir(fontsDir);
        for (const fontFile of fontFiles) {
          if (fontFile.endsWith('.ttf') || fontFile.endsWith('.otf')) {
            const fontPath = path.join(fontsDir, fontFile);
            const fontName = path.basename(fontFile, path.extname(fontFile));
            try {
              registerFont(fontPath, { family: fontName });
              this.fontCache.set(fontName, fontPath);
              logger.info(`Loaded font: ${fontName}`);
            } catch (error) {
              logger.warn(`Failed to load font ${fontName}:`, error.message);
            }
          }
        }
      }
    } catch (error) {
      logger.warn('Error loading fonts:', error.message);
    }
  }

  async renderText(textClip) {
    try {
      logger.info(`Rendering text: "${textClip.content.substring(0, 50)}..."`);

      // Calculate text dimensions
      const dimensions = this.calculateTextDimensions(textClip);
      
      // Create canvas
      const canvas = createCanvas(dimensions.width, dimensions.height);
      const ctx = canvas.getContext('2d');

      // Set up canvas
      this.setupCanvas(ctx, textClip, dimensions);

      // Draw background if specified
      if (textClip.backgroundColor) {
        ctx.fillStyle = textClip.backgroundColor;
        ctx.fillRect(0, 0, dimensions.width, dimensions.height);
      }

      // Draw shadow if specified
      if (textClip.shadow) {
        this.drawTextShadow(ctx, textClip, dimensions);
      }

      // Draw stroke if specified
      if (textClip.stroke && textClip.stroke.width > 0) {
        this.drawTextStroke(ctx, textClip, dimensions);
      }

      // Draw main text
      this.drawMainText(ctx, textClip, dimensions);

      // Save to file
      const outputPath = generateTempPath('.png');
      const buffer = canvas.toBuffer('image/png');
      await fs.writeFile(outputPath, buffer);

      logger.info(`Text rendered successfully: ${outputPath}`);
      return outputPath;

    } catch (error) {
      logger.error('Error rendering text:', error);
      throw new Error(`Text rendering failed: ${error.message}`);
    }
  }

  calculateTextDimensions(textClip) {
    // Create temporary canvas for measurement
    const tempCanvas = createCanvas(100, 100);
    const tempCtx = tempCanvas.getContext('2d');
    
    // Set font for measurement
    tempCtx.font = this.buildFontString(textClip);
    
    // Handle word wrapping
    const lines = this.wrapText(tempCtx, textClip.content, textClip.maxWidth || 1920);
    
    // Calculate dimensions
    let maxWidth = 0;
    for (const line of lines) {
      const lineWidth = tempCtx.measureText(line).width;
      if (lineWidth > maxWidth) {
        maxWidth = lineWidth;
      }
    }

    const lineHeight = textClip.fontSize * textClip.lineHeight;
    const totalHeight = lines.length * lineHeight;

    // Add padding for effects
    const padding = this.calculatePadding(textClip);

    return {
      width: Math.ceil(maxWidth + padding.horizontal),
      height: Math.ceil(totalHeight + padding.vertical),
      lines,
      lineHeight,
      textWidth: maxWidth,
      textHeight: totalHeight
    };
  }

  wrapText(ctx, text, maxWidth) {
    if (!maxWidth || maxWidth <= 0) {
      return [text];
    }

    const words = text.split(' ');
    const lines = [];
    let currentLine = '';

    for (const word of words) {
      const testLine = currentLine + (currentLine ? ' ' : '') + word;
      const testWidth = ctx.measureText(testLine).width;

      if (testWidth > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }

    if (currentLine) {
      lines.push(currentLine);
    }

    return lines.length > 0 ? lines : [text];
  }

  buildFontString(textClip) {
    const weight = textClip.fontWeight || 'normal';
    const size = textClip.fontSize || 24;
    const family = textClip.font || 'Arial';
    
    return `${weight} ${size}px ${family}`;
  }

  calculatePadding(textClip) {
    let horizontal = 20; // Base padding
    let vertical = 20;

    // Add padding for shadow
    if (textClip.shadow) {
      horizontal += Math.abs(textClip.shadow.offsetX) + textClip.shadow.blur;
      vertical += Math.abs(textClip.shadow.offsetY) + textClip.shadow.blur;
    }

    // Add padding for stroke
    if (textClip.stroke && textClip.stroke.width > 0) {
      horizontal += textClip.stroke.width * 2;
      vertical += textClip.stroke.width * 2;
    }

    return { horizontal, vertical };
  }

  setupCanvas(ctx, textClip, dimensions) {
    // Clear canvas
    ctx.clearRect(0, 0, dimensions.width, dimensions.height);
    
    // Set font
    ctx.font = this.buildFontString(textClip);
    
    // Set text alignment
    ctx.textAlign = this.getCanvasAlignment(textClip.textAlign);
    ctx.textBaseline = 'top';
    
    // Set letter spacing (approximation)
    if (textClip.letterSpacing && textClip.letterSpacing !== 0) {
      // Canvas doesn't support letter-spacing directly
      // This would need custom implementation for precise letter spacing
    }
  }

  getCanvasAlignment(textAlign) {
    switch (textAlign) {
      case 'center': return 'center';
      case 'right': return 'right';
      case 'justify': return 'left'; // Canvas doesn't support justify
      default: return 'left';
    }
  }

  drawTextShadow(ctx, textClip, dimensions) {
    const shadow = textClip.shadow;
    
    ctx.save();
    ctx.fillStyle = shadow.color;
    ctx.shadowColor = shadow.color;
    ctx.shadowOffsetX = shadow.offsetX;
    ctx.shadowOffsetY = shadow.offsetY;
    ctx.shadowBlur = shadow.blur;
    
    this.drawTextLines(ctx, textClip, dimensions, 'fill');
    
    ctx.restore();
  }

  drawTextStroke(ctx, textClip, dimensions) {
    const stroke = textClip.stroke;
    
    ctx.save();
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.width;
    ctx.lineJoin = 'round';
    
    this.drawTextLines(ctx, textClip, dimensions, 'stroke');
    
    ctx.restore();
  }

  drawMainText(ctx, textClip, dimensions) {
    ctx.save();
    ctx.fillStyle = textClip.color || '#FFFFFF';
    
    this.drawTextLines(ctx, textClip, dimensions, 'fill');
    
    ctx.restore();
  }

  drawTextLines(ctx, textClip, dimensions, method) {
    const padding = this.calculatePadding(textClip);
    const startX = this.getStartX(textClip.textAlign, dimensions, padding);
    const startY = padding.vertical / 2;

    dimensions.lines.forEach((line, index) => {
      const y = startY + (index * dimensions.lineHeight);
      
      if (method === 'fill') {
        ctx.fillText(line, startX, y);
      } else if (method === 'stroke') {
        ctx.strokeText(line, startX, y);
      }
    });
  }

  getStartX(textAlign, dimensions, padding) {
    switch (textAlign) {
      case 'center':
        return dimensions.width / 2;
      case 'right':
        return dimensions.width - (padding.horizontal / 2);
      default:
        return padding.horizontal / 2;
    }
  }

  async loadCustomFont(fontUrl, fontName) {
    try {
      if (this.fontCache.has(fontName)) {
        return this.fontCache.get(fontName);
      }

      // Download font file
      const AssetManager = require('./assetManager');
      const assetManager = new AssetManager();
      const fontPath = await assetManager.downloadAsset(fontUrl);

      // Register font
      registerFont(fontPath, { family: fontName });
      this.fontCache.set(fontName, fontPath);

      logger.info(`Custom font loaded: ${fontName}`);
      return fontPath;

    } catch (error) {
      logger.error(`Failed to load custom font ${fontName}:`, error);
      throw error;
    }
  }

  getAvailableFonts() {
    return Array.from(this.fontCache.keys());
  }
}

module.exports = TextRenderer; 