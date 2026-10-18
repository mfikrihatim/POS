const router = require('express').Router();
const { z } = require('zod');
const db = require('../config/db');
const { validate, AppError } = require('../utils/http');
const { authorize } = require('../middleware/auth');

const schema = z.object({
  name: z.string().trim().min(2, 'Nama kategori minimal 2 karakter').max(80),
  description: z.string().trim().max(500).optional().nullable(),
});
const idParam = z.object({ id: z.coerce.number().int().positive() });

router.get('/', async (_req, res) => {
  const { rows } = await db.query(`SELECT c.*, count(p.id)::int AS product_count FROM categories c
    LEFT JOIN products p ON p.category_id = c.id AND p.is_active GROUP BY c.id ORDER BY c.name`);
  res.json(rows);
});

router.post('/', authorize('admin'), validate({ body: schema }), async (req, res) => {
  const { rows: [c] } = await db.query('INSERT INTO categories (name, description) VALUES ($1,$2) RETURNING *', [req.valid.body.name, req.valid.body.description || null]);
  res.status(201).json(c);
});

router.put('/:id', authorize('admin'), validate({ params: idParam, body: schema }), async (req, res) => {
  const { rows: [c] } = await db.query('UPDATE categories SET name=$1, description=$2 WHERE id=$3 RETURNING *',
    [req.valid.body.name, req.valid.body.description || null, req.valid.params.id]);
  if (!c) throw new AppError(404, 'Kategori tidak ditemukan');
  res.json(c);
});

router.delete('/:id', authorize('admin'), validate({ params: idParam }), async (req, res) => {
  const { rowCount } = await db.query('DELETE FROM categories WHERE id = $1', [req.valid.params.id]);
  if (!rowCount) throw new AppError(404, 'Kategori tidak ditemukan');
  res.json({ message: 'Kategori dihapus' });
});

module.exports = router;
