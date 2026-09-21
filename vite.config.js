import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { readConfig } from './src/config.js';
export default defineConfig(({ mode }) => {
  readConfig(loadEnv(mode, process.cwd(), 'VITE_'));
  return { plugins: [react(), tailwindcss()] };
});
