  let sheets = [];
  let selectedCell = null;
  let hf = null;  // HyperFormula instance

  // ── HyperFormula helpers ──────────────────────────────────────────────────

  function initHF(sheets) {
    if (typeof HyperFormula === 'undefined') return;
    try {
      const sheetsData = {};
      sheets.forEach(sh => {
        const [, , maxR, maxC] = sh.range;
        const rows = maxR + 1, cols = maxC + 1;
        const grid = Array.from({length: rows}, () => Array(cols).fill(null));
        Object.entries(sh.cells).forEach(([key, cd]) => {
          const [r, c] = key.split(',').map(Number);
          if (r >= rows || c >= cols) return;
          if (cd.f) {
            grid[r][c] = cd.f;
          } else if (cd.v !== undefined && cd.v !== null) {
            grid[r][c] = cd.t === 'n' ? Number(cd.v) : cd.v;
          }
        });
        sheetsData[sh.name] = grid;
      });
      hf = HyperFormula.buildFromSheets(sheetsData, { licenseKey: 'gpl-v3' });
      console.log('HyperFormula ready:', Object.keys(sheetsData).length, 'sheet(s)');
    } catch(e) {
      console.warn('HyperFormula init failed:', e);
      hf = null;
    }
  }

  function hfGet(sheetName, r, c) {
    if (!hf) return null;
    try {
      const id = hf.getSheetId(sheetName);
      if (id === undefined) return null;
      return hf.getCellValue({ sheet: id, row: r, col: c });
    } catch(e) { return null; }
  }

  function hfFmt(val, nf) {
    if (val === null || val === undefined) return "";
    // HyperFormula error objects have a .type and .value
    if (typeof val === 'object' && val.type) return String(val);
    if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
    if (typeof val === 'number') {
      if (!nf || nf === 'General' || nf === '@') {
        if (Number.isFinite(val) && val === Math.trunc(val) && Math.abs(val) < 1e15)
          return String(Math.trunc(val));
        return String(val);
      }
      try {
        if (nf.includes('%')) {
          const m = nf.match(/\.(0+)/);
          return (val * 100).toFixed(m ? m[1].length : 0) + '%';
        }
        const symM = nf.match(/[$£€]/);
        if (symM) {
          const m = nf.match(/\.(0+)/);
          const dec = m ? m[1].length : 2;
          return symM[0] + val.toLocaleString('en-US', {minimumFractionDigits: dec, maximumFractionDigits: dec});
        }
        if (nf.includes(',')) {
          const m = nf.match(/\.(0+)/);
          const dec = m ? m[1].length : 0;
          return val.toLocaleString('en-US', {minimumFractionDigits: dec, maximumFractionDigits: dec});
        }
        const m = nf.match(/\.(0+)/);
        if (m) return val.toFixed(m[1].length);
      } catch(e) {}
      return String(val);
    }
    return String(val);
  }

  // ─────────────────────────────────────────────────────────────────────────

  fetch("/api/excel/data")
    .then(r => r.json())
    .then(data => {
      if (data.error) throw new Error(data.error);
      sheets = data.sheets;
      initHF(sheets);
      document.getElementById("loading").classList.add("hidden");
      document.getElementById("file-label").textContent = data.filename;
      document.getElementById("stats").classList.remove("hidden");
      document.getElementById("stat-sheets").textContent = sheets.length;
      document.getElementById("status-bar").classList.remove("hidden");
      renderTabs();
      renderSheet(0);
    })
    .catch(err => {
      document.getElementById("loading").classList.add("hidden");
      document.getElementById("error").classList.remove("hidden");
      document.getElementById("error-msg").textContent = err.message;
    });

  function renderTabs() {
    const bar = document.getElementById("tabs-bar");
    bar.innerHTML = "";
    sheets.forEach((sh, i) => {
      const btn = document.createElement("button");
      btn.className = "tab" + (i === 0 ? " active" : "");
      btn.textContent = sh.name;
      btn.onclick = () => {
        bar.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
        btn.classList.add("active");
        renderSheet(i);
      };
      bar.appendChild(btn);
    });
  }

  function colLabel(n) {
    let s = ""; n++;
    while (n > 0) { s = String.fromCharCode(64 + (n % 26 || 26)) + s; n = Math.floor((n - 1) / 26); }
    return s;
  }

  function renderSheet(idx) {
    const sh = sheets[idx];
    const [minR, minC, maxR, maxC] = sh.range;
    const cells     = sh.cells;
    const merges    = sh.merges;
    const colWidths = sh.colWidths;
    const rowHeights = sh.rowHeights;

    // Build covered + mergeMap (0-indexed)
    const covered  = new Set();
    const mergeMap = {};
    merges.forEach(([sr, sc, er, ec]) => {
      mergeMap[`${sr},${sc}`] = { rowspan: er - sr + 1, colspan: ec - sc + 1 };
      for (let r = sr; r <= er; r++)
        for (let c = sc; c <= ec; c++)
          if (r !== sr || c !== sc) covered.add(`${r},${c}`);
    });

    document.getElementById("stat-rows").textContent = maxR - minR + 1;
    document.getElementById("stat-cols").textContent = maxC - minC + 1;
    document.getElementById("cell-ref").textContent  = "";
    const fbar = document.getElementById("cell-formula");
    fbar.textContent = "";
    fbar.className = "formula-content";
    document.getElementById("stat-avg").textContent   = "—";
    document.getElementById("stat-count").textContent = "—";
    document.getElementById("stat-sum").textContent   = "—";
    selectedCell = null;

    const grid = document.getElementById("grid");
    grid.innerHTML = "";
    document.getElementById("grid-wrapper").classList.remove("hidden");

    // <colgroup>
    const colgroup = document.createElement("colgroup");
    const cornerCol = document.createElement("col");
    cornerCol.style.width = "40px";
    colgroup.appendChild(cornerCol);
    for (let c = minC; c <= maxC; c++) {
      const col = document.createElement("col");
      const w = colWidths[String(c)] || 80;
      col.style.width = w + "px";
      colgroup.appendChild(col);
    }
    grid.appendChild(colgroup);

    // Header row
    const thead = document.createElement("thead");
    const hrow  = document.createElement("tr");
    hrow.appendChild(document.createElement("th"));
    for (let c = minC; c <= maxC; c++) {
      const th = document.createElement("th");
      th.textContent = colLabel(c - minC);
      th.dataset.col = c - minC;
      hrow.appendChild(th);
    }
    thead.appendChild(hrow);
    grid.appendChild(thead);

    // Body
    const tbody = document.createElement("tbody");
    for (let r = minR; r <= maxR; r++) {
      const tr = document.createElement("tr");
      const rh = rowHeights[String(r)];
      if (rh) tr.style.height = rh + "px";

      const rowTh = document.createElement("th");
      rowTh.textContent = r + 1;
      rowTh.dataset.row = r - minR;
      tr.appendChild(rowTh);

      for (let c = minC; c <= maxC; c++) {
        if (covered.has(`${r},${c}`)) continue;

        const td  = document.createElement("td");
        td.dataset.row = r - minR;
        td.dataset.col = c - minC;

        const mg = mergeMap[`${r},${c}`];
        if (mg) {
          if (mg.colspan > 1) td.colSpan = mg.colspan;
          if (mg.rowspan > 1) td.rowSpan = mg.rowspan;
        }

        const cd = cells[`${r},${c}`];
        if (cd) {
          let display = "";
          let rawVal  = cd.v !== undefined && cd.v !== null ? String(cd.v) : "";
          let isNum   = cd.t === "n";
          let isError = false;

          if (cd.w !== undefined && cd.w !== "") {
            // Pre-computed display from Python (cached value existed)
            display = cd.w;
          } else if (cd.f && hf) {
            // Compute via HyperFormula
            const hfVal = hfGet(sh.name, r, c);
            if (hfVal !== null && hfVal !== undefined) {
              display = hfFmt(hfVal, cd.nf);
              if (typeof hfVal === 'number') {
                rawVal = String(hfVal);
                isNum  = true;
              } else if (typeof hfVal === 'object' && hfVal.type) {
                isError = true;  // formula error like #REF!
              }
            }
          } else if (cd.v !== undefined && cd.v !== null) {
            display = String(cd.v);
          }

          td.textContent    = display;
          td.dataset.display = display;
          td.dataset.formula = cd.f || "";
          td.dataset.rawVal  = rawVal;
          td.dataset.type    = isNum ? "n" : (cd.t || "s");
          if (isNum && !td.style.textAlign) td.classList.add("num");
          if (isError) td.classList.add("hf-error");

          // Apply styles from openpyxl
          if (cd.s) applyStyle(td, cd.s);
        } else {
          td.dataset.display = "";
          td.dataset.formula = "";
          td.dataset.rawVal  = "";
        }

        td.addEventListener("click", onCellClick);
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }
    grid.appendChild(tbody);
  }

  function applyStyle(el, s) {
    if (s.bg)      el.style.backgroundColor = s.bg;
    if (s.bold)    el.style.fontWeight = "bold";
    if (s.italic)  el.style.fontStyle  = "italic";
    if (s.underline) el.style.textDecoration = "underline";
    if (s.fontSize) el.style.fontSize = Math.round(s.fontSize * 4 / 3) + "px";
    if (s.fontName) el.style.fontFamily = `"${s.fontName}", Calibri, sans-serif`;
    if (s.color)   el.style.color = s.color;
    if (s.align && s.align !== "general") el.style.textAlign = s.align;
    if (s.wrap)    el.style.whiteSpace = "normal";
  }

  function onCellClick(e) {
    const td = e.currentTarget;

    if (selectedCell) {
      selectedCell.classList.remove("selected");
      const pr = parseInt(selectedCell.dataset.row);
      const pc = parseInt(selectedCell.dataset.col);
      const prh = document.querySelector(`tbody th[data-row="${pr}"]`);
      if (prh) prh.classList.remove("row-highlight");
      const pch = document.querySelectorAll("thead th")[pc + 1];
      if (pch) pch.classList.remove("col-highlight");
    }

    td.classList.add("selected");
    selectedCell = td;

    const col = parseInt(td.dataset.col);
    const row = parseInt(td.dataset.row);
    document.getElementById("cell-ref").textContent = colLabel(col) + (row + 1);

    // Formula bar: show formula if present, else display value
    const fbar = document.getElementById("cell-formula");
    const formula = td.dataset.formula;
    if (formula) {
      fbar.textContent = formula;
      fbar.className = "formula-content is-formula";
    } else {
      fbar.textContent = td.dataset.display;
      fbar.className = "formula-content";
    }

    // Highlight row/col headers
    const rowHeader = document.querySelector(`tbody th[data-row="${row}"]`);
    if (rowHeader) rowHeader.classList.add("row-highlight");
    const headers = document.querySelectorAll("thead th");
    if (headers[col + 1]) headers[col + 1].classList.add("col-highlight");

    // Status bar
    const num = parseFloat(td.dataset.rawVal);
    if (!isNaN(num) && td.dataset.type === "n") {
      document.getElementById("stat-avg").textContent   = num.toLocaleString();
      document.getElementById("stat-count").textContent = "1";
      document.getElementById("stat-sum").textContent   = num.toLocaleString();
    } else {
      document.getElementById("stat-avg").textContent   = "—";
      document.getElementById("stat-count").textContent = td.dataset.display ? "1" : "0";
      document.getElementById("stat-sum").textContent   = "—";
    }
  }
