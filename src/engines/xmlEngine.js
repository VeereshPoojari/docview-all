/**
 * Handcrafted Universal XML Engine for DocView-All (Zero external dependencies)
 * Supports 3 Viewing Modes:
 *   1. 🌳 Interactive XML DOM Tree (Collapsible elements, attributes, CDATA, comments)
 *   2. 📝 Formatted Code View (Line numbers, fixed table layout, XML syntax coloring)
 *   3. 📋 Raw XML Stream (Clean preformatted text with stats and one-click copy)
 */

export class XmlEngine {
  constructor(viewer) {
    this.viewer = viewer;
    this.container = null;
    this.rawText = '';
    this.allLines = [];
    this.xmlDoc = null;
    this.parseError = null;
    this.viewMode = 'tree'; // 'tree' | 'source' | 'raw'
    this.searchQuery = '';
    this.collapsedNodes = new Set();
  }

  async render(fileInput, viewport) {
    this.container = document.createElement('div');
    this.container.className = 'dva-xml-container';
    viewport.appendChild(this.container);

    if (this.viewer && typeof this.viewer.updateProgress === 'function') {
      this.viewer.updateProgress(20, 'Reading XML file stream...');
    }

    // 1. Read file contents
    if (typeof fileInput === 'string') {
      if (fileInput.trim().startsWith('<')) {
        this.rawText = fileInput;
      } else {
        try {
          const res = await fetch(fileInput);
          this.rawText = await res.text();
        } catch (e) {
          this.rawText = `<!-- Unable to fetch remote XML: ${e.message} -->\n<error>true</error>`;
        }
      }
    } else if (fileInput instanceof Blob || fileInput instanceof File) {
      this.rawText = await fileInput.text();
    } else if (typeof fileInput === 'object') {
      try {
        this.rawText = new XMLSerializer().serializeToString(fileInput);
      } catch {
        this.rawText = '';
      }
    }

    this.allLines = this.rawText.split(/\r\n|\n/);

    if (this.viewer && typeof this.viewer.updateProgress === 'function') {
      this.viewer.updateProgress(50, 'Parsing XML DOM structure...');
    }

    // 2. Parse XML DOM
    this.parseXmlData();

    if (this.viewer && typeof this.viewer.updateProgress === 'function') {
      this.viewer.updateProgress(90, 'Preparing high-fidelity XML view...');
    }

    this.renderLayout();
  }

  parseXmlData() {
    this.parseError = null;
    if (typeof DOMParser !== 'undefined') {
      try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(this.rawText, 'text/xml');
        const errNode = doc.querySelector('parsererror');
        if (errNode) {
          this.parseError = errNode.textContent || 'XML parsing error';
        } else {
          this.xmlDoc = doc;
        }
      } catch (e) {
        this.parseError = e.message;
      }
    } else {
      // Node.js environment fallback simulation
      this.xmlDoc = this.simpleXmlParse(this.rawText);
    }
  }

  simpleXmlParse(text) {
    // Lightweight node representation for non-browser/test environments
    const rootMatch = text.match(/<([a-zA-Z0-9_\-:]+)([^>]*)>/);
    if (!rootMatch) return { rootElement: null };

    const tagName = rootMatch[1];
    const attrsStr = rootMatch[2] || '';
    const attributes = [];
    const attrRegex = /([a-zA-Z0-9_\-:]+)=(?:"([^"]*)"|'([^']*)')/g;
    let m;
    while ((m = attrRegex.exec(attrsStr)) !== null) {
      attributes.push({ name: m[1], value: m[2] !== undefined ? m[2] : m[3] });
    }

    return {
      documentElement: {
        nodeType: 1,
        nodeName: tagName,
        attributes,
        childNodes: [],
        textContent: ''
      }
    };
  }

  renderLayout() {
    const fileName = (this.viewer && this.viewer.currentFileInfo && this.viewer.currentFileInfo.name) || 'document.xml';
    const fileSize = this.rawText.length > 1024 
      ? `${(this.rawText.length / 1024).toFixed(1)} KB` 
      : `${this.rawText.length} B`;

    this.container.innerHTML = `
      <div class="dva-xml-header">
        <div class="dva-xml-header-left">
          <span class="dva-xml-badge">🏷️ XML</span>
          <span class="dva-xml-title" title="${this.escape(fileName)}">${this.escape(fileName)}</span>
          <span class="dva-xml-stats">${this.allLines.length} lines &bull; ${fileSize}</span>
        </div>
        <div class="dva-xml-header-right">
          <!-- Search Input -->
          <div class="dva-xml-search-box">
            <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
            <input type="text" id="dva-xml-search" placeholder="Search tags, attributes, text..." />
            <span class="dva-xml-match-count" id="dva-xml-matches" style="display: none;"></span>
          </div>

          <!-- Mode Switcher -->
          <div class="dva-xml-mode-toggle">
            <button class="dva-xml-toggle-btn active" data-mode="tree" title="Interactive Tree View">🌳 Tree</button>
            <button class="dva-xml-toggle-btn" data-mode="source" title="Formatted Code View">📝 Formatted</button>
            <button class="dva-xml-toggle-btn" data-mode="raw" title="Raw XML Text">📋 Raw</button>
          </div>

          <!-- Tree Actions -->
          <button class="dva-xml-action-btn" id="dva-xml-btn-expand" title="Expand All Nodes">▾ Expand</button>
          <button class="dva-xml-action-btn" id="dva-xml-btn-collapse" title="Collapse All Nodes">▸ Collapse</button>
          <button class="dva-xml-action-btn primary" id="dva-xml-btn-copy" title="Copy XML to Clipboard">📋 Copy</button>
        </div>
      </div>

      <!-- Main Body Container -->
      <div class="dva-xml-body" id="dva-xml-body">
        <!-- Tree View Container -->
        <div class="dva-xml-tree-view" id="dva-xml-tree-view"></div>

        <!-- Formatted Syntax Table -->
        <div class="dva-xml-source-view" id="dva-xml-source-view" style="display: none;">
          <table class="dva-xml-table" id="dva-xml-table">
            <tbody id="dva-xml-tbody"></tbody>
          </table>
        </div>

        <!-- Raw Text View -->
        <div class="dva-xml-raw-view" id="dva-xml-raw-view" style="display: none;">
          <div class="dva-xml-raw-card">
            <div class="dva-xml-raw-header">
              <span>Raw Document Stream</span>
              <button class="dva-xml-mini-btn" id="dva-xml-copy-raw-btn">📋 Copy Raw Text</button>
            </div>
            <pre class="dva-xml-raw-pre" id="dva-xml-raw-pre"></pre>
          </div>
        </div>
      </div>
    `;

    this.bindEvents();
    this.renderActiveView();
  }

  bindEvents() {
    const searchInput = this.container.querySelector('#dva-xml-search');
    const modeBtns = this.container.querySelectorAll('.dva-xml-toggle-btn');
    const expandBtn = this.container.querySelector('#dva-xml-btn-expand');
    const collapseBtn = this.container.querySelector('#dva-xml-btn-collapse');
    const copyBtn = this.container.querySelector('#dva-xml-btn-copy');
    const copyRawBtn = this.container.querySelector('#dva-xml-copy-raw-btn');

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
            this.viewer.notify('✓ XML copied to clipboard!', 'success');
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
          this.viewer.notify('✓ XML copied to clipboard!', 'success');
        }
      }
    };

    if (copyBtn) copyBtn.onclick = copyHandler;
    if (copyRawBtn) copyRawBtn.onclick = copyHandler;
  }

  renderActiveView() {
    const treeView = this.container.querySelector('#dva-xml-tree-view');
    const sourceView = this.container.querySelector('#dva-xml-source-view');
    const rawView = this.container.querySelector('#dva-xml-raw-view');
    const rawPre = this.container.querySelector('#dva-xml-raw-pre');
    const matchesEl = this.container.querySelector('#dva-xml-matches');

    if (treeView) treeView.style.display = this.viewMode === 'tree' ? 'block' : 'none';
    if (sourceView) sourceView.style.display = this.viewMode === 'source' ? 'flex' : 'none';
    if (rawView) rawView.style.display = this.viewMode === 'raw' ? 'flex' : 'none';

    if (this.viewMode === 'tree') {
      this.renderTreeView(treeView, matchesEl);
    } else if (this.viewMode === 'source') {
      this.renderSourceView(matchesEl);
    } else if (this.viewMode === 'raw') {
      if (rawPre) rawPre.textContent = this.rawText;
      if (matchesEl) matchesEl.style.display = 'none';
    }
  }

  renderTreeView(container, matchesEl) {
    if (!container) return;
    container.innerHTML = '';

    if (this.parseError) {
      container.innerHTML = `
        <div class="dva-xml-error-card">
          <div class="dva-xml-error-title">⚠️ XML Parsing Error</div>
          <div class="dva-xml-error-msg">${this.escape(this.parseError)}</div>
          <button class="dva-xml-mini-btn" id="dva-xml-view-raw-fallback" style="margin-top: 12px;">View Raw XML Stream</button>
        </div>
      `;
      const fallbackBtn = container.querySelector('#dva-xml-view-raw-fallback');
      if (fallbackBtn) {
        fallbackBtn.onclick = () => {
          const rawBtn = this.container.querySelector('.dva-xml-toggle-btn[data-mode="raw"]');
          if (rawBtn) rawBtn.click();
        };
      }
      return;
    }

    if (!this.xmlDoc || !this.xmlDoc.documentElement) {
      container.innerHTML = `<div class="dva-xml-empty">No XML elements found in document.</div>`;
      return;
    }

    let matchCount = 0;
    const countMatches = (node) => {
      if (node.nodeType === 1) { // ELEMENT_NODE
        const tag = node.nodeName.toLowerCase();
        if (this.searchQuery && tag.includes(this.searchQuery)) matchCount++;
        if (node.attributes) {
          for (let i = 0; i < node.attributes.length; i++) {
            const attr = node.attributes[i];
            if (this.searchQuery && (attr.name.toLowerCase().includes(this.searchQuery) || attr.value.toLowerCase().includes(this.searchQuery))) {
              matchCount++;
            }
          }
        }
      } else if (node.nodeType === 3) { // TEXT_NODE
        const txt = (node.textContent || '').trim().toLowerCase();
        if (this.searchQuery && txt.includes(this.searchQuery)) matchCount++;
      }
      if (node.childNodes) {
        node.childNodes.forEach(child => countMatches(child));
      }
    };

    if (this.searchQuery) {
      countMatches(this.xmlDoc.documentElement);
      if (matchesEl) {
        matchesEl.style.display = 'inline-block';
        matchesEl.textContent = `${matchCount} match${matchCount === 1 ? '' : 'es'}`;
      }
    } else {
      if (matchesEl) matchesEl.style.display = 'none';
    }

    const card = document.createElement('div');
    card.className = 'dva-xml-tree-card';
    card.appendChild(this.buildElementTreeNode(this.xmlDoc.documentElement, 0, 'root'));
    container.appendChild(card);
  }

  buildElementTreeNode(node, depth, pathKey) {
    const isElement = node.nodeType === 1;
    if (!isElement) return document.createDocumentFragment();

    const nodeWrapper = document.createElement('div');
    nodeWrapper.className = 'dva-xml-node-group';
    nodeWrapper.setAttribute('data-path', pathKey);

    // Filter child nodes (elements, significant text, CDATA)
    const childElements = [];
    const textNodes = [];
    let cdataText = '';

    if (node.childNodes) {
      for (let i = 0; i < node.childNodes.length; i++) {
        const child = node.childNodes[i];
        if (child.nodeType === 1) {
          childElements.push(child);
        } else if (child.nodeType === 3) {
          const txt = child.textContent.trim();
          if (txt) textNodes.push(txt);
        } else if (child.nodeType === 4) { // CDATA_SECTION_NODE
          cdataText += child.textContent;
        }
      }
    }

    const hasChildren = childElements.length > 0;
    const hasInlineContent = textNodes.length > 0 || cdataText.length > 0;
    const isCollapsed = this.collapsedNodes.has(pathKey);

    // Format attributes HTML
    let attrsHtml = '';
    if (node.attributes && node.attributes.length > 0) {
      for (let i = 0; i < node.attributes.length; i++) {
        const attr = node.attributes[i];
        attrsHtml += ` <span class="dva-tok-attr">${this.escape(attr.name)}</span>=<span class="dva-tok-string">"${this.escape(attr.value)}"</span>`;
      }
    }

    // Row Header
    const row = document.createElement('div');
    row.className = 'dva-xml-row' + (this.searchQuery && this.matchesSearch(node) ? ' dva-xml-highlight-row' : '');
    row.style.paddingLeft = `${depth * 20 + 16}px`;

    const caretHtml = hasChildren
      ? `<span class="dva-xml-toggle-caret">${isCollapsed ? '▸' : '▾'}</span>`
      : `<span class="dva-xml-bullet">•</span>`;

    const badgeHtml = hasChildren
      ? `<span class="dva-xml-count-badge">${childElements.length} ${childElements.length === 1 ? 'element' : 'elements'}</span>`
      : '';

    let contentPreview = '';
    if (!hasChildren && textNodes.length > 0) {
      contentPreview = `<span class="dva-xml-text-val">${this.escape(textNodes.join(' '))}</span>`;
    } else if (!hasChildren && cdataText) {
      contentPreview = `<span class="dva-xml-cdata-tag">&lt;![CDATA[</span><span class="dva-xml-cdata-val">${this.escape(cdataText.trim())}</span><span class="dva-xml-cdata-tag">]]&gt;</span>`;
    }

    const closingPreview = !hasChildren && !hasInlineContent ? ' /&gt;' : '&gt;';

    row.innerHTML = `
      ${caretHtml}
      <div class="dva-xml-tag-wrap">
        <span class="dva-tok-tag">&lt;${this.escape(node.nodeName)}</span>${attrsHtml}<span class="dva-tok-tag">${closingPreview}</span>
        ${contentPreview}
        ${badgeHtml}
        ${!hasChildren && hasInlineContent ? `<span class="dva-tok-tag">&lt;/${this.escape(node.nodeName)}&gt;</span>` : ''}
      </div>
      <button class="dva-xml-copy-val-btn" title="Copy XML element">📋</button>
    `;

    const copyBtn = row.querySelector('.dva-xml-copy-val-btn');
    if (copyBtn) {
      copyBtn.onclick = (e) => {
        e.stopPropagation();
        let xmlStr = '';
        try {
          xmlStr = new XMLSerializer().serializeToString(node);
        } catch {
          xmlStr = node.outerHTML || node.textContent;
        }
        navigator.clipboard.writeText(xmlStr);
        if (this.viewer && typeof this.viewer.notify === 'function') {
          this.viewer.notify(`✓ Copied <${node.nodeName}> to clipboard!`, 'info');
        }
      };
    }

    if (hasChildren) {
      row.onclick = () => {
        if (this.collapsedNodes.has(pathKey)) {
          this.collapsedNodes.delete(pathKey);
        } else {
          this.collapsedNodes.add(pathKey);
        }
        this.renderTreeView(this.container.querySelector('#dva-xml-tree-view'), this.container.querySelector('#dva-xml-matches'));
      };
    }

    nodeWrapper.appendChild(row);

    // Children Container
    if (hasChildren) {
      const childrenWrapper = document.createElement('div');
      childrenWrapper.className = 'dva-xml-children-wrap';
      childrenWrapper.style.display = isCollapsed ? 'none' : 'block';

      // If element has mixed inline text before children
      if (textNodes.length > 0) {
        const textRow = document.createElement('div');
        textRow.className = 'dva-xml-row text-node';
        textRow.style.paddingLeft = `${(depth + 1) * 20 + 16}px`;
        textRow.innerHTML = `
          <span class="dva-xml-bullet">•</span>
          <span class="dva-xml-text-val">${this.escape(textNodes.join(' '))}</span>
        `;
        childrenWrapper.appendChild(textRow);
      }

      childElements.forEach((childEl, idx) => {
        const childPath = `${pathKey}.${idx}_${childEl.nodeName}`;
        childrenWrapper.appendChild(this.buildElementTreeNode(childEl, depth + 1, childPath));
      });

      // Closing Tag Row
      const closeRow = document.createElement('div');
      closeRow.className = 'dva-xml-row closing-tag';
      closeRow.style.paddingLeft = `${depth * 20 + 16}px`;
      closeRow.innerHTML = `
        <span class="dva-xml-bullet" style="opacity: 0;">•</span>
        <span class="dva-tok-tag">&lt;/${this.escape(node.nodeName)}&gt;</span>
      `;
      childrenWrapper.appendChild(closeRow);

      nodeWrapper.appendChild(childrenWrapper);
    }

    return nodeWrapper;
  }

  matchesSearch(node) {
    if (!this.searchQuery) return false;
    const tag = node.nodeName.toLowerCase();
    if (tag.includes(this.searchQuery)) return true;
    if (node.attributes) {
      for (let i = 0; i < node.attributes.length; i++) {
        const a = node.attributes[i];
        if (a.name.toLowerCase().includes(this.searchQuery) || a.value.toLowerCase().includes(this.searchQuery)) {
          return true;
        }
      }
    }
    const txt = (node.textContent || '').toLowerCase();
    return txt.includes(this.searchQuery);
  }

  toggleAllNodes(expand) {
    if (expand) {
      this.collapsedNodes.clear();
    } else {
      const collectPaths = (node, pathKey) => {
        if (!node) return;
        this.collapsedNodes.add(pathKey);
        let idx = 0;
        if (node.childNodes) {
          node.childNodes.forEach(c => {
            if (c.nodeType === 1) {
              collectPaths(c, `${pathKey}.${idx}_${c.nodeName}`);
              idx++;
            }
          });
        }
      };
      if (this.xmlDoc && this.xmlDoc.documentElement) {
        collectPaths(this.xmlDoc.documentElement, 'root');
      }
    }
    this.renderActiveView();
  }

  renderSourceView(matchesEl) {
    const tbody = this.container.querySelector('#dva-xml-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    let matchCount = 0;
    const query = this.searchQuery;

    const rowsHtml = this.allLines.map((line, idx) => {
      const lineNum = idx + 1;
      const isMatch = query && line.toLowerCase().includes(query);
      if (isMatch) matchCount++;

      const highlighted = this.highlightXmlLine(line);
      const rowClass = isMatch ? 'dva-xml-highlight-row' : '';

      return `
        <tr class="${rowClass}">
          <td class="dva-line-num">${lineNum}</td>
          <td class="dva-code-content">${highlighted}</td>
        </tr>
      `;
    }).join('');

    tbody.innerHTML = rowsHtml;

    if (matchesEl) {
      if (query) {
        matchesEl.style.display = 'inline-block';
        matchesEl.textContent = `${matchCount} match${matchCount === 1 ? '' : 'es'}`;
      } else {
        matchesEl.style.display = 'none';
      }
    }
  }

  highlightXmlLine(line) {
    if (!line) return '&nbsp;';

    // 1. Comment check
    const trimmed = line.trim();
    if (trimmed.startsWith('<!--') && trimmed.endsWith('-->')) {
      return `<span class="dva-tok-comment">${this.escape(line)}</span>`;
    }

    // 2. Declaration check <?xml ... ?>
    if (trimmed.startsWith('<?') && trimmed.endsWith('?>')) {
      return `<span class="dva-tok-keyword" style="font-weight: 700;">${this.escape(line)}</span>`;
    }

    // 3. Single-pass structural XML tag and attribute tokenization
    let result = '';
    let i = 0;
    const len = line.length;

    while (i < len) {
      const ch = line[i];

      // Comment start inside line
      if (line.substr(i, 4) === '<!--') {
        const commentEnd = line.indexOf('-->', i + 4);
        if (commentEnd !== -1) {
          result += `<span class="dva-tok-comment">${this.escape(line.substring(i, commentEnd + 3))}</span>`;
          i = commentEnd + 3;
        } else {
          result += `<span class="dva-tok-comment">${this.escape(line.substring(i))}</span>`;
          i = len;
        }
        continue;
      }

      // CDATA start
      if (line.substr(i, 9) === '<![CDATA[') {
        const cdataEnd = line.indexOf(']]>', i + 9);
        if (cdataEnd !== -1) {
          result += `<span class="dva-tok-keyword">&lt;![CDATA[</span><span class="dva-tok-string">${this.escape(line.substring(i + 9, cdataEnd))}</span><span class="dva-tok-keyword">]]&gt;</span>`;
          i = cdataEnd + 3;
        } else {
          result += `<span class="dva-tok-keyword">${this.escape(line.substring(i))}</span>`;
          i = len;
        }
        continue;
      }

      // XML Opening or Closing Tag: <tag or </tag
      if (ch === '<') {
        const isClosing = line[i + 1] === '/';
        const tagStart = i + (isClosing ? 2 : 1);
        let tagEnd = tagStart;
        while (tagEnd < len && /[a-zA-Z0-9_\-:]/.test(line[tagEnd])) {
          tagEnd++;
        }
        const tagName = line.substring(tagStart, tagEnd);

        result += `<span class="dva-tok-tag">&lt;${isClosing ? '/' : ''}${this.escape(tagName)}</span>`;
        i = tagEnd;

        // Inside Tag: parse attributes until > or />
        while (i < len && line[i] !== '>') {
          // Check for />
          if (line.substr(i, 2) === '/>') {
            result += `<span class="dva-tok-tag">/&gt;</span>`;
            i += 2;
            break;
          }

          // Whitespace
          if (/\s/.test(line[i])) {
            result += line[i];
            i++;
            continue;
          }

          // Attribute name
          let attrEnd = i;
          while (attrEnd < len && /[a-zA-Z0-9_\-:]/.test(line[attrEnd])) {
            attrEnd++;
          }
          const attrName = line.substring(i, attrEnd);
          if (attrName) {
            result += `<span class="dva-tok-attr">${this.escape(attrName)}</span>`;
            i = attrEnd;

            // Attribute value = "..."
            if (line[i] === '=') {
              result += '=';
              i++;
              if (line[i] === '"' || line[i] === "'") {
                const quote = line[i];
                const valEnd = line.indexOf(quote, i + 1);
                if (valEnd !== -1) {
                  result += `<span class="dva-tok-string">${this.escape(line.substring(i, valEnd + 1))}</span>`;
                  i = valEnd + 1;
                } else {
                  result += `<span class="dva-tok-string">${this.escape(line.substring(i))}</span>`;
                  i = len;
                }
              }
            }
            continue;
          }

          result += this.escape(line[i]);
          i++;
        }

        if (i < len && line[i] === '>') {
          result += `<span class="dva-tok-tag">&gt;</span>`;
          i++;
        }
        continue;
      }

      result += this.escape(ch);
      i++;
    }

    return result;
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

  destroy() {
    this.rawText = '';
    this.allLines = [];
    this.xmlDoc = null;
    this.collapsedNodes.clear();
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
  }
}
