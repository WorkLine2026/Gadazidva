import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

const TOKEN_KEY = 'authToken';

function readRole(token: string): string | null {
  try {
    const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = JSON.parse(decodeURIComponent(escape(atob(payload))));
    if (json.exp && json.exp * 1000 < Date.now()) return null; // ვადაგასული
    return json.role || null;
  } catch {
    return null;
  }
}

export const adminGuard: CanActivateFn = () => {
  const router = inject(Router);
  const token = localStorage.getItem(TOKEN_KEY);

  if (!token) {
    return router.createUrlTree(['/admin/login']);
  }

  const role = readRole(token);
  if (role === 'admin') return true;

  localStorage.removeItem(TOKEN_KEY);
  return router.createUrlTree(['/admin/login']);
};