# POS – Point of Sale

Aplikasi kasir (Point of Sale) full-stack untuk portfolio:

- **FE** – Angular 22 (standalone components, signals, reactive forms, lazy routes, Chart.js)
- **BE** – Node.js + Express 5 (REST API, JWT, Zod validation, Multer, Nodemailer, Midtrans)
- **DB** – PostgreSQL (migrasi SQL + seed data dummy)

```
POS/
├── BE/                 # Backend Express
│   ├── railway.json    # config service pos-be
│   ├── migrations/     # Skema database (SQL)
│   ├── scripts/        # create-db, migrate, seed
│   └── src/
│       ├── config/     # env & koneksi DB
│       ├── middleware/ # auth JWT + role
│       ├── routes/     # auth, users, categories, products, stock, transactions, payments, reports
│       ├── services/   # transaksi, Midtrans, email, laporan, template struk
│       └── utils/
├── FE/                 # Frontend Angular (+ server.js & railway.json untuk service pos-fe)
│   └── src/app/
│       ├── core/       # api, auth, guard, interceptor, model
│       ├── shared/     # pagination, modal, struk, pipes
│       ├── layout/     # sidebar + topbar
│       └── pages/      # login, kasir, transaksi, produk, stok, laporan, pengguna
└── package.json        # script bantu (install, build, dev)
```

## Fitur

| Modul | Isi |
|---|---|
| **Layar Kasir** | Grid produk + pencarian (debounce), filter kategori, pagination, keranjang (qty, validasi stok), diskon, PPN, checkout tunai (uang diterima, kembalian, tombol uang cepat) & Midtrans |
| **Katalog Produk** | CRUD produk & kategori, **upload gambar** (JPG/PNG/WEBP maks 2 MB, divalidasi di FE & BE), filter, sort, pagination, soft-delete produk yang sudah pernah terjual |
| **Pembayaran & Struk** | Riwayat transaksi (filter status/metode/tanggal), struk digital, cetak struk, **kirim struk via email**, cek status Midtrans, batalkan transaksi pending |
| **Manajemen Stok** | Ringkasan stok, daftar stok menipis/habis, barang masuk / keluar / stock opname, riwayat pergerakan stok (audit trail) |
| **Laporan Penjualan** | Omzet, jumlah transaksi, rata-rata, item terjual, laba kotor, grafik harian, metode pembayaran, produk terlaris, per kategori, per kasir, **export CSV**, **kirim laporan via email** (HTML + lampiran CSV) |
| **Akun & Akses** | Login JWT, role **admin** & **kasir** (guard di FE + middleware di BE), CRUD pengguna, nonaktifkan akun |

### Alur transaksi (yang bisa didemokan)

1. Kasir memilih produk → keranjang → **Bayar**.
2. Server menghitung ulang total (harga diambil dari DB, bukan dari client), mengunci baris produk (`SELECT … FOR UPDATE`), memvalidasi stok, menyimpan transaksi + item, mengurangi stok, dan mencatat `stock_movements` – **semua dalam satu DB transaction**.
3. **Tunai** → status langsung `paid`, struk tampil, opsional dikirim ke email.
4. **Midtrans** → status `pending`, stok di-reserve, Snap popup terbuka. Setelah bayar, status diperbarui lewat **webhook** (signature SHA-512 diverifikasi + status dicek ulang ke API Midtrans) atau tombol **Cek Status**. Jika `expire/cancel/deny`, **stok otomatis dikembalikan** (tipe `return`). Struk dikirim otomatis ke email pelanggan saat lunas.

### Validasi

- FE: reactive forms (required, min, pattern, email), validasi stok di keranjang, uang tunai ≥ total, tipe & ukuran gambar.
- BE: schema **Zod** di setiap endpoint (pesan error per field, HTTP 422), constraint DB (`CHECK stock >= 0`, `UNIQUE sku/email`), whitelist kolom sort (anti SQL injection), query terparameter.

### Pagination

Semua list memakai format yang sama: `?page=1&limit=10&search=&sort=field:asc|desc` → `{ data: [...], meta: { page, limit, total, totalPages } }`.

## Akun demo

| Role | Email | Password |
|---|---|---|
| Admin | `admin@pos.test` | `admin123` |
| Kasir | `kasir@pos.test` | `kasir123` |
| Kasir | `budi@pos.test` | `kasir123` |

## Menjalankan di lokal

Prasyarat: Node.js 20+ dan PostgreSQL (lokal atau Railway).

```bash
# 1. Backend
cd BE
cp .env.example .env        # lalu isi koneksi DB (lihat bagian Environment)
npm install
npm run db:setup            # buat database + migrasi + seed data dummy
npm run dev                 # http://localhost:3000

# 2. Frontend (terminal lain)
cd FE
npm install
npm start                   # http://localhost:4200 (proxy /api -> localhost:3000)
```

Script database di `BE`:

| Script | Fungsi |
|---|---|
| `npm run db:create` | Membuat database `DB_NAME` jika belum ada |
| `npm run db:migrate` | Menjalankan file di `migrations/` yang belum dijalankan |
| `npm run db:seed` | Menghapus data lama lalu mengisi ulang data dummy (4 user, 6 kategori, 35 produk + gambar, ±390 transaksi 60 hari terakhir) |
| `npm run db:reset` | Drop semua tabel, migrasi ulang, seed ulang |
| `npm run db:setup` | create + migrate + seed |

> Mode produksi lokal: `npm run build --prefix FE` lalu `npm start --prefix BE` – backend otomatis menyajikan hasil build Angular di http://localhost:3000.

## Environment (`BE/.env`)

| Variabel | Keterangan |
|---|---|
| `DATABASE_URL` | URL PostgreSQL (prioritas). Di Railway isi `${{Postgres.DATABASE_URL}}` |
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_SSL` | Alternatif jika tidak memakai `DATABASE_URL` |
| `JWT_SECRET`, `JWT_EXPIRES_IN` | Kunci & masa berlaku token login |
| `STORE_NAME`, `STORE_ADDRESS`, `STORE_PHONE`, `TAX_PERCENT` | Identitas toko di struk & PPN |
| `CORS_ORIGIN` | Origin FE jika FE & BE beda domain |
| `MIDTRANS_SERVER_KEY`, `MIDTRANS_CLIENT_KEY`, `MIDTRANS_IS_PRODUCTION` | Key Midtrans. **Kosong = mode simulasi** (tombol Bayar/Gagal) |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | SMTP email. **Kosong = email disimpan sebagai file HTML** di `BE/tmp/mails` |

### Mengaktifkan Midtrans Sandbox

1. Daftar di https://dashboard.sandbox.midtrans.com
2. **Settings → Access Keys** → salin *Server Key* dan *Client Key* ke `.env`.
3. **Settings → Configuration → Payment Notification URL** → `https://<domain-railway>/api/payments/midtrans/notification`
4. Untuk tes bayar gunakan simulator: https://simulator.sandbox.midtrans.com (QRIS / VA / GoPay).

> Saat di lokal, webhook tidak bisa menjangkau `localhost`, jadi status diperbarui otomatis saat popup Snap ditutup (memanggil endpoint cek status) atau lewat tombol **Cek Status** di struk.

### Mengaktifkan email (contoh Gmail)

1. Aktifkan 2-Step Verification di akun Google → buat **App Password**.
2. Isi `.env`: `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=465`, `SMTP_SECURE=true`, `SMTP_USER=emailanda@gmail.com`, `SMTP_PASS=<app password 16 digit>`, `MAIL_FROM="Toko Maju Jaya <emailanda@gmail.com>"`.

## Deploy ke Railway (2 service: `pos-be` & `pos-fe`)

FE dan BE dideploy sebagai **service terpisah** dari repo yang sama, sehingga log, metrik, dan restart masing-masing bisa dicek sendiri.

| Service | Root Directory | Build | Start | Healthcheck |
|---|---|---|---|---|
| `pos-be` | `/BE` | `npm ci` | `npm run db:migrate && npm start` | `/api/health` |
| `pos-fe` | `/FE` | `npm run build` (Angular) | `node server.js` | `/healthz` |

Konfigurasi build/start ada di `BE/railway.json` dan `FE/railway.json`. `FE/server.js` menyajikan hasil build Angular dan **meneruskan `/api` ke `pos-be` lewat private network Railway**, jadi browser tetap memanggil `/api` di domain FE (tanpa masalah CORS, webhook Midtrans juga bisa lewat domain FE).

Variables:

- **pos-be**: `DB_HOST=${{Postgres.PGHOST}}`, `DB_PORT=${{Postgres.PGPORT}}`, `DB_USER=${{Postgres.PGUSER}}`, `DB_PASSWORD=${{Postgres.PGPASSWORD}}`, `DB_NAME=POS`, `PORT=3000`, `JWT_SECRET`, `NODE_ENV=production`, data toko, key Midtrans & SMTP.
- **pos-fe**: `API_URL=http://${{pos-be.RAILWAY_PRIVATE_DOMAIN}}:${{pos-be.PORT}}`

Langkah:

1. Push repo ke GitHub/GitLab.
2. Railway → New Service → GitHub Repo (dua kali, untuk `pos-be` dan `pos-fe`), set **Root Directory** sesuai tabel.
3. Isi Variables di atas, lalu **Settings → Networking → Generate Domain** (minimal untuk `pos-fe`).
4. Seed data dummy (sekali saja) dari komputer lokal yang `.env`-nya mengarah ke DB Railway: `npm run db:setup --prefix BE`.

> Alternatif 1 service: `npm run build` lalu `npm start` di root repo – Express ikut menyajikan build Angular.

> Gambar produk disimpan di tabel `product_images` (bytea), bukan di filesystem, sehingga tetap ada setelah redeploy (filesystem container Railway tidak permanen).

## Ringkasan API

| Method | Endpoint | Akses |
|---|---|---|
| POST | `/api/auth/login` · GET `/api/auth/me` · PUT `/api/auth/password` | publik / login |
| GET | `/api/config` · `/api/health` | publik |
| CRUD | `/api/users` | admin |
| CRUD | `/api/categories` | baca: login, tulis: admin |
| CRUD | `/api/products`, POST/DELETE `/api/products/:id/image`, GET `/api/products/:id/image` | baca: login, tulis: admin |
| GET/POST | `/api/stock/summary`, `/api/stock/movements` | baca: login, tulis: admin |
| GET/POST | `/api/transactions`, `/api/transactions/:id`, `/:id/email`, `/:id/cancel`, `/:id/receipt` | login (kasir hanya miliknya) |
| POST | `/api/payments/:id/check`, `/api/payments/:id/simulate`, `/api/payments/midtrans/notification` | login / webhook |
| GET/POST | `/api/reports/sales`, `/api/reports/sales.csv`, `/api/reports/sales/email` | admin |

## Skema database

`users`, `categories`, `products`, `product_images`, `transactions`, `transaction_items`, `stock_movements`, `email_logs`, `schema_migrations` – lihat [BE/migrations/001_init.sql](BE/migrations/001_init.sql).
