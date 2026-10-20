import { DocViewer as CoreViewer } from '../core/DocViewer.js';

/**
 * Universal Angular Component Class
 * Compatible with Angular 12+ (Standalone & NgModule)
 */
export class DocViewerComponent {
  constructor(elementRef) {
    this.elementRef = elementRef;
    this.viewer = null;
    this.file = null;
    this.theme = 'dark';
    this.showToolbar = true;
    this.bookMode = false;
    this.transcript = null;
    this.showTranscriptUpload = true;
    this.onLoad = null;
    this.onAnalyticsUpdate = null;
    this.onTimeSpent = null;
  }

  ngOnInit() {
    if (this.elementRef && this.elementRef.nativeElement) {
      this.viewer = new CoreViewer(this.elementRef.nativeElement, {
        file: this.file,
        theme: this.theme,
        showToolbar: this.showToolbar,
        bookMode: this.bookMode,
        transcript: this.transcript,
        showTranscriptUpload: this.showTranscriptUpload,
        onLoad: (info) => {
          if (typeof this.onLoad === 'function') this.onLoad(info);
        },
        onAnalyticsUpdate: (data) => {
          if (typeof this.onAnalyticsUpdate === 'function') this.onAnalyticsUpdate(data);
        },
        onTimeSpent: (data) => {
          if (typeof this.onTimeSpent === 'function') this.onTimeSpent(data);
        }
      });
    }
  }

  ngOnChanges(changes) {
    if (this.viewer && changes.file && changes.file.currentValue) {
      this.viewer.loadFile(changes.file.currentValue);
    }
    if (this.viewer && changes.theme && changes.theme.currentValue) {
      if (this.viewer.theme !== changes.theme.currentValue) {
        this.viewer.toggleTheme();
      }
    }
    if (this.viewer && changes.bookMode && changes.bookMode.currentValue !== undefined) {
      if (this.viewer.isBookMode() !== !!changes.bookMode.currentValue) {
        this.viewer.setBookMode(!!changes.bookMode.currentValue);
      }
    }
  }

  ngOnDestroy() {
    if (this.viewer) {
      this.viewer.destroy();
      this.viewer = null;
    }
  }
}

export default DocViewerComponent;
