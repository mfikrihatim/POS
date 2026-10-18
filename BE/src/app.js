const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const env = require('./config/env');
const db = require('./config/db');
const { errorHandler } = require('./utils/http');
const { authenticate } = require('./middleware/auth');
const payments = require('./routes/payments.routes');

const app = express();
app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: env.corsOrigin.length ? env.corsOrigin : true }));
app.use(express.json({ limit: '1mb' }));
if (env.nodeEnv !== 'test') app.use(morgan(env.nodeEnv === 'production' ? 'tiny' : 'dev'));

app.get('/api/health', async (_req, res) => {
  await db.query('SELECT 1');
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Konfigurasi publik untuk FE (tanpa rahasia)
app.get('/api/config', (_req, res) => res.json({
  store: env.store,
  midtrans: { enabled: env.midtrans.enabled, clientKey: env.midtrans.clientKey, isProduction: env.midtrans.isProduction },
  smtpEnabled: env.smtp.enabled,
}));

// Dokumentasi API (Swagger UI)
const swaggerUi = require('swagger-ui-express');
const openapi = require('./docs/openapi');
app.get('/api/docs.json', (_req, res) => res.json(openapi));
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openapi, {
  customSiteTitle: 'POS API Docs',
  swaggerOptions: { persistAuthorization: true, docExpansion: 'none' },
}));

app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/products', require('./routes/products.routes')); // GET /:id/image publik, sisanya pakai auth
app.use('/api/payments', payments.publicRouter);

app.use('/api', authenticate);
app.use('/api/users', require('./routes/users.routes'));
app.use('/api/categories', require('./routes/categories.routes'));
app.use('/api/stock', require('./routes/stock.routes'));
app.use('/api/transactions', require('./routes/transactions.routes').router);
app.use('/api/payments', payments.router);
app.use('/api/reports', require('./routes/reports.routes'));

app.use('/api', (_req, res) => res.status(404).json({ message: 'Endpoint tidak ditemukan' }));

// Sajikan build Angular (deploy 1 service di Railway)
const feDist = path.join(__dirname, '..', '..', 'FE', 'dist', 'pos-fe', 'browser');
if (fs.existsSync(feDist)) {
  app.use(express.static(feDist, { maxAge: '1h', index: false }));
  app.get(/^(?!\/api).*/, (_req, res) => res.sendFile(path.join(feDist, 'index.html')));
}

app.use(errorHandler);

module.exports = app;
