const rupiah = (n) => 'Rp ' + Math.round(Number(n) || 0).toLocaleString('id-ID');

const dateTime = (d) =>
  new Date(d).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

module.exports = { rupiah, dateTime, esc };
