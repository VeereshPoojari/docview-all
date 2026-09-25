import { ZipReader } from '../utils/zipReader.js';

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

  parseShapeProps(spPr) {
    if (!spPr) return { geom: 'rect', fillColor: '', borderColor: '', borderWidth: 0, hasShadow: false };

    const geomNode = getNodes(spPr, 'prstGeom')[0];
    const geom = geomNode ? (geomNode.getAttribute('prst') || 'rect') : 'rect';

    let fillColor = '';
    const isNoFill = getNodes(spPr, 'noFill').length > 0;
    if (!isNoFill) {
      const solidFill = getNodes(spPr, 'solidFill')[0];
      if (solidFill) {
        fillColor = this.resolveColor(solidFill);
      }
    }

    let borderColor = '';
    let borderWidth = 0;
    let borderDash = '';
    const lnNode = getNodes(spPr, 'ln')[0];
    if (lnNode) {
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

    let hasShadow = false;
    let shadowColor = '';
    const outerShdw = getNodes(spPr, 'outerShdw')[0];
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

  parseTextBody(txBody) {
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

        runs.push({ text, isBold, isItalic, isUnderline, sz, color, fontFamily });
      }

      if (runs.length === 0) {
        const directT = getNodes(p, 't')[0];
        if (directT && directT.textContent) {
          pFullText = directT.textContent;
          runs.push({ text: pFullText, isBold: false, isItalic: false, isUnderline: false, sz: 0, color: '', fontFamily: '' });
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

    // 3. Parse Shapes (<p:sp>)
    const spNodes = getNodes(doc, 'sp');
    for (let i = 0; i < spNodes.length; i++) {
      const sp = spNodes[i];
      const spPr = getNodes(sp, 'spPr')[0];
      const xfrm = this.parseTransform(spPr);
      if (xfrm) hasCoords = true;

      const props = this.parseShapeProps(spPr);
      const txBody = getNodes(sp, 'txBody')[0];
      const textData = this.parseTextBody(txBody);

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
      return `
        <div class="dva-pptx-thumb ${isActive ? 'active' : ''}" data-index="${idx}" title="Slide ${idx + 1}: ${this.escape(s.title)}">
          <div class="dva-pptx-thumb-preview ${isTitle ? 'thumb-title-slide' : ''} ${isDark ? 'dva-pptx-thumb-dark' : ''}" style="background-color: ${bg}; aspect-ratio: ${this.slideWidth} / ${this.slideHeight};">
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

        // Geometry border-radius
        if (s.geom === 'ellipse') {
          styles.push('border-radius: 50%');
        } else if (s.geom === 'roundRect') {
          styles.push('border-radius: clamp(4px, 1.2cqw, 14px)');
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
        } else if (s.borderColor) {
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
            const pRunsHtml = p.runs.map(r => {
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

      const bgStyle = slide.bgColor ? `background-color: ${slide.bgColor};` : '';
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

      const customBgStyle = slide.bgColor ? `background-color: ${slide.bgColor};` : '';
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
