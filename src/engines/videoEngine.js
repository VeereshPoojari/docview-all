/**
 * Chunked Media Streaming & Video Engine (HTML5 MSE / MPEG-DASH / HLS / Standard Video)
 * Supports MPEG-DASH (.mpd), HLS (.m3u8), and standard video formats (.mp4, .webm, .ogg)
 * 
 * Features:
 * - ⏱️ Live Watch Range & Segments Analytics (From X to Y watched intervals, unique time, completion %)
 * - 📝 Interactive Synchronized Transcript Panel (Live active cue glow, smooth auto-scroll, click-to-seek, keyword search)
 * - 📤 On-the-fly Transcript / Subtitle Upload (.vtt, .srt, .json, .txt) with native HTML5 closed captions track
 * - 📋 DASH Manifest Inspector & XML code view
 */

import { parseTranscript, generateVttContent, formatCueTime } from '../utils/transcriptParser.js';
import { formatClockTime, formatDuration } from '../utils/analyticsEngine.js';

function loadScript(url, globalName) {
  if (globalName && window[globalName]) {
    return Promise.resolve(window[globalName]);
  }
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${url}"]`);
    if (existing) {
      if (globalName && window[globalName]) return resolve(window[globalName]);
      existing.addEventListener('load', () => resolve(window[globalName]));
      existing.addEventListener('error', () => reject(new Error(`Failed to load ${url}`)));
      return;
    }
    const script = document.createElement('script');
    script.src = url;
    script.async = true;
    script.onload = () => resolve(globalName ? window[globalName] : null);
    script.onerror = () => reject(new Error(`Failed to load ${url}`));
    document.head.appendChild(script);
  });
}

function formatIsoDuration(isoDuration) {
  if (!isoDuration) return 'Live / Unknown';
  const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:([\d.]+)S)?/i);
  if (!match) return isoDuration;
  const h = parseInt(match[1] || '0', 10);
  const m = parseInt(match[2] || '0', 10);
  const s = Math.round(parseFloat(match[3] || '0'));
  const parts = [];
  if (h > 0) parts.push(`${h}h`);
  if (m > 0 || h > 0) parts.push(`${m}m`);
  parts.push(`${s}s`);
  return parts.join(' ') || '0s';
}

function formatBandwidth(bw) {
  const num = parseInt(bw, 10);
  if (isNaN(num)) return bw || '';
  if (num >= 1000000) return (num / 1000000).toFixed(1) + ' Mbps';
  if (num >= 1000) return Math.round(num / 1000) + ' kbps';
  return num + ' bps';
}

function highlightXml(xmlString) {
  if (!xmlString) return '';
  return xmlString
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/(&lt;\/?)([\w:-]+)/g, '$1<span style="color:#60a5fa;font-weight:600;">$2</span>')
    .replace(/([\w:-]+)=(&quot;|"|')([^"']*)(&quot;|"|')/g, '<span style="color:#fbbf24;">$1</span>=<span style="color:#34d399;">"$3"</span>')
    .replace(/(&lt;!--[\s\S]*?--&gt;)/g, '<span style="color:#6b7280;font-style:italic;">$1</span>');
}

function parseMpdManifest(xmlText) {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlText, 'application/xml');
    const mpd = doc.querySelector('MPD') || doc.documentElement;

    const profiles = mpd?.getAttribute('profiles') || 'MPEG-DASH';
    const type = mpd?.getAttribute('type') || 'static';
    const duration = formatIsoDuration(mpd?.getAttribute('mediaPresentationDuration') || '');
    const minBufferTime = mpd?.getAttribute('minBufferTime') || '';

    const videoTracks = [];
    const audioTracks = [];

    const adaptationSets = doc.querySelectorAll('AdaptationSet');
    adaptationSets.forEach(as => {
      const contentType = (as.getAttribute('contentType') || '').toLowerCase();
      const mimeType = (as.getAttribute('mimeType') || '').toLowerCase();
      const isVideo = contentType === 'video' || mimeType.includes('video');
      const isAudio = contentType === 'audio' || mimeType.includes('audio');

      const representations = as.querySelectorAll('Representation');
      representations.forEach(rep => {
        const bw = formatBandwidth(rep.getAttribute('bandwidth'));
        const width = rep.getAttribute('width') || as.getAttribute('width');
        const height = rep.getAttribute('height') || as.getAttribute('height');
        const codecs = rep.getAttribute('codecs') || as.getAttribute('codecs') || '';
        const frameRate = rep.getAttribute('frameRate') || as.getAttribute('frameRate') || '';
        const samplingRate = rep.getAttribute('audioSamplingRate') || as.getAttribute('audioSamplingRate') || '';
        const lang = as.getAttribute('lang') || 'default';

        if (isVideo || width || height) {
          videoTracks.push({
            id: rep.getAttribute('id') || 'video',
            resolution: width && height ? `${width}x${height}` : '',
            bandwidth: bw,
            codecs,
            frameRate
          });
        } else if (isAudio || samplingRate) {
          audioTracks.push({
            id: rep.getAttribute('id') || 'audio',
            bandwidth: bw,
            samplingRate: samplingRate ? `${samplingRate} Hz` : '',
            codecs,
            lang
          });
        }
      });
    });

    return { profiles, type, duration, minBufferTime, videoTracks, audioTracks };
  } catch {
    return { profiles: 'MPEG-DASH', type: 'static', duration: '', minBufferTime: '', videoTracks: [], audioTracks: [] };
  }
}

export class VideoEngine {
  constructor(viewer) {
    this.viewer = viewer;
    this.container = null;
    this.stageLayout = null;
    this.videoWrapper = null;
    this.video = null;
    this.objectUrl = null;
    this.dashPlayer = null;
    this.hlsPlayer = null;
    this.manifestPanel = null;
    this.streamHeader = null;
    this.streamNotice = null;
    this.rawXmlText = '';
    this.currentView = 'stream';

    // Transcript & Subtitles
    this.transcriptCues = [];
    this.isTranscriptOpen = false;
    this.activeCueIndex = -1;
    this.transcriptTrack = null;
    this.transcriptPanel = null;
    this.vttBlobUrl = null;
    this.transcriptSearchQuery = '';
    this.uploadInput = null;
  }

  async render(fileInput, viewport) {
    this.container = document.createElement('div');
    this.container.className = 'dva-video-container';

    // Master Stage Layout (Holds Video + Transcript Side Panel)
    this.stageLayout = document.createElement('div');
    this.stageLayout.className = 'dva-video-stage-layout';

    // Video Wrapper
    this.videoWrapper = document.createElement('div');
    this.videoWrapper.className = 'dva-video-wrapper';

    this.video = document.createElement('video');
    this.video.className = 'dva-video-element';
    this.video.controls = true;
    this.video.playsInline = true;
    this.video.preload = 'metadata';

    this.videoWrapper.appendChild(this.video);
    this.stageLayout.appendChild(this.videoWrapper);

    // Resolve URL / Source
    let src = '';
    if (typeof fileInput === 'string') {
      src = fileInput;
    } else if (fileInput instanceof Blob || fileInput instanceof File) {
      this.objectUrl = URL.createObjectURL(fileInput);
      src = this.objectUrl;
    }

    // Comprehensive format detection
    const fileName = (typeof fileInput === 'string'
      ? fileInput.split('?')[0].split('#')[0].split('/').pop()
      : (fileInput?.name || '')).toLowerCase();

    const isDash = fileName.endsWith('.mpd') ||
                   (typeof fileInput === 'string' && fileInput.toLowerCase().includes('.mpd')) ||
                   !!(this.viewer?.currentFileInfo?.isDash) ||
                   (this.viewer?.currentFileInfo?.ext === 'mpd');

    const isHls = fileName.endsWith('.m3u8') ||
                  (typeof fileInput === 'string' && fileInput.toLowerCase().includes('.m3u8')) ||
                  !!(this.viewer?.currentFileInfo?.isHls) ||
                  (this.viewer?.currentFileInfo?.ext === 'm3u8');

    if (isDash) {
      await this.initDashStream(fileInput, src);
    } else if (isHls) {
      await this.initHlsStream(src);
    } else {
      // Standard video streaming (MP4, WebM, OGG, MOV)
      this.video.src = src;
      const ext = (this.viewer?.currentFileInfo?.ext || 'MP4').toUpperCase();
      this.renderStreamHeader(ext, null);
    }

    // Setup Telemetry and Transcript
    this.setupVideoAnalytics();
    await this.setupInitialTranscript();
    this.renderTranscriptPanel();

    this.container.appendChild(this.stageLayout);
    viewport.appendChild(this.container);
  }

  setupVideoAnalytics() {
    if (!this.video) return;

    this.video.addEventListener('loadedmetadata', () => {
      if (this.viewer?.analytics) {
        this.viewer.analytics.setMediaDuration(this.video.duration);
      }
      this.updateWatchTelemetryBadge();
    });

    this.video.addEventListener('play', () => {
      if (this.viewer?.analytics) {
        this.viewer.analytics.onMediaPlay(this.video.currentTime);
      }
    });

    this.video.addEventListener('timeupdate', () => {
      if (this.viewer?.analytics) {
        this.viewer.analytics.onMediaTimeUpdate(this.video.currentTime);
      }
      this.updateWatchTelemetryBadge();
      this.syncActiveTranscriptCue(this.video.currentTime);
    });

    this.video.addEventListener('pause', () => {
      if (this.viewer?.analytics) {
        this.viewer.analytics.onMediaPause(this.video.currentTime);
      }
      this.updateWatchTelemetryBadge();
    });

    this.video.addEventListener('seeked', () => {
      if (this.viewer?.analytics) {
        this.viewer.analytics.onMediaSeeked(this.video.currentTime);
      }
      this.updateWatchTelemetryBadge();
    });

    this.video.addEventListener('ended', () => {
      if (this.viewer?.analytics) {
        this.viewer.analytics.onMediaPause(this.video.currentTime);
      }
      this.updateWatchTelemetryBadge();
    });
  }

  updateWatchTelemetryBadge() {
    const badge = this.container?.querySelector('#dva-video-watch-telemetry');
    if (!badge || !this.viewer?.analytics) return;

    const stats = this.viewer.analytics.getAnalytics().mediaAnalytics;
    if (stats.duration > 0) {
      badge.innerHTML = `⏱️ ${stats.currentPositionFormatted} / ${stats.durationFormatted} (${stats.completionPercentage} watched)`;
      badge.title = `Watch intervals: ${stats.watchedIntervals.map(i => i.formatted).join(', ') || 'None yet'}`;
    }
  }

  async setupInitialTranscript() {
    const optTranscript = this.viewer?.options?.transcript;
    if (!optTranscript) return;

    try {
      if (typeof optTranscript === 'string') {
        if (optTranscript.trim().startsWith('[') || optTranscript.includes('-->')) {
          this.transcriptCues = parseTranscript(optTranscript);
        } else {
          // URL
          const res = await fetch(optTranscript);
          if (res.ok) {
            const text = await res.text();
            this.transcriptCues = parseTranscript(text);
          }
        }
      } else if (Array.isArray(optTranscript)) {
        this.transcriptCues = parseTranscript(optTranscript);
      }
      if (this.transcriptCues.length > 0) {
        this.bindNativeSubtitlesTrack();
      }
    } catch (e) {
      console.warn('[DocViewAll] Could not load transcript:', e);
    }
  }

  bindNativeSubtitlesTrack() {
    if (!this.video || this.transcriptCues.length === 0) return;

    try {
      // Remove old track if exists
      const oldTracks = this.video.querySelectorAll('track');
      oldTracks.forEach(t => t.remove());

      if (this.vttBlobUrl) {
        URL.revokeObjectURL(this.vttBlobUrl);
      }

      const vttContent = generateVttContent(this.transcriptCues);
      const blob = new Blob([vttContent], { type: 'text/vtt;charset=utf-8' });
      this.vttBlobUrl = URL.createObjectURL(blob);

      const track = document.createElement('track');
      track.kind = 'subtitles';
      track.label = 'Transcript / Captions';
      track.srclang = 'en';
      track.src = this.vttBlobUrl;
      track.default = true;

      this.video.appendChild(track);
      this.transcriptTrack = track;
    } catch (err) {
      console.warn('[DocViewAll] Could not attach native track:', err);
    }
  }

  renderTranscriptPanel() {
    this.transcriptPanel = document.createElement('div');
    this.transcriptPanel.className = 'dva-transcript-panel';
    this.transcriptPanel.style.display = 'none';

    this.transcriptPanel.innerHTML = `
      <div class="dva-transcript-header">
        <div class="dva-transcript-header-left">
          <span class="dva-transcript-title">📝 Interactive Transcript</span>
          <span class="dva-transcript-count" id="dva-cue-count-badge">${this.transcriptCues.length} cues</span>
        </div>
        <div class="dva-transcript-header-right">
          <button class="dva-transcript-mini-btn" id="dva-btn-close-transcript" title="Close Transcript Panel">✕</button>
        </div>
      </div>

      <div class="dva-transcript-search-wrap">
        <svg class="dva-transcript-search-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
        <input 
          type="text" 
          class="dva-transcript-search-input" 
          id="dva-transcript-search" 
          placeholder="Search keywords in transcript..." 
          autocomplete="off"
        />
        <button class="dva-transcript-search-clear" id="dva-transcript-clear-search" style="display: none;">✕</button>
      </div>

      <div class="dva-transcript-list" id="dva-transcript-list"></div>
    `;

    // Search events
    const searchInput = this.transcriptPanel.querySelector('#dva-transcript-search');
    const searchClear = this.transcriptPanel.querySelector('#dva-transcript-clear-search');

    if (searchInput) {
      searchInput.oninput = (e) => {
        this.transcriptSearchQuery = (e.target.value || '').trim().toLowerCase();
        if (searchClear) searchClear.style.display = this.transcriptSearchQuery ? 'inline-flex' : 'none';
        this.updateTranscriptCuesList();
      };
    }

    if (searchClear && searchInput) {
      searchClear.onclick = () => {
        searchInput.value = '';
        this.transcriptSearchQuery = '';
        searchClear.style.display = 'none';
        this.updateTranscriptCuesList();
        searchInput.focus();
      };
    }

    const closeBtn = this.transcriptPanel.querySelector('#dva-btn-close-transcript');
    if (closeBtn) {
      closeBtn.onclick = () => this.toggleTranscript(false);
    }

    this.stageLayout.appendChild(this.transcriptPanel);
    this.updateTranscriptCuesList();
  }

  updateTranscriptCuesList() {
    const list = this.transcriptPanel?.querySelector('#dva-transcript-list');
    const countBadge = this.transcriptPanel?.querySelector('#dva-cue-count-badge');
    if (!list) return;

    if (this.transcriptCues.length === 0) {
      list.innerHTML = `
        <div class="dva-transcript-empty">
          <div style="font-size: 24px; margin-bottom: 6px;">📝</div>
          <div>No transcript loaded yet.</div>
          <div style="font-size: 11.5px; color: var(--dva-text-muted); margin-top: 4px;">Click "Upload Transcript" to load .vtt, .srt, or .json file.</div>
        </div>
      `;
      if (countBadge) countBadge.textContent = '0 cues';
      return;
    }

    const q = this.transcriptSearchQuery;
    let matchCount = 0;

    const html = this.transcriptCues.map((cue, idx) => {
      const isMatch = !q || cue.text.toLowerCase().includes(q);
      if (isMatch) matchCount++;

      const isCurrent = this.activeCueIndex === idx;
      const rowStyle = isMatch ? '' : 'display: none;';
      const activeClass = isCurrent ? 'dva-cue-active' : '';

      return `
        <div class="dva-transcript-item ${activeClass}" data-cue-idx="${idx}" style="${rowStyle}">
          <button class="dva-cue-time" data-start="${cue.start}" title="Jump video to ${formatCueTime(cue.start)}">
            ${formatCueTime(cue.start)}
          </button>
          <span class="dva-cue-text">${this.escape(cue.text)}</span>
        </div>
      `;
    }).join('');

    list.innerHTML = html;

    if (countBadge) {
      countBadge.textContent = q ? `${matchCount} found` : `${this.transcriptCues.length} cues`;
    }

    // Bind click-to-seek
    list.querySelectorAll('.dva-transcript-item').forEach(item => {
      item.onclick = () => {
        const idx = parseInt(item.getAttribute('data-cue-idx'), 10);
        const cue = this.transcriptCues[idx];
        if (cue && this.video) {
          this.video.currentTime = cue.start;
          this.video.play();
          this.activeCueIndex = idx;
          this.syncActiveTranscriptCue(cue.start);
        }
      };
    });
  }

  syncActiveTranscriptCue(currentTime) {
    if (!this.transcriptPanel || this.transcriptCues.length === 0) return;

    const activeIdx = this.transcriptCues.findIndex(c => currentTime >= c.start && currentTime <= c.end);
    if (activeIdx !== -1 && activeIdx !== this.activeCueIndex) {
      this.activeCueIndex = activeIdx;

      const items = this.transcriptPanel.querySelectorAll('.dva-transcript-item');
      items.forEach((item, idx) => {
        item.classList.toggle('dva-cue-active', idx === activeIdx);
      });

      const activeEl = this.transcriptPanel.querySelector(`.dva-transcript-item[data-cue-idx="${activeIdx}"]`);
      if (activeEl && this.isTranscriptOpen) {
        activeEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }

  toggleTranscript(forceState = null) {
    this.isTranscriptOpen = forceState !== null ? forceState : !this.isTranscriptOpen;
    if (this.transcriptPanel) {
      this.transcriptPanel.style.display = this.isTranscriptOpen ? 'flex' : 'none';
    }

    const btn = this.container?.querySelector('#dva-btn-view-transcript');
    if (btn) {
      btn.classList.toggle('active', this.isTranscriptOpen);
    }

    if (this.isTranscriptOpen) {
      this.syncActiveTranscriptCue(this.video?.currentTime || 0);
    }
  }

  getTranscript() {
    return this.transcriptCues || [];
  }

  async setTranscript(input) {
    if (!input) {
      this.transcriptCues = [];
      const oldTracks = this.video?.querySelectorAll('track');
      oldTracks?.forEach(t => t.remove());
      this.updateTranscriptCuesList();
      return [];
    }
    const cues = await parseTranscript(input);
    this.transcriptCues = cues;
    this.bindNativeSubtitlesTrack();
    this.updateTranscriptCuesList();
    this.toggleTranscript(true);
    return cues;
  }

  async initDashStream(fileInput, src) {
    try {
      if (fileInput instanceof Blob || fileInput instanceof File) {
        this.rawXmlText = await fileInput.text();
      } else if (typeof fileInput === 'string') {
        const res = await fetch(fileInput);
        if (res.ok) {
          this.rawXmlText = await res.text();
        }
      }
    } catch {
      // Network/CORS or read failure
    }

    const manifestInfo = this.rawXmlText ? parseMpdManifest(this.rawXmlText) : null;
    this.renderStreamHeader('MPEG-DASH', manifestInfo);
    this.renderManifestPanel(manifestInfo);

    try {
      if (!window.dashjs) {
        this.viewer?.notify('Loading MPEG-DASH streaming player...', 'info', 2000);
        await loadScript('https://cdn.jsdelivr.net/npm/dashjs@4.7.4/dist/dash.all.min.js', 'dashjs');
      }

      if (window.dashjs) {
        this.dashPlayer = window.dashjs.MediaPlayer().create();
        this.dashPlayer.initialize(this.video, src, false);

        this.dashPlayer.on(window.dashjs.MediaPlayer.events.ERROR, (e) => {
          this.showStreamNotice(
            '⚠️ DASH media chunks (.m4s) could not be loaded relative to standalone manifest. Switch to Manifest Inspector to view stream tracks & XML.',
            true
          );
        });
      } else {
        throw new Error('DASH.js library not available');
      }
    } catch (err) {
      this.showStreamNotice(
        '⚠️ DASH engine initialisation failed. Switch to Manifest Inspector to view stream structure.',
        true
      );
    }
  }

  async initHlsStream(src) {
    this.renderStreamHeader('HLS', null);

    if (this.video.canPlayType('application/vnd.apple.mpegurl')) {
      this.video.src = src;
    } else {
      try {
        if (!window.Hls) {
          this.viewer?.notify('Loading HLS streaming player...', 'info', 2000);
          await loadScript('https://cdn.jsdelivr.net/npm/hls.js@1.5.8/dist/hls.min.js', 'Hls');
        }

        if (window.Hls && window.Hls.isSupported()) {
          this.hlsPlayer = new window.Hls({ maxBufferLength: 30 });
          this.hlsPlayer.loadSource(src);
          this.hlsPlayer.attachMedia(this.video);
        } else {
          this.video.src = src;
        }
      } catch {
        this.video.src = src;
      }
    }
  }

  renderStreamHeader(protocol, manifestInfo) {
    this.streamHeader = document.createElement('div');
    this.streamHeader.className = 'dva-stream-header';

    const isDash = protocol === 'MPEG-DASH';
    const isHls = protocol === 'HLS';
    let badgeClass = 'dva-stream-badge';
    if (isHls) badgeClass = 'dva-stream-badge dva-stream-badge-hls';

    let extraChips = '';
    if (manifestInfo) {
      if (manifestInfo.duration) extraChips += `<span class="dva-manifest-chip">⏱ ${manifestInfo.duration}</span>`;
      if (manifestInfo.videoTracks.length > 0 && manifestInfo.videoTracks[0].resolution) {
        extraChips += `<span class="dva-manifest-chip">🎬 ${manifestInfo.videoTracks[0].resolution}</span>`;
      }
    }

    this.streamHeader.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
        <span class="${badgeClass}">🎬 ${protocol}</span>
        ${extraChips}
        <span class="dva-manifest-chip" id="dva-video-watch-telemetry" style="background: rgba(16, 185, 129, 0.12); color: #10b981; border-color: rgba(16, 185, 129, 0.3);">⏱️ 00:00 (0%)</span>
      </div>

      <div class="dva-stream-nav">
        <!-- Interactive Transcript Toggle -->
        <button class="dva-stream-btn" id="dva-btn-view-transcript" title="Toggle Interactive Synchronized Transcript">
          📝 Transcript
        </button>

        <!-- Upload Transcript / Subtitles -->
        <button class="dva-stream-btn" id="dva-btn-upload-transcript" title="Upload WebVTT (.vtt), SRT (.srt), or JSON Subtitles">
          📤 Upload Subtitles
        </button>
        <input type="file" id="dva-transcript-file-input" accept=".vtt,.srt,.json,.txt" style="display: none;" />

        ${isDash ? `
        <button class="dva-stream-btn" id="dva-btn-view-manifest">
          📋 Manifest
        </button>
        ` : ''}
      </div>
    `;

    const btnTranscript = this.streamHeader.querySelector('#dva-btn-view-transcript');
    const btnUpload = this.streamHeader.querySelector('#dva-btn-upload-transcript');
    const fileInput = this.streamHeader.querySelector('#dva-transcript-file-input');
    const btnManifest = this.streamHeader.querySelector('#dva-btn-view-manifest');

    if (btnTranscript) {
      btnTranscript.onclick = () => this.toggleTranscript();
    }

    if (btnUpload && fileInput) {
      btnUpload.onclick = () => fileInput.click();
      fileInput.onchange = async (e) => {
        if (e.target.files && e.target.files[0]) {
          const file = e.target.files[0];
          try {
            const text = await file.text();
            this.transcriptCues = parseTranscript(text);
            this.bindNativeSubtitlesTrack();
            this.updateTranscriptCuesList();
            this.toggleTranscript(true);
            if (this.viewer?.notify) {
              this.viewer.notify(`Loaded transcript: ${file.name} (${this.transcriptCues.length} cues)`, 'success');
            }
          } catch (err) {
            if (this.viewer?.notify) {
              this.viewer.notify(`Failed to parse transcript: ${err.message}`, 'error');
            }
          }
        }
      };
    }

    if (btnManifest) {
      btnManifest.onclick = () => this.switchView(this.currentView === 'manifest' ? 'stream' : 'manifest');
    }

    this.container.appendChild(this.streamHeader);
  }

  renderManifestPanel(manifestInfo) {
    this.manifestPanel = document.createElement('div');
    this.manifestPanel.className = 'dva-manifest-panel';
    this.manifestPanel.style.display = 'none';

    let chipsHtml = '';
    if (manifestInfo) {
      chipsHtml += `<span class="dva-manifest-chip">Type: ${manifestInfo.type.toUpperCase()}</span>`;
      if (manifestInfo.duration) chipsHtml += `<span class="dva-manifest-chip">Duration: ${manifestInfo.duration}</span>`;
      if (manifestInfo.minBufferTime) chipsHtml += `<span class="dva-manifest-chip">Buffer: ${manifestInfo.minBufferTime}</span>`;
      manifestInfo.videoTracks.forEach(t => {
        chipsHtml += `<span class="dva-manifest-chip" style="color: #60a5fa;">🎬 ${t.resolution || 'Video'} (${t.bandwidth || 'auto'})${t.codecs ? ' • ' + t.codecs : ''}</span>`;
      });
      manifestInfo.audioTracks.forEach(a => {
        chipsHtml += `<span class="dva-manifest-chip" style="color: #34d399;">🔊 Audio (${a.bandwidth || 'auto'})${a.lang ? ' • ' + a.lang : ''}</span>`;
      });
    }

    this.manifestPanel.innerHTML = `
      <div class="dva-manifest-summary">
        <div style="display: flex; gap: 6px; align-items: center; flex: 1; flex-wrap: wrap;">
          ${chipsHtml}
        </div>
        <button class="dva-stream-btn" id="dva-btn-copy-manifest" title="Copy XML to Clipboard">
          📋 Copy Manifest XML
        </button>
      </div>
      <pre class="dva-manifest-code" id="dva-manifest-code">${highlightXml(this.rawXmlText || '<!-- No manifest XML loaded -->')}</pre>
    `;

    const copyBtn = this.manifestPanel.querySelector('#dva-btn-copy-manifest');
    if (copyBtn) {
      copyBtn.onclick = () => {
        if (!this.rawXmlText) return;
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(this.rawXmlText).then(() => {
            copyBtn.textContent = '✓ Copied!';
            setTimeout(() => { copyBtn.textContent = '📋 Copy Manifest XML'; }, 2000);
          });
        }
      };
    }

    this.container.appendChild(this.manifestPanel);
  }

  switchView(viewName) {
    this.currentView = viewName;
    const btnManifest = this.container.querySelector('#dva-btn-view-manifest');

    if (viewName === 'stream') {
      if (this.stageLayout) this.stageLayout.style.display = 'flex';
      if (this.manifestPanel) this.manifestPanel.style.display = 'none';
      if (btnManifest) btnManifest.classList.remove('active');
    } else {
      if (this.stageLayout) this.stageLayout.style.display = 'none';
      if (this.manifestPanel) this.manifestPanel.style.display = 'flex';
      if (btnManifest) btnManifest.classList.add('active');
    }
  }

  showStreamNotice(message, showInspectBtn = false) {
    if (!this.videoWrapper) return;
    if (this.streamNotice && this.streamNotice.parentNode) {
      this.streamNotice.parentNode.removeChild(this.streamNotice);
    }

    this.streamNotice = document.createElement('div');
    this.streamNotice.className = 'dva-stream-notice';
    this.streamNotice.innerHTML = `
      <span>${message}</span>
      ${showInspectBtn ? `
      <button class="dva-stream-btn active" id="dva-btn-notice-inspect" style="padding: 4px 10px; font-size: 11px;">
        Inspect Manifest XML
      </button>
      ` : ''}
      <button style="background: none; border: none; color: #94a3b8; font-size: 16px; cursor: pointer; padding: 0 4px;" id="dva-btn-notice-close">✕</button>
    `;

    const closeBtn = this.streamNotice.querySelector('#dva-btn-notice-close');
    if (closeBtn) closeBtn.onclick = () => this.streamNotice.remove();

    const inspectBtn = this.streamNotice.querySelector('#dva-btn-notice-inspect');
    if (inspectBtn) inspectBtn.onclick = () => this.switchView('manifest');

    this.videoWrapper.appendChild(this.streamNotice);
  }

  escape(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  updateTransform() {
    if (!this.video) return;
    const scale = this.viewer?.scale || 1;
    this.video.style.transform = `scale(${scale})`;
  }

  destroy() {
    if (this.dashPlayer) {
      try {
        this.dashPlayer.reset();
        this.dashPlayer.destroy();
      } catch {}
      this.dashPlayer = null;
    }

    if (this.hlsPlayer) {
      try {
        this.hlsPlayer.destroy();
      } catch {}
      this.hlsPlayer = null;
    }

    if (this.video) {
      this.video.pause();
      this.video.removeAttribute('src');
      this.video.load();
    }

    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = null;
    }

    if (this.vttBlobUrl) {
      URL.revokeObjectURL(this.vttBlobUrl);
      this.vttBlobUrl = null;
    }

    this.container = null;
    this.stageLayout = null;
    this.videoWrapper = null;
    this.video = null;
    this.manifestPanel = null;
    this.streamHeader = null;
    this.streamNotice = null;
    this.transcriptPanel = null;
    this.transcriptCues = [];
  }
}
