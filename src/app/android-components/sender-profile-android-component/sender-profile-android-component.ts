import {
  Component,
  OnInit,
  OnDestroy,
  ChangeDetectorRef,
  ViewEncapsulation
} from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { SmsVerificationService, UserProfile } from '../../services/smsverifikation.service';
import { ParcelService, PickupOffer, TripPickupRequest } from '../../services/Parcel.service';
import { SocketNotificationService } from '../../services/Socketnotification.service';
import { ConversationsListComponent, Conversation } from '../../chat/conversations-list-component/conversations-list-component';
import { ChatModalImprovedComponent } from '../../chat/chat-modal-component/chat-modal-component';
import { DeleteAccountModalComponent } from '../../profile-component/delete-account-modal-component/delete-account-modal-component';

interface ParcelRequest {
  _id: string;
  from: string;
  to: string;
  weight: number;
  value: number;
  status: 'pending' | 'accepted' | 'in-transit' | 'delivered';
  createdAt: string;
  images?: string[];
}

const PICKUP_NOTIFICATION_TYPES = [
  'pickup_offer',
  'pickup_offer_accepted',
  'pickup_offer_rejected',
  'pickup_offer_driver_completed',
  'pickup_offer_sender_confirmed',
  'trip_pickup_request_accepted',
  'trip_pickup_request_rejected'
];

@Component({
  selector: 'app-sender-profile-android',
  standalone: true,
  templateUrl: './sender-profile-android-component.html',
  styleUrl: './sender-profile-android-component.scss',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ConversationsListComponent,
    ChatModalImprovedComponent,
    DeleteAccountModalComponent
  ],
  template: '',
  styles: [],
  encapsulation: ViewEncapsulation.ShadowDom
})
export class SenderProfileAndroidComponent implements OnInit, OnDestroy {

  // ===== USER =====
  userId = '';
  firstName = '';
  lastName = '';
  email = '';
  phone = '';
  personalNumber = '';
  phoneVerified = false;

  // ===== STATE =====
  isLoading = true;
  isEditing = false;
  isSaving = false;
  errorMessage: string | null = null;
  profileForm!: FormGroup;

  // ===== REQUESTS & OFFERS =====
  userRequests: ParcelRequest[] = [];
  isLoadingRequests = false;
  deletingRequestId: string | null = null;


  incomingOffers: PickupOffer[] = [];
  inProgressOffers: PickupOffer[] = [];
  sentCompleted: PickupOffer[] = [];
  outgoingTripRequests: TripPickupRequest[] = [];
  dismissingRequestId: string | null = null;

  // ===== MODALS =====
  showConversations = false;
  showChatModal = false;
  selectedConversation: Conversation | null = null;
  unreadCount = 0;

  showOfferDetailModal = false;
  selectedOffer: PickupOffer | null = null;
  respondingOfferId: string | null = null;
  completingOfferId: string | null = null;

  showDeleteAccountModal = false;
  isDeletingAccount = false;
  deleteAccountError: string | null = null;

  private destroy$ = new Subject<void>();
  private lastHandledNotification: any = null;

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

    this.socketService.getNotifications()
      .pipe(takeUntil(this.destroy$))
      .subscribe(notifications => {
        const latest = notifications[0];
        if (!latest || latest === this.lastHandledNotification) return;
        this.lastHandledNotification = latest;

        if (PICKUP_NOTIFICATION_TYPES.includes(latest.type)) {
          this.loadPickupOffers();
          this.loadOutgoingTripRequests();
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ===== DATA LOADING =====
  private loadUserData(): void {
    this.isLoading = true;
    this.cdr.detectChanges();

    this.smsService.getProfile().subscribe({
      next: (res) => {
        this.isLoading = false;
        if (res.success && res.user) {
          this.applyUserData(res.user);
          this.initProfileForm();
          this.loadUserRequests();
          this.loadPickupOffers();
          this.loadOutgoingTripRequests();
        } else {
          this.errorMessage = res.message ?? 'ინფორმაცია ვერ ჩაიტვირთა';
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
        this.errorMessage = 'ინფორმაცია ვერ ჩაიტვირთა';
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
      error: () => {
        this.isLoadingRequests = false;
        this.userRequests = [];
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
      error: () => { this.incomingOffers = []; this.cdr.detectChanges(); }
    });

    this.parcelService.getMyInProgressOffers().subscribe({
      next: (res) => {
        this.inProgressOffers = res.success && res.offers ? res.offers : [];
        this.cdr.detectChanges();
      },
      error: () => { this.inProgressOffers = []; this.cdr.detectChanges(); }
    });

    this.parcelService.getMySentCompleted().subscribe({
      next: (res) => {
        this.sentCompleted = res.success && res.offers ? res.offers : [];
        this.cdr.detectChanges();
      },
      error: () => { this.sentCompleted = []; this.cdr.detectChanges(); }
    });
  }

  private loadOutgoingTripRequests(): void {
    this.parcelService.getMyTripPickupRequests().subscribe({
      next: (res) => {
        this.outgoingTripRequests = res.success && res.requests ? res.requests : [];
        this.cdr.detectChanges();
      },
      error: () => {
        this.outgoingTripRequests = [];
        this.cdr.detectChanges();
      }
    });
  }

  // ===== HELPERS =====
  private applyUserData(user: UserProfile): void {
    this.userId = (user as any)._id ?? '';
    this.firstName = user.firstName;
    this.lastName = user.lastName;
    this.email = user.email;
    this.phone = user.phone;
    this.personalNumber = user.personalNumber;
    this.phoneVerified = user.phoneVerified;
  }

  private initProfileForm(): void {
    this.profileForm = this.fb.group({
      firstName: [this.firstName, [Validators.required, Validators.minLength(2)]],
      lastName: [this.lastName, [Validators.required, Validators.minLength(2)]],
      email: [this.email, [Validators.required, Validators.email]],
      personalNumber: [{ value: this.personalNumber, disabled: true }]
    });
  }

  getUserInitials(): string {
    return `${this.firstName.charAt(0)}${this.lastName.charAt(0)}`.toUpperCase() || '?';
  }

  formatPhone(phone: string | undefined): string {
    if (!phone) return '—';
    if (phone.startsWith('995')) {
      return `+995 ${phone.slice(3, 6)} ${phone.slice(6, 8)} ${phone.slice(8)}`;
    }
    return `+995 ${phone.slice(0, 3)} ${phone.slice(3, 5)} ${phone.slice(5)}`;
  }

  formatDate(dateString: string): string {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleDateString('ka-GE', {
      year: 'numeric', month: 'short', day: 'numeric'
    });
  }

  formatDateTime(dateString: string | undefined): string {
    if (!dateString) return '—';
    const date = new Date(dateString);
    return `${date.toLocaleDateString('ka-GE', {
      year: 'numeric', month: 'short', day: 'numeric'
    })} ${date.toLocaleTimeString('ka-GE', { hour: '2-digit', minute: '2-digit' })}`;
  }

  isFieldInvalid(field: string): boolean {
    const c = this.profileForm?.get(field);
    return !!(c && c.invalid && (c.dirty || c.touched));
  }

  driverOf(offer: PickupOffer): any {
    return typeof offer.driverId === 'object' ? offer.driverId : null;
  }

  parcelOf(offer: PickupOffer): any {
    return typeof offer.parcelId === 'object' ? offer.parcelId : null;
  }

  driverOfTripRequest(req: TripPickupRequest): any {
    return typeof req.driverId === 'object' ? req.driverId : null;
  }

  tripOfRequest(req: TripPickupRequest): any {
    return typeof req.tripId === 'object' ? req.tripId : null;
  }

  getTripRequestStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      pending: '⏳ პასუხის მოლოდინში',
      accepted: '✅ დათანხმებულია',
      rejected: '❌ უარყოფილია'
    };
    return labels[status] || status;
  }

  getTripRequestStatusColor(status: string): string {
    const colors: Record<string, string> = {
      pending: '#f59e0b',
      accepted: '#10b981',
      rejected: '#ef4444'
    };
    return colors[status] || '#6b7280';
  }

  // ===== ACTIONS =====
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
      Object.values(this.profileForm.controls).forEach(c => c.markAsTouched());
      return;
    }
    this.isSaving = true;
    this.errorMessage = null;
    this.cdr.detectChanges();

    this.smsService.updateProfile(this.profileForm.getRawValue()).subscribe({
      next: (res) => {
        this.isSaving = false;
        if (res.success && res.user) {
          this.applyUserData(res.user);
          this.isEditing = false;
        } else {
          this.errorMessage = res.message ?? 'შენახვა ვერ მოხერხდა';
        }
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.isSaving = false;
        this.errorMessage = err.error?.message || 'შენახვა ვერ მოხერხდა';
        this.cdr.detectChanges();
      }
    });
  }

  openSendItemFlow(): void {
    this.router.navigate(['/send']);
  }

  viewRequestDetails(id: string): void {
    this.router.navigate(['/request', id]);
  }

  deleteRequest(id: string): void {
    if (!confirm('დარწმუნებული ხართ რომ გსურთ განცხადების წაშლა?')) return;
    this.deletingRequestId = id;
    this.cdr.detectChanges();
    this.parcelService.deleteParcelRequest(id).subscribe({
      next: (res) => {
        this.deletingRequestId = null;
        if (res.success) {
          this.userRequests = this.userRequests.filter(r => r._id !== id);
        } else {
          alert(res.message ?? 'წაშლა ვერ მოხერხდა');
        }
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.deletingRequestId = null;
        alert(err.error?.message || 'წაშლა ვერ მოხერხდა');
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
          alert(res.message || 'შეცდომა');
        }
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.respondingOfferId = null;
        alert(err.error?.message || 'შეცდომა');
        this.cdr.detectChanges();
      }
    });
  }

  confirmSenderComplete(offer: PickupOffer): void {
    this.completingOfferId = offer._id;
    this.cdr.detectChanges();
    this.parcelService.confirmPickupCompleteBySender(offer._id).subscribe({
      next: (res) => {
        this.completingOfferId = null;
        if (res.success) {
          alert('✅ დადასტურებულია — მიწოდება დასრულდა');
          this.loadPickupOffers();
        } else {
          alert(res.message || 'შეცდომა');
        }
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.completingOfferId = null;
        alert(err.error?.message || 'შეცდომა');
        this.cdr.detectChanges();
      }
    });
  }

  dismissTripRequest(req: TripPickupRequest): void {
    this.dismissingRequestId = req._id;
    this.cdr.detectChanges();
    this.parcelService.deleteMyTripPickupRequest(req._id).subscribe({
      next: (res) => {
        this.dismissingRequestId = null;
        if (res.success) {
          this.outgoingTripRequests = this.outgoingTripRequests.filter(r => r._id !== req._id);
        } else {
          alert(res.message || 'წაშლა ვერ მოხერხდა');
        }
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.dismissingRequestId = null;
        alert(err.error?.message || 'წაშლა ვერ მოხერხდა');
        this.cdr.detectChanges();
      }
    });
  }

  toggleConversations(): void {
    this.showConversations = !this.showConversations;
  }

  onConversationSelected(conversation: Conversation): void {
    const conversationId = String(
      (conversation as any).conversationId ||
      (conversation as any).requestId || ''
    ).trim();

    const recipientId = String(
      (conversation as any).userId ||
      (conversation as any).recipientId ||
      (conversation as any).otherUserId || ''
    ).trim();

    const recipientName = String(
      (conversation as any).userName ||
      (conversation as any).recipientName || 'მომხმარებელი'
    ).trim();

    if (!conversationId || !recipientId || recipientId.startsWith('unknown_')) return;

    this.selectedConversation = {
      ...conversation,
      conversationId,
      userId: recipientId,
      userName: recipientName
    };

    this.socketService.registerConversationMeta(conversationId, recipientId, recipientName);
    this.showConversations = false;
    this.showChatModal = true;
    this.cdr.detectChanges();
  }

  closeChatModal(): void {
    this.showChatModal = false;
    this.selectedConversation = null;
  }

  logout(): void {
    if (confirm('დარწმუნებული ხართ რომ გსურთ გამოსვლა?')) {
      this.socketService.disconnect?.();
      this.smsService.clearAuthToken();
      this.smsService.clearState();
      this.router.navigate(['/login']);
    }
  }

  openDeleteConfirm(): void {
    this.deleteAccountError = null;
    this.showDeleteAccountModal = true;
  }

  onDeleteAccountCancelled(): void {
    this.showDeleteAccountModal = false;
    this.deleteAccountError = null;
  }

  onDeleteAccountConfirmed(): void {
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
        alert('ანგარიში წაიშალა');
        this.router.navigate(['/login']);
      },
      error: (err) => {
        this.isDeletingAccount = false;
        this.deleteAccountError = err.error?.message || 'წაშლა ვერ მოხერხდა';
        this.cdr.detectChanges();
      }
    });
  }

  goBack(): void {
    this.router.navigate(['/dashboard']);
  }
}