import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { tap } from 'rxjs';
import { ApiService } from './api.service';
import { User } from './models';

const KEY = 'pos_session';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private api = inject(ApiService);
  private router = inject(Router);

  private session = signal<{ token: string; user: User } | null>(this.restore());
  readonly user = computed(() => this.session()?.user ?? null);
  readonly token = computed(() => this.session()?.token ?? null);
  readonly isAdmin = computed(() => this.user()?.role === 'admin');

  private restore() {
    try {
      return JSON.parse(localStorage.getItem(KEY) || 'null');
    } catch {
      return null;
    }
  }

  login(email: string, password: string) {
    return this.api.post<{ token: string; user: User }>('/auth/login', { email, password }).pipe(
      tap((s) => {
        this.session.set(s);
        localStorage.setItem(KEY, JSON.stringify(s));
      }),
    );
  }

  logout(redirect = true) {
    this.session.set(null);
    localStorage.removeItem(KEY);
    if (redirect) this.router.navigate(['/login']);
  }

  homeUrl() {
    return this.isAdmin() ? '/laporan' : '/kasir';
  }
}
