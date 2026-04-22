import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, Download, RefreshCw, Image as ImageIcon, Trash2, CheckCircle2, AlertCircle } from 'lucide-react';
import { GoogleGenerativeAI } from "@google/generative-ai";
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import './App.css';

// User prompt as requested
const BASE_PROMPT = "Take this image and subtly modify — add a minor facial expression change (slight smile, raised eyebrow, surprised look), shift the lighting by 5-10%, adjust background hue slightly. Preserve all text and the main subject. Output should look 97% visually identical but pixel-level distinct.";

function App() {
  const [apiKey, setApiKey] = useState(import.meta.env.VITE_GEMINI_API_KEY || '');
  const [sourceImages, setSourceImages] = useState([]);
  const [batchSize, setBatchSize] = useState(1);
  const [useAI, setUseAI] = useState(true);
  const [useIndustrialHashing, setUseIndustrialHashing] = useState(true);
  const [results, setResults] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);
  
  const fileInputRef = useRef(null);

  const applyIndustrialHashing = async (base64) => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const zoom = 1.03;
        const rotation = (Math.random() * 1 + 1) * (Math.PI / 180) * (Math.random() > 0.5 ? 1 : -1);
        const borderSize = Math.floor(Math.random() * 3) + 2;
        const borderColor = `rgb(${Math.random()*255},${Math.random()*255},${Math.random()*255})`;
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.fillStyle = borderColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.save();
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate(rotation);
        ctx.scale(zoom, zoom);
        const drawWidth = canvas.width - (borderSize * 2);
        const drawHeight = canvas.height - (borderSize * 2);
        ctx.drawImage(img, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
        ctx.globalCompositeOperation = 'overlay';
        ctx.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';
        ctx.fillRect(-drawWidth/2, -drawHeight/2, drawWidth, drawHeight);
        ctx.restore();
        const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
        resolve({ url: dataUrl, blob: dataUrl.split(',')[1] });
      };
      img.src = `data:image/jpeg;base64,${base64}`;
    });
  };

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
      const newSources = [];
      files.forEach(file => {
        if (file.size > 7 * 1024 * 1024) {
          setError(`File ${file.name} exceeds 7MB limit.`);
          return;
        }
        
        const reader = new FileReader();
        reader.onloadend = () => {
          setSourceImages(prev => [...prev, {
            id: Date.now() + Math.random(),
            name: file.name,
            preview: URL.createObjectURL(file),
            base64: reader.result.split(',')[1]
          }]);
        };
        reader.readAsDataURL(file);
      });
      setError(null);
    }
  };

  const removeSource = (id) => {
    setSourceImages(prev => prev.filter(s => s.id !== id));
  };

  const generateVariations = async () => {
    if (!apiKey) {
      setError("Please enter your Gemini API Key.");
      return;
    }
    if (sourceImages.length === 0) {
      setError("Please upload at least one source image.");
      return;
    }

    setIsGenerating(true);
    setProgress(0);
    setError(null);
    setResults([]);

    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-3.1-flash-image-preview" });

      const newResults = [];
      const totalSteps = sourceImages.length * batchSize;
      let currentStep = 0;

      for (const source of sourceImages) {
        for (let i = 0; i < batchSize; i++) {
          let currentBase64 = source.base64;
          let currentUrl = source.preview;
          
          // Phase 1: Gemini AI Smart Modification
          if (useAI) {
            const result = await model.generateContent([
              BASE_PROMPT,
              {
                inlineData: {
                  data: currentBase64,
                  mimeType: "image/jpeg"
                }
              }
            ]);
            
            const candidates = result.response.candidates;
            if (candidates && candidates[0].content.parts) {
              const imagePart = candidates[0].content.parts.find(p => p.inlineData);
              if (imagePart) {
                currentBase64 = imagePart.inlineData.data;
                currentUrl = `data:${imagePart.inlineData.mimeType};base64,${currentBase64}`;
              }
            }
          }

          // Phase 2: Industrial Hashing (FFmpeg Style)
          if (useIndustrialHashing) {
            const hashed = await applyIndustrialHashing(currentBase64);
            currentBase64 = hashed.blob;
            currentUrl = hashed.url;
          }
          
          newResults.push({
            id: Date.now() + Math.random(),
            sourceName: source.name,
            url: currentUrl,
            blob: currentBase64
          });
          
          currentStep++;
          setProgress(Math.round((currentStep / totalSteps) * 100));
          setResults([...newResults]);
        }
      }
    } catch (err) {
      console.error(err);
      setError("Generation failed: " + (err.message || "Unknown error"));
    } finally {
      setIsGenerating(false);
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
        <div className="logo">AI UGC FACTORY<span>.IN</span></div>
        <div className="nav-badges">
          <span className="status-badge">Industrial v2.0</span>
          <span className="status-badge">Personal License</span>
        </div>
      </header>

      <main className="container">
        <section className="hero">
          <motion.div 
            className="badge"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            Bypass Duplicate Detection v2026
          </motion.div>
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            Gemini <span>AI UGC</span> Factory
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            TikTok's duplicate detection is brutal. Perceptual hashing catches anything above 85% pixel similarity. 
            We use Gemini 3.1 Flash to generate variations that look 97% identical but are pixel-level distinct.
          </motion.p>
        </section>

        <div className="main-grid">
          <div className="control-panel glass-panel">
            <h3>Sources ({sourceImages.length})</h3>
            <div 
              className="dropzone"
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="dropzone-content">
                <Upload size={32} />
                <p>Upload Images</p>
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

            <div className="source-list">
              <AnimatePresence>
                {sourceImages.map(source => (
                  <motion.div 
                    key={source.id} 
                    className="source-item"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                  >
                    <img src={source.preview} alt="Source" />
                    <span className="source-name">{source.name}</span>
                    <button className="remove-btn" onClick={() => removeSource(source.id)}>
                      <Trash2 size={14} />
                    </button>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            <div className="panel-section">
              <div className="section-header">
                <h3>Bypass Strategy</h3>
              </div>
              
              <div className="toggle-item">
                <div className="toggle-info">
                  <label>Gemini AI Smart Mod</label>
                  <span>Facial expressions, lighting, BG hue</span>
                </div>
                <label className="switch">
                  <input 
                    type="checkbox" 
                    checked={useAI}
                    onChange={(e) => setUseAI(e.target.checked)}
                  />
                  <span className="slider round"></span>
                </label>
              </div>

              <div className="toggle-item">
                <div className="toggle-info">
                  <label>Industrial Hashing</label>
                  <span>Zoom, Rotate, Random Border (FFmpeg)</span>
                </div>
                <label className="switch">
                  <input 
                    type="checkbox" 
                    checked={useIndustrialHashing}
                    onChange={(e) => setUseIndustrialHashing(e.target.checked)}
                  />
                  <span className="slider round"></span>
                </label>
              </div>
            </div>

            <div className="settings">
              <div className="setting-item">
                <label>Variations per Image</label>
                <input 
                  type="number" 
                  min="1" 
                  max="14" 
                  value={batchSize}
                  onChange={(e) => setBatchSize(Math.min(14, Math.max(1, parseInt(e.target.value) || 1)))}
                />
              </div>
              
              <button 
                className="btn-primary" 
                onClick={generateVariations}
                disabled={isGenerating || sourceImages.length === 0}
              >
                {isGenerating ? (
                  <><RefreshCw className="spin" size={18} /> Deploying {progress}%</>
                ) : (
                  `Deploy ${sourceImages.length * batchSize} Variations`
                )}
              </button>
            </div>

            {error && (
              <div className="error-box">
                <AlertCircle size={18} />
                <span>{error}</span>
              </div>
            )}
          </div>

          <div className="results-panel glass-panel">
            <div className="panel-header">
              <h3>Deployment Gallery</h3>
              {results.length > 0 && (
                <button className="btn-secondary" onClick={downloadAll}>
                  <Download size={18} /> Download All (.zip)
                </button>
              )}
            </div>

            <div className="gallery-grid">
              <AnimatePresence>
                {results.length === 0 && !isGenerating && (
                  <div className="empty-state">
                    <ImageIcon size={48} opacity={0.2} />
                    <p>Processed variations will appear here</p>
                  </div>
                )}
                {results.map((res, index) => (
                  <motion.div 
                    key={res.id}
                    className="gallery-item"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                  >
                    <img src={res.url} alt={`Variation ${index + 1}`} />
                    <div className="item-overlay">
                      <span>Bypassed #{index + 1}</span>
                    </div>
                  </motion.div>
                ))}
                {isGenerating && results.length < (sourceImages.length * batchSize) && (
                  <div className="gallery-item loading">
                    <RefreshCw className="spin" size={24} />
                  </div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </main>

      <footer className="footer">
        <p>© 2026 AIUGCFACTORY.IN — AI + Industrial Hashing Deployment Suite</p>
      </footer>
    </div>
  );
}

export default App;
