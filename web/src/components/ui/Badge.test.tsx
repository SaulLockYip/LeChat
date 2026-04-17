import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@/testutils/test_wrapper';
import { Badge } from './Badge';

describe('Badge', () => {
  it('should render with default props', () => {
    render(<Badge>5</Badge>);

    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('should render with different variants', () => {
    const { rerender } = render(<Badge variant="default">Default</Badge>);
    expect(screen.getByText('Default')).toBeInTheDocument();

    rerender(<Badge variant="accent">Accent</Badge>);
    expect(screen.getByText('Accent')).toBeInTheDocument();

    rerender(<Badge variant="success">Success</Badge>);
    expect(screen.getByText('Success')).toBeInTheDocument();

    rerender(<Badge variant="warning">Warning</Badge>);
    expect(screen.getByText('Warning')).toBeInTheDocument();
  });

  it('should render with different sizes', () => {
    const { rerender } = render(<Badge size="sm">Small</Badge>);
    expect(screen.getByText('Small')).toBeInTheDocument();

    rerender(<Badge size="md">Medium</Badge>);
    expect(screen.getByText('Medium')).toBeInTheDocument();
  });

  it('should apply custom className', () => {
    render(<Badge className="custom-class">Custom</Badge>);

    const badge = screen.getByText('Custom');
    expect(badge).toHaveClass('custom-class');
  });

  it('should forward ref', () => {
    const ref = { current: null } as React.RefObject<HTMLSpanElement>;
    render(<Badge ref={ref}>With Ref</Badge>);

    expect(ref.current).toBeInstanceOf(HTMLSpanElement);
  });
});
