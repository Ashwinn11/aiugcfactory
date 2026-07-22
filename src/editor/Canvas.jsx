import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { motion as Motion, useMotionValue, useDragControls } from 'framer-motion';
import { X, RotateCw, Maximize2, Film } from 'lucide-react';
import { autoContrast, OUTLINE_RATIO, clampYToSafeZone, SAFE_ZONE_TOP, SAFE_ZONE_BOTTOM } from './textLayers.js';
import { ensureFontsLoaded } from './fonts.js';
import { layoutLayer, buildBackgroundPath } from './layout.js';

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const round1 = (v) => Math.round(v * 10) / 10;

function useSize(ref) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const cr = entries[0].contentRect;
      setSize({ w: cr.width, h: cr.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return size;
}

// per-line CSS for the DOM preview (mirrors renderSlide.js line drawing).
// `part` splits the outline style into a stroke underlay + clean fill overlay:
// CSS -webkit-text-stroke centres the stroke on the glyph edge and paint-order
// support varies by engine, so a single element would eat strokeW/2 into every
// glyph on some browsers while the canvas export strokes *under* the fill.
function lineStyle(layer, layout, i, scale, part = 'fill') {
  const { fontSize, lineHeightPx, font } = layout;
  const base = {
    position: 'absolute',
    left: 0,
    top: `${i * lineHeightPx * scale}px`,
    width: '100%',
    height: `${lineHeightPx * scale}px`,
    lineHeight: `${lineHeightPx * scale}px`,
    fontFamily: font.stack,
    fontWeight: font.weight,
    fontSize: `${fontSize * scale}px`,
    textAlign: layer.align,
    whiteSpace: 'pre',
    overflow: 'visible',
    userSelect: 'none',
    WebkitUserSelect: 'none',
    pointerEvents: 'none',
  };
  if (layer.style === 'overlay') {
    base.color = autoContrast(layer.color);
  } else if (layer.style === 'outline') {
    if (part === 'stroke') {
      base.color = 'transparent';
      base.WebkitTextFillColor = 'transparent';
      base.WebkitTextStrokeWidth = `${fontSize * OUTLINE_RATIO * scale}px`;
      base.WebkitTextStrokeColor = autoContrast(layer.color);
    } else {
      base.color = layer.color;
    }
  } else {
    base.color = layer.color;
  }
  return base;
}

// style for the inline-edit textarea: same geometry as the rendered lines so
// what you type sits exactly where the committed text will render.
function editorStyle(layer, layout, scale, w, h) {
  const { fontSize, lineHeightPx, font } = layout;
  const s = {
    position: 'absolute',
    left: 0,
    top: 0,
    width: `${w}px`,
    height: `${h}px`,
    fontFamily: font.stack,
    fontWeight: font.weight,
    fontSize: `${fontSize * scale}px`,
    lineHeight: `${lineHeightPx * scale}px`,
    textAlign: layer.align,
    background: 'none',
    border: 'none',
    outline: 'none',
    resize: 'none',
    overflow: 'hidden',
    padding: 0,
    margin: 0,
    whiteSpace: 'pre-wrap',
    caretColor: '#fff',
  };
  if (layer.style === 'overlay') {
    s.color = autoContrast(layer.color);
    s.caretColor = s.color;
  } else if (layer.style === 'outline') {
    s.color = layer.color;
    s.WebkitTextStrokeWidth = `${fontSize * OUTLINE_RATIO * scale}px`;
    s.WebkitTextStrokeColor = autoContrast(layer.color);
  } else {
    s.color = layer.color;
  }
  return s;
}

function DraggableLayer({ layer, format, scale, displayW, displayH, selected, onSelect, onChange, onDelete }) {
  const outerRef = useRef(null);
  const editRef = useRef(null);
  const dragControls = useDragControls();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const [editing, setEditing] = useState(false);

  const layout = layoutLayer(layer, format);
  const { boxW, totalH, radius, lines } = layout;
  const bgPath = layer.style === 'overlay' ? buildBackgroundPath(lines.map((l) => l.rect), radius) : '';

  const w = boxW * scale;
  const h = totalH * scale;

  useEffect(() => {
    if (editing && editRef.current) {
      editRef.current.focus({ preventScroll: true });
      editRef.current.select();
    }
  }, [editing]);

  // shared pointer-drag runner for the resize/rotate handles: captures the
  // pointer (terminal events arrive even if released outside the window),
  // bails on pointercancel and on mouse drags whose button was released
  // off-window — otherwise the layer stays glued to the next hover.
  const startHandleDrag = (e, onMove) => {
    e.stopPropagation();
    e.preventDefault();
    const pid = e.pointerId;
    try { e.currentTarget.setPointerCapture?.(pid); } catch { /* ignore */ }
    const move = (ev) => {
      if (ev.pointerId !== pid) return;
      if (ev.pointerType === 'mouse' && ev.buttons === 0) { up(); return; }
      onMove(ev);
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  };

  // ---- resize handle: scales fontSize by pointer distance from box centre ----
  const startResize = (e) => {
    const rect = outerRef.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const startDist = Math.hypot(e.clientX - cx, e.clientY - cy) || 1;
    const startSize = layer.fontSize;
    startHandleDrag(e, (ev) => {
      const d = Math.hypot(ev.clientX - cx, ev.clientY - cy);
      const fontSize = clamp(Math.round(startSize * (d / startDist)), 14, 400);
      // growing the box can push its bottom edge past the safe zone — pull the
      // top back up (never down) to keep it fully inside as it grows
      const trialH = layoutLayer({ ...layer, fontSize }, format).totalH;
      const yPct = clampYToSafeZone(layer.yPct, (trialH / format.h) * 100);
      onChange(layer.id, { fontSize, yPct });
    });
  };

  // ---- rotate handle: sets rotation from pointer angle around box centre ----
  const startRotate = (e) => {
    const rect = outerRef.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const startAng = Math.atan2(e.clientY - cy, e.clientX - cx);
    const startRot = layer.rotation;
    startHandleDrag(e, (ev) => {
      const ang = Math.atan2(ev.clientY - cy, ev.clientX - cx);
      let deg = Math.round(startRot + ((ang - startAng) * 180) / Math.PI);
      if (Math.abs(deg) < 4) deg = 0; // gentle snap to upright
      onChange(layer.id, { rotation: deg });
    });
  };

  // the stage clips at overflow:hidden, so flip the rotate handle below the
  // box when text sits near the top of the frame (where hooks go)
  const rotateBelow = (layer.yPct / 100) * displayH < 60;

  return (
    <Motion.div
      ref={outerRef}
      className={`ed-layer ${selected ? 'selected' : ''}`}
      drag={!editing}
      dragListener={false}
      dragControls={dragControls}
      dragMomentum={false}
      dragElastic={0}
      whileDrag={{ cursor: 'grabbing' }}
      style={{
        position: 'absolute',
        left: `${layer.xPct}%`,
        top: `${layer.yPct}%`,
        width: `${w}px`,
        height: `${h}px`,
        x,
        y,
        rotate: layer.rotation,
        cursor: editing ? 'text' : 'grab',
        touchAction: editing ? 'auto' : 'none',
      }}
      onPointerDown={(e) => { onSelect(layer.id); if (!editing) dragControls.start(e); }}
      onDoubleClick={() => setEditing(true)}
      onDragEnd={(_, info) => {
        // x: clamp the box CENTRE on-stage (2% inset) — rotation-invariant, so
        // the layer always keeps a grabbable region and can never be parked
        // fully off-canvas and lost.
        // y: hard-clamp the whole box inside the vertical safe zone — text can
        // never be dragged under TikTok's top/bottom chrome.
        const boxWPct = (boxW / format.w) * 100;
        const boxHPct = (totalH / format.h) * 100;
        const nx = clamp(layer.xPct + (info.offset.x / displayW) * 100, 2 - boxWPct / 2, 98 - boxWPct / 2);
        const ny = clampYToSafeZone(layer.yPct + (info.offset.y / displayH) * 100, boxHPct);
        x.set(0);
        y.set(0);
        onChange(layer.id, { xPct: round1(nx), yPct: round1(ny) });
      }}
    >
      {layer.style === 'overlay' && bgPath && (
        <svg
          className="ed-bg"
          width={w}
          height={h}
          viewBox={`0 0 ${boxW} ${totalH}`}
          preserveAspectRatio="none"
          style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible', pointerEvents: 'none' }}
        >
          <path d={bgPath} fill={layer.color} />
        </svg>
      )}

      {!editing && lines.map((ln, i) => (
        layer.style === 'outline'
          ? (
            <React.Fragment key={i}>
              <div style={lineStyle(layer, layout, i, scale, 'stroke')}>{ln.text}</div>
              <div style={lineStyle(layer, layout, i, scale, 'fill')}>{ln.text || '​'}</div>
            </React.Fragment>
          )
          : <div key={i} style={lineStyle(layer, layout, i, scale)}>{ln.text || '​'}</div>
      ))}

      {editing && (
        <textarea
          ref={editRef}
          style={editorStyle(layer, layout, scale, w, h)}
          value={layer.text}
          onChange={(e) => onChange(layer.id, { text: e.target.value })}
          onPointerDown={(e) => e.stopPropagation()}
          onBlur={() => setEditing(false)}
          onKeyDown={(e) => { if (e.key === 'Escape') e.target.blur(); }}
        />
      )}

      {selected && !editing && (
        <>
          <div
            className="ed-handle ed-handle-rotate"
            title="Rotate"
            style={rotateBelow ? { top: 'auto', bottom: -34 } : undefined}
            onPointerDown={startRotate}
          >
            <RotateCw size={13} />
          </div>
          <div className="ed-handle ed-handle-resize" title="Resize" onPointerDown={startResize}>
            <Maximize2 size={12} />
          </div>
          <button
            type="button"
            className="ed-handle ed-handle-del"
            title="Delete"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); onDelete(layer.id); }}
          >
            <X size={13} />
          </button>
        </>
      )}
    </Motion.div>
  );
}

export default function Canvas({ slide, format, selectedLayerId, onSelectLayer, onChangeLayer, onDeleteLayer, onRelinkMedia }) {
  const areaRef = useRef(null);
  const stageRef = useRef(null);
  const relinkRef = useRef(null);
  const { w: aw, h: ah } = useSize(areaRef);

  // re-layout once web fonts finish loading (measureText needs them).
  // ensureFontsLoaded() force-loads the exact TikTok Sans spec — a bare
  // document.fonts.ready can resolve before the @import even starts fetching,
  // leaving fallback-font metrics baked into the preview forever. The
  // 'loadingdone' listener catches any late-arriving @font-face registrations.
  const [, setFontTick] = useState(0);
  useEffect(() => {
    let alive = true;
    const bump = () => { if (alive) setFontTick((t) => t + 1); };
    ensureFontsLoaded().then(bump);
    document.fonts?.addEventListener?.('loadingdone', bump);
    return () => {
      alive = false;
      document.fonts?.removeEventListener?.('loadingdone', bump);
    };
  }, []);

  const ar = format.w / format.h;
  let sw = aw;
  let sh = aw / ar;
  if (sh > ah) { sh = ah; sw = ah * ar; }
  const scale = sw ? sw / format.w : 0;

  const isUnlinkedVideo = slide?.media?.mediaType === 'video' && !slide.media.src;

  return (
    <div className="ed-canvas-area" ref={areaRef}>
      {sw > 0 && (
        <div
          className="ed-stage"
          ref={stageRef}
          style={{ width: `${sw}px`, height: `${sh}px` }}
          onPointerDown={(e) => {
            if (e.target === stageRef.current || e.target.classList.contains('ed-stage-img')) onSelectLayer(null);
          }}
        >
          {slide?.media?.mediaType === 'video' && slide.media.src
            ? (
              <video
                className="ed-stage-img ed-stage-video"
                src={slide.media.src}
                autoPlay
                loop
                muted
                playsInline
              />
            )
            : slide?.media?.mediaType === 'image' && slide.media.src
              ? <img className="ed-stage-img" src={slide.media.src} alt="" draggable={false} />
              : (
                <div className="ed-stage-empty">
                  {isUnlinkedVideo
                    ? (
                      <div className="ed-relink">
                        <p>Videos aren’t saved between reloads — choose the file again to keep editing this slide.</p>
                        <button className="ed-btn" onClick={() => relinkRef.current?.click()}>
                          <Film size={15} /> Choose video…
                        </button>
                        <input
                          ref={relinkRef}
                          type="file"
                          accept="video/*"
                          hidden
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file && onRelinkMedia) onRelinkMedia(slide.id, file);
                            e.target.value = '';
                          }}
                        />
                      </div>
                    )
                    : 'No media — add an image or video from the left panel'}
                </div>
              )}

          {(slide?.layers || []).map((layer) => (
            <DraggableLayer
              key={layer.id}
              layer={layer}
              format={format}
              scale={scale}
              displayW={sw}
              displayH={sh}
              selected={layer.id === selectedLayerId}
              onSelect={onSelectLayer}
              onChange={onChangeLayer}
              onDelete={onDeleteLayer}
            />
          ))}

          {/* safe-zone guide: text is clamped between these lines, so show where they are */}
          <div className="ed-safe-guide" style={{ top: `${SAFE_ZONE_TOP}%` }} />
          <div className="ed-safe-guide" style={{ top: `${100 - SAFE_ZONE_BOTTOM}%` }} />
        </div>
      )}
    </div>
  );
}
