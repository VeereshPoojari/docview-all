export declare class DocViewerComponent {
  constructor(elementRef: any);
  file: any;
  theme: 'dark' | 'light';
  showToolbar: boolean;
  onLoad: ((info: any) => void) | null;
  ngOnInit(): void;
  ngOnChanges(changes: any): void;
  ngOnDestroy(): void;
}

export default DocViewerComponent;
