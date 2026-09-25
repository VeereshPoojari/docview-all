import { ZipReader } from '../utils/zipReader.js';
import { VirtualScroller } from '../core/VirtualScroller.js';

/**
 * Namespace-Agnostic XML Helper
 * Works reliably across all browsers regardless of default XML namespaces or prefixes.
 */
function getNodes(parent, localName) {
  if (!parent) return [];
  if (typeof parent.getElementsByTagNameNS === 'function') {
    const nodes = parent.getElementsByTagNameNS('*', localName);
    if (nodes && nodes.length > 0) return Array.from(nodes);
  }
  if (typeof parent.getElementsByTagName === 'function') {
    const nodes = parent.getElementsByTagName(localName);
    if (nodes && nodes.length > 0) return Array.from(nodes);
  }
  const result = [];
  for (let i = 0; i < parent.children.length; i++) {
    const child = parent.children[i];
    if (child.localName === localName || child.nodeName.endsWith(':' + localName) || child.nodeName === localName) {
      result.push(child);
    }
  }
  return result;
}

/**
 * Handcrafted Zero-Dependency XLSX / Excel Spreadsheet Engine
 * High-performance virtualized 60fps scrolling, multi-sheet tabs, and inline/shared string parsing.
 */
export class XlsxEngine {
  constructor(viewer) {
    this.viewer = viewer;
    this.container = null;
    this.zip = null;
    this.sharedStrings = [];
    this.sheets = [];
    this.currentSheetIndex = 0;
    this.currentHeaders = [];
    this.currentRows = [];
    this.filteredRows = [];
    this.virtualScroller = null;
    this.wrapText = false;
    this.selectedCell = null;
  }

  async render(fileInput, viewport) {
    this.container = document.createElement('div');
    this.container.className = 'dva-sheet-container';
    this.container.style.width = '100%';
    this.container.style.height = '100%';
    this.container.style.display = 'flex';
    this.container.style.flexDirection = 'column';
    this.container.style.background = 'var(--dva-bg, #0b0f19)';
    this.container.style.position = 'relative';
    this.container.style.overflow = 'hidden';

    viewport.appendChild(this.container);

    try {
      this.container.innerHTML = '<div style="color: var(--dva-text-secondary); text-align: center; padding: 60px;">Reading Excel workbook...</div>';

      let arrayBuffer;
      if (typeof fileInput === 'string') {
        const res = await fetch(fileInput);
        if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to fetch ${fileInput}`);
        arrayBuffer = await res.arrayBuffer();
      } else if (fileInput instanceof Blob || fileInput instanceof File) {
        arrayBuffer = await fileInput.arrayBuffer();
      } else if (fileInput instanceof ArrayBuffer) {
        arrayBuffer = fileInput;
      }

      this.zip = new ZipReader(arrayBuffer);
      await this.zip.parse();

      // 1. Extract Shared Strings (if present)
      await this.loadSharedStrings();

      // 2. Discover Sheets
      await this.discoverSheets();

      // 3. Render Active Sheet
      await this.loadSheet(0);

      const fileName = fileInput.name || (typeof fileInput === 'string' ? fileInput.split('/').pop().split('?')[0] : 'Spreadsheet.xlsx');
      if (this.viewer && typeof this.viewer.notify === 'function') {
        this.viewer.notify(`Loaded Excel: ${fileName} (${this.sheets.length} sheet${this.sheets.length > 1 ? 's' : ''})`, 'success');
      }
    } catch (err) {
      console.error('XlsxEngine error:', err);
      const fileName = fileInput.name || (typeof fileInput === 'string' ? fileInput.split('/').pop().split('?')[0] : 'Spreadsheet.xlsx');
      this.container.innerHTML = `
        <div style="text-align: center; padding: 60px 20px;">
          <div style="font-size: 40px; margin-bottom: 12px;">📊</div>
          <h3 style="color: var(--dva-text); margin-bottom: 8px;">Excel Spreadsheet Preview</h3>
          <p style="color: var(--dva-text-secondary); font-size: 14px; margin-bottom: 20px;">${this.escape(fileName)}</p>
          <p style="color: #ef4444; font-size: 13px; margin-bottom: 20px;">${this.escape(err.message)}</p>
          <button class="dva-btn" id="xlsx-dl-btn" style="width: auto; height: 38px; padding: 0 20px; background: var(--dva-primary); color: #fff; font-weight: 700; border-radius: 8px; cursor: pointer;">
            Download Original Excel
          </button>
        </div>
      `;
      const dlBtn = this.container.querySelector('#xlsx-dl-btn');
      if (dlBtn) dlBtn.onclick = () => this.viewer.download();
    }
  }

  async loadSharedStrings() {
    this.sharedStrings = [];
    const sstXml = await this.zip.readEntryAsText('xl/sharedStrings.xml');
    if (!sstXml) return;

    const parser = new DOMParser();
    const doc = parser.parseFromString(sstXml, 'application/xml');
    const siNodes = getNodes(doc, 'si');

    for (let i = 0; i < siNodes.length; i++) {
      const si = siNodes[i];
      let str = '';
      const tNodes = getNodes(si, 't');
      for (let j = 0; j < tNodes.length; j++) {
        str += tNodes[j].textContent || '';
      }
      this.sharedStrings.push(str);
    }
  }

  async discoverSheets() {
    this.sheets = [];
    const relsMap = new Map();

    // Read workbook relationships (maps rId1 -> worksheets/sheet1.xml)
    const relsXml = await this.zip.readEntryAsText('xl/_rels/workbook.xml.rels');
    if (relsXml) {
      const parser = new DOMParser();
      const doc = parser.parseFromString(relsXml, 'application/xml');
      const relNodes = getNodes(doc, 'Relationship');
      for (const rel of relNodes) {
        const id = rel.getAttribute('Id');
        let target = rel.getAttribute('Target') || '';
        if (target) {
          // Normalize target path
          if (!target.startsWith('xl/') && !target.startsWith('/')) {
            target = 'xl/' + target;
          } else if (target.startsWith('/')) {
            target = target.substring(1);
          }
          relsMap.set(id, target);
        }
      }
    }

    // Read workbook structure
    const wbXml = await this.zip.readEntryAsText('xl/workbook.xml');
    if (wbXml) {
      const parser = new DOMParser();
      const doc = parser.parseFromString(wbXml, 'application/xml');
      const sheetNodes = getNodes(doc, 'sheet');

      for (let i = 0; i < sheetNodes.length; i++) {
        const name = sheetNodes[i].getAttribute('name') || `Sheet ${i + 1}`;
        const sheetId = sheetNodes[i].getAttribute('sheetId') || (i + 1);
        const rId = sheetNodes[i].getAttribute('r:id') || sheetNodes[i].getAttribute('id') || `rId${i + 1}`;

        let path = relsMap.get(rId);
        if (!path) {
          path = `xl/worksheets/sheet${sheetId}.xml`;
        }

        this.sheets.push({ name, path, id: sheetId });
      }
    }

    // Fallback: Scan ZIP file list for any worksheets
    if (this.sheets.length === 0) {
      const fileList = this.zip.getFileList();
      for (const f of fileList) {
        if (/worksheets\/sheet.*\.xml$/i.test(f)) {
          const sheetName = f.split('/').pop().replace(/\.xml$/i, '');
          this.sheets.push({ name: sheetName.toUpperCase(), path: f });
        }
      }
    }

    if (this.sheets.length === 0) {
      this.sheets.push({ name: 'Sheet 1', path: 'xl/worksheets/sheet1.xml' });
    }
  }

  async loadSheet(index) {
    if (index < 0 || index >= this.sheets.length) return;
    this.currentSheetIndex = index;
    const targetSheet = this.sheets[index];

    let sheetXml = await this.zip.readEntryAsText(targetSheet.path);
    if (!sheetXml) {
      // Try finding by filename alone
      const fileName = targetSheet.path.split('/').pop();
      sheetXml = await this.zip.readEntryAsText(fileName);
    }

    if (!sheetXml) {
      // Try any sheet entry from zip
      const fileList = this.zip.getFileList();
      const fallbackEntry = fileList.find(f => /sheet.*\.xml$/i.test(f));
      if (fallbackEntry) {
        sheetXml = await this.zip.readEntryAsText(fallbackEntry);
      }
    }

    if (!sheetXml) {
      throw new Error(`Unable to load data for sheet: ${targetSheet.name}`);
    }

    this.parseSheetXml(sheetXml);
    this.renderTableView();
  }

  colLetterToIndex(colStr) {
    let idx = 0;
    for (let i = 0; i < colStr.length; i++) {
      idx = idx * 26 + (colStr.charCodeAt(i) - 64);
    }
    return idx - 1;
  }

  parseCellRef(ref) {
    const match = ref.match(/^([A-Z]+)([0-9]+)$/i);
    if (!match) return null;
    return {
      col: this.colLetterToIndex(match[1].toUpperCase()),
      row: parseInt(match[2], 10)
    };
  }

  indexToColLetter(index) {
    let temp, letter = '';
    while (index >= 0) {
      temp = index % 26;
      letter = String.fromCharCode(temp + 65) + letter;
      index = Math.floor(index / 26) - 1;
    }
    return letter;
  }

  parseSheetXml(xmlStr) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlStr, 'application/xml');
    const rowNodes = getNodes(doc, 'row');

    const grid = [];
    let maxCols = 0;

    for (let i = 0; i < rowNodes.length; i++) {
      const rowNode = rowNodes[i];
      const rNum = parseInt(rowNode.getAttribute('r') || (i + 1), 10);
      const rowArr = [];

      const cellNodes = getNodes(rowNode, 'c');
      let autoCol = 0;

      for (let j = 0; j < cellNodes.length; j++) {
        const cell = cellNodes[j];
        const ref = cell.getAttribute('r') || '';
        let col = autoCol;

        if (ref) {
          const parsed = this.parseCellRef(ref);
          if (parsed) col = parsed.col;
        }

        const type = cell.getAttribute('t') || '';
        let val = '';

        if (type === 's') {
          // Shared String index
          const vNodes = getNodes(cell, 'v');
          if (vNodes.length > 0) {
            const idx = parseInt(vNodes[0].textContent, 10);
            val = this.sharedStrings[idx] !== undefined ? this.sharedStrings[idx] : '';
          }
        } else if (type === 'inlineStr') {
          // Inline String
          const tNodes = getNodes(cell, 't');
          if (tNodes.length > 0) val = tNodes[0].textContent || '';
        } else if (type === 'str') {
          // Plain formula string result
          const vNodes = getNodes(cell, 'v');
          if (vNodes.length > 0) val = vNodes[0].textContent || '';
        } else if (type === 'b') {
          // Boolean
          const vNodes = getNodes(cell, 'v');
          val = vNodes.length > 0 && vNodes[0].textContent === '1' ? 'TRUE' : 'FALSE';
        } else {
          // Number, date or default value
          const vNodes = getNodes(cell, 'v');
          if (vNodes.length > 0) val = vNodes[0].textContent || '';
        }

        rowArr[col] = val;
        if (col + 1 > maxCols) maxCols = col + 1;
        autoCol = col + 1;
      }

      grid.push({ rowNumber: rNum, cells: rowArr });
    }

    if (grid.length === 0) {
      this.currentHeaders = ['A', 'B', 'C', 'D'];
      this.currentRows = [];
      this.filteredRows = [];
      return;
    }

    // First row used as header if it has values
    const firstRow = grid[0];
    const headers = [];
    for (let c = 0; c < maxCols; c++) {
      const val = firstRow.cells[c];
      headers.push(val !== undefined && val !== '' ? String(val) : this.indexToColLetter(c));
    }

    const rows = [];
    for (let i = 1; i < grid.length; i++) {
      const rowData = [];
      for (let c = 0; c < maxCols; c++) {
        const cellVal = grid[i].cells[c];
        rowData.push(cellVal !== undefined ? cellVal : '');
      }
      rows.push(rowData);
    }

    this.currentHeaders = headers;
    this.currentRows = rows;
    this.filteredRows = rows;
  }

  renderTableView() {
    this.container.innerHTML = '';

    // Sheet Info & Search Bar
    const topBar = document.createElement('div');
    topBar.style.display = 'flex';
    topBar.style.alignItems = 'center';
    topBar.style.justifyContent = 'space-between';
    topBar.style.padding = '8px 16px';
    topBar.style.background = 'rgba(255, 255, 255, 0.02)';
    topBar.style.borderBottom = '1px solid var(--dva-border)';
    topBar.style.flexShrink = '0';

    topBar.innerHTML = `
      <div style="display: flex; align-items: center; gap: 12px;">
        <span style="font-size: 13px; font-weight: 700; color: var(--dva-text);">
          ${this.escape(this.sheets[this.currentSheetIndex].name)}
        </span>
        <span style="font-size: 11px; padding: 2px 8px; border-radius: 12px; background: rgba(59, 130, 246, 0.15); color: #60a5fa; font-weight: 600;">
          ${this.currentRows.length} rows × ${this.currentHeaders.length} columns
        </span>
      </div>
      <div style="display: flex; align-items: center; gap: 10px;">
        <div class="dva-wrap-segmented-group" title="Text Wrapping: toggle single-line clip or multiline wrap">
          <button id="xlsx-btn-unwrap" class="dva-segment-btn ${!this.wrapText ? 'active' : ''}" title="Unwrap / Clip: single-line cells with ellipsis">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <line x1="3" y1="12" x2="16" y2="12"></line>
              <line x1="3" y1="18" x2="21" y2="18"></line>
              <polyline points="18 9 21 12 18 15"></polyline>
            </svg>
            <span>Unwrap</span>
          </button>
          <button id="xlsx-btn-wrap" class="dva-segment-btn ${this.wrapText ? 'active' : ''}" title="Wrap: multiline cells so all long text is fully visible">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <path d="M3 12h14a3 3 0 1 1 0 6h-4"></path>
              <polyline points="16 15 13 18 16 21"></polyline>
              <line x1="3" y1="18" x2="8" y2="18"></line>
            </svg>
            <span>Wrap</span>
          </button>
        </div>
        <div style="position: relative;">
          <input type="text" id="xlsx-search-input" placeholder="Search table..." style="
            background: rgba(255, 255, 255, 0.06);
            border: 1px solid var(--dva-border);
            border-radius: 6px;
            padding: 4px 10px;
            color: var(--dva-text);
            font-size: 12px;
            outline: none;
            width: 160px;
          " />
        </div>
      </div>
    `;

    this.container.appendChild(topBar);

    // Formula & Cell Inspection Bar
    const formulaBar = document.createElement('div');
    formulaBar.id = 'xlsx-formula-bar';
    formulaBar.className = 'dva-xlsx-formula-bar';
    formulaBar.innerHTML = `
      <span class="dva-fx-label">fx</span>
      <span id="xlsx-cell-coord" class="dva-fx-coord">${this.selectedCell ? this.selectedCell.coord : '—'}</span>
      <div id="xlsx-formula-value" class="dva-fx-value" title="Full content of the selected cell">
        ${this.selectedCell ? this.escape(this.selectedCell.val) : '<span style="color: var(--dva-text-muted); font-style: italic;">Click any cell to read or copy full content</span>'}
      </div>
      <button id="xlsx-fx-copy" class="dva-fx-copy-btn" title="Copy full cell text to clipboard">📋 Copy</button>
    `;
    this.container.appendChild(formulaBar);

    const unwrapBtn = topBar.querySelector('#xlsx-btn-unwrap');
    const wrapBtn = topBar.querySelector('#xlsx-btn-wrap');

    if (unwrapBtn) {
      unwrapBtn.onclick = () => {
        if (this.wrapText) {
          this.wrapText = false;
          unwrapBtn.classList.add('active');
          if (wrapBtn) wrapBtn.classList.remove('active');
          this.rebuildVirtualTable();
        }
      };
    }

    if (wrapBtn) {
      wrapBtn.onclick = () => {
        if (!this.wrapText) {
          this.wrapText = true;
          wrapBtn.classList.add('active');
          if (unwrapBtn) unwrapBtn.classList.remove('active');
          this.rebuildVirtualTable();
        }
      };
    }

    const copyFxBtn = formulaBar.querySelector('#xlsx-fx-copy');
    if (copyFxBtn) {
      copyFxBtn.onclick = () => {
        if (this.selectedCell && this.selectedCell.val) {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(this.selectedCell.val).then(() => {
              copyFxBtn.textContent = '✓ Copied';
              setTimeout(() => { copyFxBtn.textContent = '📋 Copy'; }, 2000);
            });
          }
        }
      };
    }

    const searchInput = topBar.querySelector('#xlsx-search-input');
    searchInput.oninput = (e) => {
      const q = e.target.value.toLowerCase().trim();
      if (!q) {
        this.filteredRows = this.currentRows;
      } else {
        this.filteredRows = this.currentRows.filter(row =>
          row.some(cell => String(cell).toLowerCase().includes(q))
        );
      }
      this.rebuildVirtualTable();
    };

    // Table Wrapper
    const tableContainer = document.createElement('div');
    tableContainer.id = 'xlsx-table-wrapper';
    tableContainer.style.flex = '1';
    tableContainer.style.display = 'flex';
    tableContainer.style.flexDirection = 'column';
    tableContainer.style.overflow = 'hidden';
    this.container.appendChild(tableContainer);

    // Multi-sheet tabs bar
    if (this.sheets.length > 1) {
      const tabsBar = document.createElement('div');
      tabsBar.style.display = 'flex';
      tabsBar.style.alignItems = 'center';
      tabsBar.style.gap = '4px';
      tabsBar.style.padding = '6px 12px';
      tabsBar.style.background = '#090d16';
      tabsBar.style.borderTop = '1px solid var(--dva-border)';
      tabsBar.style.overflowX = 'auto';
      tabsBar.style.flexShrink = '0';

      this.sheets.forEach((sheet, idx) => {
        const tabBtn = document.createElement('button');
        const isActive = idx === this.currentSheetIndex;
        tabBtn.textContent = sheet.name;
        tabBtn.style.padding = '4px 12px';
        tabBtn.style.fontSize = '12px';
        tabBtn.style.fontWeight = '600';
        tabBtn.style.borderRadius = '4px';
        tabBtn.style.border = isActive ? '1px solid var(--dva-primary)' : '1px solid transparent';
        tabBtn.style.background = isActive ? 'rgba(59, 130, 246, 0.2)' : 'transparent';
        tabBtn.style.color = isActive ? '#93c5fd' : 'var(--dva-text-secondary)';
        tabBtn.style.cursor = 'pointer';

        tabBtn.onclick = () => this.loadSheet(idx);
        tabsBar.appendChild(tabBtn);
      });

      this.container.appendChild(tabsBar);
    }

    this.rebuildVirtualTable();
  }

  rebuildVirtualTable() {
    const tableContainer = this.container.querySelector('#xlsx-table-wrapper');
    if (!tableContainer) return;
    tableContainer.innerHTML = '';

    const scrollContainer = document.createElement('div');
    scrollContainer.style.flex = '1';
    scrollContainer.style.overflow = 'auto';
    scrollContainer.style.position = 'relative';

    const totalCols = this.currentHeaders.length + 1;
    const totalRows = this.filteredRows.length;
    const rowHeight = this.wrapText ? 56 : 34;
    const overscan = 12;

    // Single native HTML table so headers and columns never desync
    const table = document.createElement('table');
    table.className = `dva-table ${this.wrapText ? 'dva-table-wrapped' : ''}`;
    table.style.width = '100%';
    table.style.borderCollapse = 'collapse';
    table.style.margin = '0';
    table.style.tableLayout = 'auto';

    // Sticky Thead
    const thead = document.createElement('thead');
    thead.style.position = 'sticky';
    thead.style.top = '0';
    thead.style.zIndex = '10';
    thead.style.background = 'var(--dva-surface)';

    let thHtml = `<th style="width: 54px; min-width: 54px; text-align: center; border-right: 1px solid var(--dva-border); background: var(--dva-surface); padding: 8px 6px;">#</th>`;
    for (const h of this.currentHeaders) {
      thHtml += `<th style="border-right: 1px solid var(--dva-border); padding: 8px 14px; font-size: 12.5px; font-weight: 700; white-space: nowrap; background: var(--dva-surface);">${this.escape(h)}</th>`;
    }
    thead.innerHTML = `<tr>${thHtml}</tr>`;
    table.appendChild(thead);

    // Tbody
    const tbody = document.createElement('tbody');
    table.appendChild(tbody);
    scrollContainer.appendChild(table);
    tableContainer.appendChild(scrollContainer);

    const renderRows = () => {
      const scrollTop = scrollContainer.scrollTop;
      const clientHeight = scrollContainer.clientHeight || 500;
      const visibleCount = Math.ceil(clientHeight / rowHeight);

      const start = Math.floor(scrollTop / rowHeight);
      const startIndex = Math.max(0, start - overscan);
      const endIndex = Math.min(totalRows, start + visibleCount + overscan);

      const topSpacerHeight = startIndex * rowHeight;
      const bottomSpacerHeight = Math.max(0, (totalRows - endIndex) * rowHeight);

      let rowsHtml = '';
      if (topSpacerHeight > 0) {
        rowsHtml += `<tr style="height: ${topSpacerHeight}px; pointer-events: none;"><td colspan="${totalCols}" style="padding: 0; border: none;"></td></tr>`;
      }

      for (let i = startIndex; i < endIndex; i++) {
        const row = this.filteredRows[i];
        if (!row) continue;

        let cellsHtml = `<td style="width: 54px; min-width: 54px; text-align: center; color: var(--dva-text-muted); font-size: 11px; font-family: monospace; border-right: 1px solid var(--dva-border); background: rgba(255,255,255,0.01); user-select: none;">${i + 1}</td>`;
        for (let c = 0; c < this.currentHeaders.length; c++) {
          const val = row[c] !== undefined ? row[c] : '';
          const coord = `${this.indexToColLetter(c)}${i + 1}`;
          const isSelected = this.selectedCell && this.selectedCell.coord === coord;
          const activeClass = isSelected ? ' dva-cell-active' : '';
          const wrapClass = this.wrapText ? ' dva-cell-wrapped' : '';
          const cellStyle = this.wrapText
            ? 'border-right: 1px solid var(--dva-border); padding: 8px 14px; font-size: 13px; white-space: normal; word-break: break-word; min-width: 140px; cursor: pointer;'
            : 'border-right: 1px solid var(--dva-border); padding: 6px 14px; font-size: 13px; white-space: nowrap; max-width: 400px; overflow: hidden; text-overflow: ellipsis; cursor: pointer;';

          cellsHtml += `<td class="dva-cell${activeClass}${wrapClass}" data-coord="${coord}" data-row="${i}" data-col="${c}" title="${this.escape(val)}" style="${cellStyle}">${this.escape(val)}</td>`;
        }

        const rowClass = i % 2 === 0 ? 'dva-row-even' : 'dva-row-odd';
        rowsHtml += `<tr class="${rowClass}" style="min-height: ${rowHeight}px; border-bottom: 1px solid var(--dva-border);">${cellsHtml}</tr>`;
      }

      if (bottomSpacerHeight > 0) {
        rowsHtml += `<tr style="height: ${bottomSpacerHeight}px; pointer-events: none;"><td colspan="${totalCols}" style="padding: 0; border: none;"></td></tr>`;
      }

      tbody.innerHTML = rowsHtml;
    };

    // Cell click to inspect & copy in Formula Bar
    scrollContainer.onclick = (e) => {
      const td = e.target.closest('td[data-coord]');
      if (!td) return;
      const coord = td.getAttribute('data-coord');
      const r = parseInt(td.getAttribute('data-row'), 10);
      const c = parseInt(td.getAttribute('data-col'), 10);
      const rawVal = this.filteredRows[r] && this.filteredRows[r][c] !== undefined ? String(this.filteredRows[r][c]) : '';

      this.selectedCell = { coord, val: rawVal };

      const coordEl = this.container.querySelector('#xlsx-cell-coord');
      const valEl = this.container.querySelector('#xlsx-formula-value');
      if (coordEl) coordEl.textContent = coord;
      if (valEl) {
        valEl.textContent = rawVal !== '' ? rawVal : '(Empty)';
        valEl.style.color = rawVal !== '' ? 'var(--dva-text)' : 'var(--dva-text-muted)';
      }

      scrollContainer.querySelectorAll('td.dva-cell-active').forEach(el => el.classList.remove('dva-cell-active'));
      td.classList.add('dva-cell-active');
    };

    scrollContainer.addEventListener('scroll', renderRows, { passive: true });
    this.tableScrollContainer = scrollContainer;
    this.tableScrollListener = renderRows;
    renderRows();
  }

  escape(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  updateTransform() {}

  destroy() {
    if (this.tableScrollContainer && this.tableScrollListener) {
      this.tableScrollContainer.removeEventListener('scroll', this.tableScrollListener);
    }
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    this.container = null;
  }
}
