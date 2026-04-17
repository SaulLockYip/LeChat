'use client';

import { HTMLAttributes, forwardRef } from 'react';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'accent' | 'success' | 'warning';
  size?: 'sm' | 'md';
}

const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className = '', variant = 'default', size = 'md', children, ...props }, ref) => {
    const variantStyles = {
      default: 'bg-[#d5dae2] text-[#5a6270]',
      accent: 'bg-[#ff4757] text-white',
      success: 'bg-[#2ed573] text-white',
      warning: 'bg-[#ffa502] text-white',
    };

    const sizeStyles = {
      sm: 'px-1.5 py-0.5 text-xs min-w-[18px] h-[18px]',
      md: 'px-2 py-1 text-sm min-w-[22px] h-[22px]',
    };

    return (
      <span
        ref={ref}
        className={`
          inline-flex items-center justify-center
          font-semibold rounded-full
          ${variantStyles[variant]}
          ${sizeStyles[size]}
          ${className}
        `}
        {...props}
      >
        {children}
      </span>
    );
  }
);

Badge.displayName = 'Badge';

export { Badge };
export type { BadgeProps };
