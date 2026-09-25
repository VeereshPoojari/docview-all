import assert from 'assert';
import zlib from 'zlib';
import { createRequire } from 'module';
import { detectFormat, FORMAT_TYPES } from '../src/utils/mimeDetector.js';
import { ZipReader } from '../src/utils/zipReader.js';

const require = createRequire(import.meta.url);
const pkg = require('../package.json');

console.log('--- Running docview-all Automated Test Suite ---');

// 1. Validate package.json
assert.strictEqual(pkg.name, 'docview-all');
assert.strictEqual(pkg.version, '1.0.0');
assert.strictEqual(pkg.license, 'UNLICENSED');
assert.ok(pkg.exports['.'], 'Root export exists');
assert.ok(pkg.exports['./react'], 'React export exists');
assert.ok(pkg.exports['./vue'], 'Vue export exists');
assert.ok(pkg.exports['./angular'], 'Angular export exists');
assert.ok(pkg.exports['./react-native'], 'React Native export exists');
console.log('✓ package.json metadata and subpath exports valid');

// 2. Format detection checks
assert.strictEqual(FORMAT_TYPES.DOCX, 'docx');
assert.strictEqual(FORMAT_TYPES.XLSX, 'xlsx');
assert.strictEqual(FORMAT_TYPES.SHEET, 'sheet');
assert.strictEqual(FORMAT_TYPES.PDF, 'pdf');
assert.strictEqual(FORMAT_TYPES.TEXT, 'text');
assert.strictEqual(FORMAT_TYPES.AUDIO, 'audio');
assert.strictEqual(FORMAT_TYPES.YAML, 'yaml');
assert.strictEqual(FORMAT_TYPES.XML, 'xml');

assert.strictEqual(detectFormat('document.docx').type, FORMAT_TYPES.DOCX);
assert.strictEqual(detectFormat('report.xlsx').type, FORMAT_TYPES.XLSX);
assert.strictEqual(detectFormat('finance.csv').type, FORMAT_TYPES.SHEET);
assert.strictEqual(detectFormat('paper.pdf').type, FORMAT_TYPES.PDF);
assert.strictEqual(detectFormat('stream.mpd').type, FORMAT_TYPES.VIDEO);
assert.strictEqual(detectFormat('notes.txt').type, FORMAT_TYPES.TEXT);
assert.strictEqual(detectFormat('app.log').type, FORMAT_TYPES.TEXT);
assert.strictEqual(detectFormat('song.mp3').type, FORMAT_TYPES.AUDIO);
assert.strictEqual(detectFormat('audio.wav').type, FORMAT_TYPES.AUDIO);
assert.strictEqual(detectFormat('track.flac').type, FORMAT_TYPES.AUDIO);
assert.strictEqual(detectFormat('voice.m4a').type, FORMAT_TYPES.AUDIO);
assert.strictEqual(detectFormat('script.io').type, FORMAT_TYPES.CODE);
assert.strictEqual(detectFormat('diagram.drawio').type, FORMAT_TYPES.DIAGRAM);
assert.strictEqual(detectFormat('system.dio').type, FORMAT_TYPES.DIAGRAM);
assert.strictEqual(detectFormat('config.yaml').type, FORMAT_TYPES.YAML);
assert.strictEqual(detectFormat('docker-compose.yml').type, FORMAT_TYPES.YAML);
assert.strictEqual(detectFormat('config.xml').type, FORMAT_TYPES.XML);
assert.strictEqual(detectFormat('schema.xsd').type, FORMAT_TYPES.XML);
assert.strictEqual(detectFormat('feed.rss').type, FORMAT_TYPES.XML);
assert.strictEqual(detectFormat('service.wsdl').type, FORMAT_TYPES.XML);
assert.strictEqual(FORMAT_TYPES.PPTX, 'pptx');
assert.strictEqual(detectFormat('pitch.pptx').type, FORMAT_TYPES.PPTX);
assert.strictEqual(detectFormat('deck.ppt').type, FORMAT_TYPES.PPTX);
assert.strictEqual(detectFormat('show.ppsx').type, FORMAT_TYPES.PPTX);
console.log('✓ MIME & Format Detection verified for DOCX, XLSX, PPTX, CSV, PDF, Video, Text, Audio, Diagram, YAML, and XML');

// 3. Test ZipReader with deflated DOCX & XLSX entries
function createTestZip(entries) {
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

async function runZipTest() {
  const testZipBuffer = createTestZip([
    { name: 'word/document.xml', content: '<w:document><w:body><w:p><w:t>Hello DOCX</w:t></w:p></w:body></w:document>' },
    { name: 'xl/sharedStrings.xml', content: '<sst><si><t>Revenue</t></si></sst>' },
    { name: 'xl/worksheets/sheet1.xml', content: '<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c></row></sheetData></worksheet>' }
  ]);

  const zip = new ZipReader(testZipBuffer);
  await zip.parse();

  const docXml = await zip.readEntryAsText('word/document.xml');
  assert.ok(docXml.includes('Hello DOCX'), 'DOCX document.xml parsed correctly');

  const sstXml = await zip.readEntryAsText('xl/sharedStrings.xml');
  assert.ok(sstXml.includes('Revenue'), 'XLSX sharedStrings.xml parsed correctly');

  const sheetXml = await zip.readEntryAsText('xl/worksheets/sheet1.xml');
  assert.ok(sheetXml.includes('sheetData'), 'XLSX sheet1.xml parsed correctly');

  console.log('✓ ZipReader successfully decompressed and extracted DOCX and XLSX OpenXML structures');

  // 4. Test MarkdownEngine (GFM: Tables, Images, Alerts, Code Blocks)
  const { MarkdownEngine } = await import('../src/engines/markdownEngine.js');
  const fs = await import('fs');
  const readmePath = new URL('../README.md', import.meta.url);
  const readmeContent = fs.readFileSync(readmePath, 'utf8');
  
  const mdEngine = new MarkdownEngine(null);
  const parsedHtml = mdEngine.parseMarkdown(readmeContent);

  assert.ok(parsedHtml.includes('class="dva-md-table"'), 'Markdown tables parsed');
  assert.ok(parsedHtml.includes('class="dva-md-badge"'), 'Markdown badge images parsed');
  assert.ok(parsedHtml.includes('class="dva-md-code-card"'), 'Markdown code blocks parsed');
  assert.ok(parsedHtml.includes('class="dva-md-h1"'), 'Markdown H1 parsed');
  assert.ok(parsedHtml.includes('class="dva-md-blockquote"'), 'Markdown blockquotes parsed');
  console.log('✓ MarkdownEngine successfully parsed GFM tables, badge images, code cards & headings');

  // 5. Test Paginated Document Engine Contracts (PDF & DOCX)
  const { DocViewer } = await import('../src/core/DocViewer.js');
  assert.strictEqual(typeof DocViewer.prototype.goToPage, 'function');
  assert.strictEqual(typeof DocViewer.prototype.nextPage, 'function');
  assert.strictEqual(typeof DocViewer.prototype.prevPage, 'function');
  assert.strictEqual(typeof DocViewer.prototype.setPageInfo, 'function');

  const { PdfEngine } = await import('../src/engines/pdfEngine.js');
  assert.strictEqual(typeof PdfEngine.prototype.goToPage, 'function');

  const { DocxEngine } = await import('../src/engines/docxEngine.js');
  assert.strictEqual(typeof DocxEngine.prototype.goToPage, 'function');

  // Verify scroll synchronization logic: scrolling from page 4 to 12 then clicking next goes to 13
  const dummyViewer = Object.create(DocViewer.prototype);
  dummyViewer.currentPage = 4;
  dummyViewer.totalPages = 20;
  dummyViewer.toolbar = null;
  dummyViewer.activeEngine = { goToPage: (p) => { dummyViewer.currentPage = p; } };

  // User scrolls to page 12
  dummyViewer.setPageInfo(12, 20);
  assert.strictEqual(dummyViewer.currentPage, 12, 'currentPage updated to 12 after scroll');

  // User clicks Next -> must go to 13
  dummyViewer.nextPage();
  assert.strictEqual(dummyViewer.currentPage, 13, 'nextPage after scrolling to 12 goes to 13 (not 5)');

  // User clicks Prev -> must go back to 12
  dummyViewer.prevPage();
  assert.strictEqual(dummyViewer.currentPage, 12, 'prevPage after page 13 goes to 12');

  console.log('✓ Paginated Navigation Contracts & Scroll Synchronization verified (scroll to 12 -> next goes to 13)');

  // 6. Test YamlEngine parsing and highlighting
  const { YamlEngine } = await import('../src/engines/yamlEngine.js');
  const yamlPath = new URL('./samples/sample.yaml', import.meta.url);
  const sampleYamlContent = fs.readFileSync(yamlPath, 'utf8');

  const yamlEngine = new YamlEngine(null);
  const parsedYaml = yamlEngine.simpleYamlParse(sampleYamlContent);

  assert.strictEqual(parsedYaml.version, '3.9', 'YAML version string parsed');
  assert.strictEqual(parsedYaml.name, 'universal-docview-stack', 'YAML name parsed');
  assert.strictEqual(parsedYaml.metadata.environment, 'production', 'YAML nested metadata.environment parsed');
  assert.strictEqual(parsedYaml.metadata.active, true, 'YAML boolean scalar parsed');
  assert.strictEqual(parsedYaml.metadata.replicas, 4, 'YAML integer parsed');
  assert.strictEqual(parsedYaml.metadata.max_memory_mb, 2048.5, 'YAML float parsed');
  assert.ok(parsedYaml.services.gateway, 'YAML nested service mapping parsed');

  const highlightedLine = yamlEngine.highlightYamlLine('  environment: production # deployment tier');
  assert.ok(highlightedLine.includes('class="dva-tok-key"'), 'YAML key syntax tokenized');
  assert.ok(highlightedLine.includes('class="dva-tok-comment"'), 'YAML inline comment tokenized');
  console.log('✓ YamlEngine parsed structures (nested maps, scalars, arrays) and highlighted syntax');

  // 7. Test XmlEngine syntax highlighting and structure
  const { XmlEngine } = await import('../src/engines/xmlEngine.js');
  const xmlPath = new URL('./samples/sample.xml', import.meta.url);
  const sampleXmlContent = fs.readFileSync(xmlPath, 'utf8');

  assert.ok(sampleXmlContent.includes('<server-configuration'), 'sample.xml root tag exists');
  const xmlEngine = new XmlEngine(null);

  const commentHighlighted = xmlEngine.highlightXmlLine('  <!-- API Services Configuration -->');
  assert.ok(commentHighlighted.includes('class="dva-tok-comment"'), 'XML comment tokenized');

  const tagHighlighted = xmlEngine.highlightXmlLine('  <service id="gateway" port="8080" enabled="true">');
  assert.ok(tagHighlighted.includes('class="dva-tok-tag"'), 'XML tag tokenized');
  assert.ok(tagHighlighted.includes('class="dva-tok-attr"'), 'XML attribute tokenized');
  assert.ok(tagHighlighted.includes('class="dva-tok-string"'), 'XML attribute value tokenized');

  const cdataHighlighted = xmlEngine.highlightXmlLine('    <query><![CDATA[SELECT * FROM users WHERE active = 1]]></query>');
  assert.ok(cdataHighlighted.includes('dva-tok-keyword'), 'XML CDATA tokenized');
  console.log('✓ XmlEngine highlighted tags, attributes, comments, and CDATA blocks');

  // 8. Test CodeEngine safe multi-token syntax highlighter
  const { CodeEngine } = await import('../src/engines/codeEngine.js');
  const codeEngine = new CodeEngine(null);
  const hlJs = codeEngine.highlightLine('const className = "my-class"; // defines class');
  assert.ok(hlJs.includes('class="dva-tok-kw"'), 'JS const keyword highlighted');
  assert.ok(hlJs.includes('class="dva-tok-str"'), 'JS string highlighted');
  assert.ok(hlJs.includes('class="dva-tok-comment"'), 'JS comment highlighted');
  assert.ok(!hlJs.includes('class="dva-tok-kw">class<'), 'Keywords inside comments/strings are never corrupted');
  console.log('✓ CodeEngine tokenized JavaScript safely without HTML tag or string/comment corruption');

  // 9. Test PptxEngine parsing and slide structure
  const { PptxEngine } = await import('../src/engines/pptxEngine.js');
  const pptxPath = new URL('./samples/sample.pptx', import.meta.url);
  const pptxBuffer = fs.readFileSync(pptxPath);
  const pptxZip = new ZipReader(pptxBuffer);
  await pptxZip.parse();
  assert.ok(pptxZip.hasEntry('ppt/presentation.xml'), 'PPTX presentation.xml entry exists');
  assert.ok(pptxZip.hasEntry('ppt/slides/slide1.xml'), 'PPTX slide1.xml entry exists');
  assert.ok(pptxZip.hasEntry('ppt/slides/slide2.xml'), 'PPTX slide2.xml entry exists');
  assert.ok(pptxZip.hasEntry('ppt/slides/slide3.xml'), 'PPTX slide3.xml entry exists');

  const pptxEngine = new PptxEngine(null);
  pptxEngine.zip = pptxZip;
  await pptxEngine.discoverSlides();
  assert.strictEqual(pptxEngine.slides.length, 3, 'Discovered 3 slides');

  await pptxEngine.parseSlide(0);
  assert.strictEqual(pptxEngine.slides[0].title, 'Universal DocView-All Architecture', 'Slide 1 title parsed');
  assert.ok(pptxEngine.slides[0].notes.includes('Welcome stakeholders'), 'Slide 1 presenter notes parsed');

  await pptxEngine.parseSlide(1);
  assert.strictEqual(pptxEngine.slides[1].title, 'Key Architectural Advantages', 'Slide 2 title parsed');

  await pptxEngine.parseSlide(2);
  assert.strictEqual(pptxEngine.slides[2].title, 'Framework Performance Matrix', 'Slide 3 title parsed');
  const tableEl = pptxEngine.slides[2].elements.find(e => e.type === 'table');
  assert.ok(tableEl, 'Slide 3 table extracted');
  assert.strictEqual(tableEl.rows.length, 3, 'Slide 3 table has 3 rows');
  console.log('✓ PptxEngine parsed 3 slides, slide titles, bullet points, tables, and speaker notes');

  // 10. Test Toolbar configuration & granular button toggles
  const { Toolbar } = await import('../src/core/Toolbar.js');
  const tb = Object.create(Toolbar.prototype);

  // Default config has empty presets (clean library default)
  const defaultOpts = tb.parseOptions({});
  assert.strictEqual(defaultOpts.enabled, true);
  assert.strictEqual(defaultOpts.browse, true);
  assert.strictEqual(defaultOpts.cloudUrl, true);
  assert.deepStrictEqual(defaultOpts.presets, []);
  assert.strictEqual(defaultOpts.download, true);

  // toolbar: false disables entire toolbar (pure file viewer mode)
  const disabledOpts = tb.parseOptions(false);
  assert.strictEqual(disabledOpts.enabled, false);

  // Granular customization
  const customOpts = tb.parseOptions({
    browse: false,
    cloudUrl: false,
    presets: [{ label: 'Sample', url: 'https://example.com/test.mpd' }],
    download: false
  });
  assert.strictEqual(customOpts.browse, false);
  assert.strictEqual(customOpts.cloudUrl, false);
  assert.strictEqual(customOpts.download, false);
  assert.strictEqual(customOpts.presets.length, 1);
  assert.strictEqual(customOpts.presets[0].label, 'Sample');
  console.log('✓ Granular Toolbar Configuration & Clean Presets Default verified');

  console.log('🎉 ALL TESTS PASSED SUCCESSFULLY!');
}

runZipTest().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
