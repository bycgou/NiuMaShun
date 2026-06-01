import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  root: 'src/renderer',
  base: './',
  build: {
    outDir: '../../dist/renderer',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'src/renderer/index.html'),
        pet: path.resolve(__dirname, 'src/renderer/pet/pet.html'),
      },
      external: ['electron', '@electron/remote'],
    },
  },
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, 'src/shared'),
      'electron': path.resolve(__dirname, 'src/renderer/shims/electron.ts'),
      '@electron/remote': path.resolve(__dirname, 'src/renderer/shims/electron-remote.ts'),
    },
  },
  test: {
    root: path.resolve(__dirname),
    include: ['tests/**/*.{test,spec}.?(c|m)[jt]s?(x)'],
  },
});
