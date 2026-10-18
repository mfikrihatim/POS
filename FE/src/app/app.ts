import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ToastService } from './core/toast.service';
import { ConfigService } from './core/config.service';

@Component({
  imports: [RouterOutlet],
  selector: 'app-root',
  template: `
    <router-outlet />
    <div class="toasts" aria-live="polite">
      @for (t of toast.toasts(); track t.id) {
        <div class="toast toast-{{ t.type }}" (click)="toast.dismiss(t.id)">{{ t.message }}</div>
      }
    </div>
  `,
})
export class App {
  protected toast = inject(ToastService);
  constructor() {
    inject(ConfigService).load().catch(() => null);
  }
}
