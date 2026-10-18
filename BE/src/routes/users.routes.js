const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { z } = require('zod');
const db = require('../config/db');
const { validate, pageParams, pageMeta, sortClause, AppError } = require('../utils/http');
const { authorize, clearUserCache } = require('../middleware/auth');

router.use(authorize('admin'));

const base = {
  name: z.string().trim().min(2, 'Nama minimal 2 karakter').max(100),
  email: z.email('Format email tidak valid').trim().toLowerCase(),
  role: z.enum(['admin', 'kasir'], { error: 'Role harus admin atau kasir' }),
  is_active: z.boolean().optional(),
};
const createSchema = z.object({ ...base, password: z.string().min(6, 'Password minimal 6 karakter') });
const updateSchema = z.object({ ...base, password: z.string().min(6, 'Password minimal 6 karakter').optional().or(z.literal('')) });
const idParam = z.object({ id: z.coerce.number().int().positive() });

const COLS = 'id, name, email, role, is_active, last_login_at, created_at';

router.get('/', async (req, res) => {
  const { page, limit, offset } = pageParams(req.query);
  const params = [];
  const where = [];
  if (req.query.search) { params.push(`%${req.query.search}%`); where.push(`(name ILIKE $${params.length} OR email ILIKE $${params.length})`); }
  if (req.query.role) { params.push(req.query.role); where.push(`role = $${params.length}`); }
  const w = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const order = sortClause(req.query, { name: 'name', email: 'email', role: 'role', created_at: 'created_at' }, 'id ASC');
  const [{ rows }, { rows: [c] }] = await Promise.all([
    db.query(`SELECT ${COLS} FROM users ${w} ORDER BY ${order} LIMIT ${limit} OFFSET ${offset}`, params),
    db.query(`SELECT count(*)::int AS total FROM users ${w}`, params),
  ]);
  res.json({ data: rows, meta: pageMeta(page, limit, c.total) });
});

router.post('/', validate({ body: createSchema }), async (req, res) => {
  const b = req.valid.body;
  const { rows: [u] } = await db.query(
    `INSERT INTO users (name, email, password_hash, role, is_active) VALUES ($1,$2,$3,$4,$5) RETURNING ${COLS}`,
    [b.name, b.email, await bcrypt.hash(b.password, 10), b.role, b.is_active ?? true]);
  res.status(201).json(u);
});

router.put('/:id', validate({ params: idParam, body: updateSchema }), async (req, res) => {
  const { id } = req.valid.params;
  const b = req.valid.body;
  if (id === req.user.id && (b.role !== 'admin' || b.is_active === false)) throw new AppError(422, 'Tidak bisa menurunkan role / menonaktifkan akun sendiri');
  const hash = b.password ? await bcrypt.hash(b.password, 10) : null;
  const { rows: [u] } = await db.query(
    `UPDATE users SET name=$1, email=$2, role=$3, is_active=COALESCE($4, is_active), password_hash=COALESCE($5, password_hash), updated_at=now()
     WHERE id=$6 RETURNING ${COLS}`, [b.name, b.email, b.role, b.is_active ?? null, hash, id]);
  if (!u) throw new AppError(404, 'Pengguna tidak ditemukan');
  clearUserCache(id);
  res.json(u);
});

router.delete('/:id', validate({ params: idParam }), async (req, res) => {
  const { id } = req.valid.params;
  if (id === req.user.id) throw new AppError(422, 'Tidak bisa menghapus akun sendiri');
  // Pengguna yang sudah punya transaksi dinonaktifkan saja, bukan dihapus (jejak audit)
  const { rows: [t] } = await db.query('SELECT 1 FROM transactions WHERE cashier_id = $1 LIMIT 1', [id]);
  if (t) {
    await db.query('UPDATE users SET is_active = false, updated_at = now() WHERE id = $1', [id]);
    clearUserCache(id);
    return res.json({ message: 'Pengguna memiliki riwayat transaksi, akun dinonaktifkan' });
  }
  const { rowCount } = await db.query('DELETE FROM users WHERE id = $1', [id]);
  clearUserCache(id);
  if (!rowCount) throw new AppError(404, 'Pengguna tidak ditemukan');
  res.json({ message: 'Pengguna dihapus' });
});

module.exports = router;
