import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, AbstractControl, ValidationErrors, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { Subject, interval } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { 
  SmsVerificationService,
  SendPasswordCodeResponse,
  VerifyPasswordCodeResponse,
  ResetPasswordResponse
} from '../../services/smsverifikation.service';

@Component({
  selector: 'app-forgot-password',
  templateUrl: './forgot-password.html',
  styleUrls: ['./forgot-password.scss'],
  standalone: true,
  imports: [ReactiveFormsModule, RouterModule, CommonModule],
})
export class ForgotPasswordComponent implements OnInit, OnDestroy {
  // ფორმები
  phoneForm!: FormGroup;
  codeForm!: FormGroup;
  newPasswordForm!: FormGroup;

  // მდგომარეობა
  phoneStep: 1 | 2 | 3 = 1; // 1: ნომერი, 2: კოდი, 3: პაროლი
  isLoading: boolean = false;
  showPassword: boolean = false;
  showConfirmPassword: boolean = false;

  // ტელეფონი აღდგენა
  phoneErrorMessage: string | null = null;
  showResendBtn: boolean = false;
  resendTimer: number = 0;

  private destroy$ = new Subject<void>();

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private smsService: SmsVerificationService  
  ) {}

  ngOnInit(): void {
    this.smsService.clearState();
    this.initializePhoneForm();
    this.initializeCodeForm();
    this.initializePasswordForm();
  }

  private initializePhoneForm(): void {
    this.phoneForm = this.fb.group({
      phone: ['', [Validators.required, Validators.pattern(/^\d{9}$/)]]
    });
  }

  private initializeCodeForm(): void {
    // ✅ შეცვლილია 4-ნიშნა კოდის ვალიდაციაზე
    this.codeForm = this.fb.group({
      code: ['', [Validators.required, Validators.pattern(/^\d{4}$/)]]
    });
  }

  private initializePasswordForm(): void {
    this.newPasswordForm = this.fb.group(
      {
        password: ['', [Validators.required, Validators.minLength(8)]],
        confirmPassword: ['', [Validators.required]]
      },
      { validators: this.passwordMatchValidator }
    );
  }

  /**
   * პაროლების შედარების ვალიდატორი
   */
  private passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
    const password = control.get('password');
    const confirmPassword = control.get('confirmPassword');

    if (!password || !confirmPassword) {
      return null;
    }

    return password.value === confirmPassword.value ? null : { mismatch: true };
  }

  /**
   * ფაზა 1: ტელეფონით SMS კოდის გაგზავნა
   */
  onPhoneSendCode(): void {
    if (this.phoneForm.invalid) {
      this.phoneForm.markAllAsTouched();
      return;
    }

    this.isLoading = true;
    this.phoneErrorMessage = null;

    const phone = this.phoneForm.value.phone;
    console.log('Sending password recovery SMS code to: +995' + phone);

    this.smsService.sendPasswordRecoveryCode(phone).subscribe({
      next: (res: SendPasswordCodeResponse) => {
        console.log('Password recovery SMS sent successfully:', res);
        this.isLoading = false;
        this.phoneStep = 2;
        this.startResendTimer();
      },
      error: (err: any) => {
        this.isLoading = false;
        this.phoneErrorMessage = err?.error?.message || 'ამ ნომრით მომხმარებელი ვერ მოიძებნა.';
        console.error('SMS send error:', err);
      }
    });
  }

  /**
   * ფაზა 2: SMS კოდის დადასტურება
   */
  onCodeVerify(): void {
    if (this.codeForm.invalid) {
      this.codeForm.markAllAsTouched();
      return;
    }

    this.isLoading = true;
    this.phoneErrorMessage = null;

    const phone = this.phoneForm.value.phone;
    const code = this.codeForm.value.code;

    console.log('Verifying password recovery code:', { phone: '+995' + phone, code });

    this.smsService.verifyPasswordRecoveryCode(phone, code).subscribe({
      next: (res: VerifyPasswordCodeResponse) => {
        console.log('Password recovery code verified successfully:', res);
        
        if (res.resetToken) {
          this.smsService.setResetToken(res.resetToken);
        }
        
        this.isLoading = false;
        this.phoneStep = 3;
      },
      error: (err: any) => {
        this.isLoading = false;
        this.phoneErrorMessage = err?.error?.message || 'კოდი არასწორია.';
        console.error('Code verification error:', err);
      }
    });
  }

  /**
   * ხელახლა კოდის გაგზავნა
   */
  onResendCode(): void {
    this.phoneErrorMessage = null;
    const phone = this.phoneForm.value.phone;

    console.log('Resending password recovery code to: +995' + phone);

    this.smsService.sendPasswordRecoveryCode(phone).subscribe({
      next: (res: SendPasswordCodeResponse) => {
        console.log('Code resent successfully:', res);
        this.showResendBtn = false;
        this.startResendTimer();
      },
      error: (err: any) => {
        this.phoneErrorMessage = err?.error?.message || 'კოდის ხელახლა გაგზავნა ვერ მოხერხდა.';
        console.error('Resend error:', err);
      }
    });
  }

  /**
   * ხელახლა გაგზავნის ტიმერი (60 წამი)
   */
  private startResendTimer(): void {
    this.resendTimer = 60;
    this.showResendBtn = false;

    interval(1000)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.resendTimer--;
        if (this.resendTimer === 0) {
          this.showResendBtn = true;
        }
      });
  }

  /**
   * ფაზა 3: ახალი პაროლის დაყენება
   */
  onPasswordReset(): void {
    if (this.newPasswordForm.invalid) {
      this.newPasswordForm.markAllAsTouched();
      return;
    }

    this.isLoading = true;
    this.phoneErrorMessage = null;

    const phone = this.phoneForm.value.phone;
    const newPassword = this.newPasswordForm.value.password;

    console.log('Resetting password for phone: +995' + phone);

    this.smsService.resetPassword(phone, newPassword).subscribe({
      next: (res: ResetPasswordResponse) => {
        console.log('Password reset successfully:', res);
        this.isLoading = false;
        
        setTimeout(() => {
          this.smsService.clearState();
          this.router.navigate(['/login']);
        }, 1500);
      },
      error: (err: any) => {
        this.isLoading = false;
        this.phoneErrorMessage = err?.error?.message || 'პაროლის განახლება ვერ მოხერხდა. გთხოვთ სცადოთ მოგვიანებით.';
        console.error('Password reset error:', err);
      }
    });
  }

  /**
   * ლოგინზე დაბრუნება
   */
  goToLogin(): void {
    this.smsService.clearState();
    this.router.navigate(['/login']);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}