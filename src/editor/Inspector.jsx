import React, { useEffect, useRef } from 'react';
import {
  AlignLeft, AlignCenter, AlignRight, Copy, Trash2, ArrowUp, ArrowDown, Type as TypeIcon,
} from 'lucide-react';
import { STYLES, PALETTE, DEFAULT_LAYER_TEXT } from './textLayers.js';

export default function Inspector({ layer, onChange, onDuplicate, onDelete, onReorder }) {
  const textareaRef = useRef(null);
  const layerId = layer?.id;

  // A freshly added layer still says 'Tap to edit' — put the cursor straight
  // into the textarea with the placeholder selected so the first keystroke
  // replaces it. Customized layers never steal focus.
  useEffect(() => {
    const el = textareaRef.current;
    if (el && layer && layer.text === DEFAULT_LAYER_TEXT) {
      el.focus({ preventScroll: true });
      el.select();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layerId]);

  if (!layer) {
    return (
      <div className="ed-inspector ed-empty-inspector">
        <TypeIcon size={30} />
        <p>Select a text layer, or add one with “+ Text”.</p>
      </div>
    );
  }

  const set = (patch) => onChange(layer.id, patch);

  return (
    <div className="ed-inspector">
      <div className="ed-inspector-head">
        <h4>Text</h4>
        <div className="ed-layer-actions">
          <button title="Duplicate" onClick={() => onDuplicate(layer.id)}><Copy size={15} /></button>
          <button title="Bring forward" onClick={() => onReorder(layer.id, 1)}><ArrowUp size={15} /></button>
          <button title="Send back" onClick={() => onReorder(layer.id, -1)}><ArrowDown size={15} /></button>
          <button title="Delete" className="danger" onClick={() => onDelete(layer.id)}><Trash2 size={15} /></button>
        </div>
      </div>

      <textarea
        ref={textareaRef}
        className="ed-textarea"
        rows={3}
        value={layer.text}
        onChange={(e) => set({ text: e.target.value })}
      />

      <div className="ed-field-label">Style</div>
      <div className="ed-seg ed-seg-wide">
        {STYLES.map((s) => (
          <button key={s.id} className={layer.style === s.id ? 'active' : ''} onClick={() => set({ style: s.id })}>
            {s.label}
          </button>
        ))}
      </div>

      <div className="ed-field-label">Colour</div>
      <div className="ed-swatches">
        {PALETTE.map((c) => (
          <button
            key={c}
            className={`ed-swatch ${layer.color.toLowerCase() === c.toLowerCase() ? 'active' : ''}`}
            style={{ background: c }}
            onClick={() => set({ color: c })}
            title={c}
          />
        ))}
        <label className="ed-swatch ed-swatch-custom" title="Custom colour">
          <input type="color" value={layer.color} onChange={(e) => set({ color: e.target.value })} />
        </label>
      </div>

      <div className="ed-field-label">Alignment</div>
      <div className="ed-seg">
        <button className={layer.align === 'left' ? 'active' : ''} onClick={() => set({ align: 'left' })}>
          <AlignLeft size={16} />
        </button>
        <button className={layer.align === 'center' ? 'active' : ''} onClick={() => set({ align: 'center' })}>
          <AlignCenter size={16} />
        </button>
        <button className={layer.align === 'right' ? 'active' : ''} onClick={() => set({ align: 'right' })}>
          <AlignRight size={16} />
        </button>
      </div>

      <p className="ed-hint">Drag to move · double-click to type · corner handle resizes · top handle rotates.</p>
      <p className="ed-readout">Classic · {Math.round(layer.fontSize)}px</p>
    </div>
  );
}
