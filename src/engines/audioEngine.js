/**
 * High-Performance Universal Audio Player Engine
 * Supports MP3, WAV, AAC, FLAC, OGG, M4A, WEBA
 * Zero dependencies, featuring vinyl disc animation, equalizer visualizer,
 * precision scrub bar, volume, loop, and playback speed controls.
 */
import { formatFileSize } from '../utils/mimeDetector.js';

function formatTime(seconds) {
  if (isNaN(seconds) || seconds < 0) return '00:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export class AudioEngine {
  constructor(viewer) {
    this.viewer = viewer;
    this.container = null;
    this.audio = null;
    this.objectUrl = null;
    this.isPlaying = false;
    this.isSeeking = false;
    this.currentSpeed = 1.0;
    this.isLooping = false;
  }

  async render(fileInput, viewport) {
    this.container = document.createElement('div');
    this.container.className = 'dva-audio-wrapper';

    let src = '';
    let fileName = 'Audio Track';
    let fileSize = '';
    let ext = 'MP3';

    if (typeof fileInput === 'string') {
      src = fileInput;
      const clean = fileInput.split('#')[0].split('?')[0];
      fileName = clean.split('/').pop() || 'Remote Audio Track';
      const dotIdx = fileName.lastIndexOf('.');
      if (dotIdx !== -1) ext = fileName.substring(dotIdx + 1).toUpperCase();
    } else if (fileInput instanceof Blob || fileInput instanceof File) {
      this.objectUrl = URL.createObjectURL(fileInput);
      src = this.objectUrl;
      fileName = fileInput.name || 'Audio Track';
      fileSize = formatFileSize(fileInput.size);
      const dotIdx = fileName.lastIndexOf('.');
      if (dotIdx !== -1) ext = fileName.substring(dotIdx + 1).toUpperCase();
    }

    // Audio element
    this.audio = document.createElement('audio');
    this.audio.preload = 'metadata';
    this.audio.src = src;

    // Generate 20 equalizer bars
    const eqBarsHtml = Array.from({ length: 20 }, (_, i) => 
      `<div class="dva-eq-bar" style="animation-delay: ${(i * 0.08).toFixed(2)}s;"></div>`
    ).join('');

    this.container.innerHTML = `
      <div class="dva-audio-card">
        <!-- Vinyl Record Disc Graphic -->
        <div class="dva-vinyl-container">
          <div class="dva-vinyl-disc" id="dva-vinyl-disc">
            <div class="dva-vinyl-groove"></div>
            <div class="dva-vinyl-groove groove-2"></div>
            <div class="dva-vinyl-center">
              <span class="dva-vinyl-icon">🎵</span>
            </div>
          </div>
        </div>

        <!-- Track Info -->
        <div class="dva-audio-info">
          <div class="dva-audio-title" title="${fileName}">${fileName}</div>
          <div class="dva-audio-meta">
            <span class="dva-audio-badge">${ext} AUDIO</span>
            ${fileSize ? `<span>&bull; ${fileSize}</span>` : ''}
          </div>
        </div>

        <!-- Animated Equalizer Waveform -->
        <div class="dva-audio-equalizer" id="dva-audio-eq">
          ${eqBarsHtml}
        </div>

        <!-- Progress Scrubber -->
        <div class="dva-audio-scrubber-group">
          <div class="dva-audio-time-row">
            <span class="dva-audio-time" id="dva-audio-cur-time">00:00</span>
            <span class="dva-audio-time" id="dva-audio-dur-time">00:00</span>
          </div>
          <div class="dva-audio-progress-wrap">
            <input 
              type="range" 
              class="dva-audio-slider" 
              id="dva-audio-progress" 
              min="0" 
              max="100" 
              value="0" 
              step="0.1" 
            />
          </div>
        </div>

        <!-- Controls Toolbar -->
        <div class="dva-audio-controls">
          <!-- Loop Toggle -->
          <button class="dva-audio-btn-icon" id="dva-audio-btn-loop" title="Toggle Loop / Repeat">
            🔁
          </button>

          <!-- Skip -10s -->
          <button class="dva-audio-btn-icon" id="dva-audio-btn-rewind" title="Rewind 10 Seconds">
            ⏪
          </button>

          <!-- Main Play / Pause Button -->
          <button class="dva-audio-btn-play" id="dva-audio-btn-play" title="Play / Pause">
            <svg id="dva-play-icon" viewBox="0 0 24 24"><polygon points="6 4 20 12 6 20 6 4"></polygon></svg>
          </button>

          <!-- Skip +10s -->
          <button class="dva-audio-btn-icon" id="dva-audio-btn-forward" title="Forward 10 Seconds">
            ⏩
          </button>

          <!-- Speed Selector Button -->
          <button class="dva-audio-speed-btn" id="dva-audio-btn-speed" title="Change Playback Speed">
            1.0x
          </button>
        </div>

        <!-- Volume Row -->
        <div class="dva-audio-vol-row">
          <button class="dva-audio-btn-icon" id="dva-audio-btn-mute" title="Mute / Unmute" style="width: 26px; height: 26px; font-size: 14px;">
            🔊
          </button>
          <input 
            type="range" 
            class="dva-audio-slider dva-vol-slider" 
            id="dva-audio-vol-slider" 
            min="0" 
            max="1" 
            step="0.05" 
            value="1" 
          />
        </div>
      </div>
    `;

    viewport.appendChild(this.container);

    // Grab elements
    const playBtn = this.container.querySelector('#dva-audio-btn-play');
    const playIcon = this.container.querySelector('#dva-play-icon');
    const vinylDisc = this.container.querySelector('#dva-vinyl-disc');
    const eq = this.container.querySelector('#dva-audio-eq');
    const curTimeEl = this.container.querySelector('#dva-audio-cur-time');
    const durTimeEl = this.container.querySelector('#dva-audio-dur-time');
    const progressSlider = this.container.querySelector('#dva-audio-progress');
    const rewindBtn = this.container.querySelector('#dva-audio-btn-rewind');
    const forwardBtn = this.container.querySelector('#dva-audio-btn-forward');
    const loopBtn = this.container.querySelector('#dva-audio-btn-loop');
    const speedBtn = this.container.querySelector('#dva-audio-btn-speed');
    const muteBtn = this.container.querySelector('#dva-audio-btn-mute');
    const volSlider = this.container.querySelector('#dva-audio-vol-slider');

    const updatePlayState = (playing) => {
      this.isPlaying = playing;
      if (playing) {
        playIcon.innerHTML = '<rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect>';
        vinylDisc.classList.add('playing');
        eq.classList.add('active');
      } else {
        playIcon.innerHTML = '<polygon points="6 4 20 12 6 20 6 4"></polygon>';
        vinylDisc.classList.remove('playing');
        eq.classList.remove('active');
      }
    };

    // Play / Pause Click
    playBtn.onclick = () => {
      if (this.audio.paused) {
        this.audio.play().catch(e => {
          this.viewer.notify(`Audio playback notice: ${e.message}`, 'warning');
        });
      } else {
        this.audio.pause();
      }
    };

    this.audio.onplay = () => updatePlayState(true);
    this.audio.onpause = () => updatePlayState(false);
    this.audio.onended = () => {
      updatePlayState(false);
      if (!this.isLooping) {
        this.audio.currentTime = 0;
      }
    };

    // Duration Loaded
    this.audio.onloadedmetadata = () => {
      durTimeEl.textContent = formatTime(this.audio.duration);
    };
    if (this.audio.duration) {
      durTimeEl.textContent = formatTime(this.audio.duration);
    }

    // Time Update
    this.audio.ontimeupdate = () => {
      if (!this.isSeeking) {
        curTimeEl.textContent = formatTime(this.audio.currentTime);
        if (this.audio.duration) {
          const pct = (this.audio.currentTime / this.audio.duration) * 100;
          progressSlider.value = pct;
        }
      }
    };

    // Progress Scrubbing
    progressSlider.oninput = () => {
      this.isSeeking = true;
      if (this.audio.duration) {
        const targetSec = (progressSlider.value / 100) * this.audio.duration;
        curTimeEl.textContent = formatTime(targetSec);
      }
    };

    progressSlider.onchange = () => {
      if (this.audio.duration) {
        this.audio.currentTime = (progressSlider.value / 100) * this.audio.duration;
      }
      this.isSeeking = false;
    };

    // Skip Buttons
    rewindBtn.onclick = () => {
      this.audio.currentTime = Math.max(0, this.audio.currentTime - 10);
    };
    forwardBtn.onclick = () => {
      this.audio.currentTime = Math.min(this.audio.duration || 999999, this.audio.currentTime + 10);
    };

    // Loop Button
    loopBtn.onclick = () => {
      this.isLooping = !this.isLooping;
      this.audio.loop = this.isLooping;
      loopBtn.classList.toggle('active', this.isLooping);
      this.viewer.notify(this.isLooping ? 'Loop mode: ON' : 'Loop mode: OFF', 'info', 1500);
    };

    // Speed Selector: Cycle 0.75x -> 1.0x -> 1.25x -> 1.5x -> 2.0x
    const speeds = [0.75, 1.0, 1.25, 1.5, 2.0];
    speedBtn.onclick = () => {
      const idx = speeds.indexOf(this.currentSpeed);
      const nextIdx = (idx + 1) % speeds.length;
      this.currentSpeed = speeds[nextIdx];
      this.audio.playbackRate = this.currentSpeed;
      speedBtn.textContent = `${this.currentSpeed}x`;
      this.viewer.notify(`Speed: ${this.currentSpeed}x`, 'info', 1500);
    };

    // Volume Slider & Mute
    let lastVolume = 1.0;
    volSlider.oninput = () => {
      const val = parseFloat(volSlider.value);
      this.audio.volume = val;
      muteBtn.textContent = val === 0 ? '🔇' : val < 0.5 ? '🔉' : '🔊';
    };

    muteBtn.onclick = () => {
      if (this.audio.volume > 0) {
        lastVolume = this.audio.volume;
        this.audio.volume = 0;
        volSlider.value = 0;
        muteBtn.textContent = '🔇';
      } else {
        this.audio.volume = lastVolume || 1.0;
        volSlider.value = this.audio.volume;
        muteBtn.textContent = this.audio.volume < 0.5 ? '🔉' : '🔊';
      }
    };
  }

  destroy() {
    if (this.audio) {
      this.audio.pause();
      this.audio.removeAttribute('src');
      this.audio.load();
      this.audio = null;
    }
    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = null;
    }
    this.container = null;
  }
}
