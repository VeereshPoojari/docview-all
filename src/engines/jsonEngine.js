/**
 * Handcrafted Interactive JSON Explorer with collapsible nodes
 */
export class JsonEngine {
  constructor(viewer) {
    this.viewer = viewer;
    this.container = null;
  }

  async render(fileInput, viewport) {
    this.container = document.createElement('div');
    this.container.className = 'dva-json-container';
    viewport.appendChild(this.container);

    let parsed = null;
    try {
      if (typeof fileInput === 'string') {
        if (fileInput.trim().startsWith('{') || fileInput.trim().startsWith('[')) {
          parsed = JSON.parse(fileInput);
        } else {
          const res = await fetch(fileInput);
          parsed = await res.json();
        }
      } else if (fileInput instanceof Blob || fileInput instanceof File) {
        const text = await fileInput.text();
        parsed = JSON.parse(text);
      } else if (typeof fileInput === 'object') {
        parsed = fileInput;
      }
    } catch (e) {
      this.container.innerHTML = `<div style="color: var(--dva-danger);">Invalid JSON: ${e.message}</div>`;
      return;
    }

    this.container.appendChild(this.createNode(parsed, 'root', true));
  }

  createNode(data, key, isRoot = false) {
    const isObject = data !== null && typeof data === 'object';
    const isArray = Array.isArray(data);
    const nodeEl = document.createElement('div');
    nodeEl.className = 'dva-json-node';

    if (isObject) {
      const keys = Object.keys(data);
      const openBracket = isArray ? '[' : '{';
      const closeBracket = isArray ? ']' : '}';

      const header = document.createElement('span');
      header.className = 'dva-json-toggler';
      header.innerHTML = `▼ ${key !== 'root' ? `<span class="dva-tok-attr">"${key}": </span>` : ''}${openBracket} <span style="color: var(--dva-text-muted); font-size: 11px;">(${keys.length} items)</span>`;

      const childrenContainer = document.createElement('div');
      childrenContainer.style.paddingLeft = '14px';

      keys.forEach((childKey) => {
        childrenContainer.appendChild(this.createNode(data[childKey], childKey));
      });

      const footer = document.createElement('div');
      footer.innerHTML = closeBracket;
      footer.style.color = 'var(--dva-text-muted)';

      let isCollapsed = false;
      header.onclick = () => {
        isCollapsed = !isCollapsed;
        childrenContainer.style.display = isCollapsed ? 'none' : 'block';
        header.innerHTML = `${isCollapsed ? '▶' : '▼'} ${key !== 'root' ? `<span class="dva-tok-attr">"${key}": </span>` : ''}${openBracket} <span style="color: var(--dva-text-muted); font-size: 11px;">(${keys.length} items)</span>`;
      };

      nodeEl.appendChild(header);
      nodeEl.appendChild(childrenContainer);
      nodeEl.appendChild(footer);
    } else {
      // Primitive
      const line = document.createElement('div');
      let valHtml = '';
      if (typeof data === 'string') {
        valHtml = `<span class="dva-tok-string">"${data}"</span>`;
      } else if (typeof data === 'number') {
        valHtml = `<span class="dva-tok-number">${data}</span>`;
      } else if (typeof data === 'boolean') {
        valHtml = `<span class="dva-tok-bool">${data}</span>`;
      } else {
        valHtml = `<span class="dva-tok-comment">null</span>`;
      }

      line.innerHTML = `<span class="dva-tok-attr">"${key}": </span>${valHtml}`;
      nodeEl.appendChild(line);
    }

    return nodeEl;
  }

  destroy() {
    this.container = null;
  }
}
