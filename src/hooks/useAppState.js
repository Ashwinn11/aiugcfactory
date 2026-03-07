"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { toPng, toBlob } from "html-to-image";
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import styles from "../app/page.module.css";

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

export function useAppState() {
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
                aspectRatio: "3:4",
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
      aspectRatio: result.aspectRatio || "3:4",
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


  return {
    mode, setMode, currentMode, MODES,
    avatar, setAvatar, avatarLoading, setAvatarLoading, fileInputRef,
    productImage, setProductImage, productLoading, setProductLoading, productInputRef,
    exportRef, exportingPost, setExportingPost,
    adCategory, setAdCategory,
    genAspectRatio, setGenAspectRatio,
    vibe, setVibe,
    planning, setPlanning, plannedScenes, setPlannedScenes, plannedStyling, setPlannedStyling, selectedSceneIds, setSelectedSceneIds,
    generating, setGenerating, result, setResult, selectedIdx, setSelectedIdx, error, setError,
    resultHistory, setResultHistory,
    packs, setPacks, view, setView, editingPack, setEditingPack, editorIdx, setEditorIdx, exportQueue, setExportQueue, isExporting, setIsExporting, isBatchExporting, setIsBatchExporting,
    projects, setProjects, selectedProjectId, setSelectedProjectId, newProjectName, setNewProjectName, libraryMode, setLibraryMode, libraryProjectId, setLibraryProjectId,
    editorHistory, setEditorHistory, editorHistoryIdx, setEditorHistoryIdx,
    confirmModal, setConfirmModal,
    downloadChoicePack, setDownloadChoicePack,
    isCropping, setIsCropping, activeOverlayIdx, setActiveOverlayIdx, isQuickEditing, setIsQuickEditing, activeQuickTool, setActiveQuickTool, isMobile, setIsMobile, quickEditRef, canvasContainerRef, canvasDisplayWidth, setCanvasDisplayWidth, mobileAddInputRef, dragLock, setDragLock, crop, setCrop, zoom, setZoom,
    dbReady, setDbReady,
    hasUnsavedChanges, requestViewChange, requestModeChange, requestFreshStart, handleStartFresh,
    commitToHistory, handleUndo, handleRedo,
    handleAvatarUpload, handleProductUpload, handlePlan, handleExportPack, handleDownloadAll, handleSave, handleRemovePack, handleUpdatePack, handleDeleteProject, handleKeyDown,
  };

}
