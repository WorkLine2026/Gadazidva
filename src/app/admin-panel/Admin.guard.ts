import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SmsVerificationService } from '../services/smsverifikation.service';

export const adminGuard: CanActivateFn = () => {
  const smsService = inject(SmsVerificationService);
  const router = inject(Router);

  if (!smsService.isAuthenticated()) {
    router.navigate(['/admin/login']);
    return false;
  }

  const user = smsService.getCurrentUser();

  if (user?.role !== 'admin') {
    router.navigate(['/home']);
    return false;
  }

  return true;
};