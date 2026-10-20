/**
 * Universal Document Analytics & Engagement Tracker for DocView-All
 * Zero-dependency telemetry for viewing time, per-page duration, and media watch intervals.
 */

export function formatDuration(seconds) {
  const s = Math.max(0, Math.round(seconds || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const remSec = s % 60;

  if (h > 0) {
    return `${h}h ${m < 10 ? '0' : ''}${m}m ${remSec < 10 ? '0' : ''}${remSec}s`;
  }
  if (m > 0) {
    return `${m}m ${remSec < 10 ? '0' : ''}${remSec}s`;
  }
  return `${remSec}s`;
}

export function formatClockTime(seconds) {
  const s = Math.max(0, Math.floor(seconds || 0));
  const m = Math.floor(s / 60);
  const remSec = s % 60;
  return `${m < 10 ? '0' : ''}${m}:${remSec < 10 ? '0' : ''}${remSec}`;
}

export class AnalyticsEngine {
  constructor(viewer, options = {}) {
    this.viewer = viewer;
    this.options = options;

    this.documentName = '';
    this.documentType = '';
    this.sessionStartTime = Date.now();
    this.lastActiveTimestamp = Date.now();
    this.totalActiveSeconds = 0;
    this.isEngaged = true;

    // Page / Slide / Sheet tracking
    this.currentPage = 1;
    this.totalPages = 1;
    this.pageTimes = {}; // { [page]: { seconds: number, visits: number, lastVisited: number } }
    this.pageStartTimestamp = Date.now();

    // Media / Video / Audio tracking
    this.mediaDuration = 0;
    this.currentMediaTime = 0;
    this.maxPositionReached = 0;
    this.watchedIntervals = []; // [{ from: number, to: number }]
    this.isMediaPlaying = false;
    this.mediaPlaybackStartTime = 0;
    this.mediaPlaybackStartPosition = 0;

    // Listeners and timers
    this.tickerInterval = null;
    this.visibilityHandler = null;
    this.windowBlurHandler = null;
    this.windowFocusHandler = null;

    this.init();
    if (options.initialAnalytics) {
      this.setAnalytics(options.initialAnalytics);
    } else if (options.initialTimeSpent) {
      this.setTimeSpent(options.initialTimeSpent);
    }
  }

  init() {
    // 1. Tab visibility handling
    if (typeof document !== 'undefined') {
      this.visibilityHandler = () => {
        if (document.visibilityState === 'hidden') {
          this.pauseEngagement();
        } else {
          this.resumeEngagement();
        }
      };
      document.addEventListener('visibilitychange', this.visibilityHandler);
    }

    if (typeof window !== 'undefined') {
      this.windowBlurHandler = () => this.pauseEngagement();
      this.windowFocusHandler = () => this.resumeEngagement();
      window.addEventListener('blur', this.windowBlurHandler);
      window.addEventListener('focus', this.windowFocusHandler);
    }

    // 2. Active seconds accumulator ticker (every 1 second)
    this.tickerInterval = setInterval(() => {
      if (this.isEngaged) {
        this.totalActiveSeconds += 1;
        this.accumulateCurrentPageTime(1);
        this.lastActiveTimestamp = Date.now();

        if (typeof this.options.onAnalyticsUpdate === 'function') {
          this.options.onAnalyticsUpdate(this.getAnalytics());
        }
      }
    }, 1000);
  }

  setDocumentInfo(fileInfo) {
    if (!fileInfo) return;
    this.documentName = fileInfo.name || 'Document';
    this.documentType = fileInfo.type || fileInfo.ext || 'doc';
  }

  pauseEngagement() {
    if (!this.isEngaged) return;
    this.isEngaged = false;
    if (this.isMediaPlaying) {
      this.recordMediaSegmentEnd();
    }
  }

  resumeEngagement() {
    if (this.isEngaged) return;
    this.isEngaged = true;
    this.lastActiveTimestamp = Date.now();
    this.pageStartTimestamp = Date.now();
  }

  accumulateCurrentPageTime(seconds = 1) {
    const p = String(this.currentPage);
    if (!this.pageTimes[p]) {
      this.pageTimes[p] = { seconds: 0, visits: 1, lastVisited: Date.now() };
    }
    this.pageTimes[p].seconds += seconds;
  }

  // --- Page Navigation Handlers ---

  setPage(pageNumber, totalPages) {
    const target = Math.max(1, parseInt(pageNumber, 10) || 1);
    if (totalPages) {
      this.totalPages = Math.max(1, parseInt(totalPages, 10) || 1);
    }

    if (target === this.currentPage && this.pageTimes[String(target)]) {
      return;
    }

    const previousPage = this.currentPage;
    this.currentPage = target;
    this.pageStartTimestamp = Date.now();

    const targetKey = String(target);
    if (!this.pageTimes[targetKey]) {
      this.pageTimes[targetKey] = { seconds: 0, visits: 1, lastVisited: Date.now() };
    } else {
      this.pageTimes[targetKey].visits += 1;
      this.pageTimes[targetKey].lastVisited = Date.now();
    }

    if (typeof this.options.onTimeSpent === 'function') {
      this.options.onTimeSpent({
        event: 'page_change',
        previousPage,
        currentPage: target,
        analytics: this.getAnalytics()
      });
    }
  }

  // --- Media / Video Playback Tracking ---

  setMediaDuration(duration) {
    this.mediaDuration = Math.max(0, parseFloat(duration) || 0);
  }

  onMediaPlay(currentTime) {
    this.isMediaPlaying = true;
    this.currentMediaTime = Math.max(0, parseFloat(currentTime) || 0);
    this.mediaPlaybackStartTime = Date.now();
    this.mediaPlaybackStartPosition = this.currentMediaTime;
    this.maxPositionReached = Math.max(this.maxPositionReached, this.currentMediaTime);
  }

  onMediaTimeUpdate(currentTime) {
    const pos = Math.max(0, parseFloat(currentTime) || 0);
    this.currentMediaTime = pos;
    this.maxPositionReached = Math.max(this.maxPositionReached, pos);

    if (this.isMediaPlaying) {
      const from = this.mediaPlaybackStartPosition;
      const to = pos;
      if (to > from && (to - from) >= 0.5) {
        this.addWatchedInterval(from, to);
        this.mediaPlaybackStartPosition = pos;
      }
    }
  }

  onMediaPause(currentTime) {
    if (!this.isMediaPlaying) return;
    this.isMediaPlaying = false;
    this.recordMediaSegmentEnd(currentTime);

    if (typeof this.options.onTimeSpent === 'function') {
      this.options.onTimeSpent({
        event: 'media_pause',
        currentPosition: this.currentMediaTime,
        analytics: this.getAnalytics()
      });
    }
  }

  onMediaSeeked(newTime) {
    if (this.isMediaPlaying) {
      this.recordMediaSegmentEnd();
      this.mediaPlaybackStartPosition = Math.max(0, parseFloat(newTime) || 0);
    }
    this.currentMediaTime = Math.max(0, parseFloat(newTime) || 0);
    this.maxPositionReached = Math.max(this.maxPositionReached, this.currentMediaTime);
  }

  recordMediaSegmentEnd(explicitTime = null) {
    const endPos = explicitTime !== null ? parseFloat(explicitTime) : this.currentMediaTime;
    const startPos = this.mediaPlaybackStartPosition;
    if (endPos > startPos) {
      this.addWatchedInterval(startPos, endPos);
    }
    this.mediaPlaybackStartPosition = endPos;
  }

  addWatchedInterval(from, to) {
    if (to <= from) return;
    const start = Math.max(0, parseFloat(from.toFixed(2)));
    const end = Math.max(0, parseFloat(to.toFixed(2)));

    // Merge into intervals list
    const newIntervals = [];
    let merged = false;
    let currentStart = start;
    let currentEnd = end;

    for (const iv of this.watchedIntervals) {
      if (currentEnd < iv.from - 0.5) {
        // completely before
        newIntervals.push(iv);
      } else if (currentStart > iv.to + 0.5) {
        // completely after
        newIntervals.push(iv);
      } else {
        // overlaps or contiguous -> merge
        currentStart = Math.min(currentStart, iv.from);
        currentEnd = Math.max(currentEnd, iv.to);
        merged = true;
      }
    }

    newIntervals.push({ from: currentStart, to: currentEnd });
    newIntervals.sort((a, b) => a.from - b.from);
    this.watchedIntervals = newIntervals;
  }

  getUniqueWatchedSeconds() {
    let total = 0;
    for (const iv of this.watchedIntervals) {
      total += (iv.to - iv.from);
    }
    return Math.round(total * 10) / 10;
  }

  getCompletionPercentage() {
    if (!this.mediaDuration || this.mediaDuration <= 0) return '0%';
    const unique = this.getUniqueWatchedSeconds();
    const pct = Math.min(100, Math.round((unique / this.mediaDuration) * 1000) / 10);
    return `${pct.toFixed(1)}%`;
  }

  // --- Snapshot Analytics Report ---

  getAnalytics() {
    const pageBreakdown = {};
    for (const [page, data] of Object.entries(this.pageTimes)) {
      pageBreakdown[page] = {
        seconds: data.seconds,
        formatted: formatDuration(data.seconds),
        visits: data.visits,
        lastVisited: data.lastVisited
      };
    }

    const uniqueWatched = this.getUniqueWatchedSeconds();
    const formattedIntervals = this.watchedIntervals.map(iv => ({
      from: iv.from,
      to: iv.to,
      formatted: `${formatClockTime(iv.from)} → ${formatClockTime(iv.to)}`
    }));

    return {
      documentName: this.documentName,
      documentType: this.documentType,
      sessionStartTime: this.sessionStartTime,
      lastActiveTimestamp: this.lastActiveTimestamp,
      totalTimeSpentSeconds: this.totalActiveSeconds,
      totalTimeFormatted: formatDuration(this.totalActiveSeconds),
      isEngaged: this.isEngaged,
      currentPage: this.currentPage,
      totalPages: this.totalPages,
      pageBreakdown,
      mediaAnalytics: {
        duration: this.mediaDuration,
        durationFormatted: formatClockTime(this.mediaDuration),
        currentPosition: this.currentMediaTime,
        currentPositionFormatted: formatClockTime(this.currentMediaTime),
        maxPositionReached: this.maxPositionReached,
        maxPositionFormatted: formatClockTime(this.maxPositionReached),
        uniqueWatchedSeconds: uniqueWatched,
        uniqueWatchedFormatted: formatDuration(uniqueWatched),
        completionPercentage: this.getCompletionPercentage(),
        watchedIntervals: formattedIntervals
      }
    };
  }

  getTimeSpent() {
    return {
      totalTimeSpentSeconds: this.totalActiveSeconds,
      totalTimeFormatted: formatDuration(this.totalActiveSeconds),
      pageBreakdown: this.getAnalytics().pageBreakdown
    };
  }

  setAnalytics(data = {}) {
    if (!data || typeof data !== 'object') return;

    if (typeof data.totalTimeSpentSeconds === 'number') {
      this.totalActiveSeconds = Math.max(0, data.totalTimeSpentSeconds);
    }

    if (data.pageBreakdown && typeof data.pageBreakdown === 'object') {
      for (const [page, pData] of Object.entries(data.pageBreakdown)) {
        const sec = typeof pData === 'number' ? pData : (pData?.seconds || 0);
        const visits = typeof pData === 'object' && pData?.visits ? pData.visits : 1;
        const lastVisited = typeof pData === 'object' && pData?.lastVisited ? pData.lastVisited : Date.now();
        this.pageTimes[String(page)] = {
          seconds: Math.max(0, sec),
          visits,
          lastVisited
        };
      }
    }

    const ma = data.mediaAnalytics || data;
    if (ma && typeof ma === 'object') {
      if (typeof ma.maxPositionReached === 'number') {
        this.maxPositionReached = Math.max(this.maxPositionReached, ma.maxPositionReached);
      }
      if (Array.isArray(ma.watchedIntervals)) {
        for (const iv of ma.watchedIntervals) {
          if (typeof iv.from === 'number' && typeof iv.to === 'number') {
            this.addWatchedInterval(iv.from, iv.to);
          }
        }
      }
    }

    if (typeof this.options.onAnalyticsUpdate === 'function') {
      this.options.onAnalyticsUpdate(this.getAnalytics());
    }
  }

  setTimeSpent(data = {}) {
    this.setAnalytics(data);
  }

  resetAnalytics() {
    this.totalActiveSeconds = 0;
    this.pageTimes = {};
    this.watchedIntervals = [];
    this.maxPositionReached = 0;
    this.currentMediaTime = 0;
    this.sessionStartTime = Date.now();
    this.lastActiveTimestamp = Date.now();
    this.pageStartTimestamp = Date.now();

    if (typeof this.options.onAnalyticsUpdate === 'function') {
      this.options.onAnalyticsUpdate(this.getAnalytics());
    }
  }

  getWatchedIntervals() {
    return this.watchedIntervals.map(iv => ({
      from: iv.from,
      to: iv.to,
      formatted: `${formatClockTime(iv.from)} → ${formatClockTime(iv.to)}`
    }));
  }

  setWatchedIntervals(intervals = []) {
    this.watchedIntervals = [];
    if (Array.isArray(intervals)) {
      for (const iv of intervals) {
        if (typeof iv.from === 'number' && typeof iv.to === 'number') {
          this.addWatchedInterval(iv.from, iv.to);
        }
      }
    }
  }

  destroy() {
    if (this.tickerInterval) {
      clearInterval(this.tickerInterval);
      this.tickerInterval = null;
    }

    if (typeof document !== 'undefined' && this.visibilityHandler) {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
      this.visibilityHandler = null;
    }

    if (typeof window !== 'undefined') {
      if (this.windowBlurHandler) window.removeEventListener('blur', this.windowBlurHandler);
      if (this.windowFocusHandler) window.removeEventListener('focus', this.windowFocusHandler);
      this.windowBlurHandler = null;
      this.windowFocusHandler = null;
    }

    if (typeof this.options.onTimeSpent === 'function') {
      this.options.onTimeSpent({
        event: 'session_end',
        analytics: this.getAnalytics()
      });
    }
  }
}
