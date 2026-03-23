import { cloudflare } from '@cloudflare/vite-plugin';
import vinext from 'vinext';
import { defineConfig } from 'vite';

const rscDepExcludes = [
  'react-server-dom-webpack',
  'react-server-dom-webpack/client',
  'react-server-dom-webpack/server',
  'react-server-dom-webpack/server.edge',
  'react-server-dom-webpack/server.browser',
  'react-server-dom-webpack/server.node',
  'react-server-dom-webpack/static',
];

export default defineConfig({
  optimizeDeps: {
    exclude: rscDepExcludes,
  },
  ssr: {
    optimizeDeps: {
      exclude: rscDepExcludes,
    },
  },
  plugins: [
    vinext(),
    cloudflare({
      viteEnvironment: { name: 'rsc', childEnvironments: ['ssr'] },
    }),
  ],
});
