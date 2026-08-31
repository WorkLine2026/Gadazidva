import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Capacitor } from '@capacitor/core';
import { SmsVerificationService } from '../../services/smsverifikation.service';

@Component({
  selector: 'app-profile-redirect',
  standalone: true,
   styleUrl: './profile-redirect.scss',
  templateUrl: './profile-redirect.html',
})
export class ProfileRedirectComponent implements OnInit {

  constructor(
    private router: Router,
    private smsService: SmsVerificationService
  ) {}

  ngOnInit(): void {
    if (!this.smsService.isAuthenticated()) {
      this.router.navigate(['/login']);
      return;
    }

    const isNative = Capacitor.isNativePlatform();

    this.smsService.getProfile().subscribe({
      next: (res) => {
        const role = (res.user as any)?.role ?? (res.user as any)?.userType ?? 'sender';

        if (isNative) {
          this.router.navigate(
            [role === 'driver' ? '/driverProfile-android' : '/senderProfile-android'],
            { replaceUrl: true }
          );
        } else {
          this.router.navigate(
            [role === 'driver' ? '/driverProfile' : '/senderProfile'],
            { replaceUrl: true }
          );
        }
      },
      error: () => {
        this.router.navigate(['/login']);
      }
    });
  }
}

 