import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService, errorMessage } from '../../core/api.service';
import { PageMeta, Paged, Transaction } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { AuthService } from '../../core/auth.service';
import { PaginationComponent } from '../../shared/pagination.component';
import { LabelPipe, RupiahPipe, TanggalPipe } from '../../shared/pipes';
import { ReceiptDialogComponent } from '../../shared/receipt-dialog.component';

@Component({
  selector: 'app-transaksi',
  imports: [FormsModule, PaginationComponent, RupiahPipe, TanggalPipe, LabelPipe, ReceiptDialogComponent],
  template: `
    <div class="page-head">
      <div>
        <h1>Pembayaran & Struk</h1>
        <p class="muted">{{ auth.isAdmin() ? 'Semua transaksi' : 'Transaksi yang Anda proses' }} · klik baris untuk melihat struk, kirim email, atau cek status Midtrans.</p>
      </div>
    </div>

    <div class="card">
      <div class="filters">
        <input class="input" type="search" placeholder="Cari invoice / pelanggan…" [(ngModel)]="f.search" (keyup.enter)="reload()" />
        <select class="input" [(ngModel)]="f.status" (change)="reload()">
          <option value="">Semua status</option>
          <option value="paid">Lunas</option>
          <option value="pending">Menunggu</option>
          <option value="failed">Gagal</option>
          <option value="expired">Kedaluwarsa</option>
          <option value="cancelled">Dibatalkan</option>
        </select>
        <select class="input" [(ngModel)]="f.method" (change)="reload()">
          <option value="">Semua metode</option>
          <option value="cash">Tunai</option>
          <option value="midtrans">Midtrans</option>
        </select>
        <input class="input" type="date" [(ngModel)]="f.from" (change)="reload()" aria-label="Dari tanggal" />
        <input class="input" type="date" [(ngModel)]="f.to" (change)="reload()" aria-label="Sampai tanggal" />
        <button class="btn" (click)="reload()">Cari</button>
      </div>

      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th class="sortable" (click)="sortBy('invoice_no')">Invoice {{ arrow('invoice_no') }}</th>
              <th class="sortable" (click)="sortBy('created_at')">Waktu {{ arrow('created_at') }}</th>
              <th>Kasir</th>
              <th>Pelanggan</th>
              <th class="num">Item</th>
              <th class="sortable num" (click)="sortBy('total')">Total {{ arrow('total') }}</th>
              <th>Metode</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            @for (t of rows(); track t.id) {
              <tr class="clickable" (click)="open(t)">
                <td><b>{{ t.invoice_no }}</b></td>
                <td>{{ t.created_at | tanggal }}</td>
                <td>{{ t.cashier_name || '-' }}</td>
                <td>{{ t.customer_name || '-' }}</td>
                <td class="num">{{ t.item_count }}</td>
                <td class="num">{{ t.total | rupiah }}</td>
                <td>{{ t.payment_method | label }}@if (t.payment_type) {<span class="muted small"> · {{ t.payment_type | label }}</span>}</td>
                <td><span class="status status-{{ t.payment_status }}">{{ t.payment_status | label }}</span></td>
              </tr>
            } @empty {
              <tr><td colspan="8" class="empty">{{ loading() ? 'Memuat…' : 'Belum ada transaksi.' }}</td></tr>
            }
          </tbody>
        </table>
      </div>
      <app-pagination [meta]="meta()" (pageChange)="page = $event; load()" (limitChange)="limit = $event; reload()" />
    </div>

    @if (selected(); as t) {
      <app-receipt-dialog [trx]="t" (close)="selected.set(null)" (updated)="selected.set($event); load()" />
    }
  `,
})
export class TransaksiComponent {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  protected auth = inject(AuthService);

  protected rows = signal<Transaction[]>([]);
  protected meta = signal<PageMeta | null>(null);
  protected loading = signal(false);
  protected selected = signal<Transaction | null>(null);
  protected f = { search: '', status: '', method: '', from: '', to: '' };
  protected page = 1;
  protected limit = 10;
  protected sort = 'created_at:desc';

  constructor() { this.load(); }

  reload() { this.page = 1; this.load(); }

  load() {
    this.loading.set(true);
    this.api.get<Paged<Transaction>>('/transactions', { ...this.f, page: this.page, limit: this.limit, sort: this.sort }).subscribe({
      next: (r) => { this.rows.set(r.data); this.meta.set(r.meta); this.loading.set(false); },
      error: (e) => { this.toast.error(errorMessage(e)); this.loading.set(false); },
    });
  }

  sortBy(field: string) {
    const [cur, dir] = this.sort.split(':');
    this.sort = `${field}:${cur === field && dir === 'desc' ? 'asc' : 'desc'}`;
    this.load();
  }
  arrow(field: string) {
    const [cur, dir] = this.sort.split(':');
    return cur === field ? (dir === 'desc' ? '▼' : '▲') : '';
  }

  open(t: Transaction) {
    this.api.get<Transaction>(`/transactions/${t.id}`).subscribe({
      next: (d) => this.selected.set(d),
      error: (e) => this.toast.error(errorMessage(e)),
    });
  }
}
