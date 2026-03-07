"use client";

import styles from "../app/page.module.css";
import Icon from "./ui/Icon";


export default function GeneratorView({ appState }) {
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
                <button className={styles.newGenBtn} style={{ background: '#333', color: '#fff', border: '1px solid #444', marginRight: 'auto' }} onClick={() => handlePlan()}>
                  <Icon name="RefreshCw" size={16} color="#fff" /> Regenerate
                </button>
                <button className={styles.newGenBtn} onClick={requestFreshStart}>
                  <Icon name="RotateCcw" size={16} color="#a1a1aa" /> Start Fresh
                </button>
              </div>
            </section>
          )}

    </>
  );
}
