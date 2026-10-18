// Membuat database (DB_NAME) jika belum ada, dengan koneksi ke database bawaan "postgres".
const { Client } = require('pg');
const env = require('../src/config/env');
const { connectionConfig } = require('../src/config/db');

(async () => {
  const name = env.db.url ? new URL(env.db.url).pathname.slice(1) || 'POS' : env.db.database;
  const client = new Client(connectionConfig('postgres'));
  await client.connect();
  const { rowCount } = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [name]);
  if (rowCount) {
    console.log(`Database "${name}" sudah ada.`);
  } else {
    await client.query(`CREATE DATABASE "${name.replace(/"/g, '""')}"`);
    console.log(`Database "${name}" berhasil dibuat.`);
  }
  await client.end();
  process.exit(0);
})().catch((err) => {
  console.error('Gagal membuat database:', err.message);
  process.exit(1);
});
