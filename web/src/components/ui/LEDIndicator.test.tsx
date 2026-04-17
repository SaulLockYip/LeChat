import { describe, it, expect } from 'vitest';
import { render, screen } from '@/testutils/test_wrapper';
import { LEDIndicator } from './LEDIndicator';

describe('LEDIndicator', () => {
  it('should render with default props', () => {
    render(<LEDIndicator />);

    // LEDIndicator renders a span without explicit role
    const indicator = document.querySelector('span.inline-block.rounded-full');
    expect(indicator).toBeInTheDocument();
  });

  it('should render with different colors', () => {
    const colors = ['green', 'red', 'yellow', 'off'] as const;

    colors.forEach((color) => {
      const { container } = render(<LEDIndicator color={color} />);
      expect(container.firstChild).toBeInTheDocument();
    });
  });

  it('should render with different sizes', () => {
    const sizes = ['sm', 'md', 'lg'] as const;

    sizes.forEach((size) => {
      const { container } = render(<LEDIndicator size={size} />);
      expect(container.firstChild).toBeInTheDocument();
    });
  });

  it('should apply pulse animation when pulse is true and color is not off', () => {
    render(<LEDIndicator color="green" pulse={true} />);

    const indicator = document.querySelector('span');
    expect(indicator).toHaveClass('animate-pulse');
  });

  it('should not pulse when color is off', () => {
    render(<LEDIndicator color="off" pulse={true} />);

    const indicator = document.querySelector('span');
    expect(indicator).not.toHaveClass('animate-pulse');
  });

  it('should apply custom className', () => {
    render(<LEDIndicator className="custom-class" />);

    const indicator = document.querySelector('span');
    expect(indicator).toHaveClass('custom-class');
  });

  it('should forward ref', () => {
    const ref = { current: null } as React.RefObject<HTMLSpanElement>;
    render(<LEDIndicator ref={ref} />);

    expect(ref.current).toBeInstanceOf(HTMLSpanElement);
  });
});
