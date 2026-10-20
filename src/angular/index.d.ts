export declare class DocViewerComponent {
  constructor(elementRef: any);
  file: any;
  theme: 'dark' | 'light';
  showToolbar: boolean;
  bookMode?: boolean;
  transcript?: any;
  showTranscriptUpload?: boolean;
  onLoad: ((info: any) => void) | null;
  onAnalyticsUpdate?: ((data: any) => void) | null;
  onTimeSpent?: ((data: any) => void) | null;
  ngOnInit(): void;
  ngOnChanges(changes: any): void;
  ngOnDestroy(): void;
}

export default DocViewerComponent;
