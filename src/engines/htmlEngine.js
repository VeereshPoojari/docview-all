/**
 * Handcrafted Zero-Dependency HTML Auto-Responsive Engine for DocView-All
 * 
 * Supports flexible developer configurations:
 * - 'preview': Pure auto-responsive live browser preview
 * - 'code': Syntax-highlighted HTML source with line numbers, search & Copy Code
 * - 'both' (split): Side-by-side split view (Code on Left + Live Browser Preview on Right) with Copy Code
 * 
 * Allows developers to lock to a single mode (e.g. preview only) or expose the user-friendly switcher.
 */

export class HtmlEngine {
  constructor(viewer) {
    this.viewer = viewer;
    this.container = null;
    this.rawHtml = '';
    this.allLines = [];
    this.searchQuery = '';
    this.wrapLines = false;
    this.activeLine = -1;

    // View Options
    const opts = (viewer && viewer.options) || {};

    // Normalize initial view mode ('split' and 'both' are aliases)
    let initialMode = opts.htmlMode || opts.htmlViewMode || 'preview';
    if (initialMode === 'split') initialMode = 'both';
    this.viewMode = ['preview', 'code', 'both'].includes(initialMode) ? initialMode : 'preview';

    // Allowed modes (e.g. ['preview'] or ['preview', 'code', 'both'])
    let allowed = opts.htmlAllowedModes || opts.htmlModes || ['preview', 'code', 'both'];
    if (typeof allowed === 'string') allowed = [allowed];
    this.allowedModes = allowed.map(m => (m === 'split' ? 'both' : m));

    // Show switcher only if allowed and more than 1 mode is available
    this.showSwitcher = opts.htmlShowSwitcher !== false && this.allowedModes.length > 1;
    this.allowScripts = opts.allowScripts !== false;

    // References
    this.previewIframe = null;
    this.blobUrl = null;
  }

  async render(fileInput, viewport) {
    this.container = document.createElement('div');
    this.container.className = 'dva-html-container';
    viewport.appendChild(this.container);

    // 1. Read input content as text
    if (typeof fileInput === 'string') {
      const trimmed = fileInput.trim();
      if (trimmed.startsWith('<') || trimmed.includes('<html') || trimmed.includes('<!DOCTYPE')) {
        this.rawHtml = fileInput;
      } else {
        try {
          const res = await fetch(fileInput);
          this.rawHtml = await res.text();
        } catch {
          this.rawHtml = `<!DOCTYPE html>
<html>
<head><title>Remote Document</title><style>body{font-family:sans-serif;padding:30px;color:#333;}</style></head>
<body><h2>Remote HTML File</h2><p>Unable to fetch remote source directly via CORS. You can download or view the file URL.</p></body>
</html>`;
        }
      }
    } else if (fileInput instanceof Blob || fileInput instanceof File) {
      this.rawHtml = await fileInput.text();
    } else if (fileInput && typeof fileInput === 'object' && fileInput.url) {
      return this.render(fileInput.url, viewport);
    } else {
      this.rawHtml = '<!-- Empty or invalid HTML content -->';
    }

    this.allLines = this.rawHtml.split(/\r\n|\n/);

    // 2. Render UI
    this.renderUiShell();

    // 3. Mount Active View
    this.updateViewMode(this.viewMode);
  }

  renderUiShell() {
    const info = (this.viewer && this.viewer.currentFileInfo) || { name: 'index.html', ext: 'html' };
    const fileSizeStr = `${this.allLines.length} lines (${Math.max(1, Math.round(this.rawHtml.length / 1024))} KB)`;

    // Build mode buttons based on allowed modes
    let switcherHtml = '';
    if (this.showSwitcher) {
      const buttons = [];
      if (this.allowedModes.includes('preview')) {
        buttons.push(`
          <button class="dva-html-mode-btn ${this.viewMode === 'preview' ? 'active' : ''}" id="dva-btn-mode-preview" title="Live Auto-Responsive Browser Preview">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
              <circle cx="12" cy="12" r="3"></circle>
            </svg>
            <span>Preview</span>
          </button>
        `);
      }
      if (this.allowedModes.includes('code')) {
        buttons.push(`
          <button class="dva-html-mode-btn ${this.viewMode === 'code' ? 'active' : ''}" id="dva-btn-mode-code" title="View & Search HTML Source Code">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="16 18 22 12 16 6"></polyline>
              <polyline points="8 6 2 12 8 18"></polyline>
            </svg>
            <span>Code</span>
          </button>
        `);
      }
      if (this.allowedModes.includes('both')) {
        buttons.push(`
          <button class="dva-html-mode-btn ${this.viewMode === 'both' ? 'active' : ''}" id="dva-btn-mode-both" title="Split Screen: Code on Left, Live Browser Preview on Right">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="12" y1="3" x2="12" y2="21"></line>
            </svg>
            <span>Both</span>
          </button>
        `);
      }

      switcherHtml = `
        <div class="dva-html-view-group" role="tablist">
          ${buttons.join('')}
        </div>
      `;
    }

    // Determine initial Copy Code button visibility:
    // When code is visible ('code' or 'both'), Copy Code is shown. When in pure 'preview', it is hidden.
    const isCodeVisible = this.viewMode === 'code' || this.viewMode === 'both';
    const copyBtnStyle = isCodeVisible ? 'display: inline-flex;' : 'display: none;';

    this.container.innerHTML = `
      <!-- HTML Engine Toolbar -->
      <div class="dva-html-header">
        <div class="dva-html-header-left">
          <span class="dva-html-badge">🌐 HTML</span>
          <span class="dva-html-meta-info" title="${info.name}">${fileSizeStr}</span>
          ${switcherHtml}
        </div>

        <div class="dva-html-header-right">
          <!-- Copy HTML Source Code (Shown in Code or Both view) -->
          <button class="dva-html-action-btn" id="dva-btn-html-copy" title="Copy HTML source to clipboard" style="${copyBtnStyle}">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
            <span id="dva-html-copy-label">Copy Code</span>
          </button>
        </div>
      </div>

      <!-- Main HTML Body Container -->
      <div class="dva-html-body" id="dva-html-body"></div>
    `;

    this.bindToolbarEvents();
  }

  bindToolbarEvents() {
    const btnPreview = this.container.querySelector('#dva-btn-mode-preview');
    const btnCode = this.container.querySelector('#dva-btn-mode-code');
    const btnBoth = this.container.querySelector('#dva-btn-mode-both');

    const setMode = (mode) => {
      this.viewMode = mode;
      [btnPreview, btnCode, btnBoth].forEach(b => b && b.classList.remove('active'));
      if (mode === 'preview' && btnPreview) btnPreview.classList.add('active');
      if (mode === 'code' && btnCode) btnCode.classList.add('active');
      if (mode === 'both' && btnBoth) btnBoth.classList.add('active');

      this.updateViewMode(mode);
    };

    if (btnPreview) btnPreview.onclick = () => setMode('preview');
    if (btnCode) btnCode.onclick = () => setMode('code');
    if (btnBoth) btnBoth.onclick = () => setMode('both');

    // Copy Code Button
    const btnCopy = this.container.querySelector('#dva-btn-html-copy');
    const copyLabel = this.container.querySelector('#dva-html-copy-label');
    if (btnCopy) {
      btnCopy.onclick = () => {
        const onSuccess = () => {
          btnCopy.classList.add('copied');
          if (copyLabel) copyLabel.textContent = 'Copied!';
          setTimeout(() => {
            btnCopy.classList.remove('copied');
            if (copyLabel) copyLabel.textContent = 'Copy Code';
          }, 2000);
        };

        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(this.rawHtml).then(onSuccess).catch(() => {
            this.fallbackCopy(this.rawHtml, onSuccess);
          });
        } else {
          this.fallbackCopy(this.rawHtml, onSuccess);
        }
      };
    }
  }

  fallbackCopy(text, cb) {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    if (cb) cb();
  }

  updateViewMode(mode) {
    // Normalize mode alias
    if (mode === 'split') mode = 'both';
    this.viewMode = mode;

    const body = this.container.querySelector('#dva-html-body');
    const copyBtn = this.container.querySelector('#dva-btn-html-copy');
    if (!body) return;

    // Dynamically toggle Copy Code button visibility based on whether code is visible
    if (copyBtn) {
      const isCodeVisible = mode === 'code' || mode === 'both';
      copyBtn.style.display = isCodeVisible ? 'inline-flex' : 'none';
    }

    body.innerHTML = '';

    if (mode === 'preview') {
      // 1. Pure Live Auto-Responsive Browser Preview (100% full width and height)
      const previewWrap = document.createElement('div');
      previewWrap.className = 'dva-html-preview-wrap';
      body.appendChild(previewWrap);
      this.mountIframe(previewWrap);
    } else if (mode === 'code') {
      // 2. Pure Code Editor
      const codeWrap = document.createElement('div');
      codeWrap.className = 'dva-html-code-wrap';
      body.appendChild(codeWrap);
      this.mountCodeViewer(codeWrap);
    } else if (mode === 'both') {
      // 3. Side-by-side Split View: 50% Code on Left, 50% Live Browser Preview on Right
      const splitWrap = document.createElement('div');
      splitWrap.className = 'dva-html-split-wrap';

      const leftPane = document.createElement('div');
      leftPane.className = 'dva-html-split-pane dva-html-split-left';
      splitWrap.appendChild(leftPane);
      this.mountCodeViewer(leftPane);

      const divider = document.createElement('div');
      divider.className = 'dva-html-split-divider';
      splitWrap.appendChild(divider);

      const rightPane = document.createElement('div');
      rightPane.className = 'dva-html-split-pane dva-html-split-right';
      splitWrap.appendChild(rightPane);
      this.mountIframe(rightPane);

      body.appendChild(splitWrap);
    }
  }

  mountIframe(container) {
    const iframe = document.createElement('iframe');
    iframe.className = 'dva-html-iframe';
    iframe.id = 'dva-html-preview-iframe';
    iframe.title = 'HTML Live Browser Preview';

    // Sandbox permissions: allow scripts for interactive HTML preview
    let sandboxVal = 'allow-scripts allow-forms allow-modals allow-popups allow-downloads allow-presentation';
    if (!this.allowScripts) {
      sandboxVal = 'allow-forms allow-presentation';
    }
    iframe.setAttribute('sandbox', sandboxVal);

    if ('srcdoc' in iframe) {
      iframe.srcdoc = this.rawHtml;
    } else {
      if (this.blobUrl) URL.revokeObjectURL(this.blobUrl);
      const blob = new Blob([this.rawHtml], { type: 'text/html;charset=utf-8' });
      this.blobUrl = URL.createObjectURL(blob);
      iframe.src = this.blobUrl;
    }

    container.appendChild(iframe);
    this.previewIframe = iframe;
  }

  mountCodeViewer(container) {
    container.innerHTML = `
      <div class="dva-html-code-pane-inner">
        <div class="dva-html-code-subbar">
          <div class="dva-html-code-subbar-left">
            <span class="dva-code-line-count">${this.allLines.length} lines</span>
            <span id="dva-html-matches" class="dva-code-matches-badge" style="display: none;"></span>
          </div>
          <div class="dva-html-code-subbar-right">
            <!-- Line Wrap Toggle -->
            <div class="dva-code-wrap-toggle" title="Toggle line wrap">
              <button id="dva-html-unwrap-btn" class="dva-code-toggle-opt ${!this.wrapLines ? 'active' : ''}" title="Unwrap code lines">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                  <line x1="3" y1="6" x2="21" y2="6"></line>
                  <line x1="3" y1="12" x2="16" y2="12"></line>
                  <line x1="3" y1="18" x2="21" y2="18"></line>
                </svg>
                <span>Unwrap</span>
              </button>
              <button id="dva-html-wrap-btn" class="dva-code-toggle-opt ${this.wrapLines ? 'active' : ''}" title="Wrap code lines">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                  <line x1="3" y1="6" x2="21" y2="6"></line>
                  <path d="M3 12h14a3 3 0 1 1 0 6h-4"></path>
                  <polyline points="16 15 13 18 16 21"></polyline>
                </svg>
                <span>Wrap</span>
              </button>
            </div>

            <!-- Code Search Input -->
            <div class="dva-code-search-box">
              <svg class="dva-code-search-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
              <input 
                type="text" 
                class="dva-code-search-input" 
                id="dva-html-code-search" 
                placeholder="Search HTML lines..." 
                autocomplete="off"
                spellcheck="false"
              />
              <button class="dva-code-search-clear" id="dva-html-search-clear" style="display: none;">✕</button>
            </div>
          </div>
        </div>

        <div class="dva-code-body" style="padding: 12px 14px;">
          <div class="dva-code-table-wrap">
            <table class="dva-code-table ${this.wrapLines ? 'dva-code-wrapped' : ''}" id="dva-html-code-table">
              <tbody id="dva-html-code-tbody"></tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    this.renderCodeLines(container);

    // Bind Code Controls
    const searchInput = container.querySelector('#dva-html-code-search');
    const searchClear = container.querySelector('#dva-html-search-clear');
    if (searchInput) {
      searchInput.oninput = (e) => {
        this.searchQuery = (e.target.value || '').trim().toLowerCase();
        if (searchClear) searchClear.style.display = this.searchQuery ? 'inline-flex' : 'none';
        this.renderCodeLines(container);
        if (this.searchQuery) {
          const firstMatch = container.querySelector('.dva-code-line-matched');
          if (firstMatch) firstMatch.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
      };
    }

    if (searchClear && searchInput) {
      searchClear.onclick = () => {
        searchInput.value = '';
        this.searchQuery = '';
        searchClear.style.display = 'none';
        this.renderCodeLines(container);
        searchInput.focus();
      };
    }

    const unwrapBtn = container.querySelector('#dva-html-unwrap-btn');
    const wrapBtn = container.querySelector('#dva-html-wrap-btn');
    const table = container.querySelector('#dva-html-code-table');

    if (unwrapBtn && wrapBtn && table) {
      unwrapBtn.onclick = () => {
        this.wrapLines = false;
        unwrapBtn.classList.add('active');
        wrapBtn.classList.remove('active');
        table.classList.remove('dva-code-wrapped');
      };
      wrapBtn.onclick = () => {
        this.wrapLines = true;
        wrapBtn.classList.add('active');
        unwrapBtn.classList.remove('active');
        table.classList.add('dva-code-wrapped');
      };
    }
  }

  renderCodeLines(container) {
    const tbody = container.querySelector('#dva-html-code-tbody');
    const matchesEl = container.querySelector('#dva-html-matches');
    if (!tbody) return;

    let html = '';
    const q = this.searchQuery;
    let matchCount = 0;

    this.allLines.forEach((line, idx) => {
      const lineNum = idx + 1;
      const isMatch = q && line.toLowerCase().includes(q);
      if (isMatch) matchCount++;
      const isSelected = this.activeLine === idx;

      const rowClass = [
        isMatch ? 'dva-code-line-matched' : '',
        isSelected ? 'dva-code-line-active' : ''
      ].filter(Boolean).join(' ');

      const highlighted = this.highlightHtmlLine(line);
      html += `
        <tr class="${rowClass}" data-line="${idx}">
          <td class="dva-line-num" data-line="${idx}" title="Click to highlight line ${lineNum}">${lineNum}</td>
          <td class="dva-code-content">${highlighted || '&nbsp;'}</td>
        </tr>
      `;
    });

    tbody.innerHTML = html;

    if (matchesEl) {
      if (q) {
        matchesEl.style.display = 'inline-block';
        matchesEl.textContent = `${matchCount} match${matchCount === 1 ? '' : 'es'}`;
      } else {
        matchesEl.style.display = 'none';
      }
    }

    tbody.onclick = (e) => {
      const lineCell = e.target.closest('[data-line]');
      if (!lineCell) return;
      const lineIdx = parseInt(lineCell.getAttribute('data-line'), 10);
      this.activeLine = this.activeLine === lineIdx ? -1 : lineIdx;
      this.renderCodeLines(container);
    };
  }

  escape(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  highlightHtmlLine(line) {
    if (!line) return '&nbsp;';

    const tokens = [];
    const saveToken = (html) => {
      const id = `___DVA_TOK_${tokens.length}___`;
      tokens.push(html);
      return id;
    };

    let text = line;

    // 1. HTML Comments: <!-- ... -->
    text = text.replace(/(<!--[\s\S]*?-->)/g, (m) => {
      return saveToken(`<span class="dva-tok-comment">${this.escape(m)}</span>`);
    });

    // 2. Doctype: <!DOCTYPE ...>
    text = text.replace(/(<!DOCTYPE[^>]*>)/gi, (m) => {
      return saveToken(`<span class="dva-tok-kw">${this.escape(m)}</span>`);
    });

    // 3. Quoted attribute values inside tags
    text = text.replace(/("([^"\\]|\\.)*"|'([^'\\]|\\.)*')/g, (m) => {
      return saveToken(`<span class="dva-tok-str">${this.escape(m)}</span>`);
    });

    // 4. HTML Escape remaining text before tag processing
    let escaped = this.escape(text);

    // 5. Common HTML Attributes: class=, id=, src=, etc. (must be tokenized before tag spans)
    escaped = escaped.replace(/\b([a-zA-Z0-9_\-]+)(?=\s*=)/g, (match, attr) => {
      return saveToken(`<span class="dva-tok-attr">${attr}</span>`);
    });

    // 6. HTML Tags: <tag, </tag
    escaped = escaped.replace(/(&lt;\/?)([a-zA-Z0-9_\-]+)/g, (match, prefix, tag) => {
      return `${prefix}${saveToken(`<span class="dva-tok-tag">${tag}</span>`)}`;
    });

    // 7. Operators: =, &gt;, /&gt;
    escaped = escaped.replace(/(&gt;|\/&gt;|=)/g, (match, op) => {
      return saveToken(`<span class="dva-tok-op">${op}</span>`);
    });

    // 8. Restore saved tokens
    for (let i = 0; i < tokens.length; i++) {
      escaped = escaped.replace(`___DVA_TOK_${i}___`, tokens[i]);
    }

    return escaped;
  }

  updateTransform() {
    if (!this.container) return;
    const scale = this.viewer.scale || 1.0;
    const rotation = (this.viewer.rotation || 0) % 360;

    if (this.previewIframe && this.previewIframe.contentDocument && this.previewIframe.contentDocument.body) {
      try {
        const body = this.previewIframe.contentDocument.body;
        if ('zoom' in body.style) {
          body.style.zoom = `${scale}`;
        } else {
          body.style.transformOrigin = 'top left';
          body.style.transform = `scale(${scale})`;
        }
      } catch {}
    }

    const codeTable = this.container.querySelector('#dva-html-code-table');
    if (codeTable) {
      if ('zoom' in codeTable.style) {
        codeTable.style.zoom = `${scale}`;
      } else {
        codeTable.style.transformOrigin = 'top left';
        codeTable.style.transform = `scale(${scale})`;
      }
    }
  }

  destroy() {
    if (this.blobUrl) {
      URL.revokeObjectURL(this.blobUrl);
      this.blobUrl = null;
    }
    if (this.previewIframe) {
      this.previewIframe.srcdoc = '';
      this.previewIframe = null;
    }
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    this.container = null;
    this.allLines = [];
  }
}
