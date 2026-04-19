'use client';

import { useState, useCallback } from 'react';
import { Button } from './Button';
import { Input } from './Input';

interface TokenInputModalProps {
  onTokenSubmit: (token: string) => void;
}

export function TokenInputModal({ onTokenSubmit }: TokenInputModalProps) {
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    const trimmedToken = token.trim();

    if (!trimmedToken) {
      setError('Token is required');
      return;
    }

    if (trimmedToken.length < 10) {
      setError('Token seems too short');
      return;
    }

    setIsLoading(true);
    setError('');

    // Simulate a brief delay for UX feedback
    setTimeout(() => {
      onTokenSubmit(trimmedToken);
      setIsLoading(false);
    }, 300);
  }, [token, onTokenSubmit]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        className="
          relative w-full max-w-md mx-4
          bg-[#e8ebf0] rounded-3xl
          shadow-[-12px_-12px_24px_rgba(255,255,255,0.8),12px_12px_24px_rgba(0,0,0,0.2)]
          overflow-hidden
        "
        role="dialog"
        aria-modal="true"
        aria-labelledby="token-modal-title"
      >
        {/* Decorative top bar */}
        <div className="h-1.5 bg-gradient-to-r from-[#ff4757] via-[#ff6b7a] to-[#ff4757]" />

        <div className="p-8">
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            {/* Terminal icon */}
            <div className="
              w-12 h-12 rounded-xl
              bg-[#e0e5ec]
              shadow-[-4px_-4px_8px_rgba(255,255,255,0.8),4px_4px_8px_rgba(0,0,0,0.15)_inset]
              flex items-center justify-center
            ">
              <svg
                className="w-6 h-6 text-[#ff4757]"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
            </div>
            <div>
              <h2
                id="token-modal-title"
                className="text-xl font-bold text-[#374151]"
              >
                Enter Access Token
              </h2>
              <p className="text-sm text-[#8b9298]">
                Authentication required to continue
              </p>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <Input
              type="text"
              label="Token"
              placeholder="Paste your access token here"
              value={token}
              onChange={(e) => {
                setToken(e.target.value);
                if (error) setError('');
              }}
              error={error}
              autoFocus
              autoComplete="off"
              spellCheck={false}
            />

            {/* Help text */}
            <div className="
              p-3 rounded-xl
              bg-[#e0e5ec]
              shadow-[-2px_-2px_4px_rgba(255,255,255,0.7),2px_2px_4px_rgba(0,0,0,0.08)_inset]
            ">
              <p className="text-xs text-[#5a6270] leading-relaxed">
                <span className="font-semibold text-[#374151]">Tip:</span> Start the server with{' '}
                <code className="px-1.5 py-0.5 rounded bg-[#d5dae2] text-[#ff4757] font-mono text-[11px]">
                  lechat server start
                </code>{' '}
                to get your access token URL.
              </p>
            </div>

            {/* Submit button */}
            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Connecting...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                  </svg>
                  Connect
                </span>
              )}
            </Button>
          </form>
        </div>

        {/* Decorative screws */}
        <div className="absolute top-4 left-4 w-2.5 h-2.5 rounded-full bg-[#c8ccd3] shadow-[-1px_-1px_2px_rgba(255,255,255,0.6),1px_1px_2px_rgba(0,0,0,0.2)]" />
        <div className="absolute top-4 right-4 w-2.5 h-2.5 rounded-full bg-[#c8ccd3] shadow-[-1px_-1px_2px_rgba(255,255,255,0.6),1px_1px_2px_rgba(0,0,0,0.2)]" />
        <div className="absolute bottom-4 left-4 w-2.5 h-2.5 rounded-full bg-[#c8ccd3] shadow-[-1px_-1px_2px_rgba(255,255,255,0.6),1px_1px_2px_rgba(0,0,0,0.2)]" />
        <div className="absolute bottom-4 right-4 w-2.5 h-2.5 rounded-full bg-[#c8ccd3] shadow-[-1px_-1px_2px_rgba(255,255,255,0.6),1px_1px_2px_rgba(0,0,0,0.2)]" />
      </div>
    </div>
  );
}
