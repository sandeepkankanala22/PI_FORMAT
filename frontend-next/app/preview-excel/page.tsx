'use client'
import Script from 'next/script'

export default function ExcelPreview() {
  return (
    <>
      {/* Title bar */}
      <div className="titlebar">
        <div className="titlebar-logo">Chryselys</div>
        <div className="titlebar-filename" id="file-label"></div>
        <div className="titlebar-right hidden" id="stats">
          <div>Rows: <strong id="stat-rows">—</strong></div>
          <div>Cols: <strong id="stat-cols">—</strong></div>
          <div>Sheets: <strong id="stat-sheets">—</strong></div>
        </div>
      </div>

      {/* Formula bar */}
      <div className="formula-bar">
        <div className="name-box" id="cell-ref"></div>
        <div className="fx-btn">ƒx</div>
        <div className="formula-content" id="cell-formula"></div>
      </div>

      {/* Loading / Error / Grid */}
      <div id="loading">
        <div className="spinner"></div>
        <div>Opening spreadsheet…</div>
      </div>

      <div id="error">
        <div className="error-icon">⚠</div>
        <div id="error-msg">Could not load file.</div>
      </div>

      <div className="grid-wrapper hidden" id="grid-wrapper">
        <table id="grid"></table>
      </div>

      {/* Sheet tabs + status bar */}
      <div className="bottom-bar">
        <div className="tabs-bar" id="tabs-bar"></div>
      </div>
      <div className="status-bar hidden" id="status-bar">
        <div>Average: <strong id="stat-avg">—</strong></div>
        <div>Count: <strong id="stat-count">—</strong></div>
        <div>Sum: <strong id="stat-sum">—</strong></div>
      </div>

      <div style={{background:'#F5F6F8',borderTop:'1px solid #E0E6ED',padding:'8px 14px',display:'flex',justifyContent:'space-between',alignItems:'center',fontSize:'11px',color:'#4A6580',fontFamily:"'Segoe UI',sans-serif"}}>
        <span>Copyright © 2026 Chryselys All rights reserved.</span>
        <span>www.chryselys.com | info@chryselys.com</span>
      </div>

      <Script src="https://cdn.jsdelivr.net/npm/hyperformula@2.6.0/dist/hyperformula.full.min.js" strategy="afterInteractive" />
      <Script src="/js/excel-viewer.js" strategy="afterInteractive" />
    </>
  )
}
