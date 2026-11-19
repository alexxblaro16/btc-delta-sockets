import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// En GitHub Pages la web vive en /btc-delta-sockets/. En local, en la raíz.
export default defineConfig(({ command }) => ({
  base: process.env.BASE_PATH ?? (command === 'build' ? '/btc-delta-sockets/' : '/'),
  plugins: [react()],
  test: {
    environment: 'jsdom',
  },
}));
