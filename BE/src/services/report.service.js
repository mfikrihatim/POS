const db = require('../config/db');

const LOCAL = "(t.created_at AT TIME ZONE 'Asia/Jakarta')::date";

function resolveRange(q) {
  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Jakarta' });
  const d = new Date(today);
  d.setDate(d.getDate() - 29);
  return { from: q.from || d.toISOString().slice(0, 10), to: q.to || today };
}

async function salesReport(q) {
  const range = resolveRange(q);
  const p = [range.from, range.to];
  const where = `t.payment_status = 'paid' AND ${LOCAL} BETWEEN $1 AND $2`;

  const [summary, daily, top, byMethod, byCashier, byCategory] = await Promise.all([
    db.query(`SELECT count(*)::int AS transactions, COALESCE(sum(t.total),0) AS revenue, COALESCE(round(avg(t.total)),0) AS average,
      COALESCE(sum(t.discount),0) AS discount, COALESCE(sum(t.tax),0) AS tax,
      COALESCE((SELECT sum(i.qty) FROM transaction_items i JOIN transactions t ON t.id = i.transaction_id WHERE ${where}),0)::int AS items_sold,
      COALESCE((SELECT sum(i.subtotal - i.cost * i.qty) FROM transaction_items i JOIN transactions t ON t.id = i.transaction_id WHERE ${where}),0) AS gross_profit
      FROM transactions t WHERE ${where}`, p),
    db.query(`SELECT to_char(g.day, 'YYYY-MM-DD') AS date, COALESCE(x.transactions,0)::int AS transactions, COALESCE(x.revenue,0) AS revenue
      FROM generate_series($1::date, $2::date, '1 day') AS g(day)
      LEFT JOIN (SELECT ${LOCAL} AS day, count(*) AS transactions, sum(t.total) AS revenue FROM transactions t WHERE ${where} GROUP BY 1) x
      ON x.day = g.day ORDER BY g.day`, p),
    db.query(`SELECT i.product_name, sum(i.qty)::int AS qty, sum(i.subtotal) AS revenue FROM transaction_items i
      JOIN transactions t ON t.id = i.transaction_id WHERE ${where} GROUP BY i.product_name ORDER BY qty DESC, revenue DESC LIMIT 10`, p),
    db.query(`SELECT CASE WHEN t.payment_method = 'cash' THEN 'Tunai' ELSE COALESCE(t.payment_type,'midtrans') END AS method,
      count(*)::int AS transactions, sum(t.total) AS revenue FROM transactions t WHERE ${where} GROUP BY 1 ORDER BY revenue DESC`, p),
    db.query(`SELECT COALESCE(u.name,'-') AS cashier, count(*)::int AS transactions, sum(t.total) AS revenue FROM transactions t
      LEFT JOIN users u ON u.id = t.cashier_id WHERE ${where} GROUP BY 1 ORDER BY revenue DESC`, p),
    db.query(`SELECT COALESCE(c.name,'Tanpa Kategori') AS category, sum(i.qty)::int AS qty, sum(i.subtotal) AS revenue FROM transaction_items i
      JOIN transactions t ON t.id = i.transaction_id LEFT JOIN products pr ON pr.id = i.product_id
      LEFT JOIN categories c ON c.id = pr.category_id WHERE ${where} GROUP BY 1 ORDER BY revenue DESC`, p),
  ]);

  return {
    range,
    summary: summary.rows[0],
    daily: daily.rows,
    topProducts: top.rows,
    byMethod: byMethod.rows,
    byCashier: byCashier.rows,
    byCategory: byCategory.rows,
  };
}

async function transactionsCsv(q) {
  const range = resolveRange(q);
  const { rows } = await db.query(
    `SELECT t.invoice_no, to_char(t.created_at AT TIME ZONE 'Asia/Jakarta', 'YYYY-MM-DD HH24:MI') AS waktu, u.name AS kasir,
      t.customer_name, t.payment_method, t.payment_type, t.payment_status, t.subtotal, t.discount, t.tax, t.total
     FROM transactions t LEFT JOIN users u ON u.id = t.cashier_id
     WHERE ${LOCAL} BETWEEN $1 AND $2 ORDER BY t.created_at`, [range.from, range.to]);
  const header = ['Invoice', 'Waktu', 'Kasir', 'Pelanggan', 'Metode', 'Tipe', 'Status', 'Subtotal', 'Diskon', 'Pajak', 'Total'];
  const cell = (v) => (v === null || v === undefined ? '' : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
  const lines = rows.map((r) => [r.invoice_no, r.waktu, r.kasir, r.customer_name, r.payment_method, r.payment_type, r.payment_status,
    r.subtotal, r.discount, r.tax, r.total].map(cell).join(','));
  return { range, csv: '﻿' + [header.join(','), ...lines].join('\n') };
}

module.exports = { salesReport, transactionsCsv, resolveRange };
