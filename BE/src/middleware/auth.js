const jwt = require('jsonwebtoken');
const env = require('../config/env');
const db = require('../config/db');
const { AppError } = require('../utils/http');

// Cache singkat data user agar tidak query DB di setiap request
const cache = new Map();
const TTL = 30 * 1000;
const clearUserCache = (id) => (id ? cache.delete(Number(id)) : cache.clear());

async function loadUser(id) {
  const hit = cache.get(id);
  if (hit && hit.exp > Date.now()) return hit.user;
  const { rows } = await db.query('SELECT id, name, email, role, is_active FROM users WHERE id = $1', [id]);
  cache.set(id, { user: rows[0], exp: Date.now() + TTL });
  return rows[0];
}

async function authenticate(req, _res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw new AppError(401, 'Silakan login terlebih dahulu');
  let payload;
  try {
    payload = jwt.verify(token, env.jwt.secret);
  } catch {
    throw new AppError(401, 'Sesi berakhir, silakan login ulang');
  }
  const user = await loadUser(Number(payload.sub));
  if (!user || !user.is_active) throw new AppError(401, 'Akun tidak aktif');
  req.user = user;
  next();
}

const authorize = (...roles) => (req, _res, next) => {
  if (!roles.includes(req.user.role)) throw new AppError(403, 'Anda tidak memiliki akses ke fitur ini');
  next();
};

const signToken = (user) => jwt.sign({ sub: user.id, role: user.role }, env.jwt.secret, { expiresIn: env.jwt.expiresIn });

module.exports = { authenticate, authorize, signToken, clearUserCache };
