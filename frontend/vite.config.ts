import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (id.includes('recharts')) return 'vendor-recharts';
          if (id.includes('framer-motion')) return 'vendor-framer-motion';
          if (id.includes('react-day-picker') || id.includes('date-fns')) return 'vendor-date';
          if (id.includes('react-router')) return 'vendor-router';
          if (id.includes('node_modules/react-dom')) return 'vendor-react';
          if (id.includes('node_modules/react/')) return 'vendor-react';
          if (id.includes('axios')) return 'vendor-axios';
          if (id.includes('lucide-react')) return 'vendor-icons';
        },
      },
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5000,
    allowedHosts: 'all',
  },
  preview: {
    host: '0.0.0.0',
    port: 5000,
    allowedHosts: true,
  },
});
