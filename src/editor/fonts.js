// TikTok's named font set — each entry is a single baked style (the font IS the
// look), so there is no separate weight control. Loaded via Google Fonts
// (@import in src/index.css). ensureFontsLoaded() is awaited before any canvas
// export, or text renders as a fallback/blank on the canvas.

// Classic (TikTok Sans, weight 500) is the single font for everything.
export const FONTS = [
  { id: 'classic', label: 'Classic', family: 'TikTok Sans', weight: 500, stack: '"TikTok Sans","Montserrat","Helvetica Neue",Arial,sans-serif' },
];

export const DEFAULT_FONT_ID = 'classic';

export function getFont(id) {
  return FONTS.find((f) => f.id === id) || FONTS[0];
}

// Load every named font (plus the Montserrat fallback) so both measurement and
// rasterisation are accurate before we draw onto a canvas. Safe without FontFace.
export async function ensureFontsLoaded() {
  if (typeof document === 'undefined' || !document.fonts) return;
  const specs = FONTS.map((f) => `${f.weight} 64px "${f.family}"`);
  specs.push('500 64px "Montserrat"');
  try {
    await Promise.all(specs.map((s) => document.fonts.load(s).catch(() => {})));
  } catch { /* ignore */ }
  try { await document.fonts.ready; } catch { /* ignore */ }
}
