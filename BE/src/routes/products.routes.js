const router = require('express').Router();
const multer = require('multer');
const { z } = require('zod');
const db = require('../config/db');
const { validate, pageParams, pageMeta, sortClause, AppError } = require('../utils/http');
const { authenticate, authorize } = require('../middleware/auth');

const ALLOWED = ['image/jpeg', 'image/png', 'image/webp'];
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => (ALLOWED.includes(file.mimetype) ? cb(null, true) : cb(new AppError(422, 'Format gambar harus JPG, PNG, atau WEBP'))),
});

const idParam = z.object({ id: z.coerce.number().int().positive() });
const productSchema = z.object({
  sku: z.string().trim().min(3, 'SKU minimal 3 karakter').max(40).regex(/^[A-Za-z0-9-]+$/, 'SKU hanya huruf, angka, dan tanda -'),
  name: z.string().trim().min(2, 'Nama produk minimal 2 karakter').max(150),
  description: z.string().trim().max(1000).optional().nullable(),
  category_id: z.coerce.number().int().positive('Kategori wajib dipilih'),
  price: z.coerce.number().min(0, 'Harga tidak boleh negatif').max(1e10),
  cost: z.coerce.number().min(0, 'Harga modal tidak boleh negatif').max(1e10).default(0),
  min_stock: z.coerce.number().int().min(0).default(5),
  unit: z.string().trim().min(1).max(20).default('pcs'),
  is_active: z.boolean().optional(),
}).refine((p) => p.cost <= p.price, { message: 'Harga modal tidak boleh melebihi harga jual', path: ['cost'] });
const initialStock = z.object({ stock: z.coerce.number().int().min(0, 'Stok awal tidak boleh negatif').default(0) });

const SELECT = `SELECT p.id, p.sku, p.name, p.description, p.category_id, c.name AS category_name, p.price, p.cost, p.stock,
  p.min_stock, p.unit, p.is_active, p.has_image, p.created_at, p.updated_at,
  CASE WHEN p.has_image THEN '/api/products/' || p.id || '/image?v=' || extract(epoch FROM COALESCE(pi.updated_at, p.updated_at))::bigint END AS image_url
  FROM products p LEFT JOIN categories c ON c.id = p.category_id LEFT JOIN product_images pi ON pi.product_id = p.id`;

// Gambar publik (tanpa auth) agar bisa dipakai langsung di <img>
router.get('/:id/image', validate({ params: idParam }), async (req, res) => {
  const { rows: [img] } = await db.query('SELECT mime_type, data FROM product_images WHERE product_id = $1', [req.valid.params.id]);
  if (!img) throw new AppError(404, 'Gambar tidak ditemukan');
  res.set('Content-Type', img.mime_type);
  res.set('Cache-Control', 'public, max-age=86400');
  res.set('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'");
  res.send(img.data);
});

router.use(authenticate);

router.get('/', async (req, res) => {
  const { page, limit, offset } = pageParams(req.query);
  const params = [];
  const where = [];
  if (req.query.search) {
    params.push(`%${req.query.search}%`);
    where.push(`(p.name ILIKE $${params.length} OR p.sku ILIKE $${params.length})`);
  }
  if (req.query.category_id) { params.push(Number(req.query.category_id)); where.push(`p.category_id = $${params.length}`); }
  if (req.query.status === 'active') where.push('p.is_active');
  if (req.query.status === 'inactive') where.push('NOT p.is_active');
  if (req.query.stock === 'low') where.push('p.stock <= p.min_stock AND p.stock > 0');
  if (req.query.stock === 'out') where.push('p.stock = 0');
  if (req.query.stock === 'alert') where.push('p.stock <= p.min_stock');
  if (req.query.stock === 'available') where.push('p.stock > 0');
  const w = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const order = sortClause(req.query, { name: 'p.name', price: 'p.price', stock: 'p.stock', sku: 'p.sku', created_at: 'p.created_at', category: 'c.name' }, 'p.name ASC');

  const [{ rows }, { rows: [c] }] = await Promise.all([
    db.query(`${SELECT} ${w} ORDER BY ${order}, p.id LIMIT ${limit} OFFSET ${offset}`, params),
    db.query(`SELECT count(*)::int AS total FROM products p LEFT JOIN categories c ON c.id = p.category_id ${w}`, params),
  ]);
  res.json({ data: rows, meta: pageMeta(page, limit, c.total) });
});

router.get('/:id', validate({ params: idParam }), async (req, res) => {
  const { rows: [p] } = await db.query(`${SELECT} WHERE p.id = $1`, [req.valid.params.id]);
  if (!p) throw new AppError(404, 'Produk tidak ditemukan');
  res.json(p);
});

router.post('/', authorize('admin'), validate({ body: productSchema.and(initialStock) }), async (req, res) => {
  const b = req.valid.body;
  const id = await db.withTransaction(async (client) => {
    const { rows: [p] } = await client.query(
      `INSERT INTO products (sku, name, description, category_id, price, cost, stock, min_stock, unit, is_active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
      [b.sku.toUpperCase(), b.name, b.description || null, b.category_id, b.price, b.cost, b.stock, b.min_stock, b.unit, b.is_active ?? true]);
    if (b.stock > 0) {
      await client.query(`INSERT INTO stock_movements (product_id, type, qty, stock_before, stock_after, reference, note, user_id)
        VALUES ($1,'in',$2,0,$2,'STOK-AWAL','Stok awal produk baru',$3)`, [p.id, b.stock, req.user.id]);
    }
    return p.id;
  });
  const { rows: [p] } = await db.query(`${SELECT} WHERE p.id = $1`, [id]);
  res.status(201).json(p);
});

// Stok TIDAK diubah di sini; gunakan modul Manajemen Stok agar tercatat di riwayat
router.put('/:id', authorize('admin'), validate({ params: idParam, body: productSchema }), async (req, res) => {
  const b = req.valid.body;
  const { rowCount } = await db.query(
    `UPDATE products SET sku=$1, name=$2, description=$3, category_id=$4, price=$5, cost=$6, min_stock=$7, unit=$8,
      is_active=COALESCE($9, is_active), updated_at=now() WHERE id=$10`,
    [b.sku.toUpperCase(), b.name, b.description || null, b.category_id, b.price, b.cost, b.min_stock, b.unit, b.is_active ?? null, req.valid.params.id]);
  if (!rowCount) throw new AppError(404, 'Produk tidak ditemukan');
  const { rows: [p] } = await db.query(`${SELECT} WHERE p.id = $1`, [req.valid.params.id]);
  res.json(p);
});

router.post('/:id/image', authorize('admin'), validate({ params: idParam }), upload.single('image'), async (req, res) => {
  if (!req.file) throw new AppError(422, 'File gambar wajib diunggah (field "image")');
  const { id } = req.valid.params;
  const { rowCount } = await db.query('SELECT 1 FROM products WHERE id = $1', [id]);
  if (!rowCount) throw new AppError(404, 'Produk tidak ditemukan');
  await db.query(`INSERT INTO product_images (product_id, mime_type, data, size, updated_at) VALUES ($1,$2,$3,$4,now())
    ON CONFLICT (product_id) DO UPDATE SET mime_type = EXCLUDED.mime_type, data = EXCLUDED.data, size = EXCLUDED.size, updated_at = now()`,
  [id, req.file.mimetype, req.file.buffer, req.file.size]);
  await db.query('UPDATE products SET has_image = true, updated_at = now() WHERE id = $1', [id]);
  const { rows: [p] } = await db.query(`${SELECT} WHERE p.id = $1`, [id]);
  res.json(p);
});

router.delete('/:id/image', authorize('admin'), validate({ params: idParam }), async (req, res) => {
  await db.query('DELETE FROM product_images WHERE product_id = $1', [req.valid.params.id]);
  await db.query('UPDATE products SET has_image = false, updated_at = now() WHERE id = $1', [req.valid.params.id]);
  res.json({ message: 'Gambar dihapus' });
});

router.delete('/:id', authorize('admin'), validate({ params: idParam }), async (req, res) => {
  const { id } = req.valid.params;
  const { rows: [used] } = await db.query('SELECT 1 FROM transaction_items WHERE product_id = $1 LIMIT 1', [id]);
  if (used) {
    await db.query('UPDATE products SET is_active = false, updated_at = now() WHERE id = $1', [id]);
    return res.json({ message: 'Produk sudah pernah terjual, jadi dinonaktifkan (tidak dihapus)' });
  }
  const { rowCount } = await db.query('DELETE FROM products WHERE id = $1', [id]);
  if (!rowCount) throw new AppError(404, 'Produk tidak ditemukan');
  res.json({ message: 'Produk dihapus' });
});

module.exports = router;
