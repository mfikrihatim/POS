import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';
import { Role } from './models';

export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return auth.user() ? true : inject(Router).createUrlTree(['/login']);
};

export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return auth.user() ? inject(Router).createUrlTree([auth.homeUrl()]) : true;
};

export const roleGuard = (...roles: Role[]): CanActivateFn => () => {
  const auth = inject(AuthService);
  const role = auth.user()?.role;
  return role && roles.includes(role) ? true : inject(Router).createUrlTree([auth.homeUrl()]);
};
