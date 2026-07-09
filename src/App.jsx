import React, { useState } from 'react';
import Editor from './editor/Editor.jsx';
import BypassTool from './BypassTool.jsx';
import './editor/Editor.css';

// Shell that toggles between the new TikTok-style overlay Editor (default) and
// the original image bypass tool. The bypass logic lives untouched in
// BypassTool.jsx.
//
// Both views stay MOUNTED (hidden with display:none): unmounting the Editor
// would drop every video slide's object URL — flipping to Bypass and back
// used to destroy the loaded videos and leak their blobs.
export default function App() {
  const [view, setView] = useState('editor');

  const switcher = (
    <div className="view-switcher">
      <button
        className={view === 'editor' ? 'active' : ''}
        onClick={() => setView('editor')}
      >
        Editor
      </button>
      <button
        className={view === 'bypass' ? 'active' : ''}
        onClick={() => setView('bypass')}
      >
        Bypass Factory
      </button>
    </div>
  );

  return (
    <>
      {/* In editor view the switcher lives inside the editor toolbar; the
          floating pill only appears over the bypass view. */}
      {view === 'bypass' && switcher}

      <div style={{ display: view === 'editor' ? 'contents' : 'none' }}>
        <Editor viewSwitcher={switcher} active={view === 'editor'} />
      </div>
      <div style={{ display: view === 'bypass' ? 'contents' : 'none' }}>
        <BypassTool />
      </div>
    </>
  );
}
