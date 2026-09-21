import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/auth': 'http://localhost:8000',
      '/projects': 'http://localhost:8000',
      '/templates': 'http://localhost:8000',
      '/health': 'http://localhost:8000',
    },
  },
  optimizeDeps: {
    include: ['three', '@react-three/fiber', '@react-three/drei'],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: (id: string) => {
          if (id.includes('/node_modules/three/')) return 'three';
          if (id.includes('@react-three/fiber') || id.includes('@react-three/drei')) return 'react-three';
          return undefined;
        },
      },
    },
  },
})
