const { Pool, types } = require('pg');
const env = require('./env');

// NUMERIC & BIGINT -> number (nilai rupiah di aplikasi ini aman dalam batas Number)
types.setTypeParser(1700, (v) => (v === null ? null : Number(v)));
types.setTypeParser(20, (v) => (v === null ? null : Number(v)));

function connectionConfig(database) {
  const ssl = env.db.ssl ? { rejectUnauthorized: false } : false;
  if (env.db.url) {
    const url = new URL(env.db.url);
    if (database) url.pathname = '/' + database;
    return { connectionString: url.toString(), ssl };
  }
  return {
    host: env.db.host,
    port: env.db.port,
    user: env.db.user,
    password: env.db.password,
    database: database || env.db.database,
    ssl,
  };
}

const pool = new Pool({ ...connectionConfig(), max: 10 });

async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { pool, query: (text, params) => pool.query(text, params), withTransaction, connectionConfig };
