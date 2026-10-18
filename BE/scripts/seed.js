// Mengisi data dummy: pengguna, kategori, produk (+gambar SVG), stok, dan ~60 hari transaksi.
// Aman dijalankan ulang: seluruh data lama dihapus terlebih dahulu (TRUNCATE).
const bcrypt = require('bcryptjs');
const { pool } = require('../src/config/db');
const env = require('../src/config/env');

const DAYS = 60;
const TAX = env.store.taxPercent / 100;

const users = [
  { name: 'Administrator', email: 'admin@pos.test', password: 'admin123', role: 'admin' },
  { name: 'Siti Kasir', email: 'kasir@pos.test', password: 'kasir123', role: 'kasir' },
  { name: 'Budi Santoso', email: 'budi@pos.test', password: 'kasir123', role: 'kasir' },
  { name: 'Rina (nonaktif)', email: 'rina@pos.test', password: 'kasir123', role: 'kasir', is_active: false },
];

const categories = [
  { name: 'Minuman', description: 'Kopi, teh, jus, dan minuman kemasan', color: '#0ea5e9', icon: '🥤' },
  { name: 'Makanan', description: 'Makanan berat dan siap saji', color: '#f97316', icon: '🍛' },
  { name: 'Snack', description: 'Camilan dan makanan ringan', color: '#eab308', icon: '🍪' },
  { name: 'Roti & Kue', description: 'Roti, pastry, dan kue', color: '#a855f7', icon: '🥐' },
  { name: 'Kebutuhan Rumah', description: 'Sabun, tisu, dan kebutuhan harian', color: '#22c55e', icon: '🧴' },
  { name: 'Alat Tulis', description: 'ATK dan perlengkapan kantor', color: '#ef4444', icon: '✏️' },
];

// [kategori, nama, harga, modal, stok awal, min stok, unit]
const products = [
  ['Minuman', 'Kopi Susu Gula Aren', 22000, 9000, 120, 10, 'cup'],
  ['Minuman', 'Americano', 18000, 6000, 100, 10, 'cup'],
  ['Minuman', 'Cappuccino', 25000, 10000, 90, 10, 'cup'],
  ['Minuman', 'Es Teh Manis', 8000, 2500, 150, 15, 'cup'],
  ['Minuman', 'Matcha Latte', 28000, 12000, 60, 8, 'cup'],
  ['Minuman', 'Jus Alpukat', 20000, 9000, 50, 8, 'cup'],
  ['Minuman', 'Air Mineral 600ml', 5000, 2500, 200, 24, 'botol'],
  ['Minuman', 'Teh Botol Sosro', 6000, 3800, 140, 24, 'botol'],
  ['Makanan', 'Nasi Goreng Spesial', 30000, 14000, 70, 5, 'porsi'],
  ['Makanan', 'Mie Goreng Jawa', 27000, 12000, 60, 5, 'porsi'],
  ['Makanan', 'Ayam Geprek', 25000, 12000, 80, 5, 'porsi'],
  ['Makanan', 'Nasi Ayam Bakar', 32000, 16000, 50, 5, 'porsi'],
  ['Makanan', 'Soto Ayam', 23000, 10000, 45, 5, 'porsi'],
  ['Makanan', 'Indomie Kuah Telur', 15000, 6000, 90, 10, 'porsi'],
  ['Snack', 'Kentang Goreng', 18000, 7000, 70, 8, 'porsi'],
  ['Snack', 'Pisang Goreng Keju', 15000, 6000, 60, 8, 'porsi'],
  ['Snack', 'Chitato 68g', 11000, 8500, 80, 12, 'pcs'],
  ['Snack', 'Tango Wafer', 7000, 5000, 6, 12, 'pcs'],
  ['Snack', 'Kacang Garuda', 9000, 6500, 70, 12, 'pcs'],
  ['Snack', 'Roti Bakar Cokelat', 17000, 7000, 55, 8, 'porsi'],
  ['Roti & Kue', 'Croissant Butter', 19000, 8000, 40, 6, 'pcs'],
  ['Roti & Kue', 'Donat Gula', 8000, 3000, 80, 10, 'pcs'],
  ['Roti & Kue', 'Brownies Slice', 15000, 6000, 3, 6, 'pcs'],
  ['Roti & Kue', 'Cheesecake', 32000, 15000, 25, 4, 'slice'],
  ['Roti & Kue', 'Roti Sobek Cokelat', 16000, 9000, 35, 6, 'pcs'],
  ['Kebutuhan Rumah', 'Sabun Lifebuoy 85g', 5500, 3800, 90, 12, 'pcs'],
  ['Kebutuhan Rumah', 'Tisu Paseo 250s', 16000, 12000, 50, 10, 'pak'],
  ['Kebutuhan Rumah', 'Sunlight 755ml', 18000, 14000, 40, 8, 'botol'],
  ['Kebutuhan Rumah', 'Pasta Gigi Pepsodent', 13000, 9500, 4, 10, 'pcs'],
  ['Kebutuhan Rumah', 'Shampoo Clear 170ml', 27000, 21000, 30, 6, 'botol'],
  ['Alat Tulis', 'Pulpen Standard AE7', 3000, 1800, 150, 20, 'pcs'],
  ['Alat Tulis', 'Buku Tulis Sidu 38', 5000, 3500, 100, 20, 'pcs'],
  ['Alat Tulis', 'Pensil 2B Faber', 4000, 2500, 90, 20, 'pcs'],
  ['Alat Tulis', 'Penghapus Joyko', 2500, 1500, 0, 10, 'pcs'],
  ['Alat Tulis', 'Map Plastik', 3500, 2000, 70, 15, 'pcs'],
];

const customers = ['Andi', 'Dewi', 'Rizky', 'Putri', 'Fajar', 'Maya', 'Yoga', 'Lestari', 'Hendra', 'Nadia', null, null, null];

let seed = 20261018;
const rand = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const randInt = (a, b) => a + Math.floor(rand() * (b - a + 1));

function svgImage(name, color, icon) {
  const initials = name.split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${color}"/><stop offset="1" stop-color="${color}" stop-opacity="0.6"/></linearGradient></defs>
<rect width="400" height="300" fill="url(#g)"/>
<circle cx="330" cy="60" r="90" fill="#fff" fill-opacity="0.12"/><circle cx="60" cy="270" r="70" fill="#fff" fill-opacity="0.1"/>
<text x="200" y="150" font-size="96" text-anchor="middle" dominant-baseline="middle">${icon}</text>
<text x="200" y="250" font-family="Segoe UI, Arial, sans-serif" font-size="30" font-weight="700" fill="#fff" text-anchor="middle">${esc(initials)}</text>
</svg>`;
}

// INSERT banyak baris sekaligus: rows = array of arrays
async function bulkInsert(client, table, cols, rows, returning = '') {
  const out = [];
  const chunk = Math.floor(60000 / cols.length);
  for (let i = 0; i < rows.length; i += chunk) {
    const part = rows.slice(i, i + chunk);
    const params = [];
    const values = part.map((r) => `(${r.map((v) => { params.push(v); return '$' + params.length; }).join(',')})`);
    const res = await client.query(`INSERT INTO ${table} (${cols.join(',')}) VALUES ${values.join(',')} ${returning}`, params);
    out.push(...res.rows);
  }
  return out;
}

(async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`TRUNCATE email_logs, stock_movements, transaction_items, transactions, product_images,
      products, categories, users RESTART IDENTITY CASCADE`);

    // Pengguna
    const userRows = [];
    for (const u of users) {
      userRows.push([u.name, u.email, await bcrypt.hash(u.password, 10), u.role, u.is_active !== false]);
    }
    const insertedUsers = await bulkInsert(client, 'users', ['name', 'email', 'password_hash', 'role', 'is_active'], userRows, 'RETURNING id, role, is_active');
    const adminId = insertedUsers[0].id;
    const cashierIds = insertedUsers.filter((u) => u.is_active).map((u) => u.id);

    // Kategori
    const cats = await bulkInsert(client, 'categories', ['name', 'description'], categories.map((c) => [c.name, c.description]), 'RETURNING id, name');
    const catByName = Object.fromEntries(cats.map((c) => [c.name, c.id]));
    const catMeta = Object.fromEntries(categories.map((c) => [c.name, c]));

    // Produk: stok awal "dibuat" 61 hari lalu, lalu dikurangi penjualan
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - DAYS);
    const initialStock = products.map(([, , , , stock]) => stock);
    // Stok awal digelembungkan agar cukup untuk riwayat penjualan; stok akhir = nilai di tabel di atas
    const prodState = products.map((p, i) => ({
      idx: i, category: p[0], name: p[1], price: p[2], cost: p[3], targetStock: initialStock[i], minStock: p[5], unit: p[6], sold: 0,
    }));

    // Transaksi dummy
    const trx = [];
    const items = [];
    for (let d = 0; d <= DAYS; d++) {
      const day = new Date(start);
      day.setDate(day.getDate() + d);
      const weekend = [0, 6].includes(day.getDay());
      const count = d === DAYS ? randInt(4, 8) : randInt(weekend ? 6 : 3, weekend ? 12 : 8);
      for (let n = 0; n < count; n++) {
        const created = new Date(day);
        created.setHours(randInt(8, 21), randInt(0, 59), randInt(0, 59));
        if (created > new Date()) created.setTime(Date.now() - randInt(5, 120) * 60000);
        const lines = [];
        const used = new Set();
        for (let k = 0, m = randInt(1, 4); k < m; k++) {
          const p = pick(prodState);
          if (used.has(p.idx)) continue;
          used.add(p.idx);
          lines.push({ p, qty: randInt(1, 3) });
        }
        const subtotal = lines.reduce((s, l) => s + l.p.price * l.qty, 0);
        const discount = rand() < 0.15 ? Math.round(subtotal * 0.1 / 500) * 500 : 0;
        const tax = Math.round((subtotal - discount) * TAX);
        const total = subtotal - discount + tax;
        const midtrans = rand() < 0.35;
        let status = 'paid';
        if (midtrans) {
          const r = rand();
          if (r < 0.06) status = 'expired';
          else if (r < 0.1) status = 'failed';
          else if (d === DAYS && r < 0.25) status = 'pending';
        }
        const seq = String(trx.length + 1).padStart(4, '0');
        const ymd = created.toISOString().slice(0, 10).replace(/-/g, '');
        const invoice = `INV-${ymd}-${seq}`;
        const cashReceived = midtrans ? null : Math.ceil(total / 10000) * 10000 + (rand() < 0.3 ? 10000 : 0);
        const name = pick(customers);
        trx.push({
          invoice, cashier: pick(cashierIds), name, email: name ? `${name.toLowerCase()}@contoh.com` : null,
          subtotal, discount, tax, total, method: midtrans ? 'midtrans' : 'cash', status,
          type: midtrans ? pick(['qris', 'bank_transfer', 'gopay', 'shopeepay', 'credit_card']) : null,
          cashReceived, change: cashReceived ? cashReceived - total : null,
          orderId: midtrans ? `${invoice}-${randInt(1000, 9999)}` : null,
          paidAt: status === 'paid' ? new Date(created.getTime() + randInt(10, 300) * 1000) : null, created,
          lines,
        });
        if (status === 'paid') lines.forEach((l) => (l.p.sold += l.qty));
      }
    }

    // Insert produk dengan stok akhir = target
    const prodRows = prodState.map((p, i) => [
      `${p.category.slice(0, 3).toUpperCase()}-${String(i + 1).padStart(3, '0')}`, p.name,
      `${p.name} - produk pilihan ${p.category.toLowerCase()}.`, catByName[p.category], p.price, p.cost,
      p.targetStock, p.minStock, p.unit, true, start,
    ]);
    const insertedProducts = await bulkInsert(client, 'products',
      ['sku', 'name', 'description', 'category_id', 'price', 'cost', 'stock', 'min_stock', 'unit', 'has_image', 'created_at'],
      prodRows, 'RETURNING id, sku');
    prodState.forEach((p, i) => { p.id = insertedProducts[i].id; p.sku = insertedProducts[i].sku; });

    await bulkInsert(client, 'product_images', ['product_id', 'mime_type', 'data', 'size'], prodState.map((p) => {
      const buf = Buffer.from(svgImage(p.name, catMeta[p.category].color, catMeta[p.category].icon));
      return [p.id, 'image/svg+xml', buf, buf.length];
    }));

    // Transaksi
    const insertedTrx = await bulkInsert(client, 'transactions',
      ['invoice_no', 'cashier_id', 'customer_name', 'customer_email', 'subtotal', 'discount', 'tax', 'total', 'payment_method',
        'payment_status', 'payment_type', 'cash_received', 'change_amount', 'midtrans_order_id', 'paid_at', 'created_at', 'updated_at'],
      trx.map((t) => [t.invoice, t.cashier, t.name, t.email, t.subtotal, t.discount, t.tax, t.total, t.method, t.status, t.type,
        t.cashReceived, t.change, t.orderId, t.paidAt, t.created, t.paidAt || t.created]),
      'RETURNING id');
    trx.forEach((t, i) => { t.id = insertedTrx[i].id; });
    trx.forEach((t) => t.lines.forEach((l) => items.push([t.id, l.p.id, l.p.name, l.p.sku, l.p.price, l.p.cost, l.qty, l.p.price * l.qty])));
    await bulkInsert(client, 'transaction_items', ['transaction_id', 'product_id', 'product_name', 'sku', 'price', 'cost', 'qty', 'subtotal'], items);

    // Pergerakan stok: stok awal (in) lalu penjualan (sale) berurutan waktu
    const moves = [];
    const running = {};
    prodState.forEach((p) => {
      const opening = p.targetStock + p.sold;
      running[p.id] = opening;
      moves.push([p.id, 'in', opening, 0, opening, 'STOK-AWAL', 'Stok awal', adminId, start]);
    });
    trx.filter((t) => t.status === 'paid').sort((a, b) => a.created - b.created).forEach((t) => {
      t.lines.forEach((l) => {
        const before = running[l.p.id];
        running[l.p.id] = before - l.qty;
        moves.push([l.p.id, 'sale', -l.qty, before, before - l.qty, t.invoice, 'Penjualan', t.cashier, t.paidAt]);
      });
    });
    await bulkInsert(client, 'stock_movements', ['product_id', 'type', 'qty', 'stock_before', 'stock_after', 'reference', 'note', 'user_id', 'created_at'], moves);

    await client.query('COMMIT');
    console.log(`Seed selesai: ${users.length} pengguna, ${cats.length} kategori, ${prodState.length} produk, ${trx.length} transaksi, ${items.length} item, ${moves.length} pergerakan stok.`);
    console.log('Login demo -> admin@pos.test / admin123  |  kasir@pos.test / kasir123');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Seed gagal:', err.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
})();
