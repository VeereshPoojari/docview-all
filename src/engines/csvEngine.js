import { VirtualScroller } from '../core/VirtualScroller.js';

/**
 * Handcrafted CSV & Spreadsheet Engine with Zero-Lag 60fps DOM Virtualizer
 */
export class CsvEngine {
  constructor(viewer) {
    this.viewer = viewer;
    this.container = null;
    this.virtualScroller = null;
    this.headers = [];
    this.rows = [];
  }

  async render(fileInput, viewport) {
    this.container = document.createElement('div');
    this.container.className = 'dva-sheet-container';
    viewport.appendChild(this.container);

    let textContent = '';
    if (typeof fileInput === 'string') {
      const res = await fetch(fileInput);
      textContent = await res.text();
    } else if (fileInput instanceof Blob || fileInput instanceof File) {
      textContent = await fileInput.text();
    }

    this.parseCsv(textContent);
    this.initVirtualTable();
  }

  parseCsv(text) {
    if (!text) return;
    const lines = text.split(/\r\n|\n/);
    if (lines.length === 0) return;

    // Fast delimiter detection (comma vs tab vs semicolon)
    const firstLine = lines[0];
    let delimiter = ',';
    if (firstLine.includes('\t')) delimiter = '\t';
    else if (firstLine.includes(';') && !firstLine.includes(',')) delimiter = ';';

    const parseLine = (line) => {
      // Regex handling commas inside quoted strings
      const row = [];
      let inQuotes = false;
      let curr = '';
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === delimiter && !inQuotes) {
          row.push(curr.trim());
          curr = '';
        } else {
          curr += char;
        }
      }
      row.push(curr.trim());
      return row;
    };

    this.headers = parseLine(lines[0]);
    this.rows = [];
    for (let i = 1; i < lines.length; i++) {
      if (lines[i].trim()) {
        this.rows.push(parseLine(lines[i]));
      }
    }
  }

  initVirtualTable() {
    this.container.innerHTML = '';

    // Render Table Header
    const headerHtml = `
      <table class="dva-table" style="position: sticky; top: 0; z-index: 10;">
        <thead>
          <tr>
            <th style="width: 50px; text-align: center;">#</th>
            ${this.headers.map(h => `<th>${this.escape(h)}</th>`).join('')}
          </tr>
        </thead>
      </table>
    `;

    const tableWrapper = document.createElement('div');
    tableWrapper.innerHTML = headerHtml;
    this.container.appendChild(tableWrapper);

    const bodyContainer = document.createElement('div');
    bodyContainer.style.height = 'calc(100% - 42px)';
    this.container.appendChild(bodyContainer);

    this.virtualScroller = new VirtualScroller({
      container: bodyContainer,
      totalItems: this.rows.length,
      itemHeight: 34,
      overscan: 6,
      renderRow: (index) => {
        const row = this.rows[index];
        if (!row) return '';
        return `
          <table class="dva-table" style="table-layout: fixed; width: 100%;">
            <tbody>
              <tr>
                <td style="width: 50px; text-align: center; color: var(--dva-text-muted); font-size: 11px;">${index + 1}</td>
                ${row.map(cell => `<td title="${this.escape(cell)}">${this.escape(cell)}</td>`).join('')}
              </tr>
            </tbody>
          </table>
        `;
      }
    });
  }

  escape(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  destroy() {
    if (this.virtualScroller) {
      this.virtualScroller.destroy();
    }
    this.container = null;
  }
}
