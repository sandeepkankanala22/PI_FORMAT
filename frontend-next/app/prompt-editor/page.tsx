'use client'
import Script from 'next/script'

export default function PromptEditor() {
  return (
    <>
      {/* ── Navbar ── */}
      <nav className="navbar">
        <div className="navbar-left">
          <span className="navbar-logo">Chryselys</span>
          <div className="navbar-divider"></div>
          <div>
            <div className="navbar-title">ForecastIQ &thinsp;|&thinsp; Prompt Studio</div>
          </div>
        </div>
        <div className="navbar-right">
          <a href="/" className="navbar-back-btn">
            <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
            Back to App
          </a>
          <div className="profile-chip">
            <img src="/image.webp" alt="Chryselys" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          </div>
        </div>
      </nav>

      {/* ── Studio shell ── */}
      <div className="studio-shell">

        {/* ═══ Left: Prompt List ═══ */}
        <aside className="prompt-sidebar">
          <div className="sidebar-header">
            <h3>Agent Prompts</h3>
          </div>
          <div className="sidebar-list" id="sidebarList">
            <div style={{padding:'20px 16px',textAlign:'center',color:'var(--text-2)',fontSize:'12px'}}>
              Loading prompts...
            </div>
          </div>
        </aside>

        {/* ═══ Center: Editor ═══ */}
        <main className="editor-area">
          {/* Top bar */}
          <div className="editor-topbar" id="editorTopbar">
            <div className="editor-topbar-left">
              <div className="editor-prompt-name" id="editorPromptName">Select a prompt</div>
              <div className="editor-prompt-desc" id="editorPromptDesc">Choose a prompt from the sidebar to start editing</div>
            </div>
            <div className="editor-topbar-actions" id="editorActions" style={{display:'none'}}>
              <div className="live-indicator" id="liveIndicator">
                <div className="live-dot"></div> Live
              </div>
              <div className="draft-indicator" id="draftIndicator" style={{display:'none'}}>
                <div className="draft-dot"></div> Draft unsaved
              </div>
              <button className="btn btn-outline" id="btnDiscard" onClick={() => (window as any).discardDraft()} style={{display:'none'}}>Discard</button>
              <button className="btn btn-draft" id="btnSaveDraft" onClick={() => (window as any).saveDraft()}>Save Draft</button>
              <button className="btn btn-publish" id="btnPublish" onClick={() => (window as any).openPublishModal()} disabled>Publish Live</button>
            </div>
          </div>

          {/* Tab bar */}
          <div className="editor-tab-bar">
            <div className="editor-tab active" id="tabSystem" onClick={() => (window as any).switchEditorTab('system')}>System Instructions</div>
            <div className="editor-tab" id="tabTemplate" onClick={() => (window as any).switchEditorTab('template')}>User Template</div>
            <div className="editor-tab editor-tab-schema" id="tabSchema" onClick={() => (window as any).switchEditorTab('schema')}>
              <svg className="editor-tab-icon" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>Output Schema
            </div>
          </div>

          {/* Editor body */}
          <div className="editor-body">
            <div className="var-legend" id="varLegend" style={{display:'none'}}>
              <div className="var-legend-title">Available Variables<span className="var-legend-hint" id="varLegendHint"></span></div>
              <div className="var-chips" id="varChips"></div>
            </div>
            <textarea className="prompt-textarea" id="systemEditor" placeholder="Select a prompt to start editing..."
              onInput={() => (window as any).onEditorChange()}></textarea>
            <textarea className="prompt-textarea" id="templateEditor" placeholder="User template with {variables}..."
              style={{display:'none'}} onInput={() => (window as any).onEditorChange()}></textarea>
            <div className="schema-viewer" id="schemaViewer"></div>
            <div className="locked-schema-panel" id="lockedSchemaPanel" style={{display:'none'}}>
              <div className="locked-schema-header">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                Server-enforced Output Schema — read only
              </div>
              <div className="locked-schema-body" id="lockedSchemaBody"></div>
            </div>
          </div>

          <div className="editor-footer">
            <span className="editor-footer-meta" id="editorMeta">No prompt loaded</span>
            <span className="editor-footer-meta" id="charCount"></span>
          </div>
        </main>

        {/* ═══ Right: Test Panel ═══ */}
        <aside className="test-panel">
          <div className="test-panel-header">
            <h3>Test &amp; Preview</h3>
            <span id="testPromptLabel" style={{fontSize:'11px',color:'var(--text-2)'}}>No prompt selected</span>
          </div>

          <div className="test-panel-body" id="testPanelBody">

            {/* SHARED: Product Context */}
            <div id="ctxProductInfo" className="test-section" style={{display:'none'}}>
              <div className="test-section-title" style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                <span>Product Context</span>
                <span style={{fontSize:'9px',color:'var(--steel)',fontWeight:500,textTransform:'uppercase',letterSpacing:'.5px'}}>Shared · Flow &amp; Assumptions</span>
              </div>
              <div className="test-field">
                <label>Indication <span className="required-star">*</span></label>
                <input id="fIndication" placeholder="e.g. Non-small cell lung cancer (NSCLC)" onInput={() => (window as any).clearFieldError('fIndication')} />
                <div className="field-error-msg" id="err-fIndication">Indication is required</div>
              </div>
              <div className="test-field">
                <label>Product Name <span className="required-star">*</span></label>
                <input id="fProduct" placeholder="e.g. TUB-040" onInput={() => (window as any).clearFieldError('fProduct')} />
                <div className="field-error-msg" id="err-fProduct">Product name is required</div>
              </div>
              <div className="test-field">
                <label>Drug Class / MoA <span className="required-star">*</span></label>
                <input id="fDrugClass" placeholder="e.g. Antibody-Drug Conjugate (ADC)" onInput={() => (window as any).clearFieldError('fDrugClass')} />
                <div className="field-error-msg" id="err-fDrugClass">Drug class / MoA is required</div>
              </div>
              <div className="test-field">
                <label>Country</label>
                <select id="fCountry">
                  <option value="United States">United States</option>
                  <option value="Germany">Germany</option>
                  <option value="United Kingdom">United Kingdom</option>
                  <option value="France">France</option>
                  <option value="Japan">Japan</option>
                  <option value="China">China</option>
                  <option value="Canada">Canada</option>
                  <option value="Italy">Italy</option>
                  <option value="Spain">Spain</option>
                </select>
              </div>
              <div className="test-field test-field-row">
                <div>
                  <label>Launch Year</label>
                  <input id="fLaunch" type="number" defaultValue={2025} min={2024} max={2040} />
                </div>
                <div>
                  <label>End Year</label>
                  <input id="fPeak" type="number" defaultValue={2035} min={2025} max={2045} />
                </div>
              </div>
            </div>

            {/* Step 2 (Flow): optional instructions */}
            <div id="ctxFlow" className="test-section" style={{display:'none'}}>
              <div className="test-section-title">Additional Instructions <span style={{fontWeight:400,color:'var(--steel)'}}>(optional)</span></div>
              <div className="test-field">
                <textarea id="fQuery" placeholder="e.g. add a compliance rate parameter, split severity into mild/moderate/severe…" style={{minHeight:'70px'}}></textarea>
              </div>
              <div style={{fontSize:'10px',color:'var(--text-2)',lineHeight:1.5,marginTop:'-4px'}}>
                Mention any custom parameters you need — the agent will create them if they're not in the standard list.
              </div>
            </div>

            {/* Step 3 (Assumptions) */}
            <div id="ctxAssumptions" style={{display:'none'}}>
              <div className="test-section" id="flowStructSection">
                <div className="test-section-title" style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                  <span>Flow Structure <span style={{fontWeight:400,color:'var(--text-2)'}}>(from Step 2)</span></span>
                  <button className="btn-add-resource" onClick={() => (window as any).clearFlowStructure()} style={{fontSize:'9px'}}>Clear</button>
                </div>
                <div id="flowStructStatus" style={{fontSize:'11px',color:'var(--text-2)',marginBottom:'6px'}}>
                  Not populated yet — run the <strong>Flow Generation</strong> prompt first, or paste JSON below.
                </div>
                <textarea id="flowStructInput" placeholder="Paste flow structure JSON here (optional)…"
                  style={{minHeight:'55px',fontFamily:"'JetBrains Mono',monospace",fontSize:'10px',resize:'vertical'}}
                  onInput={() => (window as any).onFlowStructChange()} className="prompt-textarea"></textarea>
              </div>

              <div className="test-section">
                <div className="test-section-title">Additional Instructions / Overrides</div>
                <div className="test-field">
                  <textarea id="aQuery" placeholder="e.g. 15-year forecast, gross price $40,000, diagnosis rate 80%…"></textarea>
                </div>
              </div>

              <div className="test-section">
                <div className="test-section-title">Resources</div>
                <div className="resource-list" id="resourceList"></div>
                <div className="resource-add-bar">
                  <input id="urlInput" placeholder="Paste URL…" type="url" />
                  <button className="btn-add-resource" onClick={() => (window as any).addUrlResource()}>+ URL</button>
                </div>
                <div className="resource-add-bar">
                  <input id="textInput" placeholder="Paste note or benchmark data…" />
                  <button className="btn-add-resource" onClick={() => (window as any).addTextResource()}>+ Note</button>
                </div>
                <div className="file-drop-zone" id="dropZone"
                  onDragOver={(e) => (window as any).onDragOver(e)}
                  onDragLeave={(e) => (window as any).onDragLeave(e)}
                  onDrop={(e) => (window as any).onDrop(e)}>
                  <input type="file" id="fileInput" onChange={(e) => (window as any).onFileSelect(e)} accept=".txt,.pdf,.csv,.json,.md" />
                  <div className="file-drop-zone-text">
                    <strong>Upload file</strong> or drag &amp; drop &nbsp;·&nbsp; .txt .csv .json .md .pdf
                  </div>
                </div>
              </div>
            </div>

            {/* Generic context */}
            <div id="ctxGeneric" className="test-section" style={{display:'none'}}>
              <div className="test-section-title">Test Input</div>
              <div className="test-field">
                <label>Query / Input</label>
                <textarea id="gQuery" placeholder="Enter test input for this prompt…" style={{minHeight:'100px'}}></textarea>
              </div>
            </div>

            {/* Empty state */}
            <div id="ctxEmpty" className="test-section" style={{textAlign:'center',padding:'30px 16px',color:'var(--text-2)',fontSize:'12px'}}>
              Select a prompt from the sidebar to configure the test panel.
            </div>

          </div>

          {/* Run button */}
          <div className="test-run-area">
            <button type="button" className="btn-run" id="btnRunTest" onClick={() => (window as any).runTest()} disabled>
              <div className="spinner" id="testSpinner"></div>
              <span id="runBtnLabel">
                <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                Run Test
              </span>
            </button>
          </div>

          {/* Preview area */}
          <div className="preview-area">
            <div className="preview-tab-bar">
              <div className="preview-tab-bar-left">
                <div className="preview-tab active" id="pvTabVisual" onClick={() => (window as any).switchPreviewTab('visual')}>Visual</div>
                <div className="preview-tab" id="pvTabJson" onClick={() => (window as any).switchPreviewTab('json')}>JSON</div>
                <div className="preview-tab" id="pvTabRaw" onClick={() => (window as any).switchPreviewTab('raw')}>Raw</div>
              </div>
              <div id="pvDownloadBar" style={{display:'none',gap:'6px',alignItems:'center'}}></div>
            </div>
            <div className="preview-content" id="pvContent">
              <div className="preview-placeholder">
                <div className="preview-placeholder-icon">⚗️</div>
                <div className="preview-placeholder-text">Run a test to see the output here</div>
              </div>
            </div>
          </div>
        </aside>

      </div>

      {/* ── Publish Modal ── */}
      <div className="modal-backdrop" id="publishModal">
        <div className="modal">
          <h3>Publish to Live?</h3>
          <p>This will overwrite the active prompt used by the agent. A timestamped backup will be saved automatically.<br /><br />
          Make sure you've tested your changes before publishing.</p>
          <div className="modal-actions">
            <button className="btn btn-outline" onClick={() => (window as any).closePublishModal()}>Cancel</button>
            <button className="btn btn-publish" onClick={() => (window as any).publishPrompt()}>Publish Now</button>
          </div>
        </div>
      </div>

      {/* ── Toast container ── */}
      <div className="toast-container" id="toastContainer"></div>

      <Script src="/js/prompt-studio.js" strategy="afterInteractive" />
    </>
  )
}
