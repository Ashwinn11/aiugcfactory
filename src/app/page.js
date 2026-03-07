"use client";

import styles from "./page.module.css";
import Icon from "../components/ui/Icon";
import Header from "../components/Header";
import GeneratorView from "../components/GeneratorView";
import LibraryView from "../components/LibraryView";
import EditorView from "../components/EditorView";
import { useAppState } from "../hooks/useAppState";

export default function Home() {
  const appState = useAppState();
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
    <div className={styles.page} onKeyDown={handleKeyDown} tabIndex={0}>
      <Header appState={appState} />
      
      {view === "generator" && <GeneratorView appState={appState} />}
      {view === "library" && <LibraryView appState={appState} />}
      {view === "editor" && editingPack && <EditorView appState={appState} />}

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
