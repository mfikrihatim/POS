import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService } from './api.service';
import { AppConfig } from './models';

declare global {
  interface Window {
    snap?: {
      pay: (token: string, opts: { onSuccess?: (r: any) => void; onPending?: (r: any) => void; onError?: (r: any) => void; onClose?: () => void }) => void;
    };
  }
}

@Injectable({ providedIn: 'root' })
export class ConfigService {
  private api = inject(ApiService);
  readonly config = signal<AppConfig | null>(null);
  private snapLoading?: Promise<void>;

  async load() {
    if (this.config()) return this.config()!;
    const c = await firstValueFrom(this.api.get<AppConfig>('/config'));
    this.config.set(c);
    return c;
  }

  /** Muat Midtrans Snap.js sesuai environment (sandbox/production) */
  loadSnap(): Promise<void> {
    const c = this.config();
    if (!c?.midtrans.enabled) return Promise.reject(new Error('Midtrans belum dikonfigurasi'));
    if (window.snap) return Promise.resolve();
    this.snapLoading ??= new Promise<void>((resolve, reject) => {
      const s = document.createElement('script');
      s.src = c.midtrans.isProduction ? 'https://app.midtrans.com/snap/snap.js' : 'https://app.sandbox.midtrans.com/snap/snap.js';
      s.setAttribute('data-client-key', c.midtrans.clientKey);
      s.onload = () => resolve();
      s.onerror = () => { this.snapLoading = undefined; reject(new Error('Gagal memuat Midtrans Snap')); };
      document.body.appendChild(s);
    });
    return this.snapLoading;
  }
}
