import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, Download, RefreshCw, Image as ImageIcon, AlertCircle, Trash2 } from 'lucide-react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import './App.css';



function App() {
  const [sourceImages, setSourceImages] = useState([]);
  const [batchSize] = useState(1);
  const [useIndustrialHashing] = useState(true);
  const [useNoise] = useState(true);
  const [useHeavyArtillery] = useState(true);
  const [results, setResults] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);

  const fileInputRef = useRef(null);

  const applyIndustrialHashing = async (base64, options = {}) => {
    const { noise = true, heavyArtillery = true } = options;

    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        const zoom = 1.03;
        const borderSize = Math.floor(Math.random() * 3) + 2;
        const borderColor = `rgb(${Math.random() * 255},${Math.random() * 255},${Math.random() * 255})`;

        if (heavyArtillery) {
          canvas.width = Math.round(img.width * 1.5);
          canvas.height = Math.round(img.height * 1.5);
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

          const upscaledBase64 = canvas.toDataURL('image/jpeg', 0.95);
          const upImg = new Image();
          upImg.onload = () => {
            renderFinal(upImg);
          };
          upImg.src = upscaledBase64;
          return;
        }

        renderFinal(img);

        function renderFinal(sourceImg) {
          canvas.width = img.width;
          canvas.height = img.height;

          ctx.fillStyle = borderColor;
          ctx.fillRect(0, 0, canvas.width, canvas.height);

          ctx.save();
          ctx.translate(canvas.width / 2, canvas.height / 2);
          ctx.scale(zoom, zoom);

          const drawWidth = canvas.width - (borderSize * 2);
          const drawHeight = canvas.height - (borderSize * 2);
          ctx.drawImage(sourceImg, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);

          if (noise) {
            const noiseCanvas = document.createElement('canvas');
            noiseCanvas.width = 64;
            noiseCanvas.height = 64;
            const nCtx = noiseCanvas.getContext('2d');
            const nData = nCtx.createImageData(64, 64);
            for (let i = 0; i < nData.data.length; i += 4) {
              const v = Math.random() * 255;
              nData.data[i] = v;
              nData.data[i + 1] = v;
              nData.data[i + 2] = v;
              nData.data[i + 3] = 255;
            }
            nCtx.putImageData(nData, 0, 0);

            ctx.globalAlpha = 0.02 + Math.random() * 0.02;
            ctx.globalCompositeOperation = 'overlay';
            ctx.fillStyle = ctx.createPattern(noiseCanvas, 'repeat');
            ctx.fillRect(-drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
          }

          ctx.globalAlpha = 0.03;
          ctx.globalCompositeOperation = 'overlay';
          ctx.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
          ctx.fillRect(-drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);

          ctx.restore();

          const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
          resolve({ url: dataUrl, blob: dataUrl.split(',')[1] });
        }
      };
      img.src = `data:image/jpeg;base64,${base64}`;
    });
  };

  const generateVariations = async (imagesToProcess) => {
    const images = imagesToProcess || sourceImages;
    if (images.length === 0) return;

    setIsGenerating(true);
    setProgress(0);
    setError(null);

    try {
      const newResults = [];
      const totalSteps = images.length * batchSize;
      let currentStep = 0;

      for (const source of images) {
        for (let i = 0; i < batchSize; i++) {
          let currentBase64 = source.base64;
          let currentUrl = source.preview;

          if (useIndustrialHashing) {
            const hashed = await applyIndustrialHashing(currentBase64, {
              noise: useNoise,
              heavyArtillery: useHeavyArtillery
            });
            currentBase64 = hashed.blob;
            currentUrl = hashed.url;
          }

          const resObj = {
            id: Date.now() + Math.random(),
            sourceName: source.name,
            url: currentUrl,
            blob: currentBase64
          };

          newResults.push(resObj);
          setResults(prev => [...prev, resObj]);

          currentStep++;
          setProgress(Math.round((currentStep / totalSteps) * 100));
        }
      }
    } catch (err) {
      console.error(err);
      setError("Generation failed: " + (err.message || "Unknown error"));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleFileChange = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
      setError(null);
      const loadedImages = [];

      const filePromises = files.map(file => {
        return new Promise((resolve) => {
          if (file.size > 7 * 1024 * 1024) {
            setError(`File ${file.name} exceeds 7MB limit.`);
            resolve(null);
            return;
          }
          const reader = new FileReader();
          reader.onloadend = () => {
            const imgData = {
              id: Date.now() + Math.random(),
              name: file.name,
              preview: URL.createObjectURL(file),
              base64: reader.result.split(',')[1]
            };
            loadedImages.push(imgData);
            resolve(imgData);
          };
          reader.readAsDataURL(file);
        });
      });

      await Promise.all(filePromises);
      const validImages = loadedImages.filter(img => img !== null);
      setSourceImages(prev => [...prev, ...validImages]);

      if (validImages.length > 0) {
        generateVariations(validImages);
      }
    }
  };

  const downloadAll = async () => {
    const zip = new JSZip();
    results.forEach((res, index) => {
      zip.file(`${res.sourceName.split('.')[0]}-bypass-${index + 1}.jpg`, res.blob, { base64: true });
    });
    const content = await zip.generateAsync({ type: "blob" });
    saveAs(content, "ai-ugc-factory-deployment.zip");
  };

  return (
    <div className="app-container">
      <div className="mesh-bg" />

      <header className="navbar">
        <div className="logo">UGC FACTORY<span>.IN</span></div>
        <div className="nav-badges">
          <span className="status-badge">v2026 Industrial</span>
        </div>
      </header>

      <main className="container">
        <section className="hero-compact">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            Instant <span>Bypass</span> Factory
          </motion.h1>
          <p>Drop images to instantly generate pixel-distinct variations for TikTok.</p>
        </section>

        <div className="instant-grid">
          <div className="upload-section">
            <div
              className={`dropzone-large ${isGenerating ? 'processing' : ''}`}
              onClick={() => !isGenerating && fileInputRef.current?.click()}
            >
              <div className="dropzone-content">
                {isGenerating ? (
                  <><RefreshCw className="spin" size={48} /><p>Processing {progress}%</p></>
                ) : (
                  <><Upload size={48} /><p>Drop Images or Click to Upload</p></>
                )}
              </div>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/*"
                multiple
                hidden
              />
            </div>

            {error && (
              <div className="error-box">
                <AlertCircle size={18} />
                <span>{error}</span>
              </div>
            )}
          </div>

          <div className="results-area glass-panel">
            <div className="panel-header">
              <h3>Gallery ({results.length})</h3>
              {results.length > 0 && (
                <div className="header-actions">
                  <button className="btn-ghost-mini" onClick={() => setResults([])}>
                    <Trash2 size={16} /> Clear
                  </button>
                  <button className="btn-primary-mini" onClick={downloadAll}>
                    <Download size={18} /> Download ZIP
                  </button>
                </div>
              )}
            </div>

            <div className="gallery-grid-compact">
              <AnimatePresence>
                {results.length === 0 && !isGenerating && (
                  <div className="empty-state">
                    <ImageIcon size={48} opacity={0.1} />
                    <p>Variations appear here instantly</p>
                  </div>
                )}
                {results.map((res, index) => (
                  <motion.div
                    key={res.id}
                    className="gallery-item-small"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                  >
                    <img src={res.url} alt={`Variation ${index + 1}`} />
                    <div className="item-label">#{index + 1}</div>
                  </motion.div>
                ))}
                {isGenerating && (
                  <motion.div
                    className="gallery-item-small loading-placeholder"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                  >
                    <RefreshCw className="spin" size={24} />
                    <span>Processing...</span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </main>

      <footer className="footer-compact">
        <p>© 2026 UGCFACTORY.IN — Industrial Hashing Suite</p>
      </footer>
    </div>
  );
}

export default App;
