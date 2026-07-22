// TextLayer model + the fixed internal constants and colour logic shared by the
// DOM preview (Canvas.jsx) and the headless exporter (renderSlide.js).
//
// TikTok's real text tool exposes only Font, Colour, Style, Alignment. Size and
// rotation are driven by on-canvas handles. Everything else (line-height,
// padding, radius, stroke width) is a fixed constant here, not a user control.

import { DEFAULT_FONT_ID } from './fonts.js';

let _seq = 0;
export function uid(prefix = 'id') {
  _seq += 1;
  return `${prefix}-${Date.now().toString(36)}-${_seq}`;
}

// Fixed look constants. Padding & corner radius are RATIOS of fontSize so the
// overlay box scales with the text — TikTok's "Resize to Fit" behaviour — rather
// than a fixed px that reads as over-rounded at normal sizes. Tune these two to
// dial the overlay look. (TikTok Effect House doesn't publish an exact px; the
// documented model is a background block whose radius scales with the text.)
export const LINE_HEIGHT = 1.2;     // unitless
export const PAD_X_RATIO = 0.32;    // horizontal padding  = fontSize * this
export const RADIUS_RATIO = 0.22;   // overlay corner radius = fontSize * this
export const OUTLINE_RATIO = 0.09;  // stroke width          = fontSize * this

// Vertical safe zone: TikTok's own chrome (search bar / top nav; caption,
// like/comment rail, sound ticker at the bottom) sits over the top and bottom
// of the frame. Text is kept inside the middle band so it never sits under it.
export const SAFE_ZONE_TOP = 20;    // % of format height reserved empty at top
export const SAFE_ZONE_BOTTOM = 20; // % of format height reserved empty at bottom

// Clamp a layer's yPct (box top) so the box stays fully inside the vertical
// safe zone. boxHPct is the layer's rendered height as % of format height —
// callers get it from layoutLayer(layer, format).totalH / format.h * 100.
// If the box is taller than the zone itself, pin to the top of the zone
// rather than centering it: predictable "grows downward" behaviour that
// matches the resize handle.
export function clampYToSafeZone(yPct, boxHPct) {
  const minY = SAFE_ZONE_TOP;
  const maxY = 100 - SAFE_ZONE_BOTTOM - boxHPct;
  if (maxY < minY) return minY;
  return Math.min(Math.max(yPct, minY), maxY);
}

// The three TikTok styles.
export const STYLES = [
  { id: 'normal', label: 'Normal' },
  { id: 'outline', label: 'Outline' },
  { id: 'overlay', label: 'Overlay' },
];

// Swatch row for the colour picker (custom colour handled separately).
export const PALETTE = [
  '#ffffff', '#000000', '#FE2C55', '#FF8A00', '#FFD400',
  '#22C55E', '#14B8A6', '#3B82F6', '#8B5CF6', '#EC4899',
];

// Placeholder for a fresh layer — Inspector auto-selects it so the first
// keystroke replaces it (and it's the "pristine" marker for focus logic).
export const DEFAULT_LAYER_TEXT = 'Tap to edit';

export function createTextLayer(overrides = {}) {
  return {
    id: uid('layer'),
    text: DEFAULT_LAYER_TEXT,
    xPct: 10,          // box top-left, % of format
    yPct: SAFE_ZONE_TOP, // top of the vertical safe zone by default
    widthPct: 80,      // wrap width, % of format (not user-exposed)
    fontId: DEFAULT_FONT_ID,
    fontSize: 96,      // native px, driven by the resize handle
    color: '#ffffff',
    align: 'center',
    style: 'normal',   // 'normal' | 'outline' | 'overlay'
    rotation: 0,       // degrees, driven by the rotate handle
    ...overrides,
  };
}

// Luminance-based auto contrast. Returns black on light colours, white on dark.
// Drives the outline stroke colour and the overlay text colour.
export function autoContrast(hex) {
  const c = parseHex(hex);
  if (!c) return '#000000';
  const lum = (0.299 * c.r + 0.587 * c.g + 0.114 * c.b) / 255;
  return lum > 0.6 ? '#000000' : '#ffffff';
}

function parseHex(hex) {
  if (typeof hex !== 'string') return null;
  let h = hex.trim().replace('#', '');
  if (h.length === 3) h = h.split('').map((x) => x + x).join('');
  if (h.length !== 6) return null;
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}
