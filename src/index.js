import { DocViewer } from './core/DocViewer.js';
import { detectFormat, formatFileSize, FORMAT_TYPES } from './utils/mimeDetector.js';
import { VirtualScroller } from './core/VirtualScroller.js';

export {
  DocViewer,
  detectFormat,
  formatFileSize,
  FORMAT_TYPES,
  VirtualScroller
};

export default DocViewer;
