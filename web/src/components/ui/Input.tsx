'use client';

import { InputHTMLAttributes, forwardRef } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className = '', label, error, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="text-sm font-medium text-[#5a6270] pl-1"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={`
            w-full px-4 py-2.5 rounded-xl
            bg-[#e0e5ec]
            shadow-[-4px_-4px_8px_rgba(255,255,255,0.8),4px_4px_8px_rgba(0,0,0,0.12)_inset]
            border border-transparent
            text-[#374151] placeholder-[#9ca3af]
            transition-all duration-150
            focus:outline-none focus:border-[#ff4757]/30 focus:shadow-[-2px_-2px_4px_rgba(255,255,255,0.9),2px_2px_4px_rgba(0,0,0,0.08)_inset]
            disabled:opacity-50 disabled:cursor-not-allowed
            ${error ? 'border-[#ff4757]/50' : ''}
            ${className}
          `}
          {...props}
        />
        {error && (
          <span className="text-xs text-[#ff4757] pl-1">{error}</span>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

export { Input };
export type { InputProps };
