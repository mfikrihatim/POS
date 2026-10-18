// Server produksi FE: menyajikan build Angular dan meneruskan /api ke service BE.
// API_URL contoh di Railway: http://${{pos-be.RAILWAY_PRIVATE_DOMAIN}}:${{pos-be.PORT}}
const path = require('path');
const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');

const PORT = process.env.PORT || 4200;
const API_URL = process.env.API_URL || 'http://localhost:3000';
const dist = path.join(__dirname, 'dist', 'pos-fe', 'browser');

const app = express();
app.disable('x-powered-by');

app.use(createProxyMiddleware({
  target: API_URL,
  changeOrigin: true,
  pathFilter: '/api',
  on: {
    error: (err, _req, res) => {
      console.error('[proxy]', err.message);
      if (!res.headersSent) res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: 'Backend tidak dapat dihubungi' }));
    },
  },
}));

app.get('/healthz', (_req, res) => res.json({ status: 'ok' }));
app.use(express.static(dist, { maxAge: '1h', index: false }));
app.get(/.*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')));

app.listen(PORT, () => console.log(`POS FE berjalan di port ${PORT}, proxy /api -> ${API_URL}`));
