import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Capacitor } from '@capacitor/core';
import { SmsVerificationService } from '../../services/smsverifikation.service';

@Component({
  selector: 'app-android-login',
  styleUrl: './android-login-component.scss',
  templateUrl: './android-login-component.html',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule]
})
export class AndroidLoginComponent implements OnInit {
  loginForm!: FormGroup;
  isLoading = false;
  errorMessage = '';

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private smsService: SmsVerificationService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.initializeForm();
  }

  private initializeForm(): void {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]]
    });
  }

  onLogin(): void {
    this.errorMessage = '';

    if (this.loginForm.invalid) {
      this.markFormAsTouched();
      return;
    }

    this.performLogin();
  }

  private performLogin(): void {
    this.isLoading = true;
    const { email, password } = this.loginForm.value;

    this.smsService.login(email, password).subscribe({
      next: (res) => {
        this.isLoading = false;

        if (res.success) {
          if (res.token) {
            this.smsService.setAuthToken(res.token);
          }

          const role = res.user?.role;
          const isNative = Capacitor.isNativePlatform();

          if (isNative) {
            // Android / iOS
            this.router.navigate(
              [role === 'driver' ? '/driverProfile-android' : '/senderProfile-android'],
              { replaceUrl: true }
            );
          } else {
            // Web
            this.router.navigate(
              [role === 'driver' ? '/driverProfile' : '/senderProfile'],
              { replaceUrl: true }
            );
          }
        } else {
          this.errorMessage = res.message || 'შესვლა ვერ მოხერხდა, სცადეთ ხელახლა';
        }

        this.cdr.detectChanges();
      },
      error: (err) => {
        this.isLoading = false;

        if (err.status === 401 || err.status === 400) {
          this.errorMessage = err.error?.message || 'ელფოსტა ან პაროლი არასწორია';
        } else if (err.status === 0) {
          this.errorMessage = 'კავშირის შეცდომა - ვერ მოხერხდა სერვერთან დაკავშირება';
        } else {
          this.errorMessage = 'შესვლა ვერ მოხერხდა, სცადეთ თავიდან';
        }

        console.error('შესვლის შეცდომა:', err);
        this.cdr.detectChanges();
      }
    });
  }

  goToRegister(): void {
    this.router.navigate(['/register']);
  }

  goToForgotPassword(): void {
    this.router.navigate(['/forgot-password']);
  }

  private markFormAsTouched(): void {
    Object.values(this.loginForm.controls).forEach(control => {
      control.markAsTouched();
    });
  }
}