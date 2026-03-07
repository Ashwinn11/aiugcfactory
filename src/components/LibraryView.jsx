"use client";

import styles from "../app/page.module.css";
import Icon from "./ui/Icon";


export default function LibraryView({ appState }) {
  const {
    mode,
    setMode,
    currentMode,
    MODES,
    avatar,
    setAvatar,
    avatarLoading,
    setAvatarLoading,
    fileInputRef,
    productImage,
    setProductImage,
    productLoading,
    setProductLoading,
    productInputRef,
    exportRef,
    exportingPost,
    setExportingPost,
    adCategory,
    setAdCategory,
    genAspectRatio,
    setGenAspectRatio,
    vibe,
    setVibe,
    planning,
    setPlanning,
    plannedScenes,
    setPlannedScenes,
    plannedStyling,
    setPlannedStyling,
    selectedSceneIds,
    setSelectedSceneIds,
    generating,
    setGenerating,
    result,
    setResult,
    selectedIdx,
    setSelectedIdx,
    error,
    setError,
    resultHistory,
    setResultHistory,
    packs,
    setPacks,
    view,
    setView,
    editingPack,
    setEditingPack,
    editorIdx,
    setEditorIdx,
    exportQueue,
    setExportQueue,
    isExporting,
    setIsExporting,
    isBatchExporting,
    setIsBatchExporting,
    projects,
    setProjects,
    selectedProjectId,
    setSelectedProjectId,
    newProjectName,
    setNewProjectName,
    libraryMode,
    setLibraryMode,
    libraryProjectId,
    setLibraryProjectId,
    editorHistory,
    setEditorHistory,
    editorHistoryIdx,
    setEditorHistoryIdx,
    confirmModal,
    setConfirmModal,
    downloadChoicePack,
    setDownloadChoicePack,
    isCropping,
    setIsCropping,
    activeOverlayIdx,
    setActiveOverlayIdx,
    isQuickEditing,
    setIsQuickEditing,
    activeQuickTool,
    setActiveQuickTool,
    isMobile,
    setIsMobile,
    quickEditRef,
    canvasContainerRef,
    canvasDisplayWidth,
    setCanvasDisplayWidth,
    mobileAddInputRef,
    dragLock,
    setDragLock,
    crop,
    setCrop,
    zoom,
    setZoom,
    dbReady,
    setDbReady,
    hasUnsavedChanges,
    requestViewChange,
    requestModeChange,
    requestFreshStart,
    handleStartFresh,
    commitToHistory,
    handleUndo,
    handleRedo,
    handleAvatarUpload,
    handleProductUpload,
    handlePlan,
    handleExportPack,
    handleDownloadAll,
    handleSave,
    handleRemovePack,
    handleUpdatePack,
    handleDeleteProject,
    handleKeyDown,
    handleDownloadTrigger
  } = appState;

  return (
    <>
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
                        const scaleRatio = (ov.size || 35) / 35;
                        const fontCqw = ((ov.fontSize || 0) / 540) * 100;
                        
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
                              y: 75,
                              fontSize: 15,
                              color: "#ffffff",
                              bgMode: "solid",
                              rotation: 0,
                              size: 35
                            }] : []
                          })),
                          aspectRatio: "3:4"
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
    </>
  );
}
