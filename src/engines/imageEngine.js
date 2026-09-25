/**
 * Native Canvas & Image Viewer Engine with Pan, Zoom & Rotation
 */
export class ImageEngine {
  constructor(viewer) {
    this.viewer = viewer;
    this.container = null;
    this.img = null;
    this.isDragging = false;
    this.startX = 0;
    this.startY = 0;
    this.translateX = 0;
    this.translateY = 0;
  }

  async render(fileInput, viewport) {
    this.container = document.createElement('div');
    this.container.className = 'dva-image-container';

    this.img = document.createElement('img');
    this.img.className = 'dva-image-target';

    let src = '';
    if (typeof fileInput === 'string') {
      src = fileInput;
    } else if (fileInput instanceof Blob || fileInput instanceof File) {
      src = URL.createObjectURL(fileInput);
    }

    this.img.src = src;
    this.container.appendChild(this.img);
    viewport.appendChild(this.container);

    this.bindPanEvents();
    this.updateTransform();
  }

  bindPanEvents() {
    this.container.onmousedown = (e) => {
      this.isDragging = true;
      this.startX = e.clientX - this.translateX;
      this.startY = e.clientY - this.translateY;
    };

    window.addEventListener('mousemove', (e) => {
      if (!this.isDragging) return;
      this.translateX = e.clientX - this.startX;
      this.translateY = e.clientY - this.startY;
      this.updateTransform();
    });

    window.addEventListener('mouseup', () => {
      this.isDragging = false;
    });

    // Mouse wheel zoom
    this.container.onwheel = (e) => {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 0.1 : -0.1;
      this.viewer.zoom(delta);
    };
  }

  updateTransform() {
    if (!this.img) return;
    const scale = this.viewer.scale || 1;
    const rotation = this.viewer.rotation || 0;
    this.img.style.transform = `translate(${this.translateX}px, ${this.translateY}px) scale(${scale}) rotate(${rotation}deg)`;
  }

  destroy() {
    this.container = null;
    this.img = null;
  }
}
