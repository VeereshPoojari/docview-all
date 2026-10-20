# Changelog

All notable changes to the `docview-all` library will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.2] - 2026-10-20

### 🚀 Added
- **Universal Document Engagement Analytics (`AnalyticsEngine`)**:
  - Global 1-second ticker accumulating active document inspection and reading duration.
  - Intelligent engagement detection: automatically pauses telemetry when the browser tab is hidden (`visibilitychange`) or the window loses focus (`blur`), resuming seamlessly upon focus.
  - **Per-Page Active Time Breakdown**:
    - **PDF & Word (.docx)**: Tracks active seconds, visit counts, and last visited timestamps per page as the user scrolls or navigates.
    - **PowerPoint (.pptx, .ppt)**: Tracks time spent per slide during presentation navigation.
    - **Excel (.xlsx, .csv)**: Tracks time spent per sheet tab as workbooks are inspected.
    - **Code, HTML, Markdown, Text, Diagrams, Images, JSON, YAML, XML**: Tracks overall active inspection time.
  - Real-time callbacks: `onAnalyticsUpdate(report)` (fired every active second) and `onTimeSpent({ event, currentPage, previousPage, analytics })` (fired on page transitions, media pauses, and session destruction).

- **Video & Audio Watch Range Telemetry**:
  - Precise interval tracking logging exact ranges watched (e.g. `00:00 → 00:25`, `01:10 → 02:00`).
  - Intelligent interval merging: contiguous or overlapping playback segments automatically merge into unified watch ranges.
  - Calculation of unique watched seconds and true media completion percentage (`completionPercentage`).
  - Real-time telemetry badge displayed on the video header (`⏱️ 00:15 (25.0%)`).
  - Telemetry integration for high-fidelity vinyl audio player (`AudioEngine`).

- **Interactive Synchronized Transcript & Subtitle Upload (`transcriptParser.js`)**:
  - Zero-dependency universal parser supporting WebVTT (`.vtt`), SubRip (`.srt`), JSON cue arrays (`[{ start, end, text }]`), and plain text (`.txt`).
  - On-the-fly "Upload Subtitles" toolbar button with file picker accepting `.vtt,.srt,.json,.txt`.
  - Programmatic `transcript` option in `DocViewerOptions`.
  - Interactive transcript side panel featuring real-time synchronized auto-scroll, click-to-seek timestamp jumping, active cue glowing highlight, and keyword search filtering.
  - Dynamic generation of native HTML5 `<track>` element for closed captions.

- **Universal Developer Get & Set API**:
  - Instance methods on `DocViewer`:
    - `getAnalytics()`: Get full engagement snapshot.
    - `setAnalytics(data)`: Restore saved engagement progress and watched intervals.
    - `getTimeSpent()`: Get lightweight duration and page breakdown.
    - `setTimeSpent(data)`: Restore time spent and page time counters.
    - `resetAnalytics()`: Reset all engagement counters and watched intervals to zero.
    - `getWatchedIntervals()`: Get list of watched time ranges.
    - `setWatchedIntervals(intervals)`: Set/restore watched intervals.
    - `getTranscript()`: Get current cues array.
    - `setTranscript(input)`: Dynamically load/switch transcript at runtime.
    - `getHtmlMode()` / `setHtmlMode(mode)`: Get/set HTML mode (`preview`, `code`, `both`).
    - `getPage()` / `setPage(num)`: Get/set active page number.
    - `getTotalPages()`: Get total page count.
    - `getZoom()` / `setZoom(scale)`: Get/set scale factor.
    - `getTheme()` / `setTheme(theme)`: Get/set theme (`light`, `dark`).
  - Standalone functional exports in `src/index.js` (`getAnalytics(viewer)`, `setAnalytics(viewer, data)`, `getTranscript(viewer)`, etc.).
  - State restoration via constructor options: `initialAnalytics` and `initialTimeSpent`.

- **Auto-Responsive Live HTML Sandbox**:
  - Pure auto-responsive iframe preview container.
  - Developer view modes: pure live preview, code inspector with syntax highlighting, and side-by-side split screen (`both`).

- **PDF View Revamp & Two-Page Book Mode (`PdfEngine`)**:
  - **DOCX-Styled Continuous Vertical Scroll**: Eliminates cluttered browser native PDF toolbars and embedded `<object>/<iframe>` chrome, rendering clean crisp paper cards on the studio workspace canvas identical to the DOCX viewer aesthetic.
  - **Two-Page Book Reading Mode (Spread)**: Toggleable side-by-side reading layout simulating an authentic open book with center spine shadow, inner gutter crease, and page flip navigation.
  - **Toolbar Book Toggle**: Added `📖 Book Mode` toggle button in pagination controls to switch between continuous scroll and two-page book spreads on the fly.
  - **Worker Security Fix**: Implemented same-origin Blob Worker wrapper for PDF.js to prevent cross-origin `SecurityError` worker initialization failures on modern browsers.
  - **Clean Fallback**: Clean sandboxed fallback card with `#toolbar=0&navpanes=0&scrollbar=0` hiding browser native controls in offline or restricted environments.
  - **New Book Mode Methods**: `isBookMode()`, `setBookMode(enabled)`, `toggleBookMode()` on `DocViewer` and as standalone exports `isBookMode(viewer)`, `setBookMode(viewer, enabled)`, `toggleBookMode(viewer)`.

- **Intelligent Format-Adaptive Toolbar**:
  - Automatically adapts toolbar controls based on active file format capabilities:
    - **Book Mode (`#dva-btn-book-mode`)**: Only visible for multi-page reading documents (**PDF** and **DOCX**) when total pages $> 1$. Automatically hidden for single-page files, slides, spreadsheets, code, audio, and video.
    - **Pagination (`#dva-pagination-controls`)**: Automatically shown when total pages $> 1$ (multi-page PDF, multi-page DOCX, multi-slide PPTX/PPT); hidden for non-paginated files.
    - **Rotate (`#dva-btn-rotate`)**: Only displayed for visual documents and images (**PDF**, **DOCX**, **Images**, **Diagrams**); hidden for spreadsheets, code, audio, and video where 90° rotation breaks layouts.
    - **Zoom (`#dva-btn-zoom-in/out`)**: Displayed for all visual and tabular formats; hidden for audio and video media players.

### 🔧 Changed
- Multi-framework adapters (`React`, `Vue 3`, `Angular`) updated to accept `bookMode`, `onAnalyticsUpdate`, `onTimeSpent`, `transcript`, and `showTranscriptUpload`.
- Full TypeScript type definitions added in `src/types/index.d.ts` for all analytics models, transcript cues, book mode options, and get/set functions.
- Expanded automated test suite in `tests/engines.test.js` covering analytics, interval merging, transcript parsing, book mode spreads, and get/set exports.

---

## [1.0.0] - 2026-10-15

### 🚀 Initial Release
- Universal zero-dependency document viewer supporting 67+ file formats.
- High-performance 60 FPS DOM virtualization for Excel `.xlsx` and `.csv` handling 100,000+ rows.
- Vector SVG engine for `.drawio`, `.dio`, and `.io` diagrams.
- Interactive vinyl audio player with grooved disc animation and 20-bar frequency equalizer.
- Chunked MediaSource streaming engine supporting MPEG-DASH (`.mpd`), Apple HLS (`.m3u8`), and standard HTML5 video.
- Built-in `ZipReader` for client-side Word `.docx` and PowerPoint `.pptx` presentation unpacking.
- Multi-framework component wrappers for React, Next.js, Vue 3, Angular, and React Native.
