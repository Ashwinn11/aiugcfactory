"use client";

import styles from "../app/page.module.css";
import Icon from "./ui/Icon";
import Cropper from 'react-easy-crop';


export default function EditorView({ appState }) {
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
                            const scaleRatio = (ov.size || 35) / 35;
                            const fontCqw = ((ov.fontSize || 0) / 540) * 100;

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
                      text: "NEW TEXT", x: 50, y: 75, size: 35, color: "#ffffff", 
                      fontSize: 15, font: 'classic', bgMode: 'solid', align: 'center', rotation: 0 
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
                          type="range" min="0" max="100" step="1"
                          value={ov.fontSize || 0}
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
                    text: "NEW TEXT", x: 50, y: 75, size: 35, color: "#ffffff", 
                    fontSize: 15, font: 'classic', bgMode: 'solid', align: 'center', rotation: 0 
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
        {isQuickEditing && activeOverlayIdx !== null && editingPack.images[editorIdx]?.overlays[activeOverlayIdx] && (
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

    </>
  );
}
