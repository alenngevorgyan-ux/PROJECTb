/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express, { Express } from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { serverConfig } from './server/config';
import { caseRouter } from './server/cases/caseRoutes';
import { gmailRouter } from './server/gmail/gmailRoutes';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Builds the Express app with API routes and CORS wired up, without
 * binding a port or touching Vite/static asset serving. Used directly by
 * the server smoke test so `npm test` never needs a live dev server or a
 * fixed port.
 */
export function createApp(): Express {
  const app = express();

  // CORS: never a wildcard. Development allows common localhost dev
  // ports; production allows only APP_URL / ALLOWED_ORIGINS. See
  // server/config.ts for how this list is built.
  app.use(
    cors({
      origin(origin, callback) {
        // Same-origin / non-browser requests (no Origin header) are allowed;
        // the browser itself enforces CORS only for cross-origin calls.
        if (!origin) return callback(null, true);
        if (serverConfig.allowedOrigins.includes(origin)) return callback(null, true);
        callback(new Error(`Origin not allowed by CORS: ${origin}`));
      },
      credentials: true,
    })
  );
  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'business-world',
      timestamp: new Date().toISOString(),
      mode: process.env.NODE_ENV || 'development',
    });
  });

  app.use('/api/cases', caseRouter);
  app.use('/api/gmail', gmailRouter);

  return app;
}

/**
 * Mounts frontend serving (production static bundle, or Vite dev
 * middleware) onto an already-created app. Skipped entirely in test mode:
 * the smoke test only exercises the API surface and must not spin up a
 * Vite dev server (which binds its own HMR WebSocket port and would
 * conflict with a real `npm run dev` already running).
 */
async function mountFrontend(app: Express): Promise<void> {
  if (serverConfig.isTestMode) return;

  if (serverConfig.isProduction) {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }
}

async function startServer() {
  const app = createApp();
  await mountFrontend(app);

  const PORT = serverConfig.port || 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Business World] Server running at http://0.0.0.0:${PORT} (${process.env.NODE_ENV || 'development'})`);
  });
}

// Only auto-start when run directly (tsx server.ts / node --import tsx server.ts),
// not when imported as a module by the test suite.
const isMainModule = process.argv[1] && import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  startServer().catch((err) => {
    console.error('[Business World] Fatal server startup error:', err);
    process.exit(1);
  });
}
