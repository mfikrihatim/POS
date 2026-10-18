import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiService, errorMessage } from '../../core/api.service';
import { PageMeta, Paged, Product, StockMovement } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { PaginationComponent } from '../../shared/pagination.component';
import { LabelPipe, RupiahPipe, TanggalPipe } from '../../shared/pipes';

interface StockSummary { products: number; units: number; stock_value: number; low_stock: number; out_of_stock: number }

@Component({
  selector: 'app-stok',
  imports: [FormsModule, ReactiveFormsModule, PaginationComponent, RupiahPipe, TanggalPipe, LabelPipe],
  templateUrl: './stok.component.html',
})
export class StokComponent {
  private api = inject(ApiService);
  private toast = inject(ToastService);

  protected summary = signal<StockSummary | null>(null);
  protected alerts = signal<Product[]>([]);
  protected alertMeta = signal<PageMeta | null>(null);
  protected alertPage = 1;
  protected products = signal<Product[]>([]);
  protected moves = signal<StockMovement[]>([]);
  protected meta = signal<PageMeta | null>(null);
  protected f = { search: '', type: '', product_id: '' };
  protected page = 1;
  protected limit = 10;
  protected saving = signal(false);

  protected form = inject(FormBuilder).group({
    product_id: [null as number | null, Validators.required],
    type: ['in' as 'in' | 'out' | 'adjustment', Validators.required],
    qty: [null as number | null, [Validators.required, Validators.min(0)]],
    reference: [''],
    note: [''],
  });
  protected selectedProduct = computed(() => this.products().find((p) => p.id === this.formProductId()) ?? null);
  private formProductId = signal<number | null>(null);
  protected formType = signal<'in' | 'out' | 'adjustment'>('in');
  protected formQty = signal<number | null>(null);
  protected preview = computed(() => {
    const p = this.selectedProduct();
    const q = this.formQty();
    if (!p || q === null) return null;
    const t = this.formType();
    return t === 'in' ? p.stock + q : t === 'out' ? p.stock - q : q;
  });

  constructor() {
    this.form.controls.product_id.valueChanges.subscribe((v) => this.formProductId.set(v));
    this.form.controls.type.valueChanges.subscribe((v) => this.formType.set(v!));
    this.form.controls.qty.valueChanges.subscribe((v) => this.formQty.set(v === null || (v as any) === '' ? null : Number(v)));
    this.loadAll();
    this.api.get<Paged<Product>>('/products', { limit: 100, sort: 'name:asc' }).subscribe((r) => this.products.set(r.data));
  }

  loadAll() {
    this.api.get<StockSummary>('/stock/summary').subscribe((s) => this.summary.set(s));
    this.loadAlerts();
    this.loadMoves();
  }

  loadAlerts() {
    this.api.get<Paged<Product>>('/products', { stock: 'alert', status: 'active', sort: 'stock:asc', limit: 5, page: this.alertPage })
      .subscribe((r) => { this.alerts.set(r.data); this.alertMeta.set(r.meta); });
  }

  loadMoves() {
    this.api.get<Paged<StockMovement>>('/stock/movements', { ...this.f, page: this.page, limit: this.limit }).subscribe({
      next: (r) => { this.moves.set(r.data); this.meta.set(r.meta); },
      error: (e) => this.toast.error(errorMessage(e)),
    });
  }

  reload() { this.page = 1; this.loadMoves(); }

  restock(p: Product) {
    this.form.reset({ product_id: p.id, type: 'in', qty: Math.max(p.min_stock * 2 - p.stock, 1), reference: '', note: 'Restok' });
    document.querySelector('.stock-form')?.scrollIntoView({ behavior: 'smooth' });
  }

  err(name: string) {
    const c = this.form.get(name)!;
    if (!c.invalid || !c.touched) return null;
    return c.hasError('required') ? 'Wajib diisi' : c.hasError('min') ? 'Tidak boleh negatif' : c.hasError('insufficient') ? 'Stok tidak cukup' : c.hasError('zero') ? 'Jumlah harus lebih dari 0' : 'Tidak valid';
  }

  save() {
    this.form.markAllAsTouched();
    const v = this.form.getRawValue();
    if (v.type !== 'adjustment' && v.qty === 0) this.form.controls.qty.setErrors({ zero: true });
    const prev = this.preview();
    if (prev !== null && prev < 0) this.form.controls.qty.setErrors({ insufficient: true });
    if (this.form.invalid) return;
    this.saving.set(true);
    this.api.post('/stock/movements', v).subscribe({
      next: () => {
        this.toast.success('Stok berhasil diperbarui');
        this.saving.set(false);
        this.form.reset({ product_id: null, type: 'in', qty: null, reference: '', note: '' });
        this.loadAll();
        this.api.get<Paged<Product>>('/products', { limit: 100, sort: 'name:asc' }).subscribe((r) => this.products.set(r.data));
      },
      error: (e) => { this.saving.set(false); this.toast.error(errorMessage(e)); },
    });
  }
}
