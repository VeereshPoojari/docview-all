/**
 * DocView-All - Framework Guide & Snippet Switcher
 */

const CODE_DATA = {
  react: {
    title: "⚛️ React & Next.js Integration",
    code: `import React from "react";
import { DocViewer } from "docview-all/react";
import "docview-all/css";

export default function DocumentPreview() {
  const fileUrl = "https://example.com/quarterly_finance.xlsx"; // or File / Blob / DOCX / PDF

  return (
    <div style={{ width: "100%", height: "80vh" }}>
      <DocViewer
        file={fileUrl}
        theme="dark"
        showToolbar={true}
        onLoad={(fileMeta) => console.log("Ready:", fileMeta)}
      />
    </div>
  );
}`
  },

  vue: {
    title: "🟢 Vue 3 & Nuxt 3 Integration",
    code: `<template>
  <div style="width: 100%; height: 80vh;">
    <DocViewer
      :file="fileSource"
      theme="dark"
      :show-toolbar="true"
      @load="handleLoad"
    />
  </div>
</template>

<script setup>
import { ref } from "vue";
import { DocViewer } from "docview-all/vue";
import "docview-all/css";

const fileSource = ref("https://example.com/invoice.pdf");

function handleLoad(meta) {
  console.log("Document loaded:", meta);
}
</script>`
  },

  angular: {
    title: "🅰️ Angular (14 - 18+) Integration",
    code: `import { Component, AfterViewInit, ViewChild, ElementRef } from "@angular/core";
import { DocViewer } from "docview-all";
import "docview-all/css";

@Component({
  selector: "app-doc-preview",
  template: \`<div #viewerContainer style="width: 100%; height: 80vh;"></div>\`
})
export class DocPreviewComponent implements AfterViewInit {
  @ViewChild("viewerContainer") viewerContainer!: ElementRef;
  private viewer: any;

  ngAfterViewInit() {
    this.viewer = new DocViewer(this.viewerContainer.nativeElement, {
      file: "https://example.com/report.docx",
      theme: "dark",
      showToolbar: true
    });
  }

  ngOnDestroy() {
    if (this.viewer) this.viewer.destroy();
  }
}`
  },

  "react-native": {
    title: "📱 React Native WebView Integration",
    code: `import React from "react";
import { View, StyleSheet } from "react-native";
import { WebView } from "react-native-webview";
import { getViewerHtml } from "docview-all/react-native";

export default function MobileDocScreen() {
  const fileUrl = "https://example.com/specification.pdf";
  const htmlContent = getViewerHtml(fileUrl, "dark");

  return (
    <View style={styles.container}>
      <WebView
        originWhitelist={["*"]}
        source={{ html: htmlContent }}
        style={{ flex: 1 }}
        javaScriptEnabled={true}
        domStorageEnabled={true}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0b0f19" }
});`
  },

  svelte: {
    title: "🔥 Svelte & SvelteKit Integration",
    code: `<script>
  import { onMount } from "svelte";
  import { DocViewer } from "docview-all";
  import "docview-all/css";

  let container;

  onMount(() => {
    const viewer = new DocViewer(container, {
      file: "https://example.com/dataset.xlsx",
      theme: "dark"
    });

    return () => viewer.destroy();
  });
</script>

<div bind:this={container} style="width: 100%; height: 80vh;"></div>`
  },

  vanilla: {
    title: "🌐 Vanilla JS / HTML5 Integration",
    code: `<!DOCTYPE html>
<html>
<head>
  <link rel="stylesheet" href="https://unpkg.com/docview-all/dist/docview-all.css">
</head>
<body>
  <div id="viewer" style="width: 100vw; height: 100vh;"></div>

  <script type="module">
    import { DocViewer } from "https://unpkg.com/docview-all/dist/index.esm.js";

    new DocViewer("#viewer", {
      file: "https://example.com/annual_report.docx",
      theme: "dark",
      showToolbar: true
    });
  </script>
</body>
</html>`
  },

  toastify: {
    title: "⚡ One-Line Programmatic API (Toastify Style)",
    code: `import { DocViewer } from "docview-all";
import "docview-all/css";

// 1. Instant Full-Screen Modal Preview (Just like Toastify!)
// Open any PDF, DOCX, XLSX, CSV, Video, or Image in a popup modal with one line:
DocViewer.openModal("https://example.com/quarterly_report.docx");

// With custom options (theme, onLoad callback):
const modal = DocViewer.openModal(selectedFile, {
  theme: "dark",
  onLoad: (info) => console.log("Document ready:", info.name)
});
// Programmatically close when needed:
// modal.close();

// 2. Mount onto any HTML container with one line:
DocViewer.view("#my-container", {
  file: "https://example.com/financial_sheet.xlsx",
  theme: "dark"
});`
  }
};

// Global Framework Switcher
window.selectFw = function(fwKey) {
  const data = CODE_DATA[fwKey];
  if (!data) return;

  const tabs = document.querySelectorAll('.fw-tab');
  tabs.forEach(tab => {
    if (tab.id === 'tab-' + fwKey) {
      tab.classList.add('active');
    } else {
      tab.classList.remove('active');
    }
  });

  const titleEl = document.getElementById('current-fw-title');
  const codeEl = document.getElementById('code-content');
  if (titleEl) titleEl.textContent = data.title;
  if (codeEl) codeEl.textContent = data.code;
};

// Global Copy Code Handler
window.copyCurrentCode = function() {
  const codeEl = document.getElementById('code-content');
  if (!codeEl) return;
  const text = codeEl.textContent;

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(showCopiedFeedback);
  } else {
    // Fallback for non-https or older browsers
    const textarea = document.createElement('textarea');
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand('copy');
      showCopiedFeedback();
    } catch (e) {}
    document.body.removeChild(textarea);
  }
};

function showCopiedFeedback() {
  const btnText = document.getElementById('copy-btn-text');
  if (btnText) {
    btnText.textContent = '✓ Copied!';
    setTimeout(() => {
      btnText.textContent = 'Copy Code';
    }, 1500);
  }
}

// Global Theme Toggle
let isDark = false;
window.toggleGuideTheme = function() {
  isDark = !isDark;
  document.body.classList.toggle('light-theme', !isDark);
  const themeIcon = document.getElementById('theme-icon');
  if (themeIcon) {
    if (isDark) {
      themeIcon.innerHTML = '<circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>';
    } else {
      themeIcon.innerHTML = '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>';
    }
  }
};

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  const themeBtn = document.getElementById('theme-btn');
  if (themeBtn) {
    themeBtn.onclick = window.toggleGuideTheme;
  }
  window.selectFw('react');
});

// Immediate initial call if already loaded
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  window.selectFw('react');
}
