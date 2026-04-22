'use client';

import { useState, useCallback, useEffect } from 'react';
import { Button } from './Button';
import { Input } from './Input';

const REQUIRED_CONFIRMATION = 'I understand the data will be deleted permanently.';

interface DeleteConversationModalProps {
  isOpen: boolean;
  conversationTitle: string;
  conversationType: 'dm' | 'channel';
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}

export function DeleteConversationModal({
  isOpen,
  conversationTitle,
  conversationType,
  onConfirm,
  onCancel,
}: DeleteConversationModalProps) {
  const [confirmationText, setConfirmationText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState('');

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setConfirmationText('');
      setIsDeleting(false);
      setError('');
    }
  }, [isOpen]);

  const isConfirmationValid = confirmationText === REQUIRED_CONFIRMATION;

  const handleConfirm = useCallback(async () => {
    if (!isConfirmationValid || isDeleting) return;

    setIsDeleting(true);
    setError('');

    try {
      await onConfirm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete conversation');
      setIsDeleting(false);
    }
  }, [isConfirmationValid, isDeleting, onConfirm]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isDeleting) {
        onCancel();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, isDeleting, onCancel]);

  if (!isOpen) return null;

  const isDM = conversationType === 'dm';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        aria-hidden="true"
        onClick={!isDeleting ? onCancel : undefined}
      />

      {/* Modal */}
      <div
        className="
          relative w-full max-w-md mx-4
          bg-[#e8ebf0] rounded-3xl
          shadow-[-12px_-12px_24px_rgba(255,255,255,0.8),12px_12px_24px_rgba(0,0,0,0.25)]
          overflow-hidden
        "
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-modal-title"
      >
        {/* Decorative top bar - red for danger */}
        <div className="h-1.5 bg-gradient-to-r from-[#ff4757] via-[#ff6b7a] to-[#ff4757]" />

        <div className="p-8">
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            {/* Warning icon */}
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
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <div>
              <h2
                id="delete-modal-title"
                className="text-xl font-bold text-[#374151]"
              >
                Delete {isDM ? 'Conversation' : 'Group'}
              </h2>
              <p className="text-sm text-[#8b9298]">
                This action cannot be undone
              </p>
            </div>
          </div>

          {/* Warning message */}
          <div className="
            p-4 rounded-xl mb-5
            bg-red-50 border border-red-100
          ">
            <p className="text-sm text-red-700 leading-relaxed">
              <span className="font-semibold">Warning:</span> You are about to delete{' '}
              <span className="font-semibold">&quot;{conversationTitle}&quot;</span>.
              {isDM ? (
                <span className="block mt-1">Direct messages cannot be deleted through this interface.</span>
              ) : (
                <span className="block mt-1">This will permanently delete the group, all threads, and all messages. This action cannot be reversed.</span>
              )}
            </p>
          </div>

          {/* Confirmation input */}
          {!isDM && (
            <div className="mb-6">
              <label
                htmlFor="delete-confirmation"
                className="block text-sm font-medium text-[#5a6270] mb-2"
              >
                Type the following text to confirm:
              </label>
              <p className="text-xs text-[#8b9298] mb-2 font-mono bg-[#d5dae2] px-3 py-2 rounded-lg">
                {REQUIRED_CONFIRMATION}
              </p>
              <Input
                id="delete-confirmation"
                type="text"
                placeholder="Type the confirmation text above"
                value={confirmationText}
                onChange={(e) => {
                  setConfirmationText(e.target.value);
                  if (error) setError('');
                }}
                error={error}
                autoComplete="off"
                spellCheck={false}
                autoFocus
              />
            </div>
          )}

          {/* Error message */}
          {error && (
            <div className="
              p-3 rounded-xl mb-5
              bg-red-50 border border-red-100
            ">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-3">
            <Button
              variant="default"
              size="lg"
              className="flex-1"
              onClick={onCancel}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="lg"
              className="flex-1"
              onClick={handleConfirm}
              disabled={isDM ? true : !isConfirmationValid || isDeleting}
            >
              {isDeleting ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Deleting...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Delete
                </span>
              )}
            </Button>
          </div>
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