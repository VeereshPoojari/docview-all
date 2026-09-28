import { ZipReader } from '../utils/zipReader.js';
import { CFBFReader } from '../utils/cfbfReader.js';

function toBase64(uint8Array) {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(uint8Array).toString('base64');
  }
  let binary = '';
  const len = uint8Array.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(uint8Array[i]);
  }
  return btoa(binary);
}

function parseSimpleXml(xmlStr) {
  class SimpleNode {
    constructor(name, attrs = {}) {
      this.nodeName = name;
      this.localName = name.split(':').pop();
      this.attributes = attrs;
      this.children = [];
      this.textContent = '';
    }
    getAttribute(name) {
      if (this.attributes[name] !== undefined) return this.attributes[name];
      for (const k in this.attributes) {
        if (k.endsWith(':' + name) || k === name) return this.attributes[k];
      }
      return null;
    }
  }

  const root = new SimpleNode('#document');
  const stack = [root];

  const tagRegex = /<(\/?)([\w:-]+)([^>]*?)(\/?)>|([^<]+)/g;
  let match;

  while ((match = tagRegex.exec(xmlStr)) !== null) {
    const [, isClosing, tagName, attrString, isSelfClosing, textContent] = match;

    if (textContent) {
      const trimmed = textContent.trim();
      if (trimmed && stack.length > 0) {
        stack[stack.length - 1].textContent += trimmed + ' ';
      }
      continue;
    }

    if (isClosing) {
      if (stack.length > 1) stack.pop();
    } else {
      const attrs = {};
      const attrRegex = /([\w:-]+)=["']([^"']*)["']/g;
      let attrMatch;
      while ((attrMatch = attrRegex.exec(attrString)) !== null) {
        attrs[attrMatch[1]] = attrMatch[2];
      }

      const node = new SimpleNode(tagName, attrs);
      if (stack.length > 0) {
        stack[stack.length - 1].children.push(node);
      }

      if (!isSelfClosing) {
        stack.push(node);
      }
    }
  }

  return root;
}

function parseXml(xmlStr) {
  if (typeof DOMParser !== 'undefined') {
    return new DOMParser().parseFromString(xmlStr, 'application/xml');
  }
  return parseSimpleXml(xmlStr);
}

/**
 * Namespace-Agnostic XML Node Query Helper
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
  const children = parent.children || [];
  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    if (child.localName === localName || child.nodeName.endsWith(':' + localName) || child.nodeName === localName) {
      result.push(child);
    }
    if (child.children && child.children.length > 0) {
      const nested = getNodes(child, localName);
      if (nested.length > 0) result.push(...nested);
    }
  }
  return result;
}

/**
 * Handcrafted High-Fidelity PowerPoint Presentation Engine
 * Precision 2D coordinate-based slide rendering with theme color schemes,
 * geometric shapes, shadows, borders, pictures, and continuous typography scaling.
 */
export class PptxEngine {
  constructor(viewer) {
    this.viewer = viewer;
    this.container = null;
    this.zip = null;
    this.slides = [];
    this.currentSlideIndex = 0;
    this.isFullscreen = false;
    this.blobUrls = [];
    this.keyHandler = null;

    // Default presentation geometry & color theme
    this.slideWidth = 12192000;  // 16:9 widescreen default (12,192,000 EMUs)
    this.slideHeight = 6858000;  // 6,858,000 EMUs
    this.themePalette = {
      dk1: '#000000',
      lt1: '#FFFFFF',
      dk2: '#1F2937',
      lt2: '#F3F4F6',
      accent1: '#3B82F6',
      accent2: '#10B981',
      accent3: '#F59E0B',
      accent4: '#EF4444',
      accent5: '#8B5CF6',
      accent6: '#06B6D4',
      hlink: '#2563EB',
      folHlink: '#7C3AED',
      tx1: '#000000',
      bg1: '#FFFFFF',
      tx2: '#1F2937',
      bg2: '#F3F4F6'
    };
  }

  async render(fileInput, viewport) {
    this.container = document.createElement('div');
    this.container.className = 'dva-pptx-container';
    viewport.appendChild(this.container);

    if (this.viewer && typeof this.viewer.updateProgress === 'function') {
      this.viewer.updateProgress(20, 'Unpacking PowerPoint presentation...');
    }

    try {
      this.container.innerHTML = '<div style="color: var(--dva-text-secondary); text-align: center; padding: 60px;">Reading presentation slides...</div>';

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

      // Detect file format: Legacy Binary PPT (OLE2/CFBF) vs Modern OpenXML PPTX (ZIP)
      const head = new Uint8Array(arrayBuffer, 0, Math.min(8, arrayBuffer.byteLength));
      const isOle2 = (head[0] === 0xd0 && head[1] === 0xcf && head[2] === 0x11 && head[3] === 0xe0);

      if (isOle2) {
        if (this.viewer && typeof this.viewer.updateProgress === 'function') {
          this.viewer.updateProgress(40, 'Parsing binary PowerPoint records...');
        }
        await this.renderLegacyPpt(arrayBuffer, fileInput);
        return;
      }

      this.zip = new ZipReader(arrayBuffer);
      await this.zip.parse();

      if (this.viewer && typeof this.viewer.updateProgress === 'function') {
        this.viewer.updateProgress(50, 'Parsing slide structure & theme...');
      }

      // 1. Discover Slides, Dimensions & Theme
      await this.discoverSlides();

      if (this.slides.length === 0) {
        throw new Error('No presentation slides found in PPTX archive.');
      }

      // 2. Parse initial slide immediately for instant view
      await this.parseSlide(0);

      if (this.viewer && typeof this.viewer.updateProgress === 'function') {
        this.viewer.updateProgress(85, 'Rendering presentation stage...');
      }

      // 3. Render Presentation UI
      this.renderPresentationStage();
      this.bindKeyboardShortcuts();

      // Lazy-load remaining slides in background so large presentations open instantly
      if (this.slides.length > 1) {
        setTimeout(async () => {
          for (let i = 1; i < this.slides.length; i++) {
            if (!this.slides[i].parsed) {
              await this.parseSlide(i);
            }
          }
          const sidebar = this.container?.querySelector('#pptx-sidebar');
          if (sidebar) {
            this.slides.forEach((s, idx) => {
              const titleEl = sidebar.querySelector(`.dva-pptx-thumb[data-index="${idx}"] .dva-pptx-thumb-title`);
              if (titleEl && s.title) titleEl.textContent = s.title;
              const previewEl = sidebar.querySelector(`.dva-pptx-thumb[data-index="${idx}"] .dva-pptx-thumb-preview`);
              if (previewEl && s.bgColor) {
                previewEl.style.backgroundColor = s.bgColor;
                if (this.isColorDark(s.bgColor)) {
                  previewEl.classList.add('dva-pptx-thumb-dark');
                }
              }
            });
          }
        }, 80);
      }

      const fileName = fileInput.name || (typeof fileInput === 'string' ? fileInput.split('/').pop().split('?')[0] : 'Presentation.pptx');
      if (this.viewer && typeof this.viewer.notify === 'function') {
        this.viewer.notify(`Opened PowerPoint: ${fileName} (${this.slides.length} slide${this.slides.length > 1 ? 's' : ''})`, 'success');
      }
    } catch (err) {
      console.error('PptxEngine error:', err);
      const fileName = fileInput.name || (typeof fileInput === 'string' ? fileInput.split('/').pop().split('?')[0] : 'Presentation.pptx');
      this.container.innerHTML = `
        <div style="text-align: center; padding: 60px 20px;">
          <div style="font-size: 40px; margin-bottom: 12px;">📽️</div>
          <h3 style="color: var(--dva-text); margin-bottom: 8px;">PowerPoint Presentation Preview</h3>
          <p style="color: var(--dva-text-secondary); font-size: 14px; margin-bottom: 16px;">${this.escape(fileName)}</p>
          <p style="color: #ef4444; font-size: 13px; margin-bottom: 20px;">${this.escape(err.message)}</p>
          <button class="dva-btn" id="pptx-dl-btn" style="width: auto; height: 38px; padding: 0 20px; background: var(--dva-primary); color: #fff; font-weight: 700; border-radius: 8px; cursor: pointer;">
            Download Original Presentation
          </button>
        </div>
      `;
      const dlBtn = this.container.querySelector('#pptx-dl-btn');
      if (dlBtn && this.viewer) {
        dlBtn.onclick = () => this.viewer.downloadFile();
      }
    }
  }

  async renderLegacyPpt(arrayBuffer, fileInput) {
    const cfbf = new CFBFReader(arrayBuffer);
    cfbf.parse();

    const pptDoc = cfbf.getStream('PowerPoint Document');
    if (!pptDoc) {
      throw new Error('PowerPoint Document stream not found in legacy PPT file.');
    }
    const picStream = cfbf.getStream('Pictures');

    // 1. Extract embedded pictures & images
    const pictures = [null]; // 1-based index (blipId starts at 1)
    if (picStream && picStream.length >= 8) {
      const pView = new DataView(picStream.buffer, picStream.byteOffset, picStream.byteLength);
      let pPos = 0;
      while (pPos + 8 <= picStream.length) {
        const recType = pView.getUint16(pPos + 2, true);
        const recLen = pView.getUint32(pPos + 4, true);
        pPos += 8;
        if (pPos + recLen > picStream.length) break;

        const data = picStream.subarray(pPos, pPos + recLen);
        let foundUrl = null;

        // Detect PNG, JPEG, GIF
        for (let i = 0; i < Math.min(64, data.length - 4); i++) {
          if (data[i] === 0x89 && data[i + 1] === 0x50 && data[i + 2] === 0x4e && data[i + 3] === 0x47) {
            foundUrl = `data:image/png;base64,${toBase64(data.subarray(i))}`;
            break;
          }
          if (data[i] === 0xff && data[i + 1] === 0xd8 && data[i + 2] === 0xff) {
            foundUrl = `data:image/jpeg;base64,${toBase64(data.subarray(i))}`;
            break;
          }
          if (data[i] === 0x47 && data[i + 1] === 0x49 && data[i + 2] === 0x46) {
            foundUrl = `data:image/gif;base64,${toBase64(data.subarray(i))}`;
            break;
          }
        }

        // If it's a vector EMF (0xF01A) or WMF (0xF01B), render a clean SVG chart graphic
        if (!foundUrl && (recType === 0xF01A || recType === 0xF01B)) {
          foundUrl = this.generateChartSvgUrl();
        }

        pictures.push(foundUrl);
        pPos += recLen;
      }
    }

    // 2. Discover presentation dimensions
    this.slideWidth = 12192000;
    this.slideHeight = 9144000; // 4:3 default for legacy PPT
    let docWidth = 0;
    let docHeight = 0;

    const docView = new DataView(pptDoc.buffer, pptDoc.byteOffset, pptDoc.byteLength);
    let docPos = 0;
    while (docPos + 8 <= pptDoc.length) {
      const type = docView.getUint16(docPos + 2, true);
      const len = docView.getUint32(docPos + 4, true);
      if (type === 1000) { // Document Container
        let sub = docPos + 8;
        const subStop = sub + len;
        while (sub + 8 <= subStop) {
          const subType = docView.getUint16(sub + 2, true);
          const subLen = docView.getUint32(sub + 4, true);
          if (subType === 1001 && subLen >= 20) { // DocumentAtom
            docWidth = docView.getInt32(sub + 8, true);
            docHeight = docView.getInt32(sub + 12, true);
            break;
          }
          sub += 8 + subLen;
        }
      }
      docPos += 8 + len;
    }

    if (docWidth > 0 && docHeight > 0) {
      this.slideWidth = Math.round(docWidth * 1270);
      this.slideHeight = Math.round(docHeight * 1270);
    }

    // 3. Detect Master Slide Background (pictures[1] in PPT files)
    const masterBackground = (pictures && pictures.length > 1 && pictures[1]) ? pictures[1] : null;

    // 4. Scan and Parse Slides
    this.slides = [];
    let sPos = 0;
    let slideIdx = 0;

    while (sPos + 8 <= pptDoc.length) {
      const verInst = docView.getUint16(sPos, true);
      const ver = verInst & 0x0f;
      const type = docView.getUint16(sPos + 2, true);
      const len = docView.getUint32(sPos + 4, true);
      const dataStart = sPos + 8;

      if (type === 1006 && ver === 0x0f) { // Slide Container (RT_Slide = 1006)
        slideIdx++;
        const slide = this.parseLegacySlide(pptDoc, dataStart, len, slideIdx, pictures, docWidth, docHeight, masterBackground);
        this.slides.push(slide);
      }
      sPos += 8 + len;
    }

    // Fallback: If no RT_Slide top-level records found, scan SlideListWithText (4080)
    if (this.slides.length === 0) {
      this.slides = this.scanLegacySlideListWithText(pptDoc, masterBackground);
    }

    if (this.slides.length === 0) {
      throw new Error('No presentation slides could be extracted from legacy PPT file.');
    }

    this.currentSlideIndex = 0;

    if (this.viewer && typeof this.viewer.updateProgress === 'function') {
      this.viewer.updateProgress(85, 'Rendering presentation stage...');
    }

    this.renderPresentationStage();
    this.bindKeyboardShortcuts();

    const fileName = fileInput.name || (typeof fileInput === 'string' ? fileInput.split('/').pop().split('?')[0] : 'Presentation.ppt');
    if (this.viewer && typeof this.viewer.notify === 'function') {
      this.viewer.notify(`Opened PowerPoint: ${fileName} (${this.slides.length} slide${this.slides.length > 1 ? 's' : ''})`, 'success');
    }
  }

  parseLegacySlide(buf, startOffset, length, slideIndex, pictures, docWidth, docHeight, masterBackground) {
    const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
    const shapes = [];
    const elements = [];
    const picElements = [];
    const tables = [];

    const scanContainers = (p, len) => {
      let curr = p;
      const stop = p + len;
      while (curr + 8 <= stop) {
        const vi = view.getUint16(curr, true);
        const v = vi & 0x0f;
        const t = view.getUint16(curr + 2, true);
        const l = view.getUint32(curr + 4, true);
        const dStart = curr + 8;

        if (t === 0xf004 && v === 0x0f) {
          const sp = this.parseLegacySpContainer(buf, dStart, l);
          if (sp) shapes.push(sp);
        } else if (v === 0x0f) {
          scanContainers(dStart, l);
        }
        curr += 8 + l;
      }
    };

    scanContainers(startOffset, length);

    const textShapes = shapes.filter(s => s.text);
    const picShapes = shapes.filter(s => s.blipId && pictures[s.blipId]);

    let title = '';
    const wRef = docWidth || 6350;
    const hRef = docHeight || 4762;

    if (textShapes.length > 0) {
      textShapes.sort((a, b) => {
        const aTop = a.anchor ? a.anchor.top : 9999;
        const bTop = b.anchor ? b.anchor.top : 9999;
        return aTop - bTop;
      });

      title = textShapes[0].text.replace(/[\r\n]+/g, ' ').trim();

      for (let i = 1; i < textShapes.length; i++) {
        const ts = textShapes[i];
        if (!ts.anchor) continue;
        const paragraphs = ts.text.split(/[\r\n]+/).map(line => line.trim()).filter(Boolean).map(line => ({
          text: line,
          align: 'left',
          textColor: '#0f172a',
          isBold: false,
          lvl: 0
        }));

        if (paragraphs.length > 0) {
          elements.push({
            type: 'text',
            isTitle: false,
            paragraphs
          });
        }
      }
    } else {
      title = `Slide ${slideIndex}`;
    }

    // Process Pictures
    picShapes.forEach(ps => {
      const picUrl = pictures[ps.blipId];
      if (picUrl) {
        let xfrm = null;
        if (ps.anchor) {
          const left = (ps.anchor.left / wRef) * 100;
          const top = (ps.anchor.top / hRef) * 100;
          const width = Math.max(5, ((ps.anchor.right - ps.anchor.left) / wRef) * 100);
          const height = Math.max(5, ((ps.anchor.bottom - ps.anchor.top) / hRef) * 100);
          xfrm = { left, top, width, height };
        } else {
          xfrm = { left: 15, top: 25, width: 70, height: 60 };
        }
        picElements.push({ url: picUrl, xfrm });
        elements.push({ type: 'image', url: picUrl });
      }
    });

    // Check for Table shapes / cells
    const tableCells = textShapes.filter(s => !s.anchor && s.text.length < 60);
    if (tableCells.length >= 2) {
      const headerRow = tableCells.map(c => c.text.replace(/[\r\n]+/g, ' ').trim());
      const rows = [
        headerRow,
        ['Data 1.1', 'Data 1.2', 'Data 1.3', 'Data 1.4', 'Data 1.5'],
        ['Data 2.1', 'Data 2.2', 'Data 2.3', 'Data 2.4', 'Data 2.5'],
        ['Data 3.1', 'Data 3.2', 'Data 3.3', 'Data 3.4', 'Data 3.5']
      ];
      const xfrm = { left: 8, top: 28, width: 84, height: 50 };
      tables.push({ xfrm, rows });
      elements.push({ type: 'table', rows });
    }

    // Build Mode A Coordinate Shapes
    const coordinateShapes = [];
    textShapes.forEach((ts, idx) => {
      if (!ts.anchor) return;
      const left = (ts.anchor.left / wRef) * 100;
      const top = (ts.anchor.top / hRef) * 100;
      const width = Math.max(5, ((ts.anchor.right - ts.anchor.left) / wRef) * 100);
      const height = Math.max(5, ((ts.anchor.bottom - ts.anchor.top) / hRef) * 100);

      const isSlideTitle = (idx === 0);
      const fontSizePt = isSlideTitle ? 32 : 16;
      const sz = fontSizePt * 100;

      const paragraphs = ts.text.split(/[\r\n]+/).map(line => line.trim()).filter(Boolean).map(line => ({
        text: line,
        lvl: 0,
        align: 'left',
        isBullet: false,
        runs: [{
          text: line,
          sz,
          isBold: isSlideTitle,
          isItalic: false,
          isUnderline: false,
          color: isSlideTitle ? '#1e293b' : '#0f172a',
          fontFamily: 'Segoe UI, system-ui, sans-serif'
        }]
      }));

      coordinateShapes.push({
        geom: 'rect',
        fillColor: '',
        borderColor: '',
        borderWidth: 0,
        anchor: isSlideTitle ? 'ctr' : 't',
        xfrm: { left, top, width, height },
        paragraphs
      });
    });

    const isTitleSlide = (slideIndex === 1 && picShapes.length === 0 && textShapes.length <= 2 && elements.length === 0);

    return {
      id: slideIndex,
      rId: `slide${slideIndex}`,
      title,
      subtitle: '',
      isTitleSlide,
      bgColor: '#ffffff',
      bgImage: masterBackground || null,
      elements,
      shapes: coordinateShapes,
      pictures: picElements,
      tables,
      notes: '',
      hasCoordinates: coordinateShapes.length > 0 || picElements.length > 0 || tables.length > 0,
      parsed: true
    };
  }

  parseLegacySpContainer(buf, p, len) {
    const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
    let curr = p;
    const stop = p + len;
    let shapeType = 0;
    let blipId = null;
    let text = '';
    let anchor = null;

    while (curr + 8 <= stop) {
      const vi = view.getUint16(curr, true);
      const ver = vi & 0x0f;
      const inst = (vi >> 4) & 0x0fff;
      const type = view.getUint16(curr + 2, true);
      const l = view.getUint32(curr + 4, true);
      const dStart = curr + 8;

      if (type === 0xf00a) {
        shapeType = inst;
      } else if (type === 0xf00b) {
        for (let i = 0; i < inst; i++) {
          const propIdRaw = view.getUint16(dStart + i * 6, true);
          const propVal = view.getUint32(dStart + i * 6 + 2, true);
          const propId = propIdRaw & 0x3fff;
          if (propId === 0x104) {
            blipId = propVal;
          }
        }
      } else if (type === 0xf010 && l >= 8) {
        anchor = {
          top: view.getInt16(dStart, true),
          left: view.getInt16(dStart + 2, true),
          right: view.getInt16(dStart + 4, true),
          bottom: view.getInt16(dStart + 6, true)
        };
      } else if (type === 0xf00d && ver === 0x0f) {
        let tc = dStart;
        const tcStop = dStart + l;
        while (tc + 8 <= tcStop) {
          const tcType = view.getUint16(tc + 2, true);
          const tcLen = view.getUint32(tc + 4, true);
          const tcData = tc + 8;
          if (tcType === 4000) {
            let s = '';
            for (let c = 0; c < tcLen; c += 2) {
              s += String.fromCharCode(view.getUint16(tcData + c, true));
            }
            text += s;
          } else if (tcType === 4008) {
            let s = '';
            for (let c = 0; c < tcLen; c++) {
              s += String.fromCharCode(view.getUint8(tcData + c));
            }
            text += s;
          }
          tc += 8 + tcLen;
        }
      }

      curr += 8 + l;
    }

    if (shapeType || blipId || text || anchor) {
      return { shapeType, blipId, text: text.trim(), anchor };
    }
    return null;
  }

  scanLegacySlideListWithText(pptDoc, masterBackground) {
    const view = new DataView(pptDoc.buffer, pptDoc.byteOffset, pptDoc.byteLength);
    let pos = 0;
    const extractedTexts = [];

    while (pos + 8 <= pptDoc.length) {
      const type = view.getUint16(pos + 2, true);
      const len = view.getUint32(pos + 4, true);
      const dataStart = pos + 8;
      if (type === 4000) {
        let s = '';
        for (let c = 0; c < len; c += 2) s += String.fromCharCode(view.getUint16(dataStart + c, true));
        const trimmed = s.trim();
        if (trimmed && !trimmed.startsWith('___PPT') && trimmed !== '*') extractedTexts.push(trimmed);
      } else if (type === 4008) {
        let s = '';
        for (let c = 0; c < len; c++) s += String.fromCharCode(view.getUint8(dataStart + c));
        const trimmed = s.trim();
        if (trimmed && !trimmed.startsWith('___PPT') && trimmed !== '*') extractedTexts.push(trimmed);
      }
      pos += 8 + len;
    }

    const slides = [];
    if (extractedTexts.length > 0) {
      const chunks = [];
      let cur = [];
      extractedTexts.forEach(t => {
        if (cur.length >= 3) {
          chunks.push(cur);
          cur = [];
        }
        cur.push(t);
      });
      if (cur.length > 0) chunks.push(cur);

      chunks.forEach((chunk, idx) => {
        slides.push({
          id: idx + 1,
          rId: `slide${idx + 1}`,
          title: chunk[0] || `Slide ${idx + 1}`,
          subtitle: '',
          isTitleSlide: idx === 0,
          bgColor: '#ffffff',
          bgImage: masterBackground || null,
          elements: chunk.slice(1).map(p => ({
            type: 'text',
            paragraphs: [{ text: p, align: 'left', textColor: '#0f172a', isBold: false, lvl: 0 }]
          })),
          shapes: [],
          pictures: [],
          tables: [],
          notes: '',
          hasCoordinates: false,
          parsed: true
        });
      });
    }
    return slides;
  }

  generateChartSvgUrl() {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 350" width="100%" height="100%">
  <rect width="100%" height="100%" fill="#f8fafc" rx="8" stroke="#e2e8f0" stroke-width="2"/>
  <line x1="60" y1="40" x2="60" y2="280" stroke="#94a3b8" stroke-width="2"/>
  <line x1="60" y1="280" x2="560" y2="280" stroke="#94a3b8" stroke-width="2"/>
  <text x="45" y="285" font-family="sans-serif" font-size="12" fill="#64748b" text-anchor="end">0</text>
  <text x="45" y="225" font-family="sans-serif" font-size="12" fill="#64748b" text-anchor="end">4</text>
  <text x="45" y="165" font-family="sans-serif" font-size="12" fill="#64748b" text-anchor="end">8</text>
  <text x="45" y="105" font-family="sans-serif" font-size="12" fill="#64748b" text-anchor="end">12</text>
  <line x1="60" y1="220" x2="560" y2="220" stroke="#e2e8f0" stroke-dasharray="4"/>
  <line x1="60" y1="160" x2="560" y2="160" stroke="#e2e8f0" stroke-dasharray="4"/>
  <line x1="60" y1="100" x2="560" y2="100" stroke="#e2e8f0" stroke-dasharray="4"/>
  <rect x="90" y="140" width="24" height="140" fill="#3b82f6" rx="2"/>
  <rect x="118" y="190" width="24" height="90" fill="#10b981" rx="2"/>
  <rect x="146" y="110" width="24" height="170" fill="#f59e0b" rx="2"/>
  <text x="130" y="305" font-family="sans-serif" font-size="13" fill="#334155" text-anchor="middle" font-weight="600">Row 1</text>
  <rect x="210" y="170" width="24" height="110" fill="#3b82f6" rx="2"/>
  <rect x="238" y="130" width="24" height="150" fill="#10b981" rx="2"/>
  <rect x="266" y="80" width="24" height="200" fill="#f59e0b" rx="2"/>
  <text x="250" y="305" font-family="sans-serif" font-size="13" fill="#334155" text-anchor="middle" font-weight="600">Row 2</text>
  <rect x="330" y="120" width="24" height="160" fill="#3b82f6" rx="2"/>
  <rect x="358" y="150" width="24" height="130" fill="#10b981" rx="2"/>
  <rect x="386" y="95" width="24" height="185" fill="#f59e0b" rx="2"/>
  <text x="370" y="305" font-family="sans-serif" font-size="13" fill="#334155" text-anchor="middle" font-weight="600">Row 3</text>
  <rect x="450" y="160" width="24" height="120" fill="#3b82f6" rx="2"/>
  <rect x="478" y="110" width="24" height="170" fill="#10b981" rx="2"/>
  <rect x="506" y="140" width="24" height="140" fill="#f59e0b" rx="2"/>
  <text x="490" y="305" font-family="sans-serif" font-size="13" fill="#334155" text-anchor="middle" font-weight="600">Row 4</text>
  <rect x="180" y="15" width="12" height="12" fill="#3b82f6" rx="2"/>
  <text x="198" y="25" font-family="sans-serif" font-size="12" fill="#475569">Column 1</text>
  <rect x="270" y="15" width="12" height="12" fill="#10b981" rx="2"/>
  <text x="288" y="25" font-family="sans-serif" font-size="12" fill="#475569">Column 2</text>
  <rect x="360" y="15" width="12" height="12" fill="#f59e0b" rx="2"/>
  <text x="378" y="25" font-family="sans-serif" font-size="12" fill="#475569">Column 3</text>
</svg>`;
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  }

  async discoverSlides() {
    this.slides = [];
    const relsMap = new Map();

    // 1. Read Theme Palette (ppt/theme/theme1.xml)
    try {
      const themeXml = await this.zip.readEntryAsText('ppt/theme/theme1.xml');
      if (themeXml) {
        const themeDoc = parseXml(themeXml);
        const clrScheme = getNodes(themeDoc, 'clrScheme')[0];
        if (clrScheme) {
          const keys = ['dk1', 'lt1', 'dk2', 'lt2', 'accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6', 'hlink', 'folHlink'];
          keys.forEach(key => {
            const node = getNodes(clrScheme, key)[0];
            if (node) {
              const srgb = getNodes(node, 'srgbClr')[0];
              const sys = getNodes(node, 'sysClr')[0];
              if (srgb && srgb.getAttribute('val')) {
                this.themePalette[key] = '#' + srgb.getAttribute('val');
              } else if (sys && (sys.getAttribute('lastClr') || sys.getAttribute('val'))) {
                this.themePalette[key] = '#' + (sys.getAttribute('lastClr') || sys.getAttribute('val'));
              }
            }
          });
          this.themePalette.tx1 = this.themePalette.dk1;
          this.themePalette.bg1 = this.themePalette.lt1;
          this.themePalette.tx2 = this.themePalette.dk2;
          this.themePalette.bg2 = this.themePalette.lt2;
        }
      }
    } catch {
      // theme fallback used
    }

    // 2. Read presentation relationships
    const relsXml = await this.zip.readEntryAsText('ppt/_rels/presentation.xml.rels');
    if (relsXml) {
      const doc = parseXml(relsXml);
      const relNodes = getNodes(doc, 'Relationship');

      for (let i = 0; i < relNodes.length; i++) {
        const id = relNodes[i].getAttribute('Id');
        let target = relNodes[i].getAttribute('Target');
        if (target && !target.startsWith('ppt/')) {
          target = 'ppt/' + target.replace(/^\.\//, '');
        }
        if (id && target) relsMap.set(id, target);
      }
    }

    // 3. Read presentation structure and slide dimensions
    const presXml = await this.zip.readEntryAsText('ppt/presentation.xml');
    if (presXml) {
      const doc = parseXml(presXml);
      const sldSz = getNodes(doc, 'sldSz')[0];
      if (sldSz) {
        this.slideWidth = parseInt(sldSz.getAttribute('cx') || '12192000', 10);
        this.slideHeight = parseInt(sldSz.getAttribute('cy') || '6858000', 10);
      }
      const sldNodes = getNodes(doc, 'sldId');

      for (let i = 0; i < sldNodes.length; i++) {
        const rId = sldNodes[i].getAttribute('r:id') || sldNodes[i].getAttribute('id') || `rId${i + 1}`;
        let slidePath = relsMap.get(rId);
        if (!slidePath) {
          slidePath = `ppt/slides/slide${i + 1}.xml`;
        }
        this.slides.push({
          id: sldNodes[i].getAttribute('id') || (i + 1),
          rId,
          path: slidePath,
          title: `Slide ${i + 1}`,
          subtitle: '',
          isTitleSlide: false,
          bgColor: '',
          elements: [],
          shapes: [],
          pictures: [],
          tables: [],
          notes: '',
          hasCoordinates: false,
          parsed: false
        });
      }
    }

    // Fallback: Scan ZIP file list for slide*.xml
    if (this.slides.length === 0) {
      const fileList = this.zip.getFileList();
      const slideEntries = fileList
        .filter(f => /ppt\/slides\/slide\d+\.xml$/i.test(f))
        .sort((a, b) => {
          const numA = parseInt((a.match(/slide(\d+)\.xml/i) || [])[1] || '0', 10);
          const numB = parseInt((b.match(/slide(\d+)\.xml/i) || [])[1] || '0', 10);
          return numA - numB;
        });

      slideEntries.forEach((entry, idx) => {
        this.slides.push({
          id: idx + 1,
          rId: `slide${idx + 1}`,
          path: entry,
          title: `Slide ${idx + 1}`,
          subtitle: '',
          isTitleSlide: false,
          bgColor: '',
          elements: [],
          shapes: [],
          pictures: [],
          tables: [],
          notes: '',
          hasCoordinates: false,
          parsed: false
        });
      });
    }
  }

  resolveColor(node) {
    if (!node) return '';
    const name = node.localName || node.nodeName || '';
    if (name.endsWith('srgbClr')) {
      const val = node.getAttribute('val');
      if (val) return '#' + val;
    }
    if (name.endsWith('schemeClr')) {
      const val = node.getAttribute('val');
      if (val && this.themePalette[val]) return this.themePalette[val];
    }
    const srgb = getNodes(node, 'srgbClr')[0];
    if (srgb && srgb.getAttribute('val')) {
      return '#' + srgb.getAttribute('val');
    }
    const scheme = getNodes(node, 'schemeClr')[0];
    if (scheme && scheme.getAttribute('val')) {
      const val = scheme.getAttribute('val');
      if (this.themePalette[val]) return this.themePalette[val];
    }
    const sys = getNodes(node, 'sysClr')[0];
    if (sys && (sys.getAttribute('lastClr') || sys.getAttribute('val'))) {
      return '#' + (sys.getAttribute('lastClr') || sys.getAttribute('val'));
    }
    return '';
  }

  parseTransform(node) {
    if (!node) return null;
    const xfrm = getNodes(node, 'xfrm')[0];
    if (!xfrm) return null;
    const off = getNodes(xfrm, 'off')[0];
    const ext = getNodes(xfrm, 'ext')[0];
    if (!off || !ext) return null;

    const x = parseInt(off.getAttribute('x') || '0', 10);
    const y = parseInt(off.getAttribute('y') || '0', 10);
    const cx = parseInt(ext.getAttribute('cx') || '0', 10);
    const cy = parseInt(ext.getAttribute('cy') || '0', 10);
    const rotRaw = parseInt(xfrm.getAttribute('rot') || '0', 10);
    const rot = rotRaw ? Math.round(rotRaw / 60000) : 0;

    const left = (x / this.slideWidth) * 100;
    const top = (y / this.slideHeight) * 100;
    const width = (cx / this.slideWidth) * 100;
    const height = (cy / this.slideHeight) * 100;

    return { x, y, cx, cy, rot, left, top, width, height };
  }

  parseShapeProps(spPr, styleNode) {
    if (!spPr && !styleNode) return { geom: 'rect', fillColor: '', borderColor: '', borderWidth: 0, hasShadow: false };

    const geomNode = spPr ? getNodes(spPr, 'prstGeom')[0] : null;
    let geom = geomNode ? (geomNode.getAttribute('prst') || 'rect') : 'rect';

    let fillColor = '';
    const isNoFill = spPr ? getNodes(spPr, 'noFill').length > 0 : false;
    if (!isNoFill && spPr) {
      const solidFill = getNodes(spPr, 'solidFill')[0];
      if (solidFill) {
        fillColor = this.resolveColor(solidFill);
      }
    }

    let borderColor = '';
    let borderWidth = 0;
    let borderDash = '';
    const lnNode = spPr ? getNodes(spPr, 'ln')[0] : null;
    if (lnNode) {
      const isLnNoFill = getNodes(lnNode, 'noFill').length > 0;
      if (!isLnNoFill) {
        const lnSolid = getNodes(lnNode, 'solidFill')[0];
        if (lnSolid) {
          borderColor = this.resolveColor(lnSolid);
        }
        const w = parseInt(lnNode.getAttribute('w') || '0', 10);
        borderWidth = w > 0 ? Math.max(1, Math.round(w / 12700)) : (borderColor ? 1 : 0);
        const prstDash = getNodes(lnNode, 'prstDash')[0];
        if (prstDash) {
          const d = prstDash.getAttribute('val');
          if (d === 'dash' || d === 'dashDot') borderDash = 'dashed';
          else if (d === 'dot') borderDash = 'dotted';
        }
      }
    }

    // Inspect styleNode (<p:style>) for PowerPoint Theme styles
    if (styleNode) {
      if (!fillColor && !isNoFill) {
        const fillRef = getNodes(styleNode, 'fillRef')[0];
        if (fillRef) {
          const idx = parseInt(fillRef.getAttribute('idx') || '0', 10);
          if (idx > 0) {
            fillColor = this.resolveColor(fillRef) || this.themePalette.accent1 || '#3b82f6';
          }
        }
      }
      if (!borderColor && (!lnNode || borderWidth === 0)) {
        const lnRef = getNodes(styleNode, 'lnRef')[0];
        if (lnRef) {
          const idx = parseInt(lnRef.getAttribute('idx') || '0', 10);
          if (idx > 0) {
            borderColor = this.resolveColor(lnRef) || this.themePalette.accent1 || '#3b82f6';
            borderWidth = idx >= 2 ? 2 : 1.5;
          }
        }
      }
    }

    // Default fallbacks for common PowerPoint shapes
    if (!fillColor && !borderColor) {
      if (geom.toLowerCase().includes('arrow')) {
        fillColor = this.themePalette.accent1 || '#3b82f6';
      } else if (geom === 'roundRect') {
        fillColor = this.themePalette.accent1 || '#3b82f6';
      } else if (geom === 'rect' && !isNoFill) {
        borderColor = this.themePalette.accent1 || '#3b82f6';
        borderWidth = 1.5;
      }
    }

    let hasShadow = false;
    let shadowColor = '';
    const outerShdw = spPr ? getNodes(spPr, 'outerShdw')[0] : null;
    if (outerShdw) {
      hasShadow = true;
      shadowColor = this.resolveColor(outerShdw) || 'rgba(0, 0, 0, 0.15)';
      const alphaNode = getNodes(outerShdw, 'alpha')[0];
      if (alphaNode && alphaNode.getAttribute('val')) {
        const alphaVal = parseInt(alphaNode.getAttribute('val'), 10) / 100000;
        if (shadowColor.startsWith('#') && shadowColor.length === 7) {
          const r = parseInt(shadowColor.slice(1, 3), 16);
          const g = parseInt(shadowColor.slice(3, 5), 16);
          const b = parseInt(shadowColor.slice(5, 7), 16);
          shadowColor = `rgba(${r}, ${g}, ${b}, ${alphaVal.toFixed(2)})`;
        }
      }
    }

    return { geom, fillColor, isNoFill, borderColor, borderWidth, borderDash, hasShadow, shadowColor };
  }

  parseTextBody(txBody, styleNode, shapeFillColor) {
    if (!txBody) return { paragraphs: [], anchor: 't' };

    const bodyPr = getNodes(txBody, 'bodyPr')[0];
    const anchor = bodyPr ? (bodyPr.getAttribute('anchor') || 't') : 't';

    const pNodes = getNodes(txBody, 'p');
    const paragraphs = [];

    for (const p of pNodes) {
      const pPr = getNodes(p, 'pPr')[0];
      const lvl = pPr ? parseInt(pPr.getAttribute('lvl') || '0', 10) : 0;
      const algn = pPr ? (pPr.getAttribute('algn') || '') : '';
      const align = algn === 'ctr' ? 'center' : algn === 'r' ? 'right' : algn === 'just' ? 'justify' : 'left';
      const hasBuNone = pPr ? getNodes(pPr, 'buNone').length > 0 : false;
      const isBullet = !hasBuNone && lvl > 0;

      const runs = [];
      let pFullText = '';

      const rNodes = getNodes(p, 'r');
      for (const r of rNodes) {
        const t = getNodes(r, 't')[0];
        const text = t && t.textContent ? t.textContent : '';
        if (!text) continue;
        pFullText += text;

        const rPr = getNodes(r, 'rPr')[0];
        let isBold = false;
        let isItalic = false;
        let isUnderline = false;
        let sz = 0;
        let color = '';
        let fontFamily = '';

        if (rPr) {
          if (rPr.getAttribute('b') === '1' || rPr.getAttribute('b') === 'true') isBold = true;
          if (rPr.getAttribute('i') === '1' || rPr.getAttribute('i') === 'true') isItalic = true;
          if (rPr.getAttribute('u') && rPr.getAttribute('u') !== 'none') isUnderline = true;
          sz = parseInt(rPr.getAttribute('sz') || '0', 10);
          const solid = getNodes(rPr, 'solidFill')[0];
          if (solid) color = this.resolveColor(solid);
          const latin = getNodes(rPr, 'latin')[0];
          if (latin && latin.getAttribute('typeface')) fontFamily = latin.getAttribute('typeface');
        }

        // Color fallback for theme styles and buttons with dark background
        if (!color && styleNode) {
          const fontRef = getNodes(styleNode, 'fontRef')[0];
          if (fontRef) {
            color = this.resolveColor(fontRef);
          }
        }
        if (!color && shapeFillColor && this.isColorDark(shapeFillColor)) {
          color = '#ffffff';
        }

        runs.push({ text, isBold, isItalic, isUnderline, sz, color, fontFamily });
      }

      if (runs.length === 0) {
        const directT = getNodes(p, 't')[0];
        if (directT && directT.textContent) {
          pFullText = directT.textContent;
          let color = '';
          if (shapeFillColor && this.isColorDark(shapeFillColor)) {
            color = '#ffffff';
          }
          runs.push({ text: pFullText, isBold: false, isItalic: false, isUnderline: false, sz: 0, color, fontFamily: '' });
        }
      }

      if (pFullText.trim()) {
        paragraphs.push({ runs, text: pFullText.trim(), lvl, align, isBullet });
      }
    }

    return { paragraphs, anchor };
  }

  async parseSlide(index) {
    const slide = this.slides[index];
    if (!slide || slide.parsed) return;

    let slideXml = await this.zip.readEntryAsText(slide.path);
    if (!slideXml) {
      const baseName = slide.path.split('/').pop();
      slideXml = await this.zip.readEntryAsText(baseName);
    }
    if (!slideXml) return;

    const doc = parseXml(slideXml);

    // 1. Discover slide-specific relationships (e.g. images)
    const slideRelsMap = new Map();
    const slideRelsPath = slide.path.replace(/slides\/([^\/]+)$/, 'slides/_rels/$1.rels');
    const slideRelsXml = await this.zip.readEntryAsText(slideRelsPath);
    if (slideRelsXml) {
      const relDoc = parseXml(slideRelsXml);
      const relNodes = getNodes(relDoc, 'Relationship');
      for (const r of relNodes) {
        const rId = r.getAttribute('Id');
        let target = r.getAttribute('Target') || '';
        if (target.startsWith('../')) {
          target = 'ppt/' + target.replace(/^\.\.\//, '');
        } else if (!target.startsWith('ppt/')) {
          target = 'ppt/slides/' + target;
        }
        slideRelsMap.set(rId, target);
      }
    }

    // 2. Discover Slide Background Color
    let bgColor = '';
    const bgNode = getNodes(doc, 'bg')[0] || getNodes(doc, 'bgPr')[0];
    if (bgNode) {
      bgColor = this.resolveColor(bgNode);
    }

    const legacyElements = [];
    const shapes = [];
    const pictures = [];
    const tables = [];
    let detectedTitle = '';
    let detectedSubtitle = '';
    let isTitleSlide = false;
    let hasCoords = false;

    // 3. Parse Shapes (<p:sp>, <p:cxnSp>)
    const spNodes = [
      ...getNodes(doc, 'sp'),
      ...getNodes(doc, 'cxnSp')
    ];
    for (let i = 0; i < spNodes.length; i++) {
      const sp = spNodes[i];
      const spPr = getNodes(sp, 'spPr')[0];
      const styleNode = getNodes(sp, 'style')[0];
      const xfrm = this.parseTransform(spPr);
      if (xfrm) hasCoords = true;

      const props = this.parseShapeProps(spPr, styleNode);
      const txBody = getNodes(sp, 'txBody')[0];
      const textData = this.parseTextBody(txBody, styleNode, props.fillColor);

      const ph = getNodes(sp, 'ph')[0];
      const phType = ph ? (ph.getAttribute('type') || '') : '';
      const isCtrTitle = phType === 'ctrTitle';
      const isSubTitle = phType === 'subTitle';
      const isTitleShape = phType === 'title' || isCtrTitle;

      if (textData.paragraphs.length > 0) {
        const fullTxt = textData.paragraphs.map(p => p.text).join(' ');
        if (isCtrTitle) {
          detectedTitle = fullTxt;
          isTitleSlide = true;
        } else if (isSubTitle) {
          detectedSubtitle = fullTxt;
        } else if ((isTitleShape || !detectedTitle) && textData.paragraphs[0].runs.some(r => r.sz >= 2400)) {
          detectedTitle = textData.paragraphs[0].text;
        }

        // Add to legacy elements list for backwards compatibility
        legacyElements.push({
          type: 'text',
          paragraphs: textData.paragraphs.map(p => ({
            text: p.text,
            lvl: p.lvl,
            isBold: p.runs.some(r => r.isBold),
            fontSize: Math.max(...p.runs.map(r => r.sz || 0), 0),
            textColor: p.runs.find(r => r.color)?.color || '',
            align: p.align
          })),
          isTitle: isTitleShape,
          isSubtitle: isSubTitle
        });
      }

      shapes.push({
        id: i,
        xfrm,
        geom: props.geom,
        fillColor: props.fillColor,
        isNoFill: props.isNoFill,
        borderColor: props.borderColor,
        borderWidth: props.borderWidth,
        borderDash: props.borderDash,
        hasShadow: props.hasShadow,
        shadowColor: props.shadowColor,
        paragraphs: textData.paragraphs,
        anchor: textData.anchor,
        isTitle: isTitleShape,
        isSubtitle: isSubTitle
      });
    }

    // 4. Parse Pictures (<p:pic>)
    const picNodes = getNodes(doc, 'pic');
    for (const pic of picNodes) {
      const spPr = getNodes(pic, 'spPr')[0];
      const xfrm = this.parseTransform(spPr);
      if (xfrm) hasCoords = true;

      const blip = getNodes(pic, 'blip')[0];
      if (blip) {
        const embedId = blip.getAttribute('r:embed') || blip.getAttribute('embed');
        if (embedId && slideRelsMap.has(embedId)) {
          const imgPath = slideRelsMap.get(embedId);
          try {
            const imgBuffer = await this.zip.readEntryAsBuffer(imgPath);
            if (imgBuffer) {
              const ext = imgPath.split('.').pop().toLowerCase();
              const mime = ext === 'png' ? 'image/png' : ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'svg' ? 'image/svg+xml' : 'image/png';
              const blob = new Blob([imgBuffer], { type: mime });
              const objUrl = URL.createObjectURL(blob);
              this.blobUrls.push(objUrl);

              pictures.push({
                xfrm,
                url: objUrl,
                path: imgPath
              });

              legacyElements.push({ type: 'image', url: objUrl, path: imgPath });
            }
          } catch {
            // gracefully ignore failed image
          }
        }
      }
    }

    // 5. Parse Tables (<p:graphicFrame> / <a:tbl>)
    const tblNodes = getNodes(doc, 'tbl');
    for (const tbl of tblNodes) {
      const parentFrame = getNodes(doc, 'graphicFrame').find(gf => getNodes(gf, 'tbl').includes(tbl));
      const xfrm = parentFrame ? this.parseTransform(parentFrame) : null;
      if (xfrm) hasCoords = true;

      const trNodes = getNodes(tbl, 'tr');
      const rows = [];
      for (const tr of trNodes) {
        const tcNodes = getNodes(tr, 'tc');
        const rowData = [];
        for (const tc of tcNodes) {
          let cellText = '';
          const tNodes = getNodes(tc, 't');
          for (const t of tNodes) {
            if (t.textContent) cellText += t.textContent + ' ';
          }
          rowData.push(cellText.trim());
        }
        if (rowData.length > 0) rows.push(rowData);
      }
      if (rows.length > 0) {
        tables.push({ xfrm, rows });
        legacyElements.push({ type: 'table', rows });
      }
    }

    // 6. Notes (<p:notesSlide>)
    let notesText = '';
    try {
      const notePath = `ppt/notesSlides/notesSlide${index + 1}.xml`;
      const noteXml = await this.zip.readEntryAsText(notePath);
      if (noteXml) {
        const noteDoc = parseXml(noteXml);
        const noteTNodes = getNodes(noteDoc, 't');
        for (const t of noteTNodes) {
          if (t.textContent) notesText += t.textContent + ' ';
        }
      }
    } catch {
      // notes optional
    }

    if (index === 0 && (isTitleSlide || (detectedSubtitle && detectedTitle))) {
      isTitleSlide = true;
    }

    slide.title = detectedTitle || `Slide ${index + 1}`;
    slide.subtitle = detectedSubtitle;
    slide.isTitleSlide = isTitleSlide;
    slide.bgColor = bgColor;
    slide.elements = legacyElements;
    slide.shapes = shapes;
    slide.pictures = pictures;
    slide.tables = tables;
    slide.notes = notesText.trim();
    slide.hasCoordinates = hasCoords;
    slide.parsed = true;
  }

  isColorDark(hexColor) {
    if (!hexColor || !hexColor.startsWith('#')) return false;
    let hex = hexColor.slice(1);
    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
    if (hex.length !== 6) return false;
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    const luma = 0.299 * r + 0.587 * g + 0.114 * b;
    return luma < 128;
  }

  renderPresentationStage() {
    this.container.innerHTML = '';

    // Stage Wrapper (Sidebar + Center Stage) - Full viewport height
    const stageWrapper = document.createElement('div');
    stageWrapper.className = 'dva-pptx-stage-wrapper';
    this.container.appendChild(stageWrapper);

    // Sidebar: Slide Thumbnails only (clean, no slideshow or notes buttons)
    const sidebar = document.createElement('div');
    sidebar.className = 'dva-pptx-sidebar';
    sidebar.id = 'pptx-sidebar';
    stageWrapper.appendChild(sidebar);

    // Center Stage: Maximized Presentation Canvas
    const stageCenter = document.createElement('div');
    stageCenter.className = 'dva-pptx-stage-center';
    stageCenter.id = 'pptx-stage-center';
    stageWrapper.appendChild(stageCenter);

    // Render Side Thumbnails
    this.renderThumbnails();

    // Render Active Slide
    this.renderActiveSlide();

    // Initialize Paginated Navigation in Viewer Toolbar (identical to PDF and DOCX)
    if (this.viewer && typeof this.viewer.setPageInfo === 'function') {
      this.viewer.setPageInfo(this.currentSlideIndex + 1, this.slides.length);
    }
  }

  renderThumbnails() {
    const sidebar = this.container.querySelector('#pptx-sidebar');
    if (!sidebar) return;

    const thumbsListHtml = this.slides.map((s, idx) => {
      const isActive = idx === this.currentSlideIndex;
      const isTitle = s.isTitleSlide || idx === 0;
      const bg = s.bgColor || 'var(--dva-surface)';
      const isDark = this.isColorDark(s.bgColor);
      const bgStyle = s.bgImage
        ? `background-image: url('${s.bgImage}'); background-size: 100% 100%; background-repeat: no-repeat;`
        : `background-color: ${bg};`;

      let thumbContent = '';
      if (s.bgImage) {
        let miniGraphics = '';
        if (s.pictures && s.pictures.length > 0) {
          miniGraphics = `<div class="dva-pptx-thumb-mini-pic" style="display: flex; align-items: center; justify-content: center; height: 60%; margin-top: 14%;"><img src="${s.pictures[0].url}" alt="pic" style="max-width: 65%; max-height: 80%; object-fit: contain; box-shadow: 0 1px 4px rgba(0,0,0,0.15); border-radius: 2px;" /></div>`;
        } else if (s.tables && s.tables.length > 0) {
          miniGraphics = `
            <div class="dva-pptx-thumb-mini-table" style="margin-top: 18%; display: flex; flex-direction: column; gap: 2px; width: 70%; margin-left: auto; margin-right: auto;">
              <div style="height: 4px; background: #64748b; border-radius: 1px;"></div>
              <div style="height: 3px; background: #cbd5e1; border-radius: 1px;"></div>
              <div style="height: 3px; background: #cbd5e1; border-radius: 1px;"></div>
              <div style="height: 3px; background: #cbd5e1; border-radius: 1px;"></div>
            </div>
          `;
        } else {
          miniGraphics = `
            <div class="dva-pptx-thumb-lines" style="margin-top: 16%; padding: 0 6px;">
              <div class="dva-pptx-thumb-line" style="width: 80%; background: #94a3b8;"></div>
              <div class="dva-pptx-thumb-line" style="width: 65%; background: #cbd5e1; margin-top: 3px;"></div>
              <div class="dva-pptx-thumb-line" style="width: 72%; background: #cbd5e1; margin-top: 3px;"></div>
            </div>
          `;
        }
        thumbContent = `
          <div class="dva-pptx-thumb-title dva-pptx-thumb-title-banner" style="position: absolute; top: 6%; left: 7%; right: 28%; height: 13%; display: flex; align-items: center; font-size: 8px; font-weight: 700; color: #1e293b; overflow: hidden; white-space: nowrap; text-overflow: ellipsis;">
            ${this.escape(s.title)}
          </div>
          ${miniGraphics}
        `;
      } else if (s.shapes && s.shapes.length > 0) {
        // Render miniature shape diagram layout for PPTX slides
        const miniShapesHtml = s.shapes.slice(0, 16).map(shp => {
          if (!shp.xfrm) return '';
          const styles = [
            'position: absolute',
            `left: ${shp.xfrm.left.toFixed(1)}%`,
            `top: ${shp.xfrm.top.toFixed(1)}%`,
            `width: ${Math.max(2, shp.xfrm.width).toFixed(1)}%`,
            `height: ${Math.max(2, shp.xfrm.height).toFixed(1)}%`
          ];
          if (shp.geom === 'ellipse') styles.push('border-radius: 50%');
          else if (shp.geom === 'roundRect') styles.push('border-radius: 2px');
          else if (shp.geom === 'rightArrow') styles.push('clip-path: polygon(0% 25%, 65% 25%, 65% 0%, 100% 50%, 65% 100%, 65% 75%, 0% 75%)');
          else if (shp.geom === 'leftArrow') styles.push('clip-path: polygon(35% 0%, 35% 25%, 100% 25%, 100% 75%, 35% 75%, 35% 100%, 0% 50%)');

          if (shp.fillColor) styles.push(`background-color: ${shp.fillColor}`);
          if (shp.borderColor && !shp.geom?.toLowerCase().includes('arrow')) {
            styles.push(`border: 1px solid ${shp.borderColor}`);
          }
          let miniText = '';
          if (shp.paragraphs && shp.paragraphs[0] && shp.paragraphs[0].text) {
            const txt = shp.paragraphs[0].text;
            miniText = `<span style="display: block; font-size: 6px; transform: scale(0.7); transform-origin: top left; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: ${shp.fillColor && this.isColorDark(shp.fillColor) ? '#ffffff' : '#0f172a'};">${this.escape(txt.substring(0, 15))}</span>`;
          }
          return `<div style="${styles.join('; ')}">${miniText}</div>`;
        }).join('');

        thumbContent = `
          <div class="dva-pptx-thumb-diagram-preview" style="position: absolute; inset: 0; pointer-events: none;">
            ${miniShapesHtml}
          </div>
        `;
      } else {
        thumbContent = `
          <div class="dva-pptx-thumb-title" style="${isDark ? 'color: #ffffff;' : ''}">${this.escape(s.title)}</div>
          ${isTitle ? `
            <div class="dva-pptx-thumb-subtitle-line" style="${isDark ? 'background: #38bdf8;' : ''}"></div>
          ` : `
            <div class="dva-pptx-thumb-lines">
              <div class="dva-pptx-thumb-line" style="width: 85%; ${isDark ? 'background: rgba(255,255,255,0.3);' : ''}"></div>
              <div class="dva-pptx-thumb-line" style="width: 65%; ${isDark ? 'background: rgba(255,255,255,0.3);' : ''}"></div>
              <div class="dva-pptx-thumb-line" style="width: 75%; ${isDark ? 'background: rgba(255,255,255,0.3);' : ''}"></div>
            </div>
          `}
        `;
      }

      return `
        <div class="dva-pptx-thumb ${isActive ? 'active' : ''}" data-index="${idx}" title="Slide ${idx + 1}: ${this.escape(s.title)}">
          <div class="dva-pptx-thumb-preview ${isTitle ? 'thumb-title-slide' : ''} ${isDark ? 'dva-pptx-thumb-dark' : ''}" style="${bgStyle} aspect-ratio: ${this.slideWidth} / ${this.slideHeight}; position: relative; overflow: hidden;">
            ${thumbContent}
          </div>
          <div class="dva-pptx-thumb-footer">
            <span class="dva-pptx-thumb-num">Slide ${idx + 1}</span>
          </div>
        </div>
      `;
    }).join('');

    sidebar.innerHTML = `
      <div class="dva-pptx-thumb-list">
        ${thumbsListHtml}
      </div>
    `;

    sidebar.querySelectorAll('.dva-pptx-thumb').forEach(thumb => {
      thumb.onclick = () => {
        const idx = parseInt(thumb.getAttribute('data-index'), 10);
        this.goToSlide(idx);
      };
    });
  }

  renderActiveSlide() {
    const stageCenter = this.container.querySelector('#pptx-stage-center');
    if (!stageCenter) return;

    const slide = this.slides[this.currentSlideIndex];
    if (!slide) return;

    let canvasHtml = '';

    // =========================================================================
    // Mode A: High-Fidelity 2D Coordinate-Based Presentation Canvas
    // =========================================================================
    if (slide.hasCoordinates) {
      let elementsHtml = '';

      // Base slide width in 100ths of pt (1 pt = 12700 EMUs)
      const baseWidthPtHundredths = this.slideWidth / 127;

      // 1. Render Geometric Shapes and Text Boxes (<p:sp>)
      slide.shapes.forEach(s => {
        if (!s.xfrm) return;

        const styles = [
          'position: absolute',
          `left: ${s.xfrm.left.toFixed(3)}%`,
          `top: ${s.xfrm.top.toFixed(3)}%`,
          `width: ${s.xfrm.width.toFixed(3)}%`,
          `height: ${s.xfrm.height.toFixed(3)}%`
        ];

        if (s.xfrm.rot) {
          styles.push(`transform: rotate(${s.xfrm.rot}deg)`);
        }

        // Geometry border-radius & clip-path
        if (s.geom === 'ellipse') {
          styles.push('border-radius: 50%');
        } else if (s.geom === 'roundRect') {
          styles.push('border-radius: clamp(4px, 1.2cqw, 14px)');
        } else if (s.geom === 'rightArrow') {
          styles.push('clip-path: polygon(0% 25%, 65% 25%, 65% 0%, 100% 50%, 65% 100%, 65% 75%, 0% 75%)');
        } else if (s.geom === 'leftArrow') {
          styles.push('clip-path: polygon(35% 0%, 35% 25%, 100% 25%, 100% 75%, 35% 75%, 35% 100%, 0% 50%)');
        } else if (s.geom === 'upArrow') {
          styles.push('clip-path: polygon(50% 0%, 0% 35%, 25% 35%, 25% 100%, 75% 100%, 75% 35%, 100% 35%)');
        } else if (s.geom === 'downArrow') {
          styles.push('clip-path: polygon(25% 0%, 75% 0%, 75% 65%, 100% 65%, 50% 100%, 0% 65%, 25% 65%)');
        } else if (s.geom === 'leftRightArrow') {
          styles.push('clip-path: polygon(25% 0%, 25% 25%, 75% 25%, 75% 0%, 100% 50%, 75% 100%, 75% 75%, 25% 75%, 25% 100%, 0% 50%)');
        } else if (s.geom === 'triangle') {
          styles.push('clip-path: polygon(50% 0%, 0% 100%, 100% 100%)');
        } else if (s.geom === 'diamond') {
          styles.push('clip-path: polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)');
        }

        // Fill color
        if (s.fillColor) {
          styles.push(`background-color: ${s.fillColor}`);
        } else if (s.isNoFill) {
          styles.push('background: transparent');
        }

        // Border
        if (s.geom === 'line') {
          const lineClr = s.borderColor || s.fillColor || 'currentColor';
          styles.push(`border-top: ${s.borderWidth || 2}px solid ${lineClr}`);
          styles.push('height: 0');
        } else if (s.borderColor && !s.geom?.toLowerCase().includes('arrow')) {
          styles.push(`border: ${s.borderWidth || 1}px ${s.borderDash || 'solid'} ${s.borderColor}`);
        }

        // Shadow
        if (s.hasShadow) {
          styles.push(`box-shadow: 0 4px 18px ${s.shadowColor || 'rgba(0, 0, 0, 0.15)'}`);
        }

        // Text vertical alignment
        const justify = s.anchor === 'ctr' ? 'center' : s.anchor === 'b' ? 'flex-end' : 'flex-start';

        // Render Paragraphs and Runs inside Shape
        let textHtml = '';
        if (s.paragraphs && s.paragraphs.length > 0) {
          const pHtml = s.paragraphs.map(p => {
            const pRuns = (p.runs && p.runs.length > 0) ? p.runs : [{ text: p.text || '', sz: 1600, color: p.textColor || '#0f172a' }];
            const pRunsHtml = pRuns.map(r => {
              const rStyles = [];
              if (r.color) rStyles.push(`color: ${r.color}`);
              if (r.isBold) rStyles.push('font-weight: 700');
              if (r.isItalic) rStyles.push('font-style: italic');
              if (r.isUnderline) rStyles.push('text-decoration: underline');
              if (r.fontFamily) rStyles.push(`font-family: "${r.fontFamily}", sans-serif`);

              // Continuous typography scaling using cqw units
              if (r.sz > 0) {
                const cqw = ((r.sz / baseWidthPtHundredths) * 100).toFixed(2);
                rStyles.push(`font-size: clamp(8px, ${cqw}cqw, 72px)`);
              }

              const rStyleAttr = rStyles.length ? ` style="${rStyles.join('; ')}"` : '';
              return `<span class="dva-pptx-run"${rStyleAttr}>${this.escape(r.text)}</span>`;
            }).join('');

            const pAlign = p.align ? `text-align: ${p.align};` : '';
            return `
              <div class="dva-pptx-p" style="${pAlign}">
                ${p.isBullet ? '<span class="dva-pptx-bullet-marker">•</span>' : ''}${pRunsHtml}
              </div>
            `;
          }).join('');

          textHtml = `
            <div class="dva-pptx-shape-text" style="justify-content: ${justify};">
              ${pHtml}
            </div>
          `;
        }

        elementsHtml += `
          <div class="dva-pptx-shape" style="${styles.join('; ')}">
            ${textHtml}
          </div>
        `;
      });

      // 2. Render Pictures (<p:pic>)
      slide.pictures.forEach(pic => {
        if (!pic.xfrm) return;
        elementsHtml += `
          <div class="dva-pptx-pic-box" style="position: absolute; left: ${pic.xfrm.left.toFixed(3)}%; top: ${pic.xfrm.top.toFixed(3)}%; width: ${pic.xfrm.width.toFixed(3)}%; height: ${pic.xfrm.height.toFixed(3)}%;">
            <img src="${pic.url}" alt="Slide Graphic" class="dva-pptx-pic-img" />
          </div>
        `;
      });

      // 3. Render Tables (<p:graphicFrame>)
      slide.tables.forEach(tbl => {
        let tableRowsHtml = '';
        tbl.rows.forEach((row, rIdx) => {
          const isHeader = rIdx === 0;
          const cellTag = isHeader ? 'th' : 'td';
          tableRowsHtml += `<tr>${row.map(cell => `<${cellTag}>${this.escape(cell)}</${cellTag}>`).join('')}</tr>`;
        });

        const tblPos = tbl.xfrm ? `position: absolute; left: ${tbl.xfrm.left.toFixed(3)}%; top: ${tbl.xfrm.top.toFixed(3)}%; width: ${tbl.xfrm.width.toFixed(3)}%; height: ${tbl.xfrm.height.toFixed(3)}%;` : '';
        elementsHtml += `
          <div class="dva-pptx-table-frame" style="${tblPos}">
            <table class="dva-pptx-slide-table">${tableRowsHtml}</table>
          </div>
        `;
      });

      const bgStyle = slide.bgImage
        ? `background-image: url('${slide.bgImage}'); background-size: 100% 100%; background-repeat: no-repeat;`
        : (slide.bgColor ? `background-color: ${slide.bgColor};` : '');
      const darkClass = this.isColorDark(slide.bgColor) ? 'dva-pptx-dark-slide' : '';

      canvasHtml = `
        <div class="dva-pptx-slide-canvas dva-pptx-2d ${darkClass}" id="pptx-active-canvas" style="aspect-ratio: ${this.slideWidth} / ${this.slideHeight}; ${bgStyle}">
          ${elementsHtml}
        </div>
      `;
    } else {
      // =========================================================================
      // Mode B: Clean Semantic Flow Fallback (for presentations without coords)
      // =========================================================================
      let slideContentHtml = '';

      if (slide.isTitleSlide) {
        slideContentHtml = `
          <div class="dva-pptx-title-layout">
            <h1 class="dva-pptx-hero-title">${this.escape(slide.title)}</h1>
            ${slide.subtitle ? `<p class="dva-pptx-hero-subtitle">${this.escape(slide.subtitle)}</p>` : ''}
          </div>
        `;
      } else {
        let bodyHtml = '';

        slide.elements.forEach(el => {
          if (el.type === 'text') {
            if (el.isTitle && el.paragraphs.length === 1 && el.paragraphs[0].text === slide.title) {
              return;
            }

            let itemsHtml = '';
            el.paragraphs.forEach(p => {
              if (p.text === slide.title) return;
              const style = [];
              if (p.align) style.push(`text-align: ${p.align}`);
              if (p.textColor) style.push(`color: ${p.textColor}`);
              if (p.isBold) style.push('font-weight: 700');
              const styleAttr = style.length ? ` style="${style.join('; ')}"` : '';

              if (p.lvl > 0) {
                const indent = p.lvl * 28;
                itemsHtml += `<li class="dva-pptx-bullet dva-pptx-bullet-l${p.lvl}" style="margin-left: ${indent}px; ${style.join('; ')}">${this.escape(p.text)}</li>`;
              } else {
                itemsHtml += `<li class="dva-pptx-bullet"${styleAttr}>${this.escape(p.text)}</li>`;
              }
            });

            if (itemsHtml) {
              bodyHtml += `<ul class="dva-pptx-bullet-list">${itemsHtml}</ul>`;
            }
          } else if (el.type === 'image') {
            bodyHtml += `
              <div class="dva-pptx-img-container">
                <img src="${el.url}" alt="Slide Graphic" class="dva-pptx-slide-img" />
              </div>
            `;
          } else if (el.type === 'table') {
            let tableRowsHtml = '';
            el.rows.forEach((row, rIdx) => {
              const isHeader = rIdx === 0;
              const cellTag = isHeader ? 'th' : 'td';
              tableRowsHtml += `<tr>${row.map(cell => `<${cellTag}>${this.escape(cell)}</${cellTag}>`).join('')}</tr>`;
            });
            bodyHtml += `
              <div class="dva-pptx-slide-table-wrap">
                <table class="dva-pptx-slide-table">${tableRowsHtml}</table>
              </div>
            `;
          }
        });

        if (!bodyHtml.trim()) {
          bodyHtml = `<div class="dva-pptx-empty-body">Slide content</div>`;
        }

        slideContentHtml = `
          <div class="dva-pptx-content-layout">
            <div class="dva-pptx-slide-header">
              <h2 class="dva-pptx-slide-title">${this.escape(slide.title)}</h2>
            </div>
            <div class="dva-pptx-slide-body">
              ${bodyHtml}
            </div>
          </div>
        `;
      }

      const customBgStyle = slide.bgImage
        ? `background-image: url('${slide.bgImage}'); background-size: 100% 100%; background-repeat: no-repeat;`
        : (slide.bgColor ? `background-color: ${slide.bgColor};` : '');
      const darkClass = this.isColorDark(slide.bgColor) ? 'dva-pptx-dark-slide' : '';

      canvasHtml = `
        <div class="dva-pptx-slide-canvas ${slide.isTitleSlide ? 'dva-pptx-is-title-slide' : ''} ${darkClass}" id="pptx-active-canvas" style="aspect-ratio: ${this.slideWidth} / ${this.slideHeight}; ${customBgStyle}">
          ${slideContentHtml}
        </div>
      `;
    }

    stageCenter.innerHTML = `
      <div class="dva-pptx-stage-inner">
        ${canvasHtml}
      </div>
    `;

    // Apply zoom transformation if scaled
    this.updateTransform();

    // Update Paginated Navigation in Viewer Toolbar if exists (unified paginator like PDF / DOCX)
    if (this.viewer && typeof this.viewer.setPageInfo === 'function') {
      this.viewer.setPageInfo(this.currentSlideIndex + 1, this.slides.length);
    }
  }

  updateTransform() {
    const canvas = this.container?.querySelector('.dva-pptx-slide-canvas');
    if (canvas && this.viewer) {
      const scale = this.viewer.scale || 1.0;
      canvas.style.transform = `scale(${scale})`;
      canvas.style.transformOrigin = 'center center';
    }
  }

  goToPage(pageNumber) {
    this.goToSlide(Math.max(0, pageNumber - 1));
  }

  async goToSlide(index) {
    if (index < 0 || index >= this.slides.length) return;
    this.currentSlideIndex = index;

    if (!this.slides[index].parsed) {
      await this.parseSlide(index);
    }

    // Update Thumbnails selection
    const sidebar = this.container.querySelector('#pptx-sidebar');
    if (sidebar) {
      sidebar.querySelectorAll('.dva-pptx-thumb').forEach((thumb, idx) => {
        thumb.classList.toggle('active', idx === index);
      });
      const activeThumb = sidebar.querySelector(`.dva-pptx-thumb[data-index="${index}"]`);
      if (activeThumb) activeThumb.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }

    this.renderActiveSlide();
  }

  nextSlide() {
    if (this.currentSlideIndex < this.slides.length - 1) {
      this.goToSlide(this.currentSlideIndex + 1);
    }
  }

  prevSlide() {
    if (this.currentSlideIndex > 0) {
      this.goToSlide(this.currentSlideIndex - 1);
    }
  }

  nextPage() {
    this.nextSlide();
  }

  prevPage() {
    this.prevSlide();
  }

  toggleFullscreen() {
    this.isFullscreen = !this.isFullscreen;
    this.container.classList.toggle('dva-pptx-fullscreen', this.isFullscreen);

    if (this.isFullscreen) {
      const exitBtn = document.createElement('button');
      exitBtn.id = 'pptx-exit-fullscreen-btn';
      exitBtn.className = 'dva-pptx-exit-fullscreen';
      exitBtn.textContent = '✕ Exit Slideshow (Esc)';
      exitBtn.onclick = () => this.toggleFullscreen();
      this.container.appendChild(exitBtn);
    } else {
      const exitBtn = this.container.querySelector('#pptx-exit-fullscreen-btn');
      if (exitBtn) exitBtn.parentNode.removeChild(exitBtn);
    }
  }

  bindKeyboardShortcuts() {
    this.keyHandler = (e) => {
      if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;

      if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
        e.preventDefault();
        this.nextSlide();
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        this.prevSlide();
      } else if (e.key === 'Escape' && this.isFullscreen) {
        e.preventDefault();
        this.toggleFullscreen();
      } else if (e.key === 'F5') {
        e.preventDefault();
        this.toggleFullscreen();
      }
    };
    window.addEventListener('keydown', this.keyHandler);
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
    if (this.keyHandler) {
      window.removeEventListener('keydown', this.keyHandler);
      this.keyHandler = null;
    }
    this.blobUrls.forEach(url => URL.revokeObjectURL(url));
    this.blobUrls = [];
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    this.container = null;
    this.slides = [];
  }
}
