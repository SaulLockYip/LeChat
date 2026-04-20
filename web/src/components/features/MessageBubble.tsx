'use client';

import { useState, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface PreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

function PreviewModal({ isOpen, onClose, children }: PreviewModalProps) {
  const [isAnimating, setIsAnimating] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      // Double rAF ensures initial hidden state is painted before animation starts
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsAnimating(true);
        });
      });
    } else {
      setIsAnimating(false);
      // Wait for animation (500ms) to complete before removing from DOM
      setTimeout(() => setShouldRender(false), 500);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
  }, [isOpen]);

  if (!shouldRender) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Overlay - transparent with blur effect only */}
      <div
        className={`
          absolute inset-0 bg-transparent backdrop-blur-xl
          transition-all duration-500 ease-out
          ${isAnimating ? 'opacity-100' : 'opacity-0'}
        `}
      />
      {/* Content */}
      <div
        className={`
          relative z-10 max-w-[90vw] max-h-[90vh] flex items-center justify-center
          transition-all duration-500 ease-out
          ${isAnimating ? 'opacity-100 scale-100' : 'opacity-0 scale-90'}
        `}
      >
        {children}
      </div>
      {/* Close button */}
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 right-4 z-20 w-10 h-10 rounded-full bg-black/20 hover:bg-black/30 text-[#374151] flex items-center justify-center transition-all duration-500 ease-out hover:scale-110 active:scale-95"
        aria-label="Close preview"
        style={{ transitionDelay: isAnimating ? '0ms' : '0ms' }}
      >
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

interface ImagePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  src: string;
  alt: string;
}

function ImagePreviewModal({ isOpen, onClose, src, alt }: ImagePreviewModalProps) {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const handleZoomIn = useCallback(() => {
    setScale((s) => Math.min(s * 1.25, 5));
  }, []);

  const handleZoomOut = useCallback(() => {
    setScale((s) => Math.max(s / 1.25, 0.1));
  }, []);

  const handleReset = useCallback(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }, []);

  const handleFit = useCallback(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale > 1) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setScale((s) => Math.max(0.1, Math.min(s * delta, 5)));
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setScale(1);
      setPosition({ x: 0, y: 0 });
    }
  }, [isOpen]);

  return (
    <PreviewModal isOpen={isOpen} onClose={onClose}>
      <div className="flex flex-col items-center gap-4">
        {/* Zoom controls */}
        <div className="flex items-center gap-2 bg-white/90 backdrop-blur-sm rounded-full px-4 py-2">
          <button
            type="button"
            onClick={handleZoomOut}
            className="w-8 h-8 rounded-full bg-black/10 hover:bg-black/20 text-[#374151] flex items-center justify-center transition-colors"
            aria-label="Zoom out"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
            </svg>
          </button>
          <span className="text-[#374151] text-sm font-medium w-16 text-center">{Math.round(scale * 100)}%</span>
          <button
            type="button"
            onClick={handleZoomIn}
            className="w-8 h-8 rounded-full bg-black/10 hover:bg-black/20 text-[#374151] flex items-center justify-center transition-colors"
            aria-label="Zoom in"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
          <div className="w-px h-6 bg-black/20" />
          <button
            type="button"
            onClick={handleReset}
            className="px-3 h-8 rounded-full bg-black/10 hover:bg-black/20 text-[#374151] text-sm flex items-center justify-center transition-colors"
          >
            100%
          </button>
          <button
            type="button"
            onClick={handleFit}
            className="px-3 h-8 rounded-full bg-black/10 hover:bg-black/20 text-[#374151] text-sm flex items-center justify-center transition-colors"
          >
            Fit
          </button>
        </div>
        {/* Image container */}
        <div
          className="overflow-hidden rounded-lg cursor-grab"
          style={{ maxWidth: '80vw', maxHeight: '70vh' }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
        >
          <img
            src={src}
            alt={alt}
            className="max-w-full max-h-[70vh] object-contain transition-transform"
            style={{
              transform: `scale(${scale}) translate(${position.x / scale}px, ${position.y / scale}px)`,
              cursor: scale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default',
            }}
            draggable={false}
          />
        </div>
      </div>
    </PreviewModal>
  );
}

interface FilePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  content: string;
  fileName: string;
  fileType: AttachmentType;
  isUser: boolean;
}

function FilePreviewModal({ isOpen, onClose, content, fileName, fileType, isUser }: FilePreviewModalProps) {
  const renderContent = () => {
    if (fileType === 'md') {
      return (
        <div className="p-6 rounded-lg bg-white max-w-4xl w-full max-h-[80vh] overflow-auto">
          <div className="text-sm text-[#374151] markdown-content prose prose-sm max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
          </div>
        </div>
      );
    }

    if (fileType === 'csv') {
      const lines = content.split('\n').filter(line => line.trim());
      const headers = lines[0]?.split(',').map(h => h.trim().replace(/^"|"$/g, '')) || [];
      const rows = lines.slice(1).map(line => line.split(',').map(cell => cell.trim().replace(/^"|"$/g, '')));

      return (
        <div className="p-4 rounded-lg bg-white max-w-4xl w-full max-h-[80vh] overflow-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-[#d5dae2]">
                {headers.map((header, i) => (
                  <th key={i} className="px-3 py-2 text-left font-medium text-[#5a6270]">{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} className="border-b border-[#d5dae2]/50">
                  {row.map((cell, j) => (
                    <td key={j} className="px-3 py-2 text-[#374151]">{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    if (fileType === 'json') {
      let formattedJson = content;
      try {
        formattedJson = JSON.stringify(JSON.parse(content), null, 2);
      } catch {
        // Keep original if not valid JSON
      }
      return (
        <div className="p-4 rounded-lg bg-white max-w-4xl w-full max-h-[80vh] overflow-auto">
          <pre className="text-xs text-[#374151] font-mono whitespace-pre-wrap break-words">
            {formattedJson}
          </pre>
        </div>
      );
    }

    // Text and other types
    return (
      <div className="p-4 rounded-lg bg-white max-w-4xl w-full max-h-[80vh] overflow-auto">
        <pre className="text-xs text-[#374151] font-mono whitespace-pre-wrap break-words">
          {content}
        </pre>
      </div>
    );
  };

  return (
    <PreviewModal isOpen={isOpen} onClose={onClose}>
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2 text-[#374151]">
          <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <span className="font-medium truncate">{fileName}</span>
        </div>
        {renderContent()}
      </div>
    </PreviewModal>
  );
}

export interface MessageBubbleProps {
  message: {
    id: string;
    content: string;
    sender: 'user' | 'agent';
    senderName?: string;
    timestamp: string;
    status?: 'sending' | 'sent' | 'error';
    filePath?: string;
  };
  onRetry?: () => void;
}

type AttachmentType = 'image' | 'md' | 'csv' | 'json' | 'text' | 'other';

function formatMessageTime(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Convert literal \n strings to actual newlines for display
function processNewlines(content: string): string {
  return content.replace(/\\n/g, '\n');
}

function getAttachmentType(filePath: string): AttachmentType {
  const ext = filePath.split('.').pop()?.toLowerCase() || '';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(ext)) return 'image';
  if (ext === 'md') return 'md';
  if (ext === 'csv') return 'csv';
  if (ext === 'json') return 'json';
  if (['txt', 'log', 'xml', 'html', 'css', 'js', 'ts', 'py', 'go', 'rs', 'java', 'c', 'cpp', 'h'].includes(ext)) return 'text';
  return 'other';
}

interface AttachmentPreviewProps {
  filePath: string;
  isUser: boolean;
}

function AttachmentPreview({ filePath, isUser }: AttachmentPreviewProps) {
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [showFileModal, setShowFileModal] = useState(false);

  const isUrl = filePath.startsWith('http://') || filePath.startsWith('https://');
  const attachmentType = getAttachmentType(filePath);
  const fileName = filePath.split('/').pop() || filePath;
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

  // For local files, use /api/files endpoint with token; for URLs, use directly
  const fetchUrl = isUrl ? filePath : `/api/files?path=${encodeURIComponent(filePath)}&token=${token || ''}`;
  const needsFetch = ['md', 'csv', 'json', 'text'].includes(attachmentType);

  // Fetch content for text attachments (both local and URL)
  useEffect(() => {
    if (!needsFetch) return;
    setLoading(true);
    fetch(fetchUrl)
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch');
        return res.text();
      })
      .then(text => {
        setContent(text);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, [fetchUrl, needsFetch]);

  // For images, use /api/files for local or direct URL for remote
  if (attachmentType === 'image') {
    return (
      <>
        <div className="mt-2">
          <img
            src={fetchUrl}
            alt={fileName}
            className="max-w-full max-h-[200px] rounded-lg object-contain cursor-pointer hover:opacity-90 transition-opacity"
            loading="lazy"
            onClick={() => setShowImageModal(true)}
          />
        </div>
        <ImagePreviewModal
          isOpen={showImageModal}
          onClose={() => setShowImageModal(false)}
          src={fetchUrl}
          alt={fileName}
        />
      </>
    );
  }

  // Loading state for fetched content
  if (needsFetch && loading) {
    return (
      <div className={`mt-2 p-2 rounded-lg ${isUser ? 'bg-white/10' : 'bg-white/50'} border ${isUser ? 'border-white/20' : 'border-[#d5dae2]'}`}>
        <span className={`text-xs ${isUser ? 'text-white/70' : 'text-[#8b9298]'}`}>Loading preview...</span>
      </div>
    );
  }

  // Error or failed fetch - show download link
  if (needsFetch && (error || content === null)) {
    return (
      <div className={`mt-2 p-2 rounded-lg ${isUser ? 'bg-white/10' : 'bg-white/50'} border ${isUser ? 'border-white/20' : 'border-[#d5dae2]'}`}>
        <a
          href={filePath}
          target="_blank"
          rel="noopener noreferrer"
          className={`flex items-center gap-2 text-sm hover:underline ${isUser ? 'text-white/90' : 'text-[#5a6270]'}`}
        >
          <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
          <span className="truncate">{fileName}</span>
        </a>
      </div>
    );
  }

  // Render content based on type
  if (attachmentType === 'md' && content !== null) {
    return (
      <>
        <div
          className={`mt-2 p-2 rounded-lg ${isUser ? 'bg-white/10' : 'bg-white/50'} border ${isUser ? 'border-white/20' : 'border-[#d5dae2]'} cursor-pointer hover:opacity-90 transition-opacity`}
          onClick={() => setShowFileModal(true)}
        >
          <div className="text-sm max-h-[200px] overflow-auto markdown-content">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
          </div>
        </div>
        <FilePreviewModal
          isOpen={showFileModal}
          onClose={() => setShowFileModal(false)}
          content={content}
          fileName={fileName}
          fileType={attachmentType}
          isUser={isUser}
        />
      </>
    );
  }

  // CSV - format as table if possible
  if (attachmentType === 'csv' && content !== null) {
    const lines = content.split('\n').filter(line => line.trim());
    const headers = lines[0]?.split(',').map(h => h.trim().replace(/^"|"$/g, '')) || [];
    const rows = lines.slice(1).map(line => line.split(',').map(cell => cell.trim().replace(/^"|"$/g, '')));

    return (
      <>
        <div
          className={`mt-2 p-2 rounded-lg ${isUser ? 'bg-white/10' : 'bg-white/50'} border ${isUser ? 'border-white/20' : 'border-[#d5dae2]'} cursor-pointer hover:opacity-90 transition-opacity`}
          onClick={() => setShowFileModal(true)}
        >
          <div className="text-xs max-h-[200px] overflow-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className={isUser ? 'border-b border-white/20' : 'border-b border-[#d5dae2]'}>
                  {headers.map((header, i) => (
                    <th key={i} className={`px-2 py-1 text-left font-medium ${isUser ? 'text-white/90' : 'text-[#5a6270]'}`}>{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 10).map((row, i) => (
                  <tr key={i} className={isUser ? 'border-b border-white/10' : 'border-b border-[#d5dae2]/50'}>
                    {row.map((cell, j) => (
                      <td key={j} className={`px-2 py-1 ${isUser ? 'text-white/80' : 'text-[#374151]'}`}>{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length > 10 && (
              <p className={`mt-1 text-xs ${isUser ? 'text-white/70' : 'text-[#8b9298]'}`}>
                ...and {rows.length - 10} more rows
              </p>
            )}
          </div>
        </div>
        <FilePreviewModal
          isOpen={showFileModal}
          onClose={() => setShowFileModal(false)}
          content={content}
          fileName={fileName}
          fileType={attachmentType}
          isUser={isUser}
        />
      </>
    );
  }

  // JSON - pretty print
  if (attachmentType === 'json' && content !== null) {
    let formattedJson = content;
    try {
      formattedJson = JSON.stringify(JSON.parse(content), null, 2);
    } catch {
      // Keep original if not valid JSON
    }
    return (
      <>
        <div
          className={`mt-2 p-2 rounded-lg ${isUser ? 'bg-white/10' : 'bg-white/50'} border ${isUser ? 'border-white/20' : 'border-[#d5dae2]'} cursor-pointer hover:opacity-90 transition-opacity`}
          onClick={() => setShowFileModal(true)}
        >
          <pre className={`text-xs max-h-[200px] overflow-auto font-mono ${isUser ? 'text-white/90' : 'text-[#374151]'}`}>
            {formattedJson}
          </pre>
        </div>
        <FilePreviewModal
          isOpen={showFileModal}
          onClose={() => setShowFileModal(false)}
          content={content}
          fileName={fileName}
          fileType={attachmentType}
          isUser={isUser}
        />
      </>
    );
  }

  // Text - code block style
  if (attachmentType === 'text' && content !== null) {
    return (
      <>
        <div
          className={`mt-2 p-2 rounded-lg ${isUser ? 'bg-white/10' : 'bg-white/50'} border ${isUser ? 'border-white/20' : 'border-[#d5dae2]'} cursor-pointer hover:opacity-90 transition-opacity`}
          onClick={() => setShowFileModal(true)}
        >
          <pre className={`text-xs max-h-[200px] overflow-auto font-mono whitespace-pre-wrap break-words ${isUser ? 'text-white/90' : 'text-[#374151]'}`}>
            {content.slice(0, 2000)}
            {content.length > 2000 && `\n... (${content.length - 2000} more characters)`}
          </pre>
        </div>
        <FilePreviewModal
          isOpen={showFileModal}
          onClose={() => setShowFileModal(false)}
          content={content}
          fileName={fileName}
          fileType={attachmentType}
          isUser={isUser}
        />
      </>
    );
  }

  // Default: show download link
  return (
    <div className={`mt-2 p-2 rounded-lg ${isUser ? 'bg-white/10' : 'bg-white/50'} border ${isUser ? 'border-white/20' : 'border-[#d5dae2]'}`}>
      {isUrl ? (
        <a
          href={filePath}
          target="_blank"
          rel="noopener noreferrer"
          className={`flex items-center gap-2 text-sm hover:underline ${isUser ? 'text-white/90' : 'text-[#5a6270]'}`}
        >
          <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
          <span className="truncate">{fileName}</span>
        </a>
      ) : (
        <a
          href={fetchUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={`flex items-center gap-2 text-sm hover:underline ${isUser ? 'text-white/90' : 'text-[#5a6270]'}`}
        >
          <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <span className="truncate">{fileName}</span>
        </a>
      )}
    </div>
  );
}

export function MessageBubble({ message, onRetry }: MessageBubbleProps) {
  const isUser = message.sender === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`flex max-w-[70%] ${isUser ? 'flex-row-reverse' : 'flex-row'} gap-2`}>
        {/* Sender name only (no avatar) */}
        {!isUser && message.senderName && (
          <span className="text-xs text-[#8b9298] self-start pt-2">{message.senderName}</span>
        )}

        {/* Bubble */}
        <div className="flex flex-col gap-1">

          {/* Message bubble */}
          <div className={`
            relative px-4 py-2.5 rounded-2xl
            ${isUser
              ? 'bg-[#ff4757] text-white rounded-tr-md'
              : 'bg-[#f0f2f5] text-[#374151] rounded-tl-md shadow-[-4px_-4px_8px_rgba(255,255,255,0.8),4px_4px_8px_rgba(0,0,0,0.08)]'
            }
            ${message.status === 'sending' ? 'opacity-70' : ''}
          `}>
            {/* Error indicator with retry */}
            {message.status === 'error' && (
              <button
                type="button"
                onClick={onRetry}
                className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-[#ff4757] text-white flex items-center justify-center shadow-[0_2px_4px_rgba(255,71,87,0.3)] hover:bg-[#ff6b7a] transition-colors"
                title="Retry"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            )}

            {/* Message content */}
            {isUser ? (
              <p className="text-sm whitespace-pre-wrap break-words">
                {processNewlines(message.content)}
              </p>
            ) : (
              <div className="text-sm break-words markdown-content">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {processNewlines(message.content)}
                </ReactMarkdown>
              </div>
            )}

            {/* Attachment Preview */}
            {message.filePath && (
              <AttachmentPreview filePath={message.filePath} isUser={isUser} />
            )}

            {/* Timestamp and status */}
            <div className={`flex items-center justify-end gap-1 mt-1 ${isUser ? 'text-white/70' : 'text-[#8b9298]'}`}>
              {message.status === 'sending' && (
                <span className="text-xs">Sending...</span>
              )}
              {message.status === 'sent' && (
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              )}
              <span className="text-xs">{formatMessageTime(message.timestamp)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
