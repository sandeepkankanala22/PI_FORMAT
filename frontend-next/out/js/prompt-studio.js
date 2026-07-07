// ─────────────────────────────────────────────────────────────────────
// State
// ─────────────────────────────────────────────────────────────────────
let _prompts = [];            // all prompt metadata from /api/prompts
let _selected = null;         // currently selected prompt name
let _lockedSchemas = {};      // server-enforced output schemas keyed by test_type
let _liveData = null;         // {system_prompt, user_template} from server
let _draftData = null;        // {system_prompt, user_template} from server (if draft)
let _hasDraft = false;
let _editorTab = 'system';    // 'system' | 'template'
let _previewTab = 'visual';   // 'visual' | 'json' | 'raw'
let _lastResult = null;       // last test result
let _resources = [];          // [{id, type, name, content}]
let _dirty = false;           // unsaved editor changes
let _sessionFlowResult = null; // parsed funnel from the last Step 2 test run

// ─────────────────────────────────────────────────────────────────────
// Init
// ─────────────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  loadPromptList();
});

async function loadPromptList() {
  try {
    const [r, rs] = await Promise.all([
      fetch('/api/prompts'),
      fetch('/api/prompts/locked-schema'),
    ]);
    const data = await r.json();
    _prompts = data.prompts || [];
    if (rs.ok) _lockedSchemas = await rs.json();
    renderSidebar();
  } catch(e) {
    document.getElementById('sidebarList').innerHTML =
      '<div style="padding:16px; color:var(--danger); font-size:12px;">Failed to load prompts</div>';
  }
}

function renderSidebar() {
  const featured = _prompts.filter(p => p.featured).sort((a, b) => (a.step || 99) - (b.step || 99));
  const others   = _prompts.filter(p => !p.featured);
  let html = '';

  if (featured.length) {
    html += '<div class="sidebar-group-label">Featured</div>';
    featured.forEach(p => { html += promptItemHTML(p); });
  }
  if (others.length) {
    html += '<div class="sidebar-group-label">All Prompts</div>';
    others.forEach(p => { html += promptItemHTML(p); });
  }
  document.getElementById('sidebarList').innerHTML = html;
}

const _TYPE_BADGE = { flow: 'Flow', assumptions: 'Assumptions' };
const _TYPE_ICON  = { flow: '⇢', assumptions: '⊙' };

function promptItemHTML(p) {
  const icon = _TYPE_ICON[p.test_type] || p.name.charAt(0).toUpperCase();
  const typeBadge = _TYPE_BADGE[p.test_type] || (p.step ? `Step ${p.step}` : '');
  const featuredClass = p.featured ? 'featured' : '';
  const activeClass = p.name === _selected ? 'active' : '';
  return `
    <div class="prompt-item ${featuredClass} ${activeClass}" id="item-${p.name}" onclick="selectPrompt('${p.name}')">
      <div class="prompt-item-icon">${icon}</div>
      <div class="prompt-item-body">
        <div class="prompt-item-label">${p.label}</div>
        <div class="prompt-item-desc">${p.description}</div>
        <div class="prompt-item-badges">
          ${typeBadge ? `<span class="badge badge-step">${typeBadge}</span>` : ''}
          ${p.has_draft ? `<span class="badge badge-draft">Draft</span>` : ''}
        </div>
      </div>
    </div>`;
}

// ─────────────────────────────────────────────────────────────────────
// Select prompt
// ─────────────────────────────────────────────────────────────────────
async function selectPrompt(name) {
  if (_selected === name) return;
  _selected = name;
  _dirty = false;
  _lastResult = null;
  _resources = [];
  renderResourceList();

  // Update sidebar active state
  document.querySelectorAll('.prompt-item').forEach(el => el.classList.remove('active'));
  const item = document.getElementById(`item-${name}`);
  if (item) item.classList.add('active');

  // Fetch prompt data
  try {
    const r = await fetch(`/api/prompts/${name}`);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = await r.json();
    _liveData  = data.live;
    _draftData = data.draft;
    _hasDraft  = data.has_draft;

    const meta = _prompts.find(p => p.name === name) || {};

    // Populate editor
    const activeData = _hasDraft ? _draftData : _liveData;
    document.getElementById('systemEditor').value   = activeData.system_prompt || '';
    document.getElementById('templateEditor').value = activeData.user_template || '';

    // Update topbar
    document.getElementById('editorPromptName').textContent = meta.label || name;
    document.getElementById('editorPromptDesc').textContent = meta.description || '';
    document.getElementById('editorActions').style.display = 'flex';

    // Draft indicators
    updateDraftIndicators();
    updateLockedSchemaPanel();

    // Variables — rendered dynamically by updateVarChips()
    updateVarChips();

    // Switch to system tab by default
    switchEditorTab('system');
    updateCharCount();
    updateEditorMeta(meta, data);

    // Configure test panel
    configureTestPanel(meta);

  } catch(e) {
    toast('Failed to load prompt: ' + e.message, 'error');
  }
}

function updateDraftIndicators() {
  const li = document.getElementById('liveIndicator');
  const di = document.getElementById('draftIndicator');
  const btnPublish = document.getElementById('btnPublish');
  const btnDiscard = document.getElementById('btnDiscard');

  if (_hasDraft || _dirty) {
    di.style.display = 'flex';
    li.style.display = 'none';
    btnPublish.disabled = !_hasDraft;
    // Show Discard for saved drafts, "Reset" for local unsaved edits
    btnDiscard.style.display = 'inline-flex';
    btnDiscard.textContent = _hasDraft ? 'Discard Draft' : 'Reset to Live';
  } else {
    di.style.display = 'none';
    li.style.display = 'flex';
    btnPublish.disabled = true;
    btnDiscard.style.display = 'none';
  }
}

function updateEditorMeta(meta, data) {
  const rawTs = data.last_modified || '';
  const d = rawTs ? new Date(rawTs) : null;
  const ts = (d && !isNaN(d)) ? d.toLocaleString() : '—';
  document.getElementById('editorMeta').textContent =
    `${meta.name || ''} · Last modified ${ts}${_hasDraft ? ' · Draft exists' : ''}`;
}

// ─────────────────────────────────────────────────────────────────────
// Editor interactions
// ─────────────────────────────────────────────────────────────────────
function switchEditorTab(tab) {
  _editorTab = tab;
  const isSchema = tab === 'schema';
  document.getElementById('tabSystem').classList.toggle('active', tab === 'system');
  document.getElementById('tabTemplate').classList.toggle('active', tab === 'template');
  document.getElementById('tabSchema').classList.toggle('active', isSchema);
  document.getElementById('systemEditor').style.display   = tab === 'system'   ? 'block' : 'none';
  document.getElementById('templateEditor').style.display = tab === 'template' ? 'block' : 'none';
  const sv = document.getElementById('schemaViewer');
  sv.classList.toggle('visible', isSchema);
  if (isSchema) renderSchemaTab();
  if (!isSchema) updateCharCount();
  updateLockedSchemaPanel();
  updateVarChips();
}

function renderSchemaTab() {
  const viewer = document.getElementById('schemaViewer');
  if (!viewer) return;
  const meta   = _prompts.find(p => p.name === _selected) || {};
  const schema = _lockedSchemas[meta.test_type];
  if (!schema) {
    viewer.innerHTML = '<div class="schema-viewer-empty">No locked output schema for this prompt type.</div>';
    return;
  }
  viewer.innerHTML = `
    <div class="schema-viewer-note">
      This output schema is <strong>always appended</strong> to the user message by the server and
      cannot be edited in the prompt. Your system and user templates shape the agent's reasoning —
      the final JSON answer must always match this format exactly.
    </div>
    <pre class="schema-viewer-pre">${escHtml(schema)}</pre>`;
}

function updateLockedSchemaPanel() {
  const panel = document.getElementById('lockedSchemaPanel');
  const body  = document.getElementById('lockedSchemaBody');
  const schemaTab = document.getElementById('tabSchema');
  if (!panel || !body) return;
  const meta   = _prompts.find(p => p.name === _selected) || {};
  const schema = _lockedSchemas[meta.test_type];

  // Show/hide the Output Schema tab based on whether this prompt type has a locked schema
  if (schemaTab) schemaTab.style.display = schema ? 'block' : 'none';

  // If we're hiding the schema tab while it's active, fall back to system tab
  if (!schema && _editorTab === 'schema') {
    switchEditorTab('system');
    return;
  }

  // Show the inline hint panel only on the User Template tab
  const onTemplateTab = (_editorTab === 'template');
  if (schema && onTemplateTab) {
    body.textContent = schema;
    panel.style.display = 'block';
  } else {
    panel.style.display = 'none';
  }
}

function updateVarChips() {
  const legend = document.getElementById('varLegend');
  const chips  = document.getElementById('varChips');
  const title  = legend?.querySelector('.var-legend-title');
  if (!legend || !chips) return;

  if (_editorTab === 'schema') {
    legend.style.display = 'none';
    return;
  }

  const meta      = _prompts.find(p => p.name === _selected) || {};
  const knownVars = new Set(meta.variables || []);

  // Variables already present in the saved (live) prompt are intentional — treat as known
  if (_liveData) {
    const liveText = (_liveData.system_prompt || '') + '\n' + (_liveData.user_template || '');
    for (const m of liveText.matchAll(/\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g)) knownVars.add(m[1]);
  }

  const hint = document.getElementById('varLegendHint');

  // Scan BOTH textareas so variables stay in sync regardless of active tab
  const systemText   = document.getElementById('systemEditor')?.value   || '';
  const templateText = document.getElementById('templateEditor')?.value || '';
  const combined     = systemText + '\n' + templateText;
  const found = [...new Set([...combined.matchAll(/\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g)].map(m => m[1]))];

  function chipHTML(v, known) {
    const cls = known ? 'var-chip' : 'var-chip var-chip-unknown';
    const tip = known
      ? 'Click to insert at cursor'
      : 'Not a server-substituted variable — will be sent as literal text. Click to insert.';
    return `<span class="${cls}" title="${tip}" onclick="insertVar('${v}')">{${escHtml(v)}}</span>`;
  }

  if (found.length) {
    legend.style.display = 'block';
    if (title) title.textContent = 'Variables in use';
    if (hint) hint.textContent = '· click to insert';
    const hasUnknown = found.some(v => !knownVars.has(v));
    chips.innerHTML = found.map(v => chipHTML(v, knownVars.has(v))).join('');
    // Append legend for unknown vars if any exist
    if (hasUnknown) {
      chips.innerHTML += `<span style="font-size:9px;color:var(--steel);align-self:center;margin-left:4px;">
        <span style="color:var(--gold);">■</span> not substituted by server</span>`;
    }
  } else {
    // Fallback: static list from server metadata — clickable shortcuts
    if (knownVars.size) {
      legend.style.display = 'block';
      if (title) title.textContent = 'Available Variables';
      if (hint) hint.textContent = '· click to insert';
      chips.innerHTML = [...knownVars].map(v => chipHTML(v, true)).join('');
    } else {
      legend.style.display = 'none';
    }
  }
}

function insertVar(name) {
  if (_editorTab === 'schema') return;
  const taId = _editorTab === 'template' ? 'templateEditor' : 'systemEditor';
  const ta = document.getElementById(taId);
  if (!ta) return;
  const start = ta.selectionStart;
  const end   = ta.selectionEnd;
  const insertion = '{' + name + '}';
  ta.value = ta.value.slice(0, start) + insertion + ta.value.slice(end);
  ta.selectionStart = ta.selectionEnd = start + insertion.length;
  ta.focus();
  onEditorChange();
}


function onEditorChange() {
  _dirty = true;
  updateCharCount();
  updateVarChips();
  // Enable save draft immediately
  document.getElementById('draftIndicator').style.display = 'flex';
  document.getElementById('liveIndicator').style.display = 'none';
}

function updateCharCount() {
  const ta = _editorTab === 'system'
    ? document.getElementById('systemEditor')
    : document.getElementById('templateEditor');
  const chars = ta.value.length;
  const words = ta.value.split(/\s+/).filter(Boolean).length;
  document.getElementById('charCount').textContent = `${chars.toLocaleString()} chars · ${words.toLocaleString()} words`;
}

function getEditorContent() {
  return {
    system_prompt: document.getElementById('systemEditor').value,
    user_template: document.getElementById('templateEditor').value,
  };
}

// ─────────────────────────────────────────────────────────────────────
// Save / Publish / Discard
// ─────────────────────────────────────────────────────────────────────
async function saveDraft() {
  if (!_selected) return;
  const btn = document.getElementById('btnSaveDraft');
  btn.disabled = true;
  btn.textContent = 'Saving…';
  try {
    const { system_prompt, user_template } = getEditorContent();
    const r = await fetch(`/api/prompts/${_selected}/draft`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ system_prompt, user_template }),
    });
    if (!r.ok) throw new Error(await r.text());
    _hasDraft = true;
    _draftData = { system_prompt, user_template };
    _dirty = false;
    updateDraftIndicators();
    // Update sidebar badge
    loadPromptList().then(() => {
      document.querySelectorAll('.prompt-item').forEach(el => el.classList.remove('active'));
      const item = document.getElementById(`item-${_selected}`);
      if (item) item.classList.add('active');
    });
    toast('Draft saved', 'success');
  } catch(e) {
    toast('Failed to save draft: ' + e.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Save Draft';
  }
}

function openPublishModal() {
  document.getElementById('publishModal').classList.add('open');
}
function closePublishModal() {
  document.getElementById('publishModal').classList.remove('open');
}

async function publishPrompt() {
  closePublishModal();
  if (!_selected) return;
  try {
    const r = await fetch(`/api/prompts/${_selected}/publish`, { method: 'POST' });
    if (!r.ok) throw new Error(await r.text());
    const d = await r.json();
    _hasDraft = false;
    _liveData = _draftData;
    _draftData = null;
    updateDraftIndicators();
    loadPromptList().then(() => {
      document.querySelectorAll('.prompt-item').forEach(el => el.classList.remove('active'));
      const item = document.getElementById(`item-${_selected}`);
      if (item) item.classList.add('active');
    });
    toast('Prompt published to live ✓', 'success');
    setTimeout(() => window.location.reload(), 1200);
  } catch(e) {
    toast('Publish failed: ' + e.message, 'error');
  }
}

async function discardDraft() {
  if (!_selected) return;
  if (!_hasDraft && !_dirty) return;
  const hadDraft = _hasDraft;
  if (hadDraft) {
    if (!confirm('Discard the draft and revert to the live version?')) return;
    try {
      const r = await fetch(`/api/prompts/${_selected}/draft`, { method: 'DELETE' });
      if (!r.ok) throw new Error(await r.text());
    } catch(e) {
      toast('Failed to discard: ' + e.message, 'error');
      return;
    }
    _hasDraft = false;
    _draftData = null;
    loadPromptList();
  }
  _dirty = false;
  document.getElementById('systemEditor').value   = _liveData.system_prompt || '';
  document.getElementById('templateEditor').value = _liveData.user_template || '';
  updateDraftIndicators();
  updateCharCount();
  toast(hadDraft ? 'Draft discarded' : 'Reset to live version', 'warning');
}

// ─────────────────────────────────────────────────────────────────────
// Test panel
// ─────────────────────────────────────────────────────────────────────
function configureTestPanel(meta) {
  const testType = meta.test_type || 'generic';
  const isSteppedPrompt = testType === 'flow' || testType === 'assumptions';

  // Shared product context: visible for both Step 2 (flow) and Step 3 (assumptions)
  document.getElementById('ctxProductInfo').style.display = isSteppedPrompt ? 'block' : 'none';

  // Step-specific panels
  document.getElementById('ctxFlow').style.display        = testType === 'flow'        ? 'block' : 'none';
  document.getElementById('ctxAssumptions').style.display = testType === 'assumptions' ? 'block' : 'none';
  document.getElementById('ctxGeneric').style.display     = testType === 'generic'     ? 'block' : 'none';
  document.getElementById('ctxEmpty').style.display       = 'none';

  // When switching to assumptions, refresh the flow structure display
  if (testType === 'assumptions') {
    updateFlowStructDisplay();
  }

  document.getElementById('btnRunTest').disabled = false;
  document.getElementById('testPromptLabel').textContent = meta.label || _selected;
  setPreviewPlaceholder();
}

// ── Flow structure helpers (Step 3 panel) ────────────────────────────

function updateFlowStructDisplay() {
  const status = document.getElementById('flowStructStatus');
  const input  = document.getElementById('flowStructInput');
  if (!status || !input) return;
  if (_sessionFlowResult) {
    status.innerHTML =
      '<span style="color:var(--success);font-weight:600;">&#10003; Auto-populated from last Step 2 run</span>';
    input.value = JSON.stringify(_sessionFlowResult, null, 2);
  } else {
    status.innerHTML =
      'Not populated yet — run the <strong>Flow Generation</strong> prompt first, or paste JSON below.';
  }
}

function clearFlowStructure() {
  _sessionFlowResult = null;
  const input = document.getElementById('flowStructInput');
  if (input) input.value = '';
  const status = document.getElementById('flowStructStatus');
  if (status) status.innerHTML =
    'Not populated yet — run the <strong>Flow Generation</strong> prompt first, or paste JSON below.';
}

function onFlowStructChange() {
  // If the user clears the textarea, clear the session flow too
  const val = document.getElementById('flowStructInput')?.value?.trim();
  if (!val) _sessionFlowResult = null;
}

function getFlowStructure() {
  // Prefer the textarea value so manual edits are respected; fall back to session result
  const val = document.getElementById('flowStructInput')?.value?.trim();
  if (val) {
    try { return JSON.parse(val); } catch { /* invalid JSON in textarea — fall through */ }
  }
  return _sessionFlowResult || null;
}

function passFlowToAssumptions() {
  if (!_lastResult?.parsed) {
    toast('Run the Flow test first to generate a funnel structure', 'warning');
    return;
  }
  _sessionFlowResult = _lastResult.parsed;
  const assmPrompt = _prompts.find(p => p.test_type === 'assumptions');
  if (assmPrompt) {
    selectPrompt(assmPrompt.name);
    toast('Flow structure passed to Step 3 ✓', 'success');
  } else {
    toast('Flow structure saved — switch to the Assumptions prompt to use it', 'success');
  }
}

// ─────────────────────────────────────────────────────────────────────
// Resources
// ─────────────────────────────────────────────────────────────────────
function addUrlResource() {
  const input = document.getElementById('urlInput');
  const raw = input.value.trim();
  if (!raw) return;
  // Accept bare domains like "seer.cancer.gov/…" by prepending https://
  const url = /^https?:\/\//i.test(raw) ? raw : 'https://' + raw;
  try { new URL(url); } catch {
    toast('Invalid URL — please include the full address', 'warning');
    return;
  }
  let displayName;
  try { displayName = new URL(url).hostname.replace(/^www\./, ''); } catch { displayName = url; }
  _resources.push({ id: Date.now(), type: 'url', name: displayName, content: url });
  input.value = '';
  renderResourceList();
}

function addTextResource() {
  const input = document.getElementById('textInput');
  const text = input.value.trim();
  if (!text) return;
  _resources.push({ id: Date.now(), type: 'text', name: 'Note', content: text });
  input.value = '';
  renderResourceList();
}

function onDragOver(e) { e.preventDefault(); document.getElementById('dropZone').classList.add('dragover'); }
function onDragLeave(e) { document.getElementById('dropZone').classList.remove('dragover'); }
function onDrop(e) {
  e.preventDefault();
  document.getElementById('dropZone').classList.remove('dragover');
  const files = e.dataTransfer.files;
  if (files.length) handleFileUpload(files[0]);
}
function onFileSelect(e) {
  const file = e.target.files[0];
  if (file) handleFileUpload(file);
  e.target.value = '';
}

async function handleFileUpload(file) {
  const formData = new FormData();
  formData.append('file', file);
  try {
    const r = await fetch('/api/prompts/upload-resource', { method: 'POST', body: formData });
    if (!r.ok) throw new Error(await r.text());
    const data = await r.json();
    _resources.push({ id: Date.now(), type: 'file', name: data.name, content: data.content });
    renderResourceList();
    toast(`File "${data.name}" added`, 'success');
  } catch(e) {
    toast('Upload failed: ' + e.message, 'error');
  }
}

function removeResource(id) {
  _resources = _resources.filter(r => r.id !== id);
  renderResourceList();
}

function renderResourceList() {
  const list = document.getElementById('resourceList');
  if (!list) return;
  if (!_resources.length) { list.innerHTML = ''; return; }
  list.innerHTML = _resources.map(r => {
    const preview = r.type === 'url'
      ? `<span style="color:var(--primary);font-size:10px;">${escHtml(r.content)}</span>`
      : escHtml((r.content || '').substring(0, 80)) + ((r.content || '').length > 80 ? '…' : '');
    return `
    <div class="resource-card">
      <div class="resource-type-icon ${r.type}">${r.type === 'url' ? '🔗' : r.type === 'file' ? '📄' : '📝'}</div>
      <div class="resource-card-body">
        <div class="resource-card-name">${escHtml(r.name)}</div>
        <div class="resource-card-preview">${preview}</div>
      </div>
      <button type="button" class="resource-remove" onclick="removeResource(${r.id})" title="Remove">×</button>
    </div>`;
  }).join('');
}

// ─────────────────────────────────────────────────────────────────────
// Run Test
// ─────────────────────────────────────────────────────────────────────

// Read shared product context fields (used by both flow and assumptions)
function getProductContext() {
  return {
    indication:   document.getElementById('fIndication')?.value || '',
    product_name: document.getElementById('fProduct')?.value    || '',
    drug_class:   document.getElementById('fDrugClass')?.value  || '',
    country:      document.getElementById('fCountry')?.value    || 'United States',
    launch_year:  parseInt(document.getElementById('fLaunch')?.value)  || 2025,
    peak_year:    parseInt(document.getElementById('fPeak')?.value)    || 2035,
  };
}

function clearFieldError(id) {
  document.getElementById(id)?.classList.remove('field-invalid');
  const err = document.getElementById('err-' + id);
  if (err) err.classList.remove('visible');
}

function validateProductContext() {
  const required = [
    { id: 'fIndication', label: 'Indication' },
    { id: 'fProduct',    label: 'Product Name' },
    { id: 'fDrugClass',  label: 'Drug Class / MoA' },
  ];
  let valid = true;
  required.forEach(({ id }) => {
    const el = document.getElementById(id);
    if (!el) return;
    if (!el.value.trim()) {
      el.classList.add('field-invalid');
      const err = document.getElementById('err-' + id);
      if (err) err.classList.add('visible');
      valid = false;
    }
  });
  if (!valid) {
    // Scroll the product context section into view
    document.getElementById('ctxProductInfo')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
  return valid;
}

async function runTest() {
  if (!_selected) return;
  const meta = _prompts.find(p => p.name === _selected) || {};
  const testType = meta.test_type || 'generic';

  // Validate product context for flow and assumptions tests
  if (testType === 'flow' || testType === 'assumptions') {
    if (!validateProductContext()) return;
  }

  const { system_prompt, user_template } = getEditorContent();
  const productCtx = getProductContext();

  setLoading(true);
  try {
    let body, endpoint;

    if (testType === 'flow') {
      endpoint = '/api/prompts/test/flow';
      body = { system_prompt, user_template, ...productCtx,
               query: document.getElementById('fQuery')?.value || '' };

    } else if (testType === 'assumptions') {
      endpoint = '/api/prompts/test/assumptions';
      body = {
        system_prompt,
        user_template,
        query: document.getElementById('aQuery').value,
        resources: _resources.map(r => ({ type: r.type, content: r.content, name: r.name })),
        // Pass shared product context — same fields as flow
        ...productCtx,
        // Pass funnel structure from Step 2 (auto or manual)
        funnel_structure: getFlowStructure(),
      };

    } else {
      endpoint = '/api/prompts/test/generic';
      body = { system_prompt, user_template, query: document.getElementById('gQuery').value };
    }

    const r = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.detail || JSON.stringify(data));

    _lastResult = { ...data, testType, contextUsed: productCtx, queryUsed: body.query || '' };

    // After a successful flow test, store the funnel for Step 3 to pick up
    if (testType === 'flow' && data.parsed) {
      _sessionFlowResult = data.parsed;
    }

    renderPreview();
  } catch(e) {
    document.getElementById('pvContent').innerHTML =
      `<div class="error-box"><strong>Error:</strong> ${escHtml(e.message)}</div>`;
  } finally {
    setLoading(false);
  }
}

function setLoading(on) {
  const btn = document.getElementById('btnRunTest');
  const spinner = document.getElementById('testSpinner');
  const label = document.getElementById('runBtnLabel');
  btn.disabled = on;
  spinner.style.display = on ? 'block' : 'none';
  label.style.display = on ? 'none' : 'flex';
  if (on) {
    document.getElementById('pvContent').innerHTML =
      '<div class="loading-box"><div class="loading-spinner-sm"></div> Running test — this may take a moment…</div>';
  }
}

// ─────────────────────────────────────────────────────────────────────
// Preview rendering
// ─────────────────────────────────────────────────────────────────────
function switchPreviewTab(tab) {
  _previewTab = tab;
  ['visual','json','raw'].forEach(t => {
    document.getElementById(`pvTab${t.charAt(0).toUpperCase()+t.slice(1)}`).classList.toggle('active', t === tab);
  });
  if (_lastResult) renderPreview();
}

function setPreviewPlaceholder() {
  document.getElementById('pvContent').innerHTML = `
    <div class="preview-placeholder">
      <div class="preview-placeholder-icon">⚗️</div>
      <div class="preview-placeholder-text">Run a test to see the output here</div>
    </div>`;
}

function renderPreview() {
  if (!_lastResult) return;
  const { testType, parsed, raw, readable, csv } = _lastResult;
  const container = document.getElementById('pvContent');

  // Show/hide download bar for assumptions results
  const dlBar = document.getElementById('pvDownloadBar');
  if (dlBar) {
    if (testType === 'assumptions' && readable && readable.length) {
      const jsonStr  = JSON.stringify(parsed, null, 2);
      const jsonB64  = btoa(unescape(encodeURIComponent(jsonStr)));
      const csvB64   = csv ? btoa(unescape(encodeURIComponent(csv))) : '';
      dlBar.style.display = 'flex';
      dlBar.innerHTML =
        `<a href="data:application/json;base64,${jsonB64}" download="assumptions.json"
            style="font-size:11px;font-weight:600;color:var(--primary);text-decoration:none;
                   border:1px solid var(--primary);border-radius:6px;padding:3px 10px;
                   background:rgba(26,79,114,.07);">↓ JSON</a>` +
        (csvB64
          ? `<a href="data:text/csv;base64,${csvB64}" download="assumptions.csv"
                style="font-size:11px;font-weight:600;color:var(--gold);text-decoration:none;
                       border:1px solid var(--gold);border-radius:6px;padding:3px 10px;
                       background:rgba(201,146,42,.07);">↓ CSV</a>`
          : '');
    } else {
      dlBar.style.display = 'none';
      dlBar.innerHTML = '';
    }
  }

  if (_previewTab === 'raw') {
    container.innerHTML = `<div class="json-view">${escHtml(raw || '')}</div>`;
    return;
  }
  if (_previewTab === 'json') {
    const display = parsed ?? raw;
    const json = typeof display === 'object'
      ? JSON.stringify(display, null, 2)
      : (display || '(no output)');
    container.innerHTML = `<div class="json-view">${syntaxHighlight(json)}</div>`;
    return;
  }

  // Visual tab
  if (testType === 'flow') {
    renderFlowVisual(container, parsed);
  } else if (testType === 'assumptions') {
    renderAssumptionsVisual(container, readable, parsed);
  } else {
    const display = typeof parsed === 'object' && parsed
      ? JSON.stringify(parsed, null, 2) : (raw || '(no output)');
    container.innerHTML = `<div class="json-view">${syntaxHighlight(display)}</div>`;
  }
}

// ─────────────────────────────────────────────────────────────────────
// Flow Builder constants + state (Step 2 interactive preview)
// ─────────────────────────────────────────────────────────────────────
const PS_PARAM_DEFS = {
  population:          { label: 'Total Population',       desc: 'Overall population of the target country/region', badge: 'required',   cat: 'epi' },
  prevalence:          { label: 'Prevalence Rate',        desc: 'Stock of living patients with the condition',     badge: 'choose-one', cat: 'epi' },
  incidence:           { label: 'Incidence Rate',         desc: 'New cases diagnosed per year',                    badge: 'choose-one', cat: 'epi' },
  severity:            { label: 'Severity / Subtype %',   desc: 'Proportion in the relevant biomarker/stage subgroup', badge: 'optional', cat: 'epi' },
  diagnosisRate:       { label: 'Diagnosis Rate',         desc: 'Proportion of affected patients clinically identified', badge: 'optional', cat: 'epi' },
  treatmentRate:       { label: 'Treatment Rate',         desc: 'Proportion of diagnosed patients receiving therapy', badge: 'optional', cat: 'treat' },
  eligibilityCriteria: { label: 'Eligibility Criteria',   desc: 'Biomarker, line of therapy, or inclusion gate',   badge: 'optional', cat: 'treat' },
  progressionRate:     { label: 'Progression Rate',       desc: 'Disease progression or line advancement rate',    badge: 'optional', cat: 'treat' },
  classShare:          { label: 'Peak Class Share',        desc: 'Drug class vs other classes at peak',             badge: 'optional', cat: 'market' },
  peakProductShare:    { label: 'Peak Product Share',     desc: 'This product within its class at peak',           badge: 'optional', cat: 'market' },
  annualCostPerPatient:{ label: 'Annual Cost per Patient', desc: 'Gross annual treatment cost',                    badge: 'optional', cat: 'pricing' },
  discount:            { label: 'Discount / Rebate Rate', desc: 'Net pricing after payer rebates',                 badge: 'optional', cat: 'pricing' },
};

const PS_PRESETS = {
  standard: ['population','prevalence','diagnosisRate','treatmentRate','classShare','peakProductShare','annualCostPerPatient','discount'],
  oncology: ['population','incidence','diagnosisRate','eligibilityCriteria','treatmentRate','classShare','peakProductShare','annualCostPerPatient','discount'],
  rare:     ['population','prevalence','diagnosisRate','eligibilityCriteria','classShare','peakProductShare','annualCostPerPatient','discount'],
};

const PS_CATEGORIES = [
  { id: 'epi',    label: 'Epidemiology',     params: ['population','prevalence','incidence','severity','diagnosisRate'] },
  { id: 'treat',  label: 'Treatment Flow',   params: ['eligibilityCriteria','treatmentRate','progressionRate'] },
  { id: 'market', label: 'Market Dynamics',  params: ['classShare','peakProductShare'] },
  { id: 'pricing',label: 'Pricing & Access', params: ['annualCostPerPatient','discount'] },
];

const PS_FUNNEL_ORDER = ['population','prevalence','incidence','severity','diagnosisRate',
  'eligibilityCriteria','treatmentRate','progressionRate','classShare','peakProductShare',
  'annualCostPerPatient','discount']; // must match AVAILABLE PARAMETERS order in flow_generate prompt

const PS_STEP_ICONS = {
  population:'🌍', prevalence:'📊', incidence:'📋', severity:'🎯',
  diagnosisRate:'🏥', eligibilityCriteria:'🔬', treatmentRate:'💊',
  progressionRate:'📈', classShare:'🏆', peakProductShare:'⭐',
  annualCostPerPatient:'💰', discount:'🏷️',
};

const PS_STEP_SHORT = {
  population:'Population', prevalence:'Prevalence', incidence:'Incidence',
  severity:'Subtype %', diagnosisRate:'Diagnosed', eligibilityCriteria:'Eligible',
  treatmentRate:'Treated', progressionRate:'Progression', classShare:'Class Share',
  peakProductShare:'Prod. Share', annualCostPerPatient:'Cost/Pt', discount:'Net Price',
};

let _studioParams       = new Set();   // selected param IDs
let _studioEpiType      = 'prevalence';
let _studioRationale    = {};
let _studioCustomParams = {};          // AI-created params: {id: {label, description, category}}
let _studioAIParsed     = null;        // reference to last parsed result for re-apply
let _studioParamOrder   = [...PS_FUNNEL_ORDER]; // display order — driven by AI prompt output

// ─────────────────────────────────────────────────────────────────────
// renderFlowVisual — interactive Step 2 parameter builder
// ─────────────────────────────────────────────────────────────────────
function renderFlowVisual(container, parsed) {
  if (!parsed) {
    container.innerHTML = '<div class="error-box">No parsed output. Check the JSON tab for the raw response.</div>';
    return;
  }
  if (!parsed.recommended_params) {
    container.innerHTML = '<div class="error-box">Response missing <code>recommended_params</code>. The prompt may use an older format — check the JSON tab and update the prompt to match the current output schema.</div>';
    return;
  }

  _studioAIParsed     = parsed;
  _studioRationale    = parsed.param_rationale || {};
  _studioEpiType      = parsed.epi_type || 'prevalence';
  _studioParams       = new Set(parsed.recommended_params || []);
  // Only keep custom params not already in the built-in catalogue
  _studioCustomParams = {};
  Object.entries(parsed.custom_params || {}).forEach(([id, def]) => {
    if (!(id in PS_PARAM_DEFS)) _studioCustomParams[id] = def;
  });
  _studioParams.add('population');
  // Capture the AI-recommended order so the funnel diagram reflects it
  _studioParamOrder = parsed.recommended_params ? [...parsed.recommended_params] : [...PS_FUNNEL_ORDER];
  if (!_studioParamOrder.includes('population')) _studioParamOrder.unshift('population');

  container.innerHTML = _buildFlowBuilderHTML(parsed);
  studioUpdateFlowDiagram();
}

function _buildFlowBuilderHTML(parsed) {
  const preset    = parsed.preset_match || 'custom';
  const fa        = parsed.forecast_assumptions || {};
  const aiText    = parsed.ai_recommendation_text || '';
  const recommended = [..._studioParams].filter(p => p !== 'population');

  let h = '<div class="ps-flow-container">';

  // ── Product header ─────────────────────────────────────────────────
  h += `<div>
    <div style="font-size:13px;font-weight:700;color:var(--text);">
      ${escHtml(parsed.indication || '')}${parsed.market ? ' · ' + escHtml(parsed.market) : ''}
    </div>
    <div style="font-size:11px;color:var(--text-2);margin-top:2px;">
      ${escHtml(parsed.product || '')}${parsed.drug_class ? ' — ' + escHtml(parsed.drug_class) : ''}
    </div>
    ${fa.launch_year ? `<div style="font-size:10px;color:var(--text-2);margin-top:2px;">
      Forecast: ${fa.launch_year}–${fa.peak_year || '—'} · ${fa.suggested_forecast_period_years || '—'} yrs
    </div>` : ''}
  </div>`;

  // ── AI recommendation banner ───────────────────────────────────────
  if (aiText) {
    const chips = recommended.map(p => {
      const def = PS_PARAM_DEFS[p];
      return `<span class="ps-ai-chip">${escHtml(def ? def.label : p)}</span>`;
    }).join('');
    h += `<div class="ps-ai-banner">
      <div class="ps-ai-icon">🤖</div>
      <div class="ps-ai-content">
        <div class="ps-ai-title">AI Recommendation</div>
        <div class="ps-ai-text">${escHtml(aiText)}</div>
        ${chips ? `<div class="ps-ai-chips">${chips}</div>` : ''}
        <span class="ps-ai-apply" onclick="studioApplyAIRecommendation()">✓ Apply AI recommendation</span>
      </div>
    </div>`;
  }

  // ── Market summary ─────────────────────────────────────────────────
  if (parsed.market_summary) {
    h += `<div class="ps-market-summary">${escHtml(parsed.market_summary)}</div>`;
  }

  // ── Preset chips ───────────────────────────────────────────────────
  const PRESET_LABELS = { standard:'Standard', oncology:'Oncology', rare:'Rare Disease', custom:'Custom' };
  h += `<div class="ps-presets-bar">
    <span class="ps-presets-label">Template:</span>
    ${['standard','oncology','rare','custom'].map(p =>
      `<span class="ps-preset-chip${p === preset ? ' active' : ''}" id="ps-chip-${p}"
        onclick="studioApplyPreset('${p}')">${escHtml(PRESET_LABELS[p])}</span>`
    ).join('')}
  </div>`;

  // ── Parameter categories ───────────────────────────────────────────
  PS_CATEGORIES.forEach(cat => {
    h += `<div class="ps-category">
      <div class="ps-category-header">
        <span class="ps-category-title">${escHtml(cat.label)}</span>
        <button type="button" class="ps-add-btn" onclick="studioShowAddParam('${cat.id}')">+ Add</button>
      </div>
      <div class="ps-param-list">`;

    cat.params.forEach(id => {
      const def = PS_PARAM_DEFS[id];
      if (!def) return;
      const isPopulation = id === 'population';
      const isEpiChoice  = id === 'prevalence' || id === 'incidence';
      const isChecked    = isPopulation ? true : isEpiChoice ? (_studioEpiType === id) : _studioParams.has(id);
      const rationale    = _studioRationale[id] || '';

      if (isPopulation) {
        h += `<div class="ps-param-item ps-disabled">
          <div class="ps-param-ctrl"><input type="checkbox" checked disabled></div>
          <div class="ps-param-body">
            <div class="ps-param-header-row">
              <span class="ps-param-label">${escHtml(def.label)}</span>
              <span class="ps-param-badge required">required</span>
            </div>
            <div class="ps-param-desc">${escHtml(def.desc)}</div>
          </div>
        </div>`;
      } else if (isEpiChoice) {
        h += `<div class="ps-param-item" onclick="studioSetEpiType('${id}')">
          <div class="ps-param-ctrl">
            <input type="radio" name="ps-epi" value="${id}" ${isChecked ? 'checked' : ''}
              onclick="event.stopPropagation();studioSetEpiType('${id}')">
          </div>
          <div class="ps-param-body">
            <div class="ps-param-header-row">
              <span class="ps-param-label">${escHtml(def.label)}</span>
              <span class="ps-param-badge choose-one">choose one</span>
            </div>
            <div class="ps-param-desc">${escHtml(def.desc)}</div>
            ${rationale ? `<div class="ps-param-rationale">${escHtml(rationale)}</div>` : ''}
          </div>
        </div>`;
      } else {
        h += `<div class="ps-param-item" onclick="studioToggleParam('${id}')">
          <div class="ps-param-ctrl">
            <input type="checkbox" id="ps-cb-${id}" ${isChecked ? 'checked' : ''}
              onclick="event.stopPropagation();studioToggleParam('${id}')">
          </div>
          <div class="ps-param-body">
            <div class="ps-param-header-row">
              <span class="ps-param-label">${escHtml(def.label)}</span>
              <span class="ps-param-badge optional">optional</span>
            </div>
            <div class="ps-param-desc">${escHtml(def.desc)}</div>
            ${rationale ? `<div class="ps-param-rationale">${escHtml(rationale)}</div>` : ''}
          </div>
        </div>`;
      }
    });

    h += `</div></div>`;
  });

  // ── AI-created custom parameters ──────────────────────────────────
  const customIds = Object.keys(_studioCustomParams);
  if (customIds.length) {
    h += `<div class="ps-category">
      <div class="ps-category-header">
        <span class="ps-category-title">Custom Parameters</span>
        <span style="font-size:9px;font-weight:700;color:var(--gold);background:rgba(201,146,42,.1);border:1px solid rgba(201,146,42,.2);border-radius:4px;padding:1px 6px;letter-spacing:.3px;">AI-created</span>
      </div>
      <div class="ps-param-list">`;
    customIds.forEach(id => {
      const def       = _studioCustomParams[id] || {};
      const isChecked = _studioParams.has(id);
      const rationale = _studioRationale[id] || '';
      h += `<div class="ps-param-item" onclick="studioToggleParam('${id}')">
        <div class="ps-param-ctrl">
          <input type="checkbox" id="ps-cb-${id}" ${isChecked ? 'checked' : ''}
            onclick="event.stopPropagation();studioToggleParam('${id}')">
        </div>
        <div class="ps-param-body">
          <div class="ps-param-header-row">
            <span class="ps-param-label">${escHtml(def.label || id)}</span>
            <span class="ps-param-badge optional">custom</span>
          </div>
          <div class="ps-param-desc">${escHtml(def.description || '')}</div>
          ${rationale ? `<div class="ps-param-rationale">${escHtml(rationale)}</div>` : ''}
        </div>
      </div>`;
    });
    h += `</div></div>`;
  }

  // ── Live flow diagram placeholder ──────────────────────────────────
  h += `<div id="ps-flow-diagram"></div>`;

  // ── Pass to Step 3 ─────────────────────────────────────────────────
  h += `<div>
    <button type="button" onclick="passFlowToAssumptions()"
      style="width:100%;height:34px;border-radius:var(--r8);border:1.5px solid var(--primary);
             background:rgba(26,79,114,.06);color:var(--primary);font-size:12px;font-weight:700;
             cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;">
      &#8594; Use this flow in Step 3 (Assumptions)
    </button>
  </div>`;

  h += '</div>';
  return h;
}

// ─────────────────────────────────────────────────────────────────────
// Flow builder interaction handlers
// ─────────────────────────────────────────────────────────────────────
function studioToggleParam(id) {
  if (id === 'population') return;
  if (_studioParams.has(id)) { _studioParams.delete(id); } else { _studioParams.add(id); }
  const cb = document.getElementById(`ps-cb-${id}`);
  if (cb) cb.checked = _studioParams.has(id);
  studioMarkCustomPreset();
  studioUpdateFlowDiagram();
}

function studioSetEpiType(type) {
  _studioEpiType = type;
  _studioParams.delete('prevalence');
  _studioParams.delete('incidence');
  _studioParams.add(type);
  document.querySelectorAll('input[name="ps-epi"]').forEach(r => { r.checked = r.value === type; });
  studioMarkCustomPreset();
  studioUpdateFlowDiagram();
}

function studioApplyPreset(preset) {
  const params = PS_PRESETS[preset];
  if (params) {
    _studioParams       = new Set(params);
    _studioEpiType      = params.includes('incidence') ? 'incidence' : 'prevalence';
    _studioCustomParams = {};  // Standard presets don't include custom params
    _studioParamOrder   = [...params];
    Object.keys(PS_PARAM_DEFS).forEach(id => {
      const cb = document.getElementById(`ps-cb-${id}`);
      if (cb) cb.checked = _studioParams.has(id);
    });
    document.querySelectorAll('input[name="ps-epi"]').forEach(r => { r.checked = r.value === _studioEpiType; });
    studioUpdateFlowDiagram();
  }
  document.querySelectorAll('.ps-preset-chip').forEach(c => {
    c.classList.toggle('active', c.id === `ps-chip-${preset}`);
  });
}

function studioApplyAIRecommendation() {
  if (!_studioAIParsed?.recommended_params) return;
  _studioParams       = new Set(_studioAIParsed.recommended_params);
  _studioEpiType      = _studioAIParsed.epi_type || 'prevalence';
  _studioCustomParams = {};
  Object.entries(_studioAIParsed.custom_params || {}).forEach(([id, def]) => {
    if (!(id in PS_PARAM_DEFS)) _studioCustomParams[id] = def;
  });
  _studioParams.add('population');
  _studioParamOrder = [..._studioAIParsed.recommended_params];
  if (!_studioParamOrder.includes('population')) _studioParamOrder.unshift('population');
  Object.keys(PS_PARAM_DEFS).forEach(id => {
    const cb = document.getElementById(`ps-cb-${id}`);
    if (cb) cb.checked = _studioParams.has(id);
  });
  document.querySelectorAll('input[name="ps-epi"]').forEach(r => { r.checked = r.value === _studioEpiType; });
  document.querySelectorAll('.ps-preset-chip').forEach(c => {
    c.classList.toggle('active', c.id === `ps-chip-${_studioAIParsed.preset_match || 'custom'}`);
  });
  studioUpdateFlowDiagram();
  toast('AI recommendation applied', 'success');
}

function studioMarkCustomPreset() {
  document.querySelectorAll('.ps-preset-chip').forEach(c => c.classList.remove('active'));
  const customChip = document.getElementById('ps-chip-custom');
  if (customChip) customChip.classList.add('active');
}

function studioShowAddParam(catId) {
  toast(`Custom parameters for "${catId}" — coming soon`, '');
}

function studioUpdateFlowDiagram() {
  const container = document.getElementById('ps-flow-diagram');
  if (!container) return;

  const epiSlot = _studioEpiType === 'incidence' ? 'incidence' : 'prevalence';

  // Use AI-recommended order as primary; fall back to PS_FUNNEL_ORDER for any params not covered
  const normalise = id => (id === 'prevalence' || id === 'incidence') ? epiSlot : id;
  const aiOrdered   = _studioParamOrder.map(normalise);
  const fallback    = PS_FUNNEL_ORDER.map(normalise).filter(id => !aiOrdered.includes(id));
  const deduped     = [...new Set([...aiOrdered, ...fallback])];

  // Append any custom params that are selected but not in the combined order
  const customSelected = [..._studioParams].filter(id => !deduped.includes(id) && id in _studioCustomParams);
  const allOrdered = [...deduped, ...customSelected];

  const active = allOrdered.filter(id => _studioParams.has(id));

  if (!active.length) {
    container.innerHTML = '<div style="font-size:11px;color:var(--text-2);text-align:center;padding:12px;">No parameters selected</div>';
    return;
  }

  let html = '<div class="ps-flow-diagram">';
  active.forEach((id, i) => {
    const isCustom = id in _studioCustomParams;
    const icon  = PS_STEP_ICONS[id] || (isCustom ? '⚙️' : '📌');
    const label = PS_STEP_SHORT[id] || (isCustom ? (_studioCustomParams[id]?.label || id) : id);
    html += `<div class="ps-flow-step${isCustom ? ' ps-flow-step-custom' : ''}">
      <div class="ps-flow-step-icon">${icon}</div>
      <div class="ps-flow-step-label">${escHtml(label)}</div>
    </div>`;
    if (i < active.length - 1) html += '<div class="ps-flow-arrow">→</div>';
  });
  html += '</div>';
  container.innerHTML = html;
}

function renderAssumptionsVisual(container, readable, parsed) {
  const ctx  = _lastResult?.contextUsed || {};
  const qry  = _lastResult?.queryUsed  || '';

  // ── Context card (always shown when we have something) ────────────────
  const ctxPairs = [
    ['Indication',  ctx.indication],
    ['Product',     ctx.product_name],
    ['Drug Class',  ctx.drug_class],
    ['Country',     ctx.country],
    ['Period',      ctx.launch_year && ctx.peak_year ? `${ctx.launch_year}–${ctx.peak_year}` : null],
    ['Query',       qry || null],
  ].filter(([, v]) => v);

  let contextBlock = '';
  if (ctxPairs.length) {
    const rows = ctxPairs.map(([k, v]) =>
      `<div class="assumption-row">
        <span class="assumption-key" style="min-width:90px;color:var(--text-2);">${escHtml(k)}</span>
        <span class="assumption-value" style="color:var(--text-1);font-weight:500;">${escHtml(String(v))}</span>
      </div>`
    ).join('');
    contextBlock = `
      <div class="assumption-group" style="margin-bottom:14px;border-left:3px solid var(--primary);padding-left:10px;">
        <div class="assumption-group-label" style="color:var(--primary);">Context Used</div>
        ${rows}
      </div>`;
  }

  // ── Case 1: successfully parsed array with entries ────────────────────
  if (readable && readable.length) {
    // Build table rows
    const tableRows = readable.map(r => {
      const dispVal = formatAssumptionValue(r.key, r.value);
      const src = r.source || 'self';
      const srcCell = src === 'self'
        ? `<span style="color:var(--text-2);font-style:italic;">self</span>`
        : `<a href="${escHtml(src)}" target="_blank" rel="noopener"
              style="color:var(--primary);text-decoration:underline;word-break:break-all;font-size:10px;"
              title="${escHtml(src)}">${escHtml(src.replace(/^https?:\/\//, '').slice(0, 40))}${src.length > 47 ? '…' : ''}</a>`;
      return `<tr>
        <td style="font-family:'JetBrains Mono',monospace;font-size:10px;color:var(--text);padding:5px 8px;border-bottom:1px solid var(--border);word-break:break-all;">${escHtml(r.key)}</td>
        <td style="font-size:12px;font-weight:700;color:var(--primary);padding:5px 8px;border-bottom:1px solid var(--border);white-space:nowrap;">${escHtml(dispVal)}</td>
        <td style="font-size:11px;color:var(--text-2);padding:5px 8px;border-bottom:1px solid var(--border);font-style:italic;">${escHtml(r.rationale || '')}</td>
        <td style="font-size:11px;padding:5px 8px;border-bottom:1px solid var(--border);">${srcCell}</td>
      </tr>`;
    }).join('');

    let html = contextBlock;
    html += `
      <div style="margin-bottom:8px;">
        <span style="font-size:10px;color:var(--text-2);font-weight:600;text-transform:uppercase;letter-spacing:.5px;">
          ${readable.length} assumption${readable.length !== 1 ? 's' : ''} generated
        </span>
      </div>
      <div style="overflow-x:auto;border:1px solid var(--border);border-radius:var(--r8);margin-bottom:12px;">
        <table style="width:100%;border-collapse:collapse;font-size:12px;">
          <thead>
            <tr style="background:var(--bg);">
              <th style="text-align:left;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.4px;color:var(--text-2);padding:6px 8px;border-bottom:2px solid var(--border);">Variable Name</th>
              <th style="text-align:left;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.4px;color:var(--text-2);padding:6px 8px;border-bottom:2px solid var(--border);">Value</th>
              <th style="text-align:left;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.4px;color:var(--text-2);padding:6px 8px;border-bottom:2px solid var(--border);">Rationale</th>
              <th style="text-align:left;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.4px;color:var(--text-2);padding:6px 8px;border-bottom:2px solid var(--border);">Source</th>
            </tr>
          </thead>
          <tbody>${tableRows}</tbody>
        </table>
      </div>`;
    container.innerHTML = html;
    return;
  }

  // ── Case 2: AI returned empty array [] ───────────────────────────────
  if (Array.isArray(parsed) && parsed.length === 0) {
    container.innerHTML = contextBlock + `
      <div class="loading-box" style="background:var(--warning-bg);border-color:rgba(217,119,6,.2);color:var(--warning);margin-bottom:10px;">
        <strong>Agent returned no overrides.</strong> Fill in the Indication field above and run again — the agent needs product context to generate assumptions.
      </div>
      <div style="font-size:10px;color:var(--text-2);margin-bottom:4px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;">Raw Response</div>
      <div class="json-view" style="font-size:11px;max-height:200px;overflow-y:auto;background:var(--bg);border:1px solid var(--border);border-radius:var(--r8);padding:10px;">
        ${escHtml(_lastResult?.raw || '(empty)')}
      </div>`;
    return;
  }

  // ── Case 3: parse failed — show raw response inline ──────────────────
  const rawText = _lastResult?.raw || '';
  container.innerHTML = contextBlock + `
    <div class="error-box" style="margin-bottom:10px;">
      Could not parse a JSON array from the response. Switch to the <strong>Raw</strong> tab to inspect the full output.
    </div>
    ${rawText ? `
    <div style="font-size:10px;color:var(--text-2);margin-bottom:4px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;">Raw Response (first 800 chars)</div>
    <div class="json-view" style="font-size:11px;max-height:240px;overflow-y:auto;background:var(--bg);border:1px solid var(--border);border-radius:var(--r8);padding:10px;">
      ${escHtml(rawText.slice(0, 800))}${rawText.length > 800 ? '\n…' : ''}
    </div>` : ''}`;
}

// ─────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────
function formatAssumptionValue(key, val) {
  if (val === null || val === undefined) return '—';
  const k = (key || '').toLowerCase();
  if (typeof val === 'number') {
    if (k.includes('rate') || k.includes('share') || k.includes('percentage') || k.includes('discount') || k.includes('compliance')) {
      return (val * 100).toFixed(1) + '%';
    }
    if (k.includes('price') || k.includes('cost')) return '$' + val.toLocaleString();
    if (k.includes('population') && val > 10000) return val.toLocaleString();
    if (k.includes('period') || k.includes('year')) return val + ' yrs';
    return val.toLocaleString();
  }
  return String(val);
}

function fmtRate(v) {
  if (v == null) return '—';
  if (v <= 1) return (v * 100).toFixed(2) + '%';
  return v.toLocaleString();
}

function fmtNum(v) {
  if (v == null) return '—';
  return typeof v === 'number' ? v.toLocaleString() : String(v);
}

function escHtml(s) {
  if (s == null) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function syntaxHighlight(json) {
  if (typeof json !== 'string') json = String(json);
  return json
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, m => {
      let cls = 'color:var(--gold-light)';
      if (/^"/.test(m)) {
        cls = /:$/.test(m) ? 'color:var(--steel)' : 'color:#86efac';
      } else if (/true|false/.test(m)) {
        cls = 'color:#f9a8d4';
      } else if (/null/.test(m)) {
        cls = 'color:var(--text-2)';
      }
      return `<span style="${cls}">${m}</span>`;
    });
}

function toast(msg, type = '') {
  const ct = document.getElementById('toastContainer');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  ct.appendChild(el);
  setTimeout(() => { el.remove(); }, 3500);
}
