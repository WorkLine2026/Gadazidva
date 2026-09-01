import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { SmsVerificationService, UserProfile } from '../../services/smsverifikation.service';
import { ParcelService, DriverTrip, PickupOffer, TripPickupRequest } from '../../services/Parcel.service';
import { ConversationsListComponent, Conversation } from '../../chat/conversations-list-component/conversations-list-component';
import { ChatModalImprovedComponent } from '../../chat/chat-modal-component/chat-modal-component';
import { SocketNotificationService } from '../../services/Socketnotification.service';
import { DeleteAccountModalComponent } from '../delete-account-modal-component/delete-account-modal-component';

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

const PICKUP_NOTIFICATION_TYPES = [
  'pickup_offer',
  'pickup_offer_accepted',
  'pickup_offer_rejected',
  'pickup_offer_driver_completed',
  'pickup_offer_sender_confirmed',
  'trip_pickup_request'
];

@Component({
  selector: 'app-driver-profile',
  templateUrl: './driver-profile-component.html',
  styleUrls: ['./driver-profile-component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ConversationsListComponent,
    ChatModalImprovedComponent,
    DeleteAccountModalComponent,
  ]
})
export class DriverProfileComponent implements OnInit, OnDestroy {
  userId = '';
  firstName = '';
  lastName = '';
  email = '';
  phone = '';
  personalNumber = '';
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

  // ✅ თითოეული სექციის გახსნა/დახურვის მდგომარეობა (accordion)
  openSections: { [key: string]: boolean } = {};

  driverTrips: DriverTrip[] = [];
  isLoadingTrips = false;
  deletingTripId: string | null = null;

  driverStats: DriverStats | null = null;

  showConversations = false;
  showChatModal = false;
  selectedConversation: Conversation | null = null;
  unreadCount = 0;

  incomingOffers: PickupOffer[] = [];
  inProgressOffers: PickupOffer[] = [];
  pickedUpCompleted: PickupOffer[] = [];

  // ✅ მძღოლის მიერ გაგზავნილი pickup-offer-ები, სენდერის მიერ უარყოფილი
  rejectedPickupOffers: PickupOffer[] = [];
  dismissingOfferId: string | null = null;

  // ტრიპზე მოსული ნივთის მოთხოვნები (გამგზავნი → მძღოლის trip)
  incomingTripRequests: TripPickupRequest[] = [];   // pending
  rejectedTripRequests: TripPickupRequest[] = [];   // მძღოლის მიერ უარყოფილი
  respondingTripRequestId: string | null = null;
  dismissingRequestId: string | null = null;

  showOfferDetailModal = false;
  selectedOffer: PickupOffer | null = null;
  respondingOfferId: string | null = null;
  completingOfferId: string | null = null;

  showDeleteAccountModal = false;
  isDeletingAccount = false;
  deleteAccountError: string | null = null;

  private lastHandledNotification: any = null;
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
        this.loadDriverTrips();
      });

    this.socketService.getNotifications()
      .pipe(takeUntil(this.destroy$))
      .subscribe(notifications => {
        const latest = notifications[0];
        if (!latest || latest === this.lastHandledNotification) return;

        this.lastHandledNotification = latest;

        if (PICKUP_NOTIFICATION_TYPES.includes(latest.type)) {
          this.loadPickupOffers();
          this.loadIncomingTripRequests();
          this.loadMyOutgoingOffers();
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ✅ სექციის გახსნა/დახურვა (accordion)
  toggleSection(key: string): void {
    this.openSections[key] = !this.openSections[key];
  }

  isSectionOpen(key: string): boolean {
    return !!this.openSections[key];
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
          this.loadDriverStats();
          this.loadDriverTrips();
          this.loadPickupOffers();
          this.loadIncomingTripRequests();
          this.loadMyOutgoingOffers();
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

  private loadPickupOffers(): void {
    this.parcelService.getIncomingOffers().subscribe({
      next: (res) => {
        this.incomingOffers = res.success && res.offers ? res.offers : [];
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.incomingOffers = [];
        console.error('Error loading incoming offers:', err);
        this.cdr.detectChanges();
      }
    });

    this.parcelService.getMyInProgressOffers().subscribe({
      next: (res) => {
        this.inProgressOffers = res.success && res.offers ? res.offers : [];
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.inProgressOffers = [];
        console.error('Error loading in-progress offers:', err);
        this.cdr.detectChanges();
      }
    });

    this.parcelService.getMyPickedUpCompleted().subscribe({
      next: (res) => {
        this.pickedUpCompleted = res.success && res.offers ? res.offers : [];
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.pickedUpCompleted = [];
        console.error('Error loading picked-up-completed offers:', err);
        this.cdr.detectChanges();
      }
    });
  }

  // ✅ მძღოლის მიერ გაგზავნილი pickup-offer-ების ჩატვირთვა — rejected გამოვყოთ
  private loadMyOutgoingOffers(): void {
    this.parcelService.getMyOutgoingPickupOffers().subscribe({
      next: (res) => {
        const all = res.success && res.offers ? res.offers : [];
        this.rejectedPickupOffers = all.filter(o => o.status === 'rejected');
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.rejectedPickupOffers = [];
        console.error('Error loading my outgoing pickup offers:', err);
        this.cdr.detectChanges();
      }
    });
  }

  // ✅ უარყოფილი pickup-offer-ის წაშლა სიიდან
  dismissRejectedOffer(offer: PickupOffer): void {
    this.dismissingOfferId = offer._id;
    this.cdr.detectChanges();

    this.parcelService.deletePickupOffer(offer._id).subscribe({
      next: (res) => {
        this.dismissingOfferId = null;
        if (res.success) {
          this.rejectedPickupOffers = this.rejectedPickupOffers.filter(o => o._id !== offer._id);
        } else {
          alert('❌ ' + (res.message || 'წაშლა ვერ მოხერხდა'));
        }
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.dismissingOfferId = null;
        alert('❌ ' + (err.error?.message || 'წაშლა ვერ მოხერხდა'));
        this.cdr.detectChanges();
      }
    });
  }

  // ტრიპზე მოსული ნივთის მოთხოვნების ჩატვირთვა — pending და rejected ცალკე
  private loadIncomingTripRequests(): void {
    this.parcelService.getIncomingTripRequests().subscribe({
      next: (res) => {
        const all = res.success && res.requests ? res.requests : [];
        this.incomingTripRequests = all.filter(r => r.status === 'pending');
        this.rejectedTripRequests = all.filter(r => r.status === 'rejected');
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.incomingTripRequests = [];
        this.rejectedTripRequests = [];
        console.error('Error loading incoming trip requests:', err);
        this.cdr.detectChanges();
      }
    });
  }

  openOfferDetails(offer: PickupOffer): void {
    this.selectedOffer = offer;
    this.showOfferDetailModal = true;
  }

  closeOfferDetails(): void {
    this.showOfferDetailModal = false;
    this.selectedOffer = null;
  }

  respondToOffer(offer: PickupOffer, accept: boolean): void {
    this.respondingOfferId = offer._id;
    this.cdr.detectChanges();

    this.parcelService.respondToOffer(offer._id, accept).subscribe({
      next: (res) => {
        this.respondingOfferId = null;
        if (res.success) {
          this.closeOfferDetails();
          this.loadPickupOffers();
          alert(accept ? '✅ დათანხმდით — ნივთი მიწოდების პროცესშია' : 'მოთხოვნა უარყოფილია');
        } else {
          alert('❌ ' + (res.message || 'ოპერაცია ვერ შესრულდა'));
        }
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.respondingOfferId = null;
        alert('❌ ' + (err.error?.message || 'ოპერაცია ვერ შესრულდა'));
        this.cdr.detectChanges();
      }
    });
  }

  markDriverComplete(offer: PickupOffer): void {
    this.completingOfferId = offer._id;
    this.cdr.detectChanges();

    this.parcelService.markPickupCompleteByDriver(offer._id).subscribe({
      next: (res) => {
        this.completingOfferId = null;
        if (res.success) {
          alert('✅ მონიშნულია დასრულებულად — ველოდებით გამგზავნის დადასტურებას');
          this.loadPickupOffers();
        } else {
          alert('❌ ' + (res.message || 'ოპერაცია ვერ შესრულდა'));
        }
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.completingOfferId = null;
        alert('❌ ' + (err.error?.message || 'ოპერაცია ვერ შესრულდა'));
        this.cdr.detectChanges();
      }
    });
  }

  // მძღოლის პასუხი trip pickup request-ზე (დათანხმება/უარყოფა)
  respondToTripRequest(request: TripPickupRequest, accept: boolean): void {
    this.respondingTripRequestId = request._id;
    this.cdr.detectChanges();

    this.parcelService.respondToTripPickupRequest(request._id, accept).subscribe({
      next: (res) => {
        this.respondingTripRequestId = null;
        if (res.success) {
          this.loadIncomingTripRequests();
          alert(accept
            ? '✅ დათანხმდით — გამომგზავნმა შეტყობინება მიიღო'
            : 'მოთხოვნა უარყოფილია — გამომგზავნმა შეტყობინება მიიღო');
        } else {
          alert('❌ ' + (res.message || 'ოპერაცია ვერ შესრულდა'));
        }
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.respondingTripRequestId = null;
        alert('❌ ' + (err.error?.message || 'ოპერაცია ვერ შესრულდა'));
        this.cdr.detectChanges();
      }
    });
  }

  // მძღოლის მიერ უარყოფილი trip-request-ის წაშლა სიიდან
  dismissRejectedTripRequest(request: TripPickupRequest): void {
    this.dismissingRequestId = request._id;
    this.cdr.detectChanges();

    this.parcelService.deleteMyTripPickupRequest(request._id).subscribe({
      next: (res) => {
        this.dismissingRequestId = null;
        if (res.success) {
          this.rejectedTripRequests = this.rejectedTripRequests.filter(r => r._id !== request._id);
        } else {
          alert('❌ ' + (res.message || 'წაშლა ვერ მოხერხდა'));
        }
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.dismissingRequestId = null;
        alert('❌ ' + (err.error?.message || 'წაშლა ვერ მოხერხდა'));
        this.cdr.detectChanges();
      }
    });
  }

  // trip pickup request-ის გამომგზავნის ინფო (populate-ის შემდეგ ობიექტია)
  senderOfTripRequest(request: TripPickupRequest): any {
    return typeof request.senderId === 'object' ? request.senderId : null;
  }

  // trip-ის ინფო request-იდან (populate-ის შემდეგ ობიექტია)
  tripOf(request: TripPickupRequest): any {
    return typeof request.tripId === 'object' ? request.tripId : null;
  }

  driverOf(offer: PickupOffer): any {
    return typeof offer.driverId === 'object' ? offer.driverId : null;
  }

  senderOf(offer: PickupOffer): any {
    return typeof offer.senderId === 'object' ? offer.senderId : null;
  }

  parcelOf(offer: PickupOffer): any {
    return typeof offer.parcelId === 'object' ? offer.parcelId : null;
  }

  isCurrentUserDriver(offer: PickupOffer): boolean {
    const d = this.driverOf(offer);
    const driverId = d ? d._id : offer.driverId;
    return String(driverId) === String(this.userId);
  }

  private applyUserData(user: UserProfile): void {
    this.userId = (user as any)._id ?? '';
    this.firstName = user.firstName;
    this.lastName = user.lastName;
    this.email = user.email;
    this.phone = user.phone;
    this.personalNumber = user.personalNumber;
    this.phoneVerified = user.phoneVerified;
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
      carModel: [this.carModel, [Validators.required]],
      carPlate: [this.carPlate, [Validators.required, Validators.pattern(/^[A-Z]{2}-\d{3}-[A-Z]{2}$/i)]],
      driverLicenseNumber: [this.driverLicenseNumber, [Validators.required]]
    });
  }

  getUserInitials(): string {
    return `${this.firstName.charAt(0)}${this.lastName.charAt(0)}`.toUpperCase() || '?';
  }

  getRoleLabel(): string {
    return 'მძღოლი';
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

  onConversationSelected(conversation: Conversation): void {
    const recipientId = conversation.userId && !conversation.userId.startsWith('unknown_')
      ? conversation.userId
      : ((conversation as any).recipientId || (conversation as any).otherUserId || '');

    this.selectedConversation = {
      ...conversation,
      userId: recipientId
    };

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

  openPickupFlow(): void {
    this.router.navigate(['/pickup']);
  }

  viewTripDetails(tripId: string): void {
    this.router.navigate(['/trip', tripId]);
  }

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

  logout(): void {
    if (confirm('დარწმუნებული ხართ რომ გამოწერთ?')) {
      this.socketService.disconnect?.();
      this.smsService.clearAuthToken();
      this.smsService.clearState();
      this.router.navigate(['/login']);
    }
  }

  openDeleteConfirm(): void {
    this.deleteAccountError = null;
    this.showDeleteAccountModal = true;
    this.cdr.detectChanges();
  }

  onDeleteAccountCancelled(): void {
    this.showDeleteAccountModal = false;
    this.deleteAccountError = null;
    this.cdr.detectChanges();
  }

  onDeleteAccountConfirmed(): void {
    this.deleteAccount();
  }

  private deleteAccount(): void {
    this.isDeletingAccount = true;
    this.deleteAccountError = null;
    this.cdr.detectChanges();

    this.smsService.deleteAccount().subscribe({
      next: () => {
        this.isDeletingAccount = false;
        this.socketService.disconnect?.();
        this.smsService.clearAuthToken();
        this.smsService.clearState();
        this.showDeleteAccountModal = false;
        alert('ანგარიში და მასთან დაკავშირებული მონაცემები (მგზავრობები — გარდა ჩათისა) წაიშალა.');
        this.router.navigate(['/login']);
      },
      error: (err) => {
        this.isDeletingAccount = false;
        this.deleteAccountError = err.error?.message || 'ანგარიშის წაშლა ვერ მოხერხდა';
        this.cdr.detectChanges();
      }
    });
  }

  private markFormAsTouched(): void {
    Object.values(this.profileForm.controls).forEach(control => control.markAsTouched());
  }
}