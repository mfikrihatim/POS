// Menjalankan file SQL di folder migrations secara berurutan (sekali per file).
// --fresh : hapus seluruh schema public lalu jalankan ulang semua migrasi.
const fs = require('fs');
const path = require('path');
const { pool } = require('../src/config/db');

(async () => {
  const fresh = process.argv.includes('--fresh');
  if (fresh) {
    await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
    console.log('Schema public dikosongkan.');
  }
  await pool.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    name TEXT PRIMARY KEY, run_at TIMESTAMPTZ NOT NULL DEFAULT now())`);

  const dir = path.join(__dirname, '..', 'migrations');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  const { rows } = await pool.query('SELECT name FROM schema_migrations');
  const done = new Set(rows.map((r) => r.name));

  for (const file of files) {
    if (done.has(file)) continue;
    const sql = fs.readFileSync(path.join(dir, file), 'utf8');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations(name) VALUES ($1)', [file]);
      await client.query('COMMIT');
      console.log('✔ migrasi', file);
    } catch (err) {
      await client.query('ROLLBACK');
      throw new Error(`${file}: ${err.message}`);
    } finally {
      client.release();
    }
  }
  console.log('Migrasi selesai.');
  await pool.end();
})().catch(async (err) => {
  console.error('Migrasi gagal:', err.message);
  await pool.end();
  process.exit(1);
});
