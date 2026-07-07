'use client'
import Script from 'next/script'
import { useRef } from 'react'

export default function Home() {
  const urlExtractTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setProcessingState = (active: boolean, message?: string) => {
    const labelSpan = document.getElementById('referenceFileLabel');
    const spinner = document.getElementById('piProcessingSpinner');
    const dropzone = document.getElementById('piDropzone');
    if (spinner) spinner.style.display = active ? 'inline-block' : 'none';
    if (labelSpan && message) {
      labelSpan.textContent = message;
      labelSpan.style.color = active ? 'var(--text)' : labelSpan.style.color;
    }
    if (active) dropzone?.classList.add('has-file');
  };

  const handleExtractionSuccess = (data: {
    fields?: Record<string, string>;
    reference_content?: string;
    source_name?: string;
    session_id?: string;
  }, displayName: string) => {
    const labelSpan = document.getElementById('referenceFileLabel');
    const badge = document.getElementById('uploadDropzoneBadge');
    const dropzone = document.getElementById('piDropzone');
    const spinner = document.getElementById('piProcessingSpinner');

    if (labelSpan) {
      labelSpan.textContent = displayName;
      labelSpan.style.color = 'var(--primary)';
    }
    if (badge) badge.style.display = 'none';
    if (spinner) spinner.style.display = 'none';
    dropzone?.classList.add('has-file');

    (window as any).uploadedRefFile = {
      name: data.source_name || displayName,
      content: data.reference_content || ''
    };

    if (data.fields && typeof (window as any).populateProductInfoFields === 'function') {
      (window as any).populateProductInfoFields(data.fields);
    }
    if (data.session_id && typeof (window as any).setForecastSessionId === 'function') {
      (window as any).setForecastSessionId(data.session_id);
    }
  };

  const handleExtractionError = (message: string) => {
    const labelSpan = document.getElementById('referenceFileLabel');
    const badge = document.getElementById('uploadDropzoneBadge');
    const dropzone = document.getElementById('piDropzone');
    const spinner = document.getElementById('piProcessingSpinner');

    console.error('PI extraction error:', message);
    if (labelSpan) {
      labelSpan.textContent = message.length > 60 ? 'Extraction failed. Try again.' : message;
      labelSpan.style.color = '#dc2626';
    }
    if (badge) badge.style.display = '';
    if (spinner) spinner.style.display = 'none';
    dropzone?.classList.remove('has-file');
    (window as any).uploadedRefFile = null;
  };

  const runExtraction = async (init: RequestInit, displayName: string) => {
    setProcessingState(true, 'Extracting...');
    try {
      const res = await fetch('/api/product-info/extract', init);
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.status === 'ok') {
        handleExtractionSuccess(data, displayName);
      } else {
        const rawDetail = data.detail || data.message;
        const detail = Array.isArray(rawDetail)
          ? rawDetail.map((d: { msg?: string } | string) => (typeof d === 'string' ? d : d.msg || '')).filter(Boolean).join(', ')
          : (rawDetail || 'Extraction failed. Try again.');
        handleExtractionError(typeof detail === 'string' ? detail : 'Extraction failed. Try again.');
      }
    } catch (err) {
      handleExtractionError('Extraction failed. Try again.');
    }
  };

  const uploadReferenceFile = async (file: File | null | undefined) => {
    const labelSpan = document.getElementById('referenceFileLabel');
    const badge = document.getElementById('uploadDropzoneBadge');
    const dropzone = document.getElementById('piDropzone');
    const urlInput = document.getElementById('piSourceUrl') as HTMLInputElement | null;
    if (!file) {
      if (labelSpan) {
        labelSpan.textContent = 'Drag & drop or browse';
        labelSpan.style.color = 'var(--text-2)';
      }
      if (badge) badge.style.display = '';
      dropzone?.classList.remove('has-file');
      (window as any).uploadedRefFile = null;
      return;
    }
    if (urlInput) urlInput.value = '';
    setProcessingState(true, 'Uploading...');
    const formData = new FormData();
    formData.append('file', file);
    await runExtraction({ method: 'POST', body: formData }, file.name);
  };

  const extractFromUrl = async (rawUrl: string) => {
    const url = rawUrl.trim();
    if (!url) return;
    const fileInput = document.getElementById('referenceFile') as HTMLInputElement | null;
    if (fileInput) fileInput.value = '';
    await runExtraction(
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      },
      url.length > 48 ? url.slice(0, 45) + '...' : url
    );
  };

  const scheduleUrlExtraction = (rawUrl: string) => {
    if (urlExtractTimer.current) clearTimeout(urlExtractTimer.current);
    urlExtractTimer.current = setTimeout(() => extractFromUrl(rawUrl), 400);
  };

  return (
    <>
      {/* ═══ Workspace Header ═══ one unified header (brand + AI status + account,
          then the stepper below it) instead of a separate dark navbar sitting
          on top of a second stepper bar — less chrome, one visual system. */}
      <header className="workspace-header">
        <div className="wh-top-row">
          <div className="wh-brand">
            <img src="/whitebglogo.svg" alt="Chryselys" className="wh-logo" />
            <div className="wh-divider"></div>
            <div className="wh-titles">
              <span className="wh-title">ForecastIQ</span>
              <span className="wh-subtitle">Prompt Studio</span>
            </div>
          </div>
          {/* Built via DOM text nodes in syncHeaderContext() (forecast.js), never
              innerHTML with raw field values — productName/indication are free-text
              user input, so this must stay injection-safe. */}
          <div className="wh-context" id="whForecastContext"></div>
          <div className="wh-right">
            <div className="wh-status-group">
              <div className="ai-status-pill" id="aiStatusPill">
                <span className="ai-status-dot" id="aiStatusDot"></span>
                <span id="aiStatusText">AI Ready</span>
              </div>
              {/* Save-status pill intentionally removed for now: there is no
                  load-on-refresh path that restores saved state into the form
                  (saveUserInput() is write-only), so a "Saved" indicator would
                  imply a persistence guarantee the app doesn't actually have.
                  Re-add once a real restore-on-load flow exists. */}
            </div>
            <div className="wh-profile" title="Account">
              <svg viewBox="0 0 24 24" fill="currentColor" width="15" height="15">
                <circle cx="12" cy="8" r="4" />
                <path d="M4 20c0-4.4 3.6-8 8-8s8 3.6 8 8v1H4v-1Z" />
              </svg>
              <svg className="wh-chevron" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
            </div>
          </div>
        </div>
        <div className="wh-steps-row">
          <div className="wh-steps">
            <div className="wh-step active" id="navStep1" onClick={() => (window as any).navigateToSection(1)}>Product</div>
            <div className="wh-step disabled" id="navStep2" onClick={() => (window as any).navigateToSection(2)}>Define Flow</div>
            <div className="wh-step disabled" id="navStep3" onClick={() => (window as any).navigateToSection(3)}>Assumptions</div>
            <div className="wh-step disabled" id="navStep4" onClick={() => (window as any).navigateToSection(4)}>Forecast</div>
            <div className="wh-step disabled" id="navStep5" onClick={() => (window as any).navigateToSection(5)}>Results</div>
          </div>
        </div>
      </header>

      {/* ═══ App Shell ═══ */}
      <div className="app-shell" id="appShell">

        {/* ── Forecast Workspace ── */}
        <div className="workspace" id="workspace">

          {/* ════ Forecast Content ════ */}
          <div className="fc-container">
            {/* Section 1: Product Information */}
            <div className="card pi-step-card" id="productInfoCard">
              <div className="pi-step-header">
                <h2 className="card-title">Product Information</h2>
                <p className="pi-step-hint">Fill in the details below, or upload a Prescribing Information (PI) document and we'll extract them for you.</p>
              </div>

              <label
                htmlFor="referenceFile"
                className="upload-dropzone"
                id="piDropzone"
                onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('drag-active'); }}
                onDragLeave={(e) => { e.currentTarget.classList.remove('drag-active'); }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.currentTarget.classList.remove('drag-active');
                  const file = e.dataTransfer.files?.[0];
                  uploadReferenceFile(file);
                }}
              >
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                <span className="upload-dropzone-text">
                  <span id="referenceFileLabel">Drag &amp; drop or browse</span>
                  <span className="loading-spinner-sm" id="piProcessingSpinner" style={{ display: 'none', marginLeft: '6px' }}></span>
                  <span className="upload-dropzone-badge" id="uploadDropzoneBadge">Recommended</span>
                </span>
                <span className="upload-dropzone-sub">PDF, DOC or DOCX</span>
              </label>
              <input
                type="file"
                id="referenceFile"
                accept=".pdf,.doc,.docx"
                style={{ display: 'none' }}
                onChange={(e) => uploadReferenceFile(e.target.files?.[0])}
              />

              <input
                type="url"
                id="piSourceUrl"
                className="field-chip-input"
                placeholder="Or paste a URL"
                style={{ width: '100%', marginTop: '10px', boxSizing: 'border-box' }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    extractFromUrl((e.target as HTMLInputElement).value);
                  }
                }}
                onBlur={(e) => scheduleUrlExtraction(e.target.value)}
              />

              <div className="or-divider"><span>OR</span></div>
              <div className="manual-entry-label">Manual Entry</div>

              <div className="field-chip-row" id="fieldChipRow">
                <div className="field-chip" data-field="country" onClick={() => (window as any).activateFieldChip('country')}>
                  <span className="field-chip-label">Country*</span>
                  <span className="field-chip-value empty" id="countryChipValue">Select country</span>
                  <select id="country" className="field-chip-input"
                    onChange={() => (window as any).collapseFieldChip('country')}
                    onBlur={() => (window as any).collapseFieldChip('country')}>
                    <option value="">Select Country</option>
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

                <div className="field-chip" data-field="productName" onClick={() => (window as any).activateFieldChip('productName')}>
                  <span className="field-chip-label">Product*</span>
                  <span className="field-chip-value empty" id="productNameChipValue">Add product name</span>
                  <input type="text" id="productName" className="field-chip-input" placeholder="e.g., TUB-040"
                    onBlur={() => (window as any).collapseFieldChip('productName')}
                    onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} />
                </div>

                <div className="field-chip" data-field="classMoa" onClick={() => (window as any).activateFieldChip('classMoa')}>
                  <span className="field-chip-label">Class/MoA*</span>
                  <span className="field-chip-value empty" id="classMoaChipValue">Add class / MoA</span>
                  <input type="text" id="classMoa" className="field-chip-input" placeholder="e.g., Antibody-Drug Conjugate (ADC)"
                    onBlur={() => (window as any).collapseFieldChip('classMoa')}
                    onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} />
                </div>

                <div className="field-chip" data-field="indication" onClick={() => (window as any).activateFieldChip('indication')}>
                  <span className="field-chip-label">Indication*</span>
                  <span className="field-chip-value empty" id="indicationChipValue">Add indication</span>
                  <input type="text" id="indication" className="field-chip-input" placeholder="e.g., Non-small cell lung cancer"
                    onBlur={() => (window as any).collapseFieldChip('indication')}
                    onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} />
                </div>

                <div className="field-chip" data-field="launchYear" onClick={() => (window as any).activateFieldChip('launchYear')}>
                  <span className="field-chip-label">Start*</span>
                  <span className="field-chip-value empty" id="launchYearChipValue">Add year</span>
                  <input type="number" id="launchYear" className="field-chip-input" placeholder="2025" min={2024} max={2040}
                    onBlur={() => (window as any).collapseFieldChip('launchYear')}
                    onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} />
                </div>

                <div className="field-chip" data-field="peakYear" onClick={() => (window as any).activateFieldChip('peakYear')}>
                  <span className="field-chip-label">End*</span>
                  <span className="field-chip-value empty" id="peakYearChipValue">Add year</span>
                  <input type="number" id="peakYear" className="field-chip-input" placeholder="2030" min={2025} max={2045}
                    onBlur={() => (window as any).collapseFieldChip('peakYear')}
                    onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} />
                </div>
              </div>
              <div id="val-warn-launchYear" className="validation-error-msg" style={{ color: '#dc2626', fontSize: '11px', marginTop: '-8px', marginBottom: '10px', display: 'none' }}></div>
              <div id="val-warn-peakYear" className="validation-error-msg" style={{ color: '#dc2626', fontSize: '11px', marginTop: '-8px', marginBottom: '10px', display: 'none' }}></div>

              <p className="button-group-hint">Complete all required fields (*) or upload a PI document.</p>
              <div className="button-group">
                <button id="defineFlowBtn" className="btn btn-primary btn-disabled" disabled={false} onClick={() => (window as any).showParameterSelection()}>Define Forecast Flow →</button>
              </div>
            </div>

            <div className="section-divider" id="div1"></div>

            {/* Section 1.5: Parameter Selection */}
            <div id="parameterSelectionSection" className="card hidden">
              <div className="section-badge">SECTION 1.5</div>
              <h2 className="card-title">Define Forecast Flow</h2>
              <p className="subtitle">Choose a template to auto-configure parameters, or customise manually below.</p>

              {/* Presets Bar — template picker + AI recommendation trigger. The
                  view/edit switch lives inside the flow itself (pencil icon in
                  view mode, "Done" in edit mode), not here. */}
              <div className="presets-bar">
                <h3 className="template-heading">Choose a Forecast Template</h3>
                <div className="preset-chip-row">
                  <button className="preset-chip active" id="preset-standard" onClick={(e) => (window as any).applyPreset('standard', e.currentTarget)}>Standard Forecast Template</button>
                  <button className="preset-chip" id="preset-rare" onClick={(e) => (window as any).applyPreset('rare', e.currentTarget)}>Rare Disease</button>
                  <button className="preset-chip" id="preset-oncology" onClick={(e) => (window as any).applyPreset('oncology', e.currentTarget)}>Oncology</button>
                  <button className="preset-chip" id="preset-custom" onClick={(e) => (window as any).applyPreset('custom', e.currentTarget)}>Custom</button>
                  {/* One control, three states — "Get AI Recommendation" (fetch) →
                      "Apply Recommendation" (apply the fetched result) → "AI
                      Recommended" (now behaves like any other template chip: active
                      while selected, click to restore if you've switched away, click
                      again while active to regenerate). Fully managed by
                      syncAIRecTriggerLabel()/handleAIRecTrigger() in forecast.js.
                      The sparkle sits in its own small badge, not just an inline
                      emoji, so it reads as "AI" tagging the template rather than
                      decoration on the label text. */}
                  <button className="ai-rec-trigger-btn" id="aiRecTriggerBtn" onClick={() => (window as any).handleAIRecTrigger()}>
                    <span className="ai-badge-inline">✨</span> Get AI Recommendation
                  </button>
                </div>
              </div>

              {/* Edit mode: each category is an always-visible, collapsible section;
                  every parameter is its own card, narrower than the one above, so the
                  funnel shape IS the editor instead of a separate summary diagram. */}
              <div id="flowEditWrap">
              <div className="flow-edit-done-row">
                <button className="flow-edit-done-btn" onClick={() => (window as any).toggleFlowEditMode()}>✓ Done</button>
              </div>
              <div className="flow-section" data-accent="navy" data-w="1">
                <div className="flow-section-cap" onClick={(e) => (window as any).toggleFlowSection(e.currentTarget)}>
                  <span className="flow-section-icon">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
                  </span>
                  <div className="flow-section-title-block">
                    <div className="flow-section-name">Epidemiology <span className="flow-section-count" id="flow-count-epidemiology">0/0</span></div>
                  </div>
                  <svg className="flow-section-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
                </div>
                <div className="parameter-list" id="epidemiology-list">
                  <div className="parameter-item" draggable={false} data-param="population">
                    <span className="drag-handle" style={{ visibility: 'hidden' }}>⋮⋮</span>
                    <input type="checkbox" className="param-checkbox" value="population" defaultChecked disabled />
                    <div className="param-info">
                      <div className="param-label-row"><span className="param-label">Total Population</span><span className="param-badge required">Required</span></div>
                      <span className="param-description">Target country population base</span>
                    </div>
                    <div className="param-actions"></div>
                  </div>
                  <div className="choice-group">
                    <span className="choice-pair-label">Choose one</span>
                    <div className="choice-pair">
                      <label className="parameter-item choice-segment" data-param="prevalence">
                        <input type="radio" name="epi-type" className="param-radio" value="prevalence" defaultChecked />
                        <div className="param-info">
                          <div className="param-label-row"><span className="param-label">Prevalence Rate</span><span className="tag ai" title="AI suggests"><span className="tag-ai-star">✨</span>AI</span></div>
                          <span className="param-description">Existing disease burden</span>
                        </div>
                      </label>
                      <label className="parameter-item choice-segment" data-param="incidence">
                        <input type="radio" name="epi-type" className="param-radio" value="incidence" />
                        <div className="param-info">
                          <div className="param-label-row"><span className="param-label">Incidence Rate</span><span className="tag ai" title="AI suggests"><span className="tag-ai-star">✨</span>AI</span></div>
                          <span className="param-description">New cases per year</span>
                        </div>
                      </label>
                    </div>
                  </div>
                  <div className="parameter-item" draggable={true} data-param="severity" onClick={(e) => (window as any).toggleParamCard(e)}>
                    <span className="drag-handle">⋮⋮</span>
                    <input type="checkbox" className="param-checkbox" value="severity" />
                    <div className="param-info">
                      <div className="param-label-row">
                        <span className="param-label" contentEditable={true} suppressContentEditableWarning={true} onBlur={(e) => (window as any).renameParameter('severity', e.currentTarget.textContent)}>Severity / Subtype %</span>
                        <span className="param-badge optional">Optional</span>
                        <span className="tag ai" title="AI suggests"><span className="tag-ai-star">✨</span>AI</span>
                      </div>
                      <span className="param-description">Disease severity or specific subtype prevalence</span>
                    </div>
                    <div className="param-actions">
                      <button className="param-action-btn menu-trigger" onClick={(e) => (window as any).toggleParamMenu(e)} title="More options">⋮</button>
                      <div className="param-menu"><button className="param-menu-item delete" onClick={() => (window as any).deleteParameter('epidemiology', 'severity')}>Delete</button></div>
                    </div>
                  </div>
                  <div className="parameter-item" draggable={true} data-param="diagnosisRate" onClick={(e) => (window as any).toggleParamCard(e)}>
                    <span className="drag-handle">⋮⋮</span>
                    <input type="checkbox" className="param-checkbox" value="diagnosisRate" defaultChecked />
                    <div className="param-info">
                      <div className="param-label-row">
                        <span className="param-label" contentEditable={true} suppressContentEditableWarning={true} onBlur={(e) => (window as any).renameParameter('diagnosisRate', e.currentTarget.textContent)}>Diagnosis Rate</span>
                        <span className="param-badge optional">Optional</span>
                        <span className="tag ai" title="AI suggests"><span className="tag-ai-star">✨</span>AI</span>
                      </div>
                      <span className="param-description">Proportion of patients diagnosed</span>
                    </div>
                    <div className="param-actions">
                      <button className="param-action-btn menu-trigger" onClick={(e) => (window as any).toggleParamMenu(e)} title="More options">⋮</button>
                      <div className="param-menu"><button className="param-menu-item delete" onClick={() => (window as any).deleteParameter('epidemiology', 'diagnosisRate')}>Delete</button></div>
                    </div>
                  </div>
                </div>
                <div id="custom-param-form-epidemiology" className="custom-param-form">
                  <input type="text" id="new-param-name-epidemiology" placeholder="Parameter name" />
                  <input type="text" id="new-param-desc-epidemiology" placeholder="Description" />
                  <div className="button-group">
                    <button className="btn btn-primary" onClick={() => (window as any).addCustomParameter('epidemiology')}>Add</button>
                    <button className="btn btn-secondary" onClick={() => (window as any).cancelAddParameter('epidemiology')}>Cancel</button>
                  </div>
                </div>
                <div className="add-param-wrap"><button className="add-param-fab" onClick={() => (window as any).showAddParameterForm('epidemiology')} title="Add parameter to Epidemiology">+</button></div>
              </div>

              <div className="flow-connector" aria-hidden="true"></div>

              <div className="flow-section" data-accent="green" data-w="2">
                <div className="flow-section-cap" onClick={(e) => (window as any).toggleFlowSection(e.currentTarget)}>
                  <span className="flow-section-icon">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><line x1="12" y1="8" x2="12" y2="14" /><line x1="9" y1="11" x2="15" y2="11" /></svg>
                  </span>
                  <div className="flow-section-title-block">
                    <div className="flow-section-name">Patient Flow &amp; Treatment <span className="flow-section-count" id="flow-count-treatment">0/0</span></div>
                  </div>
                  <svg className="flow-section-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
                </div>
                <div className="parameter-list" id="treatment-list">
                  <div className="parameter-item" draggable={true} data-param="treatmentRate" onClick={(e) => (window as any).toggleParamCard(e)}>
                    <span className="drag-handle">⋮⋮</span>
                    <input type="checkbox" className="param-checkbox" value="treatmentRate" defaultChecked />
                    <div className="param-info">
                      <div className="param-label-row">
                        <span className="param-label" contentEditable={true} suppressContentEditableWarning={true} onBlur={(e) => (window as any).renameParameter('treatmentRate', e.currentTarget.textContent)}>Treatment Rate</span>
                        <span className="param-badge optional">Optional</span>
                        <span className="tag ai" title="AI suggests"><span className="tag-ai-star">✨</span>AI</span>
                      </div>
                      <span className="param-description">Proportion receiving treatment</span>
                    </div>
                    <div className="param-actions">
                      <button className="param-action-btn menu-trigger" onClick={(e) => (window as any).toggleParamMenu(e)} title="More options">⋮</button>
                      <div className="param-menu"><button className="param-menu-item delete" onClick={() => (window as any).deleteParameter('treatment', 'treatmentRate')}>Delete</button></div>
                    </div>
                  </div>
                  <div className="parameter-item" draggable={true} data-param="eligibilityCriteria" onClick={(e) => (window as any).toggleParamCard(e)}>
                    <span className="drag-handle">⋮⋮</span>
                    <input type="checkbox" className="param-checkbox" value="eligibilityCriteria" defaultChecked />
                    <div className="param-info">
                      <div className="param-label-row">
                        <span className="param-label" contentEditable={true} suppressContentEditableWarning={true} onBlur={(e) => (window as any).renameParameter('eligibilityCriteria', e.currentTarget.textContent)}>Eligibility Criteria</span>
                        <span className="param-badge optional">Optional</span>
                        <span className="tag ai" title="AI suggests"><span className="tag-ai-star">✨</span>AI</span>
                      </div>
                      <span className="param-description">Biomarker, line of therapy, inclusion criteria</span>
                    </div>
                    <div className="param-actions">
                      <button className="param-action-btn menu-trigger" onClick={(e) => (window as any).toggleParamMenu(e)} title="More options">⋮</button>
                      <div className="param-menu"><button className="param-menu-item delete" onClick={() => (window as any).deleteParameter('treatment', 'eligibilityCriteria')}>Delete</button></div>
                    </div>
                  </div>
                  <div className="parameter-item" draggable={true} data-param="progressionRate" onClick={(e) => (window as any).toggleParamCard(e)}>
                    <span className="drag-handle">⋮⋮</span>
                    <input type="checkbox" className="param-checkbox" value="progressionRate" />
                    <div className="param-info">
                      <div className="param-label-row">
                        <span className="param-label" contentEditable={true} suppressContentEditableWarning={true} onBlur={(e) => (window as any).renameParameter('progressionRate', e.currentTarget.textContent)}>Progression Rate</span>
                        <span className="param-badge optional">Optional</span>
                        <span className="tag ai" title="AI suggests"><span className="tag-ai-star">✨</span>AI</span>
                      </div>
                      <span className="param-description">Disease progression or line advancement rate</span>
                    </div>
                    <div className="param-actions">
                      <button className="param-action-btn menu-trigger" onClick={(e) => (window as any).toggleParamMenu(e)} title="More options">⋮</button>
                      <div className="param-menu"><button className="param-menu-item delete" onClick={() => (window as any).deleteParameter('treatment', 'progressionRate')}>Delete</button></div>
                    </div>
                  </div>
                </div>
                <div id="custom-param-form-treatment" className="custom-param-form">
                  <input type="text" id="new-param-name-treatment" placeholder="Parameter name" />
                  <input type="text" id="new-param-desc-treatment" placeholder="Description" />
                  <div className="button-group">
                    <button className="btn btn-primary" onClick={() => (window as any).addCustomParameter('treatment')}>Add</button>
                    <button className="btn btn-secondary" onClick={() => (window as any).cancelAddParameter('treatment')}>Cancel</button>
                  </div>
                </div>
                <div className="add-param-wrap"><button className="add-param-fab" onClick={() => (window as any).showAddParameterForm('treatment')} title="Add parameter to Patient Flow &amp; Treatment">+</button></div>
              </div>

              <div className="flow-connector" aria-hidden="true"></div>

              <div className="flow-section" data-accent="gold" data-w="3">
                <div className="flow-section-cap" onClick={(e) => (window as any).toggleFlowSection(e.currentTarget)}>
                  <span className="flow-section-icon">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 3.055A9.003 9.003 0 1020.945 13H11V3.055z" /><path d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" /></svg>
                  </span>
                  <div className="flow-section-title-block">
                    <div className="flow-section-name">Market Dynamics <span className="flow-section-count" id="flow-count-market">0/0</span></div>
                  </div>
                  <svg className="flow-section-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
                </div>
                <div className="parameter-list" id="market-list">
                  <div className="parameter-item" draggable={true} data-param="classShare" onClick={(e) => (window as any).toggleParamCard(e)}>
                    <span className="drag-handle">⋮⋮</span>
                    <input type="checkbox" className="param-checkbox" value="classShare" defaultChecked />
                    <div className="param-info">
                      <div className="param-label-row">
                        <span className="param-label" contentEditable={true} suppressContentEditableWarning={true} onBlur={(e) => (window as any).renameParameter('classShare', e.currentTarget.textContent)}>Peak Class Share</span>
                        <span className="param-badge optional">Optional</span>
                      </div>
                      <span className="param-description">Drug class market share at peak</span>
                    </div>
                    <div className="param-actions">
                      <button className="param-action-btn menu-trigger" onClick={(e) => (window as any).toggleParamMenu(e)} title="More options">⋮</button>
                      <div className="param-menu"><button className="param-menu-item delete" onClick={() => (window as any).deleteParameter('market', 'classShare')}>Delete</button></div>
                    </div>
                  </div>
                  <div className="parameter-item" draggable={true} data-param="peakProductShare" onClick={(e) => (window as any).toggleParamCard(e)}>
                    <span className="drag-handle">⋮⋮</span>
                    <input type="checkbox" className="param-checkbox" value="peakProductShare" defaultChecked />
                    <div className="param-info">
                      <div className="param-label-row">
                        <span className="param-label" contentEditable={true} suppressContentEditableWarning={true} onBlur={(e) => (window as any).renameParameter('peakProductShare', e.currentTarget.textContent)}>Peak Product Share</span>
                        <span className="param-badge optional">Optional</span>
                      </div>
                      <span className="param-description">Product share within class at peak</span>
                    </div>
                    <div className="param-actions">
                      <button className="param-action-btn menu-trigger" onClick={(e) => (window as any).toggleParamMenu(e)} title="More options">⋮</button>
                      <div className="param-menu"><button className="param-menu-item delete" onClick={() => (window as any).deleteParameter('market', 'peakProductShare')}>Delete</button></div>
                    </div>
                  </div>
                </div>
                <div id="custom-param-form-market" className="custom-param-form">
                  <input type="text" id="new-param-name-market" placeholder="Parameter name" />
                  <input type="text" id="new-param-desc-market" placeholder="Description" />
                  <div className="button-group">
                    <button className="btn btn-primary" onClick={() => (window as any).addCustomParameter('market')}>Add</button>
                    <button className="btn btn-secondary" onClick={() => (window as any).cancelAddParameter('market')}>Cancel</button>
                  </div>
                </div>
                <div className="add-param-wrap"><button className="add-param-fab" onClick={() => (window as any).showAddParameterForm('market')} title="Add parameter to Market Dynamics">+</button></div>
              </div>

              <div className="flow-connector" aria-hidden="true"></div>

              <div className="flow-section" data-accent="orange" data-w="4">
                <div className="flow-section-cap" onClick={(e) => (window as any).toggleFlowSection(e.currentTarget)}>
                  <span className="flow-section-icon">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41 11 3.83A2 2 0 0 0 9.59 3.24H4a1 1 0 0 0-1 1v5.59a2 2 0 0 0 .59 1.41l9.58 9.59a2 2 0 0 0 2.82 0l4.6-4.6a2 2 0 0 0 0-2.82Z" /><circle cx="7.5" cy="7.5" r="1.5" /></svg>
                  </span>
                  <div className="flow-section-title-block">
                    <div className="flow-section-name">Pricing &amp; Access <span className="flow-section-count" id="flow-count-pricing">0/0</span></div>
                  </div>
                  <svg className="flow-section-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
                </div>
                <div className="parameter-list" id="pricing-list">
                  <div className="parameter-item" draggable={true} data-param="annualCostPerPatient" onClick={(e) => (window as any).toggleParamCard(e)}>
                    <span className="drag-handle">⋮⋮</span>
                    <input type="checkbox" className="param-checkbox" value="annualCostPerPatient" defaultChecked />
                    <div className="param-info">
                      <div className="param-label-row">
                        <span className="param-label" contentEditable={true} suppressContentEditableWarning={true} onBlur={(e) => (window as any).renameParameter('annualCostPerPatient', e.currentTarget.textContent)}>Annual Cost per Patient</span>
                        <span className="param-badge optional">Optional</span>
                      </div>
                      <span className="param-description">Annual treatment cost (gross)</span>
                    </div>
                    <div className="param-actions">
                      <button className="param-action-btn menu-trigger" onClick={(e) => (window as any).toggleParamMenu(e)} title="More options">⋮</button>
                      <div className="param-menu"><button className="param-menu-item delete" onClick={() => (window as any).deleteParameter('pricing', 'annualCostPerPatient')}>Delete</button></div>
                    </div>
                  </div>
                  <div className="parameter-item" draggable={true} data-param="discount" onClick={(e) => (window as any).toggleParamCard(e)}>
                    <span className="drag-handle">⋮⋮</span>
                    <input type="checkbox" className="param-checkbox" value="discount" defaultChecked />
                    <div className="param-info">
                      <div className="param-label-row">
                        <span className="param-label" contentEditable={true} suppressContentEditableWarning={true} onBlur={(e) => (window as any).renameParameter('discount', e.currentTarget.textContent)}>Discount / Rebate Rate</span>
                        <span className="param-badge optional">Optional</span>
                      </div>
                      <span className="param-description">Net pricing after discounts and rebates</span>
                    </div>
                    <div className="param-actions">
                      <button className="param-action-btn menu-trigger" onClick={(e) => (window as any).toggleParamMenu(e)} title="More options">⋮</button>
                      <div className="param-menu"><button className="param-menu-item delete" onClick={() => (window as any).deleteParameter('pricing', 'discount')}>Delete</button></div>
                    </div>
                  </div>
                </div>
                <div id="custom-param-form-pricing" className="custom-param-form">
                  <input type="text" id="new-param-name-pricing" placeholder="Parameter name" />
                  <input type="text" id="new-param-desc-pricing" placeholder="Description" />
                  <div className="button-group">
                    <button className="btn btn-primary" onClick={() => (window as any).addCustomParameter('pricing')}>Add</button>
                    <button className="btn btn-secondary" onClick={() => (window as any).cancelAddParameter('pricing')}>Cancel</button>
                  </div>
                </div>
                <div className="add-param-wrap"><button className="add-param-fab" onClick={() => (window as any).showAddParameterForm('pricing')} title="Add parameter to Pricing &amp; Access">+</button></div>
              </div>
              </div>

              {/* View mode (default): a single read-only, grouped flow of only the
                  currently active parameters — no unselected rows, no always-on
                  editing chrome. Each node's own hover-pencil handles day-to-day
                  toggles inline; "Edit Flow" here is only for renaming, reordering,
                  or adding custom parameters. Populated by renderFlowViewMode() in
                  forecast.js whenever the selection changes. */}
              <div id="flowViewWrap" className="flow-view-wrap">
                <div className="flow-view-header">
                  <button id="flowEditPencil" className="flow-view-edit-link" onClick={() => (window as any).toggleFlowEditMode()}>
                    <span aria-hidden="true">✎</span> Edit Flow
                  </button>
                </div>
                <div id="flowViewRows" className="flow-view-rows"></div>
              </div>

              <div className="button-group">
                <button className="btn btn-primary" onClick={(e) => (window as any).generateAssumptions(e)}>Generate Assumptions</button>
                <button className="btn btn-secondary" onClick={() => (window as any).backToProductInfo()}>← Back</button>
              </div>
            </div>

            <div className="section-divider" id="div2"></div>

            {/* Section 2: Assumptions */}
            <div id="assumptionsSection" className="card hidden" style={{ position: 'relative' }}>
              <div className="section-badge">SECTION 2</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                <div>
                  <h2 className="card-title" style={{ marginBottom: '4px' }}>Forecast Assumptions &amp; Validation</h2>
                  <p className="subtitle" style={{ marginBottom: 0 }}>Review and modify epidemiological, market, and pricing assumptions</p>
                </div>
                <div id="assumptionsFlowPreview" style={{ marginTop: '4px' }}></div>
              </div>

              <div id="validationStatus" className="validation-status success hidden">
                <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                  <circle cx="10" cy="10" r="9" stroke="currentColor" strokeWidth="2" />
                  <path d="M6 10l3 3 5-6" stroke="currentColor" strokeWidth="2" fill="none" />
                </svg>
                <span id="validationMessage">All assumptions validated successfully</span>
              </div>

              <div className="section-header" style={{ marginTop: '20px' }}>
                <h3 style={{ fontSize: '15px', fontWeight: 700 }}>Epidemiology &amp; Market Parameters</h3>
                <button className="btn btn-secondary toggle-btn" onClick={() => (window as any).toggleRationale()}>Show/Hide Rationale</button>
              </div>
              <div className="results-table">
                <table id="assumptionsTable">
                  <thead>
                    <tr>
                      <th>Parameter</th>
                      <th>Value</th>
                      <th>Unit</th>
                      <th>Range (Low–High)</th>
                      <th className="rationale-col">Rationale</th>
                    </tr>
                  </thead>
                  <tbody id="assumptionsBody"></tbody>
                </table>
              </div>
              <div className="notice"><strong>Review Assumptions:</strong> Modify any values before computing commercial potential.</div>
              <div className="button-group">
                <button className="btn btn-primary" onClick={() => (window as any).calculateForecast()}>Calculate Forecast</button>
                <button id="viewResultsBtn" className="btn btn-primary" onClick={() => (window as any).viewExistingResults()} style={{ display: 'none' }}>View Results →</button>
                <button className="btn btn-secondary" onClick={() => (window as any).resetAssumptions()}>Reset to Defaults</button>
              </div>
            </div>

            <div className="section-divider" id="div3"></div>

            {/* Section 3: Forecast Engine */}
            <div id="forecastEngineSection" className="card hidden">
              <div className="section-badge">SECTION 3</div>

              {/* Dramatic Engine Execution Screen */}
              <div className="engine-overlay" id="engineOverlay">
                <div style={{ marginBottom: '18px', display: 'flex', justifyContent: 'center' }}>
                  <svg width="40" height="40" fill="none" stroke="var(--primary)" strokeWidth="1.5" viewBox="0 0 24 24" opacity={0.85}>
                    <circle cx="12" cy="12" r="3" />
                    <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
                  </svg>
                </div>
                <div className="engine-run-title" id="engineRunTitle">Running Forecast Engine</div>
                <div className="engine-run-subtitle" id="engineStatusText">Initialising calculation pipeline…</div>
                <div className="engine-steps" id="engineSteps">
                  <div className="engine-step pending" id="estep1"><span className="engine-step-icon">○</span><span className="engine-step-label">Epidemiology modelling</span></div>
                  <div className="engine-step pending" id="estep2"><span className="engine-step-icon">○</span><span className="engine-step-label">Patient flow simulation</span></div>
                  <div className="engine-step pending" id="estep3"><span className="engine-step-icon">○</span><span className="engine-step-label">Market adoption modelling</span></div>
                  <div className="engine-step pending" id="estep4"><span className="engine-step-icon">○</span><span className="engine-step-label">Revenue projection</span></div>
                  <div className="engine-step pending" id="estep5"><span className="engine-step-icon">○</span><span className="engine-step-label">Scenario validation</span></div>
                </div>
                <div className="engine-progress-wrap">
                  <div className="engine-progress">
                    <div className="engine-progress-bar" id="engineProgressBar"></div>
                  </div>
                  <div className="engine-progress-label" id="engineProgressLabel">0%</div>
                </div>
              </div>

              {/* Detailed Calculation Sheet */}
              <div id="engineDetails" style={{ display: 'none' }}>
                <h2 className="card-title">Year-by-Year Calculation Sheet</h2>
                <p className="subtitle">Transparent calculation of all intermediate steps in the patient flow</p>
                <div id="calculationEngine" style={{ marginTop: '16px' }}></div>
              </div>

              <div className="button-group" id="engineBtns" style={{ display: 'none' }}>
                <button className="btn btn-primary" onClick={() => (window as any).proceedToResults()}>View Summary &amp; Charts →</button>
                <button className="btn btn-secondary" onClick={() => (window as any).backToAssumptions()}>← Back to Assumptions</button>
              </div>
            </div>

            <div className="section-divider" id="div4"></div>

            {/* Section 4: Results */}
            <div id="resultsSection" className="card hidden">
              <div className="section-badge">SECTION 5</div>

              <h2 className="card-title">Forecast Results</h2>
              <p className="subtitle">Commercial patient-based forecast summary — peak sales, patient volume, and market share analysis</p>

              {/* KPI Metric Strip */}
              <div className="insight-grid">
                <div className="insight-card primary">
                  <div className="insight-card-body">
                    <div className="insight-label">Peak Net Sales</div>
                    <div className="insight-value" id="insightPeakSales">—</div>
                    <div className="insight-sub" id="insightPeakYear">—</div>
                  </div>
                </div>
                <div className="insight-card success">
                  <div className="insight-card-body">
                    <div className="insight-label">Peak Patient Volume</div>
                    <div className="insight-value" id="insightPeakPts">—</div>
                    <div className="insight-sub">Treated patients at peak</div>
                  </div>
                </div>
                <div className="insight-card info">
                  <div className="insight-card-body">
                    <div className="insight-label">Peak Gross Sales</div>
                    <div className="insight-value" id="insightGross">—</div>
                    <div className="insight-sub" id="insightDiscount">—</div>
                  </div>
                </div>
              </div>

              {/* Key Drivers strip */}
              <div className="insight-drivers-row" id="insightDriversRow">
                <span className="insight-drivers-row-label">Key Drivers</span>
                <div id="insightDriverChips"></div>
              </div>

              {/* Legacy element — hidden, kept for JS compat */}
              <div style={{ display: 'none' }} id="insightDrivers"></div>

              {/* Charts */}
              <div className="chart-grid">
                <div className="chart-container">
                  <div className="chart-title">Revenue Forecast ($M)</div>
                  <canvas id="salesChart"></canvas>
                </div>
                <div className="chart-container">
                  <div className="chart-title">Treated Patient Volume</div>
                  <canvas id="patientsChart"></canvas>
                </div>
              </div>
              {/* Hidden canvas kept so shareChart.destroy() doesn't throw */}
              <canvas id="shareChart" style={{ display: 'none' }}></canvas>

              {/* Sensitivity / Tornado Chart */}
              <div id="sensitivitySection" style={{ display: 'none', marginTop: '24px' }}>
                <h3 className="results-section-heading">Sensitivity Analysis — Peak Net Sales Impact</h3>
                <p style={{ fontSize: '12px', color: 'var(--text-2)', marginBottom: '12px' }}>Each bar shows the range of peak net sales ($M) when the assumption is varied ±20% from base. Wider bars are higher-leverage assumptions.</p>
                <div className="chart-container" style={{ padding: '16px 20px' }}>
                  <canvas id="tornadoChart"></canvas>
                </div>
              </div>

              {/* Year-by-Year Forecast Table */}
              <div className="results-table-card">
                <h3 className="results-section-heading">Year-by-Year Forecast</h3>
                <div className="results-table">
                  <table id="forecastResultsTable" className="results-data-table">
                    <thead>
                      <tr>
                        <th colSpan={2}>Metric</th>
                        <th>Year</th>
                      </tr>
                    </thead>
                    <tbody id="forecastBody"></tbody>
                  </table>
                </div>
                <div className="forecast-table-legend" id="forecastTableLegend"></div>
              </div>

              {/* Hidden legacy KPI spans */}
              <span id="peakSalesYear" style={{ display: 'none' }}></span>
              <span id="peakGrossSales" style={{ display: 'none' }}></span>
              <span id="peakNetSales" style={{ display: 'none' }}></span>
              <span id="peakPatients" style={{ display: 'none' }}></span>

              {/* Excel Workbook Preview */}
              <h3 className="results-section-heading">Excel Workbook Preview</h3>
              <p className="subtitle" style={{ marginBottom: 0 }}>Generated by the Forecast Agent — use the tabs to navigate sheets</p>
              <div id="excelViewerPanel" style={{ marginTop: '12px', border: '1px solid var(--border)', borderRadius: 'var(--r8)', overflow: 'hidden', display: 'flex', flexDirection: 'column', height: '520px' }}>
                <div className="xv-titlebar">
                  <div className="xv-titlebar-logo">X<span>|</span></div>
                  <div className="xv-titlebar-filename" id="xv-file-label">Building workbook…</div>
                  <div id="xv-gen-spinner" className="xv-spinner-sm" style={{ marginLeft: '8px' }} title="Generating workbook…"></div>
                  <span id="xv-preview-badge" style={{ display: 'none', marginLeft: '8px', background: '#e8f0f7', color: '#1A4F72', border: '1px solid #b6cfe0', borderRadius: '3px', fontSize: '10px', fontWeight: 600, padding: '1px 6px', letterSpacing: '.3px', flexShrink: 0 }}>PREVIEW</span>
                  <div className="xv-titlebar-right hidden" id="xv-stats">
                    <div>Rows: <strong id="xv-stat-rows">—</strong></div>
                    <div>Cols: <strong id="xv-stat-cols">—</strong></div>
                    <div>Sheets: <strong id="xv-stat-sheets">—</strong></div>
                  </div>
                  <button className="xv-fullscreen-btn" id="xv-fullscreen-btn" onClick={() => (window as any)._xvToggleFullscreen()} title="Fullscreen preview">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="9,1 13,1 13,5" /><polyline points="5,13 1,13 1,9" />
                      <line x1="13" y1="1" x2="8" y2="6" /><line x1="1" y1="13" x2="6" y2="8" />
                    </svg>
                  </button>
                </div>
                <div className="xv-formula-bar">
                  <div className="xv-name-box" id="xv-cell-ref"></div>
                  <div className="xv-fx-btn">ƒx</div>
                  <div className="xv-formula-content" id="xv-cell-formula"></div>
                </div>

                {/* Skeleton loader */}
                <div id="xv-skeleton" className="xv-skel">
                  <div className="xv-skel-col-header" id="xv-skel-col-hdr"></div>
                  <div id="xv-skel-rows" style={{ flex: 1, overflow: 'hidden' }}></div>
                  <div className="xv-skel-tabs" id="xv-skel-tabs-bar"></div>
                  <div className="xv-stage-log" id="xv-stage-log"></div>
                  <div className="xv-skel-progress-bar">
                    <div className="xv-skel-progress-track">
                      <div className="xv-skel-progress-fill" id="xv-skel-fill" style={{ width: '2%' }}></div>
                    </div>
                    <span className="xv-skel-progress-label" id="xv-skel-label">Building workbook…</span>
                  </div>
                </div>

                {/* Pending sheet placeholder */}
                <div id="xv-pending-sheet" className="xv-pending-sheet" style={{ display: 'none' }}>
                  <div className="xv-pending-sheet-icon">⚙</div>
                  <div className="xv-pending-sheet-title" id="xv-pending-sheet-name">Sheet generating…</div>
                  <div className="xv-pending-sheet-sub">The AI agent is building this sheet — it will appear automatically when ready</div>
                </div>
                {/* Updated toast */}
                <div className="xv-updated-toast" id="xv-updated-toast">✓ Full workbook ready — Calculations &amp; Summary now available</div>
                <div id="xv-loading" style={{ flex: 1, display: 'none', alignItems: 'center', justifyContent: 'center', gap: '10px', color: '#888', fontSize: '13px', fontFamily: "'Segoe UI',sans-serif" }}>
                  <div className="xv-spinner"></div><div>Loading workbook…</div>
                </div>
                <div id="xv-error" style={{ flex: 1, display: 'none', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px', color: '#c00', fontSize: '13px', fontFamily: "'Segoe UI',sans-serif" }}>
                  <div style={{ fontSize: '28px' }}>⚠</div>
                  <div id="xv-error-msg">Could not load file.</div>
                </div>
                <div className="xv-grid-wrapper hidden" id="xv-grid-wrapper">
                  <table id="xv-grid"></table>
                </div>
                <div className="xv-bottom-bar">
                  <div className="xv-tabs-bar" id="xv-tabs-bar"></div>
                </div>
                <div className="xv-status-bar hidden" id="xv-status-bar">
                  <div>Average: <strong id="xv-stat-avg">—</strong></div>
                  <div>Count: <strong id="xv-stat-count">—</strong></div>
                  <div>Sum: <strong id="xv-stat-sum">—</strong></div>
                </div>
              </div>

              <div className="results-bottom-bar">
                <a className="btn-export-excel btn-disabled" id="downloadExcelBtn" href="#" download="forecast.xlsx">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                  Download Workbook
                </a>
                <a className="btn-export-pptx btn-disabled" id="downloadPptxBtn" href="#" download="forecast_presentation.pptx">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                  Download Presentation
                </a>
                <span className="pptx-status-badge" id="pptxStatusBadge">
                  <span className="pptx-status-dot"></span>
                  Preparing presentation…
                </span>
                <div className="spacer"></div>
                <button className="btn-start-over" onClick={() => (window as any).startOver()}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /></svg>
                  New Forecast
                </button>
              </div>
            </div>

          </div>{/* /fc-container */}
        </div>{/* /workspace */}

        {/* ── AI Chat Panel ── */}
        <div className="chat-panel" id="chatPanel">
          <div className="chat-resize-handle" id="chatResizeHandle" title="Drag to resize chat"></div>
          <div className="chat-header">
            <div className="chat-header-actions">
              <button className="new-chat-btn" onClick={() => (window as any).clearChat()} title="New chat" aria-label="New chat">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 20h9" />
                  <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
                </svg>
              </button>
              <button className="chat-close-btn" onClick={() => (window as any).toggleChat()} title="Close AI Copilot" aria-label="Close AI Copilot">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          </div>

          <div className="messages" id="messages"></div>
          <div id="quickRepliesContainer" className="quick-replies"></div>

          <div className="chat-input-row" id="chatInputRow">
            <input id="chatInput" placeholder="Ask me anything…" onKeyDown={(e) => { if (e.key === 'Enter') (window as any).sendMessage(); }} />
            <button className="send-btn" onClick={() => (window as any).sendMessage()}>
              <svg width="14" height="14" fill="none" stroke="#fff" strokeWidth="2.5" viewBox="0 0 24 24">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </div>
        </div>

      </div>{/* /app-shell */}

      <button className="chat-fab" id="chatFab" onClick={() => (window as any).toggleChat()} aria-label="Copilot" title="Copilot">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <defs>
            <linearGradient id="copilotIconGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#E8720C" />
              <stop offset="100%" stopColor="#C9922A" />
            </linearGradient>
          </defs>
          <path d="M12 2.5c.9 2.6 2.1 3.8 4.7 4.7-2.6.9-3.8 2.1-4.7 4.7-.9-2.6-2.1-3.8-4.7-4.7 2.6-.9 3.8-2.1 4.7-4.7Z" fill="url(#copilotIconGrad)" />
          <path d="M18.5 13c.5 1.5 1.2 2.2 2.7 2.7-1.5.5-2.2 1.2-2.7 2.7-.5-1.5-1.2-2.2-2.7-2.7 1.5-.5 2.2-1.2 2.7-2.7Z" fill="url(#copilotIconGrad)" opacity="0.75" />
        </svg>
      </button>

      {/* Footer */}
      <div style={{ background: 'linear-gradient(90deg, #0F2F47 0%, #1A4F72 100%)', borderTop: '1px solid #C9922A', padding: '3px 28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '9.5px', color: 'rgba(168,196,212,0.75)', fontFamily: "'Inter','Segoe UI',sans-serif", flexShrink: 0, letterSpacing: '.2px' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
          <span style={{ color: '#C9922A', fontWeight: 700, fontSize: '9.5px', letterSpacing: '.4px', textTransform: 'uppercase' }}>Chryselys</span>
          <span style={{ width: '1px', height: '9px', background: 'rgba(168,196,212,0.3)', display: 'inline-block' }}></span>
          <span>&copy; 2026</span>
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
          <span>www.chryselys.com</span>
          <span style={{ color: 'rgba(168,196,212,0.4)' }}>|</span>
          <span>info@chryselys.com</span>
        </span>
      </div>

      {/* CDN Scripts */}
      <Script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js" strategy="afterInteractive" />
      <Script src="https://cdn.jsdelivr.net/npm/hyperformula@2.6.0/dist/hyperformula.full.min.js" strategy="afterInteractive" />
      <Script src="/js/forecast.js?v=20" strategy="afterInteractive" />
    </>
  )
}
