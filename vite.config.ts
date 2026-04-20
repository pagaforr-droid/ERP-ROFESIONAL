import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    
    return {
      server: {
        port: 3001,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      // --- INICIO DE OPTIMIZACIÓN DE ÉLITE PARA VERCEL (CHUNKING) ---
      build: {
        chunkSizeWarningLimit: 1500, // Subimos el límite de advertencia de la consola
        rollupOptions: {
          output: {
            manualChunks(id) {
              // Dividimos el código que viene de node_modules en archivos más pequeños
              if (id.includes('node_modules')) {
                // 1. Aislamos las librerías de generación de PDF (Las más pesadas de tu proyecto)
                if (id.includes('html2canvas') || id.includes('jspdf') || id.includes('pdfmake')) {
                  return 'pdf-engine';
                }
                // 2. Aislamos la librería de iconos
                if (id.includes('lucide-react')) {
                  return 'icons';
                }
                // 3. Aislamos el cliente de Base de Datos
                if (id.includes('@supabase')) {
                  return 'supabase';
                }
                // 4. Aislamos el núcleo de React y gestores de estado
                if (id.includes('react/') || id.includes('react-dom/') || id.includes('zustand')) {
                  return 'react-core';
                }
                // 5. El resto de dependencias menores se empaquetan juntas
                return 'vendor';
              }
            }
          }
        }
      }
      // --- FIN DE OPTIMIZACIÓN ---
    };
});
