import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

export const API = '/api';

type Params = Record<string, string | number | boolean | null | undefined>;

@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);

  private params(p?: Params) {
    let hp = new HttpParams();
    Object.entries(p || {}).forEach(([k, v]) => {
      if (v !== null && v !== undefined && v !== '') hp = hp.set(k, String(v));
    });
    return hp;
  }

  get<T>(url: string, params?: Params) {
    return this.http.get<T>(API + url, { params: this.params(params) });
  }
  post<T>(url: string, body: unknown = {}) {
    return this.http.post<T>(API + url, body);
  }
  put<T>(url: string, body: unknown) {
    return this.http.put<T>(API + url, body);
  }
  delete<T>(url: string) {
    return this.http.delete<T>(API + url);
  }
  blob(url: string, params?: Params) {
    return this.http.get(API + url, { params: this.params(params), responseType: 'blob' });
  }
}

/** Ambil pesan error yang ramah dari respons API */
export function errorMessage(err: any): string {
  return err?.error?.message || (err?.status === 0 ? 'Tidak dapat terhubung ke server' : 'Terjadi kesalahan');
}

/** Peta field -> pesan dari error validasi 422 */
export function fieldErrors(err: any): Record<string, string> {
  const out: Record<string, string> = {};
  (err?.error?.details || []).forEach((d: { field: string; message: string }) => {
    if (d.field && !out[d.field]) out[d.field] = d.message;
  });
  return out;
}
