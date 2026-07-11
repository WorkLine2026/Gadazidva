import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { SmsVerificationService, UserProfile } from '../../app/services/smsverifikation.service';
import { ParcelService } from '../services/Parcel.service';

type UserRole = 'sender' | 'driver';

interface ParcelRequest {
  _id: string;
  from: string;
  to: string;
  weight: number;
  value: number;
  status: 'pending' | 'accepted' | 'in-transit' | 'delivered';
  createdAt: string;
}

@Component({
  selector: 'app-profile',
  templateUrl: './profile-component.html',
  styleUrls: ['./profile-component.scss'],
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule]
})
export class ProfileComponent implements OnInit {
  firstName: string = '';
  lastName: string = '';
  email: string = '';
  phone: string = '';
  personalNumber: string = '';
  userRole: UserRole = 'sender';
  phoneVerified: boolean = false;

  carModel: string = '';
  carPlate: string = '';
  driverLicenseNumber: string = '';

  profileForm!: FormGroup;
  isEditing: boolean = false;
  isSaving: boolean = false;
  isLoading: boolean = false;
  errorMessage: string | null = null;
  showMenu: boolean = false;

  // ✅ განცხადებები
  userRequests: ParcelRequest[] = [];
  isLoadingRequests: boolean = false;

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private smsService: SmsVerificationService,
    private parcelService: ParcelService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    if (!this.smsService.isAuthenticated()) {
      this.router.navigate(['/login']);
      return;
    }
    this.loadUserData();
  }

  private loadUserData(): void {
    this.isLoading = true;
    this.errorMessage = null;
    this.cdr.detectChanges();

    this.smsService.getProfile().subscribe({
      next: (res) => {
        this.isLoading = false;

        if (res.success && res.user) {
          this.applyUserData(res.user);
          this.initProfileForm();
          
          // ✅ განცხადებების ჩაკრება მხოლოდ sender-ებისთვის (userRole უკვე დაყენებულია)
          if (this.userRole === 'sender') {
            this.loadUserRequests();
          }
        } else {
          this.errorMessage = res.message ?? 'მომხმარებლის ინფორმაცია ვერ ჩაიკითხა';
        }

        this.cdr.detectChanges();
      },
      error: (err) => {
        this.isLoading = false;

        if (err.status === 401) {
          this.smsService.clearAuthToken();
          this.router.navigate(['/login']);
          return;
        }

        this.errorMessage = 'მომხმარებლის ინფორმაცია ვერ ჩაიკითხა';
        this.cdr.detectChanges();
      }
    });
  }

  // ✅ განცხადებების ჩაკრება
  private loadUserRequests(): void {
    this.isLoadingRequests = true;
    this.cdr.detectChanges();

    this.parcelService.getUserRequests().subscribe({
      next: (res: any) => {
        this.isLoadingRequests = false;

        if (res.success && res.requests) {
          this.userRequests = res.requests;
        } else {
          this.userRequests = [];
        }

        this.cdr.detectChanges();
      },
      error: (err) => {
        this.isLoadingRequests = false;
        this.userRequests = [];
        console.error('Error loading requests:', err);
        this.cdr.detectChanges();
      }
    });
  }

  private applyUserData(user: UserProfile): void {
    this.firstName = user.firstName;
    this.lastName = user.lastName;
    this.email = user.email;
    this.phone = user.phone;
    this.personalNumber = user.personalNumber;
    this.phoneVerified = user.phoneVerified;
    this.userRole = user.role;
    this.carModel = user.carModel ?? '';
    this.carPlate = user.carPlate ?? '';
    this.driverLicenseNumber = user.driverLicenseNumber ?? '';
  }

  private initProfileForm(): void {
    this.profileForm = this.fb.group({
      firstName: [this.firstName, [Validators.required, Validators.minLength(2)]],
      lastName: [this.lastName, [Validators.required, Validators.minLength(2)]],
      email: [this.email, [Validators.required, Validators.email]],
      personalNumber: [{ value: this.personalNumber, disabled: true }],

      carModel: [this.carModel, this.userRole === 'driver' ? [Validators.required] : []],
      carPlate: [this.carPlate, this.userRole === 'driver' ? [Validators.required, Validators.pattern(/^[A-Z]{2}-\d{3}-[A-Z]{2}$/i)] : []],
      driverLicenseNumber: [this.driverLicenseNumber, this.userRole === 'driver' ? [Validators.required] : []]
    });
  }

  getUserInitials(): string {
    return `${this.firstName.charAt(0)}${this.lastName.charAt(0)}`.toUpperCase();
  }

  getRoleLabel(): string {
    return this.userRole === 'driver' ? 'მძღოლი' : 'გამგზავნი';
  }

  formatPhone(phone: string): string {
    if (!phone) return '—';
    if (phone.startsWith('995')) {
      return `+995 ${phone.slice(3, 6)} ${phone.slice(6, 8)} ${phone.slice(8)}`;
    }
    return `+995 ${phone.slice(0, 3)} ${phone.slice(3, 5)} ${phone.slice(5)}`;
  }

  formatDate(dateString: string): string {
    if (!dateString) return '—';
    const date = new Date(dateString);
    return date.toLocaleDateString('ka-GE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  // ✅ სტატუსის ეტიკეტი
  getStatusLabel(status: string): string {
    const labels: { [key: string]: string } = {
      'pending': '⏳ მოლოდინი',
      'accepted': '✅ მიღებული',
      'in-transit': '🚚 გზაში',
      'delivered': '📍 დაბრუნებული'
    };
    return labels[status] || status;
  }

  isFieldInvalid(fieldName: string): boolean {
    const field = this.profileForm.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }

  toggleEditMode(): void {
    this.isEditing = !this.isEditing;
    this.errorMessage = null;
    if (this.isEditing) {
      this.initProfileForm();
    }
  }

  cancelEdit(): void {
    this.isEditing = false;
    this.errorMessage = null;
    this.initProfileForm();
  }

  saveProfile(): void {
    if (this.profileForm.invalid) {
      this.markFormAsTouched();
      return;
    }

    this.errorMessage = null;
    this.isSaving = true;
    this.cdr.detectChanges();

    const updateData = this.profileForm.getRawValue();

    this.smsService.updateProfile(updateData).subscribe({
      next: (res) => {
        this.isSaving = false;

        if (res.success && res.user) {
          this.applyUserData(res.user);
          this.isEditing = false;
        } else {
          this.errorMessage = res.message ?? 'ცვლილებები ვერ შენახდა';
        }

        this.cdr.detectChanges();
      },
      error: (err) => {
        this.isSaving = false;
        this.errorMessage = err.error?.message || 'ცვლილებები ვერ შენახდა';
        this.cdr.detectChanges();
      }
    });
  }

  toggleMenu(): void {
    this.showMenu = !this.showMenu;
  }

  openSendItemFlow(): void {
    console.log('📦 გამგზავნი: ნივთის გაგზავნა');
    this.router.navigate(['/send']);
  }

  openPickupFlow(): void {
    console.log('🚚 მძღოლი: წაივიღებ ნივთს');
    this.router.navigate(['/pickup']);
  }

  openNotificationSettings(): void {
    alert('შეტყობინებების პარამეტრები მოშენებაშია 🔔');
  }

  openPrivacySettings(): void {
    alert('კონფიდენციალურობის პარამეტრები მოშენებაშია 👁️');
  }

  logout(): void {
    if (confirm('დარწმუნებული ხართ რომ გამოწერთ?')) {
      this.smsService.clearAuthToken();
      this.smsService.clearState();
      this.router.navigate(['/login']);
    }
  }

  openDeleteConfirm(): void {
    const confirmed = confirm(
      '⚠️ ყურადღება!\n\nამ ოპერაციით თქვენი ანგარიშის ყველა მონაცემი წაიშლება.\nუკან დაბრუნება შეუძლებელი იქნება!\n\nგსურთ გაგრძელება?'
    );

    if (confirmed) {
      const doubleConfirm = prompt('დადასტურებისთვის შეიყვანეთ თქვენი ელფოსტა: ' + this.email);

      if (doubleConfirm === this.email) {
        this.deleteAccount();
      }
    }
  }

  private deleteAccount(): void {
    this.isSaving = true;
    this.cdr.detectChanges();

    this.smsService.deleteAccount().subscribe({
      next: () => {
        this.isSaving = false;
        this.smsService.clearAuthToken();
        this.smsService.clearState();
        alert('ანგარიში წაიშალა.');
        this.router.navigate(['/login']);
      },
      error: (err) => {
        this.isSaving = false;
        this.errorMessage = err.error?.message || 'ანგარიშის წაშლა ვერ მოხერხდა';
        this.cdr.detectChanges();
      }
    });
  }

  goToDashboard(): void {
    this.router.navigate(['/dashboard']);
  }

  private markFormAsTouched(): void {
    Object.values(this.profileForm.controls).forEach(control => {
      control.markAsTouched();
    });
  }
}