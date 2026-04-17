'use client';

import { ButtonHTMLAttributes, forwardRef } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'primary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = '', variant = 'default', size = 'md', children, disabled, ...props }, ref) => {
    const baseStyles = `
      relative inline-flex items-center justify-center font-medium rounded-xl
      transition-all duration-150 ease-out
      bg-[#e0e5ec] text-[#374151]
      shadow-[-6px_-6px_12px_rgba(255,255,255,0.8),6px_6px_12px_rgba(0,0,0,0.15)]
      hover:shadow-[-4px_-4px_8px_rgba(255,255,255,0.9),4px_4px_8px_rgba(0,0,0,0.12)]
      active:shadow-[-2px_-2px_4px_rgba(255,255,255,0.95),2px_2px_4px_rgba(0,0,0,0.1)]
      active:translate-y-[2px]
      disabled:opacity-50 disabled:cursor-not-allowed
      disabled:shadow-none
    `;

    const variantStyles = {
      default: '',
      primary: 'text-[#ff4757]',
      ghost: 'shadow-none bg-transparent hover:bg-[#d5dae2] active:bg-[#cdd2d9]',
    };

    const sizeStyles = {
      sm: 'px-3 py-1.5 text-sm',
      md: 'px-4 py-2 text-base',
      lg: 'px-6 py-3 text-lg',
    };

    return (
      <button
        ref={ref}
        className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
        disabled={disabled}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';

export { Button };
export type { ButtonProps };
