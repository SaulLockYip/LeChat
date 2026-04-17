import React, { ReactNode } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

/**
 * Test wrapper that provides common providers and setup
 * Used to wrap components in tests
 */
interface TestWrapperProps {
  children: ReactNode;
}

function TestWrapper({ children }: TestWrapperProps) {
  return <>{children}</>;
}

/**
 * Custom render function that includes test wrapper and user event setup
 */
function customRender(
  ui: React.ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) {
  return {
    user: userEvent.setup(),
    ...render(ui, { wrapper: TestWrapper, ...options }),
  };
}

/**
 * Render with all necessary providers
 */
function renderWithProviders(
  ui: React.ReactElement,
  {
    preloadedState = {},
    store = {},
    ...renderOptions
  }: RenderOptions & { preloadedState?: Record<string, unknown>; store?: Record<string, unknown> } = {}
) {
  function Wrapper({ children }: { children: ReactNode }) {
    return <TestWrapper>{children}</TestWrapper>;
  }

  return { ...render(ui, { wrapper: Wrapper, ...renderOptions }) };
}

export * from '@testing-library/react';
export { customRender as render, renderWithProviders };
export { default as userEvent } from '@testing-library/user-event';
