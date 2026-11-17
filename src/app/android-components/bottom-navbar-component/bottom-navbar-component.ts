import {
  Component,
  OnInit,
  OnDestroy,
  ViewEncapsulation,
  ChangeDetectorRef,
  ElementRef,
  HostListener,
  Inject,
  PLATFORM_ID
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Router, NavigationEnd, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';

import {
  SmsVerificationService,
  UserProfile
} from '../../services/smsverifikation.service';

import {
  NotificationData,
  SocketNotificationService
} from '../../services/Socketnotification.service';

interface InfoLink {
  label: string;
  path: string;
}

interface AddAction {
  label: string;
  hint: string;
  path: string;
  kind: 'send' | 'ride';
}

@Component({
  selector: 'app-bottom-navbar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './bottom-navbar-component.html',
  styleUrl: './bottom-navbar-component.scss',
  encapsulation: ViewEncapsulation.ShadowDom
})
export class BottomNavbarComponent implements OnInit, OnDestroy {

  // ინფორმაციული ბმულები (იგივე რაც ჩვეულებრივ ნავბარში)
  readonly infoLinks: InfoLink[] = [
    { label: 'როგორ მუშაობს', path: '/howtowork' },
    { label: 'წესები', path: '/rules' },
    { label: 'კონტაქტი', path: '/support' }
  ];

  isLoggedIn = false;
  currentUser: UserProfile | null = null;

  isAddMenuOpen = false;
  isNotifOpen = false;
  notifications: NotificationData[] = [];
  unreadCount = 0;

  private subscriptions: Subscription[] = [];
  private readonly isBrowser: boolean;

  constructor(
    private router: Router,
    private smsService: SmsVerificationService,
    private notificationService: SocketNotificationService,
    private cdr: ChangeDetectorRef,
    private elementRef: ElementRef<HTMLElement>,
    @Inject(PLATFORM_ID) platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  // ================= LIFECYCLE =================

  ngOnInit(): void {
    this.subscriptions.push(
      this.smsService.isLoggedIn$.subscribe((status) => {
        this.isLoggedIn = status;
        if (!status) {
          this.closeSheets();
        }
        this.cdr.detectChanges();
      }),
      this.smsService.currentUser$.subscribe((user) => {
        this.currentUser = user;
        this.cdr.detectChanges();
      }),
      this.notificationService.getNotifications().subscribe((list) => {
        this.notifications = list;
        this.cdr.detectChanges();
      }),
      this.notificationService.getNotificationsUnreadCount().subscribe((count) => {
        this.unreadCount = count;
        this.cdr.detectChanges();
      }),
      this.router.events
        .pipe(filter((event) => event instanceof NavigationEnd))
        .subscribe(() => {
          this.closeSheets();
          if (this.isBrowser) {
            window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
          }
        })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach((sub) => sub.unsubscribe());
    this.unlockScroll();
  }

  // ================= STATE HELPERS =================

  get hasOpenSheet(): boolean {
    return this.isAddMenuOpen || this.isNotifOpen;
  }

  /** ქვედა ბარში ჩანს მხოლოდ ის ბმულები, რაც ბარში არ ეტევა (სტუმარს ბარში how/rules აქვს). */
  get sheetInfoLinks(): InfoLink[] {
    return this.isLoggedIn ? this.infoLinks : this.infoLinks.filter((l) => l.path === '/support');
  }

  // ================= ROLE-BASED ACTIONS =================

  /**
   * მძღოლს → "მგზავრობის დამატება" + "ამანათის გაგზავნა" (ორივე).
   * გამგზავნს → "ამანათის გაგზავნა".
   * თუ როლი ჯერ უცნობია, ორივეს ვაჩვენებთ.
   */
  get actions(): AddAction[] {
    const send: AddAction = {
      label: 'ამანათის გაგზავნა',
      hint: 'დაამატე განცხადება და იპოვე მძღოლი',
      path: '/send',
      kind: 'send'
    };
    const trip: AddAction = {
      label: 'მგზავრობის დამატება',
      hint: 'მძღოლი ხარ? გამოაცხადე რეისი',
      path: '/pickup',
      kind: 'ride'
    };

    switch (this.currentUser?.role) {
      case 'driver':
        return [trip, send]; // მძღოლისთვის მგზავრობა პირველია
      case 'sender':
        return [send];
      default:
        return [send, trip];
    }
  }

  get profilePath(): string {
    return this.currentUser?.role === 'driver' ? '/driverProfile-android' : '/senderProfile-android';
  }

  getUserInitials(): string {
    if (!this.currentUser) {
      return '';
    }
    const first = this.currentUser.firstName?.charAt(0) ?? '';
    const last = this.currentUser.lastName?.charAt(0) ?? '';
    return `${first}${last}`.toUpperCase();
  }

  // ================= SHEETS =================

  toggleAddMenu(): void {
    this.isAddMenuOpen = !this.isAddMenuOpen;
    if (this.isAddMenuOpen) {
      this.isNotifOpen = false;
    }
    this.syncScrollLock();
    this.cdr.detectChanges();
  }

  toggleNotifications(): void {
    this.isNotifOpen = !this.isNotifOpen;

    if (this.isNotifOpen) {
      this.isAddMenuOpen = false;
      // badge ქრება, სია რჩება
      this.notificationService.resetNotificationsUnreadCount();
    }
    this.syncScrollLock();
    this.cdr.detectChanges();
  }

  closeSheets(): void {
    if (!this.hasOpenSheet) {
      return;
    }
    this.isAddMenuOpen = false;
    this.isNotifOpen = false;
    this.unlockScroll();
    this.cdr.detectChanges();
  }

  private syncScrollLock(): void {
    this.hasOpenSheet ? this.lockScroll() : this.unlockScroll();
  }

  private lockScroll(): void {
    if (this.isBrowser) {
      document.body.style.overflow = 'hidden';
    }
  }

  private unlockScroll(): void {
    if (this.isBrowser) {
      document.body.style.overflow = '';
    }
  }

  // ================= NAVIGATION =================

  /** ერთი ადგილი ყველა ნავიგაციისთვის. */
  go(path: string): void {
    this.closeSheets();
    this.router.navigate([path]);
  }

  goToProfile(): void {
    this.go(this.profilePath);
  }

  // ================= NOTIFICATIONS =================

  /** ყველა ტიპი (მათ შორის 'message') პროფილში გადაიყვანს. */
  onNotificationClick(item: NotificationData): void {
    this.go(this.profilePath);
  }

  clearAllNotifications(): void {
    this.notificationService.clearNotifications();
    this.closeSheets();
  }

  /** წაუკითხავია, თუ `read`/`isRead` არ არის true. */
  isUnread(item: NotificationData): boolean {
    const n = item as any;
    return n.read !== true && n.isRead !== true;
  }

  iconFor(type: NotificationData['type']): string {
    switch (type) {
      case 'pickup_offer':
      case 'trip_pickup_request':
        return 'box';
      case 'pickup_offer_accepted':
      case 'trip_pickup_request_accepted':
      case 'pickup_offer_sender_confirmed':
        return 'check';
      case 'pickup_offer_rejected':
      case 'trip_pickup_request_rejected':
        return 'x';
      case 'pickup_offer_driver_completed':
        return 'flag';
      case 'trip':
        return 'truck';
      case 'message':
        return 'chat';
      default:
        return 'bell';
    }
  }

  accentFor(
    type: NotificationData['type']
  ): 'orange' | 'teal' | 'navy' | 'red' | 'blue' | 'green' {
    switch (type) {
      case 'pickup_offer':
      case 'trip_pickup_request':
        return 'orange';
      case 'pickup_offer_accepted':
      case 'trip_pickup_request_accepted':
      case 'pickup_offer_sender_confirmed':
        return 'teal';
      case 'pickup_offer_rejected':
      case 'trip_pickup_request_rejected':
        return 'red';
      case 'message':
        return 'blue';
      case 'trip':
        return 'green';
      default:
        return 'navy';
    }
  }

  timeAgo(item: NotificationData): string {
    const raw = (item as any).createdAt || (item as any).timestamp;
    if (!raw) {
      return '';
    }

    const diffSec = Math.floor((Date.now() - new Date(raw).getTime()) / 1000);
    if (diffSec < 60) return 'ახლახან';

    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin} წუთის წინ`;

    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return `${diffHour} საათის წინ`;

    return `${Math.floor(diffHour / 24)} დღის წინ`;
  }

  trackByIndex(index: number): number {
    return index;
  }

  // ================= GLOBAL LISTENERS =================

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    this.closeSheets();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    // composedPath() Shadow DOM-ში საიმედოა (event.target retarget-დება)
    const path = event.composedPath?.() ?? [];
    if (!path.includes(this.elementRef.nativeElement)) {
      this.closeSheets();
    }
  }
}