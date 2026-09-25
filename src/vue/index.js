import { DocViewer as CoreViewer } from '../core/DocViewer.js';

/**
 * DocViewer Vue 3 Component & Plugin
 */
export const DocViewer = {
  name: 'DocViewer',
  props: {
    file: {
      type: [String, Object, typeof File !== 'undefined' ? File : Object, typeof Blob !== 'undefined' ? Blob : Object],
      default: null
    },
    theme: {
      type: String,
      default: 'dark'
    },
    showToolbar: {
      type: Boolean,
      default: true
    }
  },
  emits: ['load'],
  mounted() {
    this.viewer = new CoreViewer(this.$el, {
      file: this.file,
      theme: this.theme,
      showToolbar: this.showToolbar,
      onLoad: (info) => this.$emit('load', info)
    });
  },
  watch: {
    file(newVal) {
      if (this.viewer && newVal) {
        this.viewer.loadFile(newVal);
      }
    },
    theme(newVal) {
      if (this.viewer && newVal !== this.viewer.theme) {
        this.viewer.toggleTheme();
      }
    }
  },
  beforeUnmount() {
    if (this.viewer) {
      this.viewer.destroy();
      this.viewer = null;
    }
  },
  template: `<div class="dva-vue-wrapper" style="width: 100%; height: 100%; min-height: 400px;"></div>`
};

export default DocViewer;
