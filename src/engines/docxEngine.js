import { ZipReader } from '../utils/zipReader.js';

let docxScriptPromise = null;
function loadScript(src, fallbackSrc) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      if (fallbackSrc) {
        const fb = document.createElement('script');
        fb.src = fallbackSrc;
        fb.async = true;
        fb.onload = () => resolve();
        fb.onerror = () => reject(new Error(`Failed to load ${src} and ${fallbackSrc}`));
        document.head.appendChild(fb);
      } else {
        reject(new Error(`Failed to load ${src}`));
      }
    };
    document.head.appendChild(s);
  });
}

function loadDocxPreviewScript() {
  if (typeof window !== 'undefined' && window.docx && typeof window.docx.renderAsync === 'function') {
    return Promise.resolve(window.docx);
  }
  if (!docxScriptPromise) {
    docxScriptPromise = (async () => {
      if (typeof document === 'undefined') throw new Error('Document is undefined');

      // 1. Load JSZip first (strictly required by docx-preview)
      if (!window.JSZip) {
        await loadScript(
          'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js',
          'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js'
        );
      }

      // 3. Load docx-preview script
      if (!window.docx || typeof window.docx.renderAsync !== 'function') {
        await loadScript(
          'https://cdn.jsdelivr.net/npm/docx-preview@0.3.3/dist/docx-preview.min.js',
          'https://unpkg.com/docx-preview@0.3.3/dist/docx-preview.min.js'
        );
      }

      if (window.docx && typeof window.docx.renderAsync === 'function') {
        return window.docx;
      }
      throw new Error('docx-preview failed to initialize after script load');
    })();
  }
  return docxScriptPromise;
}

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

export class DocxEngine {
  constructor(viewer) {
    this.viewer = viewer;
    this.container = null;
    this.pagesContainer = null;
    this.pages = [];
    this.pageElements = [];
    this.currentPage = 1;
    this.totalPages = 1;
    this.pageMode = 'elements'; // 'elements' | 'virtual'
    this.pageHeight = 1056;
    this.scrollHandler = null;
  }

  async render(fileInput, viewport) {
    this.container = document.createElement('div');
    this.container.className = 'dva-docx-container';
    viewport.appendChild(this.container);

    this.pagesContainer = document.createElement('div');
    this.pagesContainer.className = 'dva-docx-pages-wrapper';
    this.container.appendChild(this.pagesContainer);

    try {
      this.pagesContainer.innerHTML = '<div style="color: var(--dva-text-secondary); text-align: center; padding: 60px;">Rendering Word document with full formatting...</div>';

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

      if (this.viewer && typeof this.viewer.updateProgress === 'function') {
        this.viewer.updateProgress(35, 'Reading Word package...');
      }

      const fileName = fileInput.name || (typeof fileInput === 'string' ? fileInput.split('/').pop().split('?')[0] : 'Document.docx');

      let highFidelitySuccess = false;

      // 1. Try High-Fidelity docx-preview (full tables, exact fonts, embedded images, headers/footers)
      try {
        if (this.viewer && typeof this.viewer.updateProgress === 'function') {
          this.viewer.updateProgress(55, 'Loading Word engine runtime...');
        }
        const docxLib = await loadDocxPreviewScript();
        this.pagesContainer.innerHTML = '';
        if (this.viewer && typeof this.viewer.updateProgress === 'function') {
          this.viewer.updateProgress(75, 'Rendering Word styles & layout...');
        }
        await docxLib.renderAsync(arrayBuffer, this.pagesContainer, null, {
          className: 'docx',
          inWrapper: false,
          ignoreWidth: false,
          ignoreHeight: false,
          experimental: true,
          renderHeaders: true,
          renderFooters: true,
          renderFootnotes: true,
          breakPages: true,
          ignoreLastRenderedPageBreak: false
        });

        // 1. Remove any stray gray wrapper backgrounds
        const wrappers = this.pagesContainer.querySelectorAll('.docx-wrapper, .dva-docx-doc-wrapper');
        wrappers.forEach(w => {
          w.style.background = 'transparent';
          w.style.padding = '0';
          w.style.width = '100%';
        });

        // 2. Ensure every page section has authentic Word page margins
        // (if omitted in document XML, apply standard 1-inch / 72pt margins)
        const sections = Array.from(this.pagesContainer.querySelectorAll('section.docx, section.dva-docx-doc'));
        sections.forEach(sec => {
          sec.style.boxSizing = 'border-box';
          sec.style.margin = '0 auto 28px auto';
          sec.style.background = '#ffffff';

          const pl = parseFloat(sec.style.paddingLeft || '0');
          const pr = parseFloat(sec.style.paddingRight || '0');
          const pt = parseFloat(sec.style.paddingTop || '0');
          const pb = parseFloat(sec.style.paddingBottom || '0');

          if (!pl || pl < 36) {
            sec.style.paddingLeft = '72pt';
            sec.style.paddingRight = '72pt';
          }
          if (!pt || pt < 36) {
            sec.style.paddingTop = '72pt';
            sec.style.paddingBottom = '72pt';
          }
        });

        highFidelitySuccess = true;
      } catch (previewErr) {
        console.warn('[DocxEngine] docx-preview unavailable, falling back to enhanced OpenXML parser:', previewErr);
      }

      // 2. Fallback to enhanced zero-dependency OpenXML engine if docx-preview failed/offline
      if (!highFidelitySuccess) {
        if (this.viewer && typeof this.viewer.updateProgress === 'function') {
          this.viewer.updateProgress(70, 'Parsing OpenXML document structures...');
        }
        const zip = new ZipReader(arrayBuffer);
        await zip.parse();
        const docXml = await zip.readEntryAsText('word/document.xml');
        if (!docXml) throw new Error('word/document.xml not found inside DOCX package');

        const mediaMap = await this.extractMediaImages(zip);
        this.parseAndPaginate(docXml, mediaMap);
      }

      if (this.viewer && typeof this.viewer.updateProgress === 'function') {
        this.viewer.updateProgress(90, 'Formatting document pages...');
      }

      this.initPagination();
      this.updateTransform();

      if (this.viewer && typeof this.viewer.notify === 'function') {
        this.viewer.notify(`Opened ${fileName}`, 'success');
      }
    } catch (err) {
      console.error('DocxEngine render error:', err);
      const fileName = fileInput.name || (typeof fileInput === 'string' ? fileInput.split('/').pop().split('?')[0] : 'Document.docx');
      this.pagesContainer.innerHTML = `
        <div style="text-align: center; padding: 60px 20px; background: var(--dva-surface); border-radius: 8px; border: 1px solid var(--dva-border); width: 100%;">
          <div style="font-size: 40px; margin-bottom: 12px;">📄</div>
          <h3 style="color: var(--dva-text); margin-bottom: 8px;">Word Document Preview</h3>
          <p style="color: var(--dva-text-secondary); font-size: 14px; margin-bottom: 20px;">${this.escape(fileName)}</p>
          <p style="color: #ef4444; font-size: 13px; margin-bottom: 20px;">${this.escape(err.message)}</p>
          <button class="dva-btn" id="docx-dl-btn" style="width: auto; height: 38px; padding: 0 20px; background: var(--dva-primary); color: #fff; font-weight: 700; border-radius: 8px; cursor: pointer;">
            Download Original DOCX
          </button>
        </div>
      `;
      const dlBtn = this.pagesContainer.querySelector('#docx-dl-btn');
      if (dlBtn) dlBtn.onclick = () => this.viewer.download();
    }
  }

  async extractMediaImages(zip) {
    const mediaMap = new Map();
    try {
      const fileList = zip.getFileList();
      for (const filename of fileList) {
        if (filename.toLowerCase().startsWith('word/media/')) {
          const buf = await zip.readEntryAsBuffer(filename);
          if (buf) {
            const ext = filename.split('.').pop().toLowerCase();
            const mime = ext === 'png' ? 'image/png' : ext === 'gif' ? 'image/gif' : 'image/jpeg';
            let binary = '';
            for (let i = 0; i < buf.length; i++) binary += String.fromCharCode(buf[i]);
            const b64 = btoa(binary);
            const dataUri = `data:${mime};base64,${b64}`;
            const baseName = filename.split('/').pop().toLowerCase();
            mediaMap.set(baseName, dataUri);
          }
        }
      }
    } catch (e) {
      console.warn('Could not extract media images:', e);
    }
    return mediaMap;
  }

  parseAndPaginate(xmlStr, mediaMap = new Map()) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlStr, 'application/xml');
    const body = getNodes(doc, 'body')[0];
    if (!body) {
      this.pagesContainer.innerHTML = '<p style="color: var(--dva-text-muted);">Empty document body</p>';
      return;
    }

    const blocks = [];
    for (let i = 0; i < body.children.length; i++) {
      const node = body.children[i];
      const localName = node.localName || node.nodeName.split(':').pop();

      if (localName === 'p') {
        const pObj = this.parseParagraph(node, mediaMap);
        if (pObj) blocks.push(pObj);
      } else if (localName === 'tbl') {
        const tblObj = this.parseTable(node, mediaMap);
        if (tblObj) blocks.push(tblObj);
      }
    }

    if (blocks.length === 0) {
      this.pagesContainer.innerHTML = '<p style="color: var(--dva-text-muted); text-align: center; padding: 40px;">No printable content found in document</p>';
      return;
    }

    const PAGE_BUDGET = 1400;
    const pages = [];
    let currentPageHtml = [];
    let currentWeight = 0;

    for (const block of blocks) {
      if (block.isPageBreak && currentPageHtml.length > 0) {
        pages.push(currentPageHtml.join(''));
        currentPageHtml = [];
        currentWeight = 0;
        if (block.html) {
          currentPageHtml.push(block.html);
          currentWeight += block.weight;
        }
        continue;
      }

      if (currentWeight + block.weight > PAGE_BUDGET && currentPageHtml.length > 0) {
        pages.push(currentPageHtml.join(''));
        currentPageHtml = [block.html];
        currentWeight = block.weight;
      } else {
        currentPageHtml.push(block.html);
        currentWeight += block.weight;
      }
    }

    if (currentPageHtml.length > 0) {
      pages.push(currentPageHtml.join(''));
    }

    this.pages = pages;
    this.renderPages();
  }

  renderPages() {
    this.pagesContainer.innerHTML = '';
    const total = this.pages.length;

    this.pages.forEach((pageContent, idx) => {
      const pageNumber = idx + 1;
      const pageEl = document.createElement('div');
      pageEl.className = 'dva-docx-page';
      pageEl.setAttribute('data-page', pageNumber);

      const bodyDiv = document.createElement('div');
      bodyDiv.className = 'dva-docx-body';
      bodyDiv.innerHTML = pageContent;
      pageEl.appendChild(bodyDiv);

      const footerDiv = document.createElement('div');
      footerDiv.className = 'dva-docx-footer';
      footerDiv.innerHTML = `
        <span>DocView-All Universal Viewer</span>
        <span class="dva-docx-page-num">Page ${pageNumber} of ${total}</span>
      `;

      pageEl.appendChild(footerDiv);
      this.pagesContainer.appendChild(pageEl);
    });
  }

  parseParagraph(pNode, mediaMap = new Map()) {
    let pTextHtml = '';
    let isHeading1 = false;
    let isHeading2 = false;
    let isHeading3 = false;
    let isList = false;
    let hasPageBreak = false;
    let align = 'left';

    const pPrNodes = getNodes(pNode, 'pPr');
    if (pPrNodes.length > 0) {
      const pPr = pPrNodes[0];
      const pStyle = getNodes(pPr, 'pStyle')[0];
      if (pStyle) {
        const val = (pStyle.getAttribute('w:val') || pStyle.getAttribute('val') || '').toLowerCase();
        if (val.includes('heading1') || val.includes('title')) isHeading1 = true;
        else if (val.includes('heading2') || val.includes('subtitle')) isHeading2 = true;
        else if (val.includes('heading3')) isHeading3 = true;
      }
      if (getNodes(pPr, 'numPr').length > 0) isList = true;
      if (getNodes(pPr, 'pageBreakBefore').length > 0) hasPageBreak = true;
      const jcNode = getNodes(pPr, 'jc')[0];
      if (jcNode) {
        const jcVal = jcNode.getAttribute('w:val') || jcNode.getAttribute('val');
        if (jcVal === 'center') align = 'center';
        else if (jcVal === 'right') align = 'right';
        else if (jcVal === 'both') align = 'justify';
      }
    }

    for (let j = 0; j < pNode.children.length; j++) {
      const child = pNode.children[j];
      const childName = child.localName || child.nodeName.split(':').pop();

      if (childName === 'r') {
        const brNodes = getNodes(child, 'br');
        for (const br of brNodes) {
          const type = br.getAttribute('w:type') || br.getAttribute('type');
          if (type === 'page') hasPageBreak = true;
        }
        if (getNodes(child, 'lastRenderedPageBreak').length > 0) hasPageBreak = true;

        pTextHtml += this.renderRun(child, mediaMap);
      } else if (childName === 'hyperlink') {
        const rNodes = getNodes(child, 'r');
        let linkInner = '';
        for (let r of rNodes) linkInner += this.renderRun(r, mediaMap);
        pTextHtml += `<span style="color: var(--dva-primary); text-decoration: underline;">${linkInner}</span>`;
      }
    }

    if (!pTextHtml.trim()) {
      if (hasPageBreak) return { html: '', weight: 0, isPageBreak: true };
      return { html: '<div style="height: 12px;"></div>', weight: 30, isPageBreak: false };
    }

    let formatted = '';
    const alignStyle = align !== 'left' ? `text-align: ${align};` : '';

    if (isHeading1) {
      formatted = `<h1 style="${alignStyle} font-size: 24px; font-weight: 800; margin: 22px 0 10px; border-bottom: 1px solid var(--dva-border); padding-bottom: 6px; color: var(--dva-text);">${pTextHtml}</h1>`;
    } else if (isHeading2) {
      formatted = `<h2 style="${alignStyle} font-size: 19px; font-weight: 700; margin: 16px 0 8px; color: var(--dva-text);">${pTextHtml}</h2>`;
    } else if (isHeading3) {
      formatted = `<h3 style="${alignStyle} font-size: 16px; font-weight: 600; margin: 12px 0 6px; color: var(--dva-text);">${pTextHtml}</h3>`;
    } else if (isList) {
      formatted = `<div style="display: flex; gap: 8px; margin-bottom: 8px; padding-left: 14px;"><span style="color: var(--dva-primary);">•</span><div>${pTextHtml}</div></div>`;
    } else {
      formatted = `<p style="${alignStyle} margin-bottom: 11px; word-break: break-word;">${pTextHtml}</p>`;
    }

    return {
      html: formatted,
      weight: pTextHtml.length + (isHeading1 ? 120 : isHeading2 ? 80 : 40),
      isPageBreak: hasPageBreak
    };
  }

  renderRun(rNode, mediaMap = new Map()) {
    let text = '';
    let isBold = false;
    let isItalic = false;
    let isUnderline = false;
    let isStrike = false;
    let color = '';
    let fontSize = '';

    const rPrNodes = getNodes(rNode, 'rPr');
    if (rPrNodes.length > 0) {
      const rPr = rPrNodes[0];
      if (getNodes(rPr, 'b').length > 0) isBold = true;
      if (getNodes(rPr, 'i').length > 0) isItalic = true;
      if (getNodes(rPr, 'u').length > 0) isUnderline = true;
      if (getNodes(rPr, 'strike').length > 0) isStrike = true;
      const colNode = getNodes(rPr, 'color')[0];
      if (colNode) {
        const val = colNode.getAttribute('w:val') || colNode.getAttribute('val');
        if (val && val !== 'auto') color = `#${val}`;
      }
      const szNode = getNodes(rPr, 'sz')[0];
      if (szNode) {
        const szVal = parseFloat(szNode.getAttribute('w:val') || szNode.getAttribute('val') || '0');
        if (szVal > 0) fontSize = `${(szVal / 2)}pt`;
      }
    }

    // Check for drawing/images inside run
    const drawings = getNodes(rNode, 'drawing');
    for (const drawing of drawings) {
      const blips = getNodes(drawing, 'blip');
      for (const blip of blips) {
        const embedId = blip.getAttribute('r:embed') || blip.getAttribute('embed') || '';
        // Look up image in media map
        for (const [key, dataUri] of mediaMap.entries()) {
          text += `<img src="${dataUri}" class="dva-docx-embedded-img" style="max-width: 100%; height: auto; border-radius: 4px; margin: 12px auto; display: block;" />`;
          break;
        }
      }
    }

    for (let k = 0; k < rNode.children.length; k++) {
      const child = rNode.children[k];
      const childName = child.localName || child.nodeName.split(':').pop();
      if (childName === 't') {
        text += this.escape(child.textContent || '');
      } else if (childName === 'br') {
        text += '<br/>';
      }
    }

    if (!text) return '';

    let res = text;
    if (isBold) res = `<strong>${res}</strong>`;
    if (isItalic) res = `<em>${res}</em>`;
    if (isUnderline) res = `<u>${res}</u>`;
    if (isStrike) res = `<s>${res}</s>`;
    const styleParts = [];
    if (color) styleParts.push(`color: ${color}`);
    if (fontSize) styleParts.push(`font-size: ${fontSize}`);
    if (styleParts.length > 0) {
      res = `<span style="${styleParts.join('; ')}">${res}</span>`;
    }

    return res;
  }

  parseTable(tblNode, mediaMap = new Map()) {
    let rowsHtml = '';
    const rows = getNodes(tblNode, 'tr');
    let totalChars = 0;

    for (let r of rows) {
      let cellsHtml = '';
      const cells = getNodes(r, 'tc');
      for (let c of cells) {
        let cellContent = '';
        let cellBg = '';

        const tcPr = getNodes(c, 'tcPr')[0];
        if (tcPr) {
          const shd = getNodes(tcPr, 'shd')[0];
          if (shd) {
            const fill = shd.getAttribute('w:fill') || shd.getAttribute('fill');
            if (fill && fill !== 'auto') cellBg = `#${fill}`;
          }
        }

        const paragraphs = getNodes(c, 'p');
        for (let p of paragraphs) {
          const pObj = this.parseParagraph(p, mediaMap);
          if (pObj && pObj.html) cellContent += pObj.html;
        }
        totalChars += cellContent.length;
        const bgStyle = cellBg ? `background: ${cellBg};` : '';
        cellsHtml += `<td style="border: 1px solid var(--dva-border); padding: 8px 12px; vertical-align: top; ${bgStyle}">${cellContent || '&nbsp;'}</td>`;
      }
      rowsHtml += `<tr>${cellsHtml}</tr>`;
    }

    const html = `
      <div style="width: 100%; overflow-x: auto; margin: 16px 0;">
        <table style="width: 100%; border-collapse: collapse; border: 1px solid var(--dva-border); font-size: 13.5px;">
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>
    `;

    return {
      html,
      weight: totalChars + 200,
      isPageBreak: false
    };
  }

  escape(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  initPagination() {
    if (!this.pagesContainer) return;

    // 1. Check for distinct section pages or OpenXML page divs
    const sections = Array.from(this.pagesContainer.querySelectorAll('section.docx, .dva-docx-page'));
    const pageBreaks = Array.from(this.pagesContainer.querySelectorAll('.docx-page-break, [style*="page-break"], hr.page-break'));

    if (sections.length > 1) {
      this.pageElements = sections;
      this.totalPages = sections.length;
      this.pageMode = 'elements';
    } else if (pageBreaks.length > 0) {
      this.pageElements = [this.pagesContainer.firstElementChild || sections[0], ...pageBreaks];
      this.totalPages = this.pageElements.length;
      this.pageMode = 'elements';
    } else {
      // Continuous Word flow: calculate pages based on scrollHeight vs standard A4 height (1056px at 96 DPI)
      const scrollH = this.pagesContainer.scrollHeight || (sections[0] && sections[0].scrollHeight) || 1056;
      const PAGE_HEIGHT = 1056;
      this.pageHeight = PAGE_HEIGHT;
      this.totalPages = Math.max(1, Math.ceil(scrollH / PAGE_HEIGHT));
      this.pageMode = 'virtual';
      this.pageElements = [];
    }

    this.currentPage = 1;
    if (this.viewer && typeof this.viewer.setPageInfo === 'function') {
      this.viewer.setPageInfo(1, this.totalPages);
    }

    this.setupScrollTracking();
  }

  setupScrollTracking() {
    if (!this.container) return;

    let ticking = false;
    this.scrollHandler = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          this.detectVisiblePage();
          ticking = false;
        });
        ticking = true;
      }
    };
    this.container.addEventListener('scroll', this.scrollHandler, { passive: true });
  }

  detectVisiblePage() {
    if (!this.container) return;

    if (this.pageMode === 'elements' && this.pageElements.length > 1) {
      const containerRect = this.container.getBoundingClientRect();
      const probeY = containerRect.top + 120;

      let closestIdx = 0;
      let minDiff = Infinity;

      this.pageElements.forEach((el, idx) => {
        const rect = el.getBoundingClientRect();
        const diff = Math.abs(rect.top - probeY);
        if (diff < minDiff) {
          minDiff = diff;
          closestIdx = idx;
        }
      });

      const activePage = closestIdx + 1;
      if (activePage !== this.currentPage) {
        this.currentPage = activePage;
        if (this.viewer && typeof this.viewer.setPageInfo === 'function') {
          this.viewer.setPageInfo(this.currentPage, this.totalPages);
        }
      }
    } else if (this.pageMode === 'virtual' && this.pageHeight > 0) {
      const activePage = Math.min(this.totalPages, Math.floor(this.container.scrollTop / this.pageHeight) + 1);
      if (activePage !== this.currentPage) {
        this.currentPage = activePage;
        if (this.viewer && typeof this.viewer.setPageInfo === 'function') {
          this.viewer.setPageInfo(this.currentPage, this.totalPages);
        }
      }
    }
  }

  goToPage(pageNumber) {
    const target = Math.max(1, Math.min(this.totalPages, parseInt(pageNumber, 10) || 1));
    this.currentPage = target;

    if (this.pageMode === 'elements' && this.pageElements && this.pageElements[target - 1]) {
      this.pageElements[target - 1].scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else if (this.container) {
      const topPos = (target - 1) * (this.pageHeight || 1056);
      this.container.scrollTo({ top: topPos, behavior: 'smooth' });
    }
  }

  updateTransform() {
    if (!this.pagesContainer) return;
    const scale = this.viewer.scale || 1;
    const rotation = this.viewer.rotation || 0;
    this.pagesContainer.style.transform = `scale(${scale}) rotate(${rotation}deg)`;
  }

  destroy() {
    if (this.container && this.scrollHandler) {
      this.container.removeEventListener('scroll', this.scrollHandler);
      this.scrollHandler = null;
    }
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    this.container = null;
    this.pagesContainer = null;
    this.pages = [];
    this.pageElements = [];
  }
}
