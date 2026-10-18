-- ===== Akun & Akses =====
CREATE TABLE users (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(100) NOT NULL,
  email         VARCHAR(150) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          VARCHAR(20)  NOT NULL DEFAULT 'kasir' CHECK (role IN ('admin', 'kasir')),
  is_active     BOOLEAN      NOT NULL DEFAULT TRUE,
  last_login_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- ===== Katalog Produk =====
CREATE TABLE categories (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(80) NOT NULL UNIQUE,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE products (
  id          SERIAL PRIMARY KEY,
  sku         VARCHAR(40)  NOT NULL UNIQUE,
  name        VARCHAR(150) NOT NULL,
  description TEXT,
  category_id INT REFERENCES categories(id) ON DELETE SET NULL,
  price       NUMERIC(14,2) NOT NULL CHECK (price >= 0),
  cost        NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (cost >= 0),
  stock       INT NOT NULL DEFAULT 0 CHECK (stock >= 0),
  min_stock   INT NOT NULL DEFAULT 5 CHECK (min_stock >= 0),
  unit        VARCHAR(20) NOT NULL DEFAULT 'pcs',
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  has_image   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_name ON products(lower(name));

-- Gambar produk disimpan di DB (bytea) agar tetap ada saat redeploy Railway (filesystem container tidak permanen)
CREATE TABLE product_images (
  product_id INT PRIMARY KEY REFERENCES products(id) ON DELETE CASCADE,
  mime_type  VARCHAR(50) NOT NULL,
  data       BYTEA NOT NULL,
  size       INT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ===== Penjualan =====
CREATE TABLE transactions (
  id                SERIAL PRIMARY KEY,
  invoice_no        VARCHAR(40) NOT NULL UNIQUE,
  cashier_id        INT REFERENCES users(id) ON DELETE SET NULL,
  customer_name     VARCHAR(100),
  customer_email    VARCHAR(150),
  subtotal          NUMERIC(14,2) NOT NULL,
  discount          NUMERIC(14,2) NOT NULL DEFAULT 0,
  tax               NUMERIC(14,2) NOT NULL DEFAULT 0,
  total             NUMERIC(14,2) NOT NULL,
  payment_method    VARCHAR(20) NOT NULL CHECK (payment_method IN ('cash', 'midtrans')),
  payment_status    VARCHAR(20) NOT NULL DEFAULT 'pending'
                    CHECK (payment_status IN ('pending', 'paid', 'failed', 'expired', 'cancelled')),
  payment_type      VARCHAR(40),          -- detail dari Midtrans (qris, bank_transfer, gopay, dst.)
  cash_received     NUMERIC(14,2),
  change_amount     NUMERIC(14,2),
  midtrans_order_id VARCHAR(60) UNIQUE,
  snap_token        TEXT,
  snap_redirect_url TEXT,
  note              TEXT,
  paid_at           TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_transactions_created ON transactions(created_at);
CREATE INDEX idx_transactions_status ON transactions(payment_status);

CREATE TABLE transaction_items (
  id             SERIAL PRIMARY KEY,
  transaction_id INT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  product_id     INT REFERENCES products(id) ON DELETE SET NULL,
  product_name   VARCHAR(150) NOT NULL,
  sku            VARCHAR(40),
  price          NUMERIC(14,2) NOT NULL,
  cost           NUMERIC(14,2) NOT NULL DEFAULT 0,
  qty            INT NOT NULL CHECK (qty > 0),
  subtotal       NUMERIC(14,2) NOT NULL
);
CREATE INDEX idx_items_transaction ON transaction_items(transaction_id);
CREATE INDEX idx_items_product ON transaction_items(product_id);

-- ===== Manajemen Stok =====
CREATE TABLE stock_movements (
  id           SERIAL PRIMARY KEY,
  product_id   INT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  type         VARCHAR(20) NOT NULL CHECK (type IN ('in', 'out', 'adjustment', 'sale', 'return')),
  qty          INT NOT NULL,            -- positif = masuk, negatif = keluar
  stock_before INT NOT NULL,
  stock_after  INT NOT NULL,
  reference    VARCHAR(60),             -- mis. nomor invoice / PO
  note         TEXT,
  user_id      INT REFERENCES users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_stock_product ON stock_movements(product_id, created_at DESC);

-- ===== Log email (struk & laporan) =====
CREATE TABLE email_logs (
  id         SERIAL PRIMARY KEY,
  type       VARCHAR(20) NOT NULL CHECK (type IN ('receipt', 'report')),
  recipient  VARCHAR(150) NOT NULL,
  subject    TEXT NOT NULL,
  status     VARCHAR(20) NOT NULL CHECK (status IN ('sent', 'saved', 'failed')),
  error      TEXT,
  reference  VARCHAR(60),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
