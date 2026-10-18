import { Routes } from '@angular/router';
import { authGuard, guestGuard, roleGuard } from './core/guards';
import { ShellComponent } from './layout/shell.component';

export const routes: Routes = [
  { path: 'login', canActivate: [guestGuard], loadComponent: () => import('./pages/login/login.component').then((m) => m.LoginComponent) },
  {
    path: '',
    component: ShellComponent,
    canActivate: [authGuard],
    children: [
      { path: 'kasir', title: 'Layar Kasir', loadComponent: () => import('./pages/kasir/kasir.component').then((m) => m.KasirComponent) },
      { path: 'transaksi', title: 'Transaksi', loadComponent: () => import('./pages/transaksi/transaksi.component').then((m) => m.TransaksiComponent) },
      { path: 'produk', title: 'Katalog Produk', canActivate: [roleGuard('admin')], loadComponent: () => import('./pages/produk/produk.component').then((m) => m.ProdukComponent) },
      { path: 'stok', title: 'Manajemen Stok', canActivate: [roleGuard('admin')], loadComponent: () => import('./pages/stok/stok.component').then((m) => m.StokComponent) },
      { path: 'laporan', title: 'Laporan Penjualan', canActivate: [roleGuard('admin')], loadComponent: () => import('./pages/laporan/laporan.component').then((m) => m.LaporanComponent) },
      { path: 'pengguna', title: 'Akun & Akses', canActivate: [roleGuard('admin')], loadComponent: () => import('./pages/pengguna/pengguna.component').then((m) => m.PenggunaComponent) },
      { path: '', pathMatch: 'full', redirectTo: 'kasir' },
    ],
  },
  { path: '**', redirectTo: '' },
];
