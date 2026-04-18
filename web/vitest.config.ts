import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./test/utils/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.d.ts',
        'src/**/*.stories.{ts,tsx}',
        'test/**',
      ],
    },
  },
  resolve: {
    alias: [
      { find: '@/test/utils', replacement: path.resolve(__dirname, './test/utils') },
      { find: '@/testutils', replacement: path.resolve(__dirname, './test/utils') },
      { find: '@', replacement: path.resolve(__dirname, './src') },
    ],
  },
});
