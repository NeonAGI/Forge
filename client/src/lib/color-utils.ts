/**
 * Utility functions for extracting and manipulating colors from images
 */

export interface HSLColor {
  h: number; // 0-360
  s: number; // 0-100
  l: number; // 0-100
}

export interface RGBColor {
  r: number; // 0-255
  g: number; // 0-255
  b: number; // 0-255
}

/**
 * Convert RGB to HSL
 */
export function rgbToHsl(r: number, g: number, b: number): HSLColor {
  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max === min) {
    h = s = 0; // achromatic
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }

    h /= 6;
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100)
  };
}

/**
 * Convert HSL to RGB
 */
export function hslToRgb(h: number, s: number, l: number): RGBColor {
  h /= 360;
  s /= 100;
  l /= 100;

  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1/6) return p + (q - p) * 6 * t;
    if (t < 1/2) return q;
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
    return p;
  };

  let r: number, g: number, b: number;

  if (s === 0) {
    r = g = b = l; // achromatic
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }

  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255)
  };
}

/**
 * Extract dominant color from an image data URL
 */
export function extractDominantColor(imageDataUrl: string): Promise<HSLColor> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = () => {
      try {
        // Create canvas to analyze the image
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }

        // Scale down the image for faster processing
        const scale = Math.min(1, 50 / Math.max(img.width, img.height));
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        // Get image data
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        
        // Count color frequencies
        const colorCounts: { [key: string]: number } = {};
        
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const a = data[i + 3];
          
          // Skip transparent pixels
          if (a < 128) continue;
          
          // Round colors to reduce noise
          const roundedR = Math.round(r / 16) * 16;
          const roundedG = Math.round(g / 16) * 16;
          const roundedB = Math.round(b / 16) * 16;
          
          const colorKey = `${roundedR},${roundedG},${roundedB}`;
          colorCounts[colorKey] = (colorCounts[colorKey] || 0) + 1;
        }
        
        // Find the most frequent color
        let maxCount = 0;
        let dominantColor = { r: 128, g: 128, b: 128 };
        
        for (const [colorKey, count] of Object.entries(colorCounts)) {
          if (count > maxCount) {
            maxCount = count;
            const [r, g, b] = colorKey.split(',').map(Number);
            dominantColor = { r, g, b };
          }
        }
        
        // Convert to HSL and adjust for better orb colors
        const hsl = rgbToHsl(dominantColor.r, dominantColor.g, dominantColor.b);
        
        // Boost saturation and adjust lightness for better visual impact
        hsl.s = Math.max(40, Math.min(80, hsl.s + 20));
        hsl.l = Math.max(30, Math.min(70, hsl.l));
        
        resolve(hsl);
      } catch (error) {
        reject(error);
      }
    };
    
    img.onerror = () => {
      reject(new Error('Failed to load image'));
    };
    
    img.src = imageDataUrl;
  });
}

/**
 * Generate complementary colors based on a base HSL color
 */
export function generateComplementaryColors(baseHsl: HSLColor) {
  return {
    primary: baseHsl,
    secondary: {
      h: (baseHsl.h + 30) % 360,
      s: Math.max(30, baseHsl.s - 10),
      l: Math.min(80, baseHsl.l + 20)
    },
    accent: {
      h: (baseHsl.h + 180) % 360,
      s: Math.min(90, baseHsl.s + 20),
      l: Math.max(40, baseHsl.l - 10)
    }
  };
}

/**
 * Convert HSL to CSS hsl() string
 */
export function hslToCss(hsl: HSLColor): string {
  return `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`;
}

/**
 * Create CSS color palette from HSL color
 */
export function createColorPalette(baseHsl: HSLColor) {
  const colors = generateComplementaryColors(baseHsl);
  
  return {
    primary: hslToCss(colors.primary),
    secondary: hslToCss(colors.secondary),
    accent: hslToCss(colors.accent),
    primaryRgba: (alpha: number) => {
      const rgb = hslToRgb(colors.primary.h, colors.primary.s, colors.primary.l);
      return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
    },
    secondaryRgba: (alpha: number) => {
      const rgb = hslToRgb(colors.secondary.h, colors.secondary.s, colors.secondary.l);
      return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
    },
    accentRgba: (alpha: number) => {
      const rgb = hslToRgb(colors.accent.h, colors.accent.s, colors.accent.l);
      return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
    }
  };
}