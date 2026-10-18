import { Component, ElementRef, inject, input, viewChild } from '@angular/core';
import { Transaction } from '../core/models';
import { ConfigService } from '../core/config.service';
import { LabelPipe, RupiahPipe, TanggalPipe } from './pipes';

@Component({
  selector: 'app-receipt',
  imports: [RupiahPipe, TanggalPipe, LabelPipe],
  template: `
    <div class="receipt" #paper>
      <div class="r-center">
        <div class="r-store">{{ store()?.name }}</div>
        <div class="r-muted">{{ store()?.address }}</div>
        <div class="r-muted">Telp. {{ store()?.phone }}</div>
      </div>
      <div class="r-sep"></div>
      <div class="r-row"><span>No.</span><b>{{ trx().invoice_no }}</b></div>
      <div class="r-row"><span>Tanggal</span><span>{{ trx().created_at | tanggal }}</span></div>
      <div class="r-row"><span>Kasir</span><span>{{ trx().cashier_name || '-' }}</span></div>
      @if (trx().customer_name) { <div class="r-row"><span>Pelanggan</span><span>{{ trx().customer_name }}</span></div> }
      <div class="r-sep"></div>
      @for (i of trx().items; track i.id) {
        <div class="r-item">
          <div>{{ i.product_name }}</div>
          <div class="r-row"><span class="r-muted">{{ i.qty }} x {{ i.price | rupiah }}</span><span>{{ i.subtotal | rupiah }}</span></div>
        </div>
      }
      <div class="r-sep"></div>
      <div class="r-row"><span>Subtotal</span><span>{{ trx().subtotal | rupiah }}</span></div>
      @if (trx().discount) { <div class="r-row"><span>Diskon</span><span>- {{ trx().discount | rupiah }}</span></div> }
      <div class="r-row"><span>PPN {{ store()?.taxPercent }}%</span><span>{{ trx().tax | rupiah }}</span></div>
      <div class="r-row r-total"><span>TOTAL</span><span>{{ trx().total | rupiah }}</span></div>
      <div class="r-row"><span>Metode</span><span>{{ trx().payment_method | label }}{{ trx().payment_type ? ' · ' + (trx().payment_type | label) : '' }}</span></div>
      @if (trx().cash_received) {
        <div class="r-row"><span>Tunai</span><span>{{ trx().cash_received | rupiah }}</span></div>
        <div class="r-row"><span>Kembali</span><span>{{ trx().change_amount | rupiah }}</span></div>
      }
      <div class="r-status r-status-{{ trx().payment_status }}">{{ trx().payment_status | label }}</div>
      <div class="r-center r-muted r-thanks">Terima kasih telah berbelanja!</div>
    </div>
  `,
})
export class ReceiptComponent {
  trx = input.required<Transaction>();
  protected store = () => this.config.config()?.store;
  private config = inject(ConfigService);
  private paper = viewChild.required<ElementRef<HTMLElement>>('paper');

  print() {
    const w = window.open('', '_blank', 'width=380,height=640');
    if (!w) return;
    const css = `body{font-family:'Courier New',monospace;font-size:12px;margin:0;padding:12px;color:#000}
      .r-center{text-align:center}.r-store{font-weight:700;font-size:15px}.r-muted{color:#444}
      .r-sep{border-top:1px dashed #000;margin:8px 0}.r-row{display:flex;justify-content:space-between;gap:8px}
      .r-item{margin:4px 0}.r-total{font-weight:700;font-size:14px;margin:4px 0}
      .r-status{text-align:center;font-weight:700;border:1px solid #000;margin-top:8px;padding:4px;text-transform:uppercase}
      .r-thanks{margin-top:10px}`;
    w.document.write(`<html><head><title>${this.trx().invoice_no}</title><style>${css}</style></head><body>${this.paper().nativeElement.innerHTML}</body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); w.close(); }, 250);
  }
}
