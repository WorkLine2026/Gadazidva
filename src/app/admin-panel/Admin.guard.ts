import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { SmsVerificationService, UserProfile } from '../services/smsverifikation.service';

export const adminGuard: CanActivateFn = () => {
  const smsService = inject(SmsVerificationService);
  const router = inject(Router);

  if (!smsService.isAuthenticated()) {
    return router.createUrlTree(['/admin/login']);
  }

  const check = (user: UserProfile | null | undefined) =>
    user?.role === 'admin' ? true : router.createUrlTree(['/home']);

  const current = smsService.getCurrentUser();
  if (current) return check(current);

  // ✅ გვერდის განახლებისას token არსებობს, მაგრამ user ჯერ არ ჩატვირთულა —
  // ამიტომ პროფილს ველოდებით, სანამ role-ს შევამოწმებთ
  return smsService.getProfile().pipe(
    map((res) => check(res.user)),
    catchError(() => of(router.createUrlTree(['/admin/login'])))
  );
};