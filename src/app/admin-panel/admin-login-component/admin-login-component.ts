import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { SmsVerificationService } from '../../services/smsverifikation.service';

@Component({
  selector: 'app-admin-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-login-component.html',
  styleUrls: ['./admin-login-component.scss']
})
export class AdminLoginComponent {
  email = '';
  password = '';
  showPassword = false;

  isLoading = false;
  errorMessage = '';

  constructor(
    private smsService: SmsVerificationService,
    private router: Router
  ) {}

  onSubmit(): void {
    this.errorMessage = '';

    if (!this.email.trim() || !this.password) {
      this.errorMessage = 'შეიყვანეთ ელფოსტა და პაროლი';
      return;
    }

    this.isLoading = true;

    // ✅ SmsVerificationService.login(email, password) — ნამდვილი სიგნატურის მიხედვით
    this.smsService.login(this.email.trim(), this.password).subscribe({
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
}