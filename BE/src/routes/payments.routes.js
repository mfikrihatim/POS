const { z } = require('zod');
const env = require('../config/env');
const { validate, AppError } = require('../utils/http');
const trxService = require('../services/transaction.service');
const midtrans = require('../services/midtrans.service');
const { emailReceipt } = require('./transactions.routes');

const idParam = z.object({ id: z.coerce.number().int().positive() });

async function afterPaid(before, after) {
  // Kirim struk otomatis saat pembayaran non-tunai berubah menjadi lunas
  if (before.payment_status !== 'paid' && after.payment_status === 'paid' && after.customer_email) {
    await emailReceipt(after.id, after.customer_email).catch(() => null);
  }
}

// Webhook publik: Midtrans > Settings > Configuration > Payment Notification URL = https://<domain>/api/payments/midtrans/notification
const publicRouter = require('express').Router();
publicRouter.post('/midtrans/notification', async (req, res) => {
  const n = req.body || {};
  if (!env.midtrans.enabled) throw new AppError(503, 'Midtrans belum dikonfigurasi');
  if (!midtrans.verifySignature(n)) throw new AppError(403, 'Signature tidak valid');
  const before = await trxService.getDetail(n.order_id).catch(() => null);
  if (!before) return res.json({ message: 'Order tidak dikenal, diabaikan' });
  // Ambil ulang status dari API Midtrans agar tidak hanya percaya payload
  const status = await midtrans.getStatus(n.order_id);
  const after = await trxService.applyPaymentStatus(before.id, midtrans.mapStatus(status), status.payment_type);
  await afterPaid(before, after);
  res.json({ message: 'OK' });
});

const router = require('express').Router();

// Cek status ke Midtrans (berguna saat development karena webhook tidak bisa menjangkau localhost)
router.post('/:id/check', validate({ params: idParam }), async (req, res) => {
  const before = await trxService.getDetail(req.valid.params.id);
  if (before.payment_method !== 'midtrans') throw new AppError(422, 'Bukan transaksi Midtrans');
  if (before.payment_status !== 'pending' || !env.midtrans.enabled) return res.json(await trxService.getDetail(before.id));
  let status;
  try {
    status = await midtrans.getStatus(before.midtrans_order_id);
  } catch (err) {
    // 404 dari Midtrans = pelanggan belum memilih metode pembayaran
    if (String(err.httpStatusCode) === '404') return res.json(before);
    throw new AppError(502, `Gagal cek status Midtrans: ${err.message}`);
  }
  const after = await trxService.applyPaymentStatus(before.id, midtrans.mapStatus(status), status.payment_type);
  await afterPaid(before, after);
  res.json(await trxService.getDetail(before.id));
});

// Mode simulasi: hanya aktif jika key Midtrans belum diisi
router.post('/:id/simulate', validate({
  params: idParam,
  body: z.object({ status: z.enum(['paid', 'failed', 'expired']), payment_type: z.string().max(40).optional() }),
}), async (req, res) => {
  if (env.midtrans.enabled) throw new AppError(403, 'Simulasi dinonaktifkan karena Midtrans sudah dikonfigurasi');
  const before = await trxService.getDetail(req.valid.params.id);
  const after = await trxService.applyPaymentStatus(before.id, req.valid.body.status, req.valid.body.payment_type || 'qris');
  await afterPaid(before, after);
  res.json(await trxService.getDetail(before.id));
});

module.exports = { router, publicRouter };
