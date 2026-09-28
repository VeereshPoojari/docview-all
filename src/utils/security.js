/**
 * Universal Zero-Dependency Security & Sanitization Utilities
 * DocView-All Security Hardening:
 * - Strict XSS prevention across dynamic HTML injections
 * - Protocol allowlisting (blocks javascript:, vbscript:, data:text/html, etc.)
 * - Safe color and CSS style property validation
 * - ReDoS resistant patterns
 */

/**
 * Escapes unsafe HTML characters to prevent XSS.
 * @param {*} str - Input value
 * @returns {string} Sanitized string
 */
export function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Protocol allowlist for safe external and internal links.
 * Prohibits javascript:, vbscript:, data:text/html, file: (if untrusted).
 */
const SAFE_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'tel:', 'blob:']);
const SAFE_DATA_IMAGE_PREFIX = /^data:image\/(?:png|jpeg|jpg|gif|svg\+xml|webp|bmp);base64,/i;

/**
 * Sanitizes URLs to prevent script execution via href, src, or iframe locations.
 * @param {string} url - Target URL
 * @param {boolean} [allowDataImage=false] - Whether data:image/* URLs are permitted
 * @returns {string} Safe URL or safe fallback ('#' / 'about:blank')
 */
export function sanitizeUrl(url, allowDataImage = false) {
  if (!url || typeof url !== 'string') return '#';
  const trimmed = url.trim();

  // Allow anchor links and relative paths
  if (trimmed.startsWith('#') || trimmed.startsWith('/') || trimmed.startsWith('./') || trimmed.startsWith('../')) {
    return escapeHtml(trimmed);
  }

  // Allow safe embedded image data URIs
  if (allowDataImage && SAFE_DATA_IMAGE_PREFIX.test(trimmed)) {
    return trimmed;
  }

  try {
    const parsed = new URL(trimmed, 'https://placeholder.local');
    if (SAFE_PROTOCOLS.has(parsed.protocol)) {
      return escapeHtml(trimmed);
    }
  } catch {
    // Malformed URL
  }

  return '#';
}

/**
 * Validates and sanitizes CSS colors to prevent style injection.
 * @param {string} color - Hex, rgb, rgba, hsl, or CSS color keyword
 * @returns {string} Safe color string or empty string
 */
export function sanitizeColor(color) {
  if (!color || typeof color !== 'string') return '';
  const trimmed = color.trim();
  // Validates hex (#fff, #ffffff, #ffffffff), rgb(), rgba(), hsl(), hsla(), or alpha-numeric named color
  if (/^(?:#[0-9a-fA-F]{3,8}|(?:rgb|rgba|hsl|hsla)\([0-9\s,%./-]+\)|[a-zA-Z]{3,20})$/.test(trimmed)) {
    return trimmed;
  }
  return '';
}
