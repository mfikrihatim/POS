import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService, errorMessage } from '../../core/api.service';
import { ConfigService } from '../../core/config.service';
import { Category, CheckoutResponse, PageMeta, Paged, Product, Transaction } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { ModalComponent } from '../../shared/modal.component';
import { PaginationComponent } from '../../shared/pagination.component';
import { RupiahPipe } from '../../shared/pipes';
import { ProductImageComponent } from '../../shared/product-image.component';
import { ReceiptDialogComponent } from '../../shared/receipt-dialog.component';

interface CartLine { product: Product; qty: number }

@Component({
  selector: 'app-kasir',
  imports: [FormsModule, RupiahPipe, PaginationComponent, ProductImageComponent, ModalComponent, ReceiptDialogComponent],
  templateUrl: './kasir.component.html',
})
export class KasirComponent {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  protected config = inject(ConfigService);

  // Katalog
  protected products = signal<Product[]>([]);
  protected meta = signal<PageMeta | null>(null);
  protected categories = signal<Category[]>([]);
  protected loading = signal(false);
  protected search = signal('');
  protected categoryId = signal<number | null>(null);
  protected page = signal(1);
  private searchTimer?: ReturnType<typeof setTimeout>;

  // Keranjang
  protected cart = signal<CartLine[]>([]);
  protected discount = signal(0);
  protected taxPercent = computed(() => this.config.config()?.store.taxPercent ?? 11);
  protected subtotal = computed(() => this.cart().reduce((s, l) => s + l.product.price * l.qty, 0));
  protected discountApplied = computed(() => Math.min(Math.max(0, this.discount() || 0), this.subtotal()));
  protected tax = computed(() => Math.round((this.subtotal() - this.discountApplied()) * this.taxPercent() / 100));
  protected total = computed(() => this.subtotal() - this.discountApplied() + this.tax());
  protected itemCount = computed(() => this.cart().reduce((s, l) => s + l.qty, 0));

  // Checkout
  protected showCheckout = signal(false);
  protected method = signal<'cash' | 'midtrans'>('cash');
  protected cashReceived = signal<number | null>(null);
  protected customerName = '';
  protected customerEmail = '';
  protected sendReceipt = false;
  protected submitting = signal(false);
  protected errors = signal<Record<string, string>>({});
  protected change = computed(() => (this.cashReceived() ?? 0) - this.total());
  protected quickCash = computed(() => {
    const t = this.total();
    const opts = new Set([t, Math.ceil(t / 10000) * 10000, Math.ceil(t / 50000) * 50000, Math.ceil(t / 100000) * 100000]);
    return [...opts].filter((v) => v >= t).slice(0, 4);
  });

  // Simulasi & struk
  protected simulateTrx = signal<Transaction | null>(null);
  protected simBusy = signal(false);
  protected receiptTrx = signal<Transaction | null>(null);

  constructor() {
    this.loadProducts();
    this.api.get<Category[]>('/categories').subscribe((c) => this.categories.set(c));
  }

  loadProducts() {
    this.loading.set(true);
    this.api.get<Paged<Product>>('/products', {
      page: this.page(), limit: 12, search: this.search(), category_id: this.categoryId(), status: 'active', sort: 'name:asc',
    }).subscribe({
      next: (r) => { this.products.set(r.data); this.meta.set(r.meta); this.loading.set(false); },
      error: (e) => { this.toast.error(errorMessage(e)); this.loading.set(false); },
    });
  }

  onSearch(v: string) {
    this.search.set(v);
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => { this.page.set(1); this.loadProducts(); }, 300);
  }

  setCategory(id: number | null) {
    this.categoryId.set(id);
    this.page.set(1);
    this.loadProducts();
  }

  goPage(p: number) {
    this.page.set(p);
    this.loadProducts();
  }

  inCart(id: number) {
    return this.cart().find((l) => l.product.id === id)?.qty ?? 0;
  }

  add(p: Product) {
    if (p.stock <= 0) return this.toast.error(`Stok ${p.name} habis`);
    const current = this.inCart(p.id);
    if (current >= p.stock) return this.toast.error(`Stok ${p.name} hanya ${p.stock}`);
    this.cart.update((c) => current ? c.map((l) => (l.product.id === p.id ? { ...l, qty: l.qty + 1 } : l)) : [...c, { product: p, qty: 1 }]);
  }

  setQty(line: CartLine, qty: number) {
    qty = Math.floor(Number(qty) || 0);
    if (qty <= 0) return this.remove(line);
    if (qty > line.product.stock) {
      this.toast.error(`Stok ${line.product.name} hanya ${line.product.stock}`);
      qty = line.product.stock;
    }
    this.cart.update((c) => c.map((l) => (l.product.id === line.product.id ? { ...l, qty } : l)));
  }

  remove(line: CartLine) {
    this.cart.update((c) => c.filter((l) => l.product.id !== line.product.id));
  }

  clearCart() {
    this.cart.set([]);
    this.discount.set(0);
  }

  openCheckout() {
    if (!this.cart().length) return;
    this.errors.set({});
    this.cashReceived.set(null);
    this.method.set('cash');
    this.showCheckout.set(true);
  }

  setCash(v: number | null) {
    this.cashReceived.set(v);
    if (this.errors()['cash_received']) this.errors.update(({ cash_received, ...rest }) => rest);
  }

  private validate(): boolean {
    const e: Record<string, string> = {};
    if (this.method() === 'cash') {
      if (this.cashReceived() === null) e['cash_received'] = 'Jumlah uang tunai wajib diisi';
      else if ((this.cashReceived() ?? 0) < this.total()) e['cash_received'] = 'Uang tunai kurang dari total';
    }
    if (this.customerEmail && !/^\S+@\S+\.\S+$/.test(this.customerEmail)) e['customer_email'] = 'Format email tidak valid';
    if (this.sendReceipt && !this.customerEmail) e['customer_email'] = 'Email wajib diisi untuk kirim struk';
    this.errors.set(e);
    return !Object.keys(e).length;
  }

  submit() {
    if (!this.validate()) return;
    this.submitting.set(true);
    const body = {
      items: this.cart().map((l) => ({ product_id: l.product.id, qty: l.qty })),
      discount: this.discountApplied(),
      payment_method: this.method(),
      cash_received: this.method() === 'cash' ? this.cashReceived() : undefined,
      customer_name: this.customerName || null,
      customer_email: this.customerEmail || null,
      send_receipt: this.sendReceipt && this.method() === 'cash',
    };
    this.api.post<CheckoutResponse>('/transactions', body).subscribe({
      next: (r) => this.afterCheckout(r),
      error: (e) => {
        this.submitting.set(false);
        const details = e?.error?.details as { field: string; message: string }[] | undefined;
        if (details?.length) this.errors.set(Object.fromEntries(details.map((d) => [d.field, d.message])));
        this.toast.error(errorMessage(e));
        this.loadProducts(); // stok mungkin berubah
      },
    });
  }

  private afterCheckout(r: CheckoutResponse) {
    this.submitting.set(false);
    this.showCheckout.set(false);
    this.clearCart();
    this.customerName = '';
    this.customerEmail = '';
    this.sendReceipt = false;
    this.loadProducts();

    if (!r.payment) {
      this.toast.success(`Transaksi ${r.transaction.invoice_no} berhasil` + (r.email ? (r.email.status === 'sent' ? ', struk terkirim' : ', struk disimpan (SMTP belum aktif)') : ''));
      this.receiptTrx.set(r.transaction);
    } else if (r.payment.mode === 'simulation') {
      this.simulateTrx.set(r.transaction);
    } else {
      const token = r.payment.token;
      this.config.loadSnap().then(() => {
        window.snap!.pay(token, {
          onSuccess: () => this.checkStatus(r.transaction.id),
          onPending: () => this.checkStatus(r.transaction.id),
          onError: () => this.checkStatus(r.transaction.id),
          onClose: () => this.checkStatus(r.transaction.id),
        });
      }).catch((e) => {
        this.toast.error(e.message);
        this.receiptTrx.set(r.transaction);
      });
    }
  }

  checkStatus(id: number) {
    this.api.post<Transaction>(`/payments/${id}/check`).subscribe({
      next: (t) => {
        if (t.payment_status === 'paid') this.toast.success(`Pembayaran ${t.invoice_no} lunas`);
        else this.toast.info(`Status pembayaran: ${t.payment_status}`);
        this.receiptTrx.set(t);
        this.loadProducts();
      },
      error: (e) => this.toast.error(errorMessage(e)),
    });
  }

  simulate(status: 'paid' | 'failed' | 'expired', type = 'qris') {
    const t = this.simulateTrx();
    if (!t || this.simBusy()) return;
    this.simBusy.set(true);
    this.api.post<Transaction>(`/payments/${t.id}/simulate`, { status, payment_type: type }).subscribe({
      next: (res) => {
        this.simBusy.set(false);
        this.simulateTrx.set(null);
        if (status === 'paid') this.toast.success(`Pembayaran ${res.invoice_no} lunas (simulasi)`);
        else this.toast.error(`Pembayaran ${status}, stok dikembalikan`);
        this.receiptTrx.set(res);
        this.loadProducts();
      },
      error: (e) => { this.simBusy.set(false); this.toast.error(errorMessage(e)); },
    });
  }
}
