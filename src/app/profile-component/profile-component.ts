import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { SmsVerificationService, UserProfile } from '../../app/services/smsverifikation.service';
import { ParcelService, DriverTrip } from '../services/Parcel.service';

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

interface DriverStats {
  completedTrips: number;
  averageRating: number;
  reviewCount: number;
  currentEarnings: number;
  earningsTrend: string;
  hasActiveTrip: boolean;
  activeTrip?: {
    from: string;
    to: string;
    distance: number;
    estimatedTime: number;
  };
}

@Component({
  selector: 'app-profile',
  templateUrl: './profile-component.html',
  styleUrls: ['./profile-component.scss'],
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule]
})
export class ProfileComponent implements OnInit, OnDestroy {
  // ============ მომხმარებლის ძირითადი ინფორმაცია ============
  firstName: string = '';
  lastName: string = '';
  email: string = '';
  phone: string = '';
  personalNumber: string = '';
  userRole: UserRole = 'sender';
  phoneVerified: boolean = false;

  // ============ მძღოლის ინფორმაცია ============
  carModel: string = '';
  carPlate: string = '';
  driverLicenseNumber: string = '';

  // ============ ფორმის მენეჯმენტი ============
  profileForm!: FormGroup;
  isEditing: boolean = false;
  isSaving: boolean = false;
  isLoading: boolean = false;
  errorMessage: string | null = null;
  showMenu: boolean = false;

  // ============ გამგზავნის განცხადებები ============
  userRequests: ParcelRequest[] = [];
  isLoadingRequests: boolean = false;

  // ============ მძღოლის მგზავრობები ============
  driverTrips: DriverTrip[] = [];
  isLoadingTrips: boolean = false;

  // ============ მძღოლის სტატისტიკა ============
  driverStats: DriverStats | null = null;

  // ============ Cleanup (OnDestroy) ============
  private destroy$ = new Subject<void>();

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

    // ✅ ტრიპის შექმნის აცნობების მოსმენა
    this.parcelService.tripCreated()
      .pipe(
        takeUntil(this.destroy$)  // cleanup
      )
      .subscribe((newTrip: DriverTrip) => {
        console.log('🔄 ახალი trip დაემატა, რელოდ ტრიპები...', newTrip);
        
        // თუ მძღოლი ხართ, რელოდ გააკეთეთ
        if (this.userRole === 'driver') {
          this.loadDriverTrips();
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ============ მომხმარებლის მონაცემების ჩაკრება ============
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
          
          // ✅ განცხადებების ჩაკრება მხოლოდ sender-ებისთვის
          if (this.userRole === 'sender') {
            this.loadUserRequests();
          }
          
          // ✅ მძღოლის მგზავრობა და სტატისტიკა
          if (this.userRole === 'driver') {
            this.loadDriverStats();
            this.loadDriverTrips();
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

  // ============ გამგზავნის განცხადებების ჩაკრება ============
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

  // ============ მძღოლის მგზავრობების ჩაკრება ============
  private loadDriverTrips(): void {
    this.isLoadingTrips = true;
    this.cdr.detectChanges();

    this.parcelService.getDriverTrips().subscribe({
      next: (res: any) => {
        this.isLoadingTrips = false;

        if (res.success && res.trips) {
          this.driverTrips = res.trips;
        } else {
          this.driverTrips = [];
        }

        this.cdr.detectChanges();
      },
      error: (err) => {
        this.isLoadingTrips = false;
        this.driverTrips = [];
        console.error('Error loading driver trips:', err);
        this.cdr.detectChanges();
      }
    });
  }

  // ============ მძღოლის სტატისტიკის ჩაკრება ============
  private loadDriverStats(): void {
    this.parcelService.getDriverStats().subscribe({
      next: (res: any) => {
        if (res.success && res.stats) {
          this.driverStats = res.stats;
        } else {
          // fallback: mock data
          this.driverStats = {
            completedTrips: 24,
            averageRating: 4.8,
            reviewCount: 120,
            currentEarnings: 1240,
            earningsTrend: '📈 12%',
            hasActiveTrip: false,
            activeTrip: undefined
          };
        }
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error loading driver stats:', err);
        // fallback: mock data
        this.driverStats = {
          completedTrips: 24,
          averageRating: 4.8,
          reviewCount: 120,
          currentEarnings: 1240,
          earningsTrend: '📈 12%',
          hasActiveTrip: false,
          activeTrip: undefined
        };
        this.cdr.detectChanges();
      }
    });
  }

  // ============ მომხმარებლის მონაცემის გამოყენება ============
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

  // ============ ფორმის ინიციალიზაცია ============
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

  // ============ UI დამხმარე ფუნქციები ============
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

  formatDateTime(dateString: string | undefined): string {
    if (!dateString) return '—';
    const date = new Date(dateString);
    return (
      date.toLocaleDateString('ka-GE', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      }) +
      ' ' +
      date.toLocaleTimeString('ka-GE', { hour: '2-digit', minute: '2-digit' })
    );
  }

  getStatusLabel(status: string): string {
    const labels: { [key: string]: string } = {
      'pending': '⏳ მოლოდინი',
      'accepted': '✅ მიღებული',
      'in-transit': '🚚 გზაში',
      'delivered': '📍 დაბრუნებული'
    };
    return labels[status] || status;
  }

  getTripStatusLabel(status: string | undefined): string {
    const labels: { [key: string]: string } = {
      'pending': '⏳ დაგეგმილი',
      'active': '🚗 აქტიური',
      'completed': '✅ დასრულებული',
      'cancelled': '❌ გაუქმებული'
    };
    return labels[status || 'pending'] || status || '⏳ დაგეგმილი';
  }

  getTripEarnings(trip: DriverTrip): string {
    if (!trip.acceptedShippings || trip.acceptedShippings.length === 0) {
      return '0 ₾';
    }

    const total = trip.acceptedShippings.reduce((sum, shipping) => {
      const weight = shipping.parcelDetails?.weight || 0;
      const price = trip.pricePerKg || 0;
      return sum + weight * price;
    }, 0);

    return `${total.toFixed(2)} ₾`;
  }

  isFieldInvalid(fieldName: string): boolean {
    const field = this.profileForm.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }

  // ============ რედაქტირების მოდუსი ============
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

  // ============ პროფილის შენახვა ============
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

  // ============ მენიუ და ნავიგაცია ============
  toggleMenu(): void {
    this.showMenu = !this.showMenu;
  }

  goToDashboard(): void {
    this.router.navigate(['/dashboard']);
  }

  // ============ გამგზავნის აქცია ============
  openSendItemFlow(): void {
    console.log('📦 გამგზავნი: ნივთის გაგზავნა');
    this.router.navigate(['/send']);
  }

  // ============ მძღოლის აქციები ============
  openPickupFlow(): void {
    console.log('🚚 მძღოლი: აქტივაციის ძებნა');
    this.router.navigate(['/pickup']);
  }

  viewTripDetails(tripId: string): void {
    console.log('🚗 მძღოლი: ტრიპის დეტალები', tripId);
    // რეალურ აპლიკაციაში ამ მხეთ სპეციალურ დეტალების ფურცელზე გადავა
    // this.router.navigate(['/driver/trip', tripId]);
  }

  // ============ პარამეტრები ============
  openNotificationSettings(): void {
    alert('შეტყობინებების პარამეტრები მოშენებაშია 🔔');
  }

  openPrivacySettings(): void {
    alert('კონფიდენციალურობის პარამეტრები მოშენებაშია 👁️');
  }

  // ============ გამოწერა ============
  logout(): void {
    if (confirm('დარწმუნებული ხართ რომ გამოწერთ?')) {
      this.smsService.clearAuthToken();
      this.smsService.clearState();
      this.router.navigate(['/login']);
    }
  }

  // ============ ანგარიშის წაშლა ============
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

  // ============ ფორმის დამხმარე მეთოდი ============
  private markFormAsTouched(): void {
    Object.values(this.profileForm.controls).forEach(control => {
      control.markAsTouched();
    });
  }
}