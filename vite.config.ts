import { wayfinder } from '@laravel/vite-plugin-wayfinder';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import laravel from 'laravel-vite-plugin';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), '');
    const appUrl = env.APP_URL || 'http://localhost:8000';
    let appHost = 'localhost';
    try {
        appHost = new URL(appUrl).hostname || 'localhost';
    } catch {
        appHost = 'localhost';
    }

    const devHost = env.VITE_DEV_HOST || '0.0.0.0';
    const devPort = Number(env.VITE_DEV_PORT || 5173);
    const hmrHost = env.VITE_HMR_HOST || appHost;
    const hmrPort = Number(env.VITE_HMR_PORT || devPort);
    const hmrProtocol = env.VITE_HMR_PROTOCOL || 'ws';
    const devProtocol = env.VITE_DEV_PROTOCOL || 'http';
    const devOrigin = env.VITE_DEV_ORIGIN || `${devProtocol}://${hmrHost}:${devPort}`;

    return {
        plugins: [
            laravel({
                input: ['resources/css/app.css', 'resources/js/app.tsx'],
                ssr: 'resources/js/ssr.tsx',
                refresh: true,
            }),
            react({
                babel: {
                    plugins: ['babel-plugin-react-compiler'],
                },
            }),
            tailwindcss(),
            wayfinder({
                formVariants: true,
            }),
        ],
        esbuild: {
            jsx: 'automatic',
        },
        server: {
            host: devHost,
            port: devPort,
            strictPort: true,
            cors: true,
            origin: devOrigin,
            hmr: {
                host: hmrHost,
                port: hmrPort,
                clientPort: hmrPort,
                protocol: hmrProtocol,
            },
        },
    };
});
