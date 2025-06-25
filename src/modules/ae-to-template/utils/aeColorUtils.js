/**
 * Utilidades centralizadas para manejo de colores en After Effects
 */

function aeColorToHex(aeColor) {
  if (!aeColor) return "#000000";
  
  if (Array.isArray(aeColor)) {
    const [r, g, b] = aeColor;
    const rInt = Math.round((r || 0) * 255);
    const gInt = Math.round((g || 0) * 255);
    const bInt = Math.round((b || 0) * 255);
    
    return `#${rInt.toString(16).padStart(2, "0")}${gInt.toString(16).padStart(2, "0")}${bInt.toString(16).padStart(2, "0")}`;
  }
  
  return "#000000";
}

function normalizeColor(color) {
  if (!color) return null;

  if (typeof color === "string") {
    return color.startsWith("#") ? color : `#${color}`;
  }

  if (Array.isArray(color)) {
    return aeColorToHex(color);
  }

  return null;
}

function extractColorFromBuffer(buffer, offset) {
  try {
    if (buffer.length > offset + 2) {
      const r = buffer[offset] || 0;
      const g = buffer[offset + 1] || 0;
      const b = buffer[offset + 2] || 0;
      return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
    }
    return "#000000";
  } catch (error) {
    return "#000000";
  }
}

module.exports = {
  aeColorToHex,
  normalizeColor,
  extractColorFromBuffer
};
