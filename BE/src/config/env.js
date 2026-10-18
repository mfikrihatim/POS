const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env'), quiet: true });

const bool = (v, def = false) => (v === undefined || v === '' ? def : ['1', 'true', 'yes'].includes(String(v).toLowerCase()));

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 3000),
  db: {
    url: process.env.DATABASE_URL || '',
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'POS',
    ssl: bool(process.env.DB_SSL),
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'dev-secret-change-me',
    expiresIn: process.env.JWT_EXPIRES_IN || '12h',
  },
  store: {
    name: process.env.STORE_NAME || 'Toko POS',
    address: process.env.STORE_ADDRESS || '',
    phone: process.env.STORE_PHONE || '',
    taxPercent: Number(process.env.TAX_PERCENT || 11),
  },
  corsOrigin: (process.env.CORS_ORIGIN || '').split(',').map((s) => s.trim()).filter(Boolean),
  midtrans: {
    serverKey: process.env.MIDTRANS_SERVER_KEY || '',
    clientKey: process.env.MIDTRANS_CLIENT_KEY || '',
    isProduction: bool(process.env.MIDTRANS_IS_PRODUCTION),
  },
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: Number(process.env.SMTP_PORT || 465),
    secure: bool(process.env.SMTP_SECURE, true),
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.MAIL_FROM || 'POS <no-reply@pos.local>',
  },
};

env.midtrans.enabled = Boolean(env.midtrans.serverKey && env.midtrans.clientKey);
env.smtp.enabled = Boolean(env.smtp.host && env.smtp.user);

module.exports = env;
