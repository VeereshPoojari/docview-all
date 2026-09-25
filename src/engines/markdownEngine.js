/**
 * Handcrafted Zero-Dependency GitHub Flavored Markdown (GFM) Engine
 * Features:
 * - Dual Mode: [ 📖 Rendered Document ] & [ 📝 Source Code ]
 * - Full GFM Table rendering with column alignments
 * - Embedded Images, Figures, and clickable Badges
 * - Fenced code blocks with language header and 1-click Copy
 * - GitHub Callout Alerts (> [!NOTE], [!TIP], [!IMPORTANT], [!WARNING], [!CAUTION])
 * - Headings (H1–H6), Task list checkboxes (- [x], - [ ]), Blockquotes, HR
 * - Nested Ordered & Unordered lists
 * - Fast text statistics (word count, line count)
 */

function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export class MarkdownEngine {
  constructor(viewer) {
    this.viewer = viewer;
    this.container = null;
    this.rawText = '';
    this.currentView = 'rendered'; // 'rendered' | 'source'
  }

  async render(fileInput, viewport) {
    this.container = document.createElement('div');
    this.container.className = 'dva-markdown-container';
    viewport.appendChild(this.container);

    let mdText = '';
    if (typeof fileInput === 'string') {
      if (fileInput.startsWith('data:')) {
        const commaIdx = fileInput.indexOf(',');
        const b64 = fileInput.slice(commaIdx + 1);
        mdText = decodeURIComponent(escape(atob(b64)));
      } else {
        const res = await fetch(fileInput);
        mdText = await res.text();
      }
    } else if (fileInput instanceof Blob || fileInput instanceof File) {
      mdText = await fileInput.text();
    }

    this.rawText = mdText;

    const lines = mdText.split('\n');
    const words = mdText.trim().length > 0 ? mdText.trim().split(/\s+/).length : 0;
    const lineCount = lines.length;

    // Render outer shell with top control sub-bar
    this.container.innerHTML = `
      <div class="dva-diagram-header dva-md-header">
        <div class="dva-diagram-header-left">
          <span class="dva-diagram-badge">📖 MARKDOWN</span>
          <span class="dva-manifest-chip">📑 ${words.toLocaleString()} words</span>
          <span class="dva-manifest-chip">📄 ${lineCount.toLocaleString()} lines</span>
        </div>
        <div class="dva-diagram-header-right">
          <div class="dva-stream-nav">
            <button class="dva-stream-btn active" id="dva-btn-md-rendered">📖 Rendered Document</button>
            <button class="dva-stream-btn" id="dva-btn-md-source">📝 Source Code</button>
          </div>
          <button class="dva-stream-btn" id="dva-btn-md-copy-all" title="Copy raw Markdown">📋 Copy All</button>
        </div>
      </div>
      <div class="dva-md-rendered-view" id="dva-md-rendered-view">
        ${this.parseMarkdown(mdText)}
      </div>
      <div class="dva-md-source-view" id="dva-md-source-view" style="display: none;">
        <pre class="dva-manifest-code" id="dva-md-source-pre">${escapeHtml(mdText)}</pre>
      </div>
    `;

    this.bindEvents();
  }

  bindEvents() {
    if (!this.container) return;

    const renderedView = this.container.querySelector('#dva-md-rendered-view');
    const sourceView = this.container.querySelector('#dva-md-source-view');
    const btnRendered = this.container.querySelector('#dva-btn-md-rendered');
    const btnSource = this.container.querySelector('#dva-btn-md-source');
    const btnCopyAll = this.container.querySelector('#dva-btn-md-copy-all');

    if (btnRendered && btnSource) {
      btnRendered.onclick = () => {
        this.currentView = 'rendered';
        btnRendered.classList.add('active');
        btnSource.classList.remove('active');
        if (renderedView) renderedView.style.display = 'block';
        if (sourceView) sourceView.style.display = 'none';
      };

      btnSource.onclick = () => {
        this.currentView = 'source';
        btnSource.classList.add('active');
        btnRendered.classList.remove('active');
        if (renderedView) renderedView.style.display = 'none';
        if (sourceView) sourceView.style.display = 'block';
      };
    }

    if (btnCopyAll) {
      btnCopyAll.onclick = () => {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(this.rawText).then(() => {
            const original = btnCopyAll.textContent;
            btnCopyAll.textContent = '✓ Copied!';
            setTimeout(() => { btnCopyAll.textContent = original; }, 2000);
          });
        }
      };
    }

    // Code block copy buttons
    const copyBtns = this.container.querySelectorAll('.dva-md-copy-btn');
    copyBtns.forEach(btn => {
      btn.onclick = () => {
        const codeText = decodeURIComponent(btn.getAttribute('data-code') || '');
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(codeText).then(() => {
            const original = btn.textContent;
            btn.textContent = '✓ Copied!';
            btn.classList.add('copied');
            setTimeout(() => {
              btn.textContent = original;
              btn.classList.remove('copied');
            }, 2000);
          });
        }
      };
    });
  }

  parseMarkdown(md) {
    if (!md) return '';

    // Normalize line breaks
    let src = md.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    // 1. Stash fenced code blocks so their contents aren't modified
    const codeBlocks = [];
    src = src.replace(/```([a-zA-Z0-9_\-\+]*)[^\n]*\n([\s\S]*?)```/g, (match, lang, code) => {
      const idx = codeBlocks.length;
      codeBlocks.push({ lang: (lang || 'code').trim().toLowerCase(), code });
      return `\n\n@@@DVACODEBLOCK${idx}@@@\n\n`;
    });

    // 2. Stash inline code
    const inlineCodes = [];
    src = src.replace(/`([^`\n]+)`/g, (match, code) => {
      const idx = inlineCodes.length;
      inlineCodes.push(code);
      return `@@@DVAINLINECODE${idx}@@@`;
    });

    // 3. Linked badges/images: [![alt](imgSrc)](linkUrl)
    src = src.replace(/\[!\[([^\]]*)\]\(([^)]+)\)\]\(([^)]+)\)/g, (match, alt, imgSrc, linkUrl) => {
      return `<a href="${linkUrl.trim()}" target="_blank" rel="noopener" class="dva-md-badge-link"><img src="${imgSrc.trim()}" alt="${escapeHtml(alt)}" class="dva-md-badge" loading="lazy" /></a>`;
    });

    // 4. Standalone images: ![alt](src "optional title")
    src = src.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g, (match, alt, srcUrl, title) => {
      const titleAttr = title ? ` title="${escapeHtml(title)}"` : '';
      const altText = escapeHtml(alt);
      return `<div class="dva-md-img-wrap"><img src="${srcUrl.trim()}" alt="${altText}"${titleAttr} class="dva-md-img" loading="lazy" onerror="this.onerror=null;this.classList.add('dva-md-img-failed');" />${alt ? `<span class="dva-md-img-caption">${altText}</span>` : ''}</div>`;
    });

    // 5. GitHub Callout Alerts: > [!NOTE], > [!TIP], > [!IMPORTANT], > [!WARNING], > [!CAUTION]
    src = src.replace(/^>\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*\n([\s\S]*?)(?=\n\n|$)/gim, (match, type, content) => {
      const alertType = type.toLowerCase();
      const cleanContent = content.replace(/^>\s?/gm, '').trim();
      const icons = {
        note: 'ℹ️',
        tip: '💡',
        important: '❗',
        warning: '⚠️',
        caution: '🛑'
      };
      return `<div class="dva-md-alert dva-md-alert-${alertType}"><div class="dva-md-alert-header"><span class="dva-md-alert-icon">${icons[alertType] || 'ℹ️'}</span><span class="dva-md-alert-title">${type.toUpperCase()}</span></div><div class="dva-md-alert-body">${cleanContent}</div></div>\n\n`;
    });

    // 6. Blockquotes: lines starting with >
    src = src.replace(/^>\s?(.*)$/gm, '<blockquote class="dva-md-blockquote">$1</blockquote>');
    src = src.replace(/<\/blockquote>\n<blockquote class="dva-md-blockquote">/g, '<br/>');

    // 7. Parse GFM Tables
    src = this.parseTables(src);

    // 8. Horizontal Rules: ---, ***, ___ on own line
    src = src.replace(/^(?:---|\*\*\*|___)\s*$/gm, '<hr class="dva-md-hr" />');

    // 9. Headings: H1 to H6
    src = src.replace(/^######\s+(.*)$/gm, '<h6 class="dva-md-h6">$1</h6>');
    src = src.replace(/^#####\s+(.*)$/gm, '<h5 class="dva-md-h5">$1</h5>');
    src = src.replace(/^####\s+(.*)$/gm, '<h4 class="dva-md-h4">$1</h4>');
    src = src.replace(/^###\s+(.*)$/gm, '<h3 class="dva-md-h3">$1</h3>');
    src = src.replace(/^##\s+(.*)$/gm, '<h2 class="dva-md-h2">$1</h2>');
    src = src.replace(/^#\s+(.*)$/gm, '<h1 class="dva-md-h1">$1</h1>');

    // 10. Task Lists & Checkboxes
    src = src.replace(/^[\*\-\+]\s+\[x\]\s+(.*)$/gim, '<li class="dva-md-task-item"><input type="checkbox" checked disabled class="dva-md-checkbox"/> <span>$1</span></li>');
    src = src.replace(/^[\*\-\+]\s+\[ \]\s+(.*)$/gim, '<li class="dva-md-task-item"><input type="checkbox" disabled class="dva-md-checkbox"/> <span>$1</span></li>');

    // 11. Unordered lists: lines starting with -, *, or +
    src = src.replace(/^[\*\-\+]\s+(.*)$/gm, '<li class="dva-md-li">$1</li>');

    // 12. Ordered lists: lines starting with 1., 2., etc.
    src = src.replace(/^\d+\.\s+(.*)$/gm, '<li class="dva-md-oli">$1</li>');

    // Group <li> tags into <ul> and <ol>
    src = src.replace(/(<li class="dva-md-(?:li|task-item)">[\s\S]*?<\/li>\n?)+/g, (match) => {
      return `<ul class="dva-md-ul">${match}</ul>`;
    });
    src = src.replace(/(<li class="dva-md-oli">[\s\S]*?<\/li>\n?)+/g, (match) => {
      return `<ol class="dva-md-ol">${match}</ol>`;
    });

    // 13. Inline links: [text](url)
    src = src.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener" class="dva-md-link">$1</a>');

    // 14. Typography (Bold, Italic, Strikethrough)
    src = src.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    src = src.replace(/__([^_]+)__/g, '<strong>$1</strong>');
    src = src.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    src = src.replace(/_([^_]+)_/g, '<em>$1</em>');
    src = src.replace(/~~([^~]+)~~/g, '<del>$1</del>');

    // 15. Paragraph wrapping for loose lines
    const blocks = src.split(/\n{2,}/);
    const parsedBlocks = blocks.map(block => {
      const trimmed = block.trim();
      if (!trimmed) return '';
      if (/^<(h[1-6]|div|table|ul|ol|blockquote|hr|pre|figure)/i.test(trimmed)) {
        return trimmed;
      }
      if (/^@@@DVACODEBLOCK\d+@@@$/.test(trimmed)) {
        return trimmed;
      }
      return `<p class="dva-md-p">${trimmed.replace(/\n/g, '<br/>')}</p>`;
    });
    src = parsedBlocks.filter(Boolean).join('\n\n');

    // 16. Restore Inline Code
    src = src.replace(/@@@DVAINLINECODE(\d+)@@@/g, (match, idx) => {
      const code = inlineCodes[parseInt(idx, 10)] || '';
      return `<code class="dva-md-inline-code">${escapeHtml(code)}</code>`;
    });

    // 17. Restore Code Blocks with Language Header & 1-click Copy
    src = src.replace(/@@@DVACODEBLOCK(\d+)@@@/g, (match, idx) => {
      const block = codeBlocks[parseInt(idx, 10)];
      if (!block) return '';
      const encoded = encodeURIComponent(block.code);
      const escapedCode = escapeHtml(block.code);
      return `
        <div class="dva-md-code-card">
          <div class="dva-md-code-header">
            <span class="dva-md-code-lang">${block.lang || 'code'}</span>
            <button class="dva-md-copy-btn" data-code="${encoded}">Copy</button>
          </div>
          <pre class="dva-md-pre"><code class="language-${block.lang}">${escapedCode}</code></pre>
        </div>
      `;
    });

    return `<div class="dva-md-article">${src}</div>`;
  }

  parseTables(text) {
    const lines = text.split('\n');
    const output = [];
    let inTable = false;
    let tableRows = [];

    const isTableRow = (line) => {
      const trimmed = line.trim();
      return trimmed.startsWith('|') && trimmed.endsWith('|') && trimmed.length >= 3;
    };

    const isSeparatorRow = (line) => {
      const trimmed = line.trim();
      if (!trimmed.startsWith('|') || !trimmed.endsWith('|')) return false;
      const inner = trimmed.slice(1, -1).split('|');
      return inner.length > 0 && inner.every(c => /^:?-+:?$/.test(c.trim()));
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (isTableRow(line)) {
        if (!inTable) {
          if (i + 1 < lines.length && isSeparatorRow(lines[i + 1])) {
            inTable = true;
            tableRows.push(line);
          } else {
            output.push(line);
          }
        } else {
          tableRows.push(line);
        }
      } else {
        if (inTable) {
          output.push(this.renderTableHtml(tableRows));
          inTable = false;
          tableRows = [];
        }
        output.push(line);
      }
    }

    if (inTable && tableRows.length > 0) {
      output.push(this.renderTableHtml(tableRows));
    }

    return output.join('\n');
  }

  renderTableHtml(rows) {
    if (rows.length < 2) return rows.join('\n');

    const splitCells = (rowStr) => {
      let s = rowStr.trim();
      if (s.startsWith('|')) s = s.slice(1);
      if (s.endsWith('|')) s = s.slice(0, -1);
      return s.split('|').map(c => c.trim());
    };

    const headerCells = splitCells(rows[0]);
    const separatorCells = splitCells(rows[1]);

    const alignments = separatorCells.map(c => {
      const trimmed = c.trim();
      if (trimmed.startsWith(':') && trimmed.endsWith(':')) return 'center';
      if (trimmed.endsWith(':')) return 'right';
      return 'left';
    });

    let html = '<div class="dva-md-table-wrap"><table class="dva-md-table"><thead><tr>';
    headerCells.forEach((header, idx) => {
      const align = alignments[idx] || 'left';
      html += `<th style="text-align: ${align};">${header}</th>`;
    });
    html += '</tr></thead><tbody>';

    for (let r = 2; r < rows.length; r++) {
      const cells = splitCells(rows[r]);
      html += '<tr>';
      for (let c = 0; c < headerCells.length; c++) {
        const cellData = cells[c] !== undefined ? cells[c] : '';
        const align = alignments[c] || 'left';
        html += `<td style="text-align: ${align};">${cellData}</td>`;
      }
      html += '</tr>';
    }

    html += '</tbody></table></div>';
    return html;
  }

  destroy() {
    this.container = null;
  }
}
