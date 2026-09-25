/**
 * MIME and Format Detector for DocView-All (Zero external dependencies)
 * Identifies 38+ file types from filenames, URLs, Blobs, or MIME headers
 */

export const FORMAT_TYPES = {
  IMAGE: 'image',
  VIDEO: 'video',
  AUDIO: 'audio',
  SHEET: 'sheet',
  CODE: 'code',
  JSON: 'json',
  YAML: 'yaml',
  XML: 'xml',
  MARKDOWN: 'markdown',
  TEXT: 'text',
  PDF: 'pdf',
  DOCX: 'docx',
  XLSX: 'xlsx',
  PPTX: 'pptx',
  DIAGRAM: 'diagram',
  FALLBACK: 'fallback'
};

const EXTENSION_MAP = {
  // Images
  jpg: FORMAT_TYPES.IMAGE,
  jpeg: FORMAT_TYPES.IMAGE,
  png: FORMAT_TYPES.IMAGE,
  gif: FORMAT_TYPES.IMAGE,
  webp: FORMAT_TYPES.IMAGE,
  svg: FORMAT_TYPES.IMAGE,
  bmp: FORMAT_TYPES.IMAGE,
  ico: FORMAT_TYPES.IMAGE,
  avif: FORMAT_TYPES.IMAGE,

  // Video & Streaming
  mp4: FORMAT_TYPES.VIDEO,
  webm: FORMAT_TYPES.VIDEO,
  ogg: FORMAT_TYPES.VIDEO,
  mov: FORMAT_TYPES.VIDEO,
  mpd: FORMAT_TYPES.VIDEO,   // DASH Stream
  m3u8: FORMAT_TYPES.VIDEO,  // HLS Stream

  // Audio
  mp3: FORMAT_TYPES.AUDIO,
  wav: FORMAT_TYPES.AUDIO,
  aac: FORMAT_TYPES.AUDIO,
  flac: FORMAT_TYPES.AUDIO,
  m4a: FORMAT_TYPES.AUDIO,

  // Spreadsheets
  csv: FORMAT_TYPES.SHEET,
  tsv: FORMAT_TYPES.SHEET,
  xlsx: FORMAT_TYPES.XLSX,
  xls: FORMAT_TYPES.XLSX,
  ods: FORMAT_TYPES.XLSX,

  // Word Documents
  docx: FORMAT_TYPES.DOCX,
  doc: FORMAT_TYPES.DOCX,
  odt: FORMAT_TYPES.DOCX,
  rtf: FORMAT_TYPES.DOCX,

  // Presentations
  pptx: FORMAT_TYPES.PPTX,
  ppt: FORMAT_TYPES.PPTX,
  ppsx: FORMAT_TYPES.PPTX,
  pps: FORMAT_TYPES.PPTX,
  potx: FORMAT_TYPES.PPTX,
  odp: FORMAT_TYPES.PPTX,

  // Code
  js: FORMAT_TYPES.CODE,
  jsx: FORMAT_TYPES.CODE,
  ts: FORMAT_TYPES.CODE,
  tsx: FORMAT_TYPES.CODE,
  html: FORMAT_TYPES.CODE,
  htm: FORMAT_TYPES.CODE,
  css: FORMAT_TYPES.CODE,
  scss: FORMAT_TYPES.CODE,
  py: FORMAT_TYPES.CODE,
  java: FORMAT_TYPES.CODE,
  c: FORMAT_TYPES.CODE,
  cpp: FORMAT_TYPES.CODE,
  cs: FORMAT_TYPES.CODE,
  go: FORMAT_TYPES.CODE,
  rs: FORMAT_TYPES.CODE,
  php: FORMAT_TYPES.CODE,
  sql: FORMAT_TYPES.CODE,
  sh: FORMAT_TYPES.CODE,
  io: FORMAT_TYPES.CODE,
  drawio: FORMAT_TYPES.DIAGRAM,
  dio: FORMAT_TYPES.DIAGRAM,

  // Structured Data & Config
  json: FORMAT_TYPES.JSON,
  xml: FORMAT_TYPES.XML,
  xsd: FORMAT_TYPES.XML,
  xsl: FORMAT_TYPES.XML,
  xslt: FORMAT_TYPES.XML,
  wsdl: FORMAT_TYPES.XML,
  plist: FORMAT_TYPES.XML,
  rss: FORMAT_TYPES.XML,
  atom: FORMAT_TYPES.XML,
  yaml: FORMAT_TYPES.YAML,
  yml: FORMAT_TYPES.YAML,

  // Text & Markdown
  md: FORMAT_TYPES.MARKDOWN,
  markdown: FORMAT_TYPES.MARKDOWN,
  txt: FORMAT_TYPES.TEXT,
  text: FORMAT_TYPES.TEXT,
  log: FORMAT_TYPES.TEXT,
  env: FORMAT_TYPES.TEXT,
  ini: FORMAT_TYPES.TEXT,
  conf: FORMAT_TYPES.TEXT,
  config: FORMAT_TYPES.TEXT,
  cfg: FORMAT_TYPES.TEXT,
  properties: FORMAT_TYPES.TEXT,
  diff: FORMAT_TYPES.TEXT,
  patch: FORMAT_TYPES.TEXT,
  inf: FORMAT_TYPES.TEXT,

  // Documents
  pdf: FORMAT_TYPES.PDF
};

export function detectFormat(fileInput) {
  if (!fileInput) return { type: FORMAT_TYPES.FALLBACK, ext: '', name: 'Unknown' };

  let name = '';
  let ext = '';
  let mime = '';

  if (typeof fileInput === 'string') {
    // Extract filename from URL or path
    const cleanUrl = fileInput.split('#')[0].split('?')[0];
    const parts = cleanUrl.split('/');
    name = parts[parts.length - 1] || 'Document';
    const dotIdx = name.lastIndexOf('.');
    if (dotIdx !== -1) {
      ext = name.substring(dotIdx + 1).toLowerCase();
    }
  } else if (fileInput instanceof File || fileInput instanceof Blob) {
    name = fileInput.name || 'Uploaded File';
    mime = fileInput.type || '';
    if (name.includes('.')) {
      ext = name.split('.').pop().toLowerCase();
    }
  } else if (typeof fileInput === 'object' && fileInput.url) {
    return detectFormat(fileInput.url);
  }

  // Check DASH / HLS streaming indicators
  if (ext === 'mpd' || (typeof fileInput === 'string' && fileInput.includes('.mpd'))) {
    return { type: FORMAT_TYPES.VIDEO, ext: 'mpd', name, isDash: true };
  }
  if (ext === 'm3u8' || (typeof fileInput === 'string' && fileInput.includes('.m3u8'))) {
    return { type: FORMAT_TYPES.VIDEO, ext: 'm3u8', name, isHls: true };
  }
  if (ext === 'drawio' || ext === 'dio' || (typeof fileInput === 'string' && fileInput.toLowerCase().includes('.drawio'))) {
    return { type: FORMAT_TYPES.DIAGRAM, ext: 'drawio', name, isDiagram: true };
  }

  // 1. Extension Map Check (high priority - file extensions are much more specific than generic browser MIME types)
  if (ext && EXTENSION_MAP[ext]) {
    return { type: EXTENSION_MAP[ext], ext, name };
  }

  // 2. MIME fallback (for extensionless files or remote blobs)
  if (mime) {
    if (mime.includes('markdown')) return { type: FORMAT_TYPES.MARKDOWN, ext: ext || 'md', name };
    if (mime.startsWith('image/')) return { type: FORMAT_TYPES.IMAGE, ext: ext || 'png', name };
    if (mime.startsWith('video/')) return { type: FORMAT_TYPES.VIDEO, ext: ext || 'mp4', name };
    if (mime.startsWith('audio/')) return { type: FORMAT_TYPES.AUDIO, ext: ext || 'mp3', name };
    if (mime === 'application/pdf') return { type: FORMAT_TYPES.PDF, ext: 'pdf', name };
    if (mime.includes('presentationml') || mime.includes('powerpoint')) return { type: FORMAT_TYPES.PPTX, ext: ext || 'pptx', name };
    if (mime.includes('wordprocessingml') || mime.includes('msword')) return { type: FORMAT_TYPES.DOCX, ext: ext || 'docx', name };
    if (mime.includes('spreadsheetml')) return { type: FORMAT_TYPES.XLSX, ext: ext || 'xlsx', name };
    if (mime === 'application/json') return { type: FORMAT_TYPES.JSON, ext: 'json', name };
    if (mime.includes('yaml') || mime.includes('x-yaml')) return { type: FORMAT_TYPES.YAML, ext: ext || 'yaml', name };
    if (mime === 'application/xml' || mime === 'text/xml' || mime.includes('+xml') || mime.includes('/xml')) return { type: FORMAT_TYPES.XML, ext: ext || 'xml', name };
    if (mime.includes('csv') || mime.includes('spreadsheet')) return { type: FORMAT_TYPES.SHEET, ext: ext || 'csv', name };
    if (mime.startsWith('text/')) return { type: FORMAT_TYPES.TEXT, ext: ext || 'txt', name };
  }

  return { type: FORMAT_TYPES.FALLBACK, ext, name };
}

export function formatFileSize(bytes) {
  if (!bytes || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}
