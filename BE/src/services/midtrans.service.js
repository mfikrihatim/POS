const crypto = require('crypto');
const midtransClient = require('midtrans-client');
const env = require('../config/env');

const opts = { isProduction: env.midtrans.isProduction, serverKey: env.midtrans.serverKey, clientKey: env.midtrans.clientKey };
const snap = env.midtrans.enabled ? new midtransClient.Snap(opts) : null;
const core = env.midtrans.enabled ? new midtransClient.CoreApi(opts) : null;

/** Buat Snap token untuk transaksi pending */
async function createSnap(trx, items) {
  const itemDetails = items.map((i) => ({ id: i.sku || String(i.product_id), name: i.product_name.slice(0, 50), price: Math.round(i.price), quantity: i.qty }));
  if (Number(trx.discount)) itemDetails.push({ id: 'DISCOUNT', name: 'Diskon', price: -Math.round(trx.discount), quantity: 1 });
  if (Number(trx.tax)) itemDetails.push({ id: 'TAX', name: `PPN ${env.store.taxPercent}%`, price: Math.round(trx.tax), quantity: 1 });

  return snap.createTransaction({
    transaction_details: { order_id: trx.midtrans_order_id, gross_amount: Math.round(trx.total) },
    item_details: itemDetails,
    customer_details: { first_name: trx.customer_name || 'Pelanggan', email: trx.customer_email || undefined },
    expiry: { unit: 'minutes', duration: 30 },
  });
}

const getStatus = (orderId) => core.transaction.status(orderId);

/** Verifikasi signature_key notifikasi: SHA512(order_id + status_code + gross_amount + server_key) */
function verifySignature(n) {
  const expected = crypto.createHash('sha512')
    .update(`${n.order_id}${n.status_code}${n.gross_amount}${env.midtrans.serverKey}`).digest('hex');
  return expected === n.signature_key;
}

/** Peta status Midtrans -> status internal */
function mapStatus(n) {
  const s = n.transaction_status;
  if (s === 'capture') return n.fraud_status === 'accept' ? 'paid' : 'pending';
  if (s === 'settlement') return 'paid';
  if (s === 'pending') return 'pending';
  if (s === 'expire') return 'expired';
  if (s === 'cancel') return 'cancelled';
  if (['deny', 'failure'].includes(s)) return 'failed';
  return 'pending';
}

module.exports = { createSnap, getStatus, verifySignature, mapStatus };
