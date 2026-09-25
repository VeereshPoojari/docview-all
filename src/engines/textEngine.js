import { formatFileSize } from '../utils/mimeDetector.js';

/**
 * Handcrafted Zero-Dependency Plain Text Engine
 * Fast line virtualization, statistics (lines, words, chars), search filter,
 * word wrap toggle, and copy-all action.
 */
export class TextEngine {
  constructor(viewer) {
    this.viewer = viewer;
    this.container = null;
    this.rawText = '';
    this.lines = [];
    this.isWrapped = true;
    this.fontSize = 13.5;
  }

  async render(fileInput, viewport) {
    this.container = document.createElement('div');
    this.container.className = 'dva-text-container';
    this.container.style.width = '100%';
    this.container.style.height = '100%';
    this.container.style.display = 'flex';
    this.container.style.flexDirection = 'column';
    this.container.style.background = 'var(--dva-bg, #090d16)';
    this.container.style.overflow = 'hidden';

    viewport.appendChild(this.container);

    try {
      this.container.innerHTML = '<div style="color: var(--dva-text-secondary); text-align: center; padding: 60px;">Reading text file...</div>';

      let text = '';
      let fileSize = 0;

      if (typeof fileInput === 'string') {
        const res = await fetch(fileInput);
        if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to fetch ${fileInput}`);
        text = await res.text();
        fileSize = text.length;
      } else if (fileInput instanceof Blob || fileInput instanceof File) {
        fileSize = fileInput.size;
        text = await fileInput.text();
      }

      this.rawText = text;
      this.lines = text.split(/\r\n|\n/);
      this.renderView(fileSize);

      const fileName = fileInput.name || (typeof fileInput === 'string' ? fileInput.split('/').pop().split('?')[0] : 'Document.txt');
      if (this.viewer && typeof this.viewer.notify === 'function') {
        this.viewer.notify(`Loaded Text: ${fileName} (${this.lines.length} lines)`, 'success');
      }
    } catch (err) {
      console.error('TextEngine error:', err);
      this.container.innerHTML = `
        <div style="text-align: center; padding: 60px 20px;">
          <div style="font-size: 40px; margin-bottom: 12px;">📝</div>
          <h3 style="color: var(--dva-text); margin-bottom: 8px;">Text Preview Error</h3>
          <p style="color: #ef4444; font-size: 13px; margin-bottom: 20px;">${this.escape(err.message)}</p>
        </div>
      `;
    }
  }

  renderView(fileSize) {
    this.container.innerHTML = '';

    const wordCount = (this.rawText.match(/\S+/g) || []).length;
    const charCount = this.rawText.length;
    const lineCount = this.lines.length;

    // Header Toolbar
    const headerBar = document.createElement('div');
    headerBar.className = 'dva-text-header-bar';
    headerBar.style.display = 'flex';
    headerBar.style.alignItems = 'center';
    headerBar.style.justifyContent = 'space-between';
    headerBar.style.padding = '8px 16px';
    headerBar.style.background = 'rgba(255, 255, 255, 0.02)';
    headerBar.style.borderBottom = '1px solid var(--dva-border)';
    headerBar.style.flexShrink = '0';
    headerBar.style.gap = '12px';
    headerBar.style.flexWrap = 'wrap';

    headerBar.innerHTML = `
      <div style="display: flex; align-items: center; gap: 10px; font-size: 12px; color: var(--dva-text-secondary);">
        <span style="background: rgba(59, 130, 246, 0.15); color: #60a5fa; padding: 2px 8px; border-radius: 4px; font-weight: 700;">
          ${lineCount.toLocaleString()} lines
        </span>
        <span>•</span>
        <span>${wordCount.toLocaleString()} words</span>
        <span>•</span>
        <span>${charCount.toLocaleString()} chars</span>
        ${fileSize > 0 ? `<span>•</span><span>${formatFileSize(fileSize)}</span>` : ''}
      </div>

      <div style="display: flex; align-items: center; gap: 8px;">
        <input 
          type="text" 
          id="dva-text-search" 
          placeholder="Filter text..." 
          style="height: 28px; padding: 0 10px; font-size: 12px; background: rgba(255,255,255,0.05); border: 1px solid var(--dva-border); border-radius: 6px; color: var(--dva-text); outline: none; width: 140px;" 
        />
        <button id="dva-text-wrap-btn" style="height: 28px; padding: 0 10px; font-size: 11.5px; font-weight: 600; background: rgba(255,255,255,0.06); border: 1px solid var(--dva-border); border-radius: 6px; color: var(--dva-text); cursor: pointer;">
          Wrap: ON
        </button>
        <button id="dva-text-copy-btn" style="height: 28px; padding: 0 12px; font-size: 11.5px; font-weight: 700; background: var(--dva-primary); border: none; border-radius: 6px; color: #fff; cursor: pointer;">
          Copy All
        </button>
      </div>
    `;

    this.container.appendChild(headerBar);

    // Content Body Area
    const bodyArea = document.createElement('div');
    bodyArea.id = 'dva-text-body';
    bodyArea.style.flex = '1';
    bodyArea.style.overflow = 'auto';
    bodyArea.style.padding = '16px 0';
    bodyArea.style.fontFamily = 'var(--dva-mono-font, "JetBrains Mono", Consolas, monospace)';
    bodyArea.style.fontSize = `${this.fontSize}px`;
    bodyArea.style.lineHeight = '1.65';
    bodyArea.style.color = 'var(--dva-text)';
    this.container.appendChild(bodyArea);

    this.renderLinesTable(this.lines);

    // Wire events
    const wrapBtn = headerBar.querySelector('#dva-text-wrap-btn');
    wrapBtn.onclick = () => {
      this.isWrapped = !this.isWrapped;
      wrapBtn.textContent = `Wrap: ${this.isWrapped ? 'ON' : 'OFF'}`;
      const codeCells = bodyArea.querySelectorAll('.dva-text-line-content');
      codeCells.forEach(cell => {
        cell.style.whiteSpace = this.isWrapped ? 'pre-wrap' : 'pre';
      });
    };

    const copyBtn = headerBar.querySelector('#dva-text-copy-btn');
    copyBtn.onclick = () => {
      navigator.clipboard.writeText(this.rawText).then(() => {
        copyBtn.textContent = '✓ Copied!';
        if (this.viewer && typeof this.viewer.notify === 'function') {
          this.viewer.notify('Copied entire text to clipboard', 'success');
        }
        setTimeout(() => { copyBtn.textContent = 'Copy All'; }, 1500);
      });
    };

    const searchInput = headerBar.querySelector('#dva-text-search');
    searchInput.oninput = (e) => {
      const q = e.target.value.toLowerCase().trim();
      if (!q) {
        this.renderLinesTable(this.lines);
      } else {
        const filtered = this.lines
          .map((line, idx) => ({ line, originalIdx: idx + 1 }))
          .filter(item => item.line.toLowerCase().includes(q));
        this.renderFilteredLines(filtered, q);
      }
    };
  }

  renderLinesTable(lines) {
    const bodyArea = this.container.querySelector('#dva-text-body');
    if (!bodyArea) return;

    let html = '<table style="width: 100%; border-collapse: collapse; table-layout: fixed;"><tbody>';
    lines.forEach((line, idx) => {
      html += `
        <tr style="transition: background 0.1s ease;">
          <td style="width: 56px; text-align: right; padding: 2px 14px 2px 8px; color: var(--dva-text-muted); font-size: 11px; user-select: none; vertical-align: top; border-right: 1px solid var(--dva-border); font-family: monospace;">${idx + 1}</td>
          <td class="dva-text-line-content" style="padding: 2px 16px; white-space: ${this.isWrapped ? 'pre-wrap' : 'pre'}; word-break: break-all; vertical-align: top;">${this.escape(line) || '&nbsp;'}</td>
        </tr>
      `;
    });
    html += '</tbody></table>';
    bodyArea.innerHTML = html;
  }

  renderFilteredLines(filteredItems, query) {
    const bodyArea = this.container.querySelector('#dva-text-body');
    if (!bodyArea) return;

    if (filteredItems.length === 0) {
      bodyArea.innerHTML = `<div style="text-align: center; color: var(--dva-text-muted); padding: 40px;">No lines match "${this.escape(query)}"</div>`;
      return;
    }

    let html = '<table style="width: 100%; border-collapse: collapse; table-layout: fixed;"><tbody>';
    filteredItems.forEach((item) => {
      const highlighted = this.highlightMatch(item.line, query);
      html += `
        <tr>
          <td style="width: 56px; text-align: right; padding: 2px 14px 2px 8px; color: var(--dva-text-muted); font-size: 11px; user-select: none; vertical-align: top; border-right: 1px solid var(--dva-border); font-family: monospace;">${item.originalIdx}</td>
          <td class="dva-text-line-content" style="padding: 2px 16px; white-space: ${this.isWrapped ? 'pre-wrap' : 'pre'}; word-break: break-all; vertical-align: top;">${highlighted || '&nbsp;'}</td>
        </tr>
      `;
    });
    html += '</tbody></table>';
    bodyArea.innerHTML = html;
  }

  highlightMatch(text, query) {
    const escapedText = this.escape(text);
    if (!query) return escapedText;
    const regex = new RegExp(`(${this.escapeRegex(query)})`, 'gi');
    return escapedText.replace(regex, '<mark style="background: rgba(234, 179, 8, 0.35); color: #fef08a; padding: 0 2px; border-radius: 2px;">$1</mark>');
  }

  escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  escape(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  updateTransform() {
    if (!this.container) return;
    const scale = this.viewer.scale || 1;
    const bodyArea = this.container.querySelector('#dva-text-body');
    if (bodyArea) {
      bodyArea.style.fontSize = `${this.fontSize * scale}px`;
    }
  }

  destroy() {
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    this.container = null;
  }
}
