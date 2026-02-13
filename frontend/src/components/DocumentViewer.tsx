import { useState, useEffect } from 'react';
import { Download, X, Maximize2, Loader2 } from 'lucide-react';

export interface DocumentViewerProps {
  fileUrl: string | null;
  fileName: string;
  isOpen: boolean;
  onClose: () => void;
  /** Optional: custom download handler. Default: window.open(fileUrl) */
  onDownload?: () => void;
  /** Optional: true when fileUrl is being fetched (shows loading spinner) */
  loadingUrl?: boolean;
}

const PDF_EXTENSIONS = new Set(['pdf']);
const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp']);

function getFileType(fileName: string): 'pdf' | 'image' | 'other' {
  const ext = (fileName.split('.').pop() || '').toLowerCase();
  if (PDF_EXTENSIONS.has(ext)) return 'pdf';
  if (IMAGE_EXTENSIONS.has(ext)) return 'image';
  return 'other';
}

/**
 * Reusable document viewer modal.
 * PDF → iframe, images → img, other → "Preview not available" + download.
 * Includes loading spinner, fullscreen toggle, and download/close actions.
 */
export default function DocumentViewer({
  fileUrl,
  fileName,
  isOpen,
  onClose,
  onDownload,
  loadingUrl = false,
}: DocumentViewerProps) {
  const [loading, setLoading] = useState(true);
  const [fullscreen, setFullscreen] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(max-width: 640px)').matches
  );

  const fileType = getFileType(fileName);
  const canPreview = fileType === 'pdf' || fileType === 'image';

  useEffect(() => {
    if (!isOpen || !fileUrl) {
      setLoading(false);
      return;
    }
    setLoading(true);
    if (fileType === 'other') {
      setLoading(false);
    }
  }, [isOpen, fileUrl, fileType]);

  // On mobile, open fullscreen by default
  useEffect(() => {
    if (isOpen && typeof window !== 'undefined' && window.matchMedia('(max-width: 640px)').matches) {
      setFullscreen(true);
    }
  }, [isOpen]);

  function handleLoad() {
    setLoading(false);
  }

  function handleDownload() {
    if (onDownload) {
      onDownload();
    } else if (fileUrl) {
      window.open(fileUrl, '_blank', 'noopener,noreferrer');
    }
  }

  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (fullscreen) setFullscreen(false);
        else onClose();
      }
    }
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose, fullscreen]);

  useEffect(() => {
    if (fullscreen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [fullscreen]);

  if (!isOpen) return null;

  const content = (
    <div className="flex flex-col bg-white" style={{ minHeight: fullscreen ? '100vh' : 400 }}>
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
        <h3 className="truncate text-base font-semibold text-text" title={fileName}>
          {fileName}
        </h3>
        <div className="flex shrink-0 items-center gap-2">
          {canPreview && (
            <button
              type="button"
              onClick={() => setFullscreen(!fullscreen)}
              className="rounded p-1.5 text-muted hover:bg-background hover:text-text"
              aria-label={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            >
              <Maximize2 className="h-4 w-4" />
            </button>
          )}
          <button
            type="button"
            onClick={handleDownload}
            disabled={!fileUrl}
            className="inline-flex items-center gap-2 rounded-lg border border-primary bg-white px-3 py-1.5 text-sm font-medium text-primary transition-colors hover:bg-primary/5 disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            Download
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1.5 text-muted hover:bg-background hover:text-text"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Body */}
      <div
        className="relative flex flex-1 items-center justify-center overflow-auto bg-gray-100"
        style={{ minHeight: fullscreen ? 'calc(100vh - 56px)' : 400 }}
      >
        {loading && canPreview && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/80">
            <Loader2 className="h-8 w-8 animate-spin text-primary" aria-label="Loading" />
          </div>
        )}

        {loadingUrl ? (
          <div className="flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" aria-label="Loading document" />
          </div>
        ) : !fileUrl ? (
          <p className="text-muted">No document URL available.</p>
        ) : fileType === 'pdf' ? (
          <iframe
            src={fileUrl}
            title={fileName}
            className="h-full w-full border-0"
            style={{ minHeight: 400 }}
            onLoad={handleLoad}
          />
        ) : fileType === 'image' ? (
          <img
            src={fileUrl}
            alt={fileName}
            className="max-h-full max-w-full object-contain"
            onLoad={handleLoad}
            onError={() => setLoading(false)}
          />
        ) : (
          <div className="rounded-lg border border-border bg-white p-8 text-center">
            <p className="mb-4 text-muted">Preview not available for this file type.</p>
            <button
              type="button"
              onClick={handleDownload}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90"
            >
              <Download className="h-4 w-4" />
              Download file
            </button>
          </div>
        )}
      </div>
    </div>
  );

  if (fullscreen) {
    return (
      <div className="fixed inset-0 z-[100] bg-white">
        {content}
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-lg border border-border shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        {content}
      </div>
    </div>
  );
}
