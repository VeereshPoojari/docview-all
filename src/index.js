import { DocViewer } from './core/DocViewer.js';
import { detectFormat, formatFileSize, FORMAT_TYPES } from './utils/mimeDetector.js';
import { VirtualScroller } from './core/VirtualScroller.js';
import { HtmlEngine } from './engines/htmlEngine.js';
import { AnalyticsEngine, formatDuration, formatClockTime } from './utils/analyticsEngine.js';
import { parseTranscript, generateVttContent, formatCueTime } from './utils/transcriptParser.js';

// --- Standalone Get & Set Developer Helpers ---

export function getAnalytics(viewer) {
  return viewer && typeof viewer.getAnalytics === 'function' ? viewer.getAnalytics() : null;
}

export function setAnalytics(viewer, data) {
  if (viewer && typeof viewer.setAnalytics === 'function') {
    return viewer.setAnalytics(data);
  }
  return viewer;
}

export function getTimeSpent(viewer) {
  return viewer && typeof viewer.getTimeSpent === 'function' ? viewer.getTimeSpent() : null;
}

export function setTimeSpent(viewer, data) {
  if (viewer && typeof viewer.setTimeSpent === 'function') {
    return viewer.setTimeSpent(data);
  }
  return viewer;
}

export function resetAnalytics(viewer) {
  if (viewer && typeof viewer.resetAnalytics === 'function') {
    return viewer.resetAnalytics();
  }
  return viewer;
}

export function getTranscript(viewer) {
  return viewer && typeof viewer.getTranscript === 'function' ? viewer.getTranscript() : [];
}

export function setTranscript(viewer, input) {
  if (viewer && typeof viewer.setTranscript === 'function') {
    return viewer.setTranscript(input);
  }
  return Promise.resolve([]);
}

export function getHtmlMode(viewer) {
  return viewer && typeof viewer.getHtmlMode === 'function' ? viewer.getHtmlMode() : null;
}

export function setHtmlMode(viewer, mode) {
  if (viewer && typeof viewer.setHtmlMode === 'function') {
    return viewer.setHtmlMode(mode);
  }
  return viewer;
}

export function getPage(viewer) {
  return viewer && typeof viewer.getPage === 'function' ? viewer.getPage() : 1;
}

export function setPage(viewer, pageNumber) {
  if (viewer && typeof viewer.setPage === 'function') {
    return viewer.setPage(pageNumber);
  }
  return viewer;
}

export function getZoom(viewer) {
  return viewer && typeof viewer.getZoom === 'function' ? viewer.getZoom() : 1.0;
}

export function setZoom(viewer, scale) {
  if (viewer && typeof viewer.setZoom === 'function') {
    return viewer.setZoom(scale);
  }
  return viewer;
}

export function getTheme(viewer) {
  return viewer && typeof viewer.getTheme === 'function' ? viewer.getTheme() : 'dark';
}

export function setTheme(viewer, theme) {
  if (viewer && typeof viewer.setTheme === 'function') {
    return viewer.setTheme(theme);
  }
  return viewer;
}

export function isBookMode(viewer) {
  return viewer && typeof viewer.isBookMode === 'function' ? viewer.isBookMode() : false;
}

export function setBookMode(viewer, enabled) {
  if (viewer && typeof viewer.setBookMode === 'function') {
    return viewer.setBookMode(enabled);
  }
  return viewer;
}

export function toggleBookMode(viewer) {
  if (viewer && typeof viewer.toggleBookMode === 'function') {
    return viewer.toggleBookMode();
  }
  return viewer;
}

export {
  DocViewer,
  detectFormat,
  formatFileSize,
  FORMAT_TYPES,
  VirtualScroller,
  HtmlEngine,
  AnalyticsEngine,
  formatDuration,
  formatClockTime,
  parseTranscript,
  generateVttContent,
  formatCueTime
};

export default DocViewer;
