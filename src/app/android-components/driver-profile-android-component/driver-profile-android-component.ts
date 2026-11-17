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
import { ParcelService, DriverTrip, PickupOffer, TripPickupRequest } from '../../services/Parcel.service';
import { SocketNotificationService } from '../../services/Socketnotification.service';
import { ConversationsListComponent, Conversation } from '../../chat/conversations-list-component/conversations-list-component';
import { ChatModalImprovedComponent } from '../../chat/chat-modal-component/chat-modal-component';
import { DeleteAccountModalComponent } from '../../profile-component/delete-account-modal-component/delete-account-modal-component';
import { ReviewModalComponent } from '../../Product-Colection/review-modal-component/review-modal-component';
import { StarRatingComponent } from '../../Product-Colection/star-rating-component/star-rating-component';

// მძღოლის მიერ გაგზავნილი ამანათის განცხადება
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
  'trip_pickup_request'
];

@Component({
  selector: 'app-driver-profile-android',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ConversationsListComponent,
    ChatModalImprovedComponent,
    DeleteAccountModalComponent,
    ReviewModalComponent,
    StarRatingComponent
  ],
  templateUrl: './driver-profile-android-component.html',
  styleUrl: './driver-profile-android-component.scss',
  encapsulation: ViewEncapsulation.ShadowDom
})
export class DriverProfileAndroidComponent implements OnInit, OnDestroy {

  // ===== USER =====
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

  // ===== STATE =====
  isLoading = true;
  isEditing = false;
  isSaving = false;
  errorMessage: string | null = null;

  // 🛠️ FIX: profileForm იქმნება ერთხელ, სინქრონულად ngOnInit-ში.
  // FormGroup-ის ობიექტი აღარასდროს იცვლება ახლით — მხოლოდ patchValue-ით
  // ახლდება, რაც არ არღვევს უკვე bound [formGroup] დირექტივას და
  // ხსნის prerender-ის დროს "_rawValidators of undefined" შეცდომას.
  profileForm!: FormGroup;

  // ✅ თითოეული სექციის გახსნა/დახურვის მდგომარეობა (accordion)
  openSections: { [key: string]: boolean } = {};

  // ===== TRIPS & OFFERS =====
  driverTrips: DriverTrip[] = [];
  isLoadingTrips = false;
  deletingTripId: string | null = null;

  // ===== ჩემი განცხადებები (მძღოლიც აგზავნის ამანათს) =====
  userRequests: ParcelRequest[] = [];
  isLoadingRequests = false;
  deletingRequestId: string | null = null;

  incomingOffers: PickupOffer[] = [];
  inProgressOffers: PickupOffer[] = [];
  pickedUpCompleted: PickupOffer[] = [];
  rejectedPickupOffers: PickupOffer[] = [];
  dismissingOfferId: string | null = null;

  incomingTripRequests: TripPickupRequest[] = [];
  rejectedTripRequests: TripPickupRequest[] = [];
  respondingTripRequestId: string | null = null;
  dismissingRequestId: string | null = null;

  // ⭐ რეიტინგი
  ratingAvg = 0;
  ratingCount = 0;

  // ⭐ შეფასების მოდალი
  showReviewModal = false;
  reviewOfferId = '';
  reviewTargetName = '';
  reviewTargetRole: 'driver' | 'sender' = 'sender';

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

    this.parcelService.tripCreated()
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.loadDriverTrips());

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
            this.loadDriverTrips();
            this.loadUserRequests();
            this.loadPickupOffers();
            this.loadIncomingTripRequests();
            this.loadMyOutgoingOffers();
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

  private loadDriverTrips(): void {
    this.isLoadingTrips = true;
    this.cdr.detectChanges();
    this.parcelService.getDriverTrips()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: any) => {
          this.isLoadingTrips = false;
          this.driverTrips = res.success && res.trips ? res.trips : [];
          this.cdr.detectChanges();
        },
        error: () => {
          this.isLoadingTrips = false;
          this.driverTrips = [];
          this.cdr.detectChanges();
        }
      });
  }

  // 📦 მძღოლის მიერ დამატებული განცხადებები
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

    this.parcelService.getMyPickedUpCompleted()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.pickedUpCompleted = res.success && res.offers ? res.offers : [];
          this.cdr.detectChanges();
        },
        error: () => { this.pickedUpCompleted = []; this.cdr.detectChanges(); }
      });
  }

  private loadMyOutgoingOffers(): void {
    this.parcelService.getMyOutgoingPickupOffers()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          const all = res.success && res.offers ? res.offers : [];
          this.rejectedPickupOffers = all.filter(o => o.status === 'rejected');
          this.cdr.detectChanges();
        },
        error: () => { this.rejectedPickupOffers = []; this.cdr.detectChanges(); }
      });
  }

  private loadIncomingTripRequests(): void {
    this.parcelService.getIncomingTripRequests()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          const all = res.success && res.requests ? res.requests : [];
          this.incomingTripRequests = all.filter(r => r.status === 'pending');
          this.rejectedTripRequests = all.filter(r => r.status === 'rejected');
          this.cdr.detectChanges();
        },
        error: () => {
          this.incomingTripRequests = [];
          this.rejectedTripRequests = [];
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
    this.carModel = user.carModel ?? '';
    this.carPlate = user.carPlate ?? '';
    this.driverLicenseNumber = user.driverLicenseNumber ?? '';
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
        personalNumber: [{ value: '', disabled: true }],
        carModel: ['', [Validators.required]],
        carPlate: ['', [Validators.required, Validators.pattern(/^[A-Z]{2}-\d{3}-[A-Z]{2}$/i)]],
        driverLicenseNumber: ['', [Validators.required]]
      });
      return;
    }

    this.profileForm.patchValue({
      firstName: this.firstName,
      lastName: this.lastName,
      email: this.email,
      personalNumber: this.personalNumber,
      carModel: this.carModel,
      carPlate: this.carPlate,
      driverLicenseNumber: this.driverLicenseNumber
    });

    this.profileForm.markAsPristine();
    this.profileForm.markAsUntouched();
  }

  getUserInitials(): string {
    return `${this.firstName.charAt(0)}${this.lastName.charAt(0)}`.toUpperCase() || '?';
  }

  getRoleLabel(): string {
    return 'მძღოლი';
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

  getTripEarnings(trip: DriverTrip): string {
    if (!trip.acceptedShippings?.length) return '0 ₾';
    const total = trip.acceptedShippings.reduce((sum, s) => {
      const weight = s.parcelDetails?.weight || 0;
      return sum + weight * (trip.pricePerKg || 0);
    }, 0);
    return `${total.toFixed(2)} ₾`;
  }

  isFieldInvalid(field: string): boolean {
    const c = this.profileForm?.get(field);
    return !!(c && c.invalid && (c.dirty || c.touched));
  }

  senderOf(offer: PickupOffer): any {
    return typeof offer.senderId === 'object' ? offer.senderId : null;
  }

  parcelOf(offer: PickupOffer): any {
    return typeof offer.parcelId === 'object' ? offer.parcelId : null;
  }

  driverOf(offer: PickupOffer): any {
    return typeof offer.driverId === 'object' ? offer.driverId : null;
  }

  isCurrentUserDriver(offer: PickupOffer): boolean {
    const d = this.driverOf(offer);
    const id = d ? d._id : offer.driverId;
    return String(id) === String(this.userId);
  }

  senderOfTripRequest(req: TripPickupRequest): any {
    return typeof req.senderId === 'object' ? req.senderId : null;
  }

  tripOf(req: TripPickupRequest): any {
    return typeof req.tripId === 'object' ? req.tripId : null;
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

  openPickupFlow(): void {
    this.router.navigate(['/pickup']);
  }

  // 📦 ახალი განცხადების დამატება (ამანათის გაგზავნა)
  openSendItemFlow(): void {
    this.router.navigate(['/send']);
  }

  viewTripDetails(id: string): void {
    this.router.navigate(['/trip', id]);
  }

  viewRequestDetails(id: string): void {
    this.router.navigate(['/request', id]);
  }

  canDeleteTrip(trip: DriverTrip): boolean {
    return true;
  }

  canDeleteRequest(request: ParcelRequest): boolean {
    return true;
  }

  deleteTrip(id: string): void {
    const confirmed = confirm(
      '⚠️ დარწმუნებული ხართ, რომ გსურთ ამ მგზავრობის წაშლა?\nუკან დაბრუნება შეუძლებელი იქნება.'
    );
    if (!confirmed) return;

    this.deletingTripId = id;
    this.cdr.detectChanges();
    this.parcelService.deleteTrip(id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.deletingTripId = null;
          if (res.success) {
            this.driverTrips = this.driverTrips.filter(t => t._id !== id);
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

  markDriverComplete(offer: PickupOffer): void {
    this.completingOfferId = offer._id;
    this.cdr.detectChanges();
    this.parcelService.markPickupCompleteByDriver(offer._id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
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

  // ============================================================
  // ⭐ შეფასების სისტემა
  // ============================================================

  // მძღოლი აფასებს გამგზავნს
  openReview(offer: PickupOffer): void {
    const sender = this.senderOf(offer);
    this.reviewOfferId = offer._id;
    this.reviewTargetName = sender ? `${sender.firstName} ${sender.lastName}` : 'გამგზავნი';
    this.reviewTargetRole = 'sender';
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
    return !!offer.reviewedByDriver;
  }

  // ============================================================

  respondToTripRequest(req: TripPickupRequest, accept: boolean): void {
    this.respondingTripRequestId = req._id;
    this.cdr.detectChanges();
    this.parcelService.respondToTripPickupRequest(req._id, accept)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
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

  dismissRejectedOffer(offer: PickupOffer): void {
    this.dismissingOfferId = offer._id;
    this.cdr.detectChanges();
    this.parcelService.deletePickupOffer(offer._id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
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

  dismissRejectedTripRequest(req: TripPickupRequest): void {
    this.dismissingRequestId = req._id;
    this.cdr.detectChanges();
    this.parcelService.deleteMyTripPickupRequest(req._id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.dismissingRequestId = null;
          if (res.success) {
            this.rejectedTripRequests = this.rejectedTripRequests.filter(r => r._id !== req._id);
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

  toggleConversations(): void {
    this.showConversations = !this.showConversations;
  }

  onConversationSelected(conv: Conversation): void {
    const recipientId = conv.userId && !conv.userId.startsWith('unknown_')
      ? conv.userId
      : ((conv as any).recipientId || (conv as any).otherUserId || '');

    this.selectedConversation = { ...conv, userId: recipientId };
    if (recipientId) {
      this.socketService.registerConversationMeta(conv.conversationId, recipientId, conv.userName);
    }
    this.showChatModal = true;
    this.showConversations = false;
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

  goBack(): void {
    this.router.navigate(['/dashboard']);
  }
}