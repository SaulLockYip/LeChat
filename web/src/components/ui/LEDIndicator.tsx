'use client';

import { HTMLAttributes, forwardRef } from 'react';

interface LEDIndicatorProps extends HTMLAttributes<HTMLSpanElement> {
  color?: 'green' | 'red' | 'yellow' | 'off';
  pulse?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const LEDIndicator = forwardRef<HTMLSpanElement, LEDIndicatorProps>(
  ({ className = '', color = 'off', pulse = false, size = 'md', ...props }, ref) => {
    const colorStyles = {
      green: `
        bg-[#2ed573]
        shadow-[0_0_8px_#2ed573,0_0_16px_rgba(46,213,115,0.4)]
      `,
      red: `
        bg-[#ff4757]
        shadow-[0_0_8px_#ff4757,0_0_16px_rgba(255,71,87,0.4)]
      `,
      yellow: `
        bg-[#ffa502]
        shadow-[0_0_8px_#ffa502,0_0_16px_rgba(255,165,2,0.4)]
      `,
      off: `
        bg-[#8b9298]
        shadow-none
      `,
    };

    const sizeStyles = {
      sm: 'w-2 h-2',
      md: 'w-2.5 h-2.5',
      lg: 'w-3 h-3',
    };

    return (
      <span
        ref={ref}
        className={`
          inline-block rounded-full
          ${colorStyles[color]}
          ${sizeStyles[size]}
          ${pulse && color !== 'off' ? 'animate-pulse' : ''}
          ${className}
        `}
        {...props}
      />
    );
  }
);

LEDIndicator.displayName = 'LEDIndicator';

export { LEDIndicator };
export type { LEDIndicatorProps };
