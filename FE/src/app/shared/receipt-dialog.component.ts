import { Component, inject, input, output, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService, errorMessage } from '../core/api.service';
import { ConfigService } from '../core/config.service';
import { Transaction } from '../core/models';
import { ToastService } from '../core/toast.service';
import { ModalComponent } from './modal.component';
import { ReceiptComponent } from './receipt.component';

@Component({
  selector: 'app-receipt-dialog',
  imports: [ModalComponent, ReceiptComponent, FormsModule],
  template: `
    <app-modal [title]="'Struk ' + trx().invoice_no" (close)="close.emit()">
      <app-receipt [trx]="trx()" />
      <div class="receipt-actions">
        <div class="input-group">
          <input class="input" type="email" placeholder="email@pelanggan.com" [(ngModel)]="email" name="email" />
          <button class="btn" (click)="sendEmail()" [disabled]="sending()">{{ sending() ? 'Mengirim…' : '📧 Kirim' }}</button>
        </div>
        <div class="row-actions">
          @if (trx().payment_status === 'pending' && trx().payment_method === 'midtrans') {
            @if (config.config()?.midtrans?.enabled) {
              @if (trx().snap_token) { <button class="btn btn-primary" (click)="payAgain()">💳 Lanjutkan Bayar</button> }
              <button class="btn" (click)="check()" [disabled]="busy()">🔄 Cek Status</button>
            } @else {
              <button class="btn btn-success" (click)="simulate('paid')" [disabled]="busy()">✔ Simulasi Lunas</button>
              <button class="btn btn-danger" (click)="simulate('failed')" [disabled]="busy()">✕ Simulasi Gagal</button>
            }
            <button class="btn" (click)="cancel()" [disabled]="busy()">Batalkan</button>
          }
          <button class="btn" (click)="receipt().print()">🖨 Cetak</button>
        </div>
      </div>
    </app-modal>
  `,
})
export class ReceiptDialogComponent {
  trx = input.required<Transaction>();
  close = output<void>();
  updated = output<Transaction>();

  protected config = inject(ConfigService);
  private api = inject(ApiService);
  private toast = inject(ToastService);
  private receipt = viewChild.required(ReceiptComponent);
  protected email = '';
  protected sending = signal(false);
  protected busy = signal(false);

  ngOnInit() {
    this.email = this.trx().customer_email || '';
  }

  sendEmail() {
    if (!/^\S+@\S+\.\S+$/.test(this.email)) return this.toast.error('Masukkan email yang valid');
    this.sending.set(true);
    this.api.post<{ message: string }>(`/transactions/${this.trx().id}/email`, { email: this.email }).subscribe({
      next: (r) => { this.toast.success(r.message); this.sending.set(false); },
      error: (e) => { this.toast.error(errorMessage(e)); this.sending.set(false); },
    });
  }

  private apply(obs: ReturnType<ApiService['post']>, msg?: string) {
    this.busy.set(true);
    obs.subscribe({
      next: (t: any) => {
        this.busy.set(false);
        this.updated.emit(t);
        this.toast.info(msg || `Status: ${t.payment_status}`);
      },
      error: (e) => { this.busy.set(false); this.toast.error(errorMessage(e)); },
    });
  }

  check() { this.apply(this.api.post(`/payments/${this.trx().id}/check`)); }
  simulate(status: 'paid' | 'failed') { this.apply(this.api.post(`/payments/${this.trx().id}/simulate`, { status, payment_type: 'qris' }), status === 'paid' ? 'Pembayaran lunas (simulasi)' : 'Pembayaran gagal, stok dikembalikan'); }
  cancel() {
    if (!confirm('Batalkan transaksi ini? Stok akan dikembalikan.')) return;
    this.apply(this.api.post(`/transactions/${this.trx().id}/cancel`), 'Transaksi dibatalkan');
  }

  async payAgain() {
    try {
      await this.config.loadSnap();
      window.snap!.pay(this.trx().snap_token!, {
        onSuccess: () => this.check(),
        onPending: () => this.check(),
        onError: () => this.check(),
        onClose: () => this.check(),
      });
    } catch (e: any) {
      this.toast.error(e.message);
    }
  }
}
