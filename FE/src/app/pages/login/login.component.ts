import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { errorMessage } from '../../core/api.service';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule],
  template: `
    <div class="login-page">
      <div class="login-hero">
        <div class="brand-logo lg">P</div>
        <h1>Point of Sale</h1>
        <p>Kasir, katalog produk, stok, pembayaran Midtrans, dan laporan penjualan dalam satu aplikasi.</p>
        <ul>
          <li>🛒 Transaksi cepat dengan keranjang & checkout</li>
          <li>💳 Pembayaran tunai & Midtrans (QRIS, VA, e-wallet)</li>
          <li>📧 Struk & laporan dikirim via email</li>
          <li>📈 Laporan penjualan real-time</li>
        </ul>
      </div>
      <form class="login-card" [formGroup]="form" (ngSubmit)="submit()" novalidate>
        <h2>Masuk</h2>
        <p class="muted">Gunakan akun yang terdaftar.</p>
        <label class="field">
          <span>Email</span>
          <input class="input" type="email" formControlName="email" autocomplete="username" [class.invalid]="invalid('email')" />
          @if (invalid('email')) {
            <small class="error">{{ form.controls.email.hasError('required') ? 'Email wajib diisi' : 'Format email tidak valid' }}</small>
          }
        </label>
        <label class="field">
          <span>Password</span>
          <input class="input" type="password" formControlName="password" autocomplete="current-password" [class.invalid]="invalid('password')" />
          @if (invalid('password')) { <small class="error">Password minimal 6 karakter</small> }
        </label>
        @if (error()) { <div class="alert alert-error">{{ error() }}</div> }
        <button class="btn btn-primary btn-block" [disabled]="loading()">{{ loading() ? 'Memproses…' : 'Masuk' }}</button>
        <div class="demo-accounts">
          <div class="muted small">Akun demo:</div>
          <button type="button" class="btn btn-sm" (click)="fill('admin@pos.test', 'admin123')">Admin</button>
          <button type="button" class="btn btn-sm" (click)="fill('kasir@pos.test', 'kasir123')">Kasir</button>
        </div>
      </form>
    </div>
  `,
})
export class LoginComponent {
  private auth = inject(AuthService);
  private router = inject(Router);
  protected loading = signal(false);
  protected error = signal('');
  protected form = inject(FormBuilder).nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  invalid(name: 'email' | 'password') {
    const c = this.form.controls[name];
    return c.invalid && (c.touched || c.dirty);
  }

  fill(email: string, password: string) {
    this.form.setValue({ email, password });
  }

  submit() {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    this.loading.set(true);
    this.error.set('');
    const { email, password } = this.form.getRawValue();
    this.auth.login(email, password).subscribe({
      next: () => this.router.navigateByUrl(this.auth.homeUrl()),
      error: (e) => {
        this.error.set(errorMessage(e));
        this.loading.set(false);
      },
    });
  }
}
