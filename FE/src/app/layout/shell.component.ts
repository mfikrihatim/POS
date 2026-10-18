import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { ConfigService } from '../core/config.service';
import { LabelPipe } from '../shared/pipes';

interface NavItem { path: string; label: string; icon: string; admin?: boolean }

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, LabelPipe],
  template: `
    <div class="shell" [class.nav-open]="navOpen()">
      <aside class="sidebar">
        <div class="brand">
          <div class="brand-logo">P</div>
          <div>
            <div class="brand-name">{{ config.config()?.store?.name || 'POS' }}</div>
            <div class="brand-sub">Point of Sale</div>
          </div>
        </div>
        <nav>
          @for (n of nav(); track n.path) {
            <a [routerLink]="n.path" routerLinkActive="active" (click)="navOpen.set(false)">
              <span class="nav-icon">{{ n.icon }}</span>{{ n.label }}
            </a>
          }
        </nav>
        <div class="sidebar-foot">
          @if (config.config(); as c) {
            <div class="pill" [class.pill-ok]="c.midtrans.enabled">Midtrans: {{ c.midtrans.enabled ? (c.midtrans.isProduction ? 'Production' : 'Sandbox') : 'Simulasi' }}</div>
            <div class="pill" [class.pill-ok]="c.smtpEnabled">Email: {{ c.smtpEnabled ? 'SMTP aktif' : 'Mode simpan file' }}</div>
          }
        </div>
      </aside>
      <div class="main">
        <header class="topbar">
          <button class="icon-btn menu-btn" (click)="navOpen.set(!navOpen())" aria-label="Menu">☰</button>
          <div class="spacer"></div>
          <div class="user-chip">
            <div class="avatar">{{ initials() }}</div>
            <div>
              <div class="user-name">{{ auth.user()?.name }}</div>
              <div class="muted small">{{ auth.user()?.role | label }}</div>
            </div>
          </div>
          <button class="btn btn-sm" (click)="auth.logout()">Keluar</button>
        </header>
        <main class="content"><router-outlet /></main>
      </div>
      <div class="nav-overlay" (click)="navOpen.set(false)"></div>
    </div>
  `,
})
export class ShellComponent {
  protected auth = inject(AuthService);
  protected config = inject(ConfigService);
  protected navOpen = signal(false);

  private items: NavItem[] = [
    { path: '/kasir', label: 'Layar Kasir', icon: '🛒' },
    { path: '/transaksi', label: 'Pembayaran & Struk', icon: '🧾' },
    { path: '/produk', label: 'Katalog Produk', icon: '📦', admin: true },
    { path: '/stok', label: 'Manajemen Stok', icon: '📊', admin: true },
    { path: '/laporan', label: 'Laporan Penjualan', icon: '📈', admin: true },
    { path: '/pengguna', label: 'Akun & Akses', icon: '👥', admin: true },
  ];
  protected nav = computed(() => this.items.filter((i) => !i.admin || this.auth.isAdmin()));
  protected initials = computed(() => (this.auth.user()?.name || '?').split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase());
}
