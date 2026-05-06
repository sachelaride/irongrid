import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
// Em dev: Vite roda na porta 3001 (igual à produção).
// O backend roda na porta 3002 (DEV_PORT=3002) e recebe o proxy do Vite.
// Assim, agentes sempre apontam para :3001, tanto em dev quanto em prod.
export default defineConfig({
    plugins: [
        react()
    ],
    server: {
        host: true,
        port: 3001,
        strictPort: true, // Falha se 3001 já estiver ocupada (evita uso silencioso de outra porta)
        hmr: {
            host: '192.168.0.121',
            clientPort: 3001
        },
        proxy: {
            '/vnc-tunnel': {
                target: 'http://localhost:3002',
                ws: true,
                changeOrigin: true
            },
            '/socket.io': {
                target: 'http://localhost:3002',
                ws: true,
                changeOrigin: true
            },
            '/trpc': {
                target: 'http://localhost:3002',
                changeOrigin: true
            },
            '/downloads': {
                target: 'http://localhost:3002',
                changeOrigin: true
            },
            '/diag': {
                target: 'http://localhost:3002',
                changeOrigin: true
            }
        }
    },
    optimizeDeps: {
        include: ['@novnc/novnc/lib/rfb']
    }
})
