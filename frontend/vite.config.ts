import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const target = env.VITE_API_URL || 'http://localhost:8000';

  return {
    plugins: [react()],
    server: {
      host: true,
      port: 5173,
      proxy: {
        '/api': target,
        '/auth': target,
        '/projects': target,
        '/templates': target,
        '/health': target,
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
  };
})
