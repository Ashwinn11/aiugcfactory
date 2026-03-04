"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import styles from "./page.module.css";

/* ─── Mode Configs ───────────────────────────────────────── */

const MODES = [
  {
    id: "photodump",
    label: "Photo Dump",
    icon: "📸",
    desc: "Mixed moments — selfies, food, outfits, views across different times",
    placeholder: "Saturday in the city — thrift shopping and sunset rooftop...",
    vibes: [
      "Weekend in the city — coffee run, vintage shopping, rooftop sunset",
      "Beach day — morning swim, açaí bowl, sandy feet, golden hour",
      "My week in photos — gym, work from cafe, cooking, movie night",
      "Travel day — airport fit, window seat, hotel check-in, street food",
    ],
  },
  {
    id: "carousel",
    label: "Post Carousel",
    icon: "🎠",
    desc: "One occasion — cohesive story from a single event or moment",
    placeholder: "Date night at the new Italian spot downtown...",
    vibes: [
      "Birthday dinner at a rooftop restaurant — the outfit, the cake, the view",
      "Concert night — getting ready, the crowd, the lights, the afterparty",
      "Sunday brunch with friends — mimosas, pancakes, laughing",
      "Golden hour beach walk — barefoot, waves, sunset portrait",
    ],
  },
  {
    id: "ad",
    label: "Ad Creative",
    icon: "📦",
    desc: "You + a product — organic influencer-style content",
    placeholder: "This changed my morning routine — upload the product above...",
    vibes: [
      "My new obsession — unboxing, first try, daily use",
      "Get ready with me featuring this product",
      "A day in my life with this in my bag",
      "Honest review — the texture, the packaging, the results",
    ],
  },
];

/* ─── Component ──────────────────────────────────────────── */

export default function Home() {
  // Mode
  const [mode, setMode] = useState("photodump");
  const currentMode = MODES.find((m) => m.id === mode);

  // Avatar
  const [avatar, setAvatar] = useState(null);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const fileInputRef = useRef(null);

  // Product image (ad mode)
  const [productImage, setProductImage] = useState(null);
  const [productLoading, setProductLoading] = useState(false);
  const productInputRef = useRef(null);

  // Vibe input
  const [vibe, setVibe] = useState("");

  // Generation
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState(null);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [error, setError] = useState(null);

  // History
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

  // ──── Upload product image (ad mode) ────
  const handleProductUpload = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setProductLoading(true);
    try {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result.split(",")[1];
        setProductImage({
          base64,
          mimeType: file.type || "image/png",
          name: file.name,
          url: reader.result,
        });
        setProductLoading(false);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      setError(err.message);
      setProductLoading(false);
    }
  }, []);

  // ──── Generate carousel ────
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
          mode,
          avatar: avatar ? { base64: avatar.base64, mimeType: avatar.mimeType } : undefined,
          productImage:
            mode === "ad" && productImage
              ? { base64: productImage.base64, mimeType: productImage.mimeType }
              : undefined,
          aspectRatio: "9:16",
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generation failed");

      const newResult = { images: data.images, timestamp: Date.now(), vibe, mode };
      setResult(newResult);
      setHistory((prev) => [newResult, ...prev].slice(0, 20));
    } catch (e) {
      setError(e.message);
    } finally {
      setGenerating(false);
    }
  }, [vibe, mode, avatar, productImage, generating]);

  // ──── Download ────
  const handleDownload = useCallback((imageData, index) => {
    const a = document.createElement("a");
    a.href = imageData;
    a.download = `ugcfactory_${index + 1}_${Date.now()}.png`;
    a.click();
  }, []);

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
          Upload your face, pick a mode, describe the vibe — get 5 post‑worthy images with captions.
        </p>
      </section>

      {/* ═══ MODE SELECTOR ═══ */}
      <section className={styles.stepSection}>
        <div className={styles.stepLabel}>
          <div className={styles.stepNumber}>1</div>
          <div className={styles.stepTitle}>What are you creating?</div>
        </div>
        <div className={styles.modeSelector}>
          {MODES.map((m) => (
            <button
              key={m.id}
              className={mode === m.id ? styles.modeCardActive : styles.modeCard}
              onClick={() => {
                setMode(m.id);
                setVibe("");
              }}
            >
              <div className={styles.modeIcon}>{m.icon}</div>
              <div className={styles.modeLabel}>{m.label}</div>
              <div className={styles.modeDesc}>{m.desc}</div>
            </button>
          ))}
        </div>
      </section>

      {/* ═══ AVATAR + PRODUCT ═══ */}
      <section className={styles.stepSection} style={{ animationDelay: "0.2s" }}>
        <div className={styles.stepLabel}>
          <div className={styles.stepNumber}>2</div>
          <div className={styles.stepTitle}>
            {mode === "ad" ? "Your face + product" : "Your avatar"}
            <span className={styles.stepOptional}> (optional)</span>
          </div>
        </div>
        <div className={styles.uploadRow}>
          {/* Avatar */}
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
                {avatar ? avatar.name || "Avatar loaded" : "Your face"}
              </div>
              <div className={styles.avatarHint}>
                {avatar ? "Same person in every image" : "Upload for character consistency"}
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
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Product image (ad mode only) */}
          {mode === "ad" && (
            <div className={styles.avatarArea}>
              <div className={styles.avatarPreview}>
                {productImage?.url ? (
                  <img src={productImage.url} alt="Product" />
                ) : (
                  <span className={styles.avatarEmpty}>📦</span>
                )}
              </div>
              <div className={styles.avatarInfo}>
                <div className={styles.avatarName}>
                  {productImage ? productImage.name || "Product loaded" : "Product image"}
                </div>
                <div className={styles.avatarHint}>
                  {productImage
                    ? "This product in every shot"
                    : "Upload the product to feature"}
                </div>
              </div>
              <div className={styles.avatarActions}>
                <input
                  ref={productInputRef}
                  type="file"
                  accept="image/*"
                  className={styles.avatarUploadInput}
                  onChange={handleProductUpload}
                />
                <button
                  className={productImage ? styles.avatarBtn : styles.avatarBtnPrimary}
                  onClick={() => productInputRef.current?.click()}
                  disabled={productLoading}
                >
                  {productLoading ? "…" : productImage ? "Change" : "Upload"}
                </button>
                {productImage && (
                  <button className={styles.avatarBtn} onClick={() => setProductImage(null)}>
                    ✕
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ═══ VIBE INPUT ═══ */}
      <section className={styles.stepSection} style={{ animationDelay: "0.4s" }}>
        <div className={styles.stepLabel}>
          <div className={styles.stepNumber}>3</div>
          <div className={styles.stepTitle}>Describe the vibe</div>
        </div>
        <div className={styles.vibeBox}>
          <textarea
            className={styles.vibeTextarea}
            placeholder={currentMode?.placeholder || "Describe your vibe..."}
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
          {currentMode?.vibes.map((v, i) => (
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
            <><span className={styles.spinner} /> Generating your {currentMode?.label.toLowerCase()}…</>
          ) : (
            <>✦ Generate {currentMode?.label}</>
          )}
        </button>
      </section>

      {/* Error */}
      {error && <div className={styles.error}>⚠ {error}</div>}

      {/* Loading */}
      {generating && (
        <div className={styles.loadingResult}>
          <div className={styles.loadingLens} />
          <div className={styles.loadingText}>Creating your {currentMode?.label.toLowerCase()}…</div>
          <div className={styles.loadingSubtext}>
            {avatar ? "Character-consistent " : ""}5 images + captions in one shot
          </div>
        </div>
      )}

      {/* ═══ Carousel Result ═══ */}
      {result && !generating && (
        <section className={styles.carouselSection}>
          <div className={styles.carouselLabel}>
            <span>◉</span> Your {currentMode?.label.toLowerCase()} — {result.images.length} images
          </div>

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
          <div className={styles.emptyIcon}>{currentMode?.icon || "📸"}</div>
          <div className={styles.emptyTitle}>
            {mode === "photodump" && "Photo dump studio"}
            {mode === "carousel" && "Post carousel studio"}
            {mode === "ad" && "Ad creative studio"}
          </div>
          <div className={styles.emptyDesc}>
            {mode === "photodump" &&
              "Describe a vibe — get 5 mixed-moment photos like a real Instagram photo dump."}
            {mode === "carousel" &&
              "Describe an occasion — get 5 cohesive photos that tell the story of that moment."}
            {mode === "ad" &&
              "Upload a product, describe the vibe — get 5 influencer-style ad photos."}
          </div>
        </div>
      )}

      {/* Past Carousels */}
      {history.length > 0 && (
        <section className={styles.historySection}>
          <div className={styles.historyHeader}>
            <span className={styles.historyTitle}>Recent ({history.length})</span>
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
