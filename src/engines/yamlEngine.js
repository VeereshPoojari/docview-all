/**
 * Executive-Grade Universal YAML Engine (YAML / YML)
 * Supports all YAML 1.2 documents, Spring Boot configs, Kubernetes manifests, Docker Compose, etc.
 * Features:
 * - 🌳 Interactive Tree View: Pixel-perfect aligned keys, chevrons, type badges, inline multi-line wrapping, quick copy
 * - 📝 Formatted Code View: High-fidelity line-numbered code table with comprehensive syntax coloring
 * - 📋 Raw View: Full-spec clean preformatted text view with line numbers and 1-click copy
 * - Search Filter: Real-time keyword filtering with match count across tree and code
 * - Zero artificial root wrappers: Document keys start cleanly at level 0
 * - Dual Engine: Industry-standard js-yaml parser with high-resilience built-in fallback
 */

let jsYamlPromise = null;
function loadJsYaml() {
  if (typeof window !== 'undefined' && window.jsyaml && typeof window.jsyaml.load === 'function') {
    return Promise.resolve(window.jsyaml);
  }
  if (!jsYamlPromise) {
    jsYamlPromise = (async () => {
      if (typeof document === 'undefined') throw new Error('Document is undefined');
      await new Promise((resolve) => {
        const s = document.createElement('script');
        s.src = 'https://cdnjs.cloudflare.com/ajax/libs/js-yaml/4.1.0/js-yaml.min.js';
        s.async = true;
        s.onload = () => resolve(window.jsyaml);
        s.onerror = () => {
          const fb = document.createElement('script');
          fb.src = 'https://cdn.jsdelivr.net/npm/js-yaml@4.1.0/dist/js-yaml.min.js';
          fb.async = true;
          fb.onload = () => resolve(window.jsyaml);
          fb.onerror = () => resolve(null); // gracefully fallback to internal parser
          document.head.appendChild(fb);
        };
        document.head.appendChild(s);
      });
      return window.jsyaml || null;
    })();
  }
  return jsYamlPromise;
}

export class YamlEngine {
  constructor(viewer) {
    this.viewer = viewer;
    this.container = null;
    this.rawText = '';
    this.parsedData = null;
    this.allLines = [];
    this.viewMode = 'tree'; // 'tree' | 'source' | 'raw'
    this.searchQuery = '';
    this.zoomLevel = 1.0;
  }

  async render(fileInput, viewport) {
    this.container = document.createElement('div');
    this.container.className = 'dva-yaml-container';
    viewport.appendChild(this.container);

    if (this.viewer && typeof this.viewer.updateProgress === 'function') {
      this.viewer.updateProgress(20, 'Reading YAML file stream...');
    }

    // 1. Read file contents
    if (typeof fileInput === 'string') {
      try {
        const res = await fetch(fileInput);
        this.rawText = await res.text();
      } catch (e) {
        this.rawText = `# Unable to fetch remote YAML: ${e.message}\nerror: true`;
      }
    } else if (fileInput instanceof Blob || fileInput instanceof File) {
      this.rawText = await fileInput.text();
    } else if (typeof fileInput === 'object') {
      try {
        this.parsedData = fileInput;
        this.rawText = JSON.stringify(fileInput, null, 2);
      } catch {
        this.rawText = '';
      }
    }

    this.allLines = this.rawText.split(/\r\n|\n/);

    if (this.viewer && typeof this.viewer.updateProgress === 'function') {
      this.viewer.updateProgress(50, 'Parsing YAML document structure...');
    }

    // 2. Parse data (prioritize js-yaml, fallback to robust internal parser)
    await this.parseYamlData();

    if (this.viewer && typeof this.viewer.updateProgress === 'function') {
      this.viewer.updateProgress(90, 'Preparing high-fidelity YAML view...');
    }

    this.renderLayout();
  }

  async parseYamlData() {
    let parsed = null;
    try {
      const yamlLib = await loadJsYaml();
      if (yamlLib && typeof yamlLib.load === 'function') {
        parsed = yamlLib.load(this.rawText);
      }
    } catch (e) {
      console.warn('[YamlEngine] js-yaml CDN parser error, using built-in parser:', e);
    }

    if (!parsed || (typeof parsed === 'object' && Object.keys(parsed).length === 0 && this.rawText.trim().length > 0)) {
      try {
        parsed = this.simpleYamlParse(this.rawText);
      } catch (err) {
        console.warn('[YamlEngine] internal parser error:', err);
      }
    }

    this.parsedData = parsed || {};
  }

  simpleYamlParse(text) {
    if (!text || !text.trim()) return {};
    const lines = text.split(/\r\n|\n/);
    const root = {};
    const stack = [{ indent: -1, obj: root }];

    for (let i = 0; i < lines.length; i++) {
      let rawLine = lines[i];
      // Strip comments that are not inside quotes
      const commentIdx = rawLine.search(/(?<!['"])\s*#(?![^'"]*['"])/);
      let line = commentIdx !== -1 ? rawLine.substring(0, commentIdx) : rawLine;
      if (!line.trim()) continue;

      const indent = line.search(/\S/);
      const trimmed = line.trim();

      while (stack.length > 1 && indent <= stack[stack.length - 1].indent) {
        stack.pop();
      }
      const parent = stack[stack.length - 1].obj;

      if (trimmed.startsWith('- ')) {
        const itemVal = trimmed.substring(2).trim();
        let targetArr;
        if (Array.isArray(parent)) {
          targetArr = parent;
        } else {
          const keys = Object.keys(parent);
          const lastKey = keys[keys.length - 1];
          if (lastKey && Array.isArray(parent[lastKey])) {
            targetArr = parent[lastKey];
          } else {
            targetArr = [];
            if (lastKey) parent[lastKey] = targetArr;
          }
        }

        if (itemVal.includes(': ')) {
          const colon = itemVal.indexOf(': ');
          const k = itemVal.substring(0, colon).trim().replace(/^['"]|['"]$/g, '');
          const v = this.parseScalar(itemVal.substring(colon + 2).trim());
          const obj = { [k]: v };
          if (targetArr) targetArr.push(obj);
          stack.push({ indent, obj });
        } else if (itemVal) {
          if (targetArr) targetArr.push(this.parseScalar(itemVal));
        } else {
          const newObj = {};
          if (targetArr) targetArr.push(newObj);
          stack.push({ indent, obj: newObj });
        }
        continue;
      }

      // Key: value
      const colonIdx = trimmed.indexOf(':');
      if (colonIdx !== -1) {
        const key = trimmed.substring(0, colonIdx).trim().replace(/^['"]|['"]$/g, '');
        const valStr = trimmed.substring(colonIdx + 1).trim();

        if (!valStr) {
          // Check if next non-empty line starts with '- ' (array)
          let nextIsArray = false;
          for (let j = i + 1; j < lines.length; j++) {
            const nextTrim = lines[j].trim();
            if (nextTrim && !nextTrim.startsWith('#')) {
              nextIsArray = nextTrim.startsWith('- ');
              break;
            }
          }
          const newContainer = nextIsArray ? [] : {};
          if (Array.isArray(parent)) {
            parent.push({ [key]: newContainer });
          } else {
            parent[key] = newContainer;
          }
          stack.push({ indent, obj: newContainer });
        } else {
          const val = this.parseScalar(valStr);
          if (Array.isArray(parent)) {
            parent.push({ [key]: val });
          } else {
            parent[key] = val;
          }
        }
      }
    }

    return root;
  }

  parseScalar(str) {
    if (!str) return '';
    // Strip trailing comment
    const commentIdx = str.search(/(?<!['"])\s*#(?![^'"]*['"])/);
    if (commentIdx !== -1) str = str.substring(0, commentIdx).trim();

    // Quoted string
    if ((str.startsWith('"') && str.endsWith('"')) || (str.startsWith("'") && str.endsWith("'"))) {
      return str.slice(1, -1);
    }
    if (str === 'true' || str === 'yes' || str === 'on') return true;
    if (str === 'false' || str === 'no' || str === 'off') return false;
    if (str === 'null' || str === '~') return null;
    if (!isNaN(Number(str)) && str.trim() !== '') return Number(str);
    return str;
  }

  renderLayout() {
    const fileName = (this.viewer.currentFileInfo && this.viewer.currentFileInfo.name) || 'config.yaml';
    const fileSize = this.rawText.length > 1024 
      ? `${(this.rawText.length / 1024).toFixed(1)} KB` 
      : `${this.rawText.length} B`;

    this.container.innerHTML = `
      <div class="dva-yaml-header">
        <div class="dva-yaml-header-left">
          <span class="dva-yaml-badge">⚙️ YAML</span>
          <span class="dva-yaml-title" title="${fileName}">${fileName}</span>
          <span class="dva-yaml-stats">${this.allLines.length} lines &bull; ${fileSize}</span>
        </div>
        <div class="dva-yaml-header-right">
          <!-- Search Input -->
          <div class="dva-yaml-search-box">
            <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
            <input type="text" id="dva-yaml-search" placeholder="Search keys, values, lines..." />
            <span class="dva-yaml-match-count" id="dva-yaml-matches" style="display: none;"></span>
          </div>

          <!-- Mode Switcher -->
          <div class="dva-yaml-mode-toggle">
            <button class="dva-yaml-toggle-btn active" data-mode="tree" title="Interactive Tree View">🌳 Tree</button>
            <button class="dva-yaml-toggle-btn" data-mode="source" title="Formatted Code View">📝 Formatted</button>
            <button class="dva-yaml-toggle-btn" data-mode="raw" title="Raw Plain Text">📋 Raw</button>
          </div>

          <!-- Tree Actions -->
          <button class="dva-yaml-action-btn" id="dva-yaml-btn-expand" title="Expand All Nodes">▾ Expand</button>
          <button class="dva-yaml-action-btn" id="dva-yaml-btn-collapse" title="Collapse All Nodes">▸ Collapse</button>
          <button class="dva-yaml-action-btn primary" id="dva-yaml-btn-copy" title="Copy YAML to Clipboard">📋 Copy</button>
        </div>
      </div>

      <!-- Main Body Container -->
      <div class="dva-yaml-body" id="dva-yaml-body">
        <!-- Tree View Container -->
        <div class="dva-yaml-tree-view" id="dva-yaml-tree-view"></div>

        <!-- Formatted Syntax Table -->
        <div class="dva-yaml-source-view" id="dva-yaml-source-view" style="display: none;">
          <table class="dva-yaml-table" id="dva-yaml-table">
            <tbody id="dva-yaml-tbody"></tbody>
          </table>
        </div>

        <!-- Raw Text View -->
        <div class="dva-yaml-raw-view" id="dva-yaml-raw-view" style="display: none;">
          <div class="dva-yaml-raw-card">
            <div class="dva-yaml-raw-header">
              <span>Raw Document Stream</span>
              <button class="dva-yaml-mini-btn" id="dva-yaml-copy-raw-btn">📋 Copy Raw Text</button>
            </div>
            <pre class="dva-yaml-raw-pre" id="dva-yaml-raw-pre"></pre>
          </div>
        </div>
      </div>
    `;

    this.bindEvents();
    this.renderActiveView();
  }

  bindEvents() {
    const searchInput = this.container.querySelector('#dva-yaml-search');
    const modeBtns = this.container.querySelectorAll('.dva-yaml-toggle-btn');
    const expandBtn = this.container.querySelector('#dva-yaml-btn-expand');
    const collapseBtn = this.container.querySelector('#dva-yaml-btn-collapse');
    const copyBtn = this.container.querySelector('#dva-yaml-btn-copy');
    const copyRawBtn = this.container.querySelector('#dva-yaml-copy-raw-btn');

    if (searchInput) {
      searchInput.oninput = (e) => {
        this.searchQuery = e.target.value.toLowerCase().trim();
        this.renderActiveView();
      };
    }

    modeBtns.forEach(btn => {
      btn.onclick = () => {
        modeBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.viewMode = btn.getAttribute('data-mode');

        if (expandBtn) expandBtn.style.display = this.viewMode === 'tree' ? 'inline-flex' : 'none';
        if (collapseBtn) collapseBtn.style.display = this.viewMode === 'tree' ? 'inline-flex' : 'none';

        this.renderActiveView();
      };
    });

    if (expandBtn) {
      expandBtn.onclick = () => this.toggleAllNodes(true);
    }

    if (collapseBtn) {
      collapseBtn.onclick = () => this.toggleAllNodes(false);
    }

    const copyHandler = () => {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(this.rawText).then(() => {
          if (this.viewer && typeof this.viewer.notify === 'function') {
            this.viewer.notify('✓ YAML copied to clipboard!', 'success');
          }
        });
      } else {
        const ta = document.createElement('textarea');
        ta.value = this.rawText;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
        if (this.viewer && typeof this.viewer.notify === 'function') {
          this.viewer.notify('✓ YAML copied to clipboard!', 'success');
        }
      }
    };

    if (copyBtn) copyBtn.onclick = copyHandler;
    if (copyRawBtn) copyRawBtn.onclick = copyHandler;
  }

  renderActiveView() {
    const treeView = this.container.querySelector('#dva-yaml-tree-view');
    const sourceView = this.container.querySelector('#dva-yaml-source-view');
    const rawView = this.container.querySelector('#dva-yaml-raw-view');
    const rawPre = this.container.querySelector('#dva-yaml-raw-pre');
    const matchesEl = this.container.querySelector('#dva-yaml-matches');

    if (!treeView || !sourceView || !rawView) return;

    treeView.style.display = this.viewMode === 'tree' ? 'flex' : 'none';
    sourceView.style.display = this.viewMode === 'source' ? 'flex' : 'none';
    rawView.style.display = this.viewMode === 'raw' ? 'flex' : 'none';

    // 1. Tree View
    if (this.viewMode === 'tree') {
      treeView.innerHTML = '';
      const card = document.createElement('div');
      card.className = 'dva-yaml-card';

      if (!this.parsedData || (typeof this.parsedData === 'object' && Object.keys(this.parsedData).length === 0)) {
        card.innerHTML = `<div class="dva-yaml-empty">Empty or blank YAML document.</div>`;
      } else {
        const treeRoot = document.createElement('div');
        treeRoot.className = 'dva-yaml-tree-root';

        let matchCount = 0;
        if (Array.isArray(this.parsedData)) {
          this.parsedData.forEach((item, idx) => {
            const childNode = this.buildTreeNode(item, `[${idx}]`, 0);
            if (childNode) {
              treeRoot.appendChild(childNode);
              matchCount++;
            }
          });
        } else {
          Object.keys(this.parsedData).forEach(key => {
            const childNode = this.buildTreeNode(this.parsedData[key], key, 0);
            if (childNode) {
              treeRoot.appendChild(childNode);
              matchCount++;
            }
          });
        }
        card.appendChild(treeRoot);

        if (this.searchQuery && matchesEl) {
          matchesEl.style.display = 'inline-block';
          matchesEl.textContent = `${matchCount} results`;
        } else if (matchesEl) {
          matchesEl.style.display = 'none';
        }
      }
      treeView.appendChild(card);
    } 
    // 2. Formatted View (Syntax Highlighted)
    else if (this.viewMode === 'source') {
      const tbody = this.container.querySelector('#dva-yaml-tbody');
      if (tbody) {
        tbody.innerHTML = '';
        let matchCount = 0;
        this.allLines.forEach((line, idx) => {
          const isMatch = this.searchQuery && line.toLowerCase().includes(this.searchQuery);
          if (this.searchQuery && !isMatch) return;
          if (isMatch) matchCount++;

          const tr = document.createElement('tr');
          if (isMatch) tr.className = 'dva-yaml-highlight-row';
          const lineNum = idx + 1;
          const highlighted = this.highlightYamlLine(line);

          tr.innerHTML = `
            <td class="dva-line-num">${lineNum}</td>
            <td class="dva-code-content">${highlighted}</td>
          `;
          tbody.appendChild(tr);
        });

        if (this.searchQuery && matchesEl) {
          matchesEl.style.display = 'inline-block';
          matchesEl.textContent = `${matchCount} lines`;
        } else if (matchesEl) {
          matchesEl.style.display = 'none';
        }
      }
    } 
    // 3. Raw View
    else if (this.viewMode === 'raw') {
      if (rawPre) {
        rawPre.textContent = this.rawText;
      }
      if (matchesEl) matchesEl.style.display = 'none';
    }
  }

  buildTreeNode(data, key, depth = 0) {
    const isObject = data !== null && typeof data === 'object';
    const isArray = Array.isArray(data);
    const nodeEl = document.createElement('div');
    nodeEl.className = 'dva-yaml-node';

    // Search filter check
    if (this.searchQuery) {
      const keyMatches = String(key).toLowerCase().includes(this.searchQuery);
      let valueMatches = false;
      if (!isObject) {
        valueMatches = String(data).toLowerCase().includes(this.searchQuery);
      }
      if (!keyMatches && !valueMatches && !this.hasChildMatch(data)) {
        return null;
      }
    }

    if (isObject) {
      const keys = Object.keys(data);
      const countLabel = isArray ? `[${keys.length} items]` : `{${keys.length} keys}`;

      const header = document.createElement('div');
      header.className = 'dva-yaml-line dva-yaml-parent-line';

      header.innerHTML = `
        <button class="dva-yaml-toggle-caret" title="Toggle section">▾</button>
        <span class="dva-yaml-key">${this.escape(key)}:</span>
        <span class="dva-yaml-badge">${countLabel}</span>
      `;

      const childrenContainer = document.createElement('div');
      childrenContainer.className = 'dva-yaml-children';

      let renderedChildren = 0;
      keys.forEach(k => {
        const child = this.buildTreeNode(data[k], k, depth + 1);
        if (child) {
          childrenContainer.appendChild(child);
          renderedChildren++;
        }
      });

      let isCollapsed = false;
      const toggle = (collapseState) => {
        isCollapsed = typeof collapseState === 'boolean' ? collapseState : !isCollapsed;
        childrenContainer.style.display = isCollapsed ? 'none' : 'block';
        const caret = header.querySelector('.dva-yaml-toggle-caret');
        if (caret) caret.textContent = isCollapsed ? '▸' : '▾';
      };

      header.onclick = (e) => {
        e.stopPropagation();
        toggle();
      };

      nodeEl.appendChild(header);
      nodeEl.appendChild(childrenContainer);
    } else {
      // Primitive Leaf Node
      const leaf = document.createElement('div');
      leaf.className = 'dva-yaml-line dva-yaml-leaf-line';

      let valClass = 'dva-yaml-val-str';
      let valHtml = '';
      if (typeof data === 'string') {
        valClass = 'dva-yaml-val-str';
        valHtml = `"${this.escape(data)}"`;
      } else if (typeof data === 'number') {
        valClass = 'dva-yaml-val-num';
        valHtml = `${data}`;
      } else if (typeof data === 'boolean') {
        valClass = 'dva-yaml-val-bool';
        valHtml = `${data}`;
      } else if (data === null || data === undefined) {
        valClass = 'dva-yaml-val-null';
        valHtml = `null`;
      } else {
        valHtml = this.escape(String(data));
      }

      leaf.innerHTML = `
        <span class="dva-yaml-bullet">•</span>
        <span class="dva-yaml-key">${this.escape(key)}:</span>
        <span class="dva-yaml-val ${valClass}">${valHtml}</span>
        <button class="dva-yaml-quick-copy" title="Copy value to clipboard">📋</button>
      `;

      const copyBtn = leaf.querySelector('.dva-yaml-quick-copy');
      if (copyBtn) {
        copyBtn.onclick = (e) => {
          e.stopPropagation();
          const textToCopy = typeof data === 'string' ? data : String(data);
          navigator.clipboard?.writeText(textToCopy);
          if (this.viewer && typeof this.viewer.notify === 'function') {
            this.viewer.notify(`Copied "${key}" value!`, 'success', 2000);
          }
        };
      }

      nodeEl.appendChild(leaf);
    }

    return nodeEl;
  }

  hasChildMatch(data) {
    if (!data || typeof data !== 'object') return false;
    const q = this.searchQuery;
    for (const k of Object.keys(data)) {
      if (String(k).toLowerCase().includes(q)) return true;
      const v = data[k];
      if (v !== null && typeof v === 'object') {
        if (this.hasChildMatch(v)) return true;
      } else if (String(v).toLowerCase().includes(q)) {
        return true;
      }
    }
    return false;
  }

  toggleAllNodes(expand) {
    if (!this.container) return;
    const children = this.container.querySelectorAll('.dva-yaml-children');
    const carets = this.container.querySelectorAll('.dva-yaml-toggle-caret');

    children.forEach(el => {
      el.style.display = expand ? 'block' : 'none';
    });
    carets.forEach(c => {
      c.textContent = expand ? '▾' : '▸';
    });
  }

  highlightYamlLine(line) {
    if (!line) return '&nbsp;';

    // 1. Comment-only line
    const trimmed = line.trim();
    if (trimmed.startsWith('#')) {
      return `<span class="dva-tok-comment">${this.escape(line)}</span>`;
    }

    // 2. Document boundary (--- or ...)
    if (trimmed === '---' || trimmed === '...') {
      return `<span class="dva-tok-keyword" style="font-weight: 800;">${this.escape(line)}</span>`;
    }

    // 3. Separate indentation, content, and inline comment
    const indentMatch = line.match(/^(\s*)/);
    const indent = indentMatch ? indentMatch[1] : '';
    let content = line.substring(indent.length);

    let comment = '';
    // Look for unquoted comment
    let inSingle = false;
    let inDouble = false;
    let commentStart = -1;
    for (let i = 0; i < content.length; i++) {
      const ch = content[i];
      if (ch === "'" && !inDouble) inSingle = !inSingle;
      else if (ch === '"' && !inSingle) inDouble = !inDouble;
      else if (ch === '#' && !inSingle && !inDouble && (i === 0 || /\s/.test(content[i - 1]))) {
        commentStart = i;
        break;
      }
    }
    if (commentStart !== -1) {
      comment = content.substring(commentStart);
      content = content.substring(0, commentStart);
    }

    // 4. Tokenize content safely
    let htmlContent = '';

    // Check for list dash (- )
    if (content.startsWith('- ')) {
      htmlContent += '<span class="dva-tok-dash">- </span>';
      content = content.substring(2);
    }

    // Check for key: value
    const colonIdx = content.indexOf(':');
    if (colonIdx !== -1) {
      const keyPart = content.substring(0, colonIdx);
      const afterColon = content.substring(colonIdx + 1);

      htmlContent += `<span class="dva-tok-key">${this.escape(keyPart)}</span>:`;

      if (afterColon.length > 0) {
        const spaceMatch = afterColon.match(/^(\s*)/);
        const valSpace = spaceMatch ? spaceMatch[1] : '';
        const val = afterColon.substring(valSpace.length);

        htmlContent += valSpace;
        if (val) {
          htmlContent += this.formatYamlValueToken(val);
        }
      }
    } else {
      // Just a scalar value (e.g. in a list item: - foo)
      htmlContent += this.formatYamlValueToken(content);
    }

    if (comment) {
      htmlContent += `<span class="dva-tok-comment">${this.escape(comment)}</span>`;
    }

    return indent + htmlContent;
  }

  formatYamlValueToken(val) {
    const trimmed = val.trim();
    if (!trimmed) return this.escape(val);

    // Booleans
    if (/^(true|false|yes|no|on|off)$/i.test(trimmed)) {
      return `<span class="dva-tok-bool">${this.escape(val)}</span>`;
    }
    // Null
    if (/^(null|~)$/i.test(trimmed)) {
      return `<span class="dva-tok-null">${this.escape(val)}</span>`;
    }
    // Numbers
    if (/^-?(0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?$/.test(trimmed)) {
      return `<span class="dva-tok-number">${this.escape(val)}</span>`;
    }
    // Quoted strings
    if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
      return `<span class="dva-tok-string">${this.escape(val)}</span>`;
    }
    // Unquoted string or reference
    return `<span class="dva-tok-string">${this.escape(val)}</span>`;
  }

  escape(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  zoom(delta) {
    this.zoomLevel = Math.max(0.6, Math.min(2.0, this.zoomLevel + delta));
    const target = this.container.querySelector('.dva-yaml-card') || this.container.querySelector('.dva-yaml-table') || this.container.querySelector('.dva-yaml-raw-card');
    if (target) {
      target.style.transform = `scale(${this.zoomLevel})`;
      target.style.transformOrigin = 'top center';
    }
  }

  resetZoom() {
    this.zoomLevel = 1.0;
    const target = this.container.querySelector('.dva-yaml-card') || this.container.querySelector('.dva-yaml-table') || this.container.querySelector('.dva-yaml-raw-card');
    if (target) {
      target.style.transform = 'scale(1)';
    }
  }

  destroy() {
    this.container = null;
    this.parsedData = null;
    this.allLines = [];
  }
}
