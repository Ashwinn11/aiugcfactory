"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import styles from "./page.module.css";

/* ─── Constants ──────────────────────────────────────────── */

const VIBES = [
  "Beach day in Bali — açaí bowls and ocean views",
  "Cozy coffee shop morning — latte art and journaling",
  "Night out downtown — cocktails and rooftop views",
  "Gym morning routine — athleisure and protein shake",
  "Sunday farmers market — flowers and fresh pastries",
  "Golden hour park walk — sunset and outfit check",
];

/* ─── Component ──────────────────────────────────────────── */

export default function Home() {
  // Avatar
  const [avatar, setAvatar] = useState(null);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const fileInputRef = useRef(null);

  // Vibe input
  const [vibe, setVibe] = useState("");

  // Generation
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState(null); // { images: [{ image, caption, timestamp }] }
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [error, setError] = useState(null);

  // UI toggles
  const [showJson, setShowJson] = useState(false);
  const [history, setHistory] = useState([]);

  // ──── Load default avatar on mount ────
  useEffect(() => {
    fetch("/api/avatar")
      .then((r) => r.json())
      .then((data) => {
        if (data.avatars?.length > 0) {
          setAvatar(data.avatars[0]);
        }
      })
      .catch(() => {});
  }, []);

  // ──── Upload avatar ────
  const handleAvatarUpload = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAvatarLoading(true);
    try {
      const formData = new FormData();
      formData.append("avatar", file);

      const res = await fetch("/api/avatar", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setAvatar(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setAvatarLoading(false);
    }
  }, []);

  // ──── Generate carousel (single API call) ────
  const handleGenerate = useCallback(async () => {
    if (!vibe.trim() || generating) return;
    setGenerating(true);
    setError(null);
    setSelectedIdx(0);
    setResult(null);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vibe: vibe.trim(),
          avatar: avatar ? { base64: avatar.base64, mimeType: avatar.mimeType } : undefined,
          aspectRatio: "9:16",
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generation failed");

      const newResult = { images: data.images, timestamp: Date.now(), vibe };
      setResult(newResult);
      setHistory((prev) => [newResult, ...prev].slice(0, 20));
    } catch (e) {
      setError(e.message);
    } finally {
      setGenerating(false);
    }
  }, [vibe, avatar, generating]);

  // ──── Download single image ────
  const handleDownload = useCallback((imageData, index) => {
    const a = document.createElement("a");
    a.href = imageData;
    a.download = `ugcfactory_${index + 1}_${Date.now()}.png`;
    a.click();
  }, []);

  // ──── Download all images ────
  const handleDownloadAll = useCallback(() => {
    if (!result?.images) return;
    result.images.forEach((item, i) => {
      setTimeout(() => {
        const a = document.createElement("a");
        a.href = item.image;
        a.download = `ugcfactory_carousel_${i + 1}.png`;
        a.click();
      }, i * 300);
    });
  }, [result]);

  // ──── Keyboard shortcut ────
  const handleKeyDown = (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      handleGenerate();
    }
  };

  /* ─── Render ──────────────────────────────────────────── */

  return (
    <div className={styles.page}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.logoArea}>
          <div className={styles.logoIcon}>🎬</div>
          <div className={styles.logoText}>
            UGC <span>Factory</span>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className={styles.hero}>
        <h1 className={styles.heroTitle}>AI influencer content, in one click</h1>
        <p className={styles.heroSub}>
          Upload your face, describe the vibe, get 5 post‑worthy carousel images with captions —
          all in a single shot.
        </p>
      </section>

      {/* ═══ STEP 1: Avatar ═══ */}
      <section className={styles.stepSection}>
        <div className={styles.stepLabel}>
          <div className={styles.stepNumber}>1</div>
          <div className={styles.stepTitle}>
            Your avatar <span className={styles.stepOptional}>(optional — skip for product shots)</span>
          </div>
        </div>
        <div className={styles.avatarArea}>
          <div className={styles.avatarPreview}>
            {avatar?.url ? (
              <img src={avatar.url} alt="Avatar" />
            ) : avatar?.base64 ? (
              <img src={`data:${avatar.mimeType};base64,${avatar.base64}`} alt="Avatar" />
            ) : (
              <span className={styles.avatarEmpty}>👤</span>
            )}
          </div>
          <div className={styles.avatarInfo}>
            <div className={styles.avatarName}>
              {avatar ? avatar.name || "Avatar loaded" : "No avatar selected"}
            </div>
            <div className={styles.avatarHint}>
              {avatar
                ? "Same person in every carousel image"
                : "Upload a face to keep it consistent across all photos"}
            </div>
          </div>
          <div className={styles.avatarActions}>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className={styles.avatarUploadInput}
              onChange={handleAvatarUpload}
            />
            <button
              className={avatar ? styles.avatarBtn : styles.avatarBtnPrimary}
              onClick={() => fileInputRef.current?.click()}
              disabled={avatarLoading}
            >
              {avatarLoading ? "…" : avatar ? "Change" : "Upload"}
            </button>
            {avatar && (
              <button className={styles.avatarBtn} onClick={() => setAvatar(null)}>
                Remove
              </button>
            )}
          </div>
        </div>
      </section>

      {/* ═══ STEP 2: Vibe ═══ */}
      <section className={styles.stepSection} style={{ animationDelay: "0.3s" }}>
        <div className={styles.stepLabel}>
          <div className={styles.stepNumber}>2</div>
          <div className={styles.stepTitle}>What's the vibe?</div>
        </div>
        <div className={styles.vibeBox}>
          <textarea
            className={styles.vibeTextarea}
            placeholder="Beach day in Bali — açaí bowls and ocean views..."
            value={vibe}
            onChange={(e) => setVibe(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={3}
          />
          <div className={styles.vibeFooter}>
            <span className={styles.vibeHint}>⌘↵ to generate</span>
          </div>
        </div>
        <div className={styles.vibeExamples}>
          {VIBES.map((v, i) => (
            <button key={i} className={styles.vibeChip} onClick={() => setVibe(v)}>
              {v}
            </button>
          ))}
        </div>
      </section>

      {/* ═══ Generate Button ═══ */}
      <section className={styles.generateSection}>
        <button
          className={styles.generateBtn}
          onClick={handleGenerate}
          disabled={!vibe.trim() || generating}
        >
          {generating ? (
            <><span className={styles.spinner} /> Generating your carousel…</>
          ) : (
            <>✦ Generate Carousel</>
          )}
        </button>
      </section>

      {/* Error */}
      {error && <div className={styles.error}>⚠ {error}</div>}

      {/* Loading */}
      {generating && (
        <div className={styles.loadingResult}>
          <div className={styles.loadingLens} />
          <div className={styles.loadingText}>Creating your photo dump…</div>
          <div className={styles.loadingSubtext}>
            {avatar ? "Character-consistent " : ""}5 images + captions in one shot
          </div>
        </div>
      )}

      {/* ═══ Carousel Result ═══ */}
      {result && !generating && (
        <section className={styles.carouselSection}>
          <div className={styles.carouselLabel}>
            <span>◉</span> Your carousel — {result.images.length} images
          </div>

          {/* Horizontal scroll carousel */}
          <div className={styles.carouselTrack}>
            {result.images.map((item, i) => (
              <div
                key={item.timestamp}
                className={selectedIdx === i ? styles.carouselSlideActive : styles.carouselSlide}
                onClick={() => setSelectedIdx(i)}
              >
                <img src={item.image} alt={`Image ${i + 1}`} />
                <div className={styles.carouselSlideInfo}>
                  <div className={styles.carouselSlideIndex}>#{i + 1}</div>
                  <div className={styles.carouselSlideScene}>
                    {item.caption || "—"}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Selected image detail */}
          {result.images[selectedIdx] && (
            <div className={styles.selectedDetail}>
              <img
                className={styles.selectedImage}
                src={result.images[selectedIdx].image}
                alt={`Selected image ${selectedIdx + 1}`}
              />
              {result.images[selectedIdx].caption && (
                <div className={styles.selectedScene}>
                  {result.images[selectedIdx].caption}
                </div>
              )}
              <div className={styles.selectedActions}>
                <button
                  className={styles.actionBtn}
                  onClick={() => handleDownload(result.images[selectedIdx].image, selectedIdx)}
                >
                  ↓ Download
                </button>
              </div>
            </div>
          )}

          {/* Download all */}
          <div className={styles.downloadAllBar}>
            <button className={styles.downloadAllBtn} onClick={handleDownloadAll}>
              ↓ Download All {result.images.length} Images
            </button>
          </div>
        </section>
      )}

      {/* Empty State */}
      {!result && !generating && (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>📸</div>
          <div className={styles.emptyTitle}>Your carousel studio</div>
          <div className={styles.emptyDesc}>
            Describe a vibe and hit Generate — you'll get 5 post‑worthy images with captions, ready
            for Instagram.
          </div>
        </div>
      )}

      {/* Past Carousels */}
      {history.length > 0 && (
        <section className={styles.historySection}>
          <div className={styles.historyHeader}>
            <span className={styles.historyTitle}>Past carousels ({history.length})</span>
          </div>
          <div className={styles.historyStrip}>
            {history.map((item, i) => (
              <div
                key={item.timestamp}
                className={
                  result?.timestamp === item.timestamp
                    ? styles.historyThumbActive
                    : styles.historyThumb
                }
                onClick={() => {
                  setResult(item);
                  setSelectedIdx(0);
                }}
              >
                <img src={item.images[0]?.image} alt={`Carousel ${i + 1}`} />
                <div className={styles.historyThumbCount}>{item.images.length}×</div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
