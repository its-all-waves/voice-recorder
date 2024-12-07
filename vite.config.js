import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import commonjs from '@rollup/plugin-commonjs';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react({ jsxRuntime: 'automatic' }), commonjs()],
  server: {
    open: 'dev/index.html',
  },
  build: {
    lib: {
      entry: './src/VoiceRecorder.jsx',
      name: 'VoiceRecorder',
      fileName: 'voice-recorder',
      formats: ['es', 'umd']
    },
    rollupOptions: {
      external: ['react', 'react-dom', 'web-audio-peakmeter-react'],
      output: {
        globals: {
          react: 'React',
          'react-dom': 'ReactDom',
        }
      }
    }
  },
});