import express from 'express';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { apiRouter } from './server/routes.js';
import { AuthService } from './server/auth.js';
import { WSServerManager } from './server/wsServer.js';
import { getDb } from './server/db.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;
  const isProd = process.env.NODE_ENV === 'production';

  // Initialize SQLite database
  getDb();

  // Basic security and parsing middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  // Attach session authorization context to all requests
  app.use(AuthService.authMiddleware);

  // Mount API endpoints
  app.use('/api', apiRouter);

  // Direct health check
  app.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      database: 'connected',
      server: 'QueueLess Core',
      timestamp: new Date().toISOString(),
    });
  });

  const httpServer = http.createServer(app);

  // Initialize WebSockets on the same HTTP server instance
  WSServerManager.initialize(httpServer);

  if (!isProd) {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`[QueueLess] Engine running on port ${PORT} (${isProd ? 'Production' : 'Development'})`);
  });
}

startServer().catch((err) => {
  console.error('[QueueLess] Fatal startup error:', err);
  process.exit(1);
});
