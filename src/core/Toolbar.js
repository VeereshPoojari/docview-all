/**
 * Zero-Dependency SVG Icon Repository
 */
export const ICONS = {
  folderOpen: '<svg viewBox="0 0 24 24"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>',
  link: '<svg viewBox="0 0 24 24"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>',
  cloud: '<svg viewBox="0 0 24 24"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"></path></svg>',
  zoomIn: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="11" y1="8" x2="11" y2="14"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg>',
  zoomOut: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg>',
  rotateRight: '<svg viewBox="0 0 24 24"><polyline points="23 4 23 10 17 10"></polyline><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>',
  fullscreen: '<svg viewBox="0 0 24 24"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path></svg>',
  download: '<svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>',
  sun: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>',
  moon: '<svg viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>',
  copy: '<svg viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>',
  check: '<svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>',
  close: '<svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>',
  chevronLeft: '<svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"></polyline></svg>',
  chevronRight: '<svg viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"></polyline></svg>'
};

/**
 * Universal Toolbar Component with Integrated Browse Button & Second Cloud URL Bar
 */
export class Toolbar {
  constructor(viewer, options = {}) {
    this.viewer = viewer;
    this.options = this.parseOptions(options);
    this.element = null;
    this.showUrlBar = false;
    this.init();
  }

  parseOptions(options) {
    const isExplicitFalse = options === false;
    const optObj = (typeof options === 'object' && options !== null) ? options : {};
    return {
      enabled: isExplicitFalse ? false : (optObj.enabled !== false),
      browse: optObj.browse !== false,
      cloudUrl: optObj.cloudUrl !== false,
      presets: Array.isArray(optObj.presets) ? optObj.presets : [],
      zoom: optObj.zoom !== false,
      rotate: optObj.rotate !== false,
      pagination: optObj.pagination !== false,
      theme: optObj.theme !== false,
      fullscreen: optObj.fullscreen !== false,
      download: optObj.download !== false,
      ...optObj
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

  init() {
    this.element = document.createElement('div');
    this.element.className = 'dva-toolbar-wrapper';

    if (!this.options.enabled) {
      this.element.style.display = 'none';
      return;
    }

    const info = this.viewer.currentFileInfo || { name: 'No document loaded', ext: 'READY' };

    const browseBtnHtml = this.options.browse ? `
      <button class="dva-btn-browse" id="dva-btn-browse-file" title="Browse / Open Local Document">
        ${ICONS.folderOpen}
        <span class="dva-btn-browse-label">Browse Document</span>
      </button>
    ` : '';

    const cloudBtnHtml = this.options.cloudUrl ? `
      <button class="dva-btn-cloud-toggle" id="dva-btn-cloud-toggle" title="Toggle Remote Cloud URL Bar (AWS, Azure, GCP)">
        ${ICONS.link}
        <span class="dva-btn-cloud-label">Cloud URL</span>
      </button>
    ` : '';

    const leftDividerHtml = (this.options.browse || this.options.cloudUrl) ? `<div class="dva-divider"></div>` : '';

    const paginationHtml = this.options.pagination ? `
      <div class="dva-pagination-controls" id="dva-pagination-controls" style="display: none;">
        <button class="dva-btn dva-btn-page" id="dva-btn-prev-page" title="Previous Page (← or PgUp)">
          ${ICONS.chevronLeft}
        </button>
        <div class="dva-page-box" title="Current Page / Total Pages (Enter page number and press Enter to jump)">
          <input 
            type="number" 
            class="dva-page-input" 
            id="dva-page-input" 
            min="1" 
            value="1" 
            aria-label="Current Page Number" 
          />
          <span class="dva-page-divider">/</span>
          <span class="dva-page-total" id="dva-page-total">1</span>
        </div>
        <button class="dva-btn dva-btn-page" id="dva-btn-next-page" title="Next Page (→ or PgDn)">
          ${ICONS.chevronRight}
        </button>
        <div class="dva-divider"></div>
      </div>
    ` : '';

    const zoomHtml = this.options.zoom ? `
      <button class="dva-btn" id="dva-btn-zoom-out" title="Zoom Out">${ICONS.zoomOut}</button>
      <span class="dva-zoom-text" id="dva-zoom-level">100%</span>
      <button class="dva-btn" id="dva-btn-zoom-in" title="Zoom In">${ICONS.zoomIn}</button>
    ` : '';

    const rotateHtml = this.options.rotate ? `
      <button class="dva-btn" id="dva-btn-rotate" title="Rotate 90°">${ICONS.rotateRight}</button>
    ` : '';

    const rightDividerHtml = ((this.options.zoom || this.options.rotate) && (this.options.theme || this.options.fullscreen || this.options.download)) ? `<div class="dva-divider"></div>` : '';

    const themeHtml = this.options.theme ? `
      <button class="dva-btn" id="dva-btn-theme" title="Toggle Theme">${this.viewer.theme === 'dark' ? ICONS.sun : ICONS.moon}</button>
    ` : '';

    const fullscreenHtml = this.options.fullscreen ? `
      <button class="dva-btn" id="dva-btn-fullscreen" title="Fullscreen">${ICONS.fullscreen}</button>
    ` : '';

    const downloadHtml = this.options.download ? `
      <button class="dva-btn" id="dva-btn-download" title="Download Document">${ICONS.download}</button>
    ` : '';

    const subToolbarHtml = this.options.cloudUrl ? `
      <div class="dva-sub-toolbar" id="dva-sub-toolbar" style="display: none;">
        <div class="dva-url-box">
          <span class="dva-url-icon">${ICONS.cloud}</span>
          <input 
            type="text" 
            class="dva-url-input" 
            id="dva-remote-url-input" 
            placeholder="Paste URL from AWS S3, Azure Blob, Google Cloud Storage, CDN, or Web (PDF, DOCX, XLSX, CSV, Video, MPD...)" 
          />
          <button class="dva-btn-load" id="dva-btn-load-url">Load URL</button>
        </div>
      </div>
    ` : '';

    this.element.innerHTML = `
      <!-- Primary Main Toolbar -->
      <div class="dva-toolbar">
        <div class="dva-toolbar-section">
          ${browseBtnHtml}
          ${cloudBtnHtml}
          ${leftDividerHtml}
          <div class="dva-file-info" id="dva-file-info">
            <span class="dva-file-badge" id="dva-file-badge">${(info.ext || 'READY').toUpperCase()}</span>
            <span class="dva-file-name" id="dva-file-name" title="${info.name}">${info.name}</span>
          </div>
        </div>
        <div class="dva-toolbar-section">
          ${paginationHtml}
          ${zoomHtml}
          ${rotateHtml}
          ${rightDividerHtml}
          ${themeHtml}
          ${fullscreenHtml}
          ${downloadHtml}
        </div>
      </div>

      <!-- Secondary Sub-Toolbar: Paste Cloud URL Bar -->
      ${subToolbarHtml}
    `;

    this.bindEvents();
  }

  bindEvents() {
    const btnBrowse = this.element.querySelector('#dva-btn-browse-file');
    const btnCloudToggle = this.element.querySelector('#dva-btn-cloud-toggle');
    const subToolbar = this.element.querySelector('#dva-sub-toolbar');
    const urlInput = this.element.querySelector('#dva-remote-url-input');
    const btnLoadUrl = this.element.querySelector('#dva-btn-load-url');

    const btnZoomIn = this.element.querySelector('#dva-btn-zoom-in');
    const btnZoomOut = this.element.querySelector('#dva-btn-zoom-out');
    const btnRotate = this.element.querySelector('#dva-btn-rotate');
    const btnTheme = this.element.querySelector('#dva-btn-theme');
    const btnFs = this.element.querySelector('#dva-btn-fullscreen');
    const btnDl = this.element.querySelector('#dva-btn-download');

    if (btnBrowse) {
      btnBrowse.onclick = () => {
        this.showUrlBar = false;
        subToolbar.style.display = 'none';
        if (btnCloudToggle) btnCloudToggle.classList.remove('active');
        this.viewer.openFileDialog();
      };
    }

    if (btnCloudToggle) {
      btnCloudToggle.onclick = () => {
        this.showUrlBar = !this.showUrlBar;
        subToolbar.style.display = this.showUrlBar ? 'flex' : 'none';
        btnCloudToggle.classList.toggle('active', this.showUrlBar);
        if (this.showUrlBar && urlInput) urlInput.focus();
      };
    }

    const handleLoadUrl = () => {
      const url = (urlInput.value || '').trim();
      if (!url) {
        if (this.viewer && typeof this.viewer.notify === 'function') {
          this.viewer.notify('Please paste a valid document or media URL', 'warning');
        }
        return;
      }
      this.viewer.loadFile(url);
      // Automatically hide the sub-toolbar on submit
      this.showUrlBar = false;
      subToolbar.style.display = 'none';
      if (btnCloudToggle) btnCloudToggle.classList.remove('active');
    };

    if (btnLoadUrl) btnLoadUrl.onclick = handleLoadUrl;
    if (urlInput) {
      urlInput.onkeydown = (e) => {
        if (e.key === 'Enter') handleLoadUrl();
      };
    }

    if (btnZoomIn) btnZoomIn.onclick = () => this.viewer.zoom(0.15);
    if (btnZoomOut) btnZoomOut.onclick = () => this.viewer.zoom(-0.15);
    if (btnRotate) btnRotate.onclick = () => this.viewer.rotate(90);
    if (btnTheme) btnTheme.onclick = () => this.viewer.toggleTheme();
    if (btnFs) btnFs.onclick = () => this.viewer.toggleFullscreen();
    if (btnDl) btnDl.onclick = () => this.viewer.download();

    // Pagination Events (Previous, Next, Direct Number Jump)
    const btnPrev = this.element.querySelector('#dva-btn-prev-page');
    const btnNext = this.element.querySelector('#dva-btn-next-page');
    const pageInput = this.element.querySelector('#dva-page-input');

    if (btnPrev) {
      btnPrev.onclick = () => {
        if (this.viewer && typeof this.viewer.prevPage === 'function') {
          this.viewer.prevPage();
        }
      };
    }

    if (btnNext) {
      btnNext.onclick = () => {
        if (this.viewer && typeof this.viewer.nextPage === 'function') {
          this.viewer.nextPage();
        }
      };
    }

    if (pageInput) {
      const commitPage = () => {
        const val = parseInt(pageInput.value, 10);
        if (!isNaN(val) && this.viewer && typeof this.viewer.goToPage === 'function') {
          this.viewer.goToPage(val);
        }
      };

      pageInput.onchange = commitPage;
      pageInput.onkeydown = (e) => {
        if (e.key === 'Enter') {
          commitPage();
          pageInput.blur();
        }
      };
    }
  }

  updatePagination(currentPage, totalPages) {
    if (!this.element) return;
    const paginationControls = this.element.querySelector('#dva-pagination-controls');
    const pageInput = this.element.querySelector('#dva-page-input');
    const pageTotal = this.element.querySelector('#dva-page-total');
    const btnPrev = this.element.querySelector('#dva-btn-prev-page');
    const btnNext = this.element.querySelector('#dva-btn-next-page');

    if (!paginationControls) return;

    if (totalPages > 1) {
      paginationControls.style.display = 'flex';
    } else {
      paginationControls.style.display = 'none';
    }

    if (pageInput) {
      pageInput.value = currentPage;
      pageInput.max = totalPages;
    }
    if (pageTotal) {
      pageTotal.textContent = totalPages;
    }
    if (btnPrev) {
      btnPrev.disabled = currentPage <= 1;
      btnPrev.classList.toggle('dva-btn-disabled', currentPage <= 1);
    }
    if (btnNext) {
      btnNext.disabled = currentPage >= totalPages;
      btnNext.classList.toggle('dva-btn-disabled', currentPage >= totalPages);
    }
  }

  hidePagination() {
    if (!this.element) return;
    const paginationControls = this.element.querySelector('#dva-pagination-controls');
    if (paginationControls) {
      paginationControls.style.display = 'none';
    }
  }

  updateFileInfo(info) {
    if (!this.element) return;
    const badge = this.element.querySelector('#dva-file-badge');
    const name = this.element.querySelector('#dva-file-name');
    if (badge && info) badge.textContent = (info.ext || 'FILE').toUpperCase();
    if (name && info) {
      name.textContent = info.name || 'Document';
      name.title = info.name || 'Document';
    }
  }

  updateZoom(zoomLevel) {
    if (!this.element) return;
    const txt = this.element.querySelector('#dva-zoom-level');
    if (txt) {
      txt.textContent = `${Math.round(zoomLevel * 100)}%`;
    }
  }

  updateTheme(theme) {
    if (!this.element) return;
    const btnTheme = this.element.querySelector('#dva-btn-theme');
    if (btnTheme) {
      btnTheme.innerHTML = theme === 'dark' ? ICONS.sun : ICONS.moon;
    }
  }

  getElement() {
    return this.element;
  }
}
