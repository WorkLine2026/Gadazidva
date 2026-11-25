import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, ChangeDetectorRef, HostListener, ViewChild, ElementRef } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators
} from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { timeout, catchError, finalize } from 'rxjs/operators';
import { of, TimeoutError } from 'rxjs';
import { SmsVerificationService } from '../../services/smsverifikation.service';
import { RulesComponent } from '../../Main/rules/rules'; // ⚠️ შეცვალე შენი რეალური path-ით

type UserRole = 'sender' | 'driver';
type RegistrationStep = 'form' | 'verification';

const RESEND_COOLDOWN_SECONDS = 30;
const ALLOWED_LICENSE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'pdf'];
const MAX_LICENSE_FILE_SIZE_MB = 1;
const MAX_ORIGINAL_LICENSE_FILE_SIZE_MB = 30;
const REGISTER_REQUEST_TIMEOUT_MS = 30000;

function requiredFileType(allowedExtensions: string[]): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const file: File | null = control.value;
    if (!file) return null;
    const ext = file.name.split('.').pop()?.toLowerCase();
    return ext && allowedExtensions.includes(ext) ? null : { invalidFileType: true };
  };
}

function maxFileSize(maxSizeMB: number): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const file: File | null = control.value;
    if (!file) return null;
    return file.size <= maxSizeMB * 1024 * 1024 ? null : { fileTooLarge: true };
  };
}

@Component({
  selector: 'app-register',
  templateUrl: './registercomponent.html',
  styleUrls: ['./registercomponent.scss'],
  imports: [CommonModule, ReactiveFormsModule, RouterModule, RulesComponent],
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

  // მართვის მოწმობის ფოტოს state
  licenseFileName: string | null = null;
  licensePreviewUrl: string | null = null;
  licenseFileError: string | null = null;
  isProcessingLicenseFile = false;
  showConfirmPassword: any;
  showPassword: any;

  // ======================== Terms modal state ========================
  isTermsModalOpen = false;
  hasReadTerms = false;        // ერთხელ მაინც გახსნა + ბოლომდე გადაიკითხა
  termsScrolledToEnd = false;  // მოდალის მიმდინარე სესიისთვის

  // მოდალს <body>-ში გადავიტანთ, რომ ყოველთვის ეკრანის ცენტრში იყოს
  // (მშობლის transform/filter-ის გამო position:fixed არ გადაინაცვლებს)
  @ViewChild('termsModalRoot')
  set termsModalRoot(ref: ElementRef<HTMLElement> | undefined) {
    if (ref && typeof document !== 'undefined') {
      document.body.appendChild(ref.nativeElement);
    }
  }

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
    this.revokeLicensePreview();
    if (typeof document !== 'undefined') {
      document.body.style.overflow = '';
      document.querySelector('.terms-modal-backdrop')?.remove();
    }
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
        licensePhoto: [null],
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
    const licensePhoto = this.registerForm.get('licensePhoto');

    if (role === 'driver') {
      carModel?.setValidators([Validators.required, Validators.minLength(2)]);
      carPlate?.setValidators([Validators.required, Validators.pattern(/^[A-Z]{2}-\d{3}-[A-Z]{2}$/i)]);
      driverLicenseNumber?.setValidators([Validators.required, Validators.minLength(5)]);
      licensePhoto?.setValidators([
        Validators.required,
        requiredFileType(ALLOWED_LICENSE_EXTENSIONS),
        maxFileSize(MAX_LICENSE_FILE_SIZE_MB),
      ]);
    } else {
      carModel?.clearValidators();
      carPlate?.clearValidators();
      driverLicenseNumber?.clearValidators();
      licensePhoto?.clearValidators();

      carModel?.setValue('');
      carPlate?.setValue('');
      driverLicenseNumber?.setValue('');

      licensePhoto?.setValue(null);
      this.licenseFileName = null;
      this.licenseFileError = null;
      this.revokeLicensePreview();
    }

    carModel?.updateValueAndValidity();
    carPlate?.updateValueAndValidity();
    driverLicenseNumber?.updateValueAndValidity();
    licensePhoto?.updateValueAndValidity();
  }

  // group-level error, რათა sibling-კონტროლზე setErrors() არ გამოვიძახოთ
  private passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
    const password = control.get('password');
    const confirmPassword = control.get('confirmPassword');

    if (!password || !confirmPassword) return null;

    return confirmPassword.value && password.value !== confirmPassword.value
      ? { passwordMismatch: true }
      : null;
  }

  isFieldInvalid(fieldName: string): boolean {
    const control = this.registerForm.get(fieldName);
    if (!control) return false;

    if (fieldName === 'confirmPassword') {
      const mismatch = this.registerForm.hasError('passwordMismatch');
      return (control.invalid || mismatch) && (control.dirty || control.touched);
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

  // ======================== Terms modal ========================

  openTermsModal(event: Event): void {
    event.preventDefault();
    event.stopPropagation();

    this.isTermsModalOpen = true;
    // თუ უკვე წაკითხული აქვს, ღილაკი მაშინვე აქტიურია
    this.termsScrolledToEnd = this.hasReadTerms;
    document.body.style.overflow = 'hidden';

    // მოკლე ეკრანზე scroll შეიძლება საერთოდ არ იყოს საჭირო
    setTimeout(() => this.checkTermsScroll(), 50);
  }

  closeTermsModal(): void {
    this.isTermsModalOpen = false;
    document.body.style.overflow = '';
  }

  onTermsScroll(event: Event): void {
    this.evaluateScroll(event.target as HTMLElement);
  }

  private checkTermsScroll(): void {
    const el = document.getElementById('termsScrollBody');
    if (el) this.evaluateScroll(el);
  }

  private evaluateScroll(el: HTMLElement): void {
    if (this.termsScrolledToEnd) return;
    const threshold = 24; // px ტოლერანტობა
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - threshold) {
      this.termsScrolledToEnd = true;
      this.cdr.detectChanges();
    }
  }

  // ქვემოთ ჩასქროლვის ღილაკი
  scrollTermsToBottom(): void {
    const el = document.getElementById('termsScrollBody');
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }

  acceptTerms(): void {
    if (!this.termsScrolledToEnd) return;

    this.hasReadTerms = true;
    const control = this.registerForm.get('agreeTerms');
    control?.setValue(true);
    control?.markAsDirty();
    control?.markAsTouched();

    this.closeTermsModal();
  }

  // ჩეკბოქსზე პირდაპირ დაჭერა: თუ არ წაუკითხავს, ვხსნით მოდალს
  onTermsCheckboxClick(event: Event): void {
    if (!this.hasReadTerms) {
      event.preventDefault();
      this.openTermsModal(event);
    }
  }

  @HostListener('document:keydown.escape')
  onEsc(): void {
    if (this.isTermsModalOpen) this.closeTermsModal();
  }

  // ======================== ლიცენზიის ფოტოს ატვირთვა + კომპრესია ========================

  async onLicenseFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files && input.files[0] ? input.files[0] : null;
    this.licenseFileError = null;

    if (!file) return;

    const ext = file.name.split('.').pop()?.toLowerCase();
    const maxOriginalSizeBytes = MAX_ORIGINAL_LICENSE_FILE_SIZE_MB * 1024 * 1024;
    const maxFinalSizeBytes = MAX_LICENSE_FILE_SIZE_MB * 1024 * 1024;

    if (!ext || !ALLOWED_LICENSE_EXTENSIONS.includes(ext)) {
      this.licenseFileError = 'დაშვებულია მხოლოდ JPG, PNG ან PDF ფორმატის ფაილი';
      input.value = '';
      return;
    }

    if (file.size > maxOriginalSizeBytes) {
      this.licenseFileError = `ფაილის საწყისი ზომა ძალიან დიდია (მაქს. ${MAX_ORIGINAL_LICENSE_FILE_SIZE_MB}MB)`;
      input.value = '';
      return;
    }

    const isPdf = ext === 'pdf';

    if (isPdf) {
      if (file.size > maxFinalSizeBytes) {
        this.licenseFileError = `PDF ფაილის ზომა არ უნდა აღემატებოდეს ${MAX_LICENSE_FILE_SIZE_MB}MB-ს`;
        input.value = '';
        return;
      }

      const control = this.registerForm.get('licensePhoto');
      control?.setValue(file);
      control?.markAsTouched();
      this.updateLicensePreview(file);
      input.value = '';
      return;
    }

    this.isProcessingLicenseFile = true;
    this.cdr.detectChanges();

    try {
      const compressedFile = await this.compressImage(file, maxFinalSizeBytes);

      const control = this.registerForm.get('licensePhoto');
      control?.setValue(compressedFile);
      control?.markAsTouched();

      this.updateLicensePreview(compressedFile);
    } catch (err) {
      this.licenseFileError = 'ფოტოს დამუშავება ვერ მოხერხდა';
    } finally {
      this.isProcessingLicenseFile = false;
      this.cdr.detectChanges();
      input.value = '';
    }
  }

  removeLicenseFile(): void {
    this.revokeLicensePreview();
    this.licenseFileName = null;
    this.licenseFileError = null;

    const control = this.registerForm.get('licensePhoto');
    control?.setValue(null);
    control?.markAsTouched();

    const input = document.getElementById('licensePhotoInput') as HTMLInputElement | null;
    if (input) input.value = '';
  }

  private updateLicensePreview(file: File): void {
    this.revokeLicensePreview();
    this.licenseFileName = file.name;

    if (file.type === 'application/pdf') {
      this.licensePreviewUrl = null;
      return;
    }

    this.licensePreviewUrl = URL.createObjectURL(file);
  }

  private revokeLicensePreview(): void {
    if (this.licensePreviewUrl) {
      URL.revokeObjectURL(this.licensePreviewUrl);
      this.licensePreviewUrl = null;
    }
  }

  private async compressImage(file: File, maxSizeBytes: number): Promise<File> {
    if (file.size <= maxSizeBytes) {
      return file;
    }

    const dataUrl = await this.readFileAsDataUrl(file);
    const img = await this.loadImage(dataUrl);

    let width = img.width;
    let height = img.height;
    const maxDimension = 1600;

    if (width > maxDimension || height > maxDimension) {
      if (width > height) {
        height = Math.round((height * maxDimension) / width);
        width = maxDimension;
      } else {
        width = Math.round((width * maxDimension) / height);
        height = maxDimension;
      }
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      throw new Error('Canvas context ვერ შეიქმნა');
    }

    ctx.drawImage(img, 0, 0, width, height);

    let quality = 0.8;
    let blob = await this.canvasToBlob(canvas, quality);

    while (blob.size > maxSizeBytes && quality > 0.1) {
      quality -= 0.1;
      blob = await this.canvasToBlob(canvas, quality);
    }

    if (blob.size > maxSizeBytes) {
      const scaleFactor = Math.sqrt(maxSizeBytes / blob.size);
      canvas.width = Math.max(1, Math.round(width * scaleFactor));
      canvas.height = Math.max(1, Math.round(height * scaleFactor));
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      blob = await this.canvasToBlob(canvas, 0.7);
    }

    return new File(
      [blob],
      file.name.replace(/\.\w+$/, '.jpg'),
      { type: 'image/jpeg' }
    );
  }

  private readFileAsDataUrl(file: File | Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('ფაილის წაკითხვა ვერ მოხერხდა'));
      reader.readAsDataURL(file);
    });
  }

  private loadImage(dataUrl: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('სურათის ჩატვირთვა ვერ მოხერხდა'));
      img.src = dataUrl;
    });
  }

  private canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('კომპრესია ვერ შესრულდა'))),
        'image/jpeg',
        quality
      );
    });
  }

  // ======================== რეგისტრაცია ========================

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

    const formValue = this.registerForm.value;
    const licenseFile: File | null = this.activeRole === 'driver' ? formValue.licensePhoto : null;

    const payload = {
      firstName: formValue.firstName,
      lastName: formValue.lastName,
      personalNumber: formValue.personalNumber,
      phone: formValue.phone,
      email: formValue.email,
      password: formValue.password,
      role: this.activeRole,
      carModel: formValue.carModel,
      carPlate: formValue.carPlate,
      driverLicenseNumber: formValue.driverLicenseNumber,
    };

    this.smsService.sendRegistrationCode(payload, licenseFile).pipe(
      timeout(REGISTER_REQUEST_TIMEOUT_MS),
      catchError((err) => {
        if (err instanceof TimeoutError) {
          this.errorMessage = 'სერვერი დიდხანს არ პასუხობს — გადაამოწმეთ ინტერნეტი და სცადეთ თავიდან';
        } else if (err.status === 400 && err.error?.message?.includes('exist')) {
          return of({ success: true, message: 'ok' } as SendCodeResponseLike);
        } else if (err.status === 0) {
          this.errorMessage = 'კავშირის შეცდომა — ვერ დავუკავშირდით სერვერს';
        } else {
          this.errorMessage = err.error?.message ?? 'კოდის გაგზავნა ვერ მოხერხდა, სცადეთ თავიდან';
        }
        return of(null);
      }),
      finalize(() => {
        this.isSendingCode = false;
        this.cdr.detectChanges();
      })
    ).subscribe((res) => {
      if (!res) return;

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

    this.smsService.verifyRegistrationCode(phone, code).pipe(
      timeout(REGISTER_REQUEST_TIMEOUT_MS),
      catchError((err) => {
        if (err instanceof TimeoutError) {
          this.verificationError = 'სერვერი დიდხანს არ პასუხობს — სცადეთ თავიდან';
        } else {
          this.verificationError = err.error?.message ?? 'კავშირის შეცდომა — ვერ მოხერხდა კოდის შემოწმება';
        }
        return of(null);
      }),
      finalize(() => {
        this.isVerifying = false;
        this.cdr.detectChanges();
      })
    ).subscribe((res) => {
      if (!res) return;

      if (res.success) {
        this.completeRegistration();
      } else {
        this.verificationError = res.message ?? 'კოდი არასწორია, სცადეთ ხელახლა';
      }

      this.cdr.detectChanges();
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

  private completeRegistration(): void {
    this.isLoading = true;
    this.cdr.detectChanges();

    const role = this.activeRole;

    this.clearCooldownTimer();
    this.revokeLicensePreview();
    this.registerForm.reset();
    this.verificationForm.reset();
    this.generatedCodeHint = null;
    this.licenseFileName = null;
    this.hasReadTerms = false;
    this.termsScrolledToEnd = false;
    this.currentStep = 'form';

    if (role === 'driver') {
      this.router.navigate(['/driverProfile']);
    } else {
      this.router.navigate(['/senderProfile']);
    }
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

interface SendCodeResponseLike {
  success: boolean;
  message: string;
  userId?: string;
  code?: string;
}