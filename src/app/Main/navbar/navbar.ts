import {
  Component,
  HostListener,
  ElementRef,
  ViewChild,
  ViewEncapsulation,
  OnInit,
  OnDestroy,
  ChangeDetectorRef,
  Inject,
  PLATFORM_ID
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';

import {
  SmsVerificationService,
  UserProfile
} from '../../services/smsverifikation.service';

import {
  NotificationData,
  SocketNotificationService
} from '../../services/Socketnotification.service';

/**
 * ⚠️ უნდა ემთხვეოდეს navbar.scss-ის `@media (max-width: 960px)`-ს.
 * ადრე CSS = 960, TS = 900 იყო და 901–960px-ზე მენიუ არასწორად იქცეოდა.
 */
const MOBILE_BREAKPOINT = 960;

interface NavLink {
  label: string;
  path: string;
  exact?: boolean;
}

interface NavAction {
  label: string;
  path: string;
  kind: 'primary' | 'secondary';
}

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './navbar.html',
  styleUrl: './navbar.scss',
  encapsulation: ViewEncapsulation.ShadowDom
})
export class NavbarComponent implements OnInit, OnDestroy {
  @ViewChild('menuToggle') private menuToggle?: ElementRef<HTMLButtonElement>;

  readonly links: NavLink[] = [
    { label: 'მთავარი', path: '/', exact: true },
    { label: 'როგორ მუშაობს', path: '/howtowork' },
    { label: 'წესები', path: '/rules' },
    { label: 'კონტაქტი', path: '/support' }
  ];

  isMenuOpen = false;
  isLoggedIn = false;
  currentUser: UserProfile | null = null;

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
      })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach((sub) => sub.unsubscribe());
    this.unlockScroll();
  }

  // ================= ROLE-BASED ACTIONS =================

  /**
   * გამგზავნს → "ამანათის გაგზავნა", მძღოლს → "მგზავრობის დამატება".
   * თუ როლი ჯერ უცნობია, ორივეს ვაჩვენებთ.
   */
  get actions(): NavAction[] {
    const send: NavAction = { label: 'ამანათის გაგზავნა', path: '/send', kind: 'primary' };
    const trip: NavAction = { label: 'მგზავრობის დამატება', path: '/pickup', kind: 'primary' };

    switch (this.currentUser?.role) {
      case 'driver':
        return [trip];
      case 'sender':
        return [send];
      default:
        return [send, { ...trip, kind: 'secondary' }];
    }
  }

  getUserInitials(): string {
    if (!this.currentUser) {
      return '';
    }
    const first = this.currentUser.firstName?.charAt(0) ?? '';
    const last = this.currentUser.lastName?.charAt(0) ?? '';
    return `${first}${last}`.toUpperCase();
  }

  // ================= MENU =================

  toggleMenu(event?: Event): void {
    event?.stopPropagation();
    this.isMenuOpen ? this.closeMenu() : this.openMenu();
  }

  private openMenu(): void {
    this.isMenuOpen = true;
    this.isNotifOpen = false;

    if (this.isBrowser && window.innerWidth <= MOBILE_BREAKPOINT) {
      document.body.style.overflow = 'hidden';
    }
    this.cdr.detectChanges();
  }

  closeMenu(): void {
    this.isMenuOpen = false;
    this.unlockScroll();
    this.cdr.detectChanges();
  }

  private unlockScroll(): void {
    if (this.isBrowser) {
      document.body.style.overflow = '';
    }
  }

  /** ერთი ადგილი ყველა ნავიგაციისთვის (ადრე 10 ცალკე მეთოდი იყო). */
  go(path: string): void {
    this.closeMenu();
    this.closeNotifications();
    this.router.navigate([path]);
  }

  goToProfile(): void {
    this.go(this.profilePath);
  }

  private get profilePath(): string {
    return this.currentUser?.role === 'driver' ? '/driverProfile' : '/senderProfile';
  }

  /** Skip-link: Shadow DOM-იდან href="#..." base-href-თან კონფლიქტობს, ამიტომ ხელით ვაფოკუსებთ. */
  skipToContent(event: Event): void {
    event.preventDefault();
    if (!this.isBrowser) {
      return;
    }
    const main = document.getElementById('main-content');
    main?.focus();
    main?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // ================= NOTIFICATIONS =================

  toggleNotifications(event: Event): void {
    event.stopPropagation();
    this.isNotifOpen = !this.isNotifOpen;

    if (this.isNotifOpen) {
      // badge ქრება, სია რჩება
      this.notificationService.resetNotificationsUnreadCount();
    }
    this.cdr.detectChanges();
  }

  closeNotifications(): void {
    if (!this.isNotifOpen) {
      return;
    }
    this.isNotifOpen = false;
    this.cdr.detectChanges();
  }

  /**
   * ყველა ტიპი (მათ შორის 'message') პროფილში გადაიყვანს.
   * ადრე 'message'-ზე არაფერი ხდებოდა და მომხმარებელი ჩიხში რჩებოდა.
   * თუ ჩატის ცალკე route გაქვს, აქ ჩასვი.
   */
  onNotificationClick(item: NotificationData): void {
    this.go(this.profilePath);
  }

  clearAllNotifications(): void {
    this.notificationService.clearNotifications();
    this.closeNotifications();
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
    const wasOpen = this.isMenuOpen;
    this.closeMenu();
    this.closeNotifications();

    // ფოკუსი ჰამბურგერზე ბრუნდება — კლავიატურის მომხმარებელი არ იკარგება
    if (wasOpen) {
      this.menuToggle?.nativeElement.focus();
    }
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    if (this.isBrowser && window.innerWidth > MOBILE_BREAKPOINT && this.isMenuOpen) {
      this.closeMenu();
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    // composedPath() Shadow DOM-ში საიმედოა (event.target retarget-დება)
    const path = event.composedPath?.() ?? [];
    if (!path.includes(this.elementRef.nativeElement)) {
      this.closeMenu();
      this.closeNotifications();
    }
  }
}