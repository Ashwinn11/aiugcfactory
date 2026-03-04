"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { toPng } from "html-to-image";
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
    vibeLabel: "The marketing angle",
    vibeHint: "Describe the hook or the problem this product solves",
    placeholder: "This changed my morning routine — honest review about the texture...",
    vibes: [
      "Direct hook — why this is better than what you're using",
      "Soft sell — how this fits into a busy morning routine",
      "Problem/Solution — the one thing that fixed my skin texture",
      "The unboxing — first impressions of the packaging and feel",
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
  const exportRef = useRef(null);
  const [exportingPost, setExportingPost] = useState(null);

  // Orientation
  const [genAspectRatio, setGenAspectRatio] = useState("9:16");

  // Vibe input
  const [vibe, setVibe] = useState("");

  // Planning
  const [planning, setPlanning] = useState(false);
  const [plannedScenes, setPlannedScenes] = useState(null);
  const [selectedSceneIds, setSelectedSceneIds] = useState(new Set());

  // Generation
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState(null);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [error, setError] = useState(null);

  // History (Generative results)
  const [resultHistory, setResultHistory] = useState([]);

  // Packs (formerly savedPosts)
  const [packs, setPacks] = useState([]);
  const [view, setView] = useState("generator"); 
  const [editingPack, setEditingPack] = useState(null);
  const [editorIdx, setEditorIdx] = useState(0); 
  const [exportQueue, setExportQueue] = useState([]);
  const [isExporting, setIsExporting] = useState(false);

  // Undo/Redo (Editor specific)
  const [editorHistory, setEditorHistory] = useState([]);
  const [editorHistoryIdx, setEditorHistoryIdx] = useState(-1);

  // Unsaved changes confirmation
  const [confirmModal, setConfirmModal] = useState({ 
    show: false, 
    type: null, // "view", "mode", "fresh"
    next: null 
  });

  const hasUnsavedChanges = useCallback(() => {
    if (view === "editor") return editorHistoryIdx > 0;
    if (view === "generator") return !!result || !!plannedScenes || vibe.trim().length > 0;
    return false;
  }, [view, editorHistoryIdx, result, plannedScenes, vibe]);

  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (hasUnsavedChanges()) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges]);

  const handleStartFresh = useCallback(() => {
    setVibe("");
    setPlannedScenes(null);
    setResult(null);
    setSelectedSceneIds(new Set());
    setProductImage(null);
    setError(null);
  }, []);

  const requestViewChange = (nextView) => {
    if (nextView === view) return;
    if (hasUnsavedChanges()) {
      setConfirmModal({ show: true, type: "view", next: nextView });
    } else {
      setView(nextView);
    }
  };

  const requestModeChange = (nextMode) => {
    if (nextMode === mode) return;
    if (hasUnsavedChanges()) {
      setConfirmModal({ show: true, type: "mode", next: nextMode });
    } else {
      setMode(nextMode);
      handleStartFresh();
    }
  };

  const requestFreshStart = () => {
    if (hasUnsavedChanges()) {
      setConfirmModal({ show: true, type: "fresh", next: null });
    } else {
      handleStartFresh();
    }
  };

  useEffect(() => {
    if (view === "editor" && editingPack && editorHistory.length === 0) {
      setEditorHistory([JSON.parse(JSON.stringify(editingPack))]);
      setEditorHistoryIdx(0);
    } else if (view !== "editor") {
      setEditorHistory([]);
      setEditorHistoryIdx(-1);
    }
  }, [view, editingPack]);

  const commitToHistory = useCallback((newPack) => {
    setEditorHistory(prev => {
      const next = prev.slice(0, editorHistoryIdx + 1);
      next.push(JSON.parse(JSON.stringify(newPack)));
      const final = next.slice(-50);
      setEditorHistoryIdx(final.length - 1);
      return final;
    });
    setEditingPack(newPack);
  }, [editorHistoryIdx]);

  const handleUndo = useCallback(() => {
    if (editorHistoryIdx > 0) {
      const prevIdx = editorHistoryIdx - 1;
      setEditorHistoryIdx(prevIdx);
      setEditingPack(JSON.parse(JSON.stringify(editorHistory[prevIdx])));
    }
  }, [editorHistory, editorHistoryIdx]);

  const handleRedo = useCallback(() => {
    if (editorHistoryIdx < editorHistory.length - 1) {
      const nextIdx = editorHistoryIdx + 1;
      setEditorHistoryIdx(nextIdx);
      setEditingPack(JSON.parse(JSON.stringify(editorHistory[nextIdx])));
    }
  }, [editorHistory, editorHistoryIdx]);

  // ──── Persistence (IndexedDB for Large Image Data) ────
  const [dbReady, setDbReady] = useState(false);

  useEffect(() => {
    const initDB = async () => {
      return new Promise((resolve, reject) => {
        const request = indexedDB.open("UGCFactoryDB", 1);
        request.onupgradeneeded = (e) => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains("packs")) {
            db.createObjectStore("packs", { keyPath: "id" });
          }
        };
        request.onsuccess = (e) => resolve(e.target.result);
        request.onerror = (e) => reject(e.target.error);
      });
    };

    const loadData = async () => {
      try {
        const db = await initDB();
        const transaction = db.transaction("packs", "readonly");
        const store = transaction.objectStore("packs");
        const request = store.getAll();

        request.onsuccess = () => {
          let loadedPacks = request.result || [];
          
          // --- ONE TIME MIGRATION FROM LOCALSTORAGE ---
          const oldData = localStorage.getItem("ugc_factory_packs");
          if (oldData && loadedPacks.length === 0) {
            try {
              const parsed = JSON.parse(oldData);
              const migrated = parsed.map(p => (!p.images ? {
                id: p.id,
                title: p.caption || "Untitled Pack",
                type: p.mode || "photodump",
                aspectRatio: "9:16",
                images: [{ image: p.image, overlays: p.overlays || [] }],
                savedAt: p.savedAt || Date.now()
              } : p));
              
              // Parallel save migrated items to DB
              const saveTx = db.transaction("packs", "readwrite");
              const saveStore = saveTx.objectStore("packs");
              migrated.forEach(item => saveStore.put(item));
              
              loadedPacks = migrated;
              localStorage.removeItem("ugc_factory_packs"); // CLEAN UP
              console.log("Migrated localStorage data to IndexedDB");
            } catch (err) { console.error("Migration failed"); }
          }
          
          // Sort by date newest first if not already
          loadedPacks.sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));
          setPacks(loadedPacks);
          setDbReady(true);
        };
      } catch (err) {
        console.error("DB Init failed:", err);
        setDbReady(true); // Proceed even if empty
      }
    };

    loadData();
  }, []);

  // Sync to IndexedDB on change (debounced via effect)
  useEffect(() => {
    if (!dbReady || packs.length === 0) return;
    
    const saveToDB = async () => {
      const request = indexedDB.open("UGCFactoryDB", 1);
      request.onsuccess = (e) => {
        const db = e.target.result;
        const transaction = db.transaction("packs", "readwrite");
        const store = transaction.objectStore("packs");
        
        // We're keeping things simple: overwrite/put each pack from current memory state
        // A more optimized version might track 'dirty' packs but this is fine for most uses
        packs.forEach(p => store.put(p));
      };
    };
    
    saveToDB();
  }, [packs, dbReady]);

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

  // ──── Plan carousel ────
  const handlePlan = useCallback(async () => {
    if (!vibe.trim() || planning) return;
    setPlanning(true);
    setError(null);
    setPlannedScenes(null);
    setSelectedSceneIds(new Set());
    setResult(null);

    try {
      const res = await fetch("/api/plan", {
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
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Planning failed");

      setPlannedScenes(data.scenes);
      // Auto-select all scenes
      const autoSelected = new Set();
      data.scenes.forEach((_, i) => autoSelected.add(i));
      setSelectedSceneIds(autoSelected);
    } catch (e) {
      setError(e.message);
    } finally {
      setPlanning(false);
    }
  }, [vibe, mode, avatar, productImage, planning]);

  // ──── Update Planned Scene ────
  const updatePlannedScene = (index, field, value) => {
    setPlannedScenes((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  // ──── Toggle scene selection ────
  const toggleSceneSelection = (index) => {
    setSelectedSceneIds((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else if (next.size < 5) {
        next.add(index);
      }
      return next;
    });
  };

  // ──── Generate carousel ────
  const handleGenerate = useCallback(async () => {
    if (!plannedScenes || selectedSceneIds.size === 0 || generating) return;

    // Only send the selected scenes
    const selectedScenes = plannedScenes.filter((_, i) => selectedSceneIds.has(i));

    setGenerating(true);
    setError(null);
    setSelectedIdx(0);
    setResult(null);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenes: selectedScenes,
          mode,
          avatar: avatar ? { base64: avatar.base64, mimeType: avatar.mimeType } : undefined,
          productImage:
            mode === "ad" && productImage
              ? { base64: productImage.base64, mimeType: productImage.mimeType }
              : undefined,
          aspectRatio: genAspectRatio,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generation failed");

      const newResult = { images: data.images, timestamp: Date.now(), vibe, mode, aspectRatio: genAspectRatio };
      setResult(newResult);
      setResultHistory((prev) => [newResult, ...prev].slice(0, 20));
    } catch (e) {
      setError(e.message);
    } finally {
      setGenerating(false);
    }
  }, [vibe, mode, avatar, productImage, generating, plannedScenes, selectedSceneIds]);

  // ──── Download ────
  // ──── Batch Export Logic ────
  useEffect(() => {
    if (exportQueue.length > 0 && !exportingPost && !isExporting) {
      const next = exportQueue[0];
      setExportingPost(next);
      setExportQueue(prev => prev.slice(1));
    }
  }, [exportQueue, exportingPost, isExporting]);

  const handleDownloadTrigger = useCallback((post) => {
    if (!post) return;
    if (!post.overlays || post.overlays.length === 0) {
      const a = document.createElement("a");
      a.href = post.image;
      a.download = `ugcfactory_${Date.now()}.png`;
      a.click();
    } else {
      setExportingPost(post);
    }
  }, []);

  const handleExportPack = useCallback((pack) => {
    if (!pack?.images) return;
    setExportQueue(pack.images.map(img => ({ ...img, aspectRatio: pack.aspectRatio })));
  }, []);

  useEffect(() => {
    if (exportingPost && exportRef.current) {
      setIsExporting(true);
      const capture = async () => {
        try {
          // Increase capture resolution to 3x for professional crispness (1620x2880)
          const dataUrl = await toPng(exportRef.current, { 
            quality: 1.0, 
            pixelRatio: 3,
            cacheBust: true,
            style: { 
              transform: 'none', 
              transformOrigin: 'top left',
              visibility: 'visible'
            }
          });
          const a = document.createElement("a");
          a.href = dataUrl;
          a.download = `ugcfactory_${Date.now()}_hq.png`;
          a.click();
        } catch (err) {
          console.error("Failed image capture:", err);
        } finally {
          setIsExporting(false);
          setExportingPost(null);
        }
      };
      // 1.2s ensure fonts and base images are fully decoded in the offscreen frame
      setTimeout(capture, 1200);
    }
  }, [exportingPost]);

  // ──── Save Pack ────
  const handleSave = useCallback((result) => {
    if (!result?.images) return;
    const newPack = {
      id: `pack_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      title: `${result.mode || 'Post'} - ${result.vibe || 'Untitled'}`,
      type: result.mode,
      aspectRatio: result.aspectRatio || "9:16",
      images: result.images.map(img => ({
        image: img.image,
        caption: img.caption,
        scene_prompt: img.scene_prompt,
        overlays: []
      })),
      savedAt: Date.now()
    };
    setPacks(prev => [newPack, ...prev]);
    alert("Saved to Library!");
    setView("library");
  }, []);

  const handleRemovePack = useCallback((id) => {
    setPacks(prev => prev.filter(p => p.id !== id));
    // Explicitly delete from DB
    const request = indexedDB.open("UGCFactoryDB", 1);
    request.onsuccess = (e) => {
      const db = e.target.result;
      const transaction = db.transaction("packs", "readwrite");
      transaction.objectStore("packs").delete(id);
    };
  }, []);

  const handleUpdatePack = useCallback((updatedPack) => {
    setPacks(prev => {
      const index = prev.findIndex(p => p.id === updatedPack.id);
      if (index !== -1) {
        const next = [...prev];
        next[index] = updatedPack;
        return next;
      } else {
        return [updatedPack, ...prev];
      }
    });
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
    if ((e.metaKey || e.ctrlKey)) {
      if (e.key === "Enter") {
        e.preventDefault();
        if (plannedScenes) handleGenerate();
        else handlePlan();
      }
      if (e.key === "z") {
        e.preventDefault();
        if (e.shiftKey) handleRedo(); else handleUndo();
      }
      if (e.key === "y") {
        e.preventDefault();
        handleRedo();
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
          <div className={styles.tabs}>
            <button 
              className={view === "generator" ? styles.tabActive : styles.tab}
              onClick={() => requestViewChange("generator")}
            >
              Generator
            </button>
            <button 
              className={view === "library" ? styles.tabActive : styles.tab}
              onClick={() => requestViewChange("library")}
            >
              Library
            </button>
            <button 
              className={view === "editor" ? styles.tabActive : styles.tab}
              onClick={() => {
                if (packs.length > 0) {
                  let packToEdit = packs[0];
                  // Magic: Auto-add captions as overlays if empty
                  const hasNoOverlays = packToEdit.images.every(img => (img.overlays || []).length === 0);
                  if (hasNoOverlays) {
                    packToEdit = {
                      ...packToEdit,
                      images: packToEdit.images.map(img => ({
                        ...img,
                        overlays: img.caption ? [{
                          id: `auto_${Date.now()}_${Math.random()}`,
                          text: img.caption,
                          x: 50,
                          y: 80,
                          fontSize: 24,
                          color: "#ffffff",
                          bgMode: "solid",
                          rotation: 0,
                          size: 30
                        }] : []
                      }))
                    };
                  }
                  setEditingPack(packToEdit);
                  requestViewChange("editor");
                } else {
                  // Create blank pack
                  const newPack = {
                    id: `pack_${Date.now()}`,
                    title: "New Project",
                    images: [],
                    aspectRatio: genAspectRatio,
                    savedAt: Date.now()
                  };
                  setEditingPack(newPack);
                  requestViewChange("editor");
                }
              }}
            >
              Editor
            </button>
          </div>
      </header>

      {/* ═══ GENERATOR VIEW ═══ */}
      {view === "generator" && (
        <>
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
                  onClick={() => requestModeChange(m.id)}
                >
                  <div className={styles.modeIcon}>{m.icon}</div>
                  <div className={styles.modeLabel}>{m.label}</div>
                  <div className={styles.modeDesc}>{m.desc}</div>
                </button>
              ))}
            </div>
          </section>


          {/* ═══ STEP 2: UPLOADS ═══ */}
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
          {!plannedScenes && (
            <>
              <section className={styles.stepSection} style={{ animationDelay: "0.4s" }}>
                <div className={styles.stepLabel}>
                  <div className={styles.stepNumber}>3</div>
                  <div className={styles.stepTitle}>{currentMode?.vibeLabel || "Describe the vibe"}</div>
                </div>
                {currentMode?.vibeHint && (
                  <p style={{ margin: "0 0 1rem 3.5rem", color: "#888", fontSize: "0.85rem" }}>
                    {currentMode.vibeHint}
                  </p>
                )}
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
                    <span className={styles.vibeHint}>⌘↵ to plan</span>
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

              {/* ═══ Plan Button ═══ */}
              <section className={styles.generateSection}>
                <button
                  className={styles.generateBtn}
                  onClick={handlePlan}
                  disabled={!vibe.trim() || planning}
                >
                  {planning ? (
                    <><span className={styles.spinner} /> Planning scenes…</>
                  ) : (
                    <>✦ Plan Carousel</>
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
            </>
          )}

          {/* ═══ REVIEW PLAN ═══ */}
          {plannedScenes && !result && (
            <>
              <section className={styles.stepSection} style={{ animationDelay: "0.1s" }}>
                <div className={styles.stepLabel}>
                  <div className={styles.stepNumber}>4</div>
                  <div className={styles.stepTitle}>Review & Edit Scenes</div>
                </div>
                <p className={styles.vibeHint} style={{ marginBottom: "1rem" }}>
                  {plannedScenes.length} scenes ready. Deselect any you want to skip. ({selectedSceneIds.size}/{plannedScenes.length} selected)
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                  {plannedScenes.map((scene, i) => {
                    const isSelected = selectedSceneIds.has(i);
                    const isMaxed = false;
                    const cameraColors = {
                      selfie: "#4ade80", mirror_selfie: "#60a5fa", backcamera: "#f59e0b",
                      pov: "#a78bfa", friend_candid: "#f472b6",
                    };
                    return (
                      <div
                        key={i}
                        onClick={() => !isMaxed && toggleSceneSelection(i)}
                        style={{
                          display: "flex", flexDirection: "column", gap: "0.5rem",
                          background: isSelected ? "#1a1a2e" : "#111",
                          padding: "1rem", borderRadius: "12px",
                          border: isSelected ? "2px solid #ecc245" : "1px solid #333",
                          cursor: isMaxed ? "not-allowed" : "pointer",
                          opacity: isMaxed ? 0.5 : 1,
                          transition: "all 0.2s ease",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                            <div style={{
                              width: "24px", height: "24px", borderRadius: "6px",
                              border: isSelected ? "2px solid #ecc245" : "2px solid #555",
                              background: isSelected ? "#ecc245" : "transparent",
                              display: "flex", alignItems: "center", justifyContent: "center",
                              fontSize: "14px", color: "#000", fontWeight: "700",
                              flexShrink: 0,
                            }}>
                              {isSelected ? "✓" : ""}
                            </div>
                            <span style={{ fontWeight: "600", color: isSelected ? "#ecc245" : "#aaa" }}>Scene {i + 1}</span>
                            {scene.camera && (
                              <span style={{
                                fontSize: "0.7rem", padding: "2px 8px", borderRadius: "4px",
                                background: (cameraColors[scene.camera] || "#666") + "22",
                                color: cameraColors[scene.camera] || "#888",
                                border: `1px solid ${cameraColors[scene.camera] || "#666"}44`,
                                textTransform: "uppercase", fontWeight: "600", letterSpacing: "0.5px",
                              }}>
                                {scene.camera?.replace("_", " ")}
                              </span>
                            )}
                          </div>
                          {scene.requires_avatar && (
                            <span style={{ fontSize: "0.7rem", color: "#888" }}>👤 Avatar</span>
                          )}
                        </div>
                        <div style={{ fontSize: "0.95rem", color: "#ddd", fontStyle: "italic" }}>
                          {scene.caption}
                        </div>
                        <textarea
                          value={scene.prompt}
                          onChange={(e) => { e.stopPropagation(); updatePlannedScene(i, 'prompt', e.target.value); }}
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            background: "#1a1a1a", color: "#ccc", border: "1px solid #333",
                            padding: "0.5rem", borderRadius: "6px", width: "100%",
                            fontFamily: "inherit", fontSize: "0.85rem",
                            minHeight: "60px", resize: "vertical",
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
                <button
                  className={styles.avatarBtn}
                  style={{ marginTop: "1rem" }}
                  onClick={() => { setPlannedScenes(null); setSelectedSceneIds(new Set()); }}
                >
                  ← Back to Vibe
                </button>
              </section>

              {/* ═══ Generate Button ═══ */}
              <section className={styles.generateSection}>
                <button
                  className={styles.generateBtn}
                  onClick={handleGenerate}
                  disabled={generating || selectedSceneIds.size === 0}
                >
                  {generating ? (
                    <><span className={styles.spinner} /> Generating {selectedSceneIds.size} image{selectedSceneIds.size !== 1 ? "s" : ""}…</>
                  ) : (
                    <>✦ Generate {selectedSceneIds.size} Image{selectedSceneIds.size !== 1 ? "s" : ""}</>
                  )}
                </button>
              </section>
            </>
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
                      <strong>Caption:</strong> {result.images[selectedIdx].caption}
                    </div>
                  )}
                  {result.images[selectedIdx].scene_prompt && (
                    <div className={styles.selectedScene} style={{ marginTop: '8px', fontSize: '0.9rem', color: '#888' }}>
                      <strong>AI Scene Prompt:</strong> {result.images[selectedIdx].scene_prompt}
                    </div>
                  )}
                  <div className={styles.selectedActions}>
                    <button
                      className={styles.actionBtn}
                      onClick={() => handleDownloadTrigger(result.images[selectedIdx])}
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

              <div className={styles.genActions}>
                {packs.some(p => p.images.length > 0 && p.images[0].image === result.images[0].image) ? (
                  <button className={styles.saveLibraryBtn} disabled style={{ opacity: 0.6, cursor: 'default' }}>
                    ♥ Saved
                  </button>
                ) : (
                  <button className={styles.saveLibraryBtn} onClick={() => handleSave(result)}>
                    ♥ Save to Library
                  </button>
                )}
                <button className={styles.newGenBtn} onClick={requestFreshStart}>
                  ↻ Start Fresh
                </button>
              </div>
            </section>
          )}
        </>
      )}

      {/* ═══ SAVED LIBRARY VIEW ═══ */}
      {view === "library" && (
        <section className={styles.stepSection}>
          <div className={styles.libraryHeader}>
            <div className={styles.stepLabel}>
              <div className={styles.stepNumber}>★</div>
              <div className={styles.stepTitle}>Your Saved Packs</div>
            </div>
            <button className={styles.newPackBtn} onClick={() => {
              const newPack = {
                id: `pack_${Date.now()}`,
                title: "New Project",
                images: [],
                aspectRatio: genAspectRatio,
                savedAt: Date.now()
              };
              setEditingPack(newPack);
              setEditorIdx(0);
              setView("editor");
            }}>＋ New Pack</button>
          </div>
          
          {packs.length === 0 ? (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}>📂</div>
              <div className={styles.emptyTitle}>Nothing saved yet</div>
              <div className={styles.emptyDesc}>
                Generate some images or create a new pack to see them here.
              </div>
            </div>
          ) : (
            <div className={styles.savedGrid}>
              {packs.map((pack) => (
                <div key={pack.id} className={styles.savedCard}>
                  <div className={styles.savedImageWrapper}>
                    <div style={{ 
                      width: '540px', 
                      height: pack.aspectRatio === '1:1' ? '540px' : pack.aspectRatio === '3:4' ? '720px' : '960px', 
                      transform: 'scale(0.4)', 
                      transformOrigin: 'top left' 
                    }}>
                      {pack.images.length > 0 && (
                        <img src={pack.images[0].image} alt="Pack cover" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      )}
                      {/* Overlays preview on cover if any */}
                      <div className={styles.savedOverlay}>
                        {pack.images[0]?.overlays?.map((ov, idx) => {
                          const isSolid = ov.bgMode === 'solid';
                          const selectedColor = ov.color || "#ffffff";
                          const isLight = parseInt(selectedColor.replace('#',''), 16) > 0xffffff / 2;
                          const bgColor = isSolid ? selectedColor : 'transparent';
                          const textColor = isSolid ? (isLight ? '#000000' : '#ffffff') : selectedColor;
                          return (
                            <div key={idx} className={styles.textOverlay} style={{
                              position: "absolute",
                              left: `${ov.x}%`,
                              top: `${ov.y}%`,
                              transform: `translate(-50%, -50%) rotate(${ov.rotation || 0}deg) scale(${(ov.size || 30) / 30})`,
                              fontSize: `${ov.fontSize || 24}px`,
                            }}>
                              <span style={{ color: textColor, backgroundColor: bgColor }}>{ov.text}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                  <div className={styles.savedCardActions}>
                    <button className={styles.savedActionBtn} onClick={() => {
                      let packToEdit = pack;
                      // Magic: Auto-add captions as overlays if empty
                      const hasNoOverlays = packToEdit.images.every(img => (img.overlays || []).length === 0);
                      if (hasNoOverlays) {
                        packToEdit = {
                          ...packToEdit,
                          images: packToEdit.images.map(img => ({
                            ...img,
                            overlays: img.caption ? [{
                              id: `auto_${Date.now()}_${Math.random()}`,
                              text: img.caption,
                              x: 50,
                              y: 80,
                              fontSize: 24,
                              color: "#ffffff",
                              bgMode: "solid",
                              rotation: 0,
                              size: 30
                            }] : []
                          }))
                        };
                      }
                      setEditingPack(packToEdit);
                      setEditorIdx(0);
                      setView("editor");
                    }}>✎</button>
                    <button className={styles.savedActionBtn} style={{ background: "rgba(239, 68, 68, 0.6)" }} onClick={() => handleRemovePack(pack.id)}>✕</button>
                  </div>
                  <div className={styles.savedCardInfo}>
                    <div className={styles.savedCardCaption}>{pack.title}</div>
                    <div className={styles.savedCardMeta}>{pack.images.length} Images • {pack.aspectRatio}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ═══ FULL PAGE EDITOR VIEW ═══ */}
      {view === "editor" && editingPack && (
        <section className={styles.editorView}>
          <div className={styles.editorHeader}>
            <div className={styles.editorHeaderLeft}>
              <button className={styles.editorBackBtn} onClick={() => requestViewChange("library")}>← Back</button>
              <div className={styles.editorTitle}>{editingPack.title}</div>
              <div className={styles.editorHistoryCtrls}>
                <button 
                  className={styles.historyBtn} 
                  onClick={handleUndo} 
                  disabled={editorHistoryIdx <= 0}
                  title="Undo (⌘Z)"
                >⟲</button>
                <button 
                  className={styles.historyBtn} 
                  onClick={handleRedo} 
                  disabled={editorHistoryIdx >= editorHistory.length - 1}
                  title="Redo (⌘⇧Z)"
                >⟳</button>
              </div>
            </div>
            <div className={styles.editorControls}>
              <select 
                value={editingPack.aspectRatio} 
                onChange={(e) => {
                  const nextPack = {...editingPack, aspectRatio: e.target.value};
                  commitToHistory(nextPack);
                }}
                className={styles.ratioSelect}
              >
                <option value="9:16">9:16 (Full Vertical)</option>
                <option value="3:4">3:4 (Portrait Feed)</option>
              </select>

              <button className={styles.editorExportBtn} onClick={() => {
                handleExportPack(editingPack);
              }}>
                {exportQueue.length > 0 ? `Exporting (${exportQueue.length})` : 'Export Pack'}
              </button>
            </div>
          </div>

          <div className={styles.editorMain}>
            {/* ═══ Left Sidebar (Asset Management) ═══ */}
            <div className={styles.editorAssetPanel}>
              <div className={styles.sectionTitle}>Assets</div>
              <div className={styles.thumbnailStrip}>
                {editingPack.images.map((img, i) => (
                  <div 
                    key={i} 
                    className={editorIdx === i ? styles.thumbItemActive : styles.thumbItem}
                    onClick={() => setEditorIdx(i)}
                  >
                    <img src={img.image} alt={`Slide ${i+1}`} />
                  </div>
                ))}
                <label className={styles.addThumbBtn}>
                  <span style={{ fontSize: '1.2rem' }}>＋</span>
                  <span>Add</span>
                  <input 
                    type="file" 
                    hidden 
                    accept="image/*" 
                    onChange={(e) => {
                      const file = e.target.files[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = () => {
                        const newImg = { image: reader.result, overlays: [] };
                        const nextPack = {...editingPack, images: [...editingPack.images, newImg]};
                        commitToHistory(nextPack);
                        setEditorIdx(nextPack.images.length - 1);
                      };
                      reader.readAsDataURL(file);
                    }} 
                  />
                </label>
              </div>
            </div>

            {/* ═══ Stage (Centered Canvas) ═══ */}
              <div className={styles.editorStage} style={{
                height: editingPack.aspectRatio === '1:1' ? '540px' : editingPack.aspectRatio === '3:4' ? '720px' : '960px'
              }}>
              {editingPack.images.length > 1 && (
                <>
                  <button 
                    className={styles.navArrowLeft} 
                    onClick={() => setEditorIdx(prev => prev > 0 ? prev - 1 : editingPack.images.length - 1)}
                  >
                    ‹
                  </button>
                  <button 
                    className={styles.navArrowRight} 
                    onClick={() => setEditorIdx(prev => (prev + 1) % editingPack.images.length)}
                  >
                    ›
                  </button>
                </>
              )}

              <div className={styles.canvasFrame} style={{ 
                width: '540px', 
                height: editingPack.aspectRatio === '1:1' ? '540px' : editingPack.aspectRatio === '3:4' ? '720px' : '960px', 
                transform: `scale(${editingPack.aspectRatio === '1:1' ? 0.8 : editingPack.aspectRatio === '3:4' ? 0.75 : 0.65})`,
                transformOrigin: 'center center'
              }}>
                <div className={styles.canvasWrapper} style={{ width: '100%', height: '100%', position: 'relative' }}>
                  {editingPack.images[editorIdx] ? (
                    <>
                      <img 
                        src={editingPack.images[editorIdx].image} 
                        alt="Editing" 
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                      />
                      {editingPack.images[editorIdx].overlays?.map((ov, idx) => {
                        const isSolid = ov.bgMode === 'solid';
                        const isOutline = ov.bgMode === 'outline';
                        const selectedColor = ov.color || "#ffffff";
                        const isLight = parseInt(selectedColor.replace('#',''), 16) > 0xffffff / 2;
                        const bgColor = isSolid ? selectedColor : 'transparent';
                        const textColor = isSolid ? (isLight ? '#000000' : '#ffffff') : selectedColor;
                        const outlineColor = isLight ? '#000000' : '#ffffff';
                        const outlineShadow = isOutline ? `
                          1px 1px 0 ${outlineColor}, -1px -1px 0 ${outlineColor}, 
                          1px -1px 0 ${outlineColor}, -1px 1px 0 ${outlineColor},
                          0px 1px 0 ${outlineColor}, 0px -1px 0 ${outlineColor},
                          1px 0px 0 ${outlineColor}, -1px 0px 0 ${outlineColor},
                          2px 2px 2px rgba(0,0,0,0.3)
                        ` : '';

                        return (
                          <div 
                            key={idx}
                            className={`${styles.textOverlay} ${styles['overlay_' + (ov.font || 'classic')]} ${styles['bg_' + (ov.bgMode || 'none')]} ${styles['text_' + (ov.align || 'center')]}`}
                            style={{
                              left: `${ov.x}%`,
                              top: `${ov.y}%`,
                              transform: `translate(-50%, -50%) rotate(${ov.rotation || 0}deg) scale(${(ov.size || 30) / 30})`,
                              fontSize: `${ov.fontSize || 24}px`
                            }}
                            onMouseDown={(e) => {
                              const startX = e.clientX;
                              const startY = e.clientY;
                              const startPosX = ov.x;
                              const startPosY = ov.y;
                              const rect = e.currentTarget.parentElement.getBoundingClientRect();
                              
                              const onMouseMove = (moveE) => {
                                const deltaX = ((moveE.clientX - startX) / rect.width) * 100;
                                const deltaY = ((moveE.clientY - startY) / rect.height) * 100;
                                const nextImages = [...editingPack.images];
                                const nextOverlays = [...(nextImages[editorIdx].overlays || [])];
                                nextOverlays[idx] = {
                                  ...nextOverlays[idx],
                                  x: Math.max(0, Math.min(100, startPosX + deltaX)),
                                  y: Math.max(0, Math.min(100, startPosY + deltaY))
                                };
                                nextImages[editorIdx].overlays = nextOverlays;
                                setEditingPack(prev => ({ ...prev, images: nextImages }));
                              };
                              const onMouseUp = () => {
                                window.removeEventListener("mousemove", onMouseMove);
                                window.removeEventListener("mouseup", onMouseUp);
                                commitToHistory(editingPack);
                              };
                              window.addEventListener("mousemove", onMouseMove);
                              window.addEventListener("mouseup", onMouseUp);
                            }}
                          >
                            <div style={{ display: 'grid' }}>
                              {isSolid && (
                                <div style={{ gridArea: '1 / 1', zIndex: 0 }}>
                                  <span className={styles.textInner} style={{ color: 'transparent', backgroundColor: bgColor }}>
                                    {ov.text}
                                  </span>
                                </div>
                              )}
                              <div style={{ gridArea: '1 / 1', zIndex: 1 }}>
                                <span className={styles.textInner} style={{
                                  color: textColor || "white",
                                  backgroundColor: "transparent",
                                  textShadow: isOutline ? outlineShadow : undefined,
                                }}>
                                  {ov.text}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </>
                  ) : (
                    <div className={styles.emptyCanvas}>
                      <p>No image selected.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className={styles.editorSidebar}>
              <div className={styles.sidebarSection}>
                <div className={styles.sectionTitle}>Slide #{editorIdx + 1} Overlays</div>
                
                {editingPack.images[editorIdx]?.overlays?.map((ov, idx) => (
                  <div key={idx} className={styles.overlayItem}>
                    <button className={styles.removeOverlay} onClick={() => {
                      const nextImages = [...editingPack.images];
                      nextImages[editorIdx].overlays = nextImages[editorIdx].overlays.filter((_, i) => i !== idx);
                      commitToHistory({ ...editingPack, images: nextImages });
                    }}>✕</button>
                    <textarea 
                      className={styles.overlayTextarea}
                      value={ov.text}
                      onChange={(e) => {
                        const nextImages = [...editingPack.images];
                        nextImages[editorIdx].overlays[idx].text = e.target.value;
                        setEditingPack(prev => ({ ...prev, images: nextImages }));
                      }}
                      onBlur={() => commitToHistory(editingPack)}
                      placeholder="Type something..."
                    />
                    
                    <div className={styles.fontToggleGroup}>
                      {['classic', 'typewriter', 'serif', 'handwriting', 'neon'].map(f => (
                        <button 
                          key={f}
                          className={`${styles.styleBtn} ${ov.font === f || (!ov.font && f === 'classic') ? styles.styleBtnActive : ''}`}
                          onClick={() => {
                            const nextImages = [...editingPack.images];
                            nextImages[editorIdx].overlays[idx].font = f;
                            commitToHistory({ ...editingPack, images: nextImages });
                          }}
                        >
                          {f.toUpperCase()}
                        </button>
                      ))}
                    </div>

                    <div className={styles.alignToggleGroup}>
                      {['left', 'center', 'right'].map(a => (
                        <button 
                          key={a}
                          className={`${styles.alignBtn} ${ov.align === a || (!ov.align && a === 'center') ? styles.alignBtnActive : ''}`}
                          onClick={() => {
                            const nextImages = [...editingPack.images];
                            nextImages[editorIdx].overlays[idx].align = a;
                            commitToHistory({ ...editingPack, images: nextImages });
                          }}
                        >
                          {a === 'left' && (
                            <svg width="16" height="12" viewBox="0 0 16 12" fill="currentColor">
                              <rect width="16" height="2" rx="1"/>
                              <rect y="5" width="10" height="2" rx="1"/>
                              <rect y="10" width="16" height="2" rx="1"/>
                            </svg>
                          )}
                          {a === 'center' && (
                            <svg width="16" height="12" viewBox="0 0 16 12" fill="currentColor">
                              <rect x="0" width="16" height="2" rx="1"/>
                              <rect x="3" y="5" width="10" height="2" rx="1"/>
                              <rect x="0" y="10" width="16" height="2" rx="1"/>
                            </svg>
                          )}
                          {a === 'right' && (
                            <svg width="16" height="12" viewBox="0 0 16 12" fill="currentColor">
                              <rect width="16" height="2" rx="1"/>
                              <rect x="6" y="5" width="10" height="2" rx="1"/>
                              <rect width="16" height="2" rx="1" y="10"/>
                            </svg>
                          )}
                        </button>
                      ))}
                    </div>

                    <div className={styles.bgToggleGroup}>
                      {['none', 'solid', 'outline'].map(b => (
                        <button 
                          key={b}
                          className={`${styles.styleBtn} ${ov.bgMode === b || (!ov.bgMode && b === 'none') ? styles.styleBtnActive : ''}`}
                          onClick={() => {
                            const nextImages = [...editingPack.images];
                            nextImages[editorIdx].overlays[idx].bgMode = b;
                            commitToHistory({ ...editingPack, images: nextImages });
                          }}
                        >
                          {b === 'none' ? 'NO BG' : b.toUpperCase()}
                        </button>
                      ))}
                    </div>

                    <div className={styles.rangeRow}>
                      <div className={styles.rangeItem}>
                        <div className={styles.rangeLabel}>Scale</div>
                        <input 
                          type="range" min="10" max="100" step="1"
                          value={ov.size || 30}
                          onChange={(e) => {
                            const nextImages = [...editingPack.images];
                            nextImages[editorIdx].overlays[idx].size = parseInt(e.target.value);
                            setEditingPack(prev => ({ ...prev, images: nextImages }));
                          }}
                          onMouseUp={() => commitToHistory(editingPack)}
                        />
                      </div>
                      <div className={styles.rangeItem}>
                        <div className={styles.rangeLabel}>Font Size</div>
                        <input 
                          type="range" min="12" max="100" step="1"
                          value={ov.fontSize || 24}
                          onChange={(e) => {
                            const nextImages = [...editingPack.images];
                            nextImages[editorIdx].overlays[idx].fontSize = parseInt(e.target.value);
                            setEditingPack(prev => ({ ...prev, images: nextImages }));
                          }}
                          onMouseUp={() => commitToHistory(editingPack)}
                        />
                      </div>
                    </div>

                    <div className={styles.colorStrip}>
                      {["#ffffff", "#000000", "#ff3b5c", "#face15", "#2af0ea", "#00f2ea", "#ff0050"].map(c => (
                        <div 
                          key={c}
                          className={ov.color === c ? styles.colorCircleActive : styles.colorCircle}
                          style={{ backgroundColor: c }}
                          onClick={() => {
                            const nextImages = [...editingPack.images];
                            nextImages[editorIdx].overlays[idx].color = c;
                            commitToHistory({ ...editingPack, images: nextImages });
                          }}
                        />
                      ))}
                    </div>
                  </div>
                ))}
                
                <button className={styles.addTextBtn} onClick={() => {
                  const nextImages = [...editingPack.images];
                  const currentImg = nextImages[editorIdx];
                  if (!currentImg) {
                    alert("Please add an image first!");
                    return;
                  }
                  currentImg.overlays = [...(currentImg.overlays || []), { 
                    text: "NEW TEXT", x: 50, y: 50, size: 30, color: "#ffffff", 
                    font: 'classic', bgMode: 'none', align: 'center', rotation: 0 
                  }];
                  commitToHistory({...editingPack, images: nextImages});
                }}>
                  <span style={{ fontSize: '18px' }}>＋</span> Add Text Layer
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Past Carousels (for generator only) */}
      {view === "generator" && resultHistory.length > 0 && (
        <section className={styles.historySection}>
          <div className={styles.historyHeader}>
            <span className={styles.historyTitle}>Recent ({resultHistory.length})</span>
          </div>
          <div className={styles.historyStrip}>
            {resultHistory.map((item, i) => (
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

      {/* off-screen high-res render target for capturing image downloads */}
      {exportingPost && (
        <div style={{ 
          position: 'fixed', 
          top: '-10000px', 
          left: '-10000px', 
          pointerEvents: 'none', 
          zIndex: -9999,
          opacity: 1,
          visibility: 'visible',
          background: '#000'
        }}>
          <div id="export-surface" ref={exportRef} style={{ 
            width: '1080px', 
            height: exportingPost.aspectRatio === '1:1' ? '1080px' : exportingPost.aspectRatio === '3:4' ? '1440px' : '1920px', 
            position: 'relative',
            overflow: 'hidden',
            backgroundColor: '#000'
          }}>
            <img 
              src={exportingPost.image} 
              alt="Exporting" 
              style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
              crossOrigin="anonymous" 
            />
            <div className={styles.savedOverlay}>
              {exportingPost.overlays?.map((ov, idx) => {
                const isSolid = ov.bgMode === 'solid';
                const isOutline = ov.bgMode === 'outline';
                const selectedColor = ov.color || "#ffffff";
                const isLight = parseInt(selectedColor.replace('#',''), 16) > 0xffffff / 2;
                const bgColor = isSolid ? selectedColor : 'transparent';
                const textColor = isSolid ? (isLight ? '#000000' : '#ffffff') : selectedColor;
                const outlineColor = isLight ? '#000000' : '#ffffff';
                const outlineShadow = isOutline ? `
                  1px 1px 0 ${outlineColor}, -1px -1px 0 ${outlineColor}, 
                  1px -1px 0 ${outlineColor}, -1px 1px 0 ${outlineColor},
                  0px 1px 0 ${outlineColor}, 0px -1px 0 ${outlineColor},
                  1px 0px 0 ${outlineColor}, -1px 0px 0 ${outlineColor}
                ` : '';
                return (
                  <div key={idx} className={`${styles.textOverlay} ${styles['overlay_' + (ov.font || 'classic')]} ${styles['bg_' + (ov.bgMode || 'none')]} ${styles['text_' + (ov.align || 'center')]}`} style={{
                    position: "absolute",
                    left: `${ov.x}%`,
                    top: `${ov.y}%`,
                    transform: `translate(-50%, -50%) rotate(${ov.rotation || 0}deg) scale(${(ov.size || 30) / 30})`,
                    fontSize: `${ov.fontSize || 24}px`, // Standardizing to the exact same Surface coordinate system
                  }}>
                    <div style={{ display: 'grid' }}>
                      {isSolid && (
                        <div style={{ gridArea: '1 / 1', zIndex: 0 }}>
                          <span className={styles.textInner} style={{ color: 'transparent', backgroundColor: bgColor }}>
                            {ov.text}
                          </span>
                        </div>
                      )}
                      <div style={{ gridArea: '1 / 1', zIndex: 1 }}>
                        <span className={styles.textInner} style={{ color: textColor || "white", backgroundColor: "transparent", textShadow: isOutline ? outlineShadow : undefined }}>
                          {ov.text}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ═══ CONFIRMATION MODAL ═══ */}
      {confirmModal.show && (
        <div className={styles.modalOverlay}>
          <div className={styles.confirmModal}>
            <div className={styles.confirmTitle}>Unsaved Changes</div>
            <p className={styles.confirmText}>
              You have unsaved {view === "editor" ? "edits" : "generations"}. 
              Moving away will discard them. What would you like to do?
            </p>
            <div className={styles.confirmActions}>
              <button className={styles.confirmSaveBtn} onClick={() => {
                if (view === "editor") handleUpdatePack(editingPack);
                else if (result) handleSave(result);
                
                const { type, next } = confirmModal;
                if (type === "view") setView(next);
                else if (type === "mode") { setMode(next); handleStartFresh(); }
                else if (type === "fresh") handleStartFresh();
                
                setConfirmModal({ show: false, type: null, next: null });
              }}>
                Save & Continue
              </button>
              <button className={styles.confirmDiscardBtn} onClick={() => {
                const { type, next } = confirmModal;
                if (type === "view") setView(next);
                else if (type === "mode") { setMode(next); handleStartFresh(); }
                else if (type === "fresh") handleStartFresh();
                
                setConfirmModal({ show: false, type: null, next: null });
              }}>
                Discard
              </button>
              <button className={styles.confirmCancelBtn} onClick={() => {
                setConfirmModal({ show: false, type: null, next: null });
              }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
