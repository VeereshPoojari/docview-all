/**
 * Fallback Engine for Binary and Unsupported File Types
 */
import { formatFileSize } from '../utils/mimeDetector.js';
import { ICONS } from '../core/Toolbar.js';

export class FallbackEngine {
  constructor(viewer) {
    this.viewer = viewer;
    this.container = null;
  }

  async render(fileInput, viewport) {
    this.container = document.createElement('div');
    this.container.style.display = 'flex';
    this.container.style.flexDirection = 'column';
    this.container.style.alignItems = 'center';
    this.container.style.justifyContent = 'center';
    this.container.style.padding = '40px';
    this.container.style.gap = '16px';
    this.container.style.textAlign = 'center';

    const info = this.viewer.currentFileInfo || { name: 'File', ext: 'FILE' };
    const size = fileInput instanceof File ? formatFileSize(fileInput.size) : 'Unknown size';

    this.container.innerHTML = `
      <div style="width: 64px; height: 64px; border-radius: 16px; background: var(--dva-primary-glow); color: var(--dva-primary); display: flex; align-items: center; justify-content: center;">
        ${ICONS.download}
      </div>
      <div>
        <h3 style="margin: 0; font-size: 18px; color: var(--dva-text);">${info.name}</h3>
        <p style="margin: 6px 0 0; font-size: 13px; color: var(--dva-text-secondary);">${info.ext.toUpperCase()} File &bull; ${size}</p>
      </div>
      <button class="dva-btn" id="dva-fb-download" style="width: auto; height: 38px; padding: 0 18px; gap: 8px; background: var(--dva-primary); color: #fff; font-weight: 600; border-radius: 8px;">
        ${ICONS.download} Download File
      </button>
    `;

    viewport.appendChild(this.container);

    const btn = this.container.querySelector('#dva-fb-download');
    if (btn) {
      btn.onclick = () => this.viewer.download();
    }
  }

  destroy() {
    this.container = null;
  }
}
