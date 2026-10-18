const env = require('../config/env');
const { rupiah, dateTime, esc } = require('../utils/format');

const methodLabel = (t) => (t.payment_method === 'cash' ? 'Tunai' : `Midtrans${t.payment_type ? ' - ' + t.payment_type.replace(/_/g, ' ').toUpperCase() : ''}`);
const statusLabel = { paid: 'LUNAS', pending: 'MENUNGGU PEMBAYARAN', failed: 'GAGAL', expired: 'KEDALUWARSA', cancelled: 'DIBATALKAN' };

function receiptHtml(t) {
  const rows = t.items.map((i) => `
    <tr>
      <td style="padding:6px 0">${esc(i.product_name)}<br><span style="color:#64748b;font-size:12px">${i.qty} x ${rupiah(i.price)}</span></td>
      <td style="padding:6px 0;text-align:right;vertical-align:top">${rupiah(i.subtotal)}</td>
    </tr>`).join('');
  const line = (label, value, bold) =>
    `<tr><td style="padding:3px 0;${bold ? 'font-weight:700;font-size:16px' : ''}">${label}</td><td style="padding:3px 0;text-align:right;${bold ? 'font-weight:700;font-size:16px' : ''}">${value}</td></tr>`;
  return `<!doctype html><html><body style="margin:0;background:#f1f5f9;font-family:Segoe UI,Arial,sans-serif;color:#0f172a">
  <div style="max-width:420px;margin:24px auto;background:#fff;border-radius:12px;padding:24px;border:1px solid #e2e8f0">
    <div style="text-align:center">
      <div style="font-size:20px;font-weight:700">${esc(env.store.name)}</div>
      <div style="color:#64748b;font-size:13px">${esc(env.store.address)}<br>Telp. ${esc(env.store.phone)}</div>
    </div>
    <hr style="border:none;border-top:1px dashed #cbd5e1;margin:16px 0">
    <table style="width:100%;font-size:13px;color:#475569">
      <tr><td>No. Invoice</td><td style="text-align:right;font-weight:600;color:#0f172a">${esc(t.invoice_no)}</td></tr>
      <tr><td>Tanggal</td><td style="text-align:right">${dateTime(t.created_at)}</td></tr>
      <tr><td>Kasir</td><td style="text-align:right">${esc(t.cashier_name || '-')}</td></tr>
      ${t.customer_name ? `<tr><td>Pelanggan</td><td style="text-align:right">${esc(t.customer_name)}</td></tr>` : ''}
    </table>
    <hr style="border:none;border-top:1px dashed #cbd5e1;margin:16px 0">
    <table style="width:100%;font-size:14px;border-collapse:collapse">${rows}</table>
    <hr style="border:none;border-top:1px dashed #cbd5e1;margin:16px 0">
    <table style="width:100%;font-size:14px">
      ${line('Subtotal', rupiah(t.subtotal))}
      ${Number(t.discount) ? line('Diskon', '- ' + rupiah(t.discount)) : ''}
      ${line(`PPN ${env.store.taxPercent}%`, rupiah(t.tax))}
      ${line('TOTAL', rupiah(t.total), true)}
      ${line('Metode', methodLabel(t))}
      ${t.cash_received ? line('Tunai', rupiah(t.cash_received)) + line('Kembali', rupiah(t.change_amount)) : ''}
    </table>
    <div style="margin-top:16px;text-align:center;padding:8px;border-radius:8px;font-weight:700;letter-spacing:1px;
      background:${t.payment_status === 'paid' ? '#dcfce7;color:#166534' : '#fef3c7;color:#92400e'}">${statusLabel[t.payment_status] || t.payment_status}</div>
    <p style="text-align:center;color:#64748b;font-size:12px;margin-top:20px">Terima kasih telah berbelanja!<br>Barang yang sudah dibeli tidak dapat ditukar.</p>
  </div></body></html>`;
}

function reportHtml(r) {
  const card = (label, value) => `<td style="padding:12px;background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0">
    <div style="color:#64748b;font-size:12px">${label}</div><div style="font-size:18px;font-weight:700">${value}</div></td>`;
  const top = r.topProducts.map((p, i) => `<tr><td style="padding:6px">${i + 1}. ${esc(p.product_name)}</td>
    <td style="padding:6px;text-align:right">${p.qty}</td><td style="padding:6px;text-align:right">${rupiah(p.revenue)}</td></tr>`).join('');
  const daily = r.daily.map((d) => `<tr><td style="padding:4px 6px">${d.date}</td><td style="padding:4px 6px;text-align:right">${d.transactions}</td>
    <td style="padding:4px 6px;text-align:right">${rupiah(d.revenue)}</td></tr>`).join('');
  const s = r.summary;
  return `<!doctype html><html><body style="margin:0;background:#f1f5f9;font-family:Segoe UI,Arial,sans-serif;color:#0f172a">
  <div style="max-width:640px;margin:24px auto;background:#fff;border-radius:12px;padding:24px;border:1px solid #e2e8f0">
    <h2 style="margin:0">Laporan Penjualan</h2>
    <div style="color:#64748b">${esc(env.store.name)} &middot; Periode ${r.range.from} s/d ${r.range.to}</div>
    <table style="width:100%;border-spacing:8px;margin:16px -8px"><tr>
      ${card('Omzet', rupiah(s.revenue))}${card('Transaksi', s.transactions)}${card('Rata-rata', rupiah(s.average))}
    </tr><tr>
      ${card('Item Terjual', s.items_sold)}${card('Laba Kotor', rupiah(s.gross_profit))}${card('Diskon', rupiah(s.discount))}
    </tr></table>
    <h3>Produk Terlaris</h3>
    <table style="width:100%;font-size:14px;border-collapse:collapse"><tr style="background:#f1f5f9"><th style="padding:6px;text-align:left">Produk</th>
      <th style="padding:6px;text-align:right">Qty</th><th style="padding:6px;text-align:right">Omzet</th></tr>${top}</table>
    <h3>Penjualan Harian</h3>
    <table style="width:100%;font-size:13px;border-collapse:collapse"><tr style="background:#f1f5f9"><th style="padding:4px 6px;text-align:left">Tanggal</th>
      <th style="padding:4px 6px;text-align:right">Transaksi</th><th style="padding:4px 6px;text-align:right">Omzet</th></tr>${daily}</table>
    <p style="color:#64748b;font-size:12px">Rincian lengkap terlampir dalam file CSV.</p>
  </div></body></html>`;
}

module.exports = { receiptHtml, reportHtml };
