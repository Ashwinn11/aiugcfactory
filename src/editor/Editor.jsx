import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Type, Download, Package, Loader2, Film, ImagePlus, FilePlus, Lock, Unlock } from 'lucide-react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

import { getFormat, DEFAULT_FORMAT_ID } from '../formats/formats.js';
import { createTextLayer, uid, DEFAULT_LAYER_TEXT, clampYToSafeZone } from './textLayers.js';
import { layoutLayer } from './layout.js';
import { getPack } from './presets.js';
import { renderSlide } from './renderSlide.js';
import { exportVideo } from './exportVideo.js';
import Canvas from './Canvas.jsx';
import Inspector from './Inspector.jsx';
import SlidePanel from './SlidePanel.jsx';
import './Editor.css';

const STORAGE_KEY = 'ugc-overlay-editor:v2';
const SEED_TEXT = 'Your hook\ngoes here';
const MAX_IMG_SIDE = 1920; // stored images are downscaled to fit localStorage
const UNDO_CAP = 50;

// Object URLs created this session. Deleting a slide must NOT revoke its URL
// (undo needs the blob alive); they're only revoked by "New project". URLs are
// released automatically when the document unloads.
const OBJECT_URLS = new Set();

const round1 = (v) => Math.round(v * 10) / 10;

function fileToDataURL(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}

// slide.media = { mediaType:'image'|'video', src, naturalW, naturalH, duration? } | null
function newSlide(media = null, layers = []) {
  return { id: uid('slide'), media, layers };
}

function loadImageEl(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

// Import an image file: full-res data URLs blow the ~5MB localStorage quota in
// two or three phone photos, so anything larger than the export resolution is
// downscaled before it enters state (preview and export both consume this src,
// so parity is unaffected).
async function importImage(file) {
  const raw = await fileToDataURL(file);
  if (!raw) return null;
  const img = await loadImageEl(raw);
  if (!img) return null;
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  if (!w || !h) return null;
  const long = Math.max(w, h);
  if (long <= MAX_IMG_SIDE) return { src: raw, naturalW: w, naturalH: h };
  const k = MAX_IMG_SIDE / long;
  const cw = Math.round(w * k);
  const ch = Math.round(h * k);
  const c = document.createElement('canvas');
  c.width = cw;
  c.height = ch;
  c.getContext('2d').drawImage(img, 0, 0, cw, ch);
  const type = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
  return { src: c.toDataURL(type, 0.9), naturalW: cw, naturalH: ch };
}

function loadVideoMeta(src) {
  return new Promise((resolve) => {
    const v = document.createElement('video');
    v.preload = 'metadata';
    v.onloadedmetadata = () => resolve({
      naturalW: v.videoWidth,
      naturalH: v.videoHeight,
      // MediaRecorder-produced WebMs report Infinity — store 0 (= unknown)
      duration: Number.isFinite(v.duration) && v.duration > 0 ? v.duration : 0,
    });
    v.onerror = () => resolve({ naturalW: 0, naturalH: 0, duration: 0 });
    v.src = src;
  });
}

// Video object-URLs can't survive a reload and would blow the localStorage quota,
// so persist video slides with a null src (layers + metadata only).
function serialiseSlides(slides) {
  return slides.map((s) =>
    s.media?.mediaType === 'video'
      ? { ...s, media: { ...s.media, src: null } }
      : s);
}

function loadInitial() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      if (data && Array.isArray(data.slides) && data.slides.length) {
        // the persisted id may point at a slide that no longer exists — a stale
        // id makes every patchSlide() silently no-op
        const cur = data.slides.some((s) => s.id === data.currentSlideId)
          ? data.currentSlideId
          : data.slides[0].id;
        return {
          formatId: data.formatId || DEFAULT_FORMAT_ID,
          slides: data.slides,
          currentSlideId: cur,
          globalLock: !!data.globalLock,
        };
      }
    }
  } catch { /* ignore corrupt storage */ }
  const first = newSlide(null, [createTextLayer({ text: SEED_TEXT })]);
  return { formatId: DEFAULT_FORMAT_ID, slides: [first], currentSlideId: first.id, globalLock: false };
}

export default function Editor({ viewSwitcher = null, active = true }) {
  const initial = useMemo(() => loadInitial(), []);
  const [formatId, setFormatId] = useState(initial.formatId);
  const [slides, setSlides] = useState(initial.slides);
  const [currentSlideId, setCurrentSlideId] = useState(initial.currentSlideId);
  const [selectedLayerId, setSelectedLayerId] = useState(null);
  const [busy, setBusy] = useState('');
  const [rec, setRec] = useState({ t: 0, dur: 0 });
  const [toast, setToast] = useState(null); // { kind:'error'|'info', msg, action?:{label,onClick} }
  const [storageFull, setStorageFull] = useState(false);
  const [dropping, setDropping] = useState(false);
  const [globalLock, setGlobalLock] = useState(initial.globalLock);
  const fileRef = useRef(null);
  const rightRef = useRef(null);
  const cancelRef = useRef(null);

  const format = getFormat(formatId);
  const currentSlide = slides.find((s) => s.id === currentSlideId) || slides[0];
  const selectedLayer = currentSlide?.layers.find((l) => l.id === selectedLayerId) || null;
  const currentType = currentSlide?.media?.mediaType || null;

  // ---- undo / redo (slides snapshots, committed at action boundaries) ----
  const undoRef = useRef([]);
  const redoRef = useRef([]);
  const slidesRef = useRef(slides);
  const lastChangeRef = useRef(0);
  useEffect(() => { slidesRef.current = slides; }, [slides]);

  const commit = useCallback(() => {
    undoRef.current.push(slidesRef.current);
    if (undoRef.current.length > UNDO_CAP) undoRef.current.shift();
    redoRef.current = [];
  }, []);

  const undo = useCallback(() => {
    const prev = undoRef.current.pop();
    if (!prev) return;
    redoRef.current.push(slidesRef.current);
    setSlides(prev);
    setCurrentSlideId((cur) => (prev.some((s) => s.id === cur) ? cur : prev[0].id));
    setSelectedLayerId(null);
  }, []);

  const redo = useCallback(() => {
    const next = redoRef.current.pop();
    if (!next) return;
    undoRef.current.push(slidesRef.current);
    setSlides(next);
    setCurrentSlideId((cur) => (next.some((s) => s.id === cur) ? cur : next[0].id));
    setSelectedLayerId(null);
  }, []);

  // ---- toast (one system: export errors, undo offers, zip notices) ----
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(t);
  }, [toast]);

  // ---- autosave to localStorage (video sources stripped, debounced) ----
  const saveNow = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        formatId, slides: serialiseSlides(slides), currentSlideId, globalLock,
      }));
      setStorageFull(false);
    } catch (err) {
      // quota errors deserve a visible warning — silently losing an hour of
      // edits on reload is worse than a chip; other errors (private mode) stay quiet
      if (err?.name === 'QuotaExceededError' || err?.code === 22) setStorageFull(true);
    }
  }, [formatId, slides, currentSlideId, globalLock]);

  useEffect(() => {
    const t = setTimeout(saveNow, 500);
    return () => clearTimeout(t);
  }, [saveNow]);

  useEffect(() => {
    window.addEventListener('beforeunload', saveNow);
    return () => window.removeEventListener('beforeunload', saveNow);
  }, [saveNow]);

  // ---- slide helpers ----
  const patchSlide = useCallback((slideId, updater) => {
    setSlides((prev) => prev.map((s) => (s.id === slideId ? updater(s) : s)));
  }, []);

  const addMedia = useCallback(async (files) => {
    const accepted = files.filter((f) => f.type.startsWith('image/') || f.type.startsWith('video/'));
    if (!accepted.length) return;
    const created = [];
    for (const f of accepted) {
      if (f.type.startsWith('video/')) {
        const src = URL.createObjectURL(f);            // keep the blob alive via the object URL
        OBJECT_URLS.add(src);
        const meta = await loadVideoMeta(src);
        created.push(newSlide({ mediaType: 'video', src, ...meta }, []));
      } else {
        const media = await importImage(f);
        if (!media) continue;
        created.push(newSlide({ mediaType: 'image', ...media }, []));
      }
    }
    if (!created.length) return;
    commit();
    // while locked, new slides shouldn't land with an empty layout — they
    // inherit Slide 1's current layer template (own text, same everything else)
    const cloneTemplate = (template) => template.map((tl) => ({ ...tl, id: uid('layer'), text: DEFAULT_LAYER_TEXT }));
    setSlides((prev) => {
      const starter = prev.length === 1 && !prev[0].media ? prev[0] : null;
      if (!starter) {
        const withLayers = globalLock && prev[0]?.layers.length
          ? created.map((s) => ({ ...s, layers: cloneTemplate(prev[0].layers) }))
          : created;
        return [...prev, ...withLayers];
      }
      const pristine = starter.layers.length === 0 ||
        (starter.layers.length === 1 && starter.layers[0].text === SEED_TEXT);
      if (pristine) return created; // disposable placeholder: replace outright
      // the user already wrote their hook — carry it onto the first upload
      const rest = globalLock
        ? created.slice(1).map((s) => ({ ...s, layers: cloneTemplate(starter.layers) }))
        : created.slice(1);
      return [{ ...created[0], layers: starter.layers }, ...rest];
    });
    setCurrentSlideId(created[0].id);
  }, [commit, globalLock]);

  // re-attach a video file to a persisted slide whose object URL died with the
  // previous session (layers are preserved; metadata refreshed from the file)
  const relinkVideo = useCallback(async (slideId, file) => {
    if (!file?.type.startsWith('video/')) return;
    const src = URL.createObjectURL(file);
    OBJECT_URLS.add(src);
    const meta = await loadVideoMeta(src);
    commit();
    patchSlide(slideId, (s) => ({ ...s, media: { mediaType: 'video', src, ...meta } }));
  }, [patchSlide, commit]);

  const deleteSlide = useCallback((slideId) => {
    const target = slides.find((s) => s.id === slideId);
    if (!target) return;
    commit();
    const remaining = slides.filter((s) => s.id !== slideId);
    const next = remaining.length ? remaining : [newSlide(null, [])];
    setSlides(next);
    setCurrentSlideId((cur) => (next.some((s) => s.id === cur) ? cur : next[0].id));
    setToast({ kind: 'info', msg: 'Slide deleted', action: { label: 'Undo', onClick: undo } });
  }, [slides, commit, undo]);

  const reorderSlide = useCallback((slideId, dir) => {
    commit();
    setSlides((prev) => {
      const i = prev.findIndex((s) => s.id === slideId);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }, [commit]);

  const resetProject = useCallback(() => {
    if (!window.confirm('Start a new project? Current slides will be cleared.')) return;
    for (const url of OBJECT_URLS) {
      try { URL.revokeObjectURL(url); } catch { /* ignore */ }
    }
    OBJECT_URLS.clear();
    undoRef.current = [];
    redoRef.current = [];
    const first = newSlide(null, [createTextLayer({ text: SEED_TEXT })]);
    setSlides([first]);
    setCurrentSlideId(first.id);
    setSelectedLayerId(null);
    setGlobalLock(false);
    setToast(null);
  }, []);

  // ---- global lock: while on, Slide 1 is the template — its layers' position,
  // size, colour, style, alignment and rotation propagate to the same layer
  // index on every other slide. Text stays per-slide (that's the whole point).
  const firstSlideId = slides[0]?.id;

  const toggleGlobalLock = useCallback(() => {
    setGlobalLock((prev) => {
      const next = !prev;
      if (next && slides.length > 1) {
        commit();
        setSlides((cur) => {
          const template = cur[0].layers;
          return cur.map((s, i) => {
            if (i === 0) return s;
            const layers = template.map((tl, idx) => {
              const { text: _text, ...style } = tl;
              const existing = s.layers[idx];
              return existing ? { ...existing, ...style } : { ...style, id: uid('layer'), text: DEFAULT_LAYER_TEXT };
            });
            return { ...s, layers };
          });
        });
        setToast({ kind: 'info', msg: 'Layout locked — every slide now matches Slide 1', action: { label: 'Undo', onClick: undo } });
      }
      return next;
    });
  }, [slides, commit, undo]);

  // ---- layer helpers (operate on current slide) ----
  const scrollInspectorCue = useCallback(() => {
    if (window.matchMedia('(max-width: 960px)').matches) {
      rightRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, []);

  // while locked, only Slide 1 may make structural/style changes — every other
  // slide just mirrors it. Text edits are exempt (checked by each caller).
  const lockBlocksHere = globalLock && currentSlideId !== firstSlideId;
  const lockBlockedToast = useCallback((verb) => {
    setToast({ kind: 'info', msg: `Unlock to ${verb} here — layout follows Slide 1.` });
  }, []);

  const addLayer = useCallback((overrides = {}) => {
    if (lockBlocksHere) { lockBlockedToast('add layers'); return; }
    commit();
    const layer = createTextLayer(overrides);
    if (globalLock && slides.length > 1) {
      setSlides((prev) => prev.map((s, i) => (
        i === 0
          ? { ...s, layers: [...s.layers, layer] }
          : { ...s, layers: [...s.layers, { ...layer, id: uid('layer'), text: DEFAULT_LAYER_TEXT }] }
      )));
    } else {
      patchSlide(currentSlideId, (s) => ({ ...s, layers: [...s.layers, layer] }));
    }
    setSelectedLayerId(layer.id);
    scrollInspectorCue();
  }, [currentSlideId, patchSlide, commit, scrollInspectorCue, globalLock, slides.length, lockBlocksHere, lockBlockedToast]);

  const changeLayer = useCallback((layerId, patch) => {
    const isTextOnly = Object.keys(patch).length === 1 && 'text' in patch;
    if (lockBlocksHere && !isTextOnly) { lockBlockedToast('reposition, resize or restyle'); return; }
    // leading-edge commit: snapshot the true pre-drag/pre-burst state once,
    // then let the rest of the burst mutate freely
    const now = Date.now();
    if (now - lastChangeRef.current > 300) commit();
    lastChangeRef.current = now;

    const propagate = globalLock && currentSlideId === firstSlideId && !isTextOnly && slides.length > 1;
    setSlides((prev) => {
      const idx = propagate ? prev[0].layers.findIndex((l) => l.id === layerId) : -1;
      return prev.map((s, i) => {
        if (s.id === currentSlideId) {
          return { ...s, layers: s.layers.map((l) => (l.id === layerId ? { ...l, ...patch } : l)) };
        }
        if (propagate && i !== 0 && idx !== -1 && s.layers[idx]) {
          return { ...s, layers: s.layers.map((l, j) => (j === idx ? { ...l, ...patch } : l)) };
        }
        return s;
      });
    });
  }, [currentSlideId, commit, globalLock, firstSlideId, slides.length, lockBlocksHere, lockBlockedToast]);

  const deleteLayer = useCallback((layerId) => {
    if (lockBlocksHere) { lockBlockedToast('delete layers'); return; }
    commit();
    if (globalLock && slides.length > 1) {
      const idx = slides[0].layers.findIndex((l) => l.id === layerId);
      setSlides((prev) => prev.map((s, i) => {
        if (i === 0) return { ...s, layers: s.layers.filter((l) => l.id !== layerId) };
        return idx === -1 ? s : { ...s, layers: s.layers.filter((_, j) => j !== idx) };
      }));
    } else {
      patchSlide(currentSlideId, (s) => ({ ...s, layers: s.layers.filter((l) => l.id !== layerId) }));
    }
    setSelectedLayerId((cur) => (cur === layerId ? null : cur));
  }, [currentSlideId, patchSlide, commit, globalLock, slides, lockBlocksHere, lockBlockedToast]);

  const duplicateLayer = useCallback((layerId) => {
    if (lockBlocksHere) { lockBlockedToast('duplicate layers'); return; }
    commit();
    // uid minted in the handler (not inside the updater) so the updater stays
    // pure under StrictMode double-invocation and the selection always matches
    const newId = uid('layer');
    const offsetYFor = (base) => {
      const boxHPct = (layoutLayer(base, format).totalH / format.h) * 100;
      return clampYToSafeZone(base.yPct + 4, boxHPct);
    };
    if (globalLock && slides.length > 1) {
      const srcIdx = slides[0].layers.findIndex((l) => l.id === layerId);
      const template = srcIdx !== -1 ? slides[0].layers[srcIdx] : null;
      setSlides((prev) => prev.map((s, i) => {
        if (i === 0) {
          const src = s.layers.find((l) => l.id === layerId);
          if (!src) return s;
          return { ...s, layers: [...s.layers, { ...src, id: newId, xPct: src.xPct + 4, yPct: offsetYFor(src) }] };
        }
        if (!template) return s;
        const { id: _id, text: _text, ...style } = template;
        return { ...s, layers: [...s.layers, { ...style, id: uid('layer'), text: DEFAULT_LAYER_TEXT, xPct: style.xPct + 4, yPct: offsetYFor(style) }] };
      }));
    } else {
      patchSlide(currentSlideId, (s) => {
        const src = s.layers.find((l) => l.id === layerId);
        if (!src) return s;
        return { ...s, layers: [...s.layers, { ...src, id: newId, xPct: src.xPct + 4, yPct: offsetYFor(src) }] };
      });
    }
    setSelectedLayerId(newId);
  }, [currentSlideId, patchSlide, commit, globalLock, slides, format, lockBlocksHere, lockBlockedToast]);

  // dir: +1 forward (later in array = on top), -1 backward
  const reorderLayer = useCallback((layerId, dir) => {
    if (lockBlocksHere) { lockBlockedToast('reorder layers'); return; }
    commit();
    if (globalLock && slides.length > 1) {
      const i = slides[0].layers.findIndex((l) => l.id === layerId);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= slides[0].layers.length) return;
      setSlides((prev) => prev.map((s) => {
        if (j >= s.layers.length) return s;
        const layers = [...s.layers];
        [layers[i], layers[j]] = [layers[j], layers[i]];
        return { ...s, layers };
      }));
    } else {
      patchSlide(currentSlideId, (s) => {
        const i = s.layers.findIndex((l) => l.id === layerId);
        const j = i + dir;
        if (i < 0 || j < 0 || j >= s.layers.length) return s;
        const layers = [...s.layers];
        [layers[i], layers[j]] = [layers[j], layers[i]];
        return { ...s, layers };
      });
    }
  }, [currentSlideId, patchSlide, commit, globalLock, slides, lockBlocksHere, lockBlockedToast]);

  const applyPack = useCallback((packId) => {
    const pack = getPack(packId);
    if (!pack) return;
    if (lockBlocksHere) { lockBlockedToast('add a pack'); return; }
    commit();
    const built = pack.build();
    if (globalLock && slides.length > 1) {
      setSlides((prev) => prev.map((s, i) => (
        i === 0
          ? { ...s, layers: [...s.layers, ...built] }
          : { ...s, layers: [...s.layers, ...built.map((l) => ({ ...l, id: uid('layer'), text: DEFAULT_LAYER_TEXT }))] }
      )));
    } else {
      patchSlide(currentSlideId, (s) => ({ ...s, layers: [...s.layers, ...built] }));
    }
    if (built.length) setSelectedLayerId(built[built.length - 1].id);
    scrollInspectorCue();
  }, [currentSlideId, patchSlide, commit, scrollInspectorCue, globalLock, slides.length, lockBlocksHere, lockBlockedToast]);

  // ---- keyboard: undo/redo, delete, deselect, arrow-nudge ----
  useEffect(() => {
    if (!active) return;
    const onKey = (e) => {
      const t = e.target;
      const typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        if (typing) return; // let the text field's native undo work
        e.preventDefault();
        if (e.shiftKey) redo(); else undo();
        return;
      }
      if (typing) return;
      if (e.key === 'Escape') { setSelectedLayerId(null); return; }
      if (!selectedLayerId) return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        deleteLayer(selectedLayerId);
      } else if (e.key.startsWith('Arrow')) {
        e.preventDefault();
        const cur = currentSlide?.layers.find((l) => l.id === selectedLayerId);
        if (!cur) return;
        const step = e.shiftKey ? 2 : 0.5;
        const patch = {};
        if (e.key === 'ArrowLeft') patch.xPct = round1(cur.xPct - step);
        else if (e.key === 'ArrowRight') patch.xPct = round1(cur.xPct + step);
        else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
          const raw = cur.yPct + (e.key === 'ArrowUp' ? -step : step);
          const boxHPct = (layoutLayer(cur, format).totalH / format.h) * 100;
          patch.yPct = round1(clampYToSafeZone(raw, boxHPct));
        }
        changeLayer(selectedLayerId, patch);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, selectedLayerId, currentSlide, deleteLayer, changeLayer, undo, redo, format]);

  // ---- window-level drop/paste: never navigate away on a missed drop; paste
  // an image anywhere (unless typing in a field) to add it ----
  useEffect(() => {
    if (!active) return;
    const prevent = (e) => e.preventDefault();
    const onPaste = (e) => {
      const files = Array.from(e.clipboardData?.files || []);
      const tag = document.activeElement?.tagName;
      if (files.length && tag !== 'TEXTAREA' && tag !== 'INPUT') {
        e.preventDefault();
        addMedia(files);
      }
    };
    window.addEventListener('dragover', prevent);
    window.addEventListener('drop', prevent);
    window.addEventListener('paste', onPaste);
    return () => {
      window.removeEventListener('dragover', prevent);
      window.removeEventListener('drop', prevent);
      window.removeEventListener('paste', onPaste);
    };
  }, [active, addMedia]);

  // ---- export ----
  // Single export branches on media type: image -> PNG, video -> burned-in clip.
  const exportCurrent = useCallback(async () => {
    if (!currentSlide) return;
    const idx = slides.findIndex((s) => s.id === currentSlide.id);

    if (currentSlide.media?.mediaType === 'video') {
      if (!currentSlide.media.src) return; // persisted-but-unloaded video
      setBusy('video');
      setRec({ t: 0, dur: 0 });
      try {
        const { promise, cancel } = exportVideo(currentSlide, format, (t, dur) => setRec({ t, dur }));
        cancelRef.current = cancel;
        const { blob, ext } = await promise;
        if (ext === 'webm') setToast({ kind: 'info', msg: 'Saved as .webm — this browser can’t record MP4.' });
        saveAs(blob, `${format.id}-slide-${idx + 1}.${ext}`);
      } catch (err) {
        if (err?.name !== 'AbortError') {
          console.error(err);
          setToast({ kind: 'error', msg: `Export failed: ${err?.message || 'unknown error'}` });
        }
      } finally {
        cancelRef.current = null;
        setBusy('');
      }
      return;
    }

    setBusy('png');
    try {
      const blob = await renderSlide(currentSlide, format);
      saveAs(blob, `${format.id}-slide-${idx + 1}.png`);
    } catch (err) {
      console.error(err);
      setToast({ kind: 'error', msg: `Export failed: ${err?.message || 'unknown error'}` });
    } finally {
      setBusy('');
    }
  }, [currentSlide, format, slides]);

  // Batch ZIP is image-only (video export is real-time & per-clip).
  const zippable = slides.filter((s) => s.media?.mediaType !== 'video' && (s.media || s.layers.length > 0));

  const exportAll = useCallback(async () => {
    setBusy('zip');
    try {
      const zip = new JSZip();
      let count = 0;
      let skippedVideos = 0;
      for (let i = 0; i < slides.length; i++) {
        if (slides[i].media?.mediaType === 'video') { skippedVideos += 1; continue; }
        if (!slides[i].media && !slides[i].layers.length) continue; // blank starter
        const blob = await renderSlide(slides[i], format);
        zip.file(`${format.id}-slide-${i + 1}.png`, blob);
        count += 1;
      }
      if (!count) {
        setToast({ kind: 'info', msg: 'No image slides to zip — video slides export individually.' });
        return;
      }
      const content = await zip.generateAsync({ type: 'blob' });
      saveAs(content, 'overlay-slides.zip');
      if (skippedVideos) {
        setToast({ kind: 'info', msg: `Zipped ${count} image${count > 1 ? 's' : ''} — ${skippedVideos} video slide${skippedVideos > 1 ? 's' : ''} skipped (use Export video per slide).` });
      }
    } catch (err) {
      console.error(err);
      setToast({ kind: 'error', msg: `Export failed: ${err?.message || 'unknown error'}` });
    } finally {
      setBusy('');
    }
  }, [slides, format]);

  return (
    <div className="ed-root">
      <header className="ed-toolbar">
        <div className="ed-brand">
          <span className="ed-brand-dot" />
          Overlay Studio
          <span className="ed-brand-sub">{format.name} · {format.w}×{format.h}</span>
        </div>
        {viewSwitcher}
        <div className="ed-toolbar-actions">
          {storageFull && <span className="ed-storage-chip">Autosave paused: storage full</span>}
          {lockBlocksHere && <span className="ed-lock-chip">Layout locked to Slide 1</span>}
          <button className="ed-btn" title="Start a new project" disabled={!!busy} onClick={resetProject}>
            <FilePlus size={16} /> New
          </button>
          <button
            className={`ed-btn ${globalLock ? 'ed-btn-lock-active' : ''}`}
            title="Keep every slide's text layout identical to Slide 1"
            disabled={slides.length < 2}
            onClick={toggleGlobalLock}
          >
            {globalLock ? <Lock size={16} /> : <Unlock size={16} />} {globalLock ? 'Layout locked' : 'Lock layout'}
          </button>
          <button className="ed-btn" onClick={() => addLayer()}>
            <Type size={16} /> Text
          </button>
          {currentType === 'video' ? (
            <button className="ed-btn ed-btn-primary" disabled={!currentSlide?.media?.src || !!busy} onClick={exportCurrent}>
              {busy === 'video'
                ? <><Loader2 size={16} className="ed-spin" /> Recording…</>
                : <><Film size={16} /> Export video</>}
            </button>
          ) : (
            <button className="ed-btn" disabled={(!currentSlide?.media && !currentSlide?.layers.length) || !!busy} onClick={exportCurrent}>
              {busy === 'png' ? <Loader2 size={16} className="ed-spin" /> : <Download size={16} />} PNG
            </button>
          )}
          <button
            className="ed-btn ed-btn-primary"
            disabled={!!busy || !zippable.length}
            title={!zippable.length ? 'No image slides to zip — video slides export individually' : undefined}
            onClick={exportAll}
          >
            {busy === 'zip' ? <Loader2 size={16} className="ed-spin" /> : <Package size={16} />} Export all (.zip)
          </button>
        </div>
      </header>

      <div className="ed-body">
        <aside className="ed-left">
          <SlidePanel
            format={format}
            onSetFormat={setFormatId}
            slides={slides}
            currentSlideId={currentSlideId}
            onSelectSlide={(id) => { setCurrentSlideId(id); setSelectedLayerId(null); }}
            onAddMedia={addMedia}
            onDeleteSlide={deleteSlide}
            onReorderSlide={reorderSlide}
            onApplyPack={applyPack}
          />
        </aside>

        <main
          className={`ed-center ${dropping ? 'ed-dropping' : ''}`}
          onDragOver={(e) => {
            if (e.dataTransfer?.types?.includes('Files')) {
              e.preventDefault();
              setDropping(true);
            }
          }}
          onDragLeave={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget)) setDropping(false);
          }}
          onDrop={(e) => {
            e.preventDefault();
            setDropping(false);
            addMedia(Array.from(e.dataTransfer.files));
          }}
        >
          <Canvas
            slide={currentSlide}
            format={format}
            selectedLayerId={selectedLayerId}
            onSelectLayer={setSelectedLayerId}
            onChangeLayer={changeLayer}
            onDeleteLayer={deleteLayer}
            onRelinkMedia={relinkVideo}
          />
          <div className="ed-center-hint">
            <button className="ed-btn ed-btn-ghost" onClick={() => fileRef.current?.click()}>
              <ImagePlus size={15} /> Add image / video
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*,video/*"
              multiple
              hidden
              onChange={(e) => { addMedia(Array.from(e.target.files || [])); e.target.value = ''; }}
            />
          </div>
          {toast && (
            <div className={`ed-toast ed-toast-${toast.kind}`} role="status">
              <span>{toast.msg}</span>
              {toast.action && (
                <button
                  className="ed-toast-action"
                  onClick={() => { toast.action.onClick(); setToast(null); }}
                >
                  {toast.action.label}
                </button>
              )}
              <button className="ed-toast-x" onClick={() => setToast(null)} aria-label="Dismiss">×</button>
            </div>
          )}
        </main>

        <aside className="ed-right" ref={rightRef}>
          <Inspector
            layer={selectedLayer}
            onChange={changeLayer}
            onDuplicate={duplicateLayer}
            onDelete={deleteLayer}
            onReorder={reorderLayer}
          />
        </aside>

        {busy === 'video' && (
          <div className="ed-record-scrim">
            <div className="ed-record-box">
              <Loader2 size={20} className="ed-spin" />
              <p className="ed-record-time">
                Recording… {rec.t.toFixed(1)}{rec.dur > 0 ? ` / ${rec.dur.toFixed(1)}` : ''}s
              </p>
              <p className="ed-hint">Real-time export — keep this tab visible.</p>
              <button className="ed-btn" onClick={() => cancelRef.current?.()}>Cancel</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
