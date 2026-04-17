'use client';

import { HTMLAttributes, forwardRef } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'elevated' | 'pressed';
  showScrews?: boolean;
}

const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className = '', variant = 'default', showScrews = false, children, ...props }, ref) => {
    const variantStyles = {
      default: `
        bg-[#f0f2f5]
        shadow-[-8px_-8px_16px_rgba(255,255,255,0.8),8px_8px_16px_rgba(0,0,0,0.12)]
        hover:shadow-[-10px_-10px_20px_rgba(255,255,255,0.85),10px_10px_20px_rgba(0,0,0,0.14)]
        hover:-translate-y-0.5
      `,
      elevated: `
        bg-[#f0f2f5]
        shadow-[0_8px_24px_rgba(0,0,0,0.15)]
        hover:shadow-[0_12px_32px_rgba(0,0,0,0.2)]
        hover:-translate-y-1
      `,
      pressed: `
        bg-[#e8ebf0]
        shadow-[-2px_-2px_4px_rgba(255,255,255,0.7),2px_2px_4px_rgba(0,0,0,0.1)_inset]
      `,
    };

    return (
      <div
        ref={ref}
        className={`
          relative rounded-2xl p-4
          transition-all duration-200 ease-out
          ${variantStyles[variant]}
          ${className}
        `}
        {...props}
      >
        {showScrews && (
          <>
            {/* Corner screws decoration */}
            <div className="absolute top-2 left-2 w-3 h-3 rounded-full bg-[#c8ccd3] shadow-[-1px_-1px_2px_rgba(255,255,255,0.6),1px_1px_2px_rgba(0,0,0,0.2)]" />
            <div className="absolute top-2 right-2 w-3 h-3 rounded-full bg-[#c8ccd3] shadow-[-1px_-1px_2px_rgba(255,255,255,0.6),1px_1px_2px_rgba(0,0,0,0.2)]" />
            <div className="absolute bottom-2 left-2 w-3 h-3 rounded-full bg-[#c8ccd3] shadow-[-1px_-1px_2px_rgba(255,255,255,0.6),1px_1px_2px_rgba(0,0,0,0.2)]" />
            <div className="absolute bottom-2 right-2 w-3 h-3 rounded-full bg-[#c8ccd3] shadow-[-1px_-1px_2px_rgba(255,255,255,0.6),1px_1px_2px_rgba(0,0,0,0.2)]" />
          </>
        )}
        <div className={showScrews ? 'pt-4 pb-2 px-2' : ''}>
          {children}
        </div>
      </div>
    );
  }
);

Card.displayName = 'Card';

export { Card };
export type { CardProps };
