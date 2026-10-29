import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import { PORTAL_DOMAINS } from './src/shared/portalDomains';

function getLocalApiProxyTarget(): string | undefined {
  const configuredTarget = process.env.RUDA_DEV_API_PROXY_TARGET;
  if (!configuredTarget) return undefined;
  const target = new URL(configuredTarget);
  if (target.protocol !== 'http:' || !['localhost', '127.0.0.1', '[::1]'].includes(target.hostname)) {
    throw new Error('RUDA_DEV_API_PROXY_TARGET must be a loopback HTTP URL');
  }
  return target.origin;
}

export default defineConfig(() => {
  const localApiProxyTarget = getLocalApiProxyTarget();
  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'public-api-in-preview',
        configurePreviewServer(previewServer) {
          previewServer.middlewares.use((req, res, next) => {
            if (req.method !== 'GET' || !req.url) {
              next();
              return;
            }

            const requestUrl = new URL(req.url, 'http://localhost');
            if (!['/api/merchants', '/api/showrooms', '/api/products'].includes(requestUrl.pathname)) {
              next();
              return;
            }

            void fetch(new URL(`${requestUrl.pathname}${requestUrl.search}`, `https://${PORTAL_DOMAINS.public}`))
              .then(async response => {
                res.statusCode = response.status;
                const contentType = response.headers.get('content-type');
                if (contentType) res.setHeader('Content-Type', contentType);
                res.end(Buffer.from(await response.arrayBuffer()));
              })
              .catch(next);
          });
        }
      }
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      ...(localApiProxyTarget
        ? { proxy: { '/api': { target: localApiProxyTarget } } }
        : {}),
      allowedHosts: [
        ...Object.values(PORTAL_DOMAINS)
      ],
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
    build: {
      emptyOutDir: false,
      rollupOptions: {
        output: {
          manualChunks: {
            react: ['react', 'react-dom'],
            icons: ['lucide-react']
          }
        }
      }
    }
  };
});
