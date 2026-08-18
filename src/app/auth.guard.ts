import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

/**
 * Keeps signed-out visitors out of the areas the menu leads to. Asks Amplify rather than
 * reading the cached user, because on a cold load the session hasn't resolved yet and the
 * cached value would still be null.
 */
export const authGuard: CanActivateFn = async () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  return (await authService.isAuthenticated()) || router.parseUrl('/home');
};
