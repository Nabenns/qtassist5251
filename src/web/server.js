const path = require('path');
const fs = require('fs');
const express = require('express');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');

const authRoutes = require('./routes/auth');
const statsRoutes = require('./routes/stats');
const emailsRoutes = require('./routes/emails');
const auditRoutes = require('./routes/audit');
const buildTransactionsRouter = require('./routes/transactions');
const buildTempRolesRouter = require('./routes/temproles');
const buildProductsRouter = require('./routes/products');
const buildDiscordRouter = require('./routes/discord');
const buildDiscordPostsRouter = require('./routes/discordPosts');
const buildUsersRouter = require('./routes/users');
const buildBotRouter = require('./routes/bot');
const buildEventsRouter = require('./routes/events');

/**
 * Build the admin web Express app and mount it on a port.
 * Returns the http.Server instance so the bot can shut it down on SIGINT.
 *
 * @param {Object} opts
 * @param {() => import('discord.js').Client | null} opts.getDiscordClient
 *   Lazy getter for the Discord client. Auth-protected routes call this when
 *   a client is needed (e.g. approving a transaction).
 */
function startWebServer({ getDiscordClient }) {
  const app = express();
  const port = parseInt(process.env.WEB_PORT, 10) || 3000;
  const isProd = process.env.NODE_ENV === 'production';
  const processStartedAt = Date.now();
  const getProcessStartedAt = () => processStartedAt;

  // Trust the reverse proxy (nginx) for correct client IP and protocol.
  app.set('trust proxy', 1);

  app.use(
    helmet({
      // The frontend bundle and a few inline styles need a permissive but
      // sane CSP. If you embed external assets (e.g. a logo from a CDN)
      // extend img-src/connect-src here.
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          'default-src': ["'self'"],
          'img-src': ["'self'", 'data:', 'https:'],
          'script-src': ["'self'"],
          'style-src': ["'self'", "'unsafe-inline'"],
          'connect-src': ["'self'"]
        }
      },
      crossOriginEmbedderPolicy: false
    })
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());

  // Health check (used by uptime monitoring / nginx)
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', uptime: process.uptime() });
  });

  // API routes
  app.use('/api/auth', authRoutes);
  app.use('/api/stats', statsRoutes);
  app.use('/api/transactions', buildTransactionsRouter({ getDiscordClient }));
  app.use('/api/products', buildProductsRouter({ getDiscordClient }));
  app.use('/api/temproles', buildTempRolesRouter({ getDiscordClient }));
  app.use('/api/emails', emailsRoutes);
  app.use('/api/audit', auditRoutes);
  app.use('/api/users', buildUsersRouter({ getDiscordClient }));
  app.use('/api/discord', buildDiscordRouter({ getDiscordClient }));
  app.use('/api/discord-posts', buildDiscordPostsRouter({ getDiscordClient }));
  app.use('/api/bot', buildBotRouter({ getDiscordClient, getProcessStartedAt }));
  app.use('/api/events', buildEventsRouter());

  // 404 for unknown /api/* requests so they don't fall through to the SPA
  app.use('/api', (req, res) => {
    res.status(404).json({ error: 'not_found' });
  });

  // Static SPA frontend (built by `npm run build:web`).
  const distDir = path.resolve(__dirname, '..', '..', 'web-admin', 'dist');
  if (fs.existsSync(distDir)) {
    app.use(
      express.static(distDir, {
        index: false,
        maxAge: isProd ? '1d' : 0
      })
    );

    // SPA fallback: serve index.html for any non-API GET so client-side
    // routing works on direct page loads.
    app.get(/^\/(?!api\/).*/, (req, res, next) => {
      const indexFile = path.join(distDir, 'index.html');
      res.sendFile(indexFile, (err) => {
        if (err) next(err);
      });
    });
  } else {
    // The bot can run without the frontend built (e.g. during initial deploy).
    app.get('/', (req, res) => {
      res
        .status(503)
        .send(
          '<h1>QTAssist Admin</h1><p>Frontend not built yet. Run <code>npm run build:web</code> on the server.</p>'
        );
    });
  }

  // Error fallback
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    console.error('Unhandled web error:', err);
    if (res.headersSent) return;
    res.status(500).json({ error: 'internal_error' });
  });

  const server = app.listen(port, () => {
    console.log(`🌐 Admin web server listening on port ${port}`);
    if (!fs.existsSync(distDir)) {
      console.warn(
        `⚠️ web-admin/dist not found. Build it with \`npm run build:web\` to enable the dashboard UI.`
      );
    }
  });

  return server;
}

module.exports = { startWebServer };
