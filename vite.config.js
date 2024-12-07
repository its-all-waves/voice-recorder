import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    open: 'dev/index.html',
  },
  resolve: {
    dedupe: ['react', 'react-dom'],
    mainFields: ['module', 'main', 'browser']
  },
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
          'react-dom': 'ReactDom',
        }
      }
    },
    commonjsOptions: {
      include: [/web-audio-peakmeter-react/],
      defaultIsModuleExports: true,
      transformMixedEsModules: true
    }
  },
  optimizeDeps: {
    include: ['web-audio-peakmeter-react']
  }
})