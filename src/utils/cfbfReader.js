/**
 * Handcrafted Zero-Dependency Compound File Binary Format (CFBF / OLE2) Reader
 * Parses Microsoft Structured Storage files (.ppt, .doc, .xls) directly from ArrayBuffer.
 * Works natively in modern browsers and Node.js environments.
 */

export class CFBFReader {
  constructor(arrayBuffer) {
    this.buffer = new Uint8Array(arrayBuffer);
    this.view = new DataView(arrayBuffer);
    this.sectorSize = 512;
    this.miniSectorSize = 64;
    this.fat = [];
    this.miniFat = [];
    this.miniStream = null;
    this.entries = [];
    this.parsed = false;
  }

  parse() {
    if (this.parsed) return;
    if (this.buffer.length < 512) {
      throw new Error('File too small to be a valid OLE2/CFBF Compound Document');
    }

    // Verify CFBF Header Signature: 0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1
    const sig = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
    for (let i = 0; i < 8; i++) {
      if (this.buffer[i] !== sig[i]) {
        throw new Error('Invalid signature: Not an OLE2/CFBF Compound Document');
      }
    }

    const sectorShift = this.view.getUint16(30, true);
    this.sectorSize = 1 << sectorShift;
    const miniSectorShift = this.view.getUint16(32, true);
    this.miniSectorSize = 1 << miniSectorShift;

    const numFatSectors = this.view.getUint32(44, true);
    const firstDirSector = this.view.getUint32(48, true);
    const firstMiniFatSector = this.view.getUint32(60, true);
    const firstDifatSector = this.view.getUint32(68, true);

    // 1. Build DIFAT array (Double-Indirect File Allocation Table)
    const difat = [];
    for (let i = 0; i < 109; i++) {
      const sec = this.view.getUint32(76 + i * 4, true);
      if (sec < 0xfffffffa) difat.push(sec);
    }
    let currDifat = firstDifatSector;
    while (currDifat < 0xfffffffa && difat.length < numFatSectors) {
      const offset = (currDifat + 1) * this.sectorSize;
      const count = (this.sectorSize / 4) - 1;
      for (let i = 0; i < count; i++) {
        const sec = this.view.getUint32(offset + i * 4, true);
        if (sec < 0xfffffffa) difat.push(sec);
      }
      currDifat = this.view.getUint32(offset + count * 4, true);
    }

    // 2. Build FAT array
    const fatEntriesPerSector = this.sectorSize / 4;
    this.fat = [];
    for (const fatSec of difat) {
      const offset = (fatSec + 1) * this.sectorSize;
      for (let i = 0; i < fatEntriesPerSector; i++) {
        this.fat.push(this.view.getUint32(offset + i * 4, true));
      }
    }

    // 3. Build MiniFAT array
    if (firstMiniFatSector < 0xfffffffa) {
      const miniFatSectors = this.getSectorChain(firstMiniFatSector);
      for (const mSec of miniFatSectors) {
        const offset = (mSec + 1) * this.sectorSize;
        for (let i = 0; i < fatEntriesPerSector; i++) {
          this.miniFat.push(this.view.getUint32(offset + i * 4, true));
        }
      }
    }

    // 4. Parse Directory Entries
    const dirSectors = this.getSectorChain(firstDirSector);
    const entriesPerSector = this.sectorSize / 128;
    this.entries = [];

    for (const dSec of dirSectors) {
      const secOffset = (dSec + 1) * this.sectorSize;
      for (let i = 0; i < entriesPerSector; i++) {
        const entryOffset = secOffset + i * 128;
        const nameLen = this.view.getUint16(entryOffset + 64, true);
        if (!nameLen) continue;

        let name = '';
        for (let c = 0; c < (nameLen - 2) / 2; c++) {
          name += String.fromCharCode(this.view.getUint16(entryOffset + c * 2, true));
        }

        const type = this.view.getUint8(entryOffset + 66); // 1 = storage, 2 = stream, 5 = root
        const startSec = this.view.getUint32(entryOffset + 116, true);
        const size = this.view.getUint32(entryOffset + 120, true);

        this.entries.push({ name, type, startSec, size });
      }
    }

    // 5. Load Mini Stream from Root Entry (Type 5)
    const rootEntry = this.entries.find(e => e.type === 5);
    if (rootEntry && rootEntry.startSec < 0xfffffffa && rootEntry.size > 0) {
      this.miniStream = this.readStreamBySector(rootEntry.startSec, rootEntry.size);
    }

    this.parsed = true;
  }

  getSectorChain(startSec) {
    const chain = [];
    let curr = startSec;
    const visited = new Set();
    while (curr < 0xfffffffa) {
      if (visited.has(curr)) break;
      visited.add(curr);
      chain.push(curr);
      curr = this.fat[curr];
      if (curr === undefined) break;
    }
    return chain;
  }

  getMiniSectorChain(startSec) {
    const chain = [];
    let curr = startSec;
    const visited = new Set();
    while (curr < 0xfffffffa) {
      if (visited.has(curr)) break;
      visited.add(curr);
      chain.push(curr);
      curr = this.miniFat[curr];
      if (curr === undefined) break;
    }
    return chain;
  }

  readStreamBySector(startSec, size) {
    const chain = this.getSectorChain(startSec);
    const out = new Uint8Array(size);
    let bytesRead = 0;
    for (const sec of chain) {
      if (bytesRead >= size) break;
      const offset = (sec + 1) * this.sectorSize;
      const toRead = Math.min(this.sectorSize, size - bytesRead);
      out.set(this.buffer.subarray(offset, offset + toRead), bytesRead);
      bytesRead += toRead;
    }
    return out;
  }

  readStreamByMiniSector(startSec, size) {
    if (!this.miniStream) return new Uint8Array(0);
    const chain = this.getMiniSectorChain(startSec);
    const out = new Uint8Array(size);
    let bytesRead = 0;
    for (const mSec of chain) {
      if (bytesRead >= size) break;
      const offset = mSec * this.miniSectorSize;
      const toRead = Math.min(this.miniSectorSize, size - bytesRead);
      out.set(this.miniStream.subarray(offset, offset + toRead), bytesRead);
      bytesRead += toRead;
    }
    return out;
  }

  getStream(name) {
    this.parse();
    const cleanName = name.trim().toLowerCase();
    const entry = this.entries.find(e => e.name.trim().toLowerCase() === cleanName);
    if (!entry) return null;
    if (entry.size < 4096) {
      return this.readStreamByMiniSector(entry.startSec, entry.size);
    } else {
      return this.readStreamBySector(entry.startSec, entry.size);
    }
  }

  hasStream(name) {
    this.parse();
    const cleanName = name.trim().toLowerCase();
    return this.entries.some(e => e.name.trim().toLowerCase() === cleanName);
  }
}
