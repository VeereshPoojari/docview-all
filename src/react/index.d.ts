import React from 'react';
import { DocViewerOptions, DocViewerInstance } from '../types/index';

export interface DocViewerProps extends Partial<DocViewerOptions> {
  className?: string;
  style?: React.CSSProperties;
}

export declare const DocViewer: React.FC<DocViewerProps>;
export declare function useDocViewer(targetRef: React.RefObject<HTMLElement>, options?: Partial<DocViewerOptions>): DocViewerInstance | null;

export default DocViewer;
