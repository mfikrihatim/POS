import { Component, ElementRef, OnDestroy, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Chart, registerables } from 'chart.js';
import { ApiService, errorMessage } from '../../core/api.service';
import { SalesReport } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { LabelPipe, RupiahPipe } from '../../shared/pipes';

Chart.register(...registerables);

const ymd = (d: Date) => d.toLocaleDateString('sv-SE');
const COLORS = ['#4f46e5', '#0ea5e9', '#22c55e', '#f59e0b', '#ef4444', '#a855f7', '#14b8a6'];

@Component({
  selector: 'app-laporan',
  imports: [FormsModule, RupiahPipe, LabelPipe],
  templateUrl: './laporan.component.html',
})
export class LaporanComponent implements OnDestroy {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  private dailyCanvas = viewChild<ElementRef<HTMLCanvasElement>>('daily');
  private methodCanvas = viewChild<ElementRef<HTMLCanvasElement>>('method');
  private charts: Chart[] = [];

  protected report = signal<SalesReport | null>(null);
  protected loading = signal(false);
  protected preset = signal('30');
  protected from = '';
  protected to = '';
  protected email = '';
  protected sending = signal(false);

  constructor() {
    this.applyPreset('30');
  }

  applyPreset(p: string) {
    this.preset.set(p);
    const now = new Date();
    const start = new Date(now);
    if (p === 'today') { /* hari ini */ }
    else if (p === 'month') start.setDate(1);
    else start.setDate(now.getDate() - (Number(p) - 1));
    this.from = ymd(start);
    this.to = ymd(now);
    this.load();
  }

  load() {
    if (this.from > this.to) return this.toast.error('Tanggal awal harus sebelum tanggal akhir');
    this.loading.set(true);
    this.api.get<SalesReport>('/reports/sales', { from: this.from, to: this.to }).subscribe({
      next: (r) => {
        this.report.set(r);
        this.loading.set(false);
        setTimeout(() => this.renderCharts(r));
      },
      error: (e) => { this.toast.error(errorMessage(e)); this.loading.set(false); },
    });
  }

  private renderCharts(r: SalesReport) {
    this.charts.forEach((c) => c.destroy());
    this.charts = [];
    const d = this.dailyCanvas()?.nativeElement;
    const m = this.methodCanvas()?.nativeElement;
    if (d) {
      this.charts.push(new Chart(d, {
        type: 'bar',
        data: {
          labels: r.daily.map((x) => new Date(x.date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })),
          datasets: [
            { type: 'bar', label: 'Omzet', data: r.daily.map((x) => x.revenue), backgroundColor: '#4f46e5cc', borderRadius: 4, yAxisID: 'y' },
            { type: 'line', label: 'Transaksi', data: r.daily.map((x) => x.transactions), borderColor: '#f59e0b', backgroundColor: '#f59e0b', tension: 0.3, yAxisID: 'y1' },
          ],
        },
        options: {
          responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
          scales: {
            y: { ticks: { callback: (v) => 'Rp ' + (Number(v) / 1000).toLocaleString('id-ID') + 'rb' } },
            y1: { position: 'right', grid: { drawOnChartArea: false }, beginAtZero: true },
          },
          plugins: { tooltip: { callbacks: { label: (c) => c.dataset.label === 'Omzet' ? 'Omzet: Rp ' + Number(c.raw).toLocaleString('id-ID') : `Transaksi: ${c.raw}` } } },
        },
      }));
    }
    if (m) {
      this.charts.push(new Chart(m, {
        type: 'doughnut',
        data: {
          labels: r.byMethod.map((x) => new LabelPipe().transform(x.method)),
          datasets: [{ data: r.byMethod.map((x) => x.revenue), backgroundColor: COLORS }],
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } },
      }));
    }
  }

  exportCsv() {
    this.api.blob('/reports/sales.csv', { from: this.from, to: this.to }).subscribe({
      next: (blob) => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `laporan-penjualan-${this.from}_${this.to}.csv`;
        a.click();
        URL.revokeObjectURL(a.href);
      },
      error: (e) => this.toast.error(errorMessage(e)),
    });
  }

  sendEmail() {
    if (!/^\S+@\S+\.\S+$/.test(this.email)) return this.toast.error('Masukkan email yang valid');
    this.sending.set(true);
    this.api.post<{ message: string }>('/reports/sales/email', { email: this.email, from: this.from, to: this.to }).subscribe({
      next: (r) => { this.toast.success(r.message); this.sending.set(false); },
      error: (e) => { this.toast.error(errorMessage(e)); this.sending.set(false); },
    });
  }

  pct(v: number, total: number) {
    return total ? Math.round((v / total) * 100) : 0;
  }

  ngOnDestroy() {
    this.charts.forEach((c) => c.destroy());
  }
}
