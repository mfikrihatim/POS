import { Component, computed, input, signal } from '@angular/core';

@Component({
  selector: 'app-product-image',
  template: `
    @if (src() && !broken()) {
      <img [src]="src()" [alt]="name()" loading="lazy" (error)="broken.set(true)" />
    } @else {
      <div class="img-fallback">{{ initials() }}</div>
    }
  `,
  host: { class: 'product-image' },
})
export class ProductImageComponent {
  src = input<string | null>(null);
  name = input('');
  broken = signal(false);
  initials = computed(() => this.name().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase());
}
