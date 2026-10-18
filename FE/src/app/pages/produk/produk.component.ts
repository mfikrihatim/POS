import { Component, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Observable, of, switchMap } from 'rxjs';
import { ApiService, errorMessage, fieldErrors } from '../../core/api.service';
import { Category, PageMeta, Paged, Product } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { ModalComponent } from '../../shared/modal.component';
import { PaginationComponent } from '../../shared/pagination.component';
import { RupiahPipe } from '../../shared/pipes';
import { ProductImageComponent } from '../../shared/product-image.component';

const MAX_IMG = 2 * 1024 * 1024;
const IMG_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

@Component({
  selector: 'app-produk',
  imports: [FormsModule, ReactiveFormsModule, ModalComponent, PaginationComponent, RupiahPipe, ProductImageComponent],
  templateUrl: './produk.component.html',
})
export class ProdukComponent {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  private fb = inject(FormBuilder);

  protected tab = signal<'produk' | 'kategori'>('produk');
  protected rows = signal<Product[]>([]);
  protected meta = signal<PageMeta | null>(null);
  protected categories = signal<Category[]>([]);
  protected loading = signal(false);
  protected f = { search: '', category_id: '', status: '', stock: '' };
  protected page = 1;
  protected limit = 10;
  protected sort = 'name:asc';

  // Form produk
  protected editing = signal<Product | null>(null);
  protected showForm = signal(false);
  protected saving = signal(false);
  protected serverErrors = signal<Record<string, string>>({});
  protected imageFile: File | null = null;
  protected imagePreview = signal<string | null>(null);
  protected imageError = signal('');
  protected form = this.fb.group({
    sku: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(40), Validators.pattern(/^[A-Za-z0-9-]+$/)]],
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(150)]],
    description: [''],
    category_id: [null as number | null, Validators.required],
    price: [null as number | null, [Validators.required, Validators.min(0)]],
    cost: [0 as number | null, [Validators.required, Validators.min(0)]],
    stock: [0 as number | null, [Validators.required, Validators.min(0)]],
    min_stock: [5 as number | null, [Validators.required, Validators.min(0)]],
    unit: ['pcs', Validators.required],
    is_active: [true],
  });

  // Form kategori
  protected catForm = this.fb.nonNullable.group({ name: ['', [Validators.required, Validators.minLength(2)]], description: [''] });
  protected editingCat = signal<Category | null>(null);

  constructor() {
    this.load();
    this.loadCategories();
  }

  loadCategories() {
    this.api.get<Category[]>('/categories').subscribe((c) => this.categories.set(c));
  }

  reload() { this.page = 1; this.load(); }

  load() {
    this.loading.set(true);
    this.api.get<Paged<Product>>('/products', { ...this.f, page: this.page, limit: this.limit, sort: this.sort }).subscribe({
      next: (r) => { this.rows.set(r.data); this.meta.set(r.meta); this.loading.set(false); },
      error: (e) => { this.toast.error(errorMessage(e)); this.loading.set(false); },
    });
  }

  sortBy(field: string) {
    const [cur, dir] = this.sort.split(':');
    this.sort = `${field}:${cur === field && dir === 'asc' ? 'desc' : 'asc'}`;
    this.load();
  }
  arrow(field: string) {
    const [cur, dir] = this.sort.split(':');
    return cur === field ? (dir === 'desc' ? '▼' : '▲') : '';
  }

  err(name: string): string | null {
    const c = this.form.get(name);
    const server = this.serverErrors()[name];
    if (server) return server;
    if (!c || !c.invalid || !(c.touched || c.dirty)) return null;
    if (c.hasError('required')) return 'Wajib diisi';
    if (c.hasError('minlength')) return `Minimal ${c.getError('minlength').requiredLength} karakter`;
    if (c.hasError('maxlength')) return `Maksimal ${c.getError('maxlength').requiredLength} karakter`;
    if (c.hasError('min')) return 'Tidak boleh negatif';
    if (c.hasError('pattern')) return 'Hanya huruf, angka, dan tanda -';
    if (c.hasError('costGtPrice')) return 'Harga modal melebihi harga jual';
    return 'Tidak valid';
  }

  openForm(p?: Product) {
    this.editing.set(p ?? null);
    this.serverErrors.set({});
    this.imageFile = null;
    this.imageError.set('');
    this.imagePreview.set(p?.image_url ?? null);
    this.form.reset({
      sku: p?.sku ?? '', name: p?.name ?? '', description: p?.description ?? '', category_id: p?.category_id ?? null,
      price: p?.price ?? null, cost: p?.cost ?? 0, stock: p?.stock ?? 0, min_stock: p?.min_stock ?? 5, unit: p?.unit ?? 'pcs', is_active: p?.is_active ?? true,
    });
    if (p) this.form.controls.stock.disable(); else this.form.controls.stock.enable();
    this.showForm.set(true);
  }

  onFile(ev: Event) {
    const file = (ev.target as HTMLInputElement).files?.[0];
    this.imageError.set('');
    if (!file) return;
    if (!IMG_TYPES.includes(file.type)) { this.imageError.set('Format harus JPG, PNG, atau WEBP'); return; }
    if (file.size > MAX_IMG) { this.imageError.set('Ukuran maksimal 2 MB'); return; }
    this.imageFile = file;
    const reader = new FileReader();
    reader.onload = () => this.imagePreview.set(reader.result as string);
    reader.readAsDataURL(file);
  }

  save() {
    this.form.markAllAsTouched();
    const v = this.form.getRawValue();
    if ((v.cost ?? 0) > (v.price ?? 0)) this.form.controls.cost.setErrors({ costGtPrice: true });
    if (this.form.invalid || this.imageError()) return;
    this.saving.set(true);
    this.serverErrors.set({});
    const body = { ...v, is_active: !!v.is_active };
    const p = this.editing();
    const req$: Observable<Product> = p ? this.api.put<Product>(`/products/${p.id}`, body) : this.api.post<Product>('/products', body);
    req$.pipe(switchMap((saved) => (this.imageFile ? this.uploadImage(saved.id, this.imageFile) : of(saved)))).subscribe({
      next: () => {
        this.toast.success(p ? 'Produk diperbarui' : 'Produk ditambahkan');
        this.saving.set(false);
        this.showForm.set(false);
        this.load();
        this.loadCategories();
      },
      error: (e) => {
        this.saving.set(false);
        this.serverErrors.set(fieldErrors(e));
        this.toast.error(errorMessage(e));
      },
    });
  }

  private uploadImage(id: number, file: File) {
    const fd = new FormData();
    fd.append('image', file);
    return this.api.post<Product>(`/products/${id}/image`, fd);
  }

  removeImage() {
    const p = this.editing();
    if (!p?.has_image) { this.imageFile = null; this.imagePreview.set(null); return; }
    this.api.delete(`/products/${p.id}/image`).subscribe(() => {
      this.imagePreview.set(null);
      this.editing.set({ ...p, has_image: false, image_url: null });
      this.toast.success('Gambar dihapus');
      this.load();
    });
  }

  remove(p: Product) {
    if (!confirm(`Hapus produk "${p.name}"?`)) return;
    this.api.delete<{ message: string }>(`/products/${p.id}`).subscribe({
      next: (r) => { this.toast.success(r.message); this.load(); },
      error: (e) => this.toast.error(errorMessage(e)),
    });
  }

  // ===== Kategori =====
  editCat(c?: Category) {
    this.editingCat.set(c ?? null);
    this.catForm.reset({ name: c?.name ?? '', description: c?.description ?? '' });
  }

  saveCat() {
    this.catForm.markAllAsTouched();
    if (this.catForm.invalid) return;
    const c = this.editingCat();
    const req$ = c ? this.api.put(`/categories/${c.id}`, this.catForm.getRawValue()) : this.api.post('/categories', this.catForm.getRawValue());
    req$.subscribe({
      next: () => { this.toast.success(c ? 'Kategori diperbarui' : 'Kategori ditambahkan'); this.editCat(); this.loadCategories(); },
      error: (e) => this.toast.error(errorMessage(e)),
    });
  }

  removeCat(c: Category) {
    if (!confirm(`Hapus kategori "${c.name}"? Produk di dalamnya menjadi tanpa kategori.`)) return;
    this.api.delete(`/categories/${c.id}`).subscribe({
      next: () => { this.toast.success('Kategori dihapus'); this.loadCategories(); this.load(); },
      error: (e) => this.toast.error(errorMessage(e)),
    });
  }
}
