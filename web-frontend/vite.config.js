import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// 动态设置 HMR 客户端端口：Docker 中设 VITE_HMR_PORT=5173，本地留空则用默认（3000）
const hmrClientPort = process.env.VITE_HMR_PORT 
  ? parseInt(process.env.VITE_HMR_PORT, 10) 
  : undefined;

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    host: '0.0.0.0',
    historyApiFallback: true,
    allowedHosts: [
      'gmic.top',
      'localhost',
      '127.0.0.1',
      'localhost:5173',  
      '127.0.0.1:5173'
    ],
    hmr: hmrClientPort 
      ? { clientPort: hmrClientPort }
      : true,
    proxy: {
      '/chains': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        secure: false,
      },
      '/ws': {
        target: 'ws://localhost:8080',
        ws: true,
        changeOrigin: true,
      }
    }
  },
  build: {
    outDir: 'build',
  },
  define: {
    global: 'globalThis',
  },
  esbuild: {
    loader: 'jsx',
    include: /src\/.*\.[tj]sx?$/,
    exclude: [],
  },
  optimizeDeps: {
    exclude: ['@linera/client'],
    esbuildOptions: {
      loader: {
        '.js': 'jsx',
      },
    },
  },
});