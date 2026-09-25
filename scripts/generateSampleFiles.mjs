import zlib from 'zlib';
import fs from 'fs';
import path from 'path';

function createZipBuffer(entries) {
  const parts = [];
  const cdEntries = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBytes = Buffer.from(entry.name);
    const rawData = Buffer.from(entry.content);
    const deflated = zlib.deflateRawSync(rawData);

    // Local Header
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0);
    lh.writeUInt16LE(20, 4);
    lh.writeUInt16LE(0, 6);
    lh.writeUInt16LE(8, 8); // method 8 (deflate)
    lh.writeUInt32LE(deflated.length, 18);
    lh.writeUInt32LE(rawData.length, 22);
    lh.writeUInt16LE(nameBytes.length, 26);
    lh.writeUInt16LE(0, 28);

    parts.push(lh);
    parts.push(nameBytes);
    parts.push(deflated);

    // Central Directory Entry
    const cd = Buffer.alloc(46);
    cd.writeUInt32LE(0x02014b50, 0);
    cd.writeUInt16LE(20, 4);
    cd.writeUInt16LE(20, 6);
    cd.writeUInt16LE(8, 10);
    cd.writeUInt32LE(deflated.length, 20);
    cd.writeUInt32LE(rawData.length, 24);
    cd.writeUInt16LE(nameBytes.length, 28);
    cd.writeUInt32LE(offset, 42);

    cdEntries.push(cd);
    cdEntries.push(nameBytes);

    offset += 30 + nameBytes.length + deflated.length;
  }

  const cdStart = offset;
  let cdSize = 0;
  for (const p of cdEntries) {
    parts.push(p);
    cdSize += p.length;
  }

  // EOCD
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(cdSize, 12);
  eocd.writeUInt32LE(cdStart, 16);
  parts.push(eocd);

  return Buffer.concat(parts);
}

// Ensure tests/samples directory exists
const samplesDir = path.resolve('tests/samples');
if (!fs.existsSync(samplesDir)) {
  fs.mkdirSync(samplesDir, { recursive: true });
}

// 1. Generate Multi-Page Sample DOCX
const docxEntries = [
  {
    name: '[Content_Types].xml',
    content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`
  },
  {
    name: '_rels/.rels',
    content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`
  },
  {
    name: 'word/document.xml',
    content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p>
      <w:pPr><w:pStyle w:val="Heading1"/></w:pPr>
      <w:r><w:t>DocView-All Universal Document Report</w:t></w:r>
    </w:p>
    <w:p>
      <w:r><w:t>This is Page 1 of our multi-page Word document preview. DocView-All renders formatted text, rich headings, and tables with zero third-party dependencies.</w:t></w:r>
    </w:p>
    <w:p>
      <w:r><w:rPr><w:b/><w:color w:val="3B82F6"/></w:rPr><w:t>High-Performance Architecture Highlights:</w:t></w:r>
    </w:p>
    <w:p>
      <w:pPr><w:numPr/></w:pPr>
      <w:r><w:t>Zero external runtime dependencies (<15KB bundle)</w:t></w:r>
    </w:p>
    <w:p>
      <w:pPr><w:numPr/></w:pPr>
      <w:r><w:t>Supports 38+ file types including PDF, DOCX, XLSX, CSV, Video, Audio</w:t></w:r>
    </w:p>
    <w:p>
      <w:pPr><w:numPr/></w:pPr>
      <w:r><w:t>Full multi-page A4 document pagination and zoom</w:t></w:r>
    </w:p>

    <!-- Explicit Page Break to Page 2 -->
    <w:p><w:r><w:br w:type="page"/></w:r></w:p>

    <w:p>
      <w:pPr><w:pStyle w:val="Heading2"/></w:pPr>
      <w:r><w:t>Page 2: Financial Metrics & Data Summary</w:t></w:r>
    </w:p>
    <w:p>
      <w:r><w:t>The following table is rendered directly from Word XML structure:</w:t></w:r>
    </w:p>
    <w:tbl>
      <w:tr>
        <w:tc><w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Quarter</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Revenue</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Growth</w:t></w:r></w:p></w:tc>
      </w:tr>
      <w:tr>
        <w:tc><w:p><w:r><w:t>Q1 2026</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>$1,420,000</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:color w:val="10B981"/><w:b/><w:t>+18.5%</w:t></w:r></w:p></w:tc>
      </w:tr>
      <w:tr>
        <w:tc><w:p><w:r><w:t>Q2 2026</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>$1,890,000</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:color w:val="10B981"/><w:b/><w:t>+24.2%</w:t></w:r></w:p></w:tc>
      </w:tr>
      <w:tr>
        <w:tc><w:p><w:r><w:t>Q3 2026</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>$2,410,000</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:color w:val="10B981"/><w:b/><w:t>+31.0%</w:t></w:r></w:p></w:tc>
      </w:tr>
    </w:tbl>

    <!-- Explicit Page Break to Page 3 -->
    <w:p><w:r><w:br w:type="page"/></w:r></w:p>

    <w:p>
      <w:pPr><w:pStyle w:val="Heading2"/></w:pPr>
      <w:r><w:t>Page 3: Conclusion & Next Steps</w:t></w:r>
    </w:p>
    <w:p>
      <w:r><w:t>Notice how Page 1, Page 2, and Page 3 appear as separate A4 paper pages with clean shadows, page margins, and footer numbering.</w:t></w:r>
    </w:p>
  </w:body>
</w:document>`
  }
];

fs.writeFileSync(path.join(samplesDir, 'sample.docx'), createZipBuffer(docxEntries));
console.log('✓ Generated sample.docx');

// 2. Generate Multi-Sheet Sample XLSX
const xlsxEntries = [
  {
    name: '[Content_Types].xml',
    content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>
</Types>`
  },
  {
    name: 'xl/_rels/workbook.xml.rels',
    content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>
</Relationships>`
  },
  {
    name: 'xl/workbook.xml',
    content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="Sales 2026" sheetId="1" r:id="rId1"/>
    <sheet name="Inventory" sheetId="2" r:id="rId2"/>
  </sheets>
</workbook>`
  },
  {
    name: 'xl/sharedStrings.xml',
    content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="8" uniqueCount="8">
  <si><t>ID</t></si>
  <si><t>Product Name</t></si>
  <si><t>Category</t></si>
  <si><t>Price</t></si>
  <si><t>Units Sold</t></si>
  <si><t>Total Revenue</t></si>
  <si><t>Smart 4K Monitor</t></si>
  <si><t>Mechanical Keyboard</t></si>
</sst>`
  },
  {
    name: 'xl/worksheets/sheet1.xml',
    content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>
    <row r="1">
      <c r="A1" t="s"><v>0</v></c>
      <c r="B1" t="s"><v>1</v></c>
      <c r="C1" t="s"><v>2</v></c>
      <c r="D1" t="s"><v>3</v></c>
      <c r="E1" t="s"><v>4</v></c>
      <c r="F1" t="s"><v>5</v></c>
    </row>
    <row r="2">
      <c r="A2"><v>1001</v></c>
      <c r="B2" t="s"><v>6</v></c>
      <c r="C2" t="inlineStr"><is><t>Electronics</t></is></c>
      <c r="D2"><v>499.99</v></c>
      <c r="E2"><v>340</v></c>
      <c r="F2"><v>169996.60</v></c>
    </row>
    <row r="3">
      <c r="A3"><v>1002</v></c>
      <c r="B3" t="s"><v>7</v></c>
      <c r="C3" t="inlineStr"><is><t>Accessories</t></is></c>
      <c r="D3"><v>89.50</v></c>
      <c r="E3"><v>820</v></c>
      <c r="F3"><v>73390.00</v></c>
    </row>
  </sheetData>
</worksheet>`
  },
  {
    name: 'xl/worksheets/sheet2.xml',
    content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>
    <row r="1">
      <c r="A1" t="inlineStr"><is><t>SKU</t></is></c>
      <c r="B1" t="inlineStr"><is><t>Warehouse</t></is></c>
      <c r="C1" t="inlineStr"><is><t>Stock Available</t></is></c>
    </row>
    <row r="2">
      <c r="A2" t="inlineStr"><is><t>SKU-9901</t></is></c>
      <c r="B2" t="inlineStr"><is><t>Dallas Hub</t></is></c>
      <c r="C2"><v>1250</v></c>
    </row>
  </sheetData>
</worksheet>`
  }
];

fs.writeFileSync(path.join(samplesDir, 'sample.xlsx'), createZipBuffer(xlsxEntries));
console.log('✓ Generated sample.xlsx');
