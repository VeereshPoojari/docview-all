/**
 * Handcrafted 60fps DOM Virtualizer
 * Renders only visible rows + overscan buffer to allow 100,000+ items without UI freeze.
 * Supports both HTML string templates and DOM Node elements.
 */
export class VirtualScroller {
  constructor(options = {}) {
    this.container = options.container;
    this.totalItems = options.totalItems || 0;
    this.itemHeight = options.itemHeight || 36;
    this.overscan = options.overscan || 5;
    this.renderRow = options.renderRow || (() => '');

    this.scrollTop = 0;
    this.visibleCount = 0;
    this.startIndex = 0;
    this.endIndex = 0;

    this.wrapper = null;
    this.content = null;
    this._onScroll = this._onScroll.bind(this);

    this.init();
  }

  init() {
    this.container.innerHTML = '';
    this.container.style.position = 'relative';
    this.container.style.overflow = 'auto';

    // Spacer to trigger natural native scrollbar of total height
    this.wrapper = document.createElement('div');
    this.wrapper.style.width = '100%';
    this.wrapper.style.height = `${this.totalItems * this.itemHeight}px`;
    this.wrapper.style.position = 'relative';

    // Container holding only the currently visible slice of DOM nodes
    this.content = document.createElement('div');
    this.content.style.position = 'absolute';
    this.content.style.top = '0';
    this.content.style.left = '0';
    this.content.style.right = '0';

    this.wrapper.appendChild(this.content);
    this.container.appendChild(this.wrapper);

    this.container.addEventListener('scroll', this._onScroll, { passive: true });
    this.updateDimensions();
    this.render();
  }

  updateDimensions() {
    const containerHeight = this.container.clientHeight || 400;
    this.visibleCount = Math.ceil(containerHeight / this.itemHeight);
  }

  setTotalItems(count) {
    this.totalItems = count;
    if (this.wrapper) {
      this.wrapper.style.height = `${this.totalItems * this.itemHeight}px`;
    }
    this.render();
  }

  _onScroll() {
    this.scrollTop = this.container.scrollTop;
    this.render();
  }

  render() {
    const start = Math.floor(this.scrollTop / this.itemHeight);
    this.startIndex = Math.max(0, start - this.overscan);
    this.endIndex = Math.min(this.totalItems, start + this.visibleCount + this.overscan);

    const offsetY = this.startIndex * this.itemHeight;
    this.content.style.transform = `translateY(${offsetY}px)`;

    let html = '';
    const fragment = document.createDocumentFragment();
    let isNodeMode = false;

    for (let i = this.startIndex; i < this.endIndex; i++) {
      const row = this.renderRow(i);
      if (row instanceof Node) {
        isNodeMode = true;
        fragment.appendChild(row);
      } else if (typeof row === 'string') {
        html += row;
      }
    }

    if (isNodeMode) {
      this.content.innerHTML = '';
      this.content.appendChild(fragment);
    } else {
      this.content.innerHTML = html;
    }
  }

  destroy() {
    if (this.container) {
      this.container.removeEventListener('scroll', this._onScroll);
    }
  }
}
