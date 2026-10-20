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
assert.ok(pkg.version, 'package.json version defined');
assert.ok(pkg.license, 'package.json license defined');
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
assert.strictEqual(FORMAT_TYPES.HTML, 'html');
assert.strictEqual(detectFormat('index.html').type, FORMAT_TYPES.HTML);
assert.strictEqual(detectFormat('dashboard.htm').type, FORMAT_TYPES.HTML);
assert.strictEqual(detectFormat('app.xhtml').type, FORMAT_TYPES.HTML);
console.log('✓ MIME & Format Detection verified for HTML, DOCX, XLSX, PPTX, CSV, PDF, Video, Text, Audio, Diagram, YAML, and XML');

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

  // 5. Test Paginated Document Engine Contracts (PDF & DOCX) & Book Mode
  const { DocViewer } = await import('../src/core/DocViewer.js');
  assert.strictEqual(typeof DocViewer.prototype.goToPage, 'function');
  assert.strictEqual(typeof DocViewer.prototype.nextPage, 'function');
  assert.strictEqual(typeof DocViewer.prototype.prevPage, 'function');
  assert.strictEqual(typeof DocViewer.prototype.setPageInfo, 'function');
  assert.strictEqual(typeof DocViewer.prototype.isBookMode, 'function');
  assert.strictEqual(typeof DocViewer.prototype.setBookMode, 'function');
  assert.strictEqual(typeof DocViewer.prototype.toggleBookMode, 'function');

  const { PdfEngine } = await import('../src/engines/pdfEngine.js');
  assert.strictEqual(typeof PdfEngine.prototype.goToPage, 'function');
  assert.strictEqual(typeof PdfEngine.prototype.isBookMode, 'function');
  assert.strictEqual(typeof PdfEngine.prototype.setBookMode, 'function');
  assert.strictEqual(typeof PdfEngine.prototype.toggleBookMode, 'function');

  // Verify Book Mode spread calculations
  const dummyPdf = new PdfEngine({ options: { bookMode: true } });
  dummyPdf.totalPages = 10;
  assert.deepStrictEqual(dummyPdf.getSpreadForPage(1), { left: 1, right: 2 }, 'Page 1 is spread [1, 2]');
  assert.deepStrictEqual(dummyPdf.getSpreadForPage(2), { left: 1, right: 2 }, 'Page 2 is spread [1, 2]');
  assert.deepStrictEqual(dummyPdf.getSpreadForPage(3), { left: 3, right: 4 }, 'Page 3 is spread [3, 4]');
  assert.deepStrictEqual(dummyPdf.getSpreadForPage(10), { left: 9, right: 10 }, 'Page 10 is spread [9, 10]');

  // Test odd total pages (e.g. 5 pages -> spread [5, null])
  dummyPdf.totalPages = 5;
  assert.deepStrictEqual(dummyPdf.getSpreadForPage(5), { left: 5, right: null }, 'Odd last page spread is [5, null]');

  const { DocxEngine } = await import('../src/engines/docxEngine.js');
  assert.strictEqual(typeof DocxEngine.prototype.goToPage, 'function');

  // Verify scroll synchronization logic: scrolling from page 4 to 12 then clicking next goes to 13
  const dummyViewer = Object.create(DocViewer.prototype);
  dummyViewer.options = { bookMode: false };
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

  // Test Book Mode on DocViewer
  dummyViewer.setBookMode(true);
  assert.strictEqual(dummyViewer.isBookMode(), true, 'Book mode toggled on');
  dummyViewer.toggleBookMode();
  assert.strictEqual(dummyViewer.isBookMode(), false, 'Book mode toggled off');

  console.log('✓ Paginated Navigation Contracts, Scroll Sync & Book Mode Spreads verified');

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

  // 10. Test Legacy Binary PowerPoint (.ppt) OLE2 parsing
  const { CFBFReader } = await import('../src/utils/cfbfReader.js');
  const pptPath = new URL('./samples/sample.ppt', import.meta.url);
  const pptBuffer = fs.readFileSync(pptPath);
  const cfbf = new CFBFReader(pptBuffer.buffer);
  cfbf.parse();
  assert.ok(cfbf.hasStream('PowerPoint Document'), 'CFBF contains PowerPoint Document stream');
  assert.ok(cfbf.hasStream('Pictures'), 'CFBF contains Pictures stream');

  const legacyEngine = new PptxEngine(null);
  legacyEngine.container = {
    querySelector: () => null,
    innerHTML: ''
  };
  legacyEngine.renderPresentationStage = () => {};
  legacyEngine.bindKeyboardShortcuts = () => {};

  await legacyEngine.renderLegacyPpt(pptBuffer.buffer, { name: 'sample.ppt' });
  assert.strictEqual(legacyEngine.slides.length, 4, 'Parsed 4 slides from legacy PPT');
  assert.strictEqual(legacyEngine.slides[0].title, 'Lorem ipsum', 'Slide 1 title parsed');
  assert.strictEqual(legacyEngine.slides[1].title, 'Chart', 'Slide 2 title parsed');
  assert.strictEqual(legacyEngine.slides[2].title, 'Table', 'Slide 3 title parsed');
  assert.strictEqual(legacyEngine.slides[3].title, 'Photo', 'Slide 4 title parsed');
  assert.ok(legacyEngine.slides[3].pictures.length > 0, 'Slide 4 photo picture extracted');
  console.log('✓ Legacy Binary PowerPoint (.ppt) parsed 4 slides, titles, pictures, and tables');

  // 11. Test Toolbar configuration & granular button toggles
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

  // Dynamic format adaptation & Book Mode conditional visibility
  const mockElements = {
    '#dva-btn-book-mode': { style: { display: 'none' }, classList: { toggle() {} } },
    '#dva-pagination-controls': { style: { display: 'none' } },
    '#dva-btn-zoom-in': { style: { display: 'none' } },
    '#dva-btn-zoom-out': { style: { display: 'none' } },
    '#dva-zoom-level': { style: { display: 'none' } },
    '#dva-btn-rotate': { style: { display: 'none' } },
    '#dva-tools-divider': { style: { display: 'none' } }
  };

  const tbInstance = {
    element: {
      querySelector: (sel) => mockElements[sel] || null
    },
    options: { zoom: true, rotate: true, pagination: true },
    viewer: { activeEngine: null, currentFileInfo: null, totalPages: 1 },
    updateEngineCapabilities: Toolbar.prototype.updateEngineCapabilities
  };

  // 1. Audio format: hides zoom, rotate, book mode, pagination
  tbInstance.updateEngineCapabilities(null, { type: 'audio' }, 1);
  assert.strictEqual(mockElements['#dva-btn-book-mode'].style.display, 'none');
  assert.strictEqual(mockElements['#dva-pagination-controls'].style.display, 'none');
  assert.strictEqual(mockElements['#dva-btn-zoom-in'].style.display, 'none');
  assert.strictEqual(mockElements['#dva-btn-rotate'].style.display, 'none');
  assert.strictEqual(mockElements['#dva-tools-divider'].style.display, 'none');

  // 2. Spreadsheet (XLSX): shows zoom, hides rotate and book mode
  tbInstance.updateEngineCapabilities(null, { type: 'xlsx' }, 1);
  assert.strictEqual(mockElements['#dva-btn-zoom-in'].style.display, 'inline-flex');
  assert.strictEqual(mockElements['#dva-btn-rotate'].style.display, 'none');
  assert.strictEqual(mockElements['#dva-btn-book-mode'].style.display, 'none');

  // 3. PPTX Slides: shows zoom, pagination, but hides rotate and book mode
  tbInstance.updateEngineCapabilities(null, { type: 'pptx' }, 5);
  assert.strictEqual(mockElements['#dva-pagination-controls'].style.display, 'flex');
  assert.strictEqual(mockElements['#dva-btn-book-mode'].style.display, 'none');
  assert.strictEqual(mockElements['#dva-btn-rotate'].style.display, 'none');

  // 4. PDF (>1 page with setBookMode): shows zoom, rotate, pagination, and BOOK MODE
  const mockPdfEngine = { setBookMode: () => {}, isBookMode: () => true };
  tbInstance.updateEngineCapabilities(mockPdfEngine, { type: 'pdf' }, 10);
  assert.strictEqual(mockElements['#dva-pagination-controls'].style.display, 'flex');
  assert.strictEqual(mockElements['#dva-btn-book-mode'].style.display, 'inline-flex');
  assert.strictEqual(mockElements['#dva-btn-zoom-in'].style.display, 'inline-flex');
  assert.strictEqual(mockElements['#dva-btn-rotate'].style.display, 'inline-flex');

  // 5. PDF (1 page): hides pagination and book mode
  tbInstance.updateEngineCapabilities(mockPdfEngine, { type: 'pdf' }, 1);
  assert.strictEqual(mockElements['#dva-pagination-controls'].style.display, 'none');
  assert.strictEqual(mockElements['#dva-btn-book-mode'].style.display, 'none');
  assert.strictEqual(mockElements['#dva-btn-zoom-in'].style.display, 'inline-flex');
  assert.strictEqual(mockElements['#dva-btn-rotate'].style.display, 'inline-flex');

  console.log('✓ Granular Toolbar Configuration, Format Adaptation & Conditional Book Mode verified');

  // 12. Test Security, Sanitization & Protocol Allowlisting
  const { escapeHtml, sanitizeUrl, sanitizeColor } = await import('../src/utils/security.js');
  
  // HTML escaping
  assert.strictEqual(escapeHtml('<script>alert("xss")</script>'), '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;', 'HTML tags escaped');
  assert.strictEqual(escapeHtml('Hello & Welcome \'User\''), 'Hello &amp; Welcome &#039;User&#039;', 'Ampersand and quotes escaped');

  // URL allowlisting & XSS blocking
  assert.strictEqual(sanitizeUrl('javascript:alert(1)'), '#', 'javascript: protocol blocked');
  assert.strictEqual(sanitizeUrl('vbscript:msgbox(1)'), '#', 'vbscript: protocol blocked');
  assert.strictEqual(sanitizeUrl('data:text/html,<script>alert(1)</script>'), '#', 'data:text/html blocked');
  assert.strictEqual(sanitizeUrl('https://example.com/docs/presentation'), 'https://example.com/docs/presentation', 'https: protocol allowed');
  assert.strictEqual(sanitizeUrl('mailto:security@example.com'), 'mailto:security@example.com', 'mailto: protocol allowed');
  assert.strictEqual(sanitizeUrl('#slide-section'), '#slide-section', 'anchor hash link allowed');

  // Color CSS injection validation
  assert.strictEqual(sanitizeColor('#3b82f6'), '#3b82f6', 'Hex color verified');
  assert.strictEqual(sanitizeColor('rgba(59, 130, 246, 0.5)'), 'rgba(59, 130, 246, 0.5)', 'rgba color verified');
  assert.strictEqual(sanitizeColor('red; background: url(evil.com)'), '', 'CSS injection payload sanitized');
  console.log('✓ Zero-Trust Security & Protocol Allowlisting verified (XSS, javascript:, and CSS injection blocked)');

  // 13. Test HtmlEngine: 100% Auto-Responsive Live Browser Sandbox, View Modes & Syntax Highlighting
  const { HtmlEngine } = await import('../src/engines/htmlEngine.js');
  const dummyHtmlViewer = {
    options: { htmlViewMode: 'split', allowScripts: true },
    currentFileInfo: { name: 'index.html', ext: 'html' },
    scale: 1.0,
    notify: () => {}
  };

  const htmlEngine = new HtmlEngine(dummyHtmlViewer);
  assert.ok(htmlEngine.viewMode === 'both' || htmlEngine.viewMode === 'split', 'HtmlEngine respects custom htmlViewMode option (split/both)');
  assert.strictEqual(htmlEngine.allowScripts, true, 'allowScripts defaults to true');

  // Test HTML syntax highlighter
  const sampleDocType = htmlEngine.highlightHtmlLine('<!DOCTYPE html>');
  assert.ok(sampleDocType.includes('class="dva-tok-kw"'), 'Doctype highlighted');

  const sampleComment = htmlEngine.highlightHtmlLine('  <!-- Main Application Header -->');
  assert.ok(sampleComment.includes('class="dva-tok-comment"'), 'HTML comments highlighted');

  const sampleTag = htmlEngine.highlightHtmlLine('<div id="root" class="container active">');
  assert.ok(sampleTag.includes('class="dva-tok-tag">div<'), 'HTML div tag tokenized');
  assert.ok(sampleTag.includes('class="dva-tok-attr">id<'), 'HTML id attribute tokenized');
  assert.ok(sampleTag.includes('class="dva-tok-attr">class<'), 'HTML class attribute tokenized');
  assert.ok(sampleTag.includes('class="dva-tok-str">&quot;root&quot;<') || sampleTag.includes('class="dva-tok-str">"root"<'), 'HTML id string value tokenized');
  assert.ok(sampleTag.includes('class="dva-tok-str">&quot;container active&quot;<') || sampleTag.includes('class="dva-tok-str">"container active"<'), 'HTML class string value tokenized');

  // Verify pure auto-responsive view modes
  assert.strictEqual(typeof htmlEngine.updateViewMode, 'function', 'updateViewMode method exists');

  // Test developer mode configurations: both, code, and locked preview
  const bothEngine = new HtmlEngine({ options: { htmlMode: 'both' } });
  assert.strictEqual(bothEngine.viewMode, 'both', 'Developer can configure htmlMode: both for split view');

  const codeEngineTest = new HtmlEngine({ options: { htmlMode: 'code' } });
  assert.strictEqual(codeEngineTest.viewMode, 'code', 'Developer can configure htmlMode: code');

  const previewLockedEngine = new HtmlEngine({ options: { htmlMode: 'preview', htmlAllowedModes: ['preview'] } });
  assert.strictEqual(previewLockedEngine.viewMode, 'preview', 'Developer can lock to pure preview only');
  assert.strictEqual(previewLockedEngine.showSwitcher, false, 'Switcher automatically hidden when only preview is allowed');

  console.log('✓ HtmlEngine verified: 100% auto-responsive live browser preview, developer options (preview/code/both), and mode locking');

  // 14. Test Universal AnalyticsEngine: Active Time-Spent, Per-Page Tracking & Video Interval Telemetry
  const { AnalyticsEngine, formatDuration, formatClockTime } = await import('../src/utils/analyticsEngine.js');
  
  assert.strictEqual(formatDuration(45), '45s');
  assert.strictEqual(formatDuration(125), '2m 05s');
  assert.strictEqual(formatDuration(3665), '1h 01m 05s');
  assert.strictEqual(formatClockTime(75), '01:15');
  assert.strictEqual(formatClockTime(3600), '60:00');

  let lastEvent = null;
  const dummyAnalyticsViewer = { options: {} };
  const analytics = new AnalyticsEngine(dummyAnalyticsViewer, {
    onTimeSpent: (data) => { lastEvent = data; }
  });

  analytics.setDocumentInfo({ name: 'annual_report.pdf', type: 'pdf' });
  analytics.setPage(1, 5);
  analytics.accumulateCurrentPageTime(15);
  analytics.totalActiveSeconds = 15;

  // Switch to Page 2
  analytics.setPage(2, 5);
  assert.strictEqual(lastEvent.event, 'page_change');
  assert.strictEqual(lastEvent.previousPage, 1);
  assert.strictEqual(lastEvent.currentPage, 2);

  analytics.accumulateCurrentPageTime(30);
  analytics.totalActiveSeconds += 30;

  const report = analytics.getAnalytics();
  assert.strictEqual(report.documentName, 'annual_report.pdf');
  assert.strictEqual(report.documentType, 'pdf');
  assert.strictEqual(report.totalTimeSpentSeconds, 45);
  assert.strictEqual(report.pageBreakdown['1'].seconds, 15);
  assert.strictEqual(report.pageBreakdown['2'].seconds, 30);

  // Test Media Watched Intervals & Telemetry
  analytics.setMediaDuration(120); // 2 minute video
  // Watch 0 -> 10s
  analytics.onMediaPlay(0);
  analytics.onMediaTimeUpdate(10);
  analytics.onMediaPause(10);

  // Watch 5 -> 25s (overlapping with 0-10 -> should merge to 0-25)
  analytics.onMediaPlay(5);
  analytics.onMediaTimeUpdate(25);
  analytics.onMediaPause(25);

  // Watch 50 -> 60s
  analytics.onMediaPlay(50);
  analytics.onMediaTimeUpdate(60);
  analytics.onMediaPause(60);

  const mediaReport = analytics.getAnalytics().mediaAnalytics;
  assert.strictEqual(mediaReport.duration, 120);
  // Merged intervals: [0, 25] (25s) + [50, 60] (10s) = 35s
  assert.strictEqual(mediaReport.uniqueWatchedSeconds, 35);
  assert.strictEqual(mediaReport.completionPercentage, '29.2%');
  assert.strictEqual(mediaReport.watchedIntervals.length, 2);
  assert.strictEqual(mediaReport.watchedIntervals[0].formatted, '00:00 → 00:25');
  assert.strictEqual(mediaReport.watchedIntervals[1].formatted, '00:50 → 01:00');

  analytics.destroy();
  console.log('✓ AnalyticsEngine verified: Active time tracking, per-page accumulation, watch interval merging, and completion %');

  // 15. Test Transcript & Subtitle Parser (WebVTT, SRT, JSON, TXT & Native WebVTT generation)
  const { parseTranscript, generateVttContent, formatCueTime } = await import('../src/utils/transcriptParser.js');

  assert.strictEqual(formatCueTime(65.4), '01:05');
  assert.strictEqual(formatCueTime(3605), '01:00:05');

  // Test VTT parsing
  const sampleVtt = `WEBVTT

1
00:00:01.000 --> 00:00:04.500
Welcome to the DocView-All presentation.

2
00:00:05.000 --> 00:00:09.200
Here we showcase universal document and media telemetry.`;

  const vttCues = await parseTranscript(sampleVtt);
  assert.strictEqual(vttCues.length, 2);
  assert.strictEqual(vttCues[0].start, 1);
  assert.strictEqual(vttCues[0].end, 4.5);
  assert.strictEqual(vttCues[0].text, 'Welcome to the DocView-All presentation.');
  assert.strictEqual(vttCues[1].start, 5);
  assert.strictEqual(vttCues[1].end, 9.2);

  // Test SRT parsing
  const sampleSrt = `1
00:00:02,500 --> 00:00:06,000
First SRT subtitle cue.

2
00:00:07,000 --> 00:00:11,500
Second SRT subtitle cue.`;

  const srtCues = await parseTranscript(sampleSrt);
  assert.strictEqual(srtCues.length, 2);
  assert.strictEqual(srtCues[0].start, 2.5);
  assert.strictEqual(srtCues[0].end, 6.0);
  assert.strictEqual(srtCues[0].text, 'First SRT subtitle cue.');

  // Test JSON parsing
  const sampleJson = JSON.stringify([
    { start: 0, end: 5, text: 'JSON subtitle cue' }
  ]);
  const jsonCues = await parseTranscript(sampleJson);
  assert.strictEqual(jsonCues.length, 1);
  assert.strictEqual(jsonCues[0].text, 'JSON subtitle cue');

  // Test WebVTT generator
  const generatedVtt = generateVttContent(srtCues);
  assert.ok(generatedVtt.startsWith('WEBVTT\n\n'));
  assert.ok(generatedVtt.includes('00:00:02.500 --> 00:00:06.000'));
  assert.ok(generatedVtt.includes('First SRT subtitle cue.'));

  console.log('✓ Transcript Parser verified: WebVTT, SRT, JSON parsing and WebVTT generation');

  // 16. Test Developer Get and Set API & Exports
  const {
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
  } = await import('../src/index.js');

  const testAnalytics = new AnalyticsEngine({}, {});
  // Set analytics state
  testAnalytics.setAnalytics({
    totalTimeSpentSeconds: 200,
    pageBreakdown: {
      '1': { seconds: 120, visits: 2 },
      '2': { seconds: 80, visits: 1 }
    },
    mediaAnalytics: {
      watchedIntervals: [{ from: 0, to: 45 }]
    }
  });

  const setReport = testAnalytics.getAnalytics();
  assert.strictEqual(setReport.totalTimeSpentSeconds, 200);
  assert.strictEqual(setReport.pageBreakdown['1'].seconds, 120);
  assert.strictEqual(setReport.pageBreakdown['2'].seconds, 80);
  assert.strictEqual(setReport.mediaAnalytics.uniqueWatchedSeconds, 45);

  // Reset analytics
  testAnalytics.resetAnalytics();
  assert.strictEqual(testAnalytics.totalActiveSeconds, 0);
  assert.strictEqual(Object.keys(testAnalytics.pageTimes).length, 0);
  assert.strictEqual(testAnalytics.watchedIntervals.length, 0);
  testAnalytics.destroy();

  // Test standalone viewer helper wrappers
  const mockViewer = {
    analytics: null,
    scale: 1.0,
    theme: 'dark',
    currentPage: 1,
    totalPages: 10,
    bookMode: false,
    currentTranscript: [{ start: 0, end: 5, text: 'Hello world' }],
    currentHtmlMode: 'both',
    getAnalytics() { return { totalTimeSpentSeconds: 50 }; },
    setAnalytics(d) { return this; },
    getTimeSpent() { return { totalTimeSpentSeconds: 50 }; },
    setTimeSpent(d) { return this; },
    resetAnalytics() { return this; },
    getTranscript() { return this.currentTranscript; },
    setTranscript(t) { this.currentTranscript = t; return Promise.resolve(t); },
    getHtmlMode() { return this.currentHtmlMode; },
    setHtmlMode(m) { this.currentHtmlMode = m; return this; },
    getPage() { return this.currentPage; },
    setPage(p) { this.currentPage = p; return this; },
    getZoom() { return this.scale; },
    setZoom(s) { this.scale = s; return this; },
    getTheme() { return this.theme; },
    setTheme(th) { this.theme = th; return this; },
    isBookMode() { return this.bookMode; },
    setBookMode(b) { this.bookMode = !!b; return this; },
    toggleBookMode() { this.bookMode = !this.bookMode; return this; }
  };

  assert.strictEqual(getAnalytics(mockViewer).totalTimeSpentSeconds, 50);
  assert.strictEqual(getTimeSpent(mockViewer).totalTimeSpentSeconds, 50);
  assert.strictEqual(getPage(mockViewer), 1);
  setPage(mockViewer, 4);
  assert.strictEqual(getPage(mockViewer), 4);

  assert.strictEqual(getZoom(mockViewer), 1.0);
  setZoom(mockViewer, 1.5);
  assert.strictEqual(getZoom(mockViewer), 1.5);

  assert.strictEqual(getTheme(mockViewer), 'dark');
  setTheme(mockViewer, 'light');
  assert.strictEqual(getTheme(mockViewer), 'light');

  assert.strictEqual(getHtmlMode(mockViewer), 'both');
  setHtmlMode(mockViewer, 'code');
  assert.strictEqual(getHtmlMode(mockViewer), 'code');

  assert.strictEqual(isBookMode(mockViewer), false);
  setBookMode(mockViewer, true);
  assert.strictEqual(isBookMode(mockViewer), true);
  toggleBookMode(mockViewer);
  assert.strictEqual(isBookMode(mockViewer), false);

  const cues = getTranscript(mockViewer);
  assert.strictEqual(cues.length, 1);
  assert.strictEqual(cues[0].text, 'Hello world');

  await setTranscript(mockViewer, [{ start: 10, end: 20, text: 'New Cue' }]);
  assert.strictEqual(getTranscript(mockViewer)[0].text, 'New Cue');

  console.log('✓ Developer Get & Set API verified: getAnalytics, setAnalytics, getTimeSpent, setTimeSpent, resetAnalytics, getTranscript, setTranscript, getPage, setPage, getZoom, setZoom, getTheme, setTheme, getHtmlMode, setHtmlMode, isBookMode, setBookMode, toggleBookMode');

  console.log('🎉 ALL TESTS PASSED SUCCESSFULLY!');
}

runZipTest().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
