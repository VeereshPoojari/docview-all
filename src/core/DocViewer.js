import { detectFormat, FORMAT_TYPES } from '../utils/mimeDetector.js';
import { Toolbar } from './Toolbar.js';
import { ImageEngine } from '../engines/imageEngine.js';
import { VideoEngine } from '../engines/videoEngine.js';
import { CsvEngine } from '../engines/csvEngine.js';
import { XlsxEngine } from '../engines/xlsxEngine.js';
import { CodeEngine } from '../engines/codeEngine.js';
import { JsonEngine } from '../engines/jsonEngine.js';
import { MarkdownEngine } from '../engines/markdownEngine.js';
import { PdfEngine } from '../engines/pdfEngine.js';
import { DocxEngine } from '../engines/docxEngine.js';
import { TextEngine } from '../engines/textEngine.js';
import { AudioEngine } from '../engines/audioEngine.js';
import { DiagramEngine } from '../engines/diagramEngine.js';
import { YamlEngine } from '../engines/yamlEngine.js';
import { XmlEngine } from '../engines/xmlEngine.js';
import { PptxEngine } from '../engines/pptxEngine.js';
import { FallbackEngine } from '../engines/fallbackEngine.js';

export class DocViewer {
  constructor(target, options = {}) {
    this.target = typeof target === 'string' ? document.querySelector(target) : target;
    if (!this.target) {
      throw new Error(`[DocViewAll] Target element not found: ${target}`);
    }

    this.options = options;
    this.file = options.file || null;
    this.theme = options.theme || 'light';
    this.scale = 1.0;
    this.rotation = 0;
    this.isFullscreen = false;
    this.currentPage = 1;
    this.totalPages = 1;

    this.currentFileInfo = null;
    this.activeEngine = null;
    this.toolbar = null;
    this.root = null;
    this.viewport = null;
    this.toastContainer = null;
    this.loaderOverlay = null;
    this._progressInterval = null;

    this.init();
    this.bindKeyboardShortcuts();
    if (this.file) {
      this.loadFile(this.file);
    } else {
      this.renderEmptyState();
    }
  }

  init() {
    this.target.innerHTML = '';

    this.root = document.createElement('div');
    this.root.className = 'dva-root';
    this.root.setAttribute('data-theme', this.theme);

    // Render Toolbar immediately if enabled (supports boolean or granular config object)
    const toolbarOpt = this.options.toolbar !== undefined ? this.options.toolbar : this.options.showToolbar;
    if (toolbarOpt !== false && (typeof toolbarOpt !== 'object' || toolbarOpt.enabled !== false)) {
      this.toolbar = new Toolbar(this, toolbarOpt);
      this.root.appendChild(this.toolbar.getElement());
    }

    this.viewport = document.createElement('div');
    this.viewport.className = 'dva-viewport';
    this.root.appendChild(this.viewport);

    // Toast Notification Layer
    this.toastContainer = document.createElement('div');
    this.toastContainer.className = 'dva-toast-container';
    this.root.appendChild(this.toastContainer);

    this.target.appendChild(this.root);
  }

  openFileDialog() {
    const input = document.createElement('input');
    input.type = 'file';
    input.style.display = 'none';
    input.onchange = (e) => {
      if (e.target.files && e.target.files[0]) {
        this.loadFile(e.target.files[0]);
      }
    };
    document.body.appendChild(input);
    input.click();
    setTimeout(() => {
      if (input.parentNode) input.parentNode.removeChild(input);
    }, 1000);
  }

  getPresetBadgeStyle(label) {
    const l = (label || '').toLowerCase();
    if (l.includes('dash') || l.includes('mpd')) {
      return 'background: rgba(6, 182, 212, 0.14); border: 1px solid rgba(6, 182, 212, 0.35); color: #0891b2; font-size: 11.5px; font-weight: 600; padding: 4px 11px; border-radius: 6px; cursor: pointer; transition: transform 0.15s ease;';
    }
    if (l.includes('hls') || l.includes('m3u8')) {
      return 'background: rgba(245, 158, 11, 0.14); border: 1px solid rgba(245, 158, 11, 0.35); color: #d97706; font-size: 11.5px; font-weight: 600; padding: 4px 11px; border-radius: 6px; cursor: pointer; transition: transform 0.15s ease;';
    }
    if (l.includes('mp3') || l.includes('audio')) {
      return 'background: rgba(16, 185, 129, 0.14); border: 1px solid rgba(16, 185, 129, 0.35); color: #059669; font-size: 11.5px; font-weight: 600; padding: 4px 11px; border-radius: 6px; cursor: pointer; transition: transform 0.15s ease;';
    }
    if (l.includes('diagram') || l.includes('drawio')) {
      return 'background: rgba(124, 58, 237, 0.14); border: 1px solid rgba(124, 58, 237, 0.35); color: #7c3aed; font-size: 11.5px; font-weight: 600; padding: 4px 11px; border-radius: 6px; cursor: pointer; transition: transform 0.15s ease;';
    }
    if (l.includes('yaml') || l.includes('yml')) {
      return 'background: rgba(14, 165, 233, 0.14); border: 1px solid rgba(14, 165, 233, 0.35); color: #0284c7; font-size: 11.5px; font-weight: 600; padding: 4px 11px; border-radius: 6px; cursor: pointer; transition: transform 0.15s ease;';
    }
    if (l.includes('xml')) {
      return 'background: rgba(234, 88, 12, 0.14); border: 1px solid rgba(234, 88, 12, 0.35); color: #ea580c; font-size: 11.5px; font-weight: 600; padding: 4px 11px; border-radius: 6px; cursor: pointer; transition: transform 0.15s ease;';
    }
    if (l.includes('ppt') || l.includes('powerpoint')) {
      return 'background: rgba(217, 119, 6, 0.14); border: 1px solid rgba(217, 119, 6, 0.35); color: #d97706; font-size: 11.5px; font-weight: 600; padding: 4px 11px; border-radius: 6px; cursor: pointer; transition: transform 0.15s ease;';
    }
    return 'background: rgba(59, 130, 246, 0.14); border: 1px solid rgba(59, 130, 246, 0.35); color: #2563eb; font-size: 11.5px; font-weight: 600; padding: 4px 11px; border-radius: 6px; cursor: pointer; transition: transform 0.15s ease;';
  }

  renderEmptyState() {
    this.currentFileInfo = { name: 'No document loaded', ext: 'READY' };
    if (this.toolbar) {
      this.toolbar.updateFileInfo(this.currentFileInfo);
    }

    const toolbarOpt = this.options.toolbar !== undefined ? this.options.toolbar : this.options.showToolbar;
    const isBrowseEnabled = toolbarOpt !== false && (typeof toolbarOpt !== 'object' || toolbarOpt.browse !== false);
    const isCloudEnabled = toolbarOpt !== false && (typeof toolbarOpt !== 'object' || toolbarOpt.cloudUrl !== false);
    const presets = (toolbarOpt && typeof toolbarOpt === 'object' && Array.isArray(toolbarOpt.presets)) ? toolbarOpt.presets : [];

    const browseSectionHtml = isBrowseEnabled ? `
      <div style="display: flex; align-items: center; gap: 14px; flex-wrap: wrap; justify-content: center;">
        <button id="dva-empty-browse-btn" class="dva-btn" style="width: auto; height: 42px; padding: 0 24px; gap: 8px; background: #10b981; color: #fff; font-size: 13px; font-weight: 700; border-radius: 21px; cursor: pointer; border: none; box-shadow: 0 4px 14px rgba(16, 185, 129, 0.3); transition: transform 0.15s ease;">
          <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
          Browse Local Document
        </button>
      </div>
    ` : '';

    const cloudSectionHtml = isCloudEnabled ? `
      <div style="display: flex; align-items: center; width: 100%; max-width: 520px; margin: 4px 0;">
        <div style="flex: 1; height: 1px; background: var(--dva-border);"></div>
        <span style="padding: 0 12px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: var(--dva-text-muted); font-weight: 700;">Or Paste Cloud URL</span>
        <div style="flex: 1; height: 1px; background: var(--dva-border);"></div>
      </div>

      <div style="display: flex; gap: 8px; width: 100%; max-width: 520px;">
        <input 
          type="text" 
          id="dva-empty-url-input" 
          class="dva-empty-url-input"
          placeholder="Paste AWS S3, Azure Blob, GCP, or Web URL..." 
        />
        <button id="dva-empty-url-btn" class="dva-empty-url-btn">
          Load
        </button>
      </div>
    ` : '';

    const presetsSectionHtml = presets.length > 0 ? `
      <div style="display: flex; gap: 8px; align-items: center; justify-content: center; flex-wrap: wrap; margin-top: 4px;">
        <span style="font-size: 11.5px; color: var(--dva-text-muted); font-weight: 600;">Quick Demos:</span>
        ${presets.map(p => `
          <button class="dva-empty-demo-btn" data-url="${p.url}" style="${this.getPresetBadgeStyle(p.label)}">${p.label}</button>
        `).join('')}
      </div>
    ` : '';

    this.viewport.innerHTML = `
      <div class="dva-empty-state" style="display: flex; flex-direction: column; align-items: center; justify-content: center; width: 100%; height: 100%; padding: 32px; text-align: center; gap: 16px;">
        <div style="width: 76px; height: 76px; border-radius: 20px; background: rgba(59, 130, 246, 0.12); border: 1px solid rgba(59, 130, 246, 0.25); display: flex; align-items: center; justify-content: center; font-size: 34px; box-shadow: 0 0 20px rgba(59, 130, 246, 0.2);">
          📄
        </div>
        <div>
          <h2 style="font-size: 22px; font-weight: 800; color: var(--dva-text); margin: 0 0 8px; letter-spacing: -0.3px;">Drop any file to view instantly</h2>
          <p style="font-size: 14px; color: var(--dva-text-secondary); margin: 0 auto; max-width: 460px; line-height: 1.6;">
            Drag & drop files from your desktop anywhere onto this screen, or click the button below to browse.
          </p>
        </div>
        ${browseSectionHtml}
        ${cloudSectionHtml}
        ${presetsSectionHtml}
        <div style="margin-top: 6px; display: flex; flex-direction: column; align-items: center; gap: 6px;">
          <span style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.6px; color: var(--dva-text-muted);">Supported Formats</span>
          <div class="dva-format-pill-cloud">
            <span class="dva-format-pill">📄 PDF</span>
            <span class="dva-format-pill">📝 DOCX</span>
            <span class="dva-format-pill">📊 XLSX</span>
            <span class="dva-format-pill">📈 CSV</span>
            <span class="dva-format-pill">📽️ PPTX</span>
            <span class="dva-format-pill">📐 DRAW.IO</span>
            <span class="dva-format-pill">🏷️ XML</span>
            <span class="dva-format-pill">⚙️ YAML</span>
            <span class="dva-format-pill">📦 JSON</span>
            <span class="dva-format-pill">💻 CODE</span>
            <span class="dva-format-pill">🎵 AUDIO</span>
            <span class="dva-format-pill">🎬 VIDEO</span>
            <span class="dva-format-pill">🧱 3D</span>
            <span class="dva-format-pill">🖼️ IMAGES</span>
            <span class="dva-format-pill">📜 TEXT</span>
          </div>
        </div>
      </div>
    `;

    const browseBtn = this.viewport.querySelector('#dva-empty-browse-btn');
    if (browseBtn) {
      browseBtn.onclick = () => this.openFileDialog();
    }

    const emptyUrlInput = this.viewport.querySelector('#dva-empty-url-input');
    const emptyUrlBtn = this.viewport.querySelector('#dva-empty-url-btn');
    const handleEmptyUrl = () => {
      const url = (emptyUrlInput.value || '').trim();
      if (!url) {
        this.notify('Please enter a valid document or media URL', 'warning');
        return;
      }
      this.loadFile(url);
    };

    if (emptyUrlBtn) emptyUrlBtn.onclick = handleEmptyUrl;
    if (emptyUrlInput) {
      emptyUrlInput.onkeydown = (e) => {
        if (e.key === 'Enter') handleEmptyUrl();
      };
    }

    const demoBtns = this.viewport.querySelectorAll('.dva-empty-demo-btn');
    demoBtns.forEach(btn => {
      btn.onclick = () => {
        const url = btn.getAttribute('data-url');
        if (url) {
          if (emptyUrlInput) emptyUrlInput.value = url;
          this.loadFile(url);
        }
      };
    });
  }

  showProgress(percent = 0, statusText = 'Loading document...') {
    if (typeof document === 'undefined' || !this.root) return;

    if (!this.loaderOverlay) {
      this.loaderOverlay = document.createElement('div');
      this.loaderOverlay.className = 'dva-loader-overlay';
      
      const ext = (this.currentFileInfo && this.currentFileInfo.ext ? this.currentFileInfo.ext : 'DOC').toUpperCase();
      const fileName = (this.currentFileInfo && this.currentFileInfo.name) ? this.currentFileInfo.name : 'Document';
      const initialPercent = Math.max(0, Math.min(100, Math.round(percent)));

      this.loaderOverlay.innerHTML = `
        <div class="dva-loader-card">
          <div class="dva-loader-badge-ring">
            <div class="dva-loader-spinner-circle"></div>
            <span class="dva-loader-badge-ext">${ext}</span>
          </div>
          <div class="dva-loader-info">
            <div class="dva-loader-filename" title="${fileName}">${fileName}</div>
            <div class="dva-loader-status">${statusText}</div>
          </div>
          <div class="dva-progress-track">
            <div class="dva-progress-bar-fill" style="width: ${initialPercent}%;"></div>
          </div>
          <div class="dva-loader-footer">
            <span class="dva-progress-label">Preparing view</span>
            <span class="dva-progress-percent">${initialPercent}%</span>
          </div>
        </div>
      `;
      this.root.appendChild(this.loaderOverlay);
    } else {
      this.updateProgress(percent, statusText);
    }
  }

  updateProgress(percent, statusText) {
    if (!this.loaderOverlay) return;
    const clamped = Math.max(0, Math.min(100, Math.round(percent)));
    const fill = this.loaderOverlay.querySelector('.dva-progress-bar-fill');
    const percentEl = this.loaderOverlay.querySelector('.dva-progress-percent');
    const statusEl = this.loaderOverlay.querySelector('.dva-loader-status');
    const extEl = this.loaderOverlay.querySelector('.dva-loader-badge-ext');
    const nameEl = this.loaderOverlay.querySelector('.dva-loader-filename');

    if (this.currentFileInfo) {
      if (extEl && this.currentFileInfo.ext) extEl.textContent = this.currentFileInfo.ext.toUpperCase();
      if (nameEl && this.currentFileInfo.name) {
        nameEl.textContent = this.currentFileInfo.name;
        nameEl.title = this.currentFileInfo.name;
      }
    }

    if (fill) fill.style.width = `${clamped}%`;
    if (percentEl) percentEl.textContent = `${clamped}%`;
    if (statusEl && statusText) statusEl.textContent = statusText;
  }

  hideProgress() {
    if (this._progressInterval) {
      clearInterval(this._progressInterval);
      this._progressInterval = null;
    }
    if (!this.loaderOverlay) return;
    
    // Complete to 100% briefly so user clearly sees full completion
    this.updateProgress(100, 'Ready');
    const overlay = this.loaderOverlay;
    this.loaderOverlay = null;

    setTimeout(() => {
      if (overlay) {
        overlay.classList.add('dva-loader-hidden');
        setTimeout(() => {
          if (overlay.parentNode) {
            overlay.parentNode.removeChild(overlay);
          }
        }, 300);
      }
    }, 220);
  }

  async loadFile(fileInput) {
    this.file = fileInput;
    this.scale = 1.0;
    this.rotation = 0;

    // Detect format
    this.currentFileInfo = detectFormat(fileInput);

    // Initial progress loader with percentage
    const extLabel = (this.currentFileInfo.ext || 'doc').toUpperCase();
    this.showProgress(12, `Initializing ${extLabel} engine...`);

    // Smooth progressive loader ticker
    let simulatedProgress = 12;
    if (this._progressInterval) clearInterval(this._progressInterval);
    this._progressInterval = setInterval(() => {
      if (simulatedProgress < 85) {
        simulatedProgress += Math.floor(Math.random() * 8 + 5);
        if (simulatedProgress > 85) simulatedProgress = 85;
        const msg = simulatedProgress < 35 
          ? 'Reading file stream...' 
          : simulatedProgress < 65 
            ? 'Parsing document structures...' 
            : 'Rendering pages & layout...';
        this.updateProgress(simulatedProgress, msg);
      }
    }, 120);

    // Update Toolbar
    if (this.toolbar) {
      this.toolbar.updateFileInfo(this.currentFileInfo);
      this.toolbar.updateZoom(this.scale);
      this.toolbar.hidePagination();
    }
    this.currentPage = 1;
    this.totalPages = 1;

    // Destroy existing active engine
    if (this.activeEngine && typeof this.activeEngine.destroy === 'function') {
      this.activeEngine.destroy();
    }
    this.viewport.innerHTML = '';

    // Select Engine based on detected format
    switch (this.currentFileInfo.type) {
      case FORMAT_TYPES.IMAGE:
        this.activeEngine = new ImageEngine(this);
        break;
      case FORMAT_TYPES.VIDEO:
        this.activeEngine = new VideoEngine(this);
        break;
      case FORMAT_TYPES.AUDIO:
        this.activeEngine = new AudioEngine(this);
        break;
      case FORMAT_TYPES.SHEET:
        this.activeEngine = new CsvEngine(this);
        break;
      case FORMAT_TYPES.XLSX:
        this.activeEngine = new XlsxEngine(this);
        break;
      case FORMAT_TYPES.CODE:
        this.activeEngine = new CodeEngine(this);
        break;
      case FORMAT_TYPES.JSON:
        this.activeEngine = new JsonEngine(this);
        break;
      case FORMAT_TYPES.YAML:
        this.activeEngine = new YamlEngine(this);
        break;
      case FORMAT_TYPES.XML:
        this.activeEngine = new XmlEngine(this);
        break;
      case FORMAT_TYPES.MARKDOWN:
        this.activeEngine = new MarkdownEngine(this);
        break;
      case FORMAT_TYPES.PDF:
        this.activeEngine = new PdfEngine(this);
        break;
      case FORMAT_TYPES.DOCX:
        this.activeEngine = new DocxEngine(this);
        break;
      case FORMAT_TYPES.PPTX:
        this.activeEngine = new PptxEngine(this);
        break;
      case FORMAT_TYPES.TEXT:
        this.activeEngine = new TextEngine(this);
        break;
      case FORMAT_TYPES.DIAGRAM:
        this.activeEngine = new DiagramEngine(this);
        break;
      default:
        this.activeEngine = new FallbackEngine(this);
        break;
    }

    try {
      await this.activeEngine.render(fileInput, this.viewport);
      this.updateProgress(100, 'Document Ready');
    } catch (err) {
      console.error('[DocViewAll] Error rendering document:', err);
      this.notify(`Failed to load: ${err.message || 'Unknown error'}`, 'error');
    } finally {
      this.hideProgress();
    }

    this.notify(`Opened ${this.currentFileInfo.name} (${(this.currentFileInfo.ext || '').toUpperCase()})`, 'success');

    if (typeof this.options.onLoad === 'function') {
      this.options.onLoad(this.currentFileInfo);
    }
  }

  notify(message, type = 'info', duration = 3000) {
    if (!this.toastContainer) return;

    const toast = document.createElement('div');
    toast.className = `dva-toast dva-toast-${type}`;

    let icon = 'ℹ️';
    if (type === 'success') icon = '✓';
    if (type === 'error') icon = '✕';
    if (type === 'warning') icon = '⚠';

    toast.innerHTML = `
      <span class="dva-toast-icon">${icon}</span>
      <span class="dva-toast-text">${message}</span>
    `;

    this.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('dva-toast-out');
      setTimeout(() => {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 300);
    }, duration);
  }

  zoom(delta) {
    this.scale = Math.max(0.2, Math.min(5.0, this.scale + delta));
    if (this.toolbar) this.toolbar.updateZoom(this.scale);
    if (this.activeEngine && typeof this.activeEngine.updateTransform === 'function') {
      this.activeEngine.updateTransform();
    }
  }

  rotate(degrees = 90) {
    this.rotation = (this.rotation + degrees) % 360;
    if (this.activeEngine && typeof this.activeEngine.updateTransform === 'function') {
      this.activeEngine.updateTransform();
    }
  }

  toggleTheme() {
    this.theme = this.theme === 'dark' ? 'light' : 'dark';
    this.root.setAttribute('data-theme', this.theme);
    if (this.toolbar) this.toolbar.updateTheme(this.theme);
  }

  toggleFullscreen() {
    if (!document.fullscreenElement) {
      this.root.requestFullscreen().catch(() => {
        this.root.classList.toggle('dva-fullscreen');
      });
    } else {
      document.exitFullscreen().catch(() => {});
      this.root.classList.remove('dva-fullscreen');
    }
  }

  download() {
    if (!this.file) return;
    const a = document.createElement('a');
    let href = '';
    if (typeof this.file === 'string') {
      href = this.file;
    } else if (this.file instanceof Blob || this.file instanceof File) {
      href = URL.createObjectURL(this.file);
    }
    a.href = href;
    a.download = (this.currentFileInfo && this.currentFileInfo.name) || 'document';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    this.notify(`Downloading ${(this.currentFileInfo && this.currentFileInfo.name) || 'document'}...`, 'info');
  }

  // --- Page Navigation for Paginated Documents (PDF, DOCX) ---

  setPageInfo(currentPage, totalPages) {
    this.currentPage = Math.max(1, parseInt(currentPage, 10) || 1);
    this.totalPages = Math.max(1, parseInt(totalPages, 10) || 1);
    if (this.toolbar) {
      this.toolbar.updatePagination(this.currentPage, this.totalPages);
    }
  }

  goToPage(pageNumber) {
    const target = Math.max(1, Math.min(this.totalPages, parseInt(pageNumber, 10) || 1));
    this.currentPage = target;
    if (this.toolbar) {
      this.toolbar.updatePagination(this.currentPage, this.totalPages);
    }
    if (this.activeEngine && typeof this.activeEngine.goToPage === 'function') {
      this.activeEngine.goToPage(target);
    }
  }

  nextPage() {
    if (this.currentPage < this.totalPages) {
      this.goToPage(this.currentPage + 1);
    }
  }

  prevPage() {
    if (this.currentPage > 1) {
      this.goToPage(this.currentPage - 1);
    }
  }

  bindKeyboardShortcuts() {
    this.keyHandler = (e) => {
      // Do not intercept if user is typing in an input or textarea
      if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
      if (this.totalPages > 1) {
        if (e.key === 'PageDown' || (e.altKey && e.key === 'ArrowRight')) {
          e.preventDefault();
          this.nextPage();
        } else if (e.key === 'PageUp' || (e.altKey && e.key === 'ArrowLeft')) {
          e.preventDefault();
          this.prevPage();
        }
      }
    };
    window.addEventListener('keydown', this.keyHandler);
  }

  destroy() {
    if (this.keyHandler) {
      window.removeEventListener('keydown', this.keyHandler);
      this.keyHandler = null;
    }
    if (this.activeEngine && typeof this.activeEngine.destroy === 'function') {
      this.activeEngine.destroy();
    }
    if (this.target) {
      this.target.innerHTML = '';
    }
  }

  // --- Static One-Line API (Like Toastify) ---

  static view(target, options = {}) {
    return new DocViewer(target, options);
  }

  static openModal(file, options = {}) {
    const backdrop = document.createElement('div');
    backdrop.className = 'dva-modal-backdrop';

    const modal = document.createElement('div');
    modal.className = 'dva-modal-window';

    const closeBtn = document.createElement('button');
    closeBtn.className = 'dva-modal-close';
    closeBtn.innerHTML = '✕';
    closeBtn.onclick = () => {
      document.body.removeChild(backdrop);
    };

    const container = document.createElement('div');
    container.style.width = '100%';
    container.style.height = '100%';

    modal.appendChild(closeBtn);
    modal.appendChild(container);
    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);

    const viewer = new DocViewer(container, {
      file,
      theme: options.theme || 'dark',
      ...options
    });

    return { viewer, close: () => closeBtn.click() };
  }
}
