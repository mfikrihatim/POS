const router = require('express').Router();
const { z } = require('zod');
const db = require('../config/db');
const { validate, pageParams, pageMeta, AppError } = require('../utils/http');
const { authorize } = require('../middleware/auth');

const movementSchema = z.object({
  product_id: z.coerce.number().int().positive('Produk wajib dipilih'),
  type: z.enum(['in', 'out', 'adjustment'], { error: 'Tipe harus in, out, atau adjustment' }),
  // in/out: jumlah (>0). adjustment: stok fisik hasil stock opname (>=0)
  qty: z.coerce.number().int().min(0, 'Jumlah tidak boleh negatif').max(100000),
  reference: z.string().trim().max(60).optional().nullable(),
  note: z.string().trim().max(500).optional().nullable(),
}).refine((m) => m.type === 'adjustment' || m.qty > 0, { message: 'Jumlah harus lebih dari 0', path: ['qty'] });

router.get('/summary', async (_req, res) => {
  const { rows: [s] } = await db.query(`SELECT count(*)::int AS products, COALESCE(sum(stock),0)::int AS units,
    COALESCE(sum(stock * cost),0) AS stock_value,
    count(*) FILTER (WHERE stock <= min_stock AND stock > 0)::int AS low_stock,
    count(*) FILTER (WHERE stock = 0)::int AS out_of_stock FROM products WHERE is_active`);
  res.json(s);
});

router.get('/movements', async (req, res) => {
  const { page, limit, offset } = pageParams(req.query);
  const params = [];
  const where = [];
  if (req.query.product_id) { params.push(Number(req.query.product_id)); where.push(`m.product_id = $${params.length}`); }
  if (req.query.type) { params.push(req.query.type); where.push(`m.type = $${params.length}`); }
  if (req.query.search) { params.push(`%${req.query.search}%`); where.push(`(p.name ILIKE $${params.length} OR m.reference ILIKE $${params.length})`); }
  const w = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const [{ rows }, { rows: [c] }] = await Promise.all([
    db.query(`SELECT m.*, p.name AS product_name, p.sku, p.unit, u.name AS user_name FROM stock_movements m
      JOIN products p ON p.id = m.product_id LEFT JOIN users u ON u.id = m.user_id ${w}
      ORDER BY m.created_at DESC, m.id DESC LIMIT ${limit} OFFSET ${offset}`, params),
    db.query(`SELECT count(*)::int AS total FROM stock_movements m JOIN products p ON p.id = m.product_id ${w}`, params),
  ]);
  res.json({ data: rows, meta: pageMeta(page, limit, c.total) });
});

router.post('/movements', authorize('admin'), validate({ body: movementSchema }), async (req, res) => {
  const b = req.valid.body;
  const movement = await db.withTransaction(async (client) => {
    const { rows: [p] } = await client.query('SELECT id, name, stock FROM products WHERE id = $1 FOR UPDATE', [b.product_id]);
    if (!p) throw new AppError(404, 'Produk tidak ditemukan');
    let delta;
    if (b.type === 'in') delta = b.qty;
    else if (b.type === 'out') delta = -b.qty;
    else delta = b.qty - p.stock;
    const after = p.stock + delta;
    if (after < 0) throw new AppError(422, `Stok "${p.name}" tidak cukup (tersisa ${p.stock})`);
    if (delta === 0) throw new AppError(422, 'Stok tidak berubah');
    await client.query('UPDATE products SET stock = $1, updated_at = now() WHERE id = $2', [after, p.id]);
    const { rows: [m] } = await client.query(
      `INSERT INTO stock_movements (product_id, type, qty, stock_before, stock_after, reference, note, user_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [p.id, b.type, delta, p.stock, after, b.reference || null, b.note || null, req.user.id]);
    return m;
  });
  res.status(201).json(movement);
});

module.exports = router;
