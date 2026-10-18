const db = require('../config/db');
const env = require('../config/env');
const { AppError } = require('../utils/http');

const round = (n) => Math.round(n);

// Format: INV-YYYYMMDD-HHMMSS-XXX (WIB). Unik tanpa perlu query ke DB.
function nextInvoiceNo() {
  const now = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Jakarta' }); // "2026-10-18 23:59:01"
  const [d, t] = now.split(' ');
  return `INV-${d.replace(/-/g, '')}-${t.replace(/:/g, '')}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
}

/**
 * Checkout: validasi stok (dengan row lock), hitung total di server, simpan transaksi + item,
 * kurangi stok, catat stock_movements. Semua dalam satu DB transaction.
 * Tunai -> langsung "paid". Midtrans -> "pending" (stok di-reserve, dikembalikan jika gagal/expired).
 */
async function checkout(user, input) {
  return db.withTransaction(async (client) => {
    const ids = input.items.map((i) => i.product_id);
    if (new Set(ids).size !== ids.length) throw new AppError(422, 'Produk duplikat di keranjang');

    const { rows: products } = await client.query(
      'SELECT id, sku, name, price, cost, stock, is_active FROM products WHERE id = ANY($1::int[]) ORDER BY id FOR UPDATE', [ids]);
    const byId = new Map(products.map((p) => [p.id, p]));

    const lines = input.items.map((i) => {
      const p = byId.get(i.product_id);
      if (!p || !p.is_active) throw new AppError(422, `Produk #${i.product_id} tidak tersedia`);
      if (p.stock < i.qty) throw new AppError(422, `Stok "${p.name}" tidak cukup (tersisa ${p.stock})`);
      return { p, qty: i.qty, subtotal: Number(p.price) * i.qty };
    });

    const subtotal = lines.reduce((s, l) => s + l.subtotal, 0);
    const discount = Math.min(subtotal, round(input.discount || 0));
    const tax = round((subtotal - discount) * env.store.taxPercent / 100);
    const total = subtotal - discount + tax;

    let cashReceived = null;
    let change = null;
    if (input.payment_method === 'cash') {
      cashReceived = round(input.cash_received || 0);
      if (cashReceived < total) throw new AppError(422, `Uang tunai kurang. Total ${total}, diterima ${cashReceived}`);
      change = cashReceived - total;
    }

    const invoice = nextInvoiceNo();
    const isCash = input.payment_method === 'cash';
    const { rows: [trx] } = await client.query(
      `INSERT INTO transactions (invoice_no, cashier_id, customer_name, customer_email, subtotal, discount, tax, total,
        payment_method, payment_status, cash_received, change_amount, midtrans_order_id, note, paid_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
      [invoice, user.id, input.customer_name || null, input.customer_email || null, subtotal, discount, tax, total,
        input.payment_method, isCash ? 'paid' : 'pending', cashReceived, change, isCash ? null : invoice, input.note || null,
        isCash ? new Date() : null]);

    // Insert item, kurangi stok, dan catat pergerakan stok secara batch (1 query per langkah)
    const col = (fn) => lines.map(fn);
    await client.query(
      `INSERT INTO transaction_items (transaction_id, product_id, product_name, sku, price, cost, qty, subtotal)
       SELECT $1, * FROM unnest($2::int[], $3::text[], $4::text[], $5::numeric[], $6::numeric[], $7::int[], $8::numeric[])`,
      [trx.id, col((l) => l.p.id), col((l) => l.p.name), col((l) => l.p.sku), col((l) => l.p.price), col((l) => l.p.cost),
        col((l) => l.qty), col((l) => l.subtotal)]);
    await client.query(
      `UPDATE products p SET stock = p.stock - x.qty, updated_at = now()
       FROM unnest($1::int[], $2::int[]) AS x(id, qty) WHERE p.id = x.id`, [ids, col((l) => l.qty)]);
    await client.query(
      `INSERT INTO stock_movements (product_id, type, qty, stock_before, stock_after, reference, note, user_id)
       SELECT x.id, 'sale', -x.qty, x.before, x.before - x.qty, $4, $5, $6 FROM unnest($1::int[], $2::int[], $3::int[]) AS x(id, qty, before)`,
      [col((l) => l.p.id), col((l) => l.qty), col((l) => l.p.stock), invoice, isCash ? 'Penjualan' : 'Penjualan (menunggu pembayaran)', user.id]);
    // Detail lengkap dirakit di memori (hemat round-trip ke DB)
    const items = lines.map((l, i) => ({ id: i + 1, transaction_id: trx.id, product_id: l.p.id, product_name: l.p.name, sku: l.p.sku,
      price: Number(l.p.price), cost: Number(l.p.cost), qty: l.qty, subtotal: l.subtotal }));
    return { ...trx, cashier_name: user.name, items };
  });
}

async function getDetail(idOrInvoice) {
  const byId = /^\d+$/.test(String(idOrInvoice));
  const { rows: [trx] } = await db.query(
    `SELECT t.*, u.name AS cashier_name,
       COALESCE((SELECT json_agg(i ORDER BY i.id) FROM transaction_items i WHERE i.transaction_id = t.id), '[]') AS items
     FROM transactions t LEFT JOIN users u ON u.id = t.cashier_id
     WHERE ${byId ? 't.id = $1' : 't.invoice_no = $1 OR t.midtrans_order_id = $1'}`, [String(idOrInvoice)]);
  if (!trx) throw new AppError(404, 'Transaksi tidak ditemukan');
  return trx;
}

/** Ubah status pembayaran (dipanggil webhook / cek status / simulasi). Idempoten. */
async function applyPaymentStatus(trxId, status, paymentType) {
  return db.withTransaction(async (client) => {
    const { rows: [trx] } = await client.query('SELECT * FROM transactions WHERE id = $1 FOR UPDATE', [trxId]);
    if (!trx) throw new AppError(404, 'Transaksi tidak ditemukan');
    if (trx.payment_status !== 'pending' || status === 'pending') return trx; // sudah final

    if (['failed', 'expired', 'cancelled'].includes(status)) {
      const { rows: items } = await client.query('SELECT product_id, qty FROM transaction_items WHERE transaction_id = $1', [trx.id]);
      for (const it of items) {
        if (!it.product_id) continue;
        const { rows: [p] } = await client.query('UPDATE products SET stock = stock + $1, updated_at = now() WHERE id = $2 RETURNING stock', [it.qty, it.product_id]);
        if (!p) continue;
        await client.query(
          `INSERT INTO stock_movements (product_id, type, qty, stock_before, stock_after, reference, note)
           VALUES ($1,'return',$2,$3,$4,$5,$6)`, [it.product_id, it.qty, p.stock - it.qty, p.stock, trx.invoice_no, `Pembayaran ${status}, stok dikembalikan`]);
      }
    }
    const { rows: [updated] } = await client.query(
      `UPDATE transactions SET payment_status = $1::varchar, payment_type = COALESCE($2::varchar, payment_type),
        paid_at = CASE WHEN $1::varchar = 'paid' THEN now() ELSE paid_at END, updated_at = now() WHERE id = $3 RETURNING *`,
      [status, paymentType || null, trx.id]);
    return updated;
  });
}

module.exports = { checkout, getDetail, applyPaymentStatus };
