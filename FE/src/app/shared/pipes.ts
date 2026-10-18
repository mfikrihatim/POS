import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'rupiah' })
export class RupiahPipe implements PipeTransform {
  transform(v: number | null | undefined): string {
    return 'Rp ' + Math.round(Number(v) || 0).toLocaleString('id-ID');
  }
}

@Pipe({ name: 'tanggal' })
export class TanggalPipe implements PipeTransform {
  transform(v: string | null | undefined, withTime = true): string {
    if (!v) return '-';
    return new Date(v).toLocaleString('id-ID', {
      day: '2-digit', month: 'short', year: 'numeric',
      ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
    });
  }
}

const STATUS: Record<string, string> = {
  paid: 'Lunas', pending: 'Menunggu', failed: 'Gagal', expired: 'Kedaluwarsa', cancelled: 'Dibatalkan',
  in: 'Masuk', out: 'Keluar', adjustment: 'Penyesuaian', sale: 'Penjualan', return: 'Retur',
  cash: 'Tunai', midtrans: 'Midtrans', admin: 'Admin', kasir: 'Kasir',
};

@Pipe({ name: 'label' })
export class LabelPipe implements PipeTransform {
  transform(v: string | null | undefined): string {
    if (!v) return '-';
    return STATUS[v] ?? v.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }
}
