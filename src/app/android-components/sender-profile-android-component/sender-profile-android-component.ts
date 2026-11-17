import {
  Component,
  OnInit,
  OnDestroy,
  ChangeDetectorRef,
  ViewEncapsulation,
  ViewChild,
  ElementRef,
  Renderer2,
  PLATFORM_ID,
  Inject
} from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { SmsVerificationService, UserProfile } from '../../services/smsverifikation.service';
import { ParcelService, PickupOffer, TripPickupRequest } from '../../services/Parcel.service';
import { SocketNotificationService } from '../../services/Socketnotification.service';
import { ConversationsListComponent, Conversation } from '../../chat/conversations-list-component/conversations-list-component';
import { ChatModalImprovedComponent } from '../../chat/chat-modal-component/chat-modal-component';
import { DeleteAccountModalComponent } from '../../profile-component/delete-account-modal-component/delete-account-modal-component';
import { ReviewModalComponent } from '../../Product-Colection/review-modal-component/review-modal-component';
import { StarRatingComponent } from '../../Product-Colection/star-rating-component/star-rating-component';

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
    DeleteAccountModalComponent,
    ReviewModalComponent,
    StarRatingComponent
  ],
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

  // 🛠️ FIX: profileForm იქმნება ერთხელ, სინქრონულად ngOnInit-ში.
  // FormGroup-ის ობიექტი აღარასდროს იცვლება ახლით — მხოლოდ patchValue-ით
  // ახლდება, რაც ხსნის prerender-ის დროს "_rawValidators of undefined" შეცდომას.
  profileForm!: FormGroup;

  // ✅ თითოეული სექციის გახსნა/დახურვის მდგომარეობა (accordion)
  openSections: { [key: string]: boolean } = {};

  // ===== REQUESTS & OFFERS =====
  userRequests: ParcelRequest[] = [];
  isLoadingRequests = false;
  deletingRequestId: string | null = null;

  incomingOffers: PickupOffer[] = [];
  inProgressOffers: PickupOffer[] = [];
  sentCompleted: PickupOffer[] = [];
  outgoingTripRequests: TripPickupRequest[] = [];
  dismissingRequestId: string | null = null;

  // ⭐ რეიტინგი
  ratingAvg = 0;
  ratingCount = 0;

  // ⭐ შეფასების მოდალი
  showReviewModal = false;
  reviewOfferId = '';
  reviewTargetName = '';
  reviewTargetRole: 'driver' | 'sender' = 'driver';

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

  // ===== CHAT MODAL PORTAL =====
  @ViewChild('chatModalRoot') chatModalRoot?: ElementRef<HTMLElement>;
  private chatModalOriginalParent: Node | null = null;
  private chatModalOriginalNextSibling: Node | null = null;
  private chatModalMovedToBody = false;
  private injectedPortalStyles: HTMLStyleElement[] = [];
  private bodyOverflowBeforeLock: string | null = null;

  // 🖥️ SSR/PRERENDER SAFETY — document.body/document.head მხოლოდ ბრაუზერშია უსაფრთხო
  private isBrowser: boolean;

  private destroy$ = new Subject<void>();
  private lastHandledNotification: any = null;

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private smsService: SmsVerificationService,
    private parcelService: ParcelService,
    private socketService: SocketNotificationService,
    private cdr: ChangeDetectorRef,
    private renderer: Renderer2,
    private hostEl: ElementRef<HTMLElement>,
    @Inject(PLATFORM_ID) platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  ngOnInit(): void {
    // 🛠️ FIX: FormGroup-ის ინსტანცია იქმნება ერთხელ და დაუყოვნებლივ,
    // სანამ template-მა [formGroup]="profileForm" პირველად დააბაინდოს
    // (auth-შემოწმებამდეც, რომ redirect-ის დროს profileForm არასდროს იყოს undefined).
    this.initProfileForm();

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
          this.loadRatingStats();
        }
      });
  }

  ngOnDestroy(): void {
    this.restoreChatModalFromBody();
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ===== ACCORDION =====
  toggleSection(key: string): void {
    this.openSections[key] = !this.openSections[key];
  }

  isSectionOpen(key: string): boolean {
    return !!this.openSections[key];
  }

  // ===== DATA LOADING =====
  // ✅ FIX: ყველა HTTP subscription-ს აქვს takeUntil(this.destroy$).
  private loadUserData(): void {
    this.isLoading = true;
    this.cdr.detectChanges();

    this.smsService.getProfile()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.isLoading = false;
          if (res.success && res.user) {
            this.applyUserData(res.user);
            this.initProfileForm();
            this.loadUserRequests();
            this.loadPickupOffers();
            this.loadOutgoingTripRequests();
            this.loadRatingStats();
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

  // ⭐ ჩემი რეიტინგის ჩატვირთვა
  private loadRatingStats(): void {
    if (!this.userId) return;

    this.parcelService.getUserRatingStats(this.userId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          const stats = res.stats ?? res.data;
          this.ratingAvg = stats?.ratingAvg ?? 0;
          this.ratingCount = stats?.ratingCount ?? 0;
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('Error loading rating stats:', err);
        }
      });
  }

  private loadUserRequests(): void {
    this.isLoadingRequests = true;
    this.cdr.detectChanges();
    this.parcelService.getUserRequests()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
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
    this.parcelService.getIncomingOffers()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.incomingOffers = res.success && res.offers ? res.offers : [];
          this.cdr.detectChanges();
        },
        error: () => { this.incomingOffers = []; this.cdr.detectChanges(); }
      });

    this.parcelService.getMyInProgressOffers()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.inProgressOffers = res.success && res.offers ? res.offers : [];
          this.cdr.detectChanges();
        },
        error: () => { this.inProgressOffers = []; this.cdr.detectChanges(); }
      });

    this.parcelService.getMySentCompleted()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.sentCompleted = res.success && res.offers ? res.offers : [];
          this.cdr.detectChanges();
        },
        error: () => { this.sentCompleted = []; this.cdr.detectChanges(); }
      });
  }

  private loadOutgoingTripRequests(): void {
    this.parcelService.getMyTripPickupRequests()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
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

  /**
   * 🛠️ FIX: აღარ ქმნის ახალ FormGroup ინსტანციას ყოველ გამოძახებაზე.
   * პირველი გამოძახება (ngOnInit-იდან) ქმნის ცარიელ ფორმას სწორი
   * validator-ებით. ყოველი შემდგომი გამოძახება მხოლოდ patchValue-ით
   * ანახლებს უკვე არსებულ ინსტანციას.
   */
  private initProfileForm(): void {
    if (!this.profileForm) {
      this.profileForm = this.fb.group({
        firstName: ['', [Validators.required, Validators.minLength(2)]],
        lastName: ['', [Validators.required, Validators.minLength(2)]],
        email: ['', [Validators.required, Validators.email]],
        personalNumber: [{ value: '', disabled: true }]
      });
      return;
    }

    this.profileForm.patchValue({
      firstName: this.firstName,
      lastName: this.lastName,
      email: this.email,
      personalNumber: this.personalNumber
    });

    this.profileForm.markAsPristine();
    this.profileForm.markAsUntouched();
  }

  getUserInitials(): string {
    return `${this.firstName.charAt(0)}${this.lastName.charAt(0)}`.toUpperCase() || '?';
  }

  getRoleLabel(): string {
    return 'გამგზავნი';
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

  senderOf(offer: PickupOffer): any {
    return typeof offer.senderId === 'object' ? offer.senderId : null;
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

    this.smsService.updateProfile(this.profileForm.getRawValue())
      .pipe(takeUntil(this.destroy$))
      .subscribe({
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

  openSendItemFlow(): void {
    this.router.navigate(['/send']);
  }

  viewRequestDetails(id: string): void {
    this.router.navigate(['/request', id]);
  }

  canDeleteRequest(request: ParcelRequest): boolean {
    return true;
  }

  deleteRequest(id: string): void {
    const confirmed = confirm(
      '⚠️ დარწმუნებული ხართ, რომ გსურთ ამ განცხადების წაშლა?\nუკან დაბრუნება შეუძლებელი იქნება.'
    );
    if (!confirmed) return;

    this.deletingRequestId = id;
    this.cdr.detectChanges();
    this.parcelService.deleteParcelRequest(id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.deletingRequestId = null;
          if (res.success) {
            this.userRequests = this.userRequests.filter(r => r._id !== id);
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
    this.parcelService.respondToOffer(offer._id, accept)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
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
    this.parcelService.confirmPickupCompleteBySender(offer._id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.completingOfferId = null;
          if (res.success) {
            this.loadPickupOffers();
            // ⭐ დადასტურების შემდეგ მაშინვე გამოდის მძღოლის შეფასების ფანჯარა
            this.openReview(offer);
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

  // ============================================================
  // ⭐ შეფასების სისტემა
  // ============================================================

  // გამგზავნი აფასებს მძღოლს
  openReview(offer: PickupOffer): void {
    const driver = this.driverOf(offer);
    this.reviewOfferId = offer._id;
    this.reviewTargetName = driver ? `${driver.firstName} ${driver.lastName}` : 'მძღოლი';
    this.reviewTargetRole = 'driver';
    this.showReviewModal = true;
    this.cdr.detectChanges();
  }

  closeReview(): void {
    this.showReviewModal = false;
    this.reviewOfferId = '';
    this.cdr.detectChanges();
  }

  onReviewSubmitted(): void {
    this.showReviewModal = false;
    this.reviewOfferId = '';
    this.loadPickupOffers();
    this.loadRatingStats();
    this.cdr.detectChanges();
    alert('✅ მადლობა შეფასებისთვის!');
  }

  hasReviewed(offer: PickupOffer): boolean {
    return !!offer.reviewedBySender;
  }

  // ============================================================

  dismissTripRequest(req: TripPickupRequest): void {
    this.dismissingRequestId = req._id;
    this.cdr.detectChanges();
    this.parcelService.deleteMyTripPickupRequest(req._id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.dismissingRequestId = null;
          if (res.success) {
            this.outgoingTripRequests = this.outgoingTripRequests.filter(r => r._id !== req._id);
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

  // ============================================================
  // 💬 ჩატი
  // ============================================================
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

    setTimeout(() => this.moveChatModalToBody(), 0);
  }

  closeChatModal(): void {
    this.restoreChatModalFromBody();
    this.showChatModal = false;
    this.selectedConversation = null;
  }

  private moveChatModalToBody(): void {
    if (!this.isBrowser) return;

    const el = this.chatModalRoot?.nativeElement;
    if (!el || this.chatModalMovedToBody) return;

    this.injectPortalStyles();

    this.chatModalOriginalParent = el.parentNode;
    this.chatModalOriginalNextSibling = el.nextSibling;

    this.renderer.appendChild(document.body, el);
    this.chatModalMovedToBody = true;

    this.bodyOverflowBeforeLock = document.body.style.overflow || '';
    this.renderer.setStyle(document.body, 'overflow', 'hidden');
  }

  private restoreChatModalFromBody(): void {
    if (!this.isBrowser) return;
    if (!this.chatModalMovedToBody) return;

    const el = this.chatModalRoot?.nativeElement;

    if (el && this.chatModalOriginalParent) {
      if (this.chatModalOriginalNextSibling) {
        this.renderer.insertBefore(this.chatModalOriginalParent, el, this.chatModalOriginalNextSibling);
      } else {
        this.renderer.appendChild(this.chatModalOriginalParent, el);
      }
    }

    this.renderer.setStyle(document.body, 'overflow', this.bodyOverflowBeforeLock ?? '');
    this.bodyOverflowBeforeLock = null;

    this.removePortalStyles();

    this.chatModalMovedToBody = false;
    this.chatModalOriginalParent = null;
    this.chatModalOriginalNextSibling = null;
  }

  private injectPortalStyles(): void {
    if (!this.isBrowser) return;

    const shadowRoot = this.hostEl.nativeElement.shadowRoot;
    if (!shadowRoot) return;

    const styleEls = shadowRoot.querySelectorAll('style');
    styleEls.forEach(styleEl => {
      const clone = styleEl.cloneNode(true) as HTMLStyleElement;
      clone.setAttribute('data-chat-modal-portal-style', '');
      document.head.appendChild(clone);
      this.injectedPortalStyles.push(clone);
    });
  }

  private removePortalStyles(): void {
    if (!this.isBrowser) return;

    this.injectedPortalStyles.forEach(styleEl => styleEl.remove());
    this.injectedPortalStyles = [];
  }

  // ============================================================
  // ACCOUNT
  // ============================================================
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
    this.cdr.detectChanges();
  }

  onDeleteAccountCancelled(): void {
    this.showDeleteAccountModal = false;
    this.deleteAccountError = null;
    this.cdr.detectChanges();
  }

  onDeleteAccountConfirmed(): void {
    this.isDeletingAccount = true;
    this.deleteAccountError = null;
    this.cdr.detectChanges();

    this.smsService.deleteAccount()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
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

  goBack(): void {
    this.router.navigate(['/dashboard']);
  }
}