import { configDefaults, defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

// Standalone Vite configuration. The application does not depend on .figma.
export default defineConfig(({ mode }) => ({
  base: '/',
  plugins: [react({ jsxImportSource: '@storagehub/presentation' }), tailwindcss()],
  optimizeDeps: {
    // Scan the application entry only, excluding generated HTML test reports.
    entries: ['index.html'],
  },
  test: {
    exclude: [...configDefaults.exclude, '**/.local/**'],
  },
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
      '@storagehub/presentation': path.resolve(import.meta.dirname, './src/presentation'),
    },
  },
  build: {
    sourcemap: mode === 'development' ? 'inline' : false,
    minify: mode !== 'development',
  },
  server: {
    host: '0.0.0.0',
    port: Number(process.env.PORT || 8443),
    strictPort: Boolean(process.env.PORT),
  },
  preview: {
    host: '0.0.0.0',
    port: Number(process.env.PORT || 8443),
  },
}))
