/**
 * Continuous-Scroll & Virtual Paginated PDF Engine
 * Features:
 * - Natural Continuous Vertical Scrolling: All pages flow smoothly one after another.
 * - Optimal Reading Width: Calibrated to ~820px-840px desktop reading standard (matching A4).
 * - Premium Studio Workspace Background: Sleek desk slate in light mode, midnight in dark mode.
 * - Zero-Flicker Virtual Lazy Rendering: Canvases pre-structured in slots without DOM thrashing.
 * - Blazing Fast O(1) Scroll Tracking: Real-time toolbar page indicator updates without frame drops.
 * - Hardware-Accelerated Offline Fallback: Reliable browser object fallback if offline.
 */

let pdfjsPromise = null;
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
            window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
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
              window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
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
    this.pdfDoc = null;
    this.pdfObject = null;
    this.objectUrl = null;
    this.sourceUrl = '';
    this.currentPage = 1;
    this.totalPages = 1;
    this.pageSlots = []; // Array of { slot, canvas, rendered, renderTask }
    this.currentScale = 1.0;
    this.currentSlotW = 820;
    this.currentSlotH = 1100;
    this.observer = null;
    this.scrollHandler = null;
  }

  async render(fileInput, viewport) {
    this.container = document.createElement('div');
    this.container.className = 'dva-pdf-container';
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
        this.viewer.updateProgress(35, 'Initializing PDF.js runtime...');
      }

      const loadingTask = arrayBuffer 
        ? pdfjs.getDocument({ data: arrayBuffer })
        : pdfjs.getDocument(this.sourceUrl);

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
      this.currentPage = 1;

      // Update viewer toolbar with exact page numbers
      if (this.viewer && typeof this.viewer.setPageInfo === 'function') {
        this.viewer.setPageInfo(1, this.totalPages);
      }

      this.container.innerHTML = '';
      this.pagesList = document.createElement('div');
      this.pagesList.className = 'dva-pdf-pages-list';
      this.container.appendChild(this.pagesList);

      // Calibrate optimal reading width and scale
      const firstPage = await this.pdfDoc.getPage(1);
      const unscaledViewport = firstPage.getViewport({ scale: 1.0 });
      const containerWidth = this.container.clientWidth || 960;
      const idealWidth = Math.min(840, Math.max(680, Math.round(containerWidth - 96)));
      const baseScale = Math.max(1.15, Math.min(1.5, idealWidth / unscaledViewport.width));
      this.currentScale = baseScale * (this.viewer.scale || 1.0);

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rotation = (firstPage.rotate + (this.viewer.rotation || 0)) % 360;
      const viewportObj = firstPage.getViewport({ scale: this.currentScale, rotation });

      this.currentSlotW = Math.round(viewportObj.width);
      this.currentSlotH = Math.round(viewportObj.height);

      const canvasW = Math.floor(viewportObj.width * dpr);
      const canvasH = Math.floor(viewportObj.height * dpr);

      // Pre-construct all page slots with canvases already attached (zero DOM thrashing)
      this.pageSlots = [];
      for (let p = 1; p <= this.totalPages; p++) {
        const slot = document.createElement('div');
        slot.className = 'dva-pdf-page-slot';
        slot.id = `dva-pdf-page-${p}`;
        slot.setAttribute('data-page', p);
        slot.style.width = `${this.currentSlotW}px`;
        slot.style.height = `${this.currentSlotH}px`;

        const canvas = document.createElement('canvas');
        canvas.className = 'dva-pdf-canvas';
        canvas.width = canvasW;
        canvas.height = canvasH;
        canvas.style.width = `${this.currentSlotW}px`;
        canvas.style.height = `${this.currentSlotH}px`;
        slot.appendChild(canvas);

        this.pagesList.appendChild(slot);
        this.pageSlots.push({ slot, canvas, rendered: false, renderTask: null });
      }

      // Initialize Virtual Lazy Rendering with IntersectionObserver
      this.initIntersectionObserver();

      // Render page 1 immediately
      await this.renderPageCanvas(this.pageSlots[0], 1);

      // Track scroll position to update toolbar page number in real time (O(1) calculation)
      this.initScrollTracking();

      loadedWithPdfJs = true;

      const fileName = fileInput.name || (typeof fileInput === 'string' ? fileInput.split('/').pop().split('?')[0] : 'Document.pdf');
      if (this.viewer && typeof this.viewer.notify === 'function') {
        this.viewer.notify(`Opened ${fileName} (${this.totalPages} pages)`, 'success');
      }
    } catch (err) {
      console.warn('[PdfEngine] PDF.js unavailable or errored, falling back to native browser PDF object:', err);
    }

    if (!loadedWithPdfJs) {
      this.renderFallbackObject(this.sourceUrl);
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
      rootMargin: '400px 0px' // Pre-render 400px ahead of viewport for smooth scrolling
    });

    this.pageSlots.forEach(({ slot }) => this.observer.observe(slot));
  }

  async renderPageCanvas(item, pageNumber) {
    if (!this.pdfDoc || !item || item.rendered) return;
    item.rendered = true;

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

  goToPage(pageNumber) {
    const target = Math.max(1, Math.min(this.totalPages, parseInt(pageNumber, 10) || 1));
    this.currentPage = target;

    if (this.pageSlots && this.pageSlots[target - 1]) {
      const item = this.pageSlots[target - 1];
      item.slot.scrollIntoView({ behavior: 'smooth', block: 'start' });
      if (!item.rendered) {
        this.renderPageCanvas(item, target);
      }
    } else if (this.pdfObject && this.sourceUrl) {
      this.pdfObject.data = `${this.sourceUrl}#page=${target}`;
    }
  }

  updateTransform() {
    if (!this.pdfDoc || this.pageSlots.length === 0) return;

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
      const idealWidth = Math.min(840, Math.max(680, Math.round(containerWidth - 96)));
      const baseScale = Math.max(1.15, Math.min(1.5, idealWidth / unscaledViewport.width));
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

      // Re-render currently active page
      if (this.pageSlots[this.currentPage - 1]) {
        this.renderPageCanvas(this.pageSlots[this.currentPage - 1], this.currentPage);
      }
    });
  }

  renderFallbackObject(src) {
    this.container.innerHTML = `
      <object 
        data="${src}#page=${this.currentPage}" 
        type="application/pdf" 
        style="width: 100%; height: 100%; border: none;"
      >
        <iframe src="${src}#page=${this.currentPage}" style="width: 100%; height: 100%; border: none;" title="PDF Preview"></iframe>
      </object>
    `;
    this.pdfObject = this.container.querySelector('object');
    if (this.viewer && typeof this.viewer.setPageInfo === 'function') {
      this.viewer.setPageInfo(1, 1);
    }
  }

  destroy() {
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

    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = null;
    }
    if (this.pdfDoc) {
      try { this.pdfDoc.destroy(); } catch {}
      this.pdfDoc = null;
    }
    this.pageSlots = [];
    this.pagesList = null;
    this.pdfObject = null;
    this.container = null;
  }
}
