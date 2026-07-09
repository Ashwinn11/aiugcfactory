// Export format registry — pure data so the editor stays app-agnostic.
// w/h are the NATIVE export resolution. Positions/sizes in a slide are stored
// relative to this space (percent + native px), guaranteeing preview↔export parity.

export const FORMATS = [
  { id: 'tiktok',     name: 'TikTok / Reels', w: 1080, h: 1920 },
  { id: 'story',      name: 'Story',          w: 1080, h: 1920 },
  { id: 'igPortrait', name: 'IG Portrait',    w: 1080, h: 1350 },
  { id: 'square',     name: 'Square',         w: 1080, h: 1080 },
];

export const DEFAULT_FORMAT_ID = 'tiktok';

export function getFormat(id) {
  return FORMATS.find((f) => f.id === id) || FORMATS[0];
}
