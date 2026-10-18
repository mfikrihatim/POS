const router = require('express').Router();
const { z } = require('zod');
const db = require('../config/db');
const env = require('../config/env');
const { validate, pageParams, pageMeta, sortClause, AppError } = require('../utils/http');
const trxService = require('../services/transaction.service');
const midtrans = require('../services/midtrans.service');
const { sendMail } = require('../services/mail.service');
const { receiptHtml } = require('../services/templates');

const optionalEmail = z.union([z.email('Format email pelanggan tidak valid').trim().toLowerCase(), z.literal(''), z.null()]).optional();

const checkoutSchema = z.object({
  items: z.array(z.object({
    product_id: z.coerce.number().int().positive(),
    qty: z.coerce.number().int().min(1, 'Qty minimal 1').max(999, 'Qty maksimal 999'),
  })).min(1, 'Keranjang masih kosong'),
  discount: z.coerce.number().min(0, 'Diskon tidak boleh negatif').default(0),
  payment_method: z.enum(['cash', 'midtrans'], { error: 'Metode pembayaran tidak valid' }),
  cash_received: z.coerce.number().min(0).optional(),
  customer_name: z.string().trim().max(100).optional().nullable(),
  customer_email: optionalEmail,
  note: z.string().trim().max(500).optional().nullable(),
  send_receipt: z.boolean().optional(),
}).refine((b) => b.payment_method !== 'cash' || b.cash_received !== undefined, { message: 'Jumlah uang tunai wajib diisi', path: ['cash_received'] })
  .refine((b) => !b.send_receipt || b.customer_email, { message: 'Email pelanggan wajib diisi untuk kirim struk', path: ['customer_email'] });

const idParam = z.object({ id: z.coerce.number().int().positive() });

// Kasir hanya boleh mengakses transaksinya sendiri
async function ownTransaction(req) {
  const t = await trxService.getDetail(req.valid.params.id);
  if (req.user.role === 'kasir' && t.cashier_id !== req.user.id) throw new AppError(403, 'Bukan transaksi Anda');
  return t;
}

async function emailReceipt(trxId, to) {
  const t = await trxService.getDetail(trxId);
  return sendMail({ to, subject: `Struk Belanja ${t.invoice_no} - ${env.store.name}`, html: receiptHtml(t), type: 'receipt', reference: t.invoice_no });
}

router.get('/', async (req, res) => {
  const { page, limit, offset } = pageParams(req.query);
  const params = [];
  const where = [];
  if (req.query.search) {
    params.push(`%${req.query.search}%`);
    where.push(`(t.invoice_no ILIKE $${params.length} OR t.customer_name ILIKE $${params.length})`);
  }
  if (req.query.status) { params.push(req.query.status); where.push(`t.payment_status = $${params.length}`); }
  if (req.query.method) { params.push(req.query.method); where.push(`t.payment_method = $${params.length}`); }
  if (req.query.from) { params.push(req.query.from); where.push(`(t.created_at AT TIME ZONE 'Asia/Jakarta')::date >= $${params.length}`); }
  if (req.query.to) { params.push(req.query.to); where.push(`(t.created_at AT TIME ZONE 'Asia/Jakarta')::date <= $${params.length}`); }
  // Kasir hanya melihat transaksinya sendiri
  if (req.user.role === 'kasir') { params.push(req.user.id); where.push(`t.cashier_id = $${params.length}`); }
  const w = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const order = sortClause(req.query, { created_at: 't.created_at', total: 't.total', invoice_no: 't.invoice_no' }, 't.created_at DESC');
  const [{ rows }, { rows: [c] }] = await Promise.all([
    db.query(`SELECT t.id, t.invoice_no, t.customer_name, t.customer_email, t.total, t.payment_method, t.payment_type, t.payment_status,
      t.created_at, t.paid_at, u.name AS cashier_name, (SELECT sum(qty)::int FROM transaction_items WHERE transaction_id = t.id) AS item_count
      FROM transactions t LEFT JOIN users u ON u.id = t.cashier_id ${w} ORDER BY ${order} LIMIT ${limit} OFFSET ${offset}`, params),
    db.query(`SELECT count(*)::int AS total FROM transactions t ${w}`, params),
  ]);
  res.json({ data: rows, meta: pageMeta(page, limit, c.total) });
});

router.get('/:id', validate({ params: idParam }), async (req, res) => {
  const t = await ownTransaction(req);
  res.json(t);
});

router.get('/:id/receipt', validate({ params: idParam }), async (req, res) => {
  const t = await ownTransaction(req);
  res.type('html').send(receiptHtml(t));
});

router.post('/', validate({ body: checkoutSchema }), async (req, res) => {
  const b = req.valid.body;
  const trx = await trxService.checkout(req.user, b);
  const result = { transaction: trx, payment: null, email: null };

  if (b.payment_method === 'midtrans') {
    if (env.midtrans.enabled) {
      try {
        const snap = await midtrans.createSnap(trx, result.transaction.items);
        await db.query('UPDATE transactions SET snap_token = $1, snap_redirect_url = $2 WHERE id = $3', [snap.token, snap.redirect_url, trx.id]);
        Object.assign(trx, { snap_token: snap.token, snap_redirect_url: snap.redirect_url });
        result.payment = { mode: 'midtrans', token: snap.token, redirect_url: snap.redirect_url, client_key: env.midtrans.clientKey, is_production: env.midtrans.isProduction };
      } catch (err) {
        await trxService.applyPaymentStatus(trx.id, 'failed');
        throw new AppError(502, `Gagal membuat pembayaran Midtrans: ${err.ApiResponse?.error_messages?.join(', ') || err.message}`);
      }
    } else {
      result.payment = { mode: 'simulation' };
    }
  } else if (b.send_receipt && b.customer_email) {
    result.email = await sendMail({ to: b.customer_email, subject: `Struk Belanja ${trx.invoice_no} - ${env.store.name}`,
      html: receiptHtml(trx), type: 'receipt', reference: trx.invoice_no });
  }
  res.status(201).json(result);
});

router.post('/:id/email', validate({ params: idParam, body: z.object({ email: z.email('Format email tidak valid').trim() }) }), async (req, res) => {
  const t = await ownTransaction(req);
  const email = await emailReceipt(t.id, req.valid.body.email);
  if (!t.customer_email) await db.query('UPDATE transactions SET customer_email = $1 WHERE id = $2', [req.valid.body.email, t.id]);
  if (email.status === 'failed') throw new AppError(502, `Email gagal dikirim: ${email.error}`);
  res.json({ message: email.status === 'sent' ? 'Struk terkirim ke email' : 'SMTP belum dikonfigurasi, struk disimpan di server', email });
});

router.post('/:id/cancel', validate({ params: idParam }), async (req, res) => {
  const t = await ownTransaction(req);
  if (t.payment_status !== 'pending') throw new AppError(422, 'Hanya transaksi pending yang bisa dibatalkan');
  await trxService.applyPaymentStatus(t.id, 'cancelled');
  res.json(await trxService.getDetail(t.id));
});

module.exports = { router, emailReceipt };
