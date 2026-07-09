// Real-time video exporter: play the source clip, draw each decoded frame
// cover-fit onto a native-resolution canvas, burn the SAME text overlays used
// everywhere else (drawOverlays from renderSlide.js) on top, and record the
// canvas stream + the source audio track with MediaRecorder.
//
// No stitching / no clip generation — video in -> overlays -> video out, with
// the original audio preserved. MP4 is preferred (TikTok); falls back to WebM.

import { ensureFontsLoaded } from './fonts.js';
import { drawCover, drawOverlays } from './renderSlide.js';

// Ordered preference: MP4/H.264+AAC first, then WebM.
const MIME_CANDIDATES = [
  { mime: 'video/mp4;codecs=avc1.42E01E,mp4a.40.2', ext: 'mp4' },
  { mime: 'video/mp4;codecs=avc1.42E01E', ext: 'mp4' },
  { mime: 'video/mp4', ext: 'mp4' },
  { mime: 'video/webm;codecs=vp9,opus', ext: 'webm' },
  { mime: 'video/webm;codecs=vp8,opus', ext: 'webm' },
  { mime: 'video/webm', ext: 'webm' },
];

export function pickMimeType() {
  const supported = typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported;
  for (const c of MIME_CANDIDATES) {
    if (!supported || MediaRecorder.isTypeSupported(c.mime)) return c;
  }
  return { mime: '', ext: 'webm' };
}

function loadVideo(src) {
  return new Promise((resolve, reject) => {
    const v = document.createElement('video');
    v.src = src;
    v.crossOrigin = 'anonymous';
    v.playsInline = true;
    v.muted = false;         // keep audio so the captured track isn't silent
    v.preload = 'auto';
    v.onloadedmetadata = () => resolve(v);
    v.onerror = () => reject(new Error('video failed to load'));
  });
}

// MediaRecorder-produced WebMs report duration === Infinity — a setTimeout of
// Infinity coerces to 0 and would stop the recording instantly.
const isDur = (d) => Number.isFinite(d) && d > 0;

// exportVideo(slide, format, onProgress?) -> { promise, cancel }
// promise resolves { blob, ext, mimeType }; rejects DOMException 'AbortError'
// when cancel() is called (no partial file is saved).
export function exportVideo(slide, format, onProgress) {
  let earlyAbort = false;
  let cancel = () => { earlyAbort = true; };

  const promise = (async () => {
    const media = slide.media;
    if (!media || media.mediaType !== 'video' || !media.src) {
      throw new Error('exportVideo requires a video slide with a live src');
    }
    await ensureFontsLoaded();

    const video = await loadVideo(media.src);
    // cancelled while the source was still loading
    if (earlyAbort) throw new DOMException('Export cancelled', 'AbortError');

    const canvas = document.createElement('canvas');
    canvas.width = format.w;
    canvas.height = format.h;
    const ctx = canvas.getContext('2d');

    const { mime, ext } = pickMimeType();

    const dur = isDur(media.duration) ? media.duration
      : isDur(video.duration) ? video.duration : 0;

    // video from the canvas we draw into
    const canvasStream = canvas.captureStream(30);
    const tracks = [...canvasStream.getVideoTracks()];

    // audio from the source clip (best-effort; some clips have none)
    let srcStream = null;
    try {
      if (video.captureStream) srcStream = video.captureStream();
      else if (video.mozCaptureStream) srcStream = video.mozCaptureStream();
    } catch { srcStream = null; }
    if (srcStream) {
      const audio = srcStream.getAudioTracks ? srcStream.getAudioTracks() : [];
      if (audio[0]) tracks.push(audio[0]);
    }

    const stream = new MediaStream(tracks);
    const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    const chunks = [];
    recorder.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };

    let aborted = false;
    const finished = new Promise((resolve, reject) => {
      recorder.onstop = () => {
        if (aborted) reject(new DOMException('Export cancelled', 'AbortError'));
        else resolve(new Blob(chunks, { type: mime || 'video/webm' }));
      };
    });

    let running = true;
    let guard = null;
    const drawFrame = () => {
      drawCover(ctx, video, format.w, format.h);
      drawOverlays(ctx, slide.layers, format);
    };

    const useRVFC = typeof video.requestVideoFrameCallback === 'function';
    const tick = () => {
      if (!running) return;
      drawFrame();
      if (onProgress) onProgress(video.currentTime, dur);
      if (useRVFC) video.requestVideoFrameCallback(tick);
      else requestAnimationFrame(tick);
    };

    // wall-clock safety net: stop a little past the remaining duration in case
    // 'ended' misfires; re-armed on tab-visibility resume.
    const armGuard = () => {
      if (guard) { clearTimeout(guard); guard = null; }
      const remain = dur - video.currentTime;
      if (dur && remain > 0) guard = setTimeout(stop, (remain + 1.5) * 1000);
    };

    // rAF/rVFC are throttled in hidden tabs while MediaRecorder keeps running,
    // which would bake a long freeze-frame into the output — pause both sides
    // while hidden and resume together.
    const onVis = () => {
      if (!running) return;
      if (document.hidden) {
        if (guard) { clearTimeout(guard); guard = null; }
        try { video.pause(); } catch { /* ignore */ }
        if (recorder.state === 'recording') recorder.pause();
      } else {
        if (recorder.state === 'paused') recorder.resume();
        video.play().catch(() => {});
        armGuard();
      }
    };
    document.addEventListener('visibilitychange', onVis);

    const stop = () => {
      if (!running) return;
      running = false;
      document.removeEventListener('visibilitychange', onVis);
      if (guard) { clearTimeout(guard); guard = null; }
      if (!aborted) { try { drawFrame(); } catch { /* ignore final draw */ } }
      if (recorder.state !== 'inactive') recorder.stop();
      try { video.pause(); } catch { /* ignore */ }
    };
    video.onended = stop;

    cancel = () => {
      if (!running) return;
      aborted = true;
      stop();
      stream.getTracks().forEach((t) => { try { t.stop(); } catch { /* ignore */ } });
    };

    try {
      video.currentTime = 0;
      await video.play();
    } catch (err) {
      document.removeEventListener('visibilitychange', onVis);
      throw err;
    }
    recorder.start();
    drawFrame(); // ensure the first frame is captured immediately
    armGuard();
    if (useRVFC) video.requestVideoFrameCallback(tick);
    else requestAnimationFrame(tick);

    const blob = await finished;
    return { blob, ext, mimeType: mime || 'video/webm' };
  })();

  return { promise, cancel: () => cancel() };
}
