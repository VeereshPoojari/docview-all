/**
 * React Native WebView Wrapper for DocView-All
 * Renders document preview inside high-performance native WebView
 */
export function getViewerHtml(fileUrl, theme = 'dark') {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          html, body, #viewer { width: 100%; height: 100%; overflow: hidden; background: ${theme === 'dark' ? '#090d16' : '#ffffff'}; }
        </style>
        <script src="https://unpkg.com/docview-all@latest/dist/docview-all.umd.js"></script>
        <link rel="stylesheet" href="https://unpkg.com/docview-all@latest/dist/docview-all.css">
      </head>
      <body>
        <div id="viewer"></div>
        <script>
          const viewer = new DocViewerAll.DocViewer('#viewer', {
            file: '${fileUrl || ''}',
            theme: '${theme}'
          });
        </script>
      </body>
    </html>
  `;
}

export default { getViewerHtml };
