// Spesifikasi OpenAPI 3 untuk POS API (ditampilkan dengan Swagger UI di /api/docs)

const ref = (name) => ({ $ref: `#/components/schemas/${name}` });
const json = (schema, example) => ({ content: { 'application/json': { schema, ...(example ? { example } : {}) } } });
const ok = (schema, description = 'Berhasil') => ({ description, ...json(schema) });
const paged = (item) => ({ type: 'object', properties: { data: { type: 'array', items: ref(item) }, meta: ref('PageMeta') } });
const err = (description) => ({ description, ...json(ref('Error')) });
const idParam = { name: 'id', in: 'path', required: true, schema: { type: 'integer' } };
const q = (name, schema, description) => ({ name, in: 'query', schema, description });
const pageParams = [
  q('page', { type: 'integer', default: 1, minimum: 1 }, 'Nomor halaman'),
  q('limit', { type: 'integer', default: 10, maximum: 100 }, 'Jumlah data per halaman'),
  q('search', { type: 'string' }, 'Kata kunci pencarian'),
];
const sortParam = (fields) => q('sort', { type: 'string', example: `${fields[0]}:asc` }, `Format field:asc|desc. Field: ${fields.join(', ')}`);
const dateRange = [q('from', { type: 'string', format: 'date' }, 'Tanggal awal (YYYY-MM-DD)'), q('to', { type: 'string', format: 'date' }, 'Tanggal akhir (YYYY-MM-DD)')];
const common = { 401: err('Belum login / token tidak valid'), 422: err('Data tidak valid') };
const admin = { ...common, 403: err('Khusus admin') };

const spec = {
  openapi: '3.0.3',
  info: {
    title: 'POS API',
    version: '1.0.0',
    description: [
      'REST API aplikasi **Point of Sale** (Node.js + Express + PostgreSQL).',
      '',
      '**Cara mencoba:** jalankan `POST /api/auth/login` dengan akun demo, salin `token`, klik tombol **Authorize**, lalu tempel token tersebut.',
      '',
      'Akun demo: `admin@pos.test` / `admin123` (admin) · `kasir@pos.test` / `kasir123` (kasir).',
      '',
      'Format list: `{ data: [...], meta: { page, limit, total, totalPages } }` · Format error: `{ message, details?: [{ field, message }] }`.',
    ].join('\n'),
  },
  servers: [{ url: '/', description: 'Server saat ini' }],
  tags: [
    { name: 'Auth', description: 'Login & profil' },
    { name: 'Users', description: 'Akun & Akses (admin)' },
    { name: 'Categories', description: 'Kategori produk' },
    { name: 'Products', description: 'Katalog produk & gambar' },
    { name: 'Stock', description: 'Manajemen stok' },
    { name: 'Transactions', description: 'Checkout, riwayat & struk' },
    { name: 'Payments', description: 'Midtrans: cek status, simulasi, webhook' },
    { name: 'Reports', description: 'Laporan penjualan (admin)' },
    { name: 'System', description: 'Health & konfigurasi publik' },
  ],
  components: {
    securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          message: { type: 'string', example: 'Data tidak valid' },
          details: { type: 'array', items: { type: 'object', properties: { field: { type: 'string' }, message: { type: 'string' } } } },
        },
      },
      PageMeta: {
        type: 'object',
        properties: { page: { type: 'integer', example: 1 }, limit: { type: 'integer', example: 10 }, total: { type: 'integer', example: 35 }, totalPages: { type: 'integer', example: 4 } },
      },
      User: {
        type: 'object',
        properties: {
          id: { type: 'integer' }, name: { type: 'string' }, email: { type: 'string' }, role: { type: 'string', enum: ['admin', 'kasir'] },
          is_active: { type: 'boolean' }, last_login_at: { type: 'string', format: 'date-time', nullable: true }, created_at: { type: 'string', format: 'date-time' },
        },
      },
      UserInput: {
        type: 'object', required: ['name', 'email', 'role'],
        properties: {
          name: { type: 'string', example: 'Kasir Baru' }, email: { type: 'string', example: 'kasir2@pos.test' },
          password: { type: 'string', minLength: 6, example: 'rahasia123', description: 'Wajib saat membuat; kosongkan saat update jika tidak diubah' },
          role: { type: 'string', enum: ['admin', 'kasir'] }, is_active: { type: 'boolean' },
        },
      },
      Category: { type: 'object', properties: { id: { type: 'integer' }, name: { type: 'string' }, description: { type: 'string', nullable: true }, product_count: { type: 'integer' } } },
      CategoryInput: { type: 'object', required: ['name'], properties: { name: { type: 'string', example: 'Frozen Food' }, description: { type: 'string' } } },
      Product: {
        type: 'object',
        properties: {
          id: { type: 'integer' }, sku: { type: 'string', example: 'MIN-001' }, name: { type: 'string', example: 'Kopi Susu Gula Aren' },
          description: { type: 'string', nullable: true }, category_id: { type: 'integer' }, category_name: { type: 'string' },
          price: { type: 'number', example: 22000 }, cost: { type: 'number', example: 9000 }, stock: { type: 'integer', example: 120 },
          min_stock: { type: 'integer', example: 10 }, unit: { type: 'string', example: 'cup' }, is_active: { type: 'boolean' },
          has_image: { type: 'boolean' }, image_url: { type: 'string', nullable: true, example: '/api/products/1/image?v=1792342338' },
        },
      },
      ProductInput: {
        type: 'object', required: ['sku', 'name', 'category_id', 'price'],
        properties: {
          sku: { type: 'string', example: 'SNA-099' }, name: { type: 'string', example: 'Keripik Singkong' }, description: { type: 'string' },
          category_id: { type: 'integer', example: 3 }, price: { type: 'number', example: 12000 }, cost: { type: 'number', example: 8000 },
          stock: { type: 'integer', example: 50, description: 'Hanya dipakai saat membuat produk (stok awal)' },
          min_stock: { type: 'integer', example: 10 }, unit: { type: 'string', example: 'pcs' }, is_active: { type: 'boolean' },
        },
      },
      StockSummary: {
        type: 'object',
        properties: { products: { type: 'integer' }, units: { type: 'integer' }, stock_value: { type: 'number' }, low_stock: { type: 'integer' }, out_of_stock: { type: 'integer' } },
      },
      StockMovement: {
        type: 'object',
        properties: {
          id: { type: 'integer' }, product_id: { type: 'integer' }, product_name: { type: 'string' },
          type: { type: 'string', enum: ['in', 'out', 'adjustment', 'sale', 'return'] }, qty: { type: 'integer' },
          stock_before: { type: 'integer' }, stock_after: { type: 'integer' }, reference: { type: 'string', nullable: true },
          note: { type: 'string', nullable: true }, user_name: { type: 'string', nullable: true }, created_at: { type: 'string', format: 'date-time' },
        },
      },
      StockMovementInput: {
        type: 'object', required: ['product_id', 'type', 'qty'],
        properties: {
          product_id: { type: 'integer', example: 1 }, type: { type: 'string', enum: ['in', 'out', 'adjustment'] },
          qty: { type: 'integer', example: 24, description: 'in/out: jumlah; adjustment: stok fisik hasil opname' },
          reference: { type: 'string', example: 'PO-0012' }, note: { type: 'string', example: 'Restok supplier' },
        },
      },
      TransactionItem: {
        type: 'object',
        properties: { product_id: { type: 'integer' }, product_name: { type: 'string' }, sku: { type: 'string' }, price: { type: 'number' }, qty: { type: 'integer' }, subtotal: { type: 'number' } },
      },
      Transaction: {
        type: 'object',
        properties: {
          id: { type: 'integer' }, invoice_no: { type: 'string', example: 'INV-20261019-101500-ABC' }, cashier_name: { type: 'string' },
          customer_name: { type: 'string', nullable: true }, customer_email: { type: 'string', nullable: true },
          subtotal: { type: 'number' }, discount: { type: 'number' }, tax: { type: 'number' }, total: { type: 'number' },
          payment_method: { type: 'string', enum: ['cash', 'midtrans'] },
          payment_status: { type: 'string', enum: ['pending', 'paid', 'failed', 'expired', 'cancelled'] },
          payment_type: { type: 'string', nullable: true, example: 'qris' }, cash_received: { type: 'number', nullable: true },
          change_amount: { type: 'number', nullable: true }, snap_token: { type: 'string', nullable: true },
          created_at: { type: 'string', format: 'date-time' }, paid_at: { type: 'string', format: 'date-time', nullable: true },
          items: { type: 'array', items: ref('TransactionItem') },
        },
      },
      CheckoutInput: {
        type: 'object', required: ['items', 'payment_method'],
        properties: {
          items: { type: 'array', minItems: 1, items: { type: 'object', required: ['product_id', 'qty'], properties: { product_id: { type: 'integer' }, qty: { type: 'integer', minimum: 1 } } } },
          discount: { type: 'number', default: 0 },
          payment_method: { type: 'string', enum: ['cash', 'midtrans'] },
          cash_received: { type: 'number', description: 'Wajib untuk tunai, harus ≥ total' },
          customer_name: { type: 'string' }, customer_email: { type: 'string' },
          send_receipt: { type: 'boolean', description: 'Kirim struk ke customer_email (tunai)' }, note: { type: 'string' },
        },
      },
      CheckoutResult: {
        type: 'object',
        properties: {
          transaction: ref('Transaction'),
          payment: { type: 'object', nullable: true, description: 'Midtrans: { mode: "midtrans", token, redirect_url } · tanpa key: { mode: "simulation" }' },
          email: { type: 'object', nullable: true },
        },
      },
      SalesReport: {
        type: 'object',
        properties: {
          range: { type: 'object', properties: { from: { type: 'string' }, to: { type: 'string' } } },
          summary: {
            type: 'object',
            properties: {
              transactions: { type: 'integer' }, revenue: { type: 'number' }, average: { type: 'number' }, discount: { type: 'number' },
              tax: { type: 'number' }, items_sold: { type: 'integer' }, gross_profit: { type: 'number' },
            },
          },
          daily: { type: 'array', items: { type: 'object', properties: { date: { type: 'string' }, transactions: { type: 'integer' }, revenue: { type: 'number' } } } },
          topProducts: { type: 'array', items: { type: 'object', properties: { product_name: { type: 'string' }, qty: { type: 'integer' }, revenue: { type: 'number' } } } },
          byMethod: { type: 'array', items: { type: 'object' } },
          byCashier: { type: 'array', items: { type: 'object' } },
          byCategory: { type: 'array', items: { type: 'object' } },
        },
      },
      Message: { type: 'object', properties: { message: { type: 'string' } } },
    },
  },
  security: [{ bearerAuth: [] }],
  paths: {
    // ===== System =====
    '/api/health': { get: { tags: ['System'], summary: 'Health check (cek koneksi DB)', security: [], responses: { 200: ok({ type: 'object', properties: { status: { type: 'string', example: 'ok' }, time: { type: 'string' } } }) } } },
    '/api/config': { get: { tags: ['System'], summary: 'Konfigurasi publik (toko, status Midtrans & SMTP)', security: [], responses: { 200: ok({ type: 'object' }) } } },

    // ===== Auth =====
    '/api/auth/login': {
      post: {
        tags: ['Auth'], summary: 'Login dan dapatkan JWT', security: [],
        requestBody: { required: true, ...json({ type: 'object', required: ['email', 'password'], properties: { email: { type: 'string' }, password: { type: 'string' } } }, { email: 'admin@pos.test', password: 'admin123' }) },
        responses: { 200: ok({ type: 'object', properties: { token: { type: 'string' }, user: ref('User') } }), 401: err('Email atau password salah'), 403: err('Akun nonaktif'), 422: err('Data tidak valid') },
      },
    },
    '/api/auth/me': { get: { tags: ['Auth'], summary: 'Profil user yang sedang login', responses: { 200: ok({ type: 'object', properties: { user: ref('User') } }), ...common } } },
    '/api/auth/password': {
      put: {
        tags: ['Auth'], summary: 'Ganti password',
        requestBody: { required: true, ...json({ type: 'object', required: ['current_password', 'new_password'], properties: { current_password: { type: 'string' }, new_password: { type: 'string', minLength: 6 } } }) },
        responses: { 200: ok(ref('Message')), ...common },
      },
    },

    // ===== Users =====
    '/api/users': {
      get: { tags: ['Users'], summary: 'Daftar pengguna (paginasi)', parameters: [...pageParams, q('role', { type: 'string', enum: ['admin', 'kasir'] }), sortParam(['name', 'email', 'role', 'created_at'])], responses: { 200: ok(paged('User')), ...admin } },
      post: { tags: ['Users'], summary: 'Tambah pengguna', requestBody: { required: true, ...json(ref('UserInput')) }, responses: { 201: ok(ref('User'), 'Dibuat'), 409: err('Email sudah dipakai'), ...admin } },
    },
    '/api/users/{id}': {
      put: { tags: ['Users'], summary: 'Ubah pengguna', parameters: [idParam], requestBody: { required: true, ...json(ref('UserInput')) }, responses: { 200: ok(ref('User')), 404: err('Tidak ditemukan'), ...admin } },
      delete: { tags: ['Users'], summary: 'Hapus pengguna (dinonaktifkan jika punya transaksi)', parameters: [idParam], responses: { 200: ok(ref('Message')), 404: err('Tidak ditemukan'), ...admin } },
    },

    // ===== Categories =====
    '/api/categories': {
      get: { tags: ['Categories'], summary: 'Daftar kategori + jumlah produk', responses: { 200: ok({ type: 'array', items: ref('Category') }), ...common } },
      post: { tags: ['Categories'], summary: 'Tambah kategori (admin)', requestBody: { required: true, ...json(ref('CategoryInput')) }, responses: { 201: ok(ref('Category'), 'Dibuat'), 409: err('Nama sudah ada'), ...admin } },
    },
    '/api/categories/{id}': {
      put: { tags: ['Categories'], summary: 'Ubah kategori (admin)', parameters: [idParam], requestBody: { required: true, ...json(ref('CategoryInput')) }, responses: { 200: ok(ref('Category')), 404: err('Tidak ditemukan'), ...admin } },
      delete: { tags: ['Categories'], summary: 'Hapus kategori (admin)', parameters: [idParam], responses: { 200: ok(ref('Message')), 404: err('Tidak ditemukan'), ...admin } },
    },

    // ===== Products =====
    '/api/products': {
      get: {
        tags: ['Products'], summary: 'Daftar produk (paginasi, filter, sort)',
        parameters: [...pageParams, q('category_id', { type: 'integer' }), q('status', { type: 'string', enum: ['active', 'inactive'] }),
          q('stock', { type: 'string', enum: ['available', 'low', 'out', 'alert'] }, 'Filter stok'), sortParam(['name', 'price', 'stock', 'sku', 'category', 'created_at'])],
        responses: { 200: ok(paged('Product')), ...common },
      },
      post: { tags: ['Products'], summary: 'Tambah produk (admin)', requestBody: { required: true, ...json(ref('ProductInput')) }, responses: { 201: ok(ref('Product'), 'Dibuat'), 409: err('SKU sudah ada'), ...admin } },
    },
    '/api/products/{id}': {
      get: { tags: ['Products'], summary: 'Detail produk', parameters: [idParam], responses: { 200: ok(ref('Product')), 404: err('Tidak ditemukan'), ...common } },
      put: { tags: ['Products'], summary: 'Ubah produk (admin, stok tidak diubah di sini)', parameters: [idParam], requestBody: { required: true, ...json(ref('ProductInput')) }, responses: { 200: ok(ref('Product')), 404: err('Tidak ditemukan'), ...admin } },
      delete: { tags: ['Products'], summary: 'Hapus produk (dinonaktifkan jika sudah pernah terjual)', parameters: [idParam], responses: { 200: ok(ref('Message')), 404: err('Tidak ditemukan'), ...admin } },
    },
    '/api/products/{id}/image': {
      get: { tags: ['Products'], summary: 'Ambil gambar produk (publik)', security: [], parameters: [idParam], responses: { 200: { description: 'File gambar', content: { 'image/*': { schema: { type: 'string', format: 'binary' } } } }, 404: err('Tidak ada gambar') } },
      post: {
        tags: ['Products'], summary: 'Upload / ganti gambar produk (admin, JPG/PNG/WEBP maks 2 MB)', parameters: [idParam],
        requestBody: { required: true, content: { 'multipart/form-data': { schema: { type: 'object', required: ['image'], properties: { image: { type: 'string', format: 'binary' } } } } } },
        responses: { 200: ok(ref('Product')), ...admin },
      },
      delete: { tags: ['Products'], summary: 'Hapus gambar produk (admin)', parameters: [idParam], responses: { 200: ok(ref('Message')), ...admin } },
    },

    // ===== Stock =====
    '/api/stock/summary': { get: { tags: ['Stock'], summary: 'Ringkasan stok', responses: { 200: ok(ref('StockSummary')), ...common } } },
    '/api/stock/movements': {
      get: {
        tags: ['Stock'], summary: 'Riwayat pergerakan stok (paginasi)',
        parameters: [...pageParams, q('product_id', { type: 'integer' }), q('type', { type: 'string', enum: ['in', 'out', 'adjustment', 'sale', 'return'] })],
        responses: { 200: ok(paged('StockMovement')), ...common },
      },
      post: { tags: ['Stock'], summary: 'Catat barang masuk / keluar / stock opname (admin)', requestBody: { required: true, ...json(ref('StockMovementInput')) }, responses: { 201: ok(ref('StockMovement'), 'Dicatat'), 404: err('Produk tidak ditemukan'), ...admin } },
    },

    // ===== Transactions =====
    '/api/transactions': {
      get: {
        tags: ['Transactions'], summary: 'Riwayat transaksi (kasir hanya melihat miliknya)',
        parameters: [...pageParams, q('status', { type: 'string', enum: ['pending', 'paid', 'failed', 'expired', 'cancelled'] }),
          q('method', { type: 'string', enum: ['cash', 'midtrans'] }), ...dateRange, sortParam(['created_at', 'total', 'invoice_no'])],
        responses: { 200: ok(paged('Transaction')), ...common },
      },
      post: {
        tags: ['Transactions'], summary: 'Checkout (buat transaksi, kurangi stok)',
        description: 'Harga & total dihitung di server. Proses berjalan dalam satu DB transaction dengan row lock pada produk. Tunai → langsung `paid`; Midtrans → `pending` + Snap token (atau mode simulasi).',
        requestBody: { required: true, ...json(ref('CheckoutInput'), { items: [{ product_id: 1, qty: 2 }, { product_id: 4, qty: 1 }], payment_method: 'cash', cash_received: 100000, customer_name: 'Andi' }) },
        responses: { 201: ok(ref('CheckoutResult'), 'Transaksi dibuat'), 502: err('Gagal membuat pembayaran Midtrans'), ...common },
      },
    },
    '/api/transactions/{id}': { get: { tags: ['Transactions'], summary: 'Detail transaksi + item', parameters: [idParam], responses: { 200: ok(ref('Transaction')), 403: err('Bukan transaksi Anda'), 404: err('Tidak ditemukan'), ...common } } },
    '/api/transactions/{id}/receipt': { get: { tags: ['Transactions'], summary: 'Struk dalam format HTML', parameters: [idParam], responses: { 200: { description: 'HTML struk', content: { 'text/html': {} } }, ...common } } },
    '/api/transactions/{id}/email': {
      post: {
        tags: ['Transactions'], summary: 'Kirim struk ke email', parameters: [idParam],
        requestBody: { required: true, ...json({ type: 'object', required: ['email'], properties: { email: { type: 'string', example: 'pelanggan@contoh.com' } } }) },
        responses: { 200: ok(ref('Message')), 502: err('Email gagal dikirim'), ...common },
      },
    },
    '/api/transactions/{id}/cancel': { post: { tags: ['Transactions'], summary: 'Batalkan transaksi pending (stok dikembalikan)', parameters: [idParam], responses: { 200: ok(ref('Transaction')), ...common } } },

    // ===== Payments =====
    '/api/payments/{id}/check': { post: { tags: ['Payments'], summary: 'Cek status pembayaran ke Midtrans', parameters: [idParam], responses: { 200: ok(ref('Transaction')), ...common } } },
    '/api/payments/{id}/simulate': {
      post: {
        tags: ['Payments'], summary: 'Simulasi hasil pembayaran (hanya jika key Midtrans kosong)', parameters: [idParam],
        requestBody: { required: true, ...json({ type: 'object', required: ['status'], properties: { status: { type: 'string', enum: ['paid', 'failed', 'expired'] }, payment_type: { type: 'string', example: 'qris' } } }) },
        responses: { 200: ok(ref('Transaction')), 403: err('Midtrans sudah dikonfigurasi'), ...common },
      },
    },
    '/api/payments/midtrans/notification': {
      post: {
        tags: ['Payments'], summary: 'Webhook notifikasi Midtrans', security: [],
        description: 'Dipanggil oleh Midtrans. `signature_key` diverifikasi (SHA512(order_id + status_code + gross_amount + server_key)) lalu status dicek ulang ke API Midtrans.',
        requestBody: { required: true, ...json({ type: 'object', properties: { order_id: { type: 'string' }, status_code: { type: 'string' }, gross_amount: { type: 'string' }, signature_key: { type: 'string' }, transaction_status: { type: 'string' } } }) },
        responses: { 200: ok(ref('Message')), 403: err('Signature tidak valid'), 503: err('Midtrans belum dikonfigurasi') },
      },
    },

    // ===== Reports =====
    '/api/reports/sales': { get: { tags: ['Reports'], summary: 'Laporan penjualan (default 30 hari terakhir)', parameters: dateRange, responses: { 200: ok(ref('SalesReport')), ...admin } } },
    '/api/reports/sales.csv': { get: { tags: ['Reports'], summary: 'Export transaksi ke CSV', parameters: dateRange, responses: { 200: { description: 'File CSV', content: { 'text/csv': { schema: { type: 'string' } } } }, ...admin } } },
    '/api/reports/sales/email': {
      post: {
        tags: ['Reports'], summary: 'Kirim laporan (HTML + lampiran CSV) ke email',
        requestBody: { required: true, ...json({ type: 'object', required: ['email'], properties: { email: { type: 'string', example: 'owner@contoh.com' }, from: { type: 'string', format: 'date' }, to: { type: 'string', format: 'date' } } }) },
        responses: { 200: ok(ref('Message')), 502: err('Email gagal dikirim'), ...admin },
      },
    },
  },
};

module.exports = spec;
