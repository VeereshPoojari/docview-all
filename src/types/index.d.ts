export type DocViewerTheme = 'dark' | 'light';

export interface FileInfo {
  type: string;
  ext: string;
  name: string;
  isDash?: boolean;
  isHls?: boolean;
}

export interface DocViewerPresetItem {
  label: string;
  url: string;
}

export interface DocViewerToolbarOptions {
  enabled?: boolean;
  browse?: boolean;
  cloudUrl?: boolean;
  presets?: DocViewerPresetItem[];
  zoom?: boolean;
  rotate?: boolean;
  pagination?: boolean;
  theme?: boolean;
  fullscreen?: boolean;
  download?: boolean;
}

export type HtmlViewMode = 'preview' | 'code' | 'both' | 'split';

export interface TranscriptCue {
  start: number;
  end: number;
  text: string;
}

export interface WatchedInterval {
  from: number;
  to: number;
  formatted: string;
}

export interface MediaAnalyticsReport {
  duration: number;
  durationFormatted: string;
  currentPosition: number;
  currentPositionFormatted: string;
  maxPositionReached: number;
  maxPositionFormatted: string;
  uniqueWatchedSeconds: number;
  uniqueWatchedFormatted: string;
  completionPercentage: string;
  watchedIntervals: WatchedInterval[];
}

export interface PageTimeRecord {
  seconds: number;
  formatted: string;
  visits: number;
  lastVisited: number;
}

export interface DocAnalyticsReport {
  documentName: string;
  documentType: string;
  sessionStartTime: number;
  lastActiveTimestamp: number;
  totalTimeSpentSeconds: number;
  totalTimeFormatted: string;
  isEngaged: boolean;
  currentPage: number;
  totalPages: number;
  pageBreakdown: Record<string, PageTimeRecord>;
  mediaAnalytics: MediaAnalyticsReport;
}

export interface DocTimeSpentReport {
  totalTimeSpentSeconds: number;
  totalTimeFormatted: string;
  pageBreakdown: Record<string, PageTimeRecord>;
}

export interface DocViewerOptions {
  file?: string | File | Blob | ArrayBuffer | null;
  theme?: DocViewerTheme;
  showToolbar?: boolean;
  toolbar?: boolean | DocViewerToolbarOptions;
  bookMode?: boolean;
  htmlViewMode?: HtmlViewMode;
  htmlMode?: HtmlViewMode;
  htmlAllowedModes?: HtmlViewMode[];
  htmlShowSwitcher?: boolean;
  allowScripts?: boolean;
  transcript?: string | File | Blob | ArrayBuffer | TranscriptCue[];
  showTranscriptUpload?: boolean;
  initialAnalytics?: Partial<DocAnalyticsReport>;
  initialTimeSpent?: Partial<DocTimeSpentReport>;
  onAnalyticsUpdate?: (analytics: DocAnalyticsReport) => void;
  onTimeSpent?: (data: { event: string; [key: string]: any }) => void;
  onLoad?: (info: FileInfo) => void;
}

export interface DocViewerInstance {
  file: any;
  theme: DocViewerTheme;
  scale: number;
  rotation: number;
  currentPage: number;
  totalPages: number;
  analytics?: any;
  loadFile(file: string | File | Blob | ArrayBuffer): Promise<void>;
  zoom(delta: number): void;
  rotate(degrees?: number): void;
  toggleTheme(): void;
  toggleFullscreen(): void;
  download(): void;
  openFileDialog(): void;
  goToPage(pageNumber: number): void;
  nextPage(): void;
  prevPage(): void;
  setPageInfo(currentPage: number, totalPages: number): void;
  isBookMode(): boolean;
  setBookMode(enabled: boolean): this;
  toggleBookMode(): this;
  getAnalytics(): DocAnalyticsReport | null;
  setAnalytics(data: Partial<DocAnalyticsReport>): this;
  getTimeSpent(): DocTimeSpentReport | null;
  setTimeSpent(data: Partial<DocTimeSpentReport>): this;
  resetAnalytics(): this;
  getWatchedIntervals(): WatchedInterval[];
  setWatchedIntervals(intervals: Array<{ from: number; to: number }>): this;
  getTranscript(): TranscriptCue[];
  setTranscript(input: any): Promise<TranscriptCue[]>;
  getHtmlMode(): HtmlViewMode;
  setHtmlMode(mode: HtmlViewMode): this;
  getPage(): number;
  setPage(pageNumber: number): this;
  getTotalPages(): number;
  getZoom(): number;
  setZoom(scale: number): this;
  getRotation(): number;
  setRotation(degrees: number): this;
  getTheme(): DocViewerTheme;
  setTheme(theme: DocViewerTheme): this;
  notify(message: string, type?: 'info' | 'success' | 'error' | 'warning', duration?: number): void;
  destroy(): void;
}

export declare class DocViewer implements DocViewerInstance {
  constructor(target: string | HTMLElement, options?: DocViewerOptions);
  file: any;
  theme: DocViewerTheme;
  scale: number;
  rotation: number;
  currentPage: number;
  totalPages: number;
  analytics?: any;
  loadFile(file: string | File | Blob | ArrayBuffer): Promise<void>;
  zoom(delta: number): void;
  rotate(degrees?: number): void;
  toggleTheme(): void;
  toggleFullscreen(): void;
  download(): void;
  openFileDialog(): void;
  goToPage(pageNumber: number): void;
  nextPage(): void;
  prevPage(): void;
  setPageInfo(currentPage: number, totalPages: number): void;
  isBookMode(): boolean;
  setBookMode(enabled: boolean): this;
  toggleBookMode(): this;
  getAnalytics(): DocAnalyticsReport | null;
  setAnalytics(data: Partial<DocAnalyticsReport>): this;
  getTimeSpent(): DocTimeSpentReport | null;
  setTimeSpent(data: Partial<DocTimeSpentReport>): this;
  resetAnalytics(): this;
  getWatchedIntervals(): WatchedInterval[];
  setWatchedIntervals(intervals: Array<{ from: number; to: number }>): this;
  getTranscript(): TranscriptCue[];
  setTranscript(input: any): Promise<TranscriptCue[]>;
  getHtmlMode(): HtmlViewMode;
  setHtmlMode(mode: HtmlViewMode): this;
  getPage(): number;
  setPage(pageNumber: number): this;
  getTotalPages(): number;
  getZoom(): number;
  setZoom(scale: number): this;
  getRotation(): number;
  setRotation(degrees: number): this;
  getTheme(): DocViewerTheme;
  setTheme(theme: DocViewerTheme): this;
  notify(message: string, type?: 'info' | 'success' | 'error' | 'warning', duration?: number): void;
  destroy(): void;

  static view(target: string | HTMLElement, options?: DocViewerOptions): DocViewer;
  static openModal(file: string | File | Blob | ArrayBuffer, options?: Partial<DocViewerOptions>): { viewer: DocViewer; close: () => void };
}

export declare function detectFormat(fileInput: any): FileInfo;
export declare function formatFileSize(bytes: number): string;
export declare function formatDuration(seconds: number): string;
export declare function formatClockTime(seconds: number): string;
export declare function parseTranscript(input: any): Promise<TranscriptCue[]>;
export declare function generateVttContent(cues: TranscriptCue[]): string;
export declare function formatCueTime(seconds: number): string;

export declare function getAnalytics(viewer: any): DocAnalyticsReport | null;
export declare function setAnalytics(viewer: any, data: Partial<DocAnalyticsReport>): any;
export declare function getTimeSpent(viewer: any): DocTimeSpentReport | null;
export declare function setTimeSpent(viewer: any, data: Partial<DocTimeSpentReport>): any;
export declare function resetAnalytics(viewer: any): any;
export declare function getTranscript(viewer: any): TranscriptCue[];
export declare function setTranscript(viewer: any, input: any): Promise<TranscriptCue[]>;
export declare function getHtmlMode(viewer: any): HtmlViewMode | null;
export declare function setHtmlMode(viewer: any, mode: HtmlViewMode): any;
export declare function getPage(viewer: any): number;
export declare function setPage(viewer: any, pageNumber: number): any;
export declare function getZoom(viewer: any): number;
export declare function setZoom(viewer: any, scale: number): any;
export declare function getTheme(viewer: any): DocViewerTheme;
export declare function setTheme(viewer: any, theme: DocViewerTheme): any;
export declare function isBookMode(viewer: any): boolean;
export declare function setBookMode(viewer: any, enabled: boolean): any;
export declare function toggleBookMode(viewer: any): any;

export declare class AnalyticsEngine {
  constructor(viewer: any, options?: any);
  setDocumentInfo(fileInfo: any): void;
  setPage(pageNumber: number, totalPages?: number): void;
  setMediaDuration(duration: number): void;
  onMediaPlay(currentTime: number): void;
  onMediaTimeUpdate(currentTime: number): void;
  onMediaPause(currentTime?: number): void;
  onMediaSeeked(newTime: number): void;
  addWatchedInterval(from: number, to: number): void;
  getUniqueWatchedSeconds(): number;
  getCompletionPercentage(): string;
  getAnalytics(): DocAnalyticsReport;
  setAnalytics(data: Partial<DocAnalyticsReport>): void;
  getTimeSpent(): DocTimeSpentReport;
  setTimeSpent(data: Partial<DocTimeSpentReport>): void;
  resetAnalytics(): void;
  getWatchedIntervals(): WatchedInterval[];
  setWatchedIntervals(intervals: Array<{ from: number; to: number }>): void;
  destroy(): void;
}

export declare const FORMAT_TYPES: {
  IMAGE: 'image';
  VIDEO: 'video';
  AUDIO: 'audio';
  SHEET: 'sheet';
  XLSX: 'xlsx';
  CODE: 'code';
  HTML: 'html';
  JSON: 'json';
  YAML: 'yaml';
  XML: 'xml';
  MARKDOWN: 'markdown';
  TEXT: 'text';
  PDF: 'pdf';
  DOCX: 'docx';
  PPTX: 'pptx';
  DIAGRAM: 'diagram';
  FALLBACK: 'fallback';
};

export declare class HtmlEngine {
  constructor(viewer: any);
  viewMode: HtmlViewMode;
  allowedModes: HtmlViewMode[];
  showSwitcher: boolean;
  allowScripts: boolean;
  render(fileInput: any, viewport: HTMLElement): Promise<void>;
  updateViewMode(mode: HtmlViewMode): void;
  destroy(): void;
}

export { HtmlEngine };

export default DocViewer;
