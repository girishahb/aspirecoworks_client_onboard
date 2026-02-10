import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  preview: {
    host: true, // bind to 0.0.0.0 so Render can reach the server
    port: process.env.PORT ? Number(process.env.PORT) : 4173,
  },
});
