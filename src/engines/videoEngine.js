/**
 * Chunked Media Streaming & Video Engine (HTML5 MSE / MPEG-DASH / HLS / Standard Video)
 * Supports MPEG-DASH (.mpd), HLS (.m3u8), and standard video formats (.mp4, .webm, .ogg)
 * Featuring dynamic player loading, DASH manifest parsing, dual Stream & Manifest inspection
 */

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
  }

  async render(fileInput, viewport) {
    this.container = document.createElement('div');
    this.container.className = 'dva-video-container';

    // Video Wrapper
    this.videoWrapper = document.createElement('div');
    this.videoWrapper.className = 'dva-video-wrapper';

    this.video = document.createElement('video');
    this.video.className = 'dva-video-element';
    this.video.controls = true;
    this.video.playsInline = true;
    this.video.preload = 'metadata';

    this.videoWrapper.appendChild(this.video);

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
      // Standard video streaming
      this.video.src = src;
    }

    this.container.appendChild(this.videoWrapper);
    viewport.appendChild(this.container);
  }

  async initDashStream(fileInput, src) {
    // 1. Fetch or read XML text for manifest inspection
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

    // 2. Render Stream Header Bar (Badge + Tabs + Info)
    this.renderStreamHeader('MPEG-DASH', manifestInfo);

    // 3. Render Manifest Inspector Panel (initially hidden)
    this.renderManifestPanel(manifestInfo);

    // 4. Dynamically load dash.js if needed
    try {
      if (!window.dashjs) {
        this.viewer.notify('Loading MPEG-DASH streaming player...', 'info', 2000);
        await loadScript('https://cdn.jsdelivr.net/npm/dashjs@4.7.4/dist/dash.all.min.js', 'dashjs');
      }

      if (window.dashjs) {
        this.dashPlayer = window.dashjs.MediaPlayer().create();
        this.dashPlayer.initialize(this.video, src, false); // Don't autoplay to avoid browser autoplay restrictions

        // Listen for DASH playback errors (e.g. missing relative segment chunks in local MPD files)
        this.dashPlayer.on(window.dashjs.MediaPlayer.events.ERROR, (e) => {
          const isNetworkError = e && (e.error === 'capability' || e.error === 'download' || e.type === 'error');
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
      // Native Safari / iOS HLS
      this.video.src = src;
    } else {
      try {
        if (!window.Hls) {
          this.viewer.notify('Loading HLS streaming player...', 'info', 2000);
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
    const badgeClass = isDash ? 'dva-stream-badge' : 'dva-stream-badge dva-stream-badge-hls';

    let extraChips = '';
    if (manifestInfo) {
      if (manifestInfo.duration) {
        extraChips += `<span class="dva-manifest-chip">⏱ ${manifestInfo.duration}</span>`;
      }
      if (manifestInfo.videoTracks.length > 0 && manifestInfo.videoTracks[0].resolution) {
        extraChips += `<span class="dva-manifest-chip">🎬 ${manifestInfo.videoTracks[0].resolution}</span>`;
      }
      if (manifestInfo.videoTracks.length > 0 && manifestInfo.videoTracks[0].bandwidth) {
        extraChips += `<span class="dva-manifest-chip">⚡ ${manifestInfo.videoTracks[0].bandwidth}</span>`;
      }
    }

    this.streamHeader.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px;">
        <span class="${badgeClass}">⚡ ${protocol} Stream</span>
        ${extraChips}
      </div>
      <div class="dva-stream-nav">
        <button class="dva-stream-btn active" id="dva-btn-view-stream">
          🎬 Video Player
        </button>
        ${isDash ? `
        <button class="dva-stream-btn" id="dva-btn-view-manifest">
          📋 Manifest Inspector
        </button>
        ` : ''}
      </div>
    `;

    const btnStream = this.streamHeader.querySelector('#dva-btn-view-stream');
    const btnManifest = this.streamHeader.querySelector('#dva-btn-view-manifest');

    if (btnStream) {
      btnStream.onclick = () => this.switchView('stream');
    }
    if (btnManifest) {
      btnManifest.onclick = () => this.switchView('manifest');
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
        } else {
          const ta = document.createElement('textarea');
          ta.value = this.rawXmlText;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          document.body.removeChild(ta);
          copyBtn.textContent = '✓ Copied!';
          setTimeout(() => { copyBtn.textContent = '📋 Copy Manifest XML'; }, 2000);
        }
      };
    }

    this.container.appendChild(this.manifestPanel);
  }

  switchView(viewName) {
    this.currentView = viewName;
    const btnStream = this.container.querySelector('#dva-btn-view-stream');
    const btnManifest = this.container.querySelector('#dva-btn-view-manifest');

    if (viewName === 'stream') {
      if (this.videoWrapper) this.videoWrapper.style.display = 'flex';
      if (this.manifestPanel) this.manifestPanel.style.display = 'none';
      if (btnStream) btnStream.classList.add('active');
      if (btnManifest) btnManifest.classList.remove('active');
    } else {
      if (this.videoWrapper) this.videoWrapper.style.display = 'none';
      if (this.manifestPanel) this.manifestPanel.style.display = 'flex';
      if (btnStream) btnStream.classList.remove('active');
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

  updateTransform() {
    if (!this.video) return;
    const scale = this.viewer.scale || 1;
    this.video.style.transform = `scale(${scale})`;
  }

  destroy() {
    if (this.dashPlayer) {
      try {
        this.dashPlayer.reset();
        this.dashPlayer.destroy();
      } catch {
        // ignore
      }
      this.dashPlayer = null;
    }

    if (this.hlsPlayer) {
      try {
        this.hlsPlayer.destroy();
      } catch {
        // ignore
      }
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

    this.container = null;
    this.videoWrapper = null;
    this.video = null;
    this.manifestPanel = null;
    this.streamHeader = null;
    this.streamNotice = null;
  }
}
