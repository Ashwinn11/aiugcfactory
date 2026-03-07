"use client";

import styles from "../app/page.module.css";
import Icon from "./ui/Icon";

export default function Header({ appState }) {
  const { view, requestViewChange, packs, genAspectRatio, setEditingPack, setEditorIdx } = appState;
  
  return (
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
                  requestViewChange("editor"); setEditorIdx(0);
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
                  requestViewChange("editor"); setEditorIdx(0);
                }
              }}
            >
              Editor
            </button>
          </div>
      </header>
  );
}
