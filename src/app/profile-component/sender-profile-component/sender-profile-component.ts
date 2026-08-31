import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { SmsVerificationService, UserProfile } from '../../services/smsverifikation.service';
import { ParcelService, PickupOffer, TripPickupRequest } from '../../services/Parcel.service'; // ✅ NEW: TripPickupRequest დამატებულია
import { ConversationsListComponent, Conversation } from '../../chat/conversations-list-component/conversations-list-component';
import { ChatModalImprovedComponent } from '../../chat/chat-modal-component/chat-modal-component';
import { SocketNotificationService } from '../../services/Socketnotification.service';
import { DeleteAccountModalComponent } from '../delete-account-modal-component/delete-account-modal-component';

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
  'trip_pickup_request_accepted', // ✅ NEW: მძღოლმა დაათანხმა ჩემი trip-მოთხოვნა
  'trip_pickup_request_rejected'  // ✅ NEW: მძღოლმა უარყო ჩემი trip-მოთხოვნა
];

@Component({
  selector: 'app-sender-profile',
  templateUrl: './sender-profile-component.html',
  styleUrls: ['./sender-profile-component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ConversationsListComponent,
    ChatModalImprovedComponent,
    DeleteAccountModalComponent,
  ]
})
export class SenderProfileComponent implements OnInit, OnDestroy {
  userId = '';
  firstName = '';
  lastName = '';
  email = '';
  phone = '';
  personalNumber = '';
  phoneVerified = false;

  profileForm!: FormGroup;
  isEditing = false;
  isSaving = false;
  isLoading = false;
  errorMessage: string | null = null;
  showMenu = false;

  userRequests: ParcelRequest[] = [];
  isLoadingRequests = false;
  deletingRequestId: string | null = null;

  showConversations = false;
  showChatModal = false;
  selectedConversation: Conversation | null = null;
  dismissingRequestId: string | null = null;
  unreadCount = 0;

  incomingOffers: PickupOffer[] = [];
  inProgressOffers: PickupOffer[] = [];
  sentCompleted: PickupOffer[] = [];

  // ✅ NEW: ჩემი გაგზავნილი trip-მოთხოვნები (ტრიპზე ჩატვირთვის თხოვნები)
  outgoingTripRequests: TripPickupRequest[] = [];

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

    this.socketService.getNotifications()
      .pipe(takeUntil(this.destroy$))
      .subscribe(notifications => {
        const latest = notifications[0];
        if (!latest || latest === this.lastHandledNotification) return;

        this.lastHandledNotification = latest;

        if (PICKUP_NOTIFICATION_TYPES.includes(latest.type)) {
          this.loadPickupOffers();
          this.loadOutgoingTripRequests(); // ✅ NEW
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
          this.loadUserRequests();
          this.loadPickupOffers();
          this.loadOutgoingTripRequests(); // ✅ NEW
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

    this.parcelService.getMySentCompleted().subscribe({
      next: (res) => {
        this.sentCompleted = res.success && res.offers ? res.offers : [];
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.sentCompleted = [];
        console.error('Error loading sent-completed offers:', err);
        this.cdr.detectChanges();
      }
    });
  }

  // ✅ NEW: ჩემი გაგზავნილი trip-მოთხოვნების ჩატვირთვა
  private loadOutgoingTripRequests(): void {
    this.parcelService.getMyTripPickupRequests().subscribe({
      next: (res) => {
        this.outgoingTripRequests = res.success && res.requests ? res.requests : [];
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.outgoingTripRequests = [];
        console.error('Error loading outgoing trip requests:', err);
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

  driverOf(offer: PickupOffer): any {
    return typeof offer.driverId === 'object' ? offer.driverId : null;
  }

  senderOf(offer: PickupOffer): any {
    return typeof offer.senderId === 'object' ? offer.senderId : null;
  }

  parcelOf(offer: PickupOffer): any {
    return typeof offer.parcelId === 'object' ? offer.parcelId : null;
  }

  // ✅ NEW: trip-მოთხოვნის მძღოლის ინფო (populate-ის შემდეგ ობიექტია)
  driverOfTripRequest(request: TripPickupRequest): any {
    return typeof request.driverId === 'object' ? request.driverId : null;
  }

  // ✅ NEW: trip-მოთხოვნის ტრიპის მარშრუტი (populate-ის შემდეგ ობიექტია)
  tripOfRequest(request: TripPickupRequest): any {
    return typeof request.tripId === 'object' ? request.tripId : null;
  }

  // ✅ NEW: trip-მოთხოვნის სტატუსის ლეიბლი
  getTripRequestStatusLabel(status: string): string {
    const labels: { [key: string]: string } = {
      'pending': '⏳ პასუხის მოლოდინში',
      'accepted': '✅ დათანხმებულია',
      'rejected': '❌ უარყოფილია'
    };
    return labels[status] || status;
  }

  // ✅ NEW: trip-მოთხოვნის სტატუსის ფერი
  getTripRequestStatusColor(status: string): string {
    const colors: { [key: string]: string } = {
      'pending': '#f59e0b',
      'accepted': '#10b981',
      'rejected': '#ef4444'
    };
    return colors[status] || '#6b7280';
  }

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

  getRoleLabel(): string {
    return 'გამგზავნი';
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
  console.log('📂 არჩეული საუბარი:', conversation);

  const conversationId = String(
    (conversation as any).conversationId ||
    (conversation as any).requestId ||
    ''
  ).trim();

  const recipientId = String(
    (conversation as any).userId ||
    (conversation as any).recipientId ||
    (conversation as any).otherUserId ||
    ''
  ).trim();

  const recipientName = String(
    (conversation as any).userName ||
    (conversation as any).recipientName ||
    'მომხმარებელი'
  ).trim();

  console.log('💬 ჩატის გახსნა:', {
    conversationId,
    recipientId,
    recipientName
  });

  if (!conversationId) {
    console.error('❌ conversationId/requestId არ არსებობს:', conversation);
    return;
  }

  if (!recipientId || recipientId.startsWith('unknown_')) {
    console.error('❌ recipientId არ არსებობს:', conversation);
    return;
  }

  this.selectedConversation = {
    ...conversation,
    conversationId,
    userId: recipientId,
    userName: recipientName
  };

  this.socketService.registerConversationMeta(
    conversationId,
    recipientId,
    recipientName
  );

  // ჯერ ვხურავთ საუბრების სიას
  this.showConversations = false;

  // შემდეგ ვხსნით ჩატს
  this.showChatModal = true;

  this.cdr.detectChanges();

  console.log('✅ Chat Modal გაიხსნა:', this.selectedConversation);
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

  viewRequestDetails(requestId: string): void {
    this.router.navigate(['/request', requestId]);
  }

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
        alert('ანგარიში და მასთან დაკავშირებული მონაცემები (განცხადებები — გარდა ჩათისა) წაიშალა.');
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

   dismissTripRequest(request: TripPickupRequest): void {
    this.dismissingRequestId = request._id;
    this.cdr.detectChanges();

    this.parcelService.deleteMyTripPickupRequest(request._id).subscribe({
      next: (res) => {
        this.dismissingRequestId = null;
        if (res.success) {
          this.outgoingTripRequests = this.outgoingTripRequests.filter(r => r._id !== request._id);
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
}