/**
 * Handcrafted Zero-Dependency Code & Script Syntax Engine
 * Supports JS, TS, HTML, CSS, Python, Io (.io), Draw.io (.drawio/.io), SQL, Shell, etc.
 * Features line numbers, search filter, one-click copy, and BrickLink Studio .io ZIP detection.
 */
import { ZipReader } from '../utils/zipReader.js';

export class CodeEngine {
  constructor(viewer) {
    this.viewer = viewer;
    this.container = null;
    this.allLines = [];
    this.searchQuery = '';
    this.rawCode = '';
    this.wrapLines = false;
    this.activeLine = -1;
  }

  async render(fileInput, viewport) {
    this.container = document.createElement('div');
    this.container.className = 'dva-code-container';
    viewport.appendChild(this.container);

    // 1. Check for ZIP signature (e.g., BrickLink Studio .io model archive)
    if (fileInput instanceof Blob || fileInput instanceof File) {
      try {
        const header = await fileInput.slice(0, 4).arrayBuffer();
        const view = new DataView(header);
        if (view.byteLength >= 4 && view.getUint32(0, false) === 0x504B0304) {
          const zipHandled = await this.renderStudioIoArchive(fileInput);
          if (zipHandled) return;
        }
      } catch {
        // Fall back to text parsing
      }
    }

    // 2. Read as text
    if (typeof fileInput === 'string') {
      try {
        const res = await fetch(fileInput);
        this.rawCode = await res.text();
      } catch {
        this.rawCode = '// Unable to fetch remote source file';
      }
    } else if (fileInput instanceof Blob || fileInput instanceof File) {
      this.rawCode = await fileInput.text();
    }

    const info = this.viewer.currentFileInfo || { name: 'Source Code', ext: 'JS' };
    const ext = (info.ext || 'js').toLowerCase();

    // Determine Language Badge & Icon
    let badgeLabel = '💻 CODE';
    let badgeColor = 'rgba(59, 130, 246, 0.15)';
    let badgeTextColor = '#60a5fa';

    if (['js', 'mjs', 'cjs'].includes(ext)) {
      badgeLabel = '🟡 JAVASCRIPT (.JS)';
      badgeColor = 'rgba(234, 179, 8, 0.15)';
      badgeTextColor = '#eab308';
    } else if (['jsx'].includes(ext)) {
      badgeLabel = '⚛️ REACT JSX (.JSX)';
      badgeColor = 'rgba(6, 182, 212, 0.15)';
      badgeTextColor = '#06b6d4';
    } else if (['ts'].includes(ext)) {
      badgeLabel = '🔷 TYPESCRIPT (.TS)';
      badgeColor = 'rgba(59, 130, 246, 0.15)';
      badgeTextColor = '#3b82f6';
    } else if (['tsx'].includes(ext)) {
      badgeLabel = '⚛️ REACT TSX (.TSX)';
      badgeColor = 'rgba(99, 102, 241, 0.15)';
      badgeTextColor = '#818cf8';
    } else if (['py'].includes(ext)) {
      badgeLabel = '🐍 PYTHON (.PY)';
      badgeColor = 'rgba(16, 185, 129, 0.15)';
      badgeTextColor = '#10b981';
    } else if (['html', 'htm'].includes(ext)) {
      badgeLabel = '🌐 HTML';
      badgeColor = 'rgba(249, 115, 22, 0.15)';
      badgeTextColor = '#f97316';
    } else if (['css', 'scss'].includes(ext)) {
      badgeLabel = '🎨 CSS STYLESHEET';
      badgeColor = 'rgba(236, 72, 153, 0.15)';
      badgeTextColor = '#ec4899';
    } else if (['sql'].includes(ext)) {
      badgeLabel = '🗄️ SQL';
      badgeColor = 'rgba(139, 92, 246, 0.15)';
      badgeTextColor = '#8b5cf6';
    } else if (['sh', 'bash'].includes(ext)) {
      badgeLabel = '🐚 SHELL';
      badgeColor = 'rgba(100, 116, 139, 0.15)';
      badgeTextColor = '#94a3b8';
    } else if (['json'].includes(ext)) {
      badgeLabel = '📦 JSON';
      badgeColor = 'rgba(245, 158, 11, 0.15)';
      badgeTextColor = '#f59e0b';
    } else if (this.rawCode.includes('<mxfile') || this.rawCode.includes('<mxGraphModel')) {
      badgeLabel = '📐 DRAW.IO';
      badgeColor = 'rgba(249, 115, 22, 0.15)';
      badgeTextColor = '#f97316';
    }

    this.allLines = this.rawCode.split(/\r\n|\n/);

    this.container.innerHTML = `
      <div class="dva-code-header">
        <div class="dva-code-header-left">
          <span class="dva-code-badge" style="background: ${badgeColor}; color: ${badgeTextColor}; border-color: ${badgeColor};">${badgeLabel}</span>
          <span class="dva-code-line-count">${this.allLines.length} lines</span>
          <span id="dva-code-matches" class="dva-code-matches-badge" style="display: none;"></span>
        </div>
        <div class="dva-code-header-right">
          <div class="dva-code-wrap-toggle" title="Toggle line wrap">
            <button id="dva-code-btn-unwrap" class="dva-code-toggle-opt ${!this.wrapLines ? 'active' : ''}" title="Unwrap code lines (Horizontal scrolling)">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="3" y1="6" x2="21" y2="6"></line>
                <line x1="3" y1="12" x2="16" y2="12"></line>
                <line x1="3" y1="18" x2="21" y2="18"></line>
                <polyline points="18 9 21 12 18 15"></polyline>
              </svg>
              <span>Unwrap</span>
            </button>
            <button id="dva-code-btn-wrap" class="dva-code-toggle-opt ${this.wrapLines ? 'active' : ''}" title="Wrap code lines onto new lines">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="3" y1="6" x2="21" y2="6"></line>
                <path d="M3 12h14a3 3 0 1 1 0 6h-4"></path>
                <polyline points="16 15 13 18 16 21"></polyline>
                <line x1="3" y1="18" x2="8" y2="18"></line>
              </svg>
              <span>Wrap</span>
            </button>
          </div>

          <div class="dva-code-search-box">
            <svg class="dva-code-search-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input 
              type="text" 
              class="dva-code-search-input" 
              id="dva-code-search" 
              placeholder="Search code lines..." 
              autocomplete="off"
              spellcheck="false"
            />
            <button class="dva-code-search-clear" id="dva-code-search-clear" title="Clear search" style="display: none;">✕</button>
          </div>

          <button class="dva-code-copy-btn" id="dva-code-btn-copy" title="Copy code to clipboard">
            <svg class="dva-copy-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
            <span class="dva-copy-label">Copy Code</span>
          </button>
        </div>
      </div>
      <div class="dva-code-body" id="dva-code-body">
        <div class="dva-code-table-wrap">
          <table class="dva-code-table ${this.wrapLines ? 'dva-code-wrapped' : ''}" id="dva-code-table">
            <tbody id="dva-code-tbody"></tbody>
          </table>
        </div>
      </div>
    `;

    this.renderLines();

    // Bind Controls
    const searchInput = this.container.querySelector('#dva-code-search');
    const searchClear = this.container.querySelector('#dva-code-search-clear');
    if (searchInput) {
      searchInput.oninput = (e) => {
        this.searchQuery = (e.target.value || '').trim().toLowerCase();
        if (searchClear) searchClear.style.display = this.searchQuery ? 'inline-flex' : 'none';
        this.renderLines();
        if (this.searchQuery) {
          const firstMatch = this.container.querySelector('.dva-code-line-matched');
          if (firstMatch) firstMatch.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
      };
    }

    if (searchClear && searchInput) {
      searchClear.onclick = () => {
        searchInput.value = '';
        this.searchQuery = '';
        searchClear.style.display = 'none';
        this.renderLines();
        searchInput.focus();
      };
    }

    const unwrapBtn = this.container.querySelector('#dva-code-btn-unwrap');
    const wrapBtn = this.container.querySelector('#dva-code-btn-wrap');
    const table = this.container.querySelector('#dva-code-table');

    if (unwrapBtn) {
      unwrapBtn.onclick = () => {
        if (this.wrapLines) {
          this.wrapLines = false;
          unwrapBtn.classList.add('active');
          if (wrapBtn) wrapBtn.classList.remove('active');
          if (table) table.classList.remove('dva-code-wrapped');
        }
      };
    }

    if (wrapBtn) {
      wrapBtn.onclick = () => {
        if (!this.wrapLines) {
          this.wrapLines = true;
          wrapBtn.classList.add('active');
          if (unwrapBtn) unwrapBtn.classList.remove('active');
          if (table) table.classList.add('dva-code-wrapped');
        }
      };
    }

    const copyBtn = this.container.querySelector('#dva-code-btn-copy');
    if (copyBtn) {
      copyBtn.onclick = () => {
        const copySuccess = () => {
          copyBtn.classList.add('copied');
          copyBtn.innerHTML = `
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            <span class="dva-copy-label">Copied!</span>
          `;
          setTimeout(() => {
            copyBtn.classList.remove('copied');
            copyBtn.innerHTML = `
              <svg class="dva-copy-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
              <span class="dva-copy-label">Copy Code</span>
            `;
          }, 2000);
        };

        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(this.rawCode).then(copySuccess).catch(() => {
            const ta = document.createElement('textarea');
            ta.value = this.rawCode;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            copySuccess();
          });
        } else {
          const ta = document.createElement('textarea');
          ta.value = this.rawCode;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          document.body.removeChild(ta);
          copySuccess();
        }
      };
    }
  }

  async renderStudioIoArchive(fileInput) {
    try {
      const buffer = await fileInput.arrayBuffer();
      const zip = new ZipReader(buffer);
      await zip.readEntries();

      // Look for thumbnail.png or thumbnail.jpg
      const thumbEntry = zip.getEntry('thumbnail.png') || 
                         zip.getEntry('thumbnail.jpg') || 
                         zip.getEntry('preview.png') ||
                         zip.entries.find(e => e.name.toLowerCase().endsWith('.png'));

      const modelLdr = zip.getEntry('model.ldr') || 
                       zip.entries.find(e => e.name.toLowerCase().endsWith('.ldr'));

      if (thumbEntry || modelLdr) {
        let thumbUrl = '';
        if (thumbEntry) {
          const decompressed = await zip.decompress(thumbEntry);
          const blob = new Blob([decompressed], { type: 'image/png' });
          thumbUrl = URL.createObjectURL(blob);
        }

        let ldrCode = '';
        if (modelLdr) {
          const decomp = await zip.decompress(modelLdr);
          ldrCode = new TextDecoder().decode(decomp);
        }

        this.container.innerHTML = `
          <div class="dva-studio-io-card">
            <div class="dva-code-header" style="width: 100%;">
              <div class="dva-code-header-left">
                <span class="dva-code-badge" style="background: rgba(245, 158, 11, 0.15); color: #f59e0b; border-color: rgba(245, 158, 11, 0.3);">🧱 BRICKLINK STUDIO 3D MODEL (.IO)</span>
                <span class="dva-code-line-count">${zip.entries.length} archive files</span>
              </div>
            </div>
            ${thumbUrl ? `
            <div style="display: flex; flex-direction: column; align-items: center; padding: 24px; gap: 12px;">
              <img src="${thumbUrl}" alt="3D Model Preview" style="max-width: 480px; max-height: 360px; object-fit: contain; border-radius: 12px; box-shadow: 0 12px 32px rgba(0,0,0,0.6);" />
              <span style="font-size: 13px; color: var(--dva-text-muted);">Rendered 3D Model Preview</span>
            </div>
            ` : ''}
            ${ldrCode ? `
            <div style="width: 100%; border-top: 1px solid var(--dva-border); padding: 16px 20px;">
              <div style="font-size: 13px; font-weight: 700; color: var(--dva-text); margin-bottom: 8px;">Model Assembly Instructions (model.ldr):</div>
              <pre class="dva-manifest-code" style="max-height: 240px; overflow: auto;">${this.highlightLine(ldrCode.substring(0, 5000))}${ldrCode.length > 5000 ? '\n... [truncated]' : ''}</pre>
            </div>
            ` : ''}
          </div>
        `;
        return true;
      }
    } catch {
      // not a studio zip, continue
    }
    return false;
  }

  renderLines() {
    const tbody = this.container.querySelector('#dva-code-tbody');
    const matchesEl = this.container.querySelector('#dva-code-matches');
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

      const highlighted = this.highlightLine(line);
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
      this.renderLines();
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

  highlightLine(line) {
    if (!line) return '&nbsp;';

    const tokens = [];
    const saveToken = (html) => {
      const id = `__DVA_TOK_${tokens.length}__`;
      tokens.push(html);
      return id;
    };

    let text = line;

    // 1. Comments: // or /* ... */ or # or -- (SQL)
    text = text.replace(/(\/\/[^\n]*|\/\*[\s\S]*?\*\/|#[^\n]*|--[^\n]*)/g, (m) => {
      return saveToken(`<span class="dva-tok-comment">${this.escape(m)}</span>`);
    });

    // 2. Strings: template literals `...`, double "...", single '...'
    text = text.replace(/(`(?:\\.|[^`\\])*`|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')/g, (m) => {
      return saveToken(`<span class="dva-tok-str">${this.escape(m)}</span>`);
    });

    // 3. Regular Expression literals: e.g. /(?:...)/g (when preceded by =, (, ,, return, etc.)
    text = text.replace(/(^|[(,=:?&|!+*%-]\s*)(\/(?:\\.|[^\/\\\n])+\/[gimsuy]*)/g, (match, prefix, regex) => {
      return prefix + saveToken(`<span class="dva-tok-str">${this.escape(regex)}</span>`);
    });

    // 4. HTML Escape remaining text before tokenizing symbols
    let escaped = this.escape(text);

    // 5. JavaScript / TypeScript / SQL / Common Keywords
    const keywords = /\b(const|let|var|function|return|if|else|for|while|do|switch|case|break|continue|default|import|from|export|class|extends|new|async|await|try|catch|finally|throw|typeof|instanceof|void|delete|yield|super|this|interface|type|public|private|protected|readonly|abstract|implements|enum|static|as|def|lambda|pass|raise|with|SELECT|FROM|WHERE|INSERT|INTO|VALUES|UPDATE|SET|DELETE|CREATE|TABLE|DATABASE|SCHEMA|VIEW|INDEX|DROP|ALTER|ADD|COLUMN|PRIMARY|KEY|FOREIGN|REFERENCES|DEFAULT|UNIQUE|CHECK|JOIN|INNER|LEFT|RIGHT|FULL|OUTER|CROSS|ON|GROUP|BY|HAVING|ORDER|ASC|DESC|LIMIT|OFFSET|UNION|ALL|EXISTS|IN|BETWEEN|LIKE|ILIKE|IS|AND|OR|NOT|CASE|WHEN|THEN|ELSE|END|CAST|TRIGGER|PROCEDURE|GRANT|REVOKE|COMMIT|ROLLBACK|select|from|where|insert|into|values|update|set|delete|create|table|database|schema|view|index|drop|alter|add|column|primary|key|foreign|references|default|unique|check|join|inner|left|right|full|outer|cross|on|group|by|having|order|asc|desc|limit|offset|union|all|exists|in|between|like|ilike|is|and|or|not|case|when|then|else|end|cast|trigger|procedure|grant|revoke|commit|rollback)\b/g;
    escaped = escaped.replace(keywords, '<span class="dva-tok-kw">$1</span>');

    // 6. Built-ins, SQL Types & Standard Library Identifiers
    const builtins = /\b(console|window|document|Math|JSON|Promise|Array|Object|String|Number|Boolean|RegExp|Map|Set|Date|Error|Symbol|Proxy|Reflect|setTimeout|clearTimeout|setInterval|clearInterval|fetch|require|module|process|global|globalThis|UUID|VARCHAR|CHAR|TEXT|INT|INTEGER|BIGINT|SMALLINT|TINYINT|SERIAL|BIGSERIAL|DECIMAL|NUMERIC|FLOAT|REAL|DOUBLE|BOOLEAN|BOOL|TIMESTAMP|TIMESTAMPTZ|INTERVAL|BYTEA|BLOB|JSONB|uuid|varchar|char|text|int|integer|bigint|smallint|tinyint|serial|bigserial|decimal|numeric|float|real|double|boolean|bool|timestamp|timestamptz|interval|bytea|blob|jsonb)\b/g;
    escaped = escaped.replace(builtins, '<span class="dva-tok-builtin">$1</span>');

    // 7. Booleans, Null, Undefined
    const booleans = /\b(true|false|null|undefined|NaN|Infinity|None|True|False|TRUE|FALSE|NULL)\b/g;
    escaped = escaped.replace(booleans, '<span class="dva-tok-bool">$1</span>');

    // 8. Numbers (integers, floats, hex)
    escaped = escaped.replace(/\b(0x[0-9a-fA-F]+|\d+(?:\.\d+)?(?:e[+-]?\d+)?)\b/g, '<span class="dva-tok-num">$1</span>');

    // 9. Function / Method Calls: foo(...)
    escaped = escaped.replace(/\b([a-zA-Z_$][a-zA-Z0-9_$]*)(?=\s*\()/g, '<span class="dva-tok-fn">$1</span>');

    // 10. Arrow & Comparison Operators: =>, ===, !==, ==, !=, <=, >=, &&, ||, ??, ?.
    escaped = escaped.replace(/(=&gt;|===|!==|==|!=|&lt;=|&gt;=|&amp;&amp;|\|\||\?\?|\?\.)/g, '<span class="dva-tok-op">$1</span>');

    // 11. Restore tokens from array
    for (let i = 0; i < tokens.length; i++) {
      escaped = escaped.replace(`__DVA_TOK_${i}__`, tokens[i]);
    }

    return escaped;
  }

  destroy() {
    this.container = null;
    this.allLines = [];
    this.rawCode = '';
  }
}
