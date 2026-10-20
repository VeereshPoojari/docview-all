# 📄 DocView-All

> **Universal, ultra-lightweight document, media & diagram viewer for all frontend frameworks (React, Vue, Angular, Svelte, React Native & Vanilla JS).**  
> Supports **69+ file formats** (PDF, Word, Excel, PowerPoint PPTX, CSV, Draw.io diagrams, Audio, MPEG-DASH & HLS streaming, 3D Studio models, XML, YAML, Code & Images) with zero-dependency architecture, DOM virtualization, and hardware-accelerated playback.

[![npm version](https://img.shields.io/badge/npm-v1.0.1-blue.svg)](https://www.npmjs.com/package/docview-all)
[![Bundle Size](https://img.shields.io/badge/bundle-18KB%20(gzipped)-emerald.svg)](#)
[![Zero Dependencies](https://img.shields.io/badge/dependencies-0%20runtime-brightgreen.svg)](#)
[![Multi-Platform](https://img.shields.io/badge/platforms-React%20%7C%20Vue%20%7C%20Angular%20%7C%20Svelte%20%7C%20RN%20%7C%20HTML5-purple.svg)](#)
[![License](https://img.shields.io/badge/license-UNLICENSED-red.svg)](#)
[![Live Demo](https://img.shields.io/badge/demo-interactive%20playground-gradient.svg)](https://veereshpoojari.github.io/docview-all/)

---

## 🌐 Live Interactive Demo

Try **DocView-All** directly in your browser with zero installation (drag & drop, cloud URLs, and 67+ formats):  
👉 **[Open Live Demo Playground](https://veereshpoojari.github.io/docview-all/)** (`https://veereshpoojari.github.io/docview-all/`)

Explore the interactive multi-framework integration guide & code generator:  
👉 **[Open Code & Framework Guide](https://veereshpoojari.github.io/docview-all/guide.html)** (`https://veereshpoojari.github.io/docview-all/guide.html`)

---

## 🚀 Key Advantages

- ⚡ **Zero Heavy Runtime Dependencies**: Pure handcrafted rendering engines designed for maximum speed and minimal bundle footprint.
- ⏱️ **Universal Active Time-Spent & Per-Page Telemetry**: Tracks active reading time per page for PDF, Word DOCX, PowerPoint PPTX slides, and Excel XLSX sheets, with automatic tab-switching and window-blur idle pausing.
- 🎥 **Video Watch Range Telemetry ("From X to Y watched")**: Logs exact watched intervals, unique seconds watched, and completion percentage — automatically merging scrubbed segments.
- 📝 **Interactive Video Transcript & Subtitles**: Zero-dependency parser for `.vtt`, `.srt`, `.json`, and `.txt` with synchronized auto-scrolling cue glow, search filter, click-to-seek, and native closed captions.
- 🔄 **Comprehensive Developer Get & Set API**: Complete getter and setter methods on the viewer instance as well as standalone functional exports (`getAnalytics`, `setAnalytics`, `getTranscript`, `setTranscript`, etc.).
- 💻 **100% Auto-Responsive Live HTML Sandbox**: Live preview, syntax highlighter, and split screen (`preview` / `code` / `both`).
- 📊 **60 FPS DOM Virtualization**: View 100,000+ spreadsheet rows without UI stutter, browser freeze, or memory leaks.
- 📐 **Vector Diagram & Draw.io Viewer**: Native vector SVG renderer for `.drawio`, `.dio`, and `.io` files with multi-level zoom, dynamic connector arrowheads, and dual **Visual Diagram / XML Code** toggle.
- 🎵 **Interactive Vinyl Audio Player**: High-fidelity sound engine with spinning grooved vinyl, 20 real-time animated frequency equalizer bars, speed controls (0.75x–2.0x), and time seeking.
- 🎬 **Chunked Video & Adaptive Streaming**: Out-of-the-box support for MPEG-DASH (`.mpd`), Apple HLS (`.m3u8`), MP4, and WebM with manifest inspection.
- 📄 **Office OpenXML Parsing**: Built-in zero-dependency `ZipReader` decompresses and renders `.docx` documents and `.xlsx` multi-sheet workbooks.
- 🎨 **Adaptive Themes**: Beautiful Light mode (default) and dark mode with 1-click toggling.
- ☁️ **Direct Cloud URL Integration**: Stream files directly from AWS S3, Azure Blob, Google Cloud Storage, CDNs, or signed HTTPS URLs.
- 📱 **True Multi-Platform**: First-class support for **React, Next.js, Vue 3, Nuxt, Angular, Svelte, React Native (WebView), and Vanilla HTML5**.

---

## 📦 Installation

```bash
npm install docview-all
```

Or via CDN:

```html
<link rel="stylesheet" href="https://unpkg.com/docview-all@1.0.0/dist/docview-all.css">
<script type="module" src="https://unpkg.com/docview-all@1.0.0/dist/index.esm.js"></script>
```

---

## 🛠️ Usage Across Frameworks

### 1. React / Next.js

```jsx
import React from 'react';
import { DocViewer } from 'docview-all/react';
import 'docview-all/css';

export default function DocumentPreview() {
  return (
    <div style={{ width: '100%', height: '80vh' }}>
      <DocViewer 
        file="https://example.com/system-architecture.drawio" 
        theme="light"
        onLoad={(info) => console.log('Loaded:', info.name)}
        onError={(err) => console.error('Error:', err)}
      />
    </div>
  );
}
```

### 2. Vue 3 / Nuxt 3

```vue
<template>
  <div class="viewer-wrapper">
    <DocViewer :file="docSource" theme="light" />
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { DocViewer } from 'docview-all/vue';
import 'docview-all/css';

const docSource = ref('https://example.com/quarterly_earnings.xlsx');
</script>

<style scoped>
.viewer-wrapper {
  width: 100%;
  height: 85vh;
}
</style>
```

### 3. Angular (v12+)

```typescript
// app.component.ts
import { Component, AfterViewInit, ViewChild, ElementRef } from '@angular/core';
import { DocViewer } from 'docview-all';
import 'docview-all/css';

@Component({
  selector: 'app-document-viewer',
  template: `<div #viewerContainer style="width: 100%; height: 750px;"></div>`
})
export class DocumentViewerComponent implements AfterViewInit {
  @ViewChild('viewerContainer') viewerContainer!: ElementRef;

  ngAfterViewInit() {
    new DocViewer(this.viewerContainer.nativeElement, {
      file: 'https://example.com/company_manual.docx',
      theme: 'light'
    });
  }
}
```

### 4. Svelte / SvelteKit

```svelte
<script>
  import { onMount } from 'svelte';
  import { DocViewer } from 'docview-all';
  import 'docview-all/css';

  let container;
  let viewer;

  onMount(() => {
    viewer = new DocViewer(container, {
      file: 'https://dash.akamaized.net/envivio/EnvivioDash3/manifest.mpd',
      theme: 'light'
    });
  });
</script>

<div bind:this={container} style="width: 100%; height: 650px;"></div>
```

### 5. React Native (iOS & Android)

```jsx
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import { generateWebViewHtml } from 'docview-all/react-native';

export default function MobileDocumentScreen() {
  const htmlContent = generateWebViewHtml('https://example.com/specs.pdf', 'light');

  return (
    <View style={styles.container}>
      <WebView 
        originWhitelist={['*']}
        source={{ html: htmlContent }} 
        style={styles.webview} 
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  webview: { flex: 1 }
});
```

### 6. Vanilla JavaScript / HTML5

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <link rel="stylesheet" href="node_modules/docview-all/dist/docview-all.css">
  <style>
    #viewer-mount { width: 100vw; height: 100vh; }
  </style>
</head>
<body>
  <div id="viewer-mount"></div>

  <script type="module">
    import { DocViewer } from './node_modules/docview-all/dist/index.esm.js';

    const viewer = new DocViewer('#viewer-mount', {
      file: 'https://example.com/podcast-episode.mp3',
      theme: 'light'
    });

    // Programmatically open files on demand
    // viewer.loadFile('https://example.com/diagram.drawio');
  </script>
</body>
</html>
```

### 7. ⚡ One-Line Programmatic API

Open any document modal or container dynamically without pre-mounting:

```javascript
import { DocViewer } from 'docview-all';

// Mount anywhere in 1 line
DocViewer.open('#my-modal', 'https://example.com/invoice.pdf', { theme: 'light' });
```

---

## 📑 Supported Formats Matrix (69+ Formats)

| Category | File Extensions | Engine & Features |
| :--- | :--- | :--- |
| **Vector Diagrams** | `.drawio`, `.dio`, `.io` | Vector SVG rendering, node & edge geometry, raw deflate decompression, Visual/XML switcher, pan & zoom |
| **Office Documents** | `.docx`, `.doc` | Built-in ZipReader XML unpacker, paragraphs, bold/italic, lists, tables, heading hierarchies |
| **Presentations** | `.pptx`, `.ppt`, `.ppsx`, `.potx`, `.odp` | 16:9 presentation stage, thumbnail navigation sidebar, full-screen slideshow mode, speaker notes, slide tables, shapes & extracted images |
| **Spreadsheets** | `.xlsx`, `.xls`, `.csv`, `.tsv` | 60 FPS DOM Virtualization, multi-sheet tabs, column auto-sizing, cell tooltips, Formula & Cell Value inspection bar, 1-click cell copy, Wrap Text toggle (100k+ rows) |
| **PDF Documents** | `.pdf` | Sandboxed browser PDF rendering, high-DPI scaling, paging |
| **Audio Files** | `.mp3`, `.wav`, `.aac`, `.flac`, `.ogg`, `.m4a`, `.weba` | Interactive spinning vinyl disc, animated 20-bar frequency equalizer, speed toggling (0.75x–2.0x), time seeking |
| **Adaptive Video** | `.mpd` (DASH), `.m3u8` (HLS), `.mp4`, `.webm` | Chunked MediaSource streaming, adaptive bitrate switching, XML manifest inspector |
| **3D Models** | `.io` (BrickLink Studio 3D) | ZIP model extraction, instant photorealistic 3D thumbnail preview, LDraw instruction code viewer |
| **YAML Configurations** | `.yaml`, `.yml` | 3-Mode View (Interactive Collapsible Tree, Formatted Code Table, and Raw Document Stream), search filter, 1-click copy, zero-dependency parser with on-demand JIT fallback |
| **XML Documents** | `.xml`, `.xsd`, `.xsl`, `.xslt`, `.wsdl`, `.plist`, `.rss`, `.atom` | 3-Mode View (Interactive Collapsible DOM Tree, Formatted Code Table with line numbers, Raw Stream), real-time search filter across tags & attributes, CDATA & comment syntax highlighting, 1-click copy |
| **HTML & Web Pages** | `.html`, `.htm`, `.xhtml` | 3-Mode View (100% Auto-Responsive Live Browser Preview in isolated sandbox, Syntax-Highlighted Code Editor, and Split View), Wrap Lines toggle, real-time search filter, 1-click Copy |
| **Code & Scripts** | `.js`, `.jsx`, `.ts`, `.tsx`, `.css`, `.py`, `.sql`, `.sh`, `.json`, `.io` | Token-safe syntax highlighting for JS/TS/Py/SQL/CSS, line numbers, line click highlighting, search filter, Wrap Lines toggle, 1-click code copying |
| **Images** | `.png`, `.jpg`, `.jpeg`, `.svg`, `.webp`, `.gif`, `.avif`, `.bmp`, `.ico` | GPU-accelerated canvas, smooth Pan & Zoom, 90° clockwise rotation, fullscreen |
| **Plain Text & Logs** | `.txt`, `.log`, `.md`, `.env`, `.ini`, `.conf` | Clean typography, monospace viewing, search & copy |

---

## ⚙️ Configuration Options

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `file` | `string \| File \| Blob` | `null` | URL string, remote cloud link, or local `File`/`Blob` object |
| `theme` | `'light' \| 'dark'` | `'light'` | Color theme for viewport, chrome, and controls |
| `toolbar` | `boolean \| object` | `true` | Toolbar configuration, or `false` for Pure File Viewer Mode |
| `transcript` | `string \| File \| Blob \| array` | `null` | Path or cue array for video/audio interactive subtitles (`.vtt`, `.srt`, `.json`, `.txt`) |
| `showTranscriptUpload` | `boolean` | `true` | Show/hide the interactive "Upload Subtitles" button |
| `initialAnalytics` | `object` | `null` | Pre-fill/restore previous engagement telemetry (e.g. from database) |
| `initialTimeSpent` | `object` | `null` | Pre-fill/restore total active seconds and per-page time breakdown |
| `onAnalyticsUpdate` | `function` | `undefined` | Callback fired every second during active engagement with full telemetry snapshot |
| `onTimeSpent` | `function` | `undefined` | Callback fired on significant engagement events (page changes, media events, session end) |
| `onLoad` | `function` | `undefined` | Callback fired when document finishes rendering: `(fileInfo) => {}` |
| `onError` | `function` | `undefined` | Callback fired if rendering encounters an error: `(error) => {}` |
| `onZoom` | `function` | `undefined` | Callback fired on zoom level change: `(zoomLevel) => {}` |
| `htmlMode` | `'preview' \| 'code' \| 'both'` | `'preview'` | Initial HTML mode: pure live preview, code viewer, or split screen (`both`) |
| `htmlAllowedModes` | `array` | `['preview', 'code', 'both']` | Limit allowed modes (e.g. `['preview']` to lock to pure preview only) |
| `htmlShowSwitcher` | `boolean` | `true` | Show/hide the mode switcher tabs |

---

## ⏱️ Universal Document Engagement Analytics

DocView-All automatically tracks user engagement and reading duration across **all** document types. It includes built-in tab visibility tracking and window blur detection, ensuring idle background time is paused.

```javascript
const viewer = new DocViewer('#viewer-mount', {
  file: 'https://example.com/handbook.pdf',
  onAnalyticsUpdate: (report) => {
    // Fired every active second
    console.log(`Total active reading time: ${report.totalTimeFormatted}`);
    console.log(`Current page: ${report.currentPage} of ${report.totalPages}`);
  },
  onTimeSpent: ({ event, currentPage, previousPage, analytics }) => {
    // Fired on page switches, media pauses, or session end
    console.log(`Event: ${event}, Now viewing Page ${currentPage}`);
  }
});

// Snapshot of full analytics report
const stats = viewer.getAnalytics();
console.log(stats.totalTimeSpentSeconds); // e.g. 145 (seconds)
console.log(stats.pageBreakdown);
// Output:
// {
//   "1": { seconds: 45, formatted: "45s", visits: 2, lastVisited: 1730000000 },
//   "2": { seconds: 100, formatted: "1m 40s", visits: 1, lastVisited: 1730000100 }
// }
```

Works automatically for:
* **PDF & Word (.docx)**: Tracks per-page reading duration as user scrolls or pages.
* **PowerPoint (.pptx, .ppt)**: Tracks time spent per slide.
* **Excel (.xlsx, .csv)**: Tracks time spent per worksheet.
* **HTML, Code, Markdown, Text, Diagrams, Images, JSON, YAML, XML**: Tracks overall active inspection time.

---

## 🎬 Video Watch Range Telemetry & Transcript System

Tracks exact playback intervals ("from X to Y watched") and includes an interactive synchronized transcript panel.

```javascript
const viewer = new DocViewer('#video-mount', {
  file: 'https://example.com/lecture.mp4',
  transcript: 'https://example.com/lecture.vtt', // Accepts .vtt, .srt, .json, or .txt
  showTranscriptUpload: true // Allows users to upload their own subtitles
});

// Inspect video watch telemetry
const mediaStats = viewer.getAnalytics().mediaAnalytics;
console.log(mediaStats.completionPercentage); // e.g. "82.5%"
console.log(mediaStats.uniqueWatchedSeconds);  // e.g. 248 (seconds)
console.log(mediaStats.watchedIntervals);
// Output (auto-merged intervals):
// [
//   { from: 0, to: 120, formatted: "00:00 → 02:00" },
//   { from: 180, to: 310, formatted: "03:00 → 05:10" }
// ]
```

### Transcript Features:
* **Universal Parser**: Accepts WebVTT (`.vtt`), SubRip (`.srt`), JSON arrays (`[{ start, end, text }]`), or plain text.
* **Interactive Panel**: Click any cue to seek video; search bar to filter cues by keyword; live auto-scrolling cue glow.
* **Native Captions**: Automatically binds HTML5 `<track>` element for native closed captions.

---

## 🔄 Universal Developer Get & Set API

DocView-All provides full developer getters and setters to retrieve, restore, or modify state at runtime:

### 1. Instance Methods
```javascript
const viewer = new DocViewer('#mount', options);

// --- Analytics Get & Set / Restore ---
const analytics = viewer.getAnalytics();     // Get full analytics snapshot
viewer.setAnalytics(savedAnalyticsFromDB);  // Restore saved progress & intervals
const timeSpent = viewer.getTimeSpent();     // Get lightweight time spent
viewer.setTimeSpent({ totalTimeSpentSeconds: 180, pageBreakdown: { 1: 90, 2: 90 } });
viewer.resetAnalytics();                     // Reset all counters to 0

const intervals = viewer.getWatchedIntervals();
viewer.setWatchedIntervals([{ from: 0, to: 60 }]);

// --- Transcript Get & Set ---
const cues = viewer.getTranscript();        // Get current cues array
await viewer.setTranscript('/new-subtitles.srt'); // Set new subtitles on the fly

// --- HTML Mode Get & Set ---
viewer.getHtmlMode();                       // 'preview' | 'code' | 'both'
viewer.setHtmlMode('both');                 // Switch to split-screen view

// --- Navigation, Zoom & Theme ---
viewer.getPage();                           // Current page number (1-based)
viewer.setPage(4);                          // Jump to page 4
viewer.getTotalPages();                     // Total page count
viewer.getZoom();                           // Current zoom level (e.g. 1.0)
viewer.setZoom(1.25);                       // Set zoom level (125%)
viewer.getTheme();                          // 'light' | 'dark'
viewer.setTheme('dark');                    // Switch theme

// --- Book Mode (Two-Page Side-by-Side Reading Spread) ---
viewer.isBookMode();                        // Check if Two-Page Book Mode is active
viewer.setBookMode(true);                   // Enable Two-Page Book Mode
viewer.toggleBookMode();                    // Toggle between continuous scroll & book mode
```

### 2. Standalone Exported Functions
```javascript
import {
  DocViewer,
  getAnalytics,
  setAnalytics,
  getTimeSpent,
  setTimeSpent,
  resetAnalytics,
  getTranscript,
  setTranscript,
  getHtmlMode,
  setHtmlMode,
  getPage,
  setPage,
  getZoom,
  setZoom,
  getTheme,
  setTheme,
  isBookMode,
  setBookMode,
  toggleBookMode
} from 'docview-all';

const viewer = new DocViewer('#mount', {
  file: '/annual-report.pdf',
  bookMode: true // Start in two-page book spread mode
});

setAnalytics(viewer, previousSession);
setPage(viewer, 3);
setBookMode(viewer, true);
await setTranscript(viewer, '/subtitles.vtt');
```

---

### 🎛️ Toolbar & Pure File Viewer Configuration

DocView-All provides full granular control over the toolbar. You can disable the entire toolbar for a pure file viewer canvas, or customize each individual action button:

#### 1. Pure File Viewer Mode (Canvas Only, Zero Toolbar Chrome)
```javascript
const viewer = new DocViewer('#viewer-mount', {
  file: 'https://example.com/specifications.pdf',
  toolbar: false // Completely hides the entire toolbar
});
```

#### 2. Granular Button Control
```javascript
const viewer = new DocViewer('#viewer-mount', {
  file: 'https://example.com/company_report.xlsx',
  theme: 'light',
  toolbar: {
    enabled: true,         // Master toggle (false hides toolbar)
    browse: false,         // Hide "Browse Document" button (when loading via code)
    cloudUrl: false,       // Hide "Cloud URL" paste input
    download: true,        // Show "Download Document" button
    zoom: true,            // Show Zoom In / Zoom Out controls
    rotate: true,          // Show Rotate 90° button
    pagination: true,      // Show Next/Prev page & page counter
    theme: true,           // Show Light / Dark mode toggle
    fullscreen: true,      // Show Fullscreen button
    presets: []            // Custom preset pills [{ label, url }] (empty by default for a clean UI)
  }
});
```

### Core Instance Navigation & Control

```javascript
const viewer = new DocViewer('#viewer', options);

viewer.loadFile(urlOrFile); // Load new file or cloud URL
viewer.zoom(0.15);          // Zoom in by +15%
viewer.zoom(-0.15);         // Zoom out by -15%
viewer.resetZoom();         // Reset zoom to 100%
viewer.rotate();            // Rotate clockwise 90 degrees
viewer.toggleTheme();       // Toggle between light and dark themes
viewer.toggleFullscreen();  // Toggle full-screen mode
viewer.download();          // Download the currently opened document
viewer.destroy();           // Clean up memory, observers, and event listeners
```

---

## 🧪 Testing

DocView-All includes a comprehensive automated test suite verifying package exports, format detection, and ZIP decompression:

```bash
node tests/engines.test.js
```

---

## 🤝 Contributing

Contributions, feature requests, and bug reports are welcome!  
Feel free to open an issue or submit a pull request on the [GitHub Repository](https://github.com/VeereshPoojari/docview-all).

---

## 📄 License

UNLICENSED © [Veeresh Poojari](https://github.com/VeereshPoojari). All rights reserved.
