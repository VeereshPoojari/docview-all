import React, { useEffect, useRef } from 'react';
import { DocViewer as CoreViewer } from '../core/DocViewer.js';

/**
 * DocViewer React Component
 * Supports Next.js (App Router / Pages), React 17+, and React 18+
 */
export function DocViewer({
  file,
  theme = 'dark',
  showToolbar = true,
  bookMode = false,
  className = '',
  style = {},
  onLoad,
  onAnalyticsUpdate,
  onTimeSpent,
  transcript,
  showTranscriptUpload,
  ...props
}) {
  const containerRef = useRef(null);
  const viewerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;

    if (!viewerRef.current) {
      viewerRef.current = new CoreViewer(containerRef.current, {
        file,
        theme,
        showToolbar,
        bookMode,
        onLoad,
        onAnalyticsUpdate,
        onTimeSpent,
        transcript,
        showTranscriptUpload,
        ...props
      });
    } else {
      if (file) {
        viewerRef.current.loadFile(file);
      }
    }

    return () => {
      if (viewerRef.current) {
        viewerRef.current.destroy();
        viewerRef.current = null;
      }
    };
  }, [file]);

  useEffect(() => {
    if (viewerRef.current && theme) {
      if (viewerRef.current.theme !== theme) {
        viewerRef.current.toggleTheme();
      }
    }
  }, [theme]);

  useEffect(() => {
    if (viewerRef.current && bookMode !== undefined) {
      if (viewerRef.current.isBookMode() !== !!bookMode) {
        viewerRef.current.setBookMode(!!bookMode);
      }
    }
  }, [bookMode]);

  return React.createElement('div', {
    ref: containerRef,
    className: `dva-react-wrapper ${className}`.trim(),
    style: { width: '100%', height: '100%', minHeight: '400px', ...style },
    ...props
  });
}

export function useDocViewer(targetRef, options = {}) {
  const viewerRef = useRef(null);

  useEffect(() => {
    if (targetRef.current && !viewerRef.current) {
      viewerRef.current = new CoreViewer(targetRef.current, options);
    }
    return () => {
      if (viewerRef.current) {
        viewerRef.current.destroy();
        viewerRef.current = null;
      }
    };
  }, []);

  return viewerRef.current;
}

export default DocViewer;
