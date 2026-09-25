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

export interface DocViewerOptions {
  file?: string | File | Blob | ArrayBuffer | null;
  theme?: DocViewerTheme;
  showToolbar?: boolean;
  toolbar?: boolean | DocViewerToolbarOptions;
  onLoad?: (info: FileInfo) => void;
}

export interface DocViewerInstance {
  file: any;
  theme: DocViewerTheme;
  scale: number;
  rotation: number;
  currentPage: number;
  totalPages: number;
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
  notify(message: string, type?: 'info' | 'success' | 'error' | 'warning', duration?: number): void;
  destroy(): void;

  static view(target: string | HTMLElement, options?: DocViewerOptions): DocViewer;
  static openModal(file: string | File | Blob | ArrayBuffer, options?: Partial<DocViewerOptions>): { viewer: DocViewer; close: () => void };
}

export declare function detectFormat(fileInput: any): FileInfo;
export declare function formatFileSize(bytes: number): string;

export declare const FORMAT_TYPES: {
  IMAGE: 'image';
  VIDEO: 'video';
  AUDIO: 'audio';
  SHEET: 'sheet';
  XLSX: 'xlsx';
  CODE: 'code';
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

export default DocViewer;
