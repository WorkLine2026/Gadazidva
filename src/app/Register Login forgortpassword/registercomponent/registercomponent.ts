import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, ChangeDetectorRef } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators
} from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { SmsVerificationService } from '../../services/smsverifikation.service';

type UserRole = 'sender' | 'driver';
type RegistrationStep = 'form' | 'verification';

const RESEND_COOLDOWN_SECONDS = 30;

@Component({
  selector: 'app-register',
  templateUrl: './registercomponent.html',
  styleUrls: ['./registercomponent.scss'],
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  standalone: true,
})
export class RegisterComponent implements OnInit, OnDestroy {
  registerForm!: FormGroup;
  verificationForm!: FormGroup;

  activeRole: UserRole = 'sender';
  currentStep: RegistrationStep = 'form';

  isLoading = false;
  isSendingCode = false;
  isVerifying = false;

  errorMessage: string | null = null;
  verificationError: string | null = null;

  resendCooldown = 0;
  private cooldownTimer: ReturnType<typeof setInterval> | null = null;

  showCodeHint = true;
  generatedCodeHint: string | null = null;

  constructor(
    private fb: FormBuilder,
    private smsService: SmsVerificationService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.initForm();
    this.initVerificationForm();
    this.applyRoleValidators(this.activeRole);
  }

  ngOnDestroy(): void {
    this.clearCooldownTimer();
  }

  private initForm(): void {
    this.registerForm = this.fb.group(
      {
        firstName: ['', [Validators.required, Validators.minLength(2)]],
        lastName: ['', [Validators.required, Validators.minLength(2)]],
        personalNumber: ['', [Validators.required, Validators.pattern(/^\d{11}$/)]],
        phone: ['', [Validators.required, Validators.pattern(/^[5]\d{8}$/)]],
        email: ['', [Validators.required, Validators.email]],
        password: ['', [Validators.required, Validators.minLength(6)]],
        confirmPassword: ['', [Validators.required]],
        agreeTerms: [false, [Validators.requiredTrue]],

        carModel: [''],
        carPlate: [''],
        driverLicenseNumber: [''],
      },
      { validators: this.passwordMatchValidator }
    );
  }

  private initVerificationForm(): void {
    this.verificationForm = this.fb.group({
      code: ['', [Validators.required, Validators.pattern(/^\d{4}$/)]],
    });
  }

  selectRole(role: UserRole): void {
    this.activeRole = role;
    this.errorMessage = null;
    this.applyRoleValidators(role);
  }

  private applyRoleValidators(role: UserRole): void {
    const carModel = this.registerForm.get('carModel');
    const carPlate = this.registerForm.get('carPlate');
    const driverLicenseNumber = this.registerForm.get('driverLicenseNumber');

    if (role === 'driver') {
      carModel?.setValidators([Validators.required, Validators.minLength(2)]);
      carPlate?.setValidators([Validators.required, Validators.pattern(/^[A-Z]{2}-\d{3}-[A-Z]{2}$/i)]);
      driverLicenseNumber?.setValidators([Validators.required, Validators.minLength(5)]);
    } else {
      carModel?.clearValidators();
      carPlate?.clearValidators();
      driverLicenseNumber?.clearValidators();

      carModel?.setValue('');
      carPlate?.setValue('');
      driverLicenseNumber?.setValue('');
    }

    carModel?.updateValueAndValidity();
    carPlate?.updateValueAndValidity();
    driverLicenseNumber?.updateValueAndValidity();
  }

  private passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
    const password = control.get('password');
    const confirmPassword = control.get('confirmPassword');

    if (!password || !confirmPassword) return null;

    if (confirmPassword.value && password.value !== confirmPassword.value) {
      confirmPassword.setErrors({ passwordMismatch: true });
      return { passwordMismatch: true };
    }

    if (confirmPassword.hasError('passwordMismatch')) {
      const errors = { ...confirmPassword.errors };
      delete errors['passwordMismatch'];
      confirmPassword.setErrors(Object.keys(errors).length ? errors : null);
    }

    return null;
  }

  isFieldInvalid(fieldName: string): boolean {
    const control = this.registerForm.get(fieldName);
    if (!control) return false;

    if (fieldName === 'confirmPassword' && control.hasError('passwordMismatch')) {
      return control.touched || control.dirty;
    }

    return control.invalid && (control.dirty || control.touched);
  }

  get maskedPhone(): string {
    const phone = this.registerForm.get('phone')?.value ?? '';
    if (phone.length < 4) return phone;
    return `+995 ${phone.slice(0, 3)} ** ** ${phone.slice(-2)}`;
  }

  isVerificationCodeInvalid(): boolean {
    const control = this.verificationForm.get('code');
    if (!control) return false;
    return control.invalid && (control.dirty || control.touched);
  }

  onRegister(): void {
    this.errorMessage = null;

    if (this.registerForm.invalid) {
      this.markFormGroupTouched(this.registerForm);
      return;
    }

    this.sendVerificationCode();
  }

  private sendVerificationCode(): void {
    this.isSendingCode = true;
    this.errorMessage = null;
    this.generatedCodeHint = null;
    this.cdr.detectChanges();

    const formData = {
      ...this.registerForm.value,
      role: this.activeRole
    };

    this.smsService.sendRegistrationCode(formData).subscribe({
      next: (res) => {
        this.isSendingCode = false;

        if (res.success) {
          if (res.code) {
            this.generatedCodeHint = res.code;
          }
          this.currentStep = 'verification';
          this.verificationForm.reset();
          this.startResendCooldown();
        } else {
          this.errorMessage = res.message ?? 'კოდის გაგზავნა ვერ მოხერხდა, სცადეთ თავიდან';
        }

        this.cdr.detectChanges();
      },
      error: (err) => {
        this.isSendingCode = false;

        if (err.status === 400 && err.error?.message?.includes('exist')) {
          this.currentStep = 'verification';
          this.verificationForm.reset();
          this.startResendCooldown();
        } else {
          this.errorMessage = 'კავშირის შეცდომა — ვერ მოხერხდა კოდის გაგზავნა';
        }

        this.cdr.detectChanges();
      },
    });
  }

  onVerifyCode(): void {
    this.verificationError = null;

    if (this.verificationForm.invalid) {
      this.verificationForm.markAllAsTouched();
      return;
    }

    const phone = this.registerForm.get('phone')?.value;
    const code = this.verificationForm.get('code')?.value;

    this.isVerifying = true;
    this.cdr.detectChanges();

    this.smsService.verifyRegistrationCode(phone, code).subscribe({
      next: (res) => {
        this.isVerifying = false;

        if (res.success) {
          // ✅ ვერიფიკაცია წარმატებულია — token უკვე შენახულია სერვისში (tap ოპერატორით)
          this.completeRegistration();
        } else {
          this.verificationError = res.message ?? 'კოდი არასწორია, სცადეთ ხელახლა';
        }

        this.cdr.detectChanges();
      },
      error: (err) => {
        this.isVerifying = false;
        this.verificationError = 'კავშირის შეცდომა — ვერ მოხერხდა კოდის შემოწმება';
        this.cdr.detectChanges();
      },
    });
  }

  resendCode(): void {
    if (this.resendCooldown > 0 || this.isSendingCode) return;
    this.sendVerificationCode();
  }

  backToForm(): void {
    this.currentStep = 'form';
    this.verificationError = null;
    this.generatedCodeHint = null;
    this.clearCooldownTimer();
    this.cdr.detectChanges();
  }

  private startResendCooldown(): void {
    this.clearCooldownTimer();
    this.resendCooldown = RESEND_COOLDOWN_SECONDS;
    this.cooldownTimer = setInterval(() => {
      this.resendCooldown -= 1;
      this.cdr.detectChanges();
      if (this.resendCooldown <= 0) {
        this.clearCooldownTimer();
        this.cdr.detectChanges();
      }
    }, 1000);
  }

  private clearCooldownTimer(): void {
    if (this.cooldownTimer) {
      clearInterval(this.cooldownTimer);
      this.cooldownTimer = null;
    }
    this.resendCooldown = 0;
  }

  /**
   * ✅ რეგისტრაცია დასრულდა — token უკვე დაყენებულია,
   * ვასუფთავებთ ფორმებს და ვგზავნით პროფილზე
   */
  private completeRegistration(): void {
    this.isLoading = true;
    this.cdr.detectChanges();

    this.clearCooldownTimer();
    this.registerForm.reset();
    this.verificationForm.reset();
    this.generatedCodeHint = null;
    this.currentStep = 'form';

    this.router.navigate(['/profile']);
  }

  private markFormGroupTouched(formGroup: FormGroup): void {
    Object.values(formGroup.controls).forEach(control => {
      control.markAsTouched();
      if ((control as any).controls) {
        this.markFormGroupTouched(control as FormGroup);
      }
    });
  }
}