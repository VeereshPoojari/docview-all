/**
 * Continuous-Scroll & Two-Page Book Mode Paginated PDF Engine
 * Features:
 * - Natural Continuous Vertical Scrolling (DOCX Style): Paper cards on studio workspace canvas.
 * - Two-Page Book Reading Mode (Spread): Open book layout with center spine shadow and page flip navigation.
 * - Zero Browser Native Chrome: Eliminates cluttered browser PDF toolbars, maintaining pristine unified UI.
 * - Same-Origin Blob Worker Wrapper: Bypasses cross-origin Web Worker restrictions seamlessly.
 * - High-DPI Crisp Rendering: Calibrated devicePixelRatio rendering for razor-sharp typography.
 * - Virtual Lazy Rendering & Scroll Sync: O(1) page indicator and active analytics synchronization.
 */

let pdfjsPromise = null;

function setupWorker(pdfjsLib) {
  try {
    const workerScript = `importScripts('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js');`;
    const blob = new Blob([workerScript], { type: 'application/javascript' });
    pdfjsLib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(blob);
  } catch (e) {
    try {
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    } catch {}
  }
}

function loadPdfJsScript() {
  if (typeof window !== 'undefined' && window.pdfjsLib && window.pdfjsLib.getDocument) {
    return Promise.resolve(window.pdfjsLib);
  }
  if (!pdfjsPromise) {
    pdfjsPromise = (async () => {
      if (typeof document === 'undefined') throw new Error('Document is undefined');

      await new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
        s.async = true;
        s.onload = () => {
          if (window.pdfjsLib) {
            setupWorker(window.pdfjsLib);
            resolve(window.pdfjsLib);
          } else {
            reject(new Error('pdfjsLib not available'));
          }
        };
        s.onerror = () => {
          const fb = document.createElement('script');
          fb.src = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js';
          fb.async = true;
          fb.onload = () => {
            if (window.pdfjsLib) {
              setupWorker(window.pdfjsLib);
              resolve(window.pdfjsLib);
            } else {
              reject(new Error('pdfjsLib fallback not available'));
            }
          };
          fb.onerror = () => reject(new Error('Failed to load PDF.js from all CDNs'));
          document.head.appendChild(fb);
        };
        document.head.appendChild(s);
      });

      return window.pdfjsLib;
    })();
  }
  return pdfjsPromise;
}

export class PdfEngine {
  constructor(viewer) {
    this.viewer = viewer;
    this.container = null;
    this.pagesList = null;
    this.bookStage = null;
    this.pdfDoc = null;
    this.objectUrl = null;
    this.sourceUrl = '';
    this.currentPage = 1;
    this.totalPages = 1;
    this.pageSlots = []; // Array of { slot, canvas, rendered, renderTask }
    this.bookSlots = { left: null, right: null, spine: null };
    this.currentScale = 1.0;
    this.currentSlotW = 816;
    this.currentSlotH = 1056;
    this.observer = null;
    this.scrollHandler = null;
    this.bookMode = !!(viewer && viewer.options && viewer.options.bookMode);
  }

  isBookMode() {
    return !!this.bookMode;
  }

  setBookMode(enabled) {
    const nextMode = !!enabled;
    if (this.bookMode === nextMode && (this.pagesList || this.bookStage)) return;
    this.bookMode = nextMode;

    if (this.viewer) {
      this.viewer.options.bookMode = this.bookMode;
      if (this.viewer.toolbar && typeof this.viewer.toolbar.updateBookMode === 'function') {
        this.viewer.toolbar.updateBookMode(this.bookMode);
      }
    }

    if (this.pdfDoc && this.container) {
      if (this.bookMode) {
        this.setupBookView();
      } else {
        this.setupContinuousView();
      }
    }
    return this;
  }

  toggleBookMode() {
    return this.setBookMode(!this.bookMode);
  }

  async render(fileInput, viewport) {
    this.container = document.createElement('div');
    this.container.className = this.bookMode ? 'dva-pdf-container dva-book-mode' : 'dva-pdf-container';
    viewport.appendChild(this.container);

    let arrayBuffer = null;
    if (typeof fileInput === 'string') {
      this.sourceUrl = fileInput;
      try {
        const res = await fetch(fileInput);
        if (res.ok) arrayBuffer = await res.arrayBuffer();
      } catch (e) {
        console.warn('[PdfEngine] Could not fetch remote PDF arrayBuffer:', e);
      }
    } else if (fileInput instanceof Blob || fileInput instanceof File) {
      this.objectUrl = URL.createObjectURL(fileInput);
      this.sourceUrl = this.objectUrl;
      try {
        arrayBuffer = await fileInput.arrayBuffer();
      } catch (e) {
        console.warn('[PdfEngine] Could not read blob arrayBuffer:', e);
      }
    }

    let loadedWithPdfJs = false;
    try {
      this.container.innerHTML = `
        <div style="color: var(--dva-text-secondary); text-align: center; padding: 60px;">
          Opening PDF document...
        </div>
      `;

      const pdfjs = await loadPdfJsScript();
      if (this.viewer && typeof this.viewer.updateProgress === 'function') {
        this.viewer.updateProgress(35, 'Initializing PDF runtime...');
      }

      const docInitParams = arrayBuffer ? { data: arrayBuffer } : { url: this.sourceUrl };
      const loadingTask = pdfjs.getDocument(docInitParams);

      if (loadingTask.onProgress && this.viewer && typeof this.viewer.updateProgress === 'function') {
        loadingTask.onProgress = ({ loaded, total }) => {
          if (total > 0) {
            const p = Math.min(88, Math.round(35 + (loaded / total) * 50));
            this.viewer.updateProgress(p, `Downloading PDF (${(loaded / (1024 * 1024)).toFixed(1)} MB / ${(total / (1024 * 1024)).toFixed(1)} MB)...`);
          }
        };
      }

      this.pdfDoc = await loadingTask.promise;
      if (this.viewer && typeof this.viewer.updateProgress === 'function') {
        this.viewer.updateProgress(90, `Rendering ${this.pdfDoc.numPages} pages...`);
      }
      this.totalPages = this.pdfDoc.numPages;
      this.currentPage = Math.max(1, Math.min(this.totalPages, this.viewer.currentPage || 1));

      // Calculate initial page proportions from page 1
      const firstPage = await this.pdfDoc.getPage(1);
      const unscaledViewport = firstPage.getViewport({ scale: 1.0 });
      const containerWidth = this.container.clientWidth || 960;
      const idealWidth = Math.min(840, Math.max(640, Math.round(containerWidth - 96)));
      const baseScale = Math.max(1.1, Math.min(1.5, idealWidth / unscaledViewport.width));
      this.currentScale = baseScale * (this.viewer.scale || 1.0);

      const rotation = (firstPage.rotate + (this.viewer.rotation || 0)) % 360;
      const viewportObj = firstPage.getViewport({ scale: this.currentScale, rotation });
      this.currentSlotW = Math.round(viewportObj.width);
      this.currentSlotH = Math.round(viewportObj.height);

      // Render mode
      if (this.bookMode) {
        this.setupBookView();
      } else {
        this.setupContinuousView();
      }

      loadedWithPdfJs = true;

      const fileName = fileInput.name || (typeof fileInput === 'string' ? fileInput.split('/').pop().split('?')[0] : 'Document.pdf');
      if (this.viewer && typeof this.viewer.notify === 'function') {
        this.viewer.notify(`Opened ${fileName} (${this.totalPages} pages)`, 'success');
      }
    } catch (err) {
      console.warn('[PdfEngine] PDF.js rendering error, falling back to clean document card:', err);
    }

    if (!loadedWithPdfJs) {
      this.renderCleanFallback(this.sourceUrl);
    }
  }

  // --- Mode 1: Continuous Vertical Scroll (DOCX Style) ---

  setupContinuousView() {
    this.cleanUpView();
    this.container.className = 'dva-pdf-container';
    this.container.innerHTML = '';

    this.pagesList = document.createElement('div');
    this.pagesList.className = 'dva-pdf-pages-list';
    this.container.appendChild(this.pagesList);

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const canvasW = Math.floor(this.currentSlotW * dpr);
    const canvasH = Math.floor(this.currentSlotH * dpr);

    this.pageSlots = [];
    for (let p = 1; p <= this.totalPages; p++) {
      const card = document.createElement('div');
      card.className = 'dva-pdf-page-card';
      card.id = `dva-pdf-page-${p}`;
      card.setAttribute('data-page', p);
      card.style.width = `${this.currentSlotW}px`;
      card.style.height = `${this.currentSlotH}px`;

      const canvas = document.createElement('canvas');
      canvas.className = 'dva-pdf-canvas';
      canvas.width = canvasW;
      canvas.height = canvasH;
      canvas.style.width = `${this.currentSlotW}px`;
      canvas.style.height = `${this.currentSlotH}px`;
      card.appendChild(canvas);

      const footer = document.createElement('div');
      footer.className = 'dva-pdf-page-num-badge';
      footer.textContent = `${p}`;
      card.appendChild(footer);

      this.pagesList.appendChild(card);
      this.pageSlots.push({ slot: card, canvas, rendered: false, renderTask: null });
    }

    this.initIntersectionObserver();

    // Render active page immediately
    const initialIndex = Math.max(0, Math.min(this.totalPages - 1, this.currentPage - 1));
    this.renderPageCanvas(this.pageSlots[initialIndex], initialIndex + 1);

    this.initScrollTracking();

    if (this.viewer && typeof this.viewer.setPageInfo === 'function') {
      this.viewer.setPageInfo(this.currentPage, this.totalPages);
    }

    if (this.currentPage > 1) {
      setTimeout(() => {
        if (this.pageSlots[this.currentPage - 1]) {
          this.pageSlots[this.currentPage - 1].slot.scrollIntoView({ behavior: 'auto', block: 'start' });
        }
      }, 50);
    }
  }

  initIntersectionObserver() {
    if (typeof IntersectionObserver === 'undefined') return;

    this.observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        const pageNum = parseInt(entry.target.getAttribute('data-page'), 10);
        if (entry.isIntersecting) {
          const item = this.pageSlots[pageNum - 1];
          if (item && !item.rendered) {
            this.renderPageCanvas(item, pageNum);
          }
        }
      });
    }, {
      root: this.container,
      rootMargin: '400px 0px'
    });

    this.pageSlots.forEach(({ slot }) => this.observer.observe(slot));
  }

  async renderPageCanvas(item, pageNumber) {
    if (!this.pdfDoc || !item || item.rendered || item.renderTask) return;

    try {
      const page = await this.pdfDoc.getPage(pageNumber);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rotation = (page.rotate + (this.viewer.rotation || 0)) % 360;
      const viewport = page.getViewport({ scale: this.currentScale * dpr, rotation });

      const canvas = item.canvas;
      const context = canvas.getContext('2d');

      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      canvas.style.width = `${this.currentSlotW}px`;
      canvas.style.height = `${this.currentSlotH}px`;

      item.renderTask = page.render({
        canvasContext: context,
        viewport: viewport
      });

      await item.renderTask.promise;
      item.rendered = true;
      item.renderTask = null;
    } catch (err) {
      if (err && err.name !== 'RenderingCancelledException') {
        console.warn(`[PdfEngine] Error rendering page ${pageNumber}:`, err);
      }
    }
  }

  initScrollTracking() {
    if (!this.container || this.totalPages <= 1) return;

    let ticking = false;
    this.scrollHandler = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          if (!this.container || this.bookMode) return;
          const scrollTop = this.container.scrollTop;
          const slotHeightWithGap = this.currentSlotH + 28;
          const activePage = Math.max(1, Math.min(this.totalPages, Math.floor((scrollTop + 140) / slotHeightWithGap) + 1));

          if (activePage !== this.currentPage) {
            this.currentPage = activePage;
            if (this.viewer && typeof this.viewer.setPageInfo === 'function') {
              this.viewer.setPageInfo(this.currentPage, this.totalPages);
            }
          }
          ticking = false;
        });
        ticking = true;
      }
    };
    this.container.addEventListener('scroll', this.scrollHandler, { passive: true });
  }

  // --- Mode 2: Two-Page Side-by-Side Book Mode (Spread) ---

  setupBookView() {
    this.cleanUpView();
    this.container.className = 'dva-pdf-container dva-book-mode';
    this.container.innerHTML = '';

    this.bookStage = document.createElement('div');
    this.bookStage.className = 'dva-book-stage';
    this.container.appendChild(this.bookStage);

    // Navigation chevrons
    const prevBtn = document.createElement('button');
    prevBtn.className = 'dva-book-nav-btn dva-book-prev-btn';
    prevBtn.title = 'Previous Spread (← or PageUp)';
    prevBtn.innerHTML = `
      <svg viewBox="0 0 24 24" width="22" height="22" stroke="currentColor" fill="none" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="15 18 9 12 15 6"></polyline>
      </svg>
    `;
    prevBtn.onclick = () => this.prevSpread();
    this.bookStage.appendChild(prevBtn);

    const nextBtn = document.createElement('button');
    nextBtn.className = 'dva-book-nav-btn dva-book-next-btn';
    nextBtn.title = 'Next Spread (→ or PageDown)';
    nextBtn.innerHTML = `
      <svg viewBox="0 0 24 24" width="22" height="22" stroke="currentColor" fill="none" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="9 18 15 12 9 6"></polyline>
      </svg>
    `;
    nextBtn.onclick = () => this.nextSpread();
    this.bookStage.appendChild(nextBtn);

    // Book spread container
    const spread = document.createElement('div');
    spread.className = 'dva-book-spread';
    this.bookStage.appendChild(spread);

    // Left Page Card
    const leftCard = document.createElement('div');
    leftCard.className = 'dva-book-page dva-book-page-left';
    const leftCanvas = document.createElement('canvas');
    leftCanvas.className = 'dva-pdf-canvas';
    leftCard.appendChild(leftCanvas);
    const leftFooter = document.createElement('div');
    leftFooter.className = 'dva-book-page-badge';
    leftCard.appendChild(leftFooter);
    spread.appendChild(leftCard);

    // Center Spine Divider
    const spine = document.createElement('div');
    spine.className = 'dva-book-spine';
    spread.appendChild(spine);

    // Right Page Card
    const rightCard = document.createElement('div');
    rightCard.className = 'dva-book-page dva-book-page-right';
    const rightCanvas = document.createElement('canvas');
    rightCanvas.className = 'dva-pdf-canvas';
    rightCard.appendChild(rightCanvas);
    const rightFooter = document.createElement('div');
    rightFooter.className = 'dva-book-page-badge';
    rightCard.appendChild(rightFooter);
    spread.appendChild(rightCard);

    this.bookSlots = {
      leftCard,
      leftCanvas,
      leftFooter,
      spine,
      rightCard,
      rightCanvas,
      rightFooter,
      prevBtn,
      nextBtn,
      renderTaskLeft: null,
      renderTaskRight: null
    };

    this.renderCurrentSpread();
  }

  getSpreadForPage(pageNumber) {
    if (this.totalPages <= 1) {
      return { left: 1, right: null };
    }
    // Normal 2-page spread: Page 1-2, 3-4, 5-6 ...
    const left = (pageNumber % 2 === 0) ? pageNumber - 1 : pageNumber;
    const right = (left + 1 <= this.totalPages) ? left + 1 : null;
    return { left, right };
  }

  async renderCurrentSpread() {
    if (!this.pdfDoc || !this.bookSlots.leftCanvas) return;

    const { left, right } = this.getSpreadForPage(this.currentPage);
    this.currentPage = left;

    // Update navigation button states
    if (this.bookSlots.prevBtn) {
      this.bookSlots.prevBtn.disabled = left <= 1;
      this.bookSlots.prevBtn.classList.toggle('dva-btn-disabled', left <= 1);
    }
    if (this.bookSlots.nextBtn) {
      const isEnd = right ? right >= this.totalPages : left >= this.totalPages;
      this.bookSlots.nextBtn.disabled = isEnd;
      this.bookSlots.nextBtn.classList.toggle('dva-btn-disabled', isEnd);
    }

    // Update viewer toolbar with spread label (e.g. "1-2" or "1")
    const displayLabel = right ? `${left}-${right}` : `${left}`;
    if (this.viewer && typeof this.viewer.setPageInfo === 'function') {
      this.viewer.setPageInfo(left, this.totalPages, displayLabel);
    }

    // Cancel running book render tasks
    if (this.bookSlots.renderTaskLeft) {
      try { this.bookSlots.renderTaskLeft.cancel(); } catch {}
      this.bookSlots.renderTaskLeft = null;
    }
    if (this.bookSlots.renderTaskRight) {
      try { this.bookSlots.renderTaskRight.cancel(); } catch {}
      this.bookSlots.renderTaskRight = null;
    }

    // Calibrate book page dimensions based on container height
    const containerW = this.container.clientWidth || 960;
    const containerH = this.container.clientHeight || 700;
    const targetH = Math.max(480, Math.min(880, containerH - 80));
    const targetW = Math.round(targetH * (this.currentSlotW / this.currentSlotH));

    const finalW = Math.min(targetW, Math.round((containerW - 140) / 2));
    const finalH = Math.round(finalW * (this.currentSlotH / this.currentSlotW));

    this.bookSlots.leftCard.style.width = `${finalW}px`;
    this.bookSlots.leftCard.style.height = `${finalH}px`;
    this.bookSlots.rightCard.style.width = `${finalW}px`;
    this.bookSlots.rightCard.style.height = `${finalH}px`;

    // Render Left Page
    this.renderSingleBookPage(
      left,
      this.bookSlots.leftCanvas,
      this.bookSlots.leftFooter,
      finalW,
      finalH,
      'renderTaskLeft'
    );

    // Render Right Page (or show clean end page)
    if (right) {
      this.bookSlots.rightCard.style.display = 'flex';
      this.renderSingleBookPage(
        right,
        this.bookSlots.rightCanvas,
        this.bookSlots.rightFooter,
        finalW,
        finalH,
        'renderTaskRight'
      );
    } else {
      // Empty right page slot (clean end of book)
      this.bookSlots.rightCanvas.style.display = 'none';
      this.bookSlots.rightFooter.textContent = 'End of Document';
      this.bookSlots.rightCard.style.display = 'flex';
    }
  }

  async renderSingleBookPage(pageNum, canvas, footerEl, width, height, taskProp) {
    canvas.style.display = 'block';
    footerEl.textContent = `Page ${pageNum}`;

    try {
      const page = await this.pdfDoc.getPage(pageNum);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rotation = (page.rotate + (this.viewer.rotation || 0)) % 360;

      const unscaled = page.getViewport({ scale: 1.0, rotation });
      const scale = (width / unscaled.width) * (this.viewer.scale || 1.0);
      const viewport = page.getViewport({ scale: scale * dpr, rotation });

      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      const ctx = canvas.getContext('2d');
      const renderTask = page.render({
        canvasContext: ctx,
        viewport: viewport
      });

      this.bookSlots[taskProp] = renderTask;
      await renderTask.promise;
      this.bookSlots[taskProp] = null;
    } catch (err) {
      if (err && err.name !== 'RenderingCancelledException') {
        console.warn(`[PdfEngine] Error rendering book spread page ${pageNum}:`, err);
      }
    }
  }

  nextSpread() {
    const { left, right } = this.getSpreadForPage(this.currentPage);
    const nextLeft = (right || left) + 1;
    if (nextLeft <= this.totalPages) {
      this.goToPage(nextLeft);
    }
  }

  prevSpread() {
    const { left } = this.getSpreadForPage(this.currentPage);
    const prevLeft = Math.max(1, left - 2);
    if (prevLeft !== left) {
      this.goToPage(prevLeft);
    }
  }

  // --- Universal Navigation Contracts ---

  goToPage(pageNumber) {
    const target = Math.max(1, Math.min(this.totalPages, parseInt(pageNumber, 10) || 1));
    this.currentPage = target;

    if (this.bookMode) {
      this.renderCurrentSpread();
      return;
    }

    if (this.pageSlots && this.pageSlots[target - 1]) {
      const item = this.pageSlots[target - 1];
      item.slot.scrollIntoView({ behavior: 'smooth', block: 'start' });
      if (!item.rendered) {
        this.renderPageCanvas(item, target);
      }
      if (this.viewer && typeof this.viewer.setPageInfo === 'function') {
        this.viewer.setPageInfo(target, this.totalPages);
      }
    }
  }

  updateTransform() {
    if (!this.pdfDoc) return;

    if (this.bookMode) {
      this.renderCurrentSpread();
      return;
    }

    this.pageSlots.forEach(item => {
      if (item.renderTask) {
        try { item.renderTask.cancel(); } catch {}
        item.renderTask = null;
      }
      item.rendered = false;
    });

    this.pdfDoc.getPage(1).then(firstPage => {
      const unscaledViewport = firstPage.getViewport({ scale: 1.0 });
      const containerWidth = this.container.clientWidth || 960;
      const idealWidth = Math.min(840, Math.max(640, Math.round(containerWidth - 96)));
      const baseScale = Math.max(1.1, Math.min(1.5, idealWidth / unscaledViewport.width));
      this.currentScale = baseScale * (this.viewer.scale || 1.0);

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rotation = (firstPage.rotate + (this.viewer.rotation || 0)) % 360;
      const viewportObj = firstPage.getViewport({ scale: this.currentScale, rotation });

      this.currentSlotW = Math.round(viewportObj.width);
      this.currentSlotH = Math.round(viewportObj.height);
      const canvasW = Math.floor(viewportObj.width * dpr);
      const canvasH = Math.floor(viewportObj.height * dpr);

      this.pageSlots.forEach(item => {
        item.slot.style.width = `${this.currentSlotW}px`;
        item.slot.style.height = `${this.currentSlotH}px`;
        item.canvas.width = canvasW;
        item.canvas.height = canvasH;
        item.canvas.style.width = `${this.currentSlotW}px`;
        item.canvas.style.height = `${this.currentSlotH}px`;
      });

      if (this.pageSlots[this.currentPage - 1]) {
        this.renderPageCanvas(this.pageSlots[this.currentPage - 1], this.currentPage);
      }
    });
  }

  renderCleanFallback(src) {
    this.cleanUpView();
    this.container.className = 'dva-pdf-container';
    this.container.innerHTML = `
      <div class="dva-pdf-page-card" style="width: 816px; min-height: 1056px; padding: 0; overflow: hidden; display: flex; flex-direction: column;">
        <iframe 
          src="${src}#toolbar=0&navpanes=0&scrollbar=0" 
          style="width: 100%; height: 100%; min-height: 1056px; border: none; background: #ffffff;" 
          title="PDF Document"
        ></iframe>
      </div>
    `;
    if (this.viewer && typeof this.viewer.setPageInfo === 'function') {
      this.viewer.setPageInfo(1, 1);
    }
  }

  cleanUpView() {
    if (this.container && this.scrollHandler) {
      this.container.removeEventListener('scroll', this.scrollHandler);
      this.scrollHandler = null;
    }
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    this.pageSlots.forEach(item => {
      if (item.renderTask) {
        try { item.renderTask.cancel(); } catch {}
        item.renderTask = null;
      }
    });
    if (this.bookSlots.renderTaskLeft) {
      try { this.bookSlots.renderTaskLeft.cancel(); } catch {}
      this.bookSlots.renderTaskLeft = null;
    }
    if (this.bookSlots.renderTaskRight) {
      try { this.bookSlots.renderTaskRight.cancel(); } catch {}
      this.bookSlots.renderTaskRight = null;
    }
    this.pageSlots = [];
    this.pagesList = null;
    this.bookStage = null;
  }

  destroy() {
    this.cleanUpView();

    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = null;
    }
    if (this.pdfDoc) {
      try { this.pdfDoc.destroy(); } catch {}
      this.pdfDoc = null;
    }
    this.container = null;
  }
}
