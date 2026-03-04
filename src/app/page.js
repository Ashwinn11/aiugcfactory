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
  const [avatar, setAvatar] = useState(null); // { base64, mimeType, url, name }
  const [avatarLoading, setAvatarLoading] = useState(false);
  const fileInputRef = useRef(null);

  // Vibe input
  const [vibe, setVibe] = useState("");

  // Flow states
  const [planning, setPlanning] = useState(false);
  const [scenes, setScenes] = useState(null); // array of scene objects
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState(null); // { images: [{ image, prompt, scene }] }
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

  // ──── Step 1: Plan carousel scenes ────
  const handlePlan = useCallback(async () => {
    if (!vibe.trim() || planning) return;
    setPlanning(true);
    setError(null);
    setScenes(null);
    setResult(null);

    try {
      const res = await fetch("/api/plan-carousel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vibe: vibe.trim(), count: 5 }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to plan scenes");

      setScenes(data.scenes);
    } catch (e) {
      setError(e.message);
    } finally {
      setPlanning(false);
    }
  }, [vibe, planning]);

  // ──── Step 2: Generate images from scenes ────
  const handleGenerate = useCallback(async () => {
    if (!scenes || scenes.length === 0 || generating) return;
    setGenerating(true);
    setError(null);
    setSelectedIdx(0);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenes,
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
  }, [scenes, avatar, generating, vibe]);

  // ──── Remove a scene ────
  const removeScene = useCallback((index) => {
    setScenes((prev) => prev.filter((_, i) => i !== index));
  }, []);

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
      if (scenes && !generating) {
        handleGenerate();
      } else if (!planning) {
        handlePlan();
      }
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
        <nav className={styles.headerNav}>
          <button className={styles.navBtn} onClick={() => setShowJson((s) => !s)}>
            { } JSON
          </button>
        </nav>
      </header>

      {/* Hero */}
      <section className={styles.hero}>
        <h1 className={styles.heroTitle}>AI influencer content, in one click</h1>
        <p className={styles.heroSub}>
          Upload your face, describe the vibe, get 5 post‑worthy carousel images — different poses,
          accessories, candids.
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
            <span className={styles.vibeHint}>⌘↵ to plan scenes</span>
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

      {/* ═══ STEP 3: Generate ═══ */}
      <section className={styles.generateSection} style={{ animationDelay: "0.5s" }}>
        <button
          className={styles.generateBtn}
          onClick={() => { setScenes(null); handlePlan(); }}
          disabled={!vibe.trim() || planning}
        >
          {planning ? (
            <><span className={styles.spinner} /> Planning your carousel…</>
          ) : scenes ? (
            <>↻ Replan Carousel</>
          ) : (
            <>✦ Plan My Carousel</>
          )}
        </button>
      </section>

      {/* Error */}
      {error && <div className={styles.error}>⚠ {error}</div>}

      {/* ═══ Scene Preview (between plan and generate) ═══ */}
      {scenes && !result && !generating && (
        <div className={styles.scenePreview}>
          <div className={styles.scenePreviewHeader}>
            <div className={styles.scenePreviewTitle}>
              Planned scenes ({scenes.length})
            </div>
          </div>
          <div className={styles.sceneList}>
            {scenes.map((scene, i) => (
              <div key={i} className={styles.sceneCard}>
                <div className={styles.sceneIndex}>{i + 1}</div>
                <div className={styles.sceneContent}>
                  <div className={styles.sceneText}>
                    {typeof scene === "string" ? scene : scene.scene || scene.description}
                  </div>
                  {scene.type && (
                    <div className={styles.sceneType}>
                      {scene.type} · {scene.framing || "—"}
                    </div>
                  )}
                </div>
                {scenes.length > 2 && (
                  <button className={styles.sceneRemove} onClick={() => removeScene(i)}>
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>
          <div className={styles.sceneActions}>
            <button
              className={styles.sceneGenerateBtn}
              onClick={handleGenerate}
              disabled={generating}
            >
              {generating ? (
                <><span className={styles.spinner} /> Generating…</>
              ) : (
                <>✦ Generate {scenes.length} Images</>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Loading */}
      {generating && (
        <div className={styles.loadingResult}>
          <div className={styles.loadingLens} />
          <div className={styles.loadingText}>
            Generating {scenes?.length || 1} carousel images…
          </div>
          <div className={styles.loadingSubtext}>
            {avatar ? "Character-consistent " : ""}
            scenes → prompts → images
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
                    {typeof item.scene === "string"
                      ? item.scene
                      : item.scene?.scene || item.scene?.description || "—"}
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
              <div className={styles.selectedScene}>
                {typeof result.images[selectedIdx].scene === "string"
                  ? result.images[selectedIdx].scene
                  : result.images[selectedIdx].scene?.scene || "—"}
              </div>
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

          {/* Download all + JSON toggle */}
          <div className={styles.downloadAllBar}>
            <button className={styles.downloadAllBtn} onClick={handleDownloadAll}>
              ↓ Download All {result.images.length} Images
            </button>
            <button className={styles.jsonToggleBtn} onClick={() => setShowJson((s) => !s)}>
              {showJson ? "Hide" : "📋"} JSON
            </button>
          </div>

          {showJson && result.images[selectedIdx]?.prompt && (
            <div className={styles.jsonPanel}>
              <div className={styles.jsonBody}>
                <pre>{JSON.stringify(result.images[selectedIdx].prompt, null, 2)}</pre>
              </div>
            </div>
          )}
        </section>
      )}

      {/* Empty State */}
      {!result && !generating && !scenes && (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>📸</div>
          <div className={styles.emptyTitle}>Your carousel studio</div>
          <div className={styles.emptyDesc}>
            Describe a vibe, and we'll plan 5 scenes for your photo dump — then generate all the
            images with your avatar.
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
