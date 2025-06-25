/**
 * Adaptador Shotstack Studio → JSON2VIDEO API
 * 
 * Convierte los timelines generados por Shotstack Studio al formato
 * esperado por nuestra API JSON2VIDEO para renderizado con FFmpeg.
 */

class ShotstackAdapter {
  /**
   * Convierte un timeline de Shotstack al formato JSON2VIDEO
   */
  static toJSON2VideoFormat(shotstackData) {
    console.log('🔄 Convirtiendo timeline Shotstack → JSON2VIDEO');
    console.log('📊 Input:', JSON.stringify(shotstackData, null, 2));

    const timeline = {
      duration: this.calculateDuration(shotstackData),
      fps: 30,
      resolution: { 
        width: shotstackData.timeline?.resolution?.width || 1920, 
        height: shotstackData.timeline?.resolution?.height || 1080 
      },
      background: { 
        color: shotstackData.timeline?.background?.color || "#000000" 
      },
      tracks: this.convertTracks(shotstackData.timeline?.tracks || [])
    };

    const result = {
      timeline,
      mergeFields: shotstackData.mergeFields || {}
    };

    console.log('✅ Output:', JSON.stringify(result, null, 2));
    return result;
  }

  /**
   * Convierte las pistas de Shotstack
   */
  static convertTracks(shotstackTracks) {
    return shotstackTracks.map((track, index) => ({
      id: track.id || `track-${index}`,
      type: track.type || 'main',
      clips: this.convertClips(track.clips || [])
    }));
  }

  /**
   * Convierte los clips de Shotstack
   */
  static convertClips(shotstackClips) {
    return shotstackClips.map((clip, index) => {
      const baseClip = {
        id: clip.id || `clip-${index}-${Date.now()}`,
        start: clip.start || 0,
        duration: clip.length || clip.duration || 5,
        type: this.mapClipType(clip.asset?.type || clip.type)
      };

      return this.enhanceClipByType(baseClip, clip);
    });
  }

  /**
   * Mapea tipos de clip de Shotstack a nuestro formato
   */
  static mapClipType(shotstackType) {
    const typeMapping = {
      'text': 'text',
      'title': 'text',
      'image': 'image',
      'video': 'video',
      'audio': 'audio',
      'shape': 'shape',
      'html': 'text',
      'luma': 'video'
    };

    return typeMapping[shotstackType] || 'text';
  }

  /**
   * Mejora el clip según su tipo específico
   */
  static enhanceClipByType(baseClip, shotstackClip) {
    const asset = shotstackClip.asset || {};

    switch (baseClip.type) {
      case 'text':
        return {
          ...baseClip,
          text: asset.text || asset.html || 'Texto por defecto',
          style: this.convertTextStyle(asset.style || {}),
          position: this.convertPosition(shotstackClip.position)
        };

      case 'image':
        return {
          ...baseClip,
          source: this.extractAssetSource(asset.src),
          position: this.convertPosition(shotstackClip.position),
          scale: shotstackClip.scale || 1.0,
          opacity: this.convertOpacity(shotstackClip.opacity)
        };

      case 'video':
        return {
          ...baseClip,
          source: this.extractAssetSource(asset.src),
          position: this.convertPosition(shotstackClip.position),
          scale: shotstackClip.scale || 1.0,
          opacity: this.convertOpacity(shotstackClip.opacity)
        };

      case 'shape':
        return {
          ...baseClip,
          shape: this.convertShape(asset),
          position: this.convertPosition(shotstackClip.position),
          opacity: this.convertOpacity(shotstackClip.opacity)
        };

      default:
        return baseClip;
    }
  }

  /**
   * Convierte estilos de texto de Shotstack
   */
  static convertTextStyle(shotstackStyle) {
    return {
      fontSize: shotstackStyle.fontSize || shotstackStyle.size || 48,
      fontFamily: this.mapFontFamily(shotstackStyle.fontFamily || shotstackStyle.font),
      color: shotstackStyle.color || shotstackStyle.fill || '#ffffff',
      fontWeight: shotstackStyle.fontWeight || shotstackStyle.weight || 'normal',
      textAlign: shotstackStyle.textAlign || shotstackStyle.align || 'center'
    };
  }

  /**
   * Mapea familias de fuentes
   */
  static mapFontFamily(shotstackFont) {
    const fontMapping = {
      'arial': 'Arial',
      'arial-black': 'Arial Black',
      'helvetica': 'Helvetica',
      'times': 'Times New Roman',
      'courier': 'Courier',
      'impact': 'Impact',
      'comic-sans': 'Comic Sans MS',
      'papyrus': 'Papyrus'
    };

    if (!shotstackFont) return 'Arial';
    
    const normalizedFont = shotstackFont.toLowerCase().replace(/\s+/g, '-');
    return fontMapping[normalizedFont] || shotstackFont || 'Arial';
  }

  /**
   * Convierte posicionamiento
   */
  static convertPosition(shotstackPosition) {
    if (!shotstackPosition) {
      return { x: 960, y: 540 }; // Centro por defecto para 1920x1080
    }

    // Si es un string como "center", "top-left", etc.
    if (typeof shotstackPosition === 'string') {
      return this.mapNamedPosition(shotstackPosition);
    }

    // Si es un objeto con coordenadas
    return {
      x: shotstackPosition.x || 960,
      y: shotstackPosition.y || 540
    };
  }

  /**
   * Mapea posiciones nombradas
   */
  static mapNamedPosition(positionName) {
    const positions = {
      'center': { x: 960, y: 540 },
      'top': { x: 960, y: 200 },
      'bottom': { x: 960, y: 880 },
      'left': { x: 200, y: 540 },
      'right': { x: 1720, y: 540 },
      'top-left': { x: 200, y: 200 },
      'top-right': { x: 1720, y: 200 },
      'bottom-left': { x: 200, y: 880 },
      'bottom-right': { x: 1720, y: 880 }
    };

    return positions[positionName] || positions['center'];
  }

  /**
   * Convierte opacidad
   */
  static convertOpacity(shotstackOpacity) {
    if (shotstackOpacity === undefined || shotstackOpacity === null) {
      return 100;
    }
    
    // Si está en rango 0-1, convertir a 0-100
    if (shotstackOpacity <= 1) {
      return Math.round(shotstackOpacity * 100);
    }
    
    // Si ya está en 0-100
    return Math.round(shotstackOpacity);
  }

  /**
   * Convierte formas geométricas
   */
  static convertShape(shotstackAsset) {
    return {
      type: shotstackAsset.type || 'rectangle',
      width: shotstackAsset.width || 200,
      height: shotstackAsset.height || 100,
      fillColor: shotstackAsset.color || shotstackAsset.fill || '#ff0000',
      strokeColor: shotstackAsset.stroke || '#000000',
      strokeWidth: shotstackAsset.strokeWidth || 2
    };
  }

  /**
   * Extrae nombre del archivo de assets
   */
  static extractAssetSource(shotstackSrc) {
    if (!shotstackSrc) return null;
    
    // Si es una URL, extraer solo el nombre del archivo
    if (shotstackSrc.includes('://')) {
      const urlParts = shotstackSrc.split('/');
      return urlParts[urlParts.length - 1];
    }
    
    // Si ya es un nombre de archivo, devolverlo
    return shotstackSrc;
  }

  /**
   * Calcula la duración total del timeline
   */
  static calculateDuration(shotstackData) {
    if (shotstackData.timeline?.duration) {
      return shotstackData.timeline.duration;
    }

    let maxDuration = 0;
    const tracks = shotstackData.timeline?.tracks || [];
    
    tracks.forEach(track => {
      const clips = track.clips || [];
      clips.forEach(clip => {
        const clipEnd = (clip.start || 0) + (clip.length || clip.duration || 5);
        if (clipEnd > maxDuration) {
          maxDuration = clipEnd;
        }
      });
    });

    return maxDuration || 10; // Duración mínima de 10 segundos
  }

  /**
   * Convierte desde nuestro formato a Shotstack (para preview)
   */
  static fromJSON2VideoFormat(json2VideoData) {
    console.log('🔄 Convirtiendo JSON2VIDEO → Shotstack preview');
    
    return {
      timeline: {
        duration: json2VideoData.timeline.duration,
        resolution: json2VideoData.timeline.resolution,
        background: json2VideoData.timeline.background,
        tracks: json2VideoData.timeline.tracks.map(track => ({
          id: track.id,
          clips: track.clips.map(clip => this.reverseConvertClip(clip))
        }))
      },
      mergeFields: json2VideoData.mergeFields
    };
  }

  /**
   * Convierte clip desde nuestro formato a Shotstack
   */
  static reverseConvertClip(json2VideoClip) {
    const baseClip = {
      id: json2VideoClip.id,
      start: json2VideoClip.start,
      length: json2VideoClip.duration,
      asset: {
        type: json2VideoClip.type
      }
    };

    switch (json2VideoClip.type) {
      case 'text':
        baseClip.asset.text = json2VideoClip.text;
        baseClip.asset.style = json2VideoClip.style;
        baseClip.position = json2VideoClip.position;
        break;
        
      case 'image':
      case 'video':
        baseClip.asset.src = json2VideoClip.source;
        baseClip.position = json2VideoClip.position;
        baseClip.scale = json2VideoClip.scale;
        baseClip.opacity = json2VideoClip.opacity;
        break;
    }

    return baseClip;
  }
}

export default ShotstackAdapter; 