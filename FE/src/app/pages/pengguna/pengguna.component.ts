import { Component, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiService, errorMessage, fieldErrors } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { PageMeta, Paged, User } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { ModalComponent } from '../../shared/modal.component';
import { PaginationComponent } from '../../shared/pagination.component';
import { LabelPipe, TanggalPipe } from '../../shared/pipes';

@Component({
  selector: 'app-pengguna',
  imports: [FormsModule, ReactiveFormsModule, ModalComponent, PaginationComponent, LabelPipe, TanggalPipe],
  template: `
    <div class="page-head">
      <div>
        <h1>Akun & Akses</h1>
        <p class="muted">Kelola akun kasir & admin. Kasir hanya bisa mengakses Layar Kasir dan transaksinya sendiri.</p>
      </div>
      <button class="btn btn-primary" (click)="openForm()">+ Tambah Pengguna</button>
    </div>

    <div class="role-cards">
      <div class="card role-card"><b>👑 Admin</b><span class="muted small">Semua modul: kasir, katalog, stok, laporan, akun & akses.</span></div>
      <div class="card role-card"><b>🧑‍💼 Kasir</b><span class="muted small">Layar kasir, checkout, struk & riwayat transaksi miliknya.</span></div>
    </div>

    <div class="card">
      <div class="filters">
        <input class="input" type="search" placeholder="Cari nama / email…" [(ngModel)]="f.search" (keyup.enter)="reload()" />
        <select class="input" [(ngModel)]="f.role" (change)="reload()">
          <option value="">Semua role</option>
          <option value="admin">Admin</option>
          <option value="kasir">Kasir</option>
        </select>
        <button class="btn" (click)="reload()">Cari</button>
      </div>
      <div class="table-wrap">
        <table class="table">
          <thead><tr><th>Nama</th><th>Email</th><th>Role</th><th>Status</th><th>Login Terakhir</th><th></th></tr></thead>
          <tbody>
            @for (u of rows(); track u.id) {
              <tr>
                <td><b>{{ u.name }}</b> @if (u.id === auth.user()?.id) { <span class="pill pill-ok">Anda</span> }</td>
                <td>{{ u.email }}</td>
                <td><span class="status" [class.status-paid]="u.role === 'admin'">{{ u.role | label }}</span></td>
                <td><span class="status" [class.status-paid]="u.is_active" [class.status-failed]="!u.is_active">{{ u.is_active ? 'Aktif' : 'Nonaktif' }}</span></td>
                <td>{{ u.last_login_at | tanggal }}</td>
                <td class="actions">
                  <button class="btn btn-sm" (click)="openForm(u)">Ubah</button>
                  @if (u.id !== auth.user()?.id) { <button class="btn btn-sm btn-ghost-danger" (click)="remove(u)">Hapus</button> }
                </td>
              </tr>
            } @empty { <tr><td colspan="6" class="empty">Tidak ada pengguna.</td></tr> }
          </tbody>
        </table>
      </div>
      <app-pagination [meta]="meta()" (pageChange)="page = $event; load()" (limitChange)="limit = $event; reload()" />
    </div>

    @if (showForm()) {
      <app-modal [title]="editing() ? 'Ubah Pengguna' : 'Tambah Pengguna'" (close)="showForm.set(false)">
        <form [formGroup]="form" (ngSubmit)="save()" id="userForm" novalidate>
          <label class="field"><span>Nama *</span><input class="input" formControlName="name" [class.invalid]="err('name')" />
            @if (err('name')) { <small class="error">{{ err('name') }}</small> }</label>
          <label class="field"><span>Email *</span><input class="input" type="email" formControlName="email" [class.invalid]="err('email')" />
            @if (err('email')) { <small class="error">{{ err('email') }}</small> }</label>
          <label class="field"><span>Password {{ editing() ? '(kosongkan jika tidak diubah)' : '*' }}</span>
            <input class="input" type="password" formControlName="password" autocomplete="new-password" [class.invalid]="err('password')" />
            @if (err('password')) { <small class="error">{{ err('password') }}</small> }</label>
          <div class="grid-2">
            <label class="field"><span>Role *</span>
              <select class="input" formControlName="role"><option value="kasir">Kasir</option><option value="admin">Admin</option></select></label>
            <label class="field check-field"><span>Status</span><label class="check"><input type="checkbox" formControlName="is_active" /> Akun aktif</label></label>
          </div>
        </form>
        <div footer class="modal-foot">
          <button class="btn" (click)="showForm.set(false)">Batal</button>
          <button class="btn btn-primary" type="submit" form="userForm" [disabled]="saving()">{{ saving() ? 'Menyimpan…' : 'Simpan' }}</button>
        </div>
      </app-modal>
    }
  `,
})
export class PenggunaComponent {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  protected auth = inject(AuthService);

  protected rows = signal<User[]>([]);
  protected meta = signal<PageMeta | null>(null);
  protected f = { search: '', role: '' };
  protected page = 1;
  protected limit = 10;
  protected showForm = signal(false);
  protected editing = signal<User | null>(null);
  protected saving = signal(false);
  protected serverErrors = signal<Record<string, string>>({});
  protected form = inject(FormBuilder).nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    email: ['', [Validators.required, Validators.email]],
    password: [''],
    role: ['kasir' as 'admin' | 'kasir'],
    is_active: [true],
  });

  constructor() { this.load(); }

  reload() { this.page = 1; this.load(); }

  load() {
    this.api.get<Paged<User>>('/users', { ...this.f, page: this.page, limit: this.limit }).subscribe({
      next: (r) => { this.rows.set(r.data); this.meta.set(r.meta); },
      error: (e) => this.toast.error(errorMessage(e)),
    });
  }

  err(name: string) {
    const s = this.serverErrors()[name];
    if (s) return s;
    const c = this.form.get(name)!;
    if (!c.invalid || !c.touched) return null;
    if (c.hasError('required')) return 'Wajib diisi';
    if (c.hasError('email')) return 'Format email tidak valid';
    if (c.hasError('minlength')) return `Minimal ${c.getError('minlength').requiredLength} karakter`;
    return 'Tidak valid';
  }

  openForm(u?: User) {
    this.editing.set(u ?? null);
    this.serverErrors.set({});
    this.form.reset({ name: u?.name ?? '', email: u?.email ?? '', password: '', role: u?.role ?? 'kasir', is_active: u?.is_active ?? true });
    this.form.controls.password.setValidators(u ? [Validators.minLength(6)] : [Validators.required, Validators.minLength(6)]);
    this.form.controls.password.updateValueAndValidity();
    this.showForm.set(true);
  }

  save() {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    this.saving.set(true);
    const u = this.editing();
    const req$ = u ? this.api.put(`/users/${u.id}`, this.form.getRawValue()) : this.api.post('/users', this.form.getRawValue());
    req$.subscribe({
      next: () => { this.toast.success(u ? 'Pengguna diperbarui' : 'Pengguna ditambahkan'); this.saving.set(false); this.showForm.set(false); this.load(); },
      error: (e) => { this.saving.set(false); this.serverErrors.set(fieldErrors(e)); this.toast.error(errorMessage(e)); },
    });
  }

  remove(u: User) {
    if (!confirm(`Hapus pengguna "${u.name}"?`)) return;
    this.api.delete<{ message: string }>(`/users/${u.id}`).subscribe({
      next: (r) => { this.toast.success(r.message); this.load(); },
      error: (e) => this.toast.error(errorMessage(e)),
    });
  }
}
