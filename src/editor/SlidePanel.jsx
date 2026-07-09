import React, { useRef } from 'react';
import { ImagePlus, Trash2, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';
import { FORMATS } from '../formats/formats.js';
import { LAYER_PACKS } from './presets.js';

export default function SlidePanel({
  format, onSetFormat,
  slides, currentSlideId, onSelectSlide, onAddMedia, onDeleteSlide, onReorderSlide,
  onApplyPack,
}) {
  const fileRef = useRef(null);

  return (
    <div className="ed-panel">
      <section className="ed-section">
        <h4>Format</h4>
        <div className="ed-format-grid">
          {FORMATS.map((f) => (
            <button
              key={f.id}
              className={`ed-format-btn ${format.id === f.id ? 'active' : ''}`}
              onClick={() => onSetFormat(f.id)}
            >
              <span className="ed-format-name">{f.name}</span>
              <span className="ed-format-dim">{f.w}×{f.h}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="ed-section">
        <div className="ed-section-head">
          <h4>Slides ({slides.length})</h4>
          <button className="ed-mini-btn" onClick={() => fileRef.current?.click()}>
            <ImagePlus size={14} /> Add
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*,video/*"
            multiple
            hidden
            onChange={(e) => {
              onAddMedia(Array.from(e.target.files || []));
              e.target.value = '';
            }}
          />
        </div>

        <div className="ed-filmstrip">
          {slides.length === 0 && (
            <div className="ed-filmstrip-empty">
              <ImagePlus size={26} />
              <p>Add an image or video to start a slide</p>
            </div>
          )}
          {slides.map((s, i) => (
            <div
              key={s.id}
              className={`ed-thumb ${s.id === currentSlideId ? 'active' : ''}`}
              style={{ aspectRatio: `${format.w} / ${format.h}` }}
              onClick={() => onSelectSlide(s.id)}
            >
              {s.media?.mediaType === 'video' && s.media.src
                ? <video src={s.media.src} muted playsInline preload="metadata" />
                : s.media?.mediaType === 'image' && s.media.src
                  ? <img src={s.media.src} alt={`Slide ${i + 1}`} draggable={false} />
                  : <div className="ed-thumb-blank" />}
              <span className="ed-thumb-idx">{i + 1}</span>
              {s.media?.mediaType === 'video' && (
                s.media.src
                  ? <span className="ed-thumb-vid">▶</span>
                  : <span className="ed-thumb-vid ed-thumb-warn" title="Video needs re-adding">⚠</span>
              )}
              <div className="ed-thumb-tools">
                <button
                  title="Move left"
                  disabled={i === 0}
                  onClick={(e) => { e.stopPropagation(); onReorderSlide(s.id, -1); }}
                ><ChevronLeft size={13} /></button>
                <button
                  title="Move right"
                  disabled={i === slides.length - 1}
                  onClick={(e) => { e.stopPropagation(); onReorderSlide(s.id, 1); }}
                ><ChevronRight size={13} /></button>
                <button
                  title="Delete slide"
                  className="ed-thumb-del"
                  onClick={(e) => { e.stopPropagation(); onDeleteSlide(s.id); }}
                ><Trash2 size={13} /></button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="ed-section">
        <h4>Starter packs</h4>
        <div className="ed-pack-list">
          {LAYER_PACKS.map((p) => (
            <button key={p.id} className="ed-pack-btn" onClick={() => onApplyPack(p.id)}>
              <Sparkles size={13} /> {p.name}
            </button>
          ))}
        </div>
        <p className="ed-hint">Packs add ready-made text layers to the current slide.</p>
      </section>
    </div>
  );
}
