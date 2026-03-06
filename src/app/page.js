"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { toPng, toBlob } from "html-to-image";
import Cropper from 'react-easy-crop';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import styles from "./page.module.css";
import * as Icons from "lucide-react";

/* ─── Icon Component ─────────────────────────────────────── */

const Icon = ({ name, size = 18, strokeWidth = 2, className, ...props }) => {
  const LucideIcon = Icons[name];
  if (!LucideIcon) return null;
  return <LucideIcon size={size} strokeWidth={strokeWidth} className={className} {...props} />;
};

/* ─── Mode Configs ───────────────────────────────────────── */

const MODES = [
  {
    id: "photodump",
    label: "Photo Dump",
    iconName: "Camera",
    iconColor: "#38bdf8", // Sky blue
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
    iconName: "Layers",
    iconColor: "#c084fc", // Purple
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
    iconName: "Package",
    iconColor: "#fbbf24", // Amber
    desc: "You + a product — organic influencer-style content",
    vibeLabel: "Describe your product",
    vibeHint: "What is the product, what does it do, who is it for?",
    placeholder: "Derma Co 5% Vitamin C Serum — brightens dull skin, reduces dark spots, lightweight gel texture. For people struggling with uneven skin tone...",
    vibes: [],
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

  // Ad category
  const [adCategory, setAdCategory] = useState("beauty");

  // Orientation
  const [genAspectRatio, setGenAspectRatio] = useState("9:16");

  // Vibe input
  const [vibe, setVibe] = useState("");

  // Planning
  const [planning, setPlanning] = useState(false);
  const [plannedScenes, setPlannedScenes] = useState(null);
  const [plannedStyling, setPlannedStyling] = useState(null);
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
  const [isBatchExporting, setIsBatchExporting] = useState(false);

  // Projects
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState("new");
  const [newProjectName, setNewProjectName] = useState("");
  const [libraryMode, setLibraryMode] = useState("projects"); // "projects" or "packs"
  const [libraryProjectId, setLibraryProjectId] = useState(null);

  // Undo/Redo (Editor specific)
  const [editorHistory, setEditorHistory] = useState([]);
  const [editorHistoryIdx, setEditorHistoryIdx] = useState(-1);

  // Unsaved changes confirmation
  const [confirmModal, setConfirmModal] = useState({ 
    show: false, 
    type: null, // "view", "mode", "fresh"
    next: null 
  });

  const [downloadChoicePack, setDownloadChoicePack] = useState(null);
  const [isCropping, setIsCropping] = useState(false);
  const [activeOverlayIdx, setActiveOverlayIdx] = useState(null);
  const [isQuickEditing, setIsQuickEditing] = useState(false);
  const [activeQuickTool, setActiveQuickTool] = useState('fonts'); // 'fonts' or 'colors'
  const [isMobile, setIsMobile] = useState(false);
  const quickEditRef = useRef(null);
  const canvasContainerRef = useRef(null);
  const [canvasDisplayWidth, setCanvasDisplayWidth] = useState(0);
  const mobileAddInputRef = useRef(null); // hidden file input for mobile toolbar Add button
  const [dragLock, setDragLock] = useState({ idx: null, width: null }); // Locks width during drag to prevent reflow

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 1024);
    checkMobile();
    window.addEventListener('resize', checkMobile);

    const preventPinch = (e) => {
      if (e.touches.length > 1) e.preventDefault();
    };
    document.addEventListener('touchstart', preventPinch, { passive: false });

    // Load projects
    try {
      const p = localStorage.getItem("ugc_factory_projects");
      if (p) setProjects(JSON.parse(p));
    } catch(e){}

    return () => {
      window.removeEventListener('resize', checkMobile);
      document.removeEventListener('touchstart', preventPinch);
    };
  }, []);

  useEffect(() => {
    if (isQuickEditing && quickEditRef.current) {
      document.body.classList.add(styles.fixedBody);
      // Seed the contentEditable with current text and move cursor to end
      const el = quickEditRef.current;
      setTimeout(() => {
        if (!el) return;
        const text = editingPack?.images[editorIdx]?.overlays[activeOverlayIdx]?.text || '';
        // Only set if empty or different (avoids cursor jump on re-renders)
        if (el.innerText !== text) {
          el.innerText = text;
        }
        el.focus();
        // Move cursor to end
        const range = document.createRange();
        const sel = window.getSelection();
        range.selectNodeContents(el);
        range.collapse(false);
        sel.removeAllRanges();
        sel.addRange(range);
      }, 50);
    } else {
      document.body.classList.remove(styles.fixedBody);
      // Reset Safari/Chrome iOS scroll/zoom bug when closing keyboard or editor
      if (typeof window !== 'undefined') {
        window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
        // Double down for older browsers
        document.body.scrollTop = 0;
        document.documentElement.scrollTop = 0;
      }
    }
    return () => { document.body.classList.remove(styles.fixedBody); };
  }, [isQuickEditing]);

  // Live-track the canvas container width so the immersive text preview
  // always wraps at the exact same breakpoints as the real overlay.
  useEffect(() => {
    const el = canvasContainerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        // contentBoxSize gives the inner size (excluding border)
        const w = entry.contentBoxSize
          ? entry.contentBoxSize[0]?.inlineSize
          : entry.contentRect.width;
        if (w > 0) setCanvasDisplayWidth(w);
      }
    });
    observer.observe(el);
    // seed immediately in case ResizeObserver fires late
    setCanvasDisplayWidth(el.offsetWidth);
    return () => observer.disconnect();
  }, [canvasContainerRef.current]);

  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);

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
    setPlannedStyling(null);
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
    if (!vibe.trim() || planning || generating) return;
    
    // Auto-save project if new
    let finalProjectId = selectedProjectId;
    if (selectedProjectId === "new" && newProjectName.trim()) {
      const newProj = { id: `proj_${Date.now()}`, name: newProjectName.trim(), description: vibe.trim() };
      setProjects(prev => {
        const next = [...prev, newProj];
        localStorage.setItem("ugc_factory_projects", JSON.stringify(next));
        return next;
      });
      finalProjectId = newProj.id;
      setSelectedProjectId(newProj.id);
      setNewProjectName("");
    }
    
    setPlanning(true);
    setError(null);
    setPlannedScenes(null);
    setPlannedStyling(null);
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
          category: mode === "ad" ? adCategory : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Planning failed");

      const scenes = data.scenes;
      const styling = data.styling || null;
      setPlannedScenes(scenes);
      setPlannedStyling(styling);

      // Auto-generate immediately with all scenes
      setPlanning(false);
      setGenerating(true);
      setSelectedIdx(0);
      
      // Give React a frame to paint the "Generating" UI before the next await
      await new Promise(resolve => setTimeout(resolve, 50));

      const genRes = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenes,
          mode,
          avatar: avatar ? { base64: avatar.base64, mimeType: avatar.mimeType } : undefined,
          productImage:
            mode === "ad" && productImage
              ? { base64: productImage.base64, mimeType: productImage.mimeType }
              : undefined,
          aspectRatio: genAspectRatio,
          styling: styling || undefined,
        }),
      });

      const genData = await genRes.json();
      if (!genRes.ok) throw new Error(genData.error || "Generation failed");

      const newResult = { images: genData.images, timestamp: Date.now(), vibe, mode, aspectRatio: genAspectRatio };
      setResult(newResult);
      setResultHistory((prev) => [newResult, ...prev].slice(0, 20));
    } catch (e) {
      setError(e.message);
    } finally {
      setPlanning(false);
      setGenerating(false);
    }
  }, [vibe, mode, avatar, productImage, planning, generating, adCategory, genAspectRatio]);

  // ──── Download ────
  // ──── Batch Export Logic ────
  useEffect(() => {
    if (exportQueue.length > 0 && !exportingPost && !isExporting) {
      // If we are batch exporting (more than 1 image), we append to a zip
      // We'll handle zipping logic in a more structured way
    }
  }, [exportQueue, exportingPost, isExporting]);

  // Enhanced Batch Export with Zipping
  const handleExportPack = useCallback(async (pack, options = {}) => {
    if (!pack?.images) return;
    const { skipOverlays = false } = options;
    const imagesToExport = pack.images.map(img => ({ 
      ...img, 
      aspectRatio: pack.aspectRatio,
      overlays: skipOverlays ? [] : img.overlays 
    }));

    if (imagesToExport.length === 1) {
      setIsBatchExporting(false);
      setExportingPost(imagesToExport[0]);
    } else {
      setIsBatchExporting(true);
      setIsExporting(true);
      const zip = new JSZip();
      
      for (let i = 0; i < imagesToExport.length; i++) {
        const post = imagesToExport[i];
        setExportingPost(post);
        
        const blob = await new Promise((resolve) => {
          setTimeout(async () => {
            try {
              const el = exportRef.current;
              if (!el) return resolve(null);
              await toBlob(el, { pixelRatio: 1 });
              const result = await toBlob(el, {
                quality: 1.0, pixelRatio: 1, cacheBust: true,
                style: { transform: 'none', visibility: 'visible', opacity: '1' }
              });
              resolve(result);
            } catch (e) { console.error(e); resolve(null); }
          }, 1500);
        });

        if (blob) {
          zip.file(`image_${i + 1}.png`, blob);
        }
      }

      const content = await zip.generateAsync({ type: "blob" });
      saveAs(content, `ugcfactory_pack_${Date.now()}.zip`);
      
      setIsBatchExporting(false);
      setIsExporting(false);
      setExportingPost(null);
    }
  }, []);

  const handleDownloadAll = useCallback(() => {
    if (!result?.images) return;
    handleExportPack(result, { skipOverlays: true });
  }, [result, handleExportPack]);

  useEffect(() => {
    if (exportingPost && exportRef.current && !isBatchExporting) {
      setIsExporting(true);
      const capture = async () => {
        try {
          const el = exportRef.current;
          // Safari Hack: Call twice
          await toBlob(el, { pixelRatio: 1 }); 
          
          const blob = await toBlob(el, { 
            quality: 1.0, 
            pixelRatio: 1,
            cacheBust: true,
            style: { transform: 'none', visibility: 'visible', opacity: '1' }
          });

          if (!blob) throw new Error("Blob generation failed");
          saveAs(blob, `ugcfactory_${Date.now()}.png`);
        } catch (err) {
          console.error("Failed image capture:", err);
        } finally {
          setIsExporting(false);
          setExportingPost(null);
        }
      };
      setTimeout(capture, 1500);
    }
  }, [exportingPost, isBatchExporting]);

  // ──── Save Pack ────
  const handleSave = useCallback((result) => {
    if (!result?.images) return;
    const newPack = {
      id: `pack_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      projectId: selectedProjectId !== "new" ? selectedProjectId : undefined,
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
    setLibraryMode("packs");
    setLibraryProjectId(selectedProjectId !== "new" ? selectedProjectId : null);
  }, [selectedProjectId]);

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

  // Placeholder removed as logic merged into handleExportPack above

  // ──── Delete Project ────
  const handleDeleteProject = useCallback((projId) => {
    if (!window.confirm("Delete this project? Its packs will move to Uncategorized.")) return;
    setProjects(prev => {
      const next = prev.filter(p => p.id !== projId);
      localStorage.setItem("ugc_factory_projects", JSON.stringify(next));
      return next;
    });
    setPacks(prev => prev.map(p => p.projectId === projId ? { ...p, projectId: undefined } : p));
    if (selectedProjectId === projId) setSelectedProjectId("new");
    if (libraryProjectId === projId) { setLibraryMode("projects"); setLibraryProjectId(null); }
  }, [selectedProjectId, libraryProjectId]);

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
          <div className={styles.logoIcon}>
            <Icon name="Clapperboard" size={20} strokeWidth={2.5} color="var(--amber-on)" />
          </div>
          <div className={styles.logoText}>
            AI UGC <span>Factory</span>
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
                  <div className={styles.modeIcon}>
                    <Icon 
                      name={m.iconName} 
                      size={24} 
                      strokeWidth={2} 
                      color={mode === m.id ? m.iconColor : "var(--text-3)"} 
                    />
                  </div>
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
                    <div className={styles.avatarEmpty}>
                      <Icon name="User" size={24} strokeWidth={1.5} />
                    </div>
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
                      <div className={styles.avatarEmpty}>
                        <Icon name="Package" size={24} strokeWidth={1.5} />
                      </div>
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
                
                {mode === "ad" && (
                  <div className={styles.projectSelector} style={{ marginLeft: "3.5rem", marginBottom: "1rem" }}>
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                      <select 
                        value={selectedProjectId}
                        onChange={(e) => {
                          const val = e.target.value;
                          setSelectedProjectId(val);
                          if (val !== "new") {
                            const p = projects.find(p => p.id === val);
                            if (p) setVibe(p.description);
                          } else {
                            setVibe("");
                          }
                        }}
                        style={{
                          padding: '12px', borderRadius: '8px',
                          border: '1px solid #333', background: '#111',
                          color: '#fff', width: '100%', fontSize: '0.9rem'
                        }}
                      >
                        <option value="new">+ Create New Project</option>
                        {projects.map(p => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    </div>

                    {selectedProjectId === "new" && (
                      <input
                        type="text"
                        placeholder="Project Name (e.g., Gutbuddy)"
                        value={newProjectName}
                        onChange={(e) => setNewProjectName(e.target.value)}
                        style={{
                          padding: '12px', borderRadius: '8px',
                          border: '1px solid #333', background: '#111',
                          color: '#fff', width: '100%',
                          marginBottom: '12px', fontSize: '0.9rem'
                        }}
                      />
                    )}
                    {selectedProjectId !== "new" && (
                      <button
                        onClick={() => {
                          setProjects(prev => {
                            const next = prev.map(p => p.id === selectedProjectId ? { ...p, description: vibe.trim() } : p);
                            localStorage.setItem("ugc_factory_projects", JSON.stringify(next));
                            return next;
                          });
                          alert("Project description saved!");
                        }}
                        style={{
                          padding: '7px 14px', borderRadius: '8px',
                          border: '1px solid #444', background: '#1a1a1a',
                          color: '#aaa', cursor: 'pointer', fontSize: '0.8rem', marginBottom: '8px',
                        }}
                      >
                        💾 Update Project Description
                      </button>
                    )}
                  </div>
                )}

                <div className={styles.vibeBox}>
                  <textarea
                    className={styles.vibeTextarea}
                    placeholder={mode === "ad"
                      ? (selectedProjectId === "new" ? "Describe your product/app in detail..." : "Project Description")
                      : (currentMode?.placeholder || "Describe the vibe...")}
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
            </>
          )}

          {/* ═══ Plan Button & Loading (Always visible during generation) ═══ */}
          {!result && (
            <>
              <section className={styles.generateSection}>
                <button
                  className={styles.generateBtn}
                  onClick={handlePlan}
                  disabled={!vibe.trim() || planning || generating}
                >
                  {(planning || generating) ? (
                    <><span className={styles.spinner} /> {planning ? "Planning…" : "Generating…"}</>
                  ) : (
                    <><Icon name="Sparkles" size={18} color="#000000" /> Generate Carousel</>
                  )}
                </button>
              </section>

              {/* Error */}
              {error && <div className={styles.error}><Icon name="AlertTriangle" size={16} /> {error}</div>}

              {/* Loading */}
              {(planning || generating) && (
                <div className={styles.loadingResult}>
                  <div className={styles.loadingLens} />
                  <div className={styles.loadingText}>
                    {planning ? "Planning your scenes…" : `Generating your ${currentMode?.label.toLowerCase()}…`}
                  </div>
                  <div className={styles.loadingSubtext}>
                    {planning ? "AI is crafting the perfect story" : `${avatar ? "Character-consistent " : ""}images + captions`}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Review step removed — plan flows directly to generate */}



          {/* ═══ Carousel Result ═══ */}
          {result && !generating && (
            <section className={styles.carouselSection}>
              <div className={styles.carouselLabel}>
                <Icon name="CircleDot" size={12} className={styles.liveIndicator} /> Your {currentMode?.label.toLowerCase()} — {result.images.length} images
              </div>

              <div className={styles.carouselTrack}>
                {result.images.map((item, i) => (
                  <div
                    key={item.timestamp}
                    className={styles.carouselSlide}
                    style={{ position: 'relative' }}
                  >
                    <img src={item.image} alt={`Image ${i + 1}`} />
                    <div className={styles.carouselSlideInfo}>
                      <div className={styles.carouselSlideIndex}>#{i + 1}</div>
                      <div className={styles.carouselSlideScene}>
                        {item.caption || "—"}
                      </div>
                    </div>
                    <div style={{
                      position: 'absolute', top: '8px', right: '8px',
                      display: 'flex', gap: '4px',
                    }}>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDownloadTrigger(item); }}
                        style={{
                          background: 'rgba(0,0,0,0.7)', border: '1px solid rgba(255,255,255,0.2)',
                          color: '#fff', borderRadius: '6px', padding: '6px',
                          fontSize: '0.7rem', cursor: 'pointer', backdropFilter: 'blur(4px)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}
                      >
                        <Icon name="Download" size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className={styles.genActions} style={{ marginTop: '1rem' }}>
                <button className={styles.downloadAllBtn} onClick={handleDownloadAll}>
                  <Icon name="Download" size={16} color="#000000" /> Download All {result.images.length}
                </button>
                {packs.some(p => p.images.length > 0 && p.images[0].image === result.images[0].image) ? (
                  <button className={styles.saveLibraryBtn} disabled style={{ opacity: 0.6, cursor: 'default' }}>
                    <Icon name="Heart" size={16} fill="#f43f5e" color="#f43f5e" /> Saved
                  </button>
                ) : (
                  <button className={styles.saveLibraryBtn} onClick={() => handleSave(result)}>
                    <Icon name="Heart" size={16} color="#f43f5e" /> Save to Library
                  </button>
                )}
                <button className={styles.newGenBtn} onClick={requestFreshStart}>
                  <Icon name="RotateCcw" size={16} color="#a1a1aa" /> Start Fresh
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
            <div className={styles.stepLabel} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {libraryMode === 'packs' && (
                <button
                  onClick={() => { setLibraryMode('projects'); setLibraryProjectId(null); }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    background: '#1a1a1a',
                    border: '1px solid #333',
                    borderRadius: '8px',
                    color: '#ccc',
                    cursor: 'pointer',
                    padding: '6px 14px',
                    fontSize: '0.85rem',
                    marginRight: '8px',
                    transition: 'all 0.2s',
                  }}
                >
                  <Icon name="ChevronLeft" size={14} /> Back
                </button>
              )}
              <div className={styles.stepNumber}>
                {libraryMode === 'packs'
                  ? <Icon name="Folder" size={12} fill={libraryProjectId ? "#fbbf24" : "#888"} color={libraryProjectId ? "#fbbf24" : "#888"} />
                  : <Icon name="Folder" size={12} fill="#fbbf24" color="#fbbf24" />}
              </div>
              <div className={styles.stepTitle}>
                {libraryMode === 'packs'
                  ? (libraryProjectId ? (projects.find(p => p.id === libraryProjectId)?.name || 'Project Packs') : 'Uncategorized Packs')
                  : 'Your Projects'}
              </div>
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
            }}>
              <Icon name="Plus" size={16} /> New Pack
            </button>
          </div>
          
          {libraryMode === "projects" ? (
             <div className={styles.savedGrid}>
                {/* Uncategorized Folder */}
                <div 
                  className={styles.savedCard} 
                  onClick={() => { setLibraryMode('packs'); setLibraryProjectId(null); }} 
                  style={{ cursor: 'pointer', background: '#111', border: '1px solid #333', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '160px', borderRadius: '12px' }}
                >
                    <Icon name="Folder" size={48} strokeWidth={1} color="#888" />
                    <div style={{ marginTop: '12px', fontWeight: 'bold' }}>Uncategorized</div>
                    <div style={{ opacity: 0.6, fontSize: '0.8rem' }}>{packs.filter(p=>!p.projectId).length} Packs</div>
                </div>
                {/* Project Folders */}
                {projects.map(proj => (
                  <div 
                    key={proj.id} 
                    className={styles.savedCard}
                    style={{ position: 'relative', cursor: 'pointer', background: '#111', border: '1px solid #333', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '160px', borderRadius: '12px' }}
                  >
                    <div 
                      onClick={() => { setLibraryMode('packs'); setLibraryProjectId(proj.id); }}
                      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, width: '100%', padding: '16px' }}
                    >
                      <Icon name="Folder" size={48} strokeWidth={1} color="#fbbf24" fill="#fbbf24" />
                      <div style={{ marginTop: '12px', fontWeight: 'bold', textAlign: 'center' }}>{proj.name}</div>
                      <div style={{ opacity: 0.6, fontSize: '0.8rem' }}>{packs.filter(p=>p.projectId === proj.id).length} Packs</div>
                      {proj.description && (
                        <div style={{ opacity: 0.45, fontSize: '0.72rem', marginTop: '6px', textAlign: 'center', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{proj.description}</div>
                      )}
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteProject(proj.id); }}
                      style={{
                        position: 'absolute', top: '8px', right: '8px',
                        background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)',
                        borderRadius: '6px', color: '#ef4444', cursor: 'pointer',
                        padding: '4px 8px', fontSize: '0.75rem', lineHeight: 1
                      }}
                    >
                      ✕
                    </button>
                  </div>
                ))}
             </div>
          ) : (
            packs.filter(p => p.projectId === libraryProjectId || (!p.projectId && libraryProjectId === null)).length === 0 ? (
              <div className={styles.emptyState}>
                <div className={styles.emptyIcon}>
                  <Icon name="FolderOpen" size={48} strokeWidth={1} />
                </div>
                <div className={styles.emptyTitle}>Nothing saved yet</div>
                <div className={styles.emptyDesc}>
                  Generate some images or create a new pack to see them here.
                </div>
              </div>
            ) : (
              <div className={styles.savedGrid}>
                {packs.filter(p => p.projectId === libraryProjectId || (!p.projectId && libraryProjectId === null)).map((pack) => (
                <div key={pack.id} className={styles.savedCard}>
                  <div className={styles.savedImageWrapper} style={{ 
                    aspectRatio: pack.aspectRatio ? pack.aspectRatio.replace(':', '/') : '9/16',
                    width: '100%'
                  }}>
                    {pack.images.length > 0 && (
                      <img src={pack.images[0].image} alt="Pack cover" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    )}
                    <div className={styles.savedOverlay}>
                      {pack.images[0]?.overlays?.map((ov, idx) => {
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

                        // Use cqw (container query width) for text scaling
                        const scaleRatio = (ov.size || 30) / 30;
                        const fontCqw = ((ov.fontSize || 24) / 540) * 100;
                        
                        return (
                          <div key={idx} className={`${styles.textOverlay} ${styles['overlay_' + (ov.font || 'classic')]} ${styles['bg_' + (ov.bgMode || 'none')]} ${styles['text_' + (ov.align || 'center')]}`} style={{
                            position: "absolute",
                            left: `${ov.x}%`,
                            top: `${ov.y}%`,
                            transform: `translate(-50%, -50%) rotate(${ov.rotation || 0}deg) scale(${scaleRatio})`,
                            fontSize: `${fontCqw}cqw`,
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
                              bgMode: "none",
                              rotation: 0,
                              size: 30
                            }] : []
                          }))
                        };
                      }
                      setEditingPack(packToEdit);
                      setEditorIdx(0);
                      requestViewChange("editor");
                    }}>
                      <Icon name="Pencil" size={14} />
                    </button>
                    <button className={styles.savedActionBtn} onClick={() => setDownloadChoicePack(pack)}>
                      <Icon name="Download" size={14} />
                    </button>
                    <button className={styles.savedActionBtn} style={{ background: "rgba(239, 68, 68, 0.6)" }} onClick={() => handleRemovePack(pack.id)}>
                      <Icon name="X" size={14} />
                    </button>
                  </div>
                  <div className={styles.savedCardInfo}>
                    <div className={styles.savedCardCaption}>{pack.title}</div>
                    <div className={styles.savedCardMeta}>{pack.images.length} Images • {pack.aspectRatio}</div>
                  </div>
                </div>
              ))}
            </div>
            )
          )}
        </section>
      )}

      {/* ═══ FULL PAGE EDITOR VIEW ═══ */}
      {view === "editor" && editingPack && (
        <section className={`${styles.editorView} ${isQuickEditing ? styles.isFocused : ''}`}>
          <div className={styles.editorHeader}>
            <div className={styles.editorHeaderLeft}>
              <button className={styles.editorBackBtn} onClick={() => requestViewChange("library")}>
                <Icon name="ChevronLeft" size={16} /> Library
              </button>
              <div className={styles.editorTitle}>{editingPack.title}</div>
              <div className={styles.editorHistoryCtrls}>
                <button 
                  className={styles.historyBtn} 
                  onClick={handleUndo} 
                  disabled={editorHistoryIdx <= 0}
                  title="Undo (⌘Z)"
                >
                  <Icon name="Undo2" size={16} color={editorHistoryIdx > 0 ? "#60a5fa" : "var(--text-3)"} />
                </button>
                <button 
                  className={styles.historyBtn} 
                  onClick={handleRedo} 
                  disabled={editorHistoryIdx >= editorHistory.length - 1}
                  title="Redo (⌘⇧Z)"
                >
                  <Icon name="Redo2" size={16} color={editorHistoryIdx < editorHistory.length - 1 ? "#60a5fa" : "var(--text-3)"} />
                </button>
              </div>
            </div>
            <div className={styles.editorControls}>
              <select 
                value={editingPack.aspectRatio || "9:16"} 
                onChange={(e) => {
                  const nextPack = {...editingPack, aspectRatio: e.target.value};
                  commitToHistory(nextPack);
                }}
                className={styles.ratioSelect}
              >
                <option value="9:16">9:16</option>
                <option value="3:4">3:4</option>
              </select>

              <button className={styles.editorExportBtn} onClick={() => {
                handleExportPack(editingPack);
              }}>
                <Icon name="Download" size={16} color="var(--amber-50)" /> {exportQueue.length > 0 ? `Exporting (${exportQueue.length})` : 'Export Pack'}
              </button>
            </div>
          </div>

          <div className={`${styles.editorMain} ${isQuickEditing ? styles.editorMainFocused : ''}`}>
            {/* ═══ Left Sidebar (Asset Management) ═══ */}
            <div className={styles.editorAssetPanel}>
              <div className={styles.sectionTitle}>Assets</div>
              <div className={styles.thumbnailStrip}>
                {editingPack.images.map((img, i) => (
                  <div 
                    key={i} 
                    className={editorIdx === i ? styles.thumbItemActive : styles.thumbItem}
                    style={{ position: 'relative' }}
                    onClick={() => setEditorIdx(i)}
                  >
                    <img src={img.image} alt={`Slide ${i+1}`} />
                    {/* Per-slide action buttons */}
                    <div style={{
                      position: 'absolute', bottom: 0, left: 0, right: 0,
                      display: 'flex', gap: '2px', padding: '3px',
                      background: 'rgba(0,0,0,0.65)',
                      opacity: editorIdx === i ? 1 : 0,
                      transition: 'opacity 0.15s',
                    }}
                    className={styles.thumbActions}
                    >
                      {/* Replace */}
                      <label title="Replace Image" style={{ flex: 1, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '3px', borderRadius: '4px', background: 'rgba(255,255,255,0.1)' }} onClick={e => e.stopPropagation()}>
                        <Icon name="RefreshCw" size={11} color="#fff" />
                        <input type="file" hidden accept="image/*" onChange={(e) => {
                          const file = e.target.files[0];
                          if (!file) return;
                          const reader = new FileReader();
                          reader.onload = () => {
                            const nextImages = editingPack.images.map((im, idx) =>
                              idx === i ? { ...im, image: reader.result } : im
                            );
                            commitToHistory({ ...editingPack, images: nextImages });
                          };
                          reader.readAsDataURL(file);
                        }} />
                      </label>
                      {/* Delete */}
                      <button title="Delete Slide" onClick={(e) => {
                        e.stopPropagation();
                        if (editingPack.images.length === 1) return;
                        if (!window.confirm("Remove this slide?")) return;
                        const nextImages = editingPack.images.filter((_, idx) => idx !== i);
                        commitToHistory({ ...editingPack, images: nextImages });
                        setEditorIdx(prev => Math.min(prev, nextImages.length - 1));
                      }} style={{ flex: 1, background: 'rgba(239,68,68,0.7)', border: 'none', borderRadius: '4px', cursor: 'pointer', padding: '3px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Icon name="X" size={11} color="#fff" />
                      </button>
                    </div>
                  </div>
                ))}
                <label className={styles.addThumbBtn}>
                  <Icon name="Plus" size={20} strokeWidth={2.5} color="#fbbf24" />
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
              <div className={styles.editorStage}>
              {editingPack.images.length > 1 && (
                <>
                  <button 
                    className={styles.navArrowLeft} 
                    onClick={() => setEditorIdx(prev => prev > 0 ? prev - 1 : editingPack.images.length - 1)}
                  >
                    <Icon name="ChevronLeft" size={24} />
                  </button>
                  <button 
                    className={styles.navArrowRight} 
                    onClick={() => setEditorIdx(prev => (prev + 1) % editingPack.images.length)}
                  >
                    <Icon name="ChevronRight" size={24} />
                  </button>
                </>
              )}

              <div 
                key={`${editorIdx}_${editingPack.aspectRatio}`}
                className={styles.canvasFrame} 
                style={{ 
                  aspectRatio: (editingPack.aspectRatio || "9:16").replace(':', '/'),
                  height: '100%',
                  maxWidth: '100%',
                  margin: '0 auto',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <div className={styles.canvasWrapperContainer} ref={canvasContainerRef}>
                  {editingPack.images[editorIdx] ? (
                    <>
                      {isCropping ? (
                        <div className={styles.cropperContainer}>
                          <Cropper
                            image={editingPack.images[editorIdx].image}
                            crop={crop}
                            zoom={zoom}
                            aspect={(editingPack.aspectRatio || "9:16") === '3:4' ? 0.75 : 0.5625}
                            onCropChange={setCrop}
                            onZoomChange={setZoom}
                            onCropComplete={(croppedArea, croppedAreaPixels) => {
                              // We'll store the results in a ref or local state to apply on "Save"
                              editingPack.images[editorIdx]._tempCrop = croppedArea;
                            }}
                          />
                        </div>
                      ) : (
                        <>
                          <div 
                            className={`${styles.imageCanvasLayer} ${isQuickEditing ? styles.imageCanvasLayerFocused : ''}`}
                            style={{
                              width: '100%',
                              height: '100%',
                              overflow: 'hidden',
                              position: 'relative'
                            }}
                          >
                            <img 
                              src={editingPack.images[editorIdx].image} 
                              alt="Editing" 
                              style={{ 
                                width: '100%', 
                                height: '100%', 
                                objectFit: 'cover',
                                objectPosition: `${editingPack.images[editorIdx].offsetX ?? 50}% ${editingPack.images[editorIdx].offsetY ?? 50}%`,
                                transform: `scale(${editingPack.images[editorIdx].zoom ?? 1})`,
                                cursor: 'default',
                                touchAction: 'none'
                              }} 
                            />
                          </div>
                          {editingPack.images[editorIdx].overlays?.map((ov, hideIdx) => {
                            if (isQuickEditing) return null; // Hide all overlays from image while editing one in full screen
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
                              0.04em 0.04em 0.04em rgba(0,0,0,0.3)
                            ` : '';
                            
                            // Responsive text scaling
                            const scaleRatio = (ov.size || 30) / 30;
                            const fontCqw = ((ov.fontSize || 24) / 540) * 100;

                            return (
                              <div 
                                key={hideIdx}
                                className={`${styles.textOverlay} ${styles['overlay_' + (ov.font || 'classic')]} ${styles['bg_' + (ov.bgMode || 'none')]} ${styles['text_' + (ov.align || 'center')]}`}
                                style={{
                                  left: `${ov.x}%`,
                                  top: `${ov.y}%`,
                                  transform: `translate(-50%, -50%) rotate(${ov.rotation || 0}deg) scale(${scaleRatio})`,
                                  fontSize: `${fontCqw}cqw`,
                                  touchAction: 'none',
                                  pointerEvents: 'auto',
                                  opacity: 1,
                                  willChange: 'transform', // GPU layer prevents reflow on drag
                                  width: dragLock.idx === hideIdx ? `${dragLock.width}px` : undefined,
                                  maxWidth: dragLock.idx === hideIdx ? 'none' : undefined,
                                  whiteSpace: 'pre-wrap', 
                                }}
                                 onPointerDown={(e) => {
                                   const el = e.currentTarget;
                                   const selfRect = el.getBoundingClientRect();
                                   // Use BCR / scale to get exact sub-pixel layout width
                                   const scale = (ov.size || 30) / 30;
                                   const widthPx = selfRect.width / (scale || 1);
                                   setDragLock({ idx: hideIdx, width: widthPx });

                                   const startX = e.clientX;
                                   const startY = e.clientY;
                                   const startPosX = ov.x;
                                   const startPosY = ov.y;
                                   const parentRect = el.parentElement.getBoundingClientRect();
                                   
                                   let latestPack = editingPack;
                                   let hasMoved = false;
                                   
                                   const onPointerMove = (moveE) => {
                                     moveE.preventDefault();
                                     const deltaX = ((moveE.clientX - startX) / parentRect.width) * 100;
                                     const deltaY = ((moveE.clientY - startY) / parentRect.height) * 100;
                                
                                if (Math.abs(deltaX) > 0.5 || Math.abs(deltaY) > 0.5) {
                                  hasMoved = true;
                                }
 
                                if (hasMoved) {
                                  const nextImages = [...editingPack.images];
                                  const nextOverlays = [...(nextImages[editorIdx].overlays || [])];
                                  nextOverlays[hideIdx] = {
                                    ...nextOverlays[hideIdx],
                                    x: Math.max(0, Math.min(100, startPosX + deltaX)),
                                    y: Math.max(0, Math.min(100, startPosY + deltaY))
                                  };
                                  nextImages[editorIdx].overlays = nextOverlays;
                                  latestPack = { ...editingPack, images: nextImages };
                                  setEditingPack(latestPack);
                                }
                              };
                              const onPointerUp = () => {
                                setDragLock({ idx: null, width: null });

                                window.removeEventListener("pointermove", onPointerMove);
                                window.removeEventListener("pointerup", onPointerUp);
                                window.removeEventListener("pointercancel", onPointerUp);
                                if (!hasMoved) {
                                  setActiveOverlayIdx(hideIdx);
                                  if (isMobile) {
                                    setIsQuickEditing(true);
                                  }
                                } else {
                                  commitToHistory(latestPack);
                                }
                              };
                              window.addEventListener("pointermove", onPointerMove, { passive: false });
                              window.addEventListener("pointerup", onPointerUp);
                              window.addEventListener("pointercancel", onPointerUp);
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
                                      {ov.text.split(/(\p{Emoji_Presentation}|\p{Emoji}\uFE0F)/gu).map((part, i) => (
                                        /(\p{Emoji_Presentation}|\p{Emoji}\uFE0F)/u.test(part) 
                                          ? <span key={i} style={{ textShadow: 'none', background: 'none' }}>{part}</span>
                                          : part
                                      ))}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </>
                      )}
                    </>
                  ) : (
                    <div className={styles.emptyCanvas}>
                      <p>No image selected.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Permanent Mobile Bottom Toolbar */}
            <div className={styles.mobileToolbarContainer}>
              {/* Hidden file input for the Add Image button */}
              <input
                ref={mobileAddInputRef}
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
                    e.target.value = '';
                  };
                  reader.readAsDataURL(file);
                }}
              />
              {!isCropping ? (
                <div className={styles.mobileToolbarContent}>
                  <button className={styles.actionIconBtn} onClick={() => {
                    const nextImages = [...editingPack.images];
                    const currentImg = nextImages[editorIdx];
                    currentImg.overlays = [...(currentImg.overlays || []), { 
                      text: "NEW TEXT", x: 50, y: 50, size: 30, color: "#ffffff", 
                      font: 'classic', bgMode: 'none', align: 'center', rotation: 0 
                    }];
                    commitToHistory({...editingPack, images: nextImages});
                    setActiveOverlayIdx(currentImg.overlays.length - 1);
                    setIsQuickEditing(true);
                  }}>
                    <Icon name="Type" size={20} color="#fbbf24" />
                    <span>Text</span>
                  </button>
                  <button className={styles.actionIconBtn} onClick={() => setIsCropping(true)}>
                    <Icon name="Crop" size={20} color="#60a5fa" />
                    <span>Crop</span>
                  </button>
                  {/* Add Image — replaces Next (nav arrows handle slide navigation) */}
                  <button className={styles.actionIconBtn} onClick={() => mobileAddInputRef.current?.click()}>
                    <Icon name="ImagePlus" size={20} color="#34d399" />
                    <span>Add</span>
                  </button>
                </div>
              ) : (
                <div className={styles.mobileCropToolbar}>
                  <div className={styles.mobileRangeRow}>
                    <span style={{ fontSize: '10px', color: '#888' }}>ZOOM</span>
                    <input 
                      type="range" min="1" max="3" step="0.01" 
                      value={zoom} 
                      onChange={(e) => setZoom(parseFloat(e.target.value))} 
                    />
                  </div>
                  <div className={styles.mobileCropActions}>
                    <button className={styles.mobileResetBtn} onClick={() => {
                      setCrop({ x: 0, y: 0 });
                      setZoom(1);
                    }}>Reset</button>
                    <button className={styles.mobileSaveBtn} onClick={() => {
                      const temp = editingPack.images[editorIdx]._tempCrop;
                      if (temp) {
                        const nextImages = [...editingPack.images];
                        const offX = temp.x + temp.width / 2;
                        const offY = temp.y + temp.height / 2;
                        const calculatedZoom = 100 / temp.width;
                        nextImages[editorIdx] = { 
                          ...nextImages[editorIdx], 
                          offsetX: offX, 
                          offsetY: offY, 
                          zoom: calculatedZoom 
                        };
                        commitToHistory({...editingPack, images: nextImages});
                      }
                      setIsCropping(false);
                    }}>Save Crop</button>
                  </div>
                </div>
              )}
            </div>

            <div className={styles.editorSidebar}>
              {!isCropping ? (
                <>
                  <div className={styles.sidebarSection}>
                    <div className={styles.sectionTitle}>Image Options</div>
                    <button className={styles.cropModeBtn} onClick={() => {
                      setZoom(1);
                      setIsCropping(true);
                    }}>
                      <Icon name="Crop" size={14} style={{ marginRight: '6px' }} color="#000000" /> Edit Crop & Pan
                    </button>
                  </div>
                  <div className={styles.sidebarSection}>
                    <div className={styles.sectionTitle}>Slide #{editorIdx + 1} Overlays</div>
                
                {editingPack.images[editorIdx]?.overlays?.map((ov, idx) => (
                  <div key={idx} className={styles.overlayItem}>
                    <button className={styles.removeOverlay} onClick={() => {
                      const nextImages = [...editingPack.images];
                      nextImages[editorIdx].overlays = nextImages[editorIdx].overlays.filter((_, i) => i !== idx);
                      commitToHistory({ ...editingPack, images: nextImages });
                    }}><Icon name="X" size={12} color="#ef4444" /></button>
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
                          {a === 'left' && <Icon name="AlignLeft" size={14} />}
                          {a === 'center' && <Icon name="AlignCenter" size={14} />}
                          {a === 'right' && <Icon name="AlignRight" size={14} />}
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
                  <Icon name="Plus" size={18} color="#fbbf24" /> Add Text Layer
                </button>
              </div>
                </>
              ) : (
                <div className={styles.sidebarSection}>
                  <div className={styles.sectionTitle}>Crop Mode Active</div>
                  <div className={styles.cropInstructionCard}>
                    <p style={{ fontSize: '13px', color: '#999', marginBottom: '16px' }}>Drag photo to pan. Use slider to zoom.</p>
                    
                    <div className={styles.cropPresetsHeader}>Quick Align</div>
                    <div className={styles.cropPresetsGrid}>
                      <button className={styles.presetBtn} onClick={() => {
                        const nextImages = [...editingPack.images];
                        nextImages[editorIdx] = { ...nextImages[editorIdx], offsetY: 0 };
                        commitToHistory({...editingPack, images: nextImages});
                      }}>Keep Top</button>
                      <button className={styles.presetBtn} onClick={() => {
                        const nextImages = [...editingPack.images];
                        nextImages[editorIdx] = { ...nextImages[editorIdx], offsetY: 100 };
                        commitToHistory({...editingPack, images: nextImages});
                      }}>Keep Bottom</button>
                      <button className={styles.presetBtn} onClick={() => {
                        const nextImages = [...editingPack.images];
                        nextImages[editorIdx] = { ...nextImages[editorIdx], offsetX: 0 };
                        commitToHistory({...editingPack, images: nextImages});
                      }}>Keep Left</button>
                      <button className={styles.presetBtn} onClick={() => {
                        const nextImages = [...editingPack.images];
                        nextImages[editorIdx] = { ...nextImages[editorIdx], offsetX: 100 };
                        commitToHistory({...editingPack, images: nextImages});
                      }}>Keep Right</button>
                    </div>

                    <div className={styles.rangeItem} style={{ marginTop: '20px' }}>
                      <div className={styles.rangeLabel}>Zoom Level</div>
                      <input type="range" min="1" max="3" step="0.01" value={editingPack.images[editorIdx]?.zoom ?? 1} onChange={(e) => {
                        const nextImages = [...editingPack.images];
                        nextImages[editorIdx].zoom = parseFloat(e.target.value);
                        setEditingPack(prev => ({ ...prev, images: nextImages }));
                      }} onMouseUp={() => commitToHistory(editingPack)} />
                      <div style={{ textAlign: 'center', fontSize: '12px', marginTop: '4px', color: 'var(--amber-400)' }}>{Math.round((editingPack.images[editorIdx]?.zoom ?? 1) * 100)}%</div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', marginTop: '20px' }}>
                      <button className={styles.cropResetBtn} style={{ flex: 1 }} onClick={() => {
                        setCrop({ x: 0, y: 0 });
                        setZoom(1);
                        const nextImages = [...editingPack.images];
                        nextImages[editorIdx] = { ...nextImages[editorIdx], zoom: 1, offsetX: 50, offsetY: 50 };
                        commitToHistory({...editingPack, images: nextImages});
                      }}>Reset</button>
                      <button className={styles.cropDoneBtn} style={{ flex: 2 }} onClick={() => {
                        const temp = editingPack.images[editorIdx]._tempCrop;
                        if (temp) {
                          const nextImages = [...editingPack.images];
                          // The center of the crop box is where objectPosition should point
                          const offX = temp.x + temp.width / 2;
                          const offY = temp.y + temp.height / 2;
                          // The scale is inverse of the width fraction (if assuming same aspect)
                          const calculatedZoom = 100 / temp.width;
                          
                          nextImages[editorIdx] = { 
                            ...nextImages[editorIdx], 
                            offsetX: offX, 
                            offsetY: offY, 
                            zoom: calculatedZoom 
                          };
                          commitToHistory({...editingPack, images: nextImages});
                        }
                        setIsCropping(false);
                      }}>Save Crop</button>
                    </div>
                  </div>
                </div>
              )}
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

      {exportingPost && (
        <div style={{ 
          position: 'fixed', 
          top: '-9999px',      // Further off-screen
          left: '-9999px',     // Further off-screen
          width: '1080px',
          pointerEvents: 'none', 
          zIndex: 9999,
          opacity: 1, 
          overflow: 'visible'
        }}>
          <div id="export-surface" ref={exportRef} style={{ 
            width: '1080px', 
            height: exportingPost.aspectRatio === '1:1' ? '1080px' : exportingPost.aspectRatio === '3:4' ? '1440px' : '1920px', 
            position: 'relative',
            overflow: 'hidden',
            backgroundColor: '#000',
            containerType: 'inline-size'
          }}>
            <img 
              src={exportingPost.image} 
              crossOrigin="anonymous"
              alt="Exporting" 
              style={{ 
                width: '100%', 
                height: '100%', 
                objectFit: 'cover',
                objectPosition: `${exportingPost.offsetX ?? 50}% ${exportingPost.offsetY ?? 50}%`,
                transform: `scale(${exportingPost.zoom ?? 1})`
              }} 
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
                // Responsive text scaling to emulate exact Canvas editor sizes
                const scaleRatio = (ov.size || 30) / 30;
                const fontCqw = ((ov.fontSize || 24) / 540) * 100;

                return (
                  <div key={idx} className={`${styles.textOverlay} ${styles['overlay_' + (ov.font || 'classic')]} ${styles['bg_' + (ov.bgMode || 'none')]} ${styles['text_' + (ov.align || 'center')]}`} style={{
                    position: "absolute",
                    left: `${ov.x}%`,
                    top: `${ov.y}%`,
                    transform: `translate(-50%, -50%) rotate(${ov.rotation || 0}deg) scale(${scaleRatio})`,
                    fontSize: `${fontCqw}cqw`, 
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

      {/* ═══ DOWNLOAD CHOICE MODAL ═══ */}
      {downloadChoicePack && (
        <div className={styles.modalOverlay} onClick={() => setDownloadChoicePack(null)}>
          <div className={styles.downloadChoiceContent} onClick={e => e.stopPropagation()}>
            <div className={styles.choiceHeader}>
              <div className={styles.choiceTitle}>Download Pack</div>
              <div className={styles.choiceDesc}>Choose your export style</div>
            </div>
            <div className={styles.choiceButtons}>
              <button 
                className={styles.choiceBtn} 
                onClick={() => {
                  handleExportPack(downloadChoicePack, { skipOverlays: false });
                  setDownloadChoicePack(null);
                }}
              >
                <span className={styles.choiceIcon}>
                  <Icon name="Sparkles" size={24} color="#fbbf24" fill="#fbbf24" />
                </span>
                <div className={styles.choiceBtnLabel}>With Captions</div>
                <div className={styles.choiceBtnDesc}>Ready for TikTok/Reels</div>
              </button>
              <button 
                className={styles.choiceBtn} 
                onClick={() => {
                  handleExportPack(downloadChoicePack, { skipOverlays: true });
                  setDownloadChoicePack(null);
                }}
              >
                <span className={styles.choiceIcon}>
                  <Icon name="Image" size={24} color="#60a5fa" />
                </span>
                <div className={styles.choiceBtnLabel}>Without Captions</div>
                <div className={styles.choiceBtnDesc}>Clean images only</div>
              </button>
            </div>
            <button className={styles.choiceClose} onClick={() => setDownloadChoicePack(null)}>Cancel</button>
          </div>
        </div>
      )}

      {/* ═══ IMMERSIVE TEXT EDITOR (TikTok Style) ═══ */}
      {view === "editor" && isQuickEditing && activeOverlayIdx !== null && editingPack.images[editorIdx]?.overlays[activeOverlayIdx] && (
        <div className={styles.quickEditOverlay}>
          <div className={styles.quickEditHeader}>
            <button className={styles.quickDeleteBtn} onClick={() => {
              const nextImages = [...editingPack.images];
              nextImages[editorIdx].overlays = nextImages[editorIdx].overlays.filter((_, i) => i !== activeOverlayIdx);
              commitToHistory({ ...editingPack, images: nextImages });
              setIsQuickEditing(false);
              setActiveOverlayIdx(null);
            }}>
              <Icon name="Trash2" size={20} color="#ef4444" />
            </button>

            <div className={styles.quickEditHeaderCenter}>
              {/* Typography Tool */}
              <button 
                className={`${styles.quickToolBtn} ${activeQuickTool === 'fonts' ? styles.quickToolBtnActive : ''}`}
                onClick={() => setActiveQuickTool('fonts')}
              >
                <Icon name="Type" size={22} color={activeQuickTool === 'fonts' ? '#fbbf24' : '#fff'} />
              </button>

              {/* Color Tool */}
              <button 
                className={`${styles.quickToolBtn} ${activeQuickTool === 'colors' ? styles.quickToolBtnActive : ''}`}
                onClick={() => setActiveQuickTool('colors')}
              >
                <div className={styles.rainbowCircle} />
              </button>

              {/* Background Toggle */}
              <button 
                className={styles.quickToolBtn}
                onClick={() => {
                  const modes = ['none', 'solid', 'outline'];
                  const current = editingPack.images[editorIdx].overlays[activeOverlayIdx].bgMode || 'none';
                  const next = modes[(modes.indexOf(current) + 1) % modes.length];
                  const nextImages = [...editingPack.images];
                  nextImages[editorIdx].overlays[activeOverlayIdx].bgMode = next;
                  setEditingPack(prev => ({ ...prev, images: nextImages }));
                }}
              >
                <div style={{ 
                  width: '24px', 
                  height: '24px', 
                  border: '2px solid white', 
                  borderRadius: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: editingPack.images[editorIdx].overlays[activeOverlayIdx].bgMode === 'solid' ? 'white' : 'transparent'
                }}>
                  <span style={{ 
                    color: editingPack.images[editorIdx].overlays[activeOverlayIdx].bgMode === 'solid' ? 'black' : (editingPack.images[editorIdx].overlays[activeOverlayIdx].bgMode === 'outline' ? '#fbbf24' : 'white'),
                    fontSize: '0.75rem',
                    fontWeight: 900
                  }}>A</span>
                </div>
              </button>

              {/* Alignment Toggle */}
              <button 
                className={styles.quickToolBtn}
                onClick={() => {
                  const aligns = ['left', 'center', 'right'];
                  const current = editingPack.images[editorIdx].overlays[activeOverlayIdx].align || 'center';
                  const next = aligns[(aligns.indexOf(current) + 1) % aligns.length];
                  const nextImages = [...editingPack.images];
                  nextImages[editorIdx].overlays[activeOverlayIdx].align = next;
                  setEditingPack(prev => ({ ...prev, images: nextImages }));
                }}
              >
                <div style={{ transform: 'scale(1.2)', display: 'flex', alignItems: 'center' }}>
                  {(editingPack.images[editorIdx].overlays[activeOverlayIdx].align === 'left') && <Icon name="AlignLeft" size={16} color="#fbbf24" />}
                  {(editingPack.images[editorIdx].overlays[activeOverlayIdx].align === 'center' || !editingPack.images[editorIdx].overlays[activeOverlayIdx].align) && <Icon name="AlignCenter" size={16} color="#fbbf24" />}
                  {(editingPack.images[editorIdx].overlays[activeOverlayIdx].align === 'right') && <Icon name="AlignRight" size={16} color="#fbbf24" />}
                </div>
              </button>
            </div>

            <button className={styles.doneBtn} onClick={() => {
              setIsQuickEditing(false);
              commitToHistory(editingPack);
              setActiveOverlayIdx(null);
            }}>Done</button>
          </div>

            <div className={styles.quickEditMain}>
            {/* Full-width text editing area — no side sliders blocking it */}
            <div className={styles.quickEditInputArea}>
              {(() => {
                const ov = editingPack.images[editorIdx].overlays[activeOverlayIdx];
                const scaleRatio = (ov?.size || 30) / 30;

                // ── Consistent wrap logic ──
                // The canvas uses: fontSize in cqw = (ov.fontSize / 540) * 100
                // So canvas char width = (fontSize / 540) * canvasW
                // Canvas max-width = canvasW * 0.8
                //
                // We want the editor to wrap at the exact same character positions.
                // Solution: compute font-size and max-width using the same cqw math,
                // then scale both up by a displayScale so they fill the available
                // editor width (minus padding). Scaling both proportionally means
                // line-break points stay identical.
                const canvasW = canvasDisplayWidth > 0
                  ? canvasDisplayWidth
                  : (canvasContainerRef.current?.offsetWidth || 280);
                const canvasMaxW = canvasW * 0.8;            // canvas text wrap width
                const editorAvailW = window.innerWidth - 40; // editor width - padding
                // Upscale factor: how much bigger the editor preview is vs the canvas
                const displayScale = Math.min(editorAvailW / canvasMaxW, 3.5);
                const canvasFontPx = ((ov?.fontSize || 24) / 540) * canvasW;
                const displayFontPx = canvasFontPx * displayScale;
                const displayMaxW = canvasMaxW * displayScale;

                const isSolid = ov?.bgMode === 'solid';
                const isOutline = ov?.bgMode === 'outline';
                const selectedColor = ov?.color || '#ffffff';
                const isLight = parseInt(selectedColor.replace('#',''), 16) > 0xffffff / 2;
                const bg = isSolid ? selectedColor : 'transparent';
                const fg = isSolid ? (isLight ? '#000000' : '#ffffff') : selectedColor;
                const shadow = isOutline
                  ? `1px 1px 0 #000,-1px -1px 0 #000,1px -1px 0 #000,-1px 1px 0 #000,0 1px 0 #000,0 -1px 0 #000`
                  : 'none';
                return (
                  <div
                    ref={quickEditRef}
                    contentEditable
                    suppressContentEditableWarning
                    className={`${styles.quickEditTextarea} ${styles['overlay_' + (ov?.font || 'classic')]}`}
                    onInput={(e) => {
                      const text = e.currentTarget.innerText;
                      const nextImages = [...editingPack.images];
                      nextImages[editorIdx].overlays[activeOverlayIdx].text = text;
                      setEditingPack(prev => ({ ...prev, images: nextImages }));
                    }}
                    style={{
                      fontSize: `${displayFontPx}px`,       // upscaled canvas font
                      maxWidth: `${displayMaxW}px`,          // upscaled canvas wrap width → same line breaks
                      transform: `scale(${scaleRatio})`,
                      transformOrigin: 'center center',
                      textAlign: ov?.align || 'center',
                      background: bg,
                      color: fg,
                      textShadow: shadow,
                      padding: '0.18em 0.45em',
                      borderRadius: '0.25em',
                      lineHeight: 1.2,
                    }}
                  />
                );
              })()}
            </div>

            {/* Bottom controls: sliders + font/color strip */}
            <div className={styles.quickEditBottomBar}>
              {/* Horizontal slider row */}
              <div className={styles.quickSliderRow}>
                <div className={styles.quickSliderItem}>
                  <span className={styles.sliderLabel}>FONT</span>
                  <input
                    className={styles.quickHSlider}
                    type="range"
                    min="12"
                    max="100"
                    value={editingPack.images[editorIdx].overlays[activeOverlayIdx]?.fontSize || 24}
                    onChange={(e) => {
                      const val = parseInt(e.target.value);
                      const nextImages = [...editingPack.images];
                      nextImages[editorIdx].overlays[activeOverlayIdx].fontSize = val;
                      setEditingPack(prev => ({ ...prev, images: nextImages }));
                    }}
                  />
                </div>
                <div className={styles.quickSliderItem}>
                  <span className={styles.sliderLabel}>SCALE</span>
                  <input
                    className={styles.quickHSlider}
                    type="range"
                    min="10"
                    max="100"
                    value={editingPack.images[editorIdx].overlays[activeOverlayIdx]?.size || 30}
                    onChange={(e) => {
                      const val = parseInt(e.target.value);
                      const nextImages = [...editingPack.images];
                      nextImages[editorIdx].overlays[activeOverlayIdx].size = val;
                      setEditingPack(prev => ({ ...prev, images: nextImages }));
                    }}
                  />
                </div>
              </div>

              {/* Font / Color strip */}
              <div className={styles.editOverlayControls}>
                {activeQuickTool === 'colors' ? (
                  <div className={styles.quickColorStrip}>
                    {["#ffffff", "#000000", "#ff3b5c", "#face15", "#2af0ea", "#00f2ea", "#ff0050"].map(c => (
                      <div 
                        key={c}
                        className={editingPack.images[editorIdx].overlays[activeOverlayIdx].color === c ? styles.colorCircleActive : styles.colorCircle}
                        style={{ backgroundColor: c, width: '36px', height: '36px', flexShrink: 0 }}
                        onClick={() => {
                          const nextImages = [...editingPack.images];
                          nextImages[editorIdx].overlays[activeOverlayIdx].color = c;
                          setEditingPack(prev => ({ ...prev, images: nextImages }));
                        }}
                      />
                    ))}
                  </div>
                ) : (
                  <div className={styles.fontSelectorStrip}>
                    {['classic', 'typewriter', 'serif', 'handwriting', 'neon'].map(f => (
                      <button 
                        key={f}
                        className={`${styles.fontPill} ${editingPack.images[editorIdx].overlays[activeOverlayIdx].font === f ? styles.fontPillActive : ''}`}
                        onClick={() => {
                          const nextImages = [...editingPack.images];
                          nextImages[editorIdx].overlays[activeOverlayIdx].font = f;
                          setEditingPack(prev => ({ ...prev, images: nextImages }));
                        }}
                      >
                        {f.toUpperCase()}
                      </button>
                    ))}
                  </div>
                )}
              </div>
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
