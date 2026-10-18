import { Component, computed, input, output } from '@angular/core';
import { PageMeta } from '../core/models';

@Component({
  selector: 'app-pagination',
  template: `
    @if (meta(); as m) {
      <div class="pagination">
        <span class="muted">
          Menampilkan {{ m.total ? (m.page - 1) * m.limit + 1 : 0 }}–{{ Math.min(m.page * m.limit, m.total) }} dari {{ m.total }} data
        </span>
        <div class="pager">
          <select class="input input-sm" [value]="m.limit" (change)="limitChange.emit(+$any($event.target).value)" aria-label="Jumlah per halaman">
            @for (l of limits(); track l) { <option [value]="l">{{ l }} / hal</option> }
          </select>
          <button class="btn btn-sm" [disabled]="m.page <= 1" (click)="pageChange.emit(m.page - 1)">‹</button>
          @for (p of pages(); track $index) {
            @if (p === 0) { <span class="muted">…</span> }
            @else { <button class="btn btn-sm" [class.btn-primary]="p === m.page" (click)="pageChange.emit(p)">{{ p }}</button> }
          }
          <button class="btn btn-sm" [disabled]="m.page >= m.totalPages" (click)="pageChange.emit(m.page + 1)">›</button>
        </div>
      </div>
    }
  `,
})
export class PaginationComponent {
  meta = input<PageMeta | null>(null);
  limits = input<number[]>([10, 20, 50]);
  pageChange = output<number>();
  limitChange = output<number>();
  protected Math = Math;

  pages = computed(() => {
    const m = this.meta();
    if (!m) return [];
    const total = m.totalPages;
    const cur = m.page;
    const set = new Set([1, total, cur - 1, cur, cur + 1].filter((p) => p >= 1 && p <= total));
    const sorted = [...set].sort((a, b) => a - b);
    const out: number[] = [];
    sorted.forEach((p, i) => {
      if (i && p - sorted[i - 1] > 1) out.push(0);
      out.push(p);
    });
    return out;
  });
}
