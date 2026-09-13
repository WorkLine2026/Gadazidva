import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { SmsVerificationService } from '../../services/smsverifikation.service';

@Component({
  selector: 'app-admin-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './admin-login-component.html',
  styleUrls: ['./admin-login-component.scss']
})
export class AdminLoginComponent {
  showPassword = false;
  isLoading = false;
  errorMessage = '';

  loginForm: FormGroup;

  constructor(
    private fb: FormBuilder,
    private smsService: SmsVerificationService,
    private router: Router
  ) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', Validators.required]
    });
  }

  onSubmit(): void {
    this.errorMessage = '';

    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      this.errorMessage = 'შეიყვანეთ ელფოსტა და პაროლი';
      return;
    }

    this.isLoading = true;
    const { email, password } = this.loginForm.value;

    // ✅ SmsVerificationService.login(email, password) — ნამდვილი სიგნატურის მიხედვით
    this.smsService.login(email.trim(), password).subscribe({
      next: (res) => {
        this.isLoading = false;

        if (!res?.success || !res.user) {
          this.errorMessage = res?.message || 'ავტორიზაცია ვერ მოხერხდა';
          return;
        }

        if (res.user.role !== 'admin') {
          // ჩვეულებრივ user-ს ადმინის panel-ში არ ვუშვებთ
          this.smsService.clearAuthToken();
          this.errorMessage = 'თქვენ არ გაქვთ ადმინისტრატორის უფლებები';
          return;
        }

        this.router.navigate(['/admin/dashboard']);
      },
      error: (err) => {
        this.isLoading = false;
        console.error('❌ admin login შეცდომა:', err);
        this.errorMessage =
          err?.error?.message || 'ელფოსტა ან პაროლი არასწორია';
      }
    });
  }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  get email() {
    return this.loginForm.get('email');
  }

  get password() {
    return this.loginForm.get('password');
  }
}