/**
 * Handcrafted Zero-Dependency PKZIP Reader & Decompressor
 * Uses native DecompressionStream('deflate-raw') supported across all modern browsers.
 * Resilient against Windows backslashes, path prefixes, and streaming archives.
 */
export class ZipReader {
  constructor(arrayBuffer) {
    this.bytes = new Uint8Array(arrayBuffer);
    this.view = new DataView(this.bytes.buffer, this.bytes.byteOffset, this.bytes.byteLength);
    this.entries = new Map();
    this.parsed = false;
  }

  async parse() {
    if (this.parsed) return;
    const len = this.bytes.length;
    if (len < 22) throw new Error('File too small to be a valid ZIP archive');

    // 1. Locate End of Central Directory (EOCD) by scanning backwards
    let eocdOffset = -1;
    const searchLimit = Math.max(0, len - 65557);
    for (let i = len - 22; i >= searchLimit; i--) {
      if (this.view.getUint32(i, true) === 0x06054b50) {
        eocdOffset = i;
        break;
      }
    }

    if (eocdOffset !== -1) {
      const totalEntries = this.view.getUint16(eocdOffset + 10, true);
      const cdOffset = this.view.getUint32(eocdOffset + 16, true);
      const decoder = new TextDecoder('utf-8');

      let p = cdOffset;
      for (let i = 0; i < totalEntries && p < len - 46; i++) {
        if (this.view.getUint32(p, true) !== 0x02014b50) break;

        const method = this.view.getUint16(p + 10, true);
        const compSize = this.view.getUint32(p + 20, true);
        const uncompSize = this.view.getUint32(p + 24, true);
        const nameLen = this.view.getUint16(p + 28, true);
        const extraLen = this.view.getUint16(p + 30, true);
        const commentLen = this.view.getUint16(p + 32, true);
        const localOffset = this.view.getUint32(p + 42, true);

        const nameBytes = this.bytes.subarray(p + 46, p + 46 + nameLen);
        const rawName = decoder.decode(nameBytes);
        const normalizedName = rawName.replace(/\\/g, '/');

        this.entries.set(normalizedName.toLowerCase(), {
          name: normalizedName,
          method,
          compSize,
          uncompSize,
          localOffset
        });

        p += 46 + nameLen + extraLen + commentLen;
      }
    }

    // If EOCD failed or produced 0 entries, fallback to scanning local headers
    if (this.entries.size === 0) {
      this.scanLocalHeaders();
    }

    this.parsed = true;
  }

  scanLocalHeaders() {
    const decoder = new TextDecoder('utf-8');
    let p = 0;
    const len = this.bytes.length;

    while (p < len - 30) {
      if (this.view.getUint32(p, true) === 0x04034b50) {
        const method = this.view.getUint16(p + 8, true);
        let compSize = this.view.getUint32(p + 18, true);
        const uncompSize = this.view.getUint32(p + 22, true);
        const nameLen = this.view.getUint16(p + 26, true);
        const extraLen = this.view.getUint16(p + 28, true);

        const nameBytes = this.bytes.subarray(p + 30, p + 30 + nameLen);
        const rawName = decoder.decode(nameBytes);
        const normalizedName = rawName.replace(/\\/g, '/');
        const dataStart = p + 30 + nameLen + extraLen;

        // If compSize is 0 in local header (data descriptor flag), scan to next header
        if (compSize === 0 && p + 30 < len) {
          for (let s = dataStart; s < len - 4; s++) {
            const sig = this.view.getUint32(s, true);
            if (sig === 0x04034b50 || sig === 0x02014b50 || sig === 0x08074b50) {
              compSize = s - dataStart;
              break;
            }
          }
          if (compSize === 0) compSize = len - dataStart;
        }

        this.entries.set(normalizedName.toLowerCase(), {
          name: normalizedName,
          method,
          compSize,
          uncompSize,
          localOffset: p
        });

        p = dataStart + compSize;
      } else {
        p++;
      }
    }
  }

  getFileList() {
    return Array.from(this.entries.values()).map(e => e.name);
  }

  hasEntry(filename) {
    const clean = filename.replace(/\\/g, '/').toLowerCase();
    if (this.entries.has(clean)) return true;
    for (const key of this.entries.keys()) {
      if (key.endsWith('/' + clean) || clean.endsWith('/' + key)) return true;
    }
    return false;
  }

  async readEntryAsBuffer(filename) {
    await this.parse();
    const cleanKey = filename.replace(/\\/g, '/').toLowerCase();
    let entry = this.entries.get(cleanKey);

    if (!entry) {
      for (const [key, val] of this.entries.entries()) {
        if (key.endsWith('/' + cleanKey) || cleanKey.endsWith('/' + key) || key === cleanKey) {
          entry = val;
          break;
        }
      }
    }

    if (!entry) return null;

    const localOffset = entry.localOffset;
    if (this.view.getUint32(localOffset, true) !== 0x04034b50) {
      throw new Error(`Corrupt local header for ${filename}`);
    }

    const localNameLen = this.view.getUint16(localOffset + 26, true);
    const localExtraLen = this.view.getUint16(localOffset + 28, true);
    const dataStart = localOffset + 30 + localNameLen + localExtraLen;
    const compData = this.bytes.subarray(dataStart, dataStart + entry.compSize);

    // Stored (method 0: uncompressed)
    if (entry.method === 0) {
      return compData;
    }

    // Deflate (method 8)
    if (entry.method === 8) {
      if (typeof DecompressionStream !== 'undefined') {
        const ds = new DecompressionStream('deflate-raw');
        const writer = ds.writable.getWriter();
        writer.write(compData);
        writer.close();
        const res = new Response(ds.readable);
        const arrayBuf = await res.arrayBuffer();
        return new Uint8Array(arrayBuf);
      }
      throw new Error('DecompressionStream is not supported in this browser');
    }

    throw new Error(`Unsupported compression method: ${entry.method}`);
  }

  async readEntryAsText(filename) {
    const buffer = await this.readEntryAsBuffer(filename);
    if (!buffer) return null;
    return new TextDecoder('utf-8').decode(buffer);
  }
}
