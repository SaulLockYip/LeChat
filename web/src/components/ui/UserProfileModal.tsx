'use client';

import { useState, useCallback, useEffect } from 'react';
import { Button } from './Button';
import { Input } from './Input';
import { api } from '@/lib/api';

interface UserProfile {
  id: string;
  name: string;
  title: string;
  created_at: string;
  updated_at: string;
}

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProfileUpdate?: (updatedProfile: UserProfile) => void;
}

export function UserProfileModal({ isOpen, onClose, onProfileUpdate }: UserProfileModalProps) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [name, setName] = useState('');
  const [title, setTitle] = useState('');
  const [token, setToken] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  // Fetch user profile when modal opens
  useEffect(() => {
    if (isOpen) {
      setIsLoading(true);
      setError('');

      // Get token for display
      const storedToken = localStorage.getItem('token');
      setToken(storedToken || '');

      // Fetch user info
      api.getUserInfo().then((result) => {
        setIsLoading(false);
        if (result.success && result.data) {
          setProfile(result.data);
          setName(result.data.name);
          setTitle(result.data.title);
        } else {
          setError(result.error || 'Failed to load profile');
        }
      });
    }
  }, [isOpen]);

  const handleSave = useCallback(async () => {
    if (!name.trim()) {
      setError('Name is required');
      return;
    }

    setIsSaving(true);
    setError('');

    const result = await api.updateUser({ name: name.trim(), title: title.trim() });

    setIsSaving(false);

    if (result.success && result.data) {
      setProfile(result.data);
      onProfileUpdate?.(result.data);
      onClose();
    } else {
      setError(result.error || 'Failed to update profile');
    }
  }, [name, title, onProfileUpdate, onClose]);

  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  }, [onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="profile-modal-title"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

      {/* Modal */}
      <div className="
        relative w-full max-w-md mx-4
        bg-[#e8ebf0] rounded-3xl
        shadow-[-12px_-12px_24px_rgba(255,255,255,0.8),12px_12px_24px_rgba(0,0,0,0.2)]
        overflow-hidden
      ">
        {/* Decorative top bar */}
        <div className="h-1.5 bg-gradient-to-r from-[#ff4757] via-[#ff6b7a] to-[#ff4757]" />

        <div className="p-8">
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            {/* User icon */}
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
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
            </div>
            <div>
              <h2
                id="profile-modal-title"
                className="text-xl font-bold text-[#374151]"
              >
                User Profile
              </h2>
              <p className="text-sm text-[#8b9298]">
                Manage your account details
              </p>
            </div>
          </div>

          {/* Loading state */}
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-8">
              <div className="w-8 h-8 border-2 border-[#8b9298] border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-[#8b9298] mt-2">Loading profile...</p>
            </div>
          )}

          {/* Error state */}
          {error && !isLoading && (
            <div className="
              p-3 rounded-xl mb-4
              bg-[#ff4757]/10 border border-[#ff4757]/30
            ">
              <p className="text-sm text-[#ff4757]">{error}</p>
            </div>
          )}

          {/* Profile form */}
          {!isLoading && (
            <div className="space-y-5">
              {/* Avatar preview */}
              <div className="flex justify-center">
                <div className="w-20 h-20 rounded-full bg-[#ff4757] shadow-[-4px_-4px_8px_rgba(255,255,255,0.3),4px_4px_8px_rgba(0,0,0,0.15)] flex items-center justify-center">
                  <span className="text-2xl font-bold text-white">
                    {(name || '?').charAt(0).toUpperCase()}
                  </span>
                </div>
              </div>

              <Input
                type="text"
                label="Name"
                placeholder="Enter your name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (error) setError('');
                }}
                autoFocus
              />

              <Input
                type="text"
                label="Title"
                placeholder="Enter your title (e.g., Software Engineer)"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  if (error) setError('');
                }}
              />

              {/* Token display (read-only) */}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-[#5a6270] pl-1">
                  Token
                </label>
                <div className="
                  w-full px-4 py-2.5 rounded-xl
                  bg-[#e0e5ec]
                  shadow-[-4px_-4px_8px_rgba(255,255,255,0.8),4px_4px_8px_rgba(0,0,0,0.12)_inset]
                  border border-transparent
                  text-[#374151] font-mono text-sm
                  overflow-hidden text-ellipsis
                ">
                  {token || 'No token'}
                </div>
                <span className="text-xs text-[#8b9298] pl-1">
                  Token is read-only and managed by the system
                </span>
              </div>

              {/* Action buttons */}
              <div className="flex gap-3 pt-2">
                <Button
                  variant="ghost"
                  size="lg"
                  className="flex-1"
                  onClick={onClose}
                  disabled={isSaving}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="lg"
                  className="flex-1"
                  onClick={handleSave}
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Saving...
                    </span>
                  ) : (
                    'Save Changes'
                  )}
                </Button>
              </div>
            </div>
          )}
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
