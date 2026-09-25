/**
 * Dual High-Fidelity & Vector Engine for Draw.io (.drawio / .dio / .io)
 * Features:
 * - 🎨 Official Diagrams.net Interactive Viewer: Renders 100% exact authentic shapes,
 *   connectors, multi-page diagrams, custom stencils, icons, layers, and pan/zoom.
 * - ⚡ Native Vector SVG Mode: Lightweight zero-dependency SVG renderer with zoom/pan controls.
 * - 📋 XML Code Inspector: Formatted syntax-highlighted XML with 1-click Copy XML.
 */

async function decompressDrawioData(b64Text) {
  try {
    const raw = atob(b64Text.trim());
    const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) {
      bytes[i] = raw.charCodeAt(i);
    }
    const ds = new DecompressionStream('deflate-raw');
    const writer = ds.writable.getWriter();
    writer.write(bytes);
    writer.close();
    const response = new Response(ds.readable);
    const decompressed = await response.text();
    return decodeURIComponent(decompressed);
  } catch {
    try {
      return decodeURIComponent(atob(b64Text.trim()));
    } catch {
      return b64Text;
    }
  }
}

function parseStyleString(styleStr) {
  const styles = {};
  if (!styleStr) return styles;
  const parts = styleStr.split(';');
  parts.forEach(p => {
    const [k, v] = p.split('=');
    if (k && k.trim()) {
      styles[k.trim()] = v ? v.trim() : true;
    }
  });
  return styles;
}

function highlightXml(xmlString) {
  if (!xmlString) return '';
  return xmlString
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/(&lt;\/?)([\w:-]+)/g, '$1<span style="color:#60a5fa;font-weight:600;">$2</span>')
    .replace(/([\w:-]+)=(&quot;|"|')([^"']*)(&quot;|"|')/g, '<span style="color:#fbbf24;">$1</span>=<span style="color:#34d399;">"$3"</span>')
    .replace(/(&lt;!--[\s\S]*?--&gt;)/g, '<span style="color:#6b7280;font-style:italic;">$1</span>');
}

export class DiagramEngine {
  constructor(viewer) {
    this.viewer = viewer;
    this.container = null;
    this.iframeArea = null;
    this.svgArea = null;
    this.xmlArea = null;
    this.rawXml = '';
    this.uncompressedXml = '';
    this.zoom = 1.0;
    this.currentView = 'official'; // 'official' | 'svg' | 'xml'
    this.messageListener = null;
  }

  async render(fileInput, viewport) {
    this.container = document.createElement('div');
    this.container.className = 'dva-diagram-container';
    viewport.appendChild(this.container);

    // 1. Read input as text
    if (typeof fileInput === 'string') {
      if (fileInput.trim().startsWith('<')) {
        this.rawXml = fileInput;
      } else {
        try {
          const res = await fetch(fileInput);
          this.rawXml = await res.text();
        } catch {
          this.rawXml = '<mxfile><diagram>Unable to load remote diagram</diagram></mxfile>';
        }
      }
    } else if (fileInput instanceof Blob || fileInput instanceof File) {
      this.rawXml = await fileInput.text();
    }

    // 2. Check for compressed <diagram>...</diagram>
    this.uncompressedXml = this.rawXml;
    const diagramMatch = this.rawXml.match(/<diagram[^>]*>([\s\S]*?)<\/diagram>/i);
    if (diagramMatch && diagramMatch[1] && !diagramMatch[1].includes('<mxGraphModel')) {
      const decompressed = await decompressDrawioData(diagramMatch[1]);
      if (decompressed && decompressed.includes('<mxGraphModel')) {
        this.uncompressedXml = decompressed;
      }
    }

    // 3. Parse XML nodes and edges for local SVG rendering
    const parser = new DOMParser();
    const doc = parser.parseFromString(this.uncompressedXml, 'application/xml');

    const vertices = [];
    const edges = [];
    const cellMap = new Map();

    const cells = doc.querySelectorAll('mxCell');
    cells.forEach(cell => {
      const id = cell.getAttribute('id');
      const val = cell.getAttribute('value') || '';
      const style = parseStyleString(cell.getAttribute('style') || '');
      const isVertex = cell.getAttribute('vertex') === '1';
      const isEdge = cell.getAttribute('edge') === '1';

      const geo = cell.querySelector('mxGeometry');
      const x = geo ? parseFloat(geo.getAttribute('x') || '0') : 0;
      const y = geo ? parseFloat(geo.getAttribute('y') || '0') : 0;
      const width = geo ? parseFloat(geo.getAttribute('width') || '120') : 120;
      const height = geo ? parseFloat(geo.getAttribute('height') || '60') : 60;

      const cellData = { id, value: val, style, x, y, width, height, isVertex, isEdge };
      if (id) cellMap.set(id, cellData);

      if (isVertex && (width > 0 && height > 0)) {
        vertices.push(cellData);
      } else if (isEdge) {
        const source = cell.getAttribute('source');
        const target = cell.getAttribute('target');
        edges.push({ ...cellData, source, target });
      }
    });

    // 4. Render Layout & Top Sub-Bar
    this.container.innerHTML = `
      <div class="dva-diagram-header">
        <div class="dva-diagram-header-left">
          <span class="dva-diagram-badge">📐 DRAW.IO</span>
          <span class="dva-manifest-chip">📊 ${vertices.length} Shapes</span>
          <span class="dva-manifest-chip">🔗 ${edges.length} Connectors</span>
        </div>
        <div class="dva-diagram-header-right">
          <div class="dva-diagram-zoom-controls" id="dva-diagram-zoom-controls" style="display: none;">
            <button class="dva-stream-btn" id="dva-btn-diag-zoomout" title="Zoom Out">-</button>
            <span class="dva-zoom-text" id="dva-diag-zoom-level" style="font-size: 12px; min-width: 48px;">100%</span>
            <button class="dva-stream-btn" id="dva-btn-diag-zoomin" title="Zoom In">+</button>
            <button class="dva-stream-btn" id="dva-btn-diag-reset" title="Fit to Screen">Fit</button>
          </div>
          <div class="dva-stream-nav">
            <button class="dva-stream-btn active" id="dva-btn-diag-official" title="Exact Draw.io Rendering with all shapes & layers">🎨 Official Viewer</button>
            <button class="dva-stream-btn" id="dva-btn-diag-svg" title="Fast local vector SVG rendering">⚡ Vector SVG</button>
            <button class="dva-stream-btn" id="dva-btn-diag-xml" title="View XML markup">📋 XML Code</button>
          </div>
          <button class="dva-stream-btn" id="dva-btn-copy-diag-xml" title="Copy XML to clipboard">📋 Copy XML</button>
        </div>
      </div>
      
      <!-- 1. Official Diagrams.net Viewer (100% Exact Shapes & Routing) -->
      <div class="dva-diagram-iframe-wrap" id="dva-diagram-iframe-wrap" style="width: 100%; height: calc(100% - 44px); position: relative; background: #ffffff;">
        <iframe 
          id="dva-diagram-iframe" 
          class="dva-diagram-iframe"
          src="https://embed.diagrams.net/?embed=1&ui=min&proto=json&chrome=0&spin=1" 
          style="width: 100%; height: 100%; border: none; background: #ffffff; display: block;"
          allow="fullscreen"
        ></iframe>
      </div>

      <!-- 2. Local Vector SVG Canvas Wrap -->
      <div class="dva-diagram-canvas-wrap" id="dva-diagram-canvas-wrap" style="display: none; height: calc(100% - 44px);">
        <div class="dva-diagram-stage" id="dva-diagram-stage"></div>
      </div>

      <!-- 3. Raw XML Inspector -->
      <div class="dva-diagram-xml-wrap" id="dva-diagram-xml-wrap" style="display: none; height: calc(100% - 44px);">
        <pre class="dva-manifest-code" id="dva-diag-code">${highlightXml(this.uncompressedXml)}</pre>
      </div>
    `;

    this.iframeArea = this.container.querySelector('#dva-diagram-iframe-wrap');
    this.svgArea = this.container.querySelector('#dva-diagram-canvas-wrap');
    this.xmlArea = this.container.querySelector('#dva-diagram-xml-wrap');
    const stage = this.container.querySelector('#dva-diagram-stage');

    // 5. Render Local SVG Diagram into stage as instant fallback
    this.renderSvgDiagram(stage, vertices, edges, cellMap);

    // 6. Connect Official Diagrams.net Viewer postMessage
    this.initOfficialViewer();

    // 7. Bind Events
    this.bindEvents();
  }

  initOfficialViewer() {
    const iframe = this.container.querySelector('#dva-diagram-iframe');
    if (!iframe) return;

    const xmlPayload = this.rawXml;

    const sendXml = () => {
      try {
        if (iframe.contentWindow) {
          iframe.contentWindow.postMessage(JSON.stringify({
            action: 'load',
            xml: xmlPayload,
            autosave: 0
          }), '*');
        }
      } catch (e) {
        console.warn('[DiagramEngine] Error sending XML to iframe:', e);
      }
    };

    this.messageListener = (evt) => {
      if (evt.origin && (evt.origin.includes('diagrams.net') || evt.origin.includes('draw.io'))) {
        try {
          const msg = typeof evt.data === 'string' ? JSON.parse(evt.data) : evt.data;
          if (msg && (msg.event === 'init' || msg.event === 'load' || msg.event === 'configure')) {
            sendXml();
          }
        } catch {}
      }
    };
    window.addEventListener('message', this.messageListener);

    iframe.onload = () => {
      setTimeout(sendXml, 300);
      setTimeout(sendXml, 800);
      setTimeout(sendXml, 1500);
    };
  }

  bindEvents() {
    const btnOfficial = this.container.querySelector('#dva-btn-diag-official');
    const btnSvg = this.container.querySelector('#dva-btn-diag-svg');
    const btnXml = this.container.querySelector('#dva-btn-diag-xml');
    const zoomControls = this.container.querySelector('#dva-diagram-zoom-controls');
    const btnCopyXml = this.container.querySelector('#dva-btn-copy-diag-xml');

    if (btnOfficial && btnSvg && btnXml) {
      btnOfficial.onclick = () => {
        this.currentView = 'official';
        btnOfficial.classList.add('active');
        btnSvg.classList.remove('active');
        btnXml.classList.remove('active');
        if (this.iframeArea) this.iframeArea.style.display = 'block';
        if (this.svgArea) this.svgArea.style.display = 'none';
        if (this.xmlArea) this.xmlArea.style.display = 'none';
        if (zoomControls) zoomControls.style.display = 'none';
      };

      btnSvg.onclick = () => {
        this.currentView = 'svg';
        btnSvg.classList.add('active');
        btnOfficial.classList.remove('active');
        btnXml.classList.remove('active');
        if (this.iframeArea) this.iframeArea.style.display = 'none';
        if (this.svgArea) this.svgArea.style.display = 'flex';
        if (this.xmlArea) this.xmlArea.style.display = 'none';
        if (zoomControls) zoomControls.style.display = 'flex';
      };

      btnXml.onclick = () => {
        this.currentView = 'xml';
        btnXml.classList.add('active');
        btnOfficial.classList.remove('active');
        btnSvg.classList.remove('active');
        if (this.iframeArea) this.iframeArea.style.display = 'none';
        if (this.svgArea) this.svgArea.style.display = 'none';
        if (this.xmlArea) this.xmlArea.style.display = 'block';
        if (zoomControls) zoomControls.style.display = 'none';
      };
    }

    if (btnCopyXml) {
      btnCopyXml.onclick = () => {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(this.uncompressedXml).then(() => {
            const original = btnCopyXml.textContent;
            btnCopyXml.textContent = '✓ Copied!';
            setTimeout(() => { btnCopyXml.textContent = original; }, 2000);
          });
        }
      };
    }

    // Zoom controls for local SVG view
    const btnZoomIn = this.container.querySelector('#dva-btn-diag-zoomin');
    const btnZoomOut = this.container.querySelector('#dva-btn-diag-zoomout');
    const btnReset = this.container.querySelector('#dva-btn-diag-reset');
    const stage = this.container.querySelector('#dva-diagram-stage');
    const zoomText = this.container.querySelector('#dva-diag-zoom-level');

    const updateZoom = (z) => {
      this.zoom = Math.max(0.2, Math.min(3.0, z));
      if (stage) stage.style.transform = `scale(${this.zoom})`;
      if (zoomText) zoomText.textContent = `${Math.round(this.zoom * 100)}%`;
    };

    if (btnZoomIn) btnZoomIn.onclick = () => updateZoom(this.zoom + 0.15);
    if (btnZoomOut) btnZoomOut.onclick = () => updateZoom(this.zoom - 0.15);
    if (btnReset) btnReset.onclick = () => updateZoom(1.0);
  }

  renderSvgDiagram(stage, vertices, edges, cellMap) {
    if (vertices.length === 0) {
      stage.innerHTML = `
        <div style="padding: 40px; text-align: center; color: var(--dva-text-muted);">
          <div style="font-size: 32px; margin-bottom: 12px;">📐</div>
          <div style="font-size: 15px; font-weight: 600; color: var(--dva-text);">No visual shapes found in this diagram page.</div>
          <div style="font-size: 13px; margin-top: 6px;">Switch to the "Official Viewer" or "XML Code" tab.</div>
        </div>
      `;
      return;
    }

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    vertices.forEach(v => {
      minX = Math.min(minX, v.x);
      minY = Math.min(minY, v.y);
      maxX = Math.max(maxX, v.x + v.width);
      maxY = Math.max(maxY, v.y + v.height);
    });

    const pad = 60;
    const viewW = Math.max(400, (maxX - minX) + pad * 2);
    const viewH = Math.max(300, (maxY - minY) + pad * 2);
    const originX = minX - pad;
    const originY = minY - pad;

    let svgHtml = `
      <svg 
        class="dva-diagram-svg" 
        id="dva-diagram-svg"
        viewBox="${originX} ${originY} ${viewW} ${viewH}" 
        width="${viewW}" 
        height="${viewH}"
        style="max-width: 100%; height: auto; display: block; margin: 0 auto; filter: drop-shadow(0 12px 24px rgba(0,0,0,0.15));"
      >
        <defs>
          <pattern id="diag-grid" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(255,255,255,0.04)" stroke-width="1"/>
          </pattern>
          <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 1 L 10 5 L 0 9 z" fill="#3b82f6" />
          </marker>
        </defs>
        <rect x="${originX}" y="${originY}" width="${viewW}" height="${viewH}" fill="url(#diag-grid)" />
    `;

    // Edges
    edges.forEach(e => {
      const source = cellMap.get(e.source);
      const target = cellMap.get(e.target);
      if (source && target) {
        const x1 = source.x + source.width / 2;
        const y1 = source.y + source.height / 2;
        const x2 = target.x + target.width / 2;
        const y2 = target.y + target.height / 2;

        const strokeColor = e.style.strokeColor || '#64748b';
        const strokeWidth = e.style.strokeWidth || '2';

        svgHtml += `
          <line 
            x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" 
            stroke="${strokeColor}" 
            stroke-width="${strokeWidth}" 
            marker-end="url(#arrow)"
          />
        `;

        if (e.value) {
          const mx = (x1 + x2) / 2;
          const my = (y1 + y2) / 2 - 8;
          svgHtml += `
            <text 
              x="${mx}" y="${my}" 
              text-anchor="middle" 
              fill="${e.style.fontColor || '#94a3b8'}" 
              font-size="11.5" 
              font-family="-apple-system, BlinkMacSystemFont, sans-serif"
              font-weight="600"
            >${this.escape(e.value)}</text>
          `;
        }
      }
    });

    // Vertices / Nodes
    vertices.forEach(v => {
      const fill = v.style.fillColor || 'var(--dva-surface, #1e293b)';
      const stroke = v.style.strokeColor || 'var(--dva-border, #334155)';
      const strokeWidth = v.style.strokeWidth || '1.5';
      const rx = v.style.rounded === '1' || v.style.rounded === true ? 10 : 4;
      const fontColor = v.style.fontColor || '#f8fafc';
      const fontSize = v.style.fontSize || 12;

      svgHtml += `
        <rect 
          x="${v.x}" y="${v.y}" width="${v.width}" height="${v.height}" 
          rx="${rx}" ry="${rx}"
          fill="${fill}" 
          stroke="${stroke}" 
          stroke-width="${strokeWidth}"
        />
      `;

      if (v.value) {
        const lines = v.value.split(/&#xa;|\n|<br\s*\/?>/i);
        const startY = v.y + (v.height / 2) - ((lines.length - 1) * (fontSize * 1.3) / 2);
        lines.forEach((lineText, idx) => {
          const ly = startY + idx * (fontSize * 1.3);
          const cleanText = lineText.replace(/<[^>]+>/g, '').trim();
          svgHtml += `
            <text 
              x="${v.x + v.width / 2}" 
              y="${ly}" 
              text-anchor="middle" 
              dominant-baseline="central"
              fill="${fontColor}" 
              font-size="${fontSize}" 
              font-family="-apple-system, BlinkMacSystemFont, sans-serif"
              font-weight="${idx === 0 ? '700' : '500'}"
            >${this.escape(cleanText)}</text>
          `;
        });
      }
    });

    svgHtml += '</svg>';
    stage.innerHTML = svgHtml;
  }

  escape(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  destroy() {
    if (this.messageListener) {
      window.removeEventListener('message', this.messageListener);
      this.messageListener = null;
    }
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    this.container = null;
  }
}
