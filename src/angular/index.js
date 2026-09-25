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
    this.onLoad = null;
  }

  ngOnInit() {
    if (this.elementRef && this.elementRef.nativeElement) {
      this.viewer = new CoreViewer(this.elementRef.nativeElement, {
        file: this.file,
        theme: this.theme,
        showToolbar: this.showToolbar,
        onLoad: (info) => {
          if (typeof this.onLoad === 'function') this.onLoad(info);
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
  }

  ngOnDestroy() {
    if (this.viewer) {
      this.viewer.destroy();
      this.viewer = null;
    }
  }
}

export default DocViewerComponent;
