import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { SmsVerificationService, UserProfile } from '../../app/services/smsverifikation.service';
import { ParcelService, DriverTrip } from '../services/Parcel.service';
import { ConversationsListComponent, Conversation } from '../chat/conversations-list-component/conversations-list-component';
import { ChatModalImprovedComponent } from '../chat/chat-modal-component/chat-modal-component';
import { SocketNotificationService } from '../../app/services/Socketnotification.service';

type UserRole = 'sender' | 'driver';

interface ParcelRequest {
  _id: string;
  from: string;
  to: string;
  weight: number;
  value: number;
  status: 'pending' | 'accepted' | 'in-transit' | 'delivered';
  createdAt: string;
  images?: string[]; // ✅ ატვირთული ამანათის ფოტოების URL-ები
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
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ConversationsListComponent,
    ChatModalImprovedComponent
  ]
})
export class ProfileComponent implements OnInit, OnDestroy {
  userId = '';
  firstName = '';
  lastName = '';
  email = '';
  phone = '';
  personalNumber = '';
  userRole: UserRole = 'sender';
  phoneVerified = false;

  carModel = '';
  carPlate = '';
  driverLicenseNumber = '';

  profileForm!: FormGroup;
  isEditing = false;
  isSaving = false;
  isLoading = false;
  errorMessage: string | null = null;
  showMenu = false;

  userRequests: ParcelRequest[] = [];
  isLoadingRequests = false;
  deletingRequestId: string | null = null; // 👈 გამომგზავნის განცხადების წაშლის loading state

  driverTrips: DriverTrip[] = [];
  isLoadingTrips = false;
  deletingTripId: string | null = null; // 👈 მძღოლის მგზავრობის წაშლის loading state

  driverStats: DriverStats | null = null;

  showConversations = false;
  showChatModal = false;
  selectedConversation: Conversation | null = null;
  unreadCount = 0;

  private destroy$ = new Subject<void>();

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private smsService: SmsVerificationService,
    private parcelService: ParcelService,
    private socketService: SocketNotificationService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    if (!this.smsService.isAuthenticated()) {
      this.router.navigate(['/login']);
      return;
    }

    this.loadUserData();

    this.socketService.getUnreadCount()
      .pipe(takeUntil(this.destroy$))
      .subscribe(count => {
        this.unreadCount = count;
        this.cdr.detectChanges();
      });

    this.parcelService.tripCreated()
      .pipe(takeUntil(this.destroy$))
      .subscribe((newTrip: DriverTrip) => {
        if (this.userRole === 'driver') {
          this.loadDriverTrips();
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
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

          if (this.userRole === 'sender') {
            this.loadUserRequests();
          }

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

  private loadUserRequests(): void {
    this.isLoadingRequests = true;
    this.cdr.detectChanges();

    this.parcelService.getUserRequests().subscribe({
      next: (res: any) => {
        this.isLoadingRequests = false;
        this.userRequests = res.success && res.requests ? res.requests : [];
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

  private loadDriverTrips(): void {
    this.isLoadingTrips = true;
    this.cdr.detectChanges();

    this.parcelService.getDriverTrips().subscribe({
      next: (res: any) => {
        this.isLoadingTrips = false;
        this.driverTrips = res.success && res.trips ? res.trips : [];
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

  private loadDriverStats(): void {
    this.parcelService.getDriverStats().subscribe({
      next: (res: any) => {
        this.driverStats = res.success && res.stats ? res.stats : {
          completedTrips: 24,
          averageRating: 4.8,
          reviewCount: 120,
          currentEarnings: 1240,
          earningsTrend: '📈 12%',
          hasActiveTrip: false,
          activeTrip: undefined
        };
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error loading driver stats:', err);
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

  private applyUserData(user: UserProfile): void {
    this.userId = (user as any)._id ?? '';
    this.firstName = user.firstName;
    this.lastName = user.lastName;
    this.email = user.email;
    this.phone = user.phone;
    this.personalNumber = user.personalNumber;
    this.phoneVerified = user.phoneVerified;
    // Cast incoming user.role to the local UserRole type to handle possible extra roles
    this.userRole = user.role as UserRole;
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
    return `${this.firstName.charAt(0)}${this.lastName.charAt(0)}`.toUpperCase() || '?';
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
    return new Date(dateString).toLocaleDateString('ka-GE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  formatDateTime(dateString: string | undefined): string {
    if (!dateString) return '—';
    const date = new Date(dateString);
    return `${date.toLocaleDateString('ka-GE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })} ${date.toLocaleTimeString('ka-GE', { hour: '2-digit', minute: '2-digit' })}`;
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
    const field = this.profileForm?.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }

  toggleEditMode(): void {
    this.isEditing = !this.isEditing;
    this.errorMessage = null;
    if (this.isEditing) this.initProfileForm();
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

  toggleConversations(): void {
    this.showConversations = !this.showConversations;
  }

  /**
   * ✅ საუბრის არჩევისას დარწმუნება, რომ userId (recipientId) სწორად გადაეცემა
   */
  onConversationSelected(conversation: Conversation): void {
    console.log('💬 არჩეული საუბარი:', conversation);

    // თუ userId ცარიელია ან unknown_ პრეფიქსითაა, შევამოწმოთ ალტერნატიული ველები
    const recipientId = conversation.userId && !conversation.userId.startsWith('unknown_')
      ? conversation.userId
      : ((conversation as any).recipientId || (conversation as any).otherUserId || '');

    this.selectedConversation = {
      ...conversation,
      userId: recipientId
    };

    // SocketNotificationService-ს წინასწარ ვარეგისტრირებთ, რომ მესიჯის გაგზავნისას recipientId ცარიელი არ იყოს
    if (recipientId) {
      this.socketService.registerConversationMeta(
        conversation.conversationId,
        recipientId,
        conversation.userName
      );
    }

    this.showChatModal = true;
    this.showConversations = false;
    this.cdr.detectChanges();
  }

  closeChatModal(): void {
    this.showChatModal = false;
    this.selectedConversation = null;
    this.cdr.detectChanges();
  }

  toggleMenu(): void {
    this.showMenu = !this.showMenu;
  }

  goToDashboard(): void {
    this.router.navigate(['/dashboard']);
  }

  openSendItemFlow(): void {
    this.router.navigate(['/send']);
  }

  openPickupFlow(): void {
    this.router.navigate(['/pickup']);
  }

  viewTripDetails(tripId: string): void {
    this.router.navigate(['/trip', tripId]);
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

  private markFormAsTouched(): void {
    Object.values(this.profileForm.controls).forEach(control => control.markAsTouched());
  }

  viewRequestDetails(requestId: string): void {
    this.router.navigate(['/request', requestId]);
  }

  /**
   * ✅ საკუთარი განცხადების წაშლა — სტატუსის მიუხედავად ყოველთვის ჩანს
   */
  canDeleteRequest(request: ParcelRequest): boolean {
    return true;
  }

  deleteRequest(requestId: string): void {
    const confirmed = confirm(
      '⚠️ დარწმუნებული ხართ, რომ გსურთ ამ განცხადების წაშლა?\nუკან დაბრუნება შეუძლებელი იქნება.'
    );

    if (!confirmed) return;

    this.deletingRequestId = requestId;
    this.cdr.detectChanges();

    this.parcelService.deleteParcelRequest(requestId).subscribe({
      next: (res) => {
        this.deletingRequestId = null;

        if (res.success) {
          this.userRequests = this.userRequests.filter(r => r._id !== requestId);
        } else {
          alert(res.message ?? 'განცხადების წაშლა ვერ მოხერხდა');
        }

        this.cdr.detectChanges();
      },
      error: (err) => {
        this.deletingRequestId = null;
        alert(err.error?.message || 'განცხადების წაშლა ვერ მოხერხდა');
        this.cdr.detectChanges();
      }
    });
  }

  /**
   * ✅ საკუთარი მგზავრობის წაშლა — სტატუსის მიუხედავად ყოველთვის ჩანს
   */
  canDeleteTrip(trip: DriverTrip): boolean {
    return true;
  }

  deleteTrip(tripId: string): void {
    const confirmed = confirm(
      '⚠️ დარწმუნებული ხართ, რომ გსურთ ამ მგზავრობის წაშლა?\nუკან დაბრუნება შეუძლებელი იქნება.'
    );

    if (!confirmed) return;

    this.deletingTripId = tripId;
    this.cdr.detectChanges();

    this.parcelService.deleteTrip(tripId).subscribe({
      next: (res) => {
        this.deletingTripId = null;

        if (res.success) {
          this.driverTrips = this.driverTrips.filter(t => t._id !== tripId);
        } else {
          alert(res.message ?? 'მგზავრობის წაშლა ვერ მოხერხდა');
        }

        this.cdr.detectChanges();
      },
      error: (err) => {
        this.deletingTripId = null;
        alert(err.error?.message || 'მგზავრობის წაშლა ვერ მოხერხდა');
        this.cdr.detectChanges();
      }
    });
  }
}