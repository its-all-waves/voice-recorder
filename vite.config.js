import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import commonjs from '@rollup/plugin-commonjs';

export default defineConfig({
  plugins: [
    react(),
    commonjs({
      requireReturnsDefault: true,
      include: /node_modules/
    })
  ],
  build: {
    lib: {
      entry: './src/VoiceRecorder.jsx',
      name: 'VoiceRecorder',
      fileName: 'voice-recorder',
      formats: ['es', 'umd']
    },
    rollupOptions: {
      external: ['react', 'react-dom'],
      output: {
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM'
        }
      }
    }
  }
});