export type Role = 'admin' | 'kasir';
export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'expired' | 'cancelled';

export interface User {
  id: number;
  name: string;
  email: string;
  role: Role;
  is_active?: boolean;
  last_login_at?: string | null;
  created_at?: string;
}

export interface Category {
  id: number;
  name: string;
  description: string | null;
  product_count?: number;
}

export interface Product {
  id: number;
  sku: string;
  name: string;
  description: string | null;
  category_id: number | null;
  category_name: string | null;
  price: number;
  cost: number;
  stock: number;
  min_stock: number;
  unit: string;
  is_active: boolean;
  has_image: boolean;
  image_url: string | null;
}

export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface Paged<T> {
  data: T[];
  meta: PageMeta;
}

export interface TransactionItem {
  id: number;
  product_id: number | null;
  product_name: string;
  sku: string | null;
  price: number;
  qty: number;
  subtotal: number;
}

export interface Transaction {
  id: number;
  invoice_no: string;
  cashier_id?: number;
  cashier_name?: string;
  customer_name: string | null;
  customer_email: string | null;
  subtotal?: number;
  discount?: number;
  tax?: number;
  total: number;
  payment_method: 'cash' | 'midtrans';
  payment_status: PaymentStatus;
  payment_type: string | null;
  cash_received?: number | null;
  change_amount?: number | null;
  snap_token?: string | null;
  snap_redirect_url?: string | null;
  created_at: string;
  paid_at: string | null;
  item_count?: number;
  items?: TransactionItem[];
}

export interface StockMovement {
  id: number;
  product_id: number;
  product_name: string;
  sku: string;
  unit: string;
  type: 'in' | 'out' | 'adjustment' | 'sale' | 'return';
  qty: number;
  stock_before: number;
  stock_after: number;
  reference: string | null;
  note: string | null;
  user_name: string | null;
  created_at: string;
}

export interface AppConfig {
  store: { name: string; address: string; phone: string; taxPercent: number };
  midtrans: { enabled: boolean; clientKey: string; isProduction: boolean };
  smtpEnabled: boolean;
}

export interface SalesReport {
  range: { from: string; to: string };
  summary: {
    transactions: number;
    revenue: number;
    average: number;
    discount: number;
    tax: number;
    items_sold: number;
    gross_profit: number;
  };
  daily: { date: string; transactions: number; revenue: number }[];
  topProducts: { product_name: string; qty: number; revenue: number }[];
  byMethod: { method: string; transactions: number; revenue: number }[];
  byCashier: { cashier: string; transactions: number; revenue: number }[];
  byCategory: { category: string; qty: number; revenue: number }[];
}

export interface CheckoutResponse {
  transaction: Transaction;
  payment: null | { mode: 'midtrans'; token: string; redirect_url: string } | { mode: 'simulation' };
  email: null | { status: 'sent' | 'saved' | 'failed'; error?: string };
}
