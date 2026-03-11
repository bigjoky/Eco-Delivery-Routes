import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import laravel from 'laravel-vite-plugin';

const devPort = Number(process.env.VITE_DEV_PORT ?? '5173');
const devHost = process.env.VITE_DEV_HOST || undefined;
const listenHost = process.env.VITE_LISTEN_HOST || undefined;

export default defineConfig({
  plugins: [
    laravel({
      input: ['resources/js/app.tsx'],
      refresh: true,
    }),
    react(),
  ],
  server: {
    host: listenHost,
    port: devPort,
    strictPort: true,
    ...(devHost
      ? {
          origin: `http://${devHost}:${devPort}`,
          hmr: {
            host: devHost,
            port: devPort,
          },
        }
      : {}),
  },
  test: {
    include: ['resources/js/**/*.test.ts', 'resources/js/**/*.test.tsx'],
    exclude: ['tests/e2e/**', 'node_modules/**', 'dist/**'],
  },
});
