// Headless canvas compositor. Pure function: slide + format -> PNG Blob at
// native resolution, no DOM mount required (single export + batch ZIP).
// Uses the SAME layout + background path as the DOM preview (see layout.js),
// so preview and export are pixel-faithful.

import { ensureFontsLoaded } from './fonts.js';
import { autoContrast, OUTLINE_RATIO } from './textLayers.js';
import { layoutLayer, buildBackgroundPath } from './layout.js';

function loadImage(src) {
  return new Promise((resolve) => {
    if (!src) { resolve(null); return; }
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    try { img.crossOrigin = 'anonymous'; } catch { /* ignore */ }
    img.src = src;
  });
}

// cover-fit: scale a source (image OR video element) to fill, center-cropping
// the overflow. Exported so the video exporter can reuse the exact math.
export function drawCover(ctx, source, W, H) {
  const sw = source.videoWidth || source.naturalWidth || source.width;
  const sh = source.videoHeight || source.naturalHeight || source.height;
  if (!sw || !sh) return;
  const ir = sw / sh;
  const cr = W / H;
  let dw, dh, dx, dy;
  if (ir > cr) { dh = H; dw = H * ir; dx = (W - dw) / 2; dy = 0; }
  else { dw = W; dh = W / ir; dx = 0; dy = (H - dh) / 2; }
  ctx.drawImage(source, dx, dy, dw, dh);
}

function drawLayer(ctx, layer, W, H) {
  const L = layoutLayer(layer, { w: W, h: H });
  const { font, fontSize, lineHeightPx, boxW, totalH, radius, baselineY, lines } = L;

  const boxLeftX = (layer.xPct / 100) * W;
  const boxTopY = (layer.yPct / 100) * H;

  ctx.save();
  // rotate around the box centre, then work in box-local coords (0..boxW, 0..totalH)
  ctx.translate(boxLeftX + boxW / 2, boxTopY + totalH / 2);
  if (layer.rotation) ctx.rotate((layer.rotation * Math.PI) / 180);
  ctx.translate(-boxW / 2, -totalH / 2);

  // overlay background: one continuous shape via the shared path
  if (layer.style === 'overlay') {
    const d = buildBackgroundPath(lines.map((l) => l.rect), radius);
    if (d) {
      ctx.fillStyle = layer.color;
      ctx.fill(new Path2D(d));
    }
  }

  ctx.font = `${font.weight} ${fontSize}px ${font.stack}`;
  // Reproduce CSS half-leading centring when font metrics are available so the
  // exported pixels sit exactly where the DOM preview shows them.
  ctx.textBaseline = baselineY != null ? 'alphabetic' : 'middle';
  ctx.textAlign = layer.align;

  const textFill = layer.style === 'overlay' ? autoContrast(layer.color) : layer.color;
  const strokeColor = autoContrast(layer.color);
  const strokeW = fontSize * OUTLINE_RATIO;

  lines.forEach((ln, i) => {
    if (!ln.text) return;
    const yc = i * lineHeightPx + (baselineY != null ? baselineY : lineHeightPx / 2);
    let x = boxW / 2;
    if (layer.align === 'left') x = 0;
    else if (layer.align === 'right') x = boxW;

    if (layer.style === 'outline') {
      ctx.lineJoin = 'round';
      ctx.miterLimit = 2;
      ctx.lineWidth = strokeW;
      ctx.strokeStyle = strokeColor;
      ctx.strokeText(ln.text, x, yc); // paint-order: stroke first...
    }

    ctx.fillStyle = textFill;
    ctx.fillText(ln.text, x, yc);      // ...fill over the inner half
  });

  ctx.restore(); // clears shadow etc. for the next layer
}

// Draw every text overlay onto ctx at native (format) resolution. Shared by the
// image exporter (renderSlide) and the video exporter (exportVideo) so a burned-in
// video frame matches a PNG pixel-for-pixel.
export function drawOverlays(ctx, layers, format) {
  for (const layer of layers || []) {
    drawLayer(ctx, layer, format.w, format.h);
  }
}

export async function renderSlide(slide, format) {
  await ensureFontsLoaded();

  const canvas = document.createElement('canvas');
  canvas.width = format.w;
  canvas.height = format.h;
  const ctx = canvas.getContext('2d');

  const grad = ctx.createLinearGradient(0, 0, format.w, format.h);
  grad.addColorStop(0, '#141414');
  grad.addColorStop(1, '#050505');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, format.w, format.h);

  const src = slide.media?.mediaType === 'image' ? slide.media.src : null;
  const img = await loadImage(src);
  if (img) drawCover(ctx, img, format.w, format.h);

  drawOverlays(ctx, slide.layers, format);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('canvas.toBlob returned null'));
    }, 'image/png');
  });
}
