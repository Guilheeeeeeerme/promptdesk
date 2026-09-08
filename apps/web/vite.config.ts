import path from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@shared/auth': path.resolve(rootDir, '../shared/auth/index.ts'),
      '@shared/ui': path.resolve(rootDir, '../shared/ui'),
      react: path.resolve(rootDir, 'node_modules/react'),
      'react-dom': path.resolve(rootDir, 'node_modules/react-dom'),
      'react/jsx-runtime': path.resolve(
        rootDir,
        'node_modules/react/jsx-runtime.js',
      ),
      'react/jsx-dev-runtime': path.resolve(
        rootDir,
        'node_modules/react/jsx-dev-runtime.js',
      ),
    },
    dedupe: ['react', 'react-dom'],
  },
  server: {
    host: true,
    port: 8080,
    strictPort: true,
    proxy: {
      '/api': {
        target: process.env.VITE_API_PROXY_TARGET ?? 'http://localhost:3000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
      '/socket.io': {
        target: process.env.VITE_API_PROXY_TARGET ?? 'http://localhost:3000',
        changeOrigin: true,
        ws: true,
      },
    },
  },
});
