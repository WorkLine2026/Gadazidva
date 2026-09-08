import {
  Component,
  HostListener,
  ElementRef,
  ViewEncapsulation,
  OnInit,
  OnDestroy,
  ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
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

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './navbar.html',
  styleUrl: './navbar.scss',
  encapsulation: ViewEncapsulation.ShadowDom
})
export class NavbarComponent implements OnInit, OnDestroy {
  isMenuOpen = false;
  isLoggedIn = false;
  currentUser: UserProfile | null = null;

  isNotifOpen = false;
  notifications: NotificationData[] = [];
  unreadCount = 0;

  private subscriptions: Subscription[] = [];

  constructor(
    private router: Router,
    private smsService: SmsVerificationService,
    private notificationService: SocketNotificationService,
    private cdr: ChangeDetectorRef,
    private elementRef: ElementRef
  ) {}

  ngOnInit(): void {
    this.subscriptions.push(
      this.smsService.isLoggedIn$.subscribe({
        next: (status) => {
          this.isLoggedIn = status;
          this.cdr.detectChanges();
        }
      })
    );

    this.subscriptions.push(
      this.smsService.currentUser$.subscribe({
        next: (user) => {
          this.currentUser = user;
          this.cdr.detectChanges();
        }
      })
    );

    this.subscriptions.push(
      this.notificationService.getNotifications().subscribe({
        next: (list) => {
          this.notifications = list;
          this.cdr.detectChanges();
        }
      })
    );

    this.subscriptions.push(
      this.notificationService.getNotificationsUnreadCount().subscribe({
        next: (count) => {
          this.unreadCount = count;
          this.cdr.detectChanges();
        }
      })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach((sub) => sub.unsubscribe());
    document.body.style.overflow = '';
  }

  getUserInitials(): string {
    if (!this.currentUser) {
      return '';
    }

    const first = this.currentUser.firstName?.charAt(0) ?? '';
    const last = this.currentUser.lastName?.charAt(0) ?? '';

    return `${first}${last}`.toUpperCase();
  }

  toggleMenu(event?: Event): void {
    event?.stopPropagation();

    this.isMenuOpen = !this.isMenuOpen;

    if (this.isMenuOpen) {
      this.isNotifOpen = false;

      if (window.innerWidth <= 900) {
        document.body.style.overflow = 'hidden';
      }
    } else {
      document.body.style.overflow = '';
    }

    this.cdr.detectChanges();
  }

  closeMenu(): void {
    this.isMenuOpen = false;
    document.body.style.overflow = '';
    this.cdr.detectChanges();
  }

toggleNotifications(event: Event): void {
  event.stopPropagation();

  this.isNotifOpen = !this.isNotifOpen;

  if (this.isNotifOpen) {
    // this.closeMenu();  ← ეს სტრიქონი წაშალეთ

    // შეტყობინებების გახსნისას badge ქრება,
    // მაგრამ notifications სია რჩება.
    this.notificationService.resetNotificationsUnreadCount();
  }

  this.cdr.detectChanges();
}

  closeNotifications(): void {
    this.isNotifOpen = false;
    this.cdr.detectChanges();
  }

  onNotificationClick(item: NotificationData): void {
    this.closeNotifications();
    this.navigateForNotification(item);
    this.closeMenu();
  }

  private navigateForNotification(item: NotificationData): void {
    if (item.type === 'message') {
      return;
    }

    this.router.navigate([this.getRoleProfilePath()]);
  }

  navigateToAllNotifications(): void {
    this.closeNotifications();

    // ✅ ცალკე შეტყობინებების გვერდის მაგივრად, პირდაპირ
    // მომხმარებლის როლის შესაბამის პროფილის გვერდზე
    // გადავდივართ (გამგზავნი → /senderProfile,
    // მძღოლი → /driverProfile).
    this.router.navigate([this.getRoleProfilePath()]);
  }

  clearAllNotifications(): void {
    this.notificationService.clearNotifications();
    this.closeNotifications();
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

    const date = new Date(raw);
    const diffMs = Date.now() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);

    if (diffSec < 60) {
      return 'ახლახან';
    }

    const diffMin = Math.floor(diffSec / 60);

    if (diffMin < 60) {
      return `${diffMin} წუთის წინ`;
    }

    const diffHour = Math.floor(diffMin / 60);

    if (diffHour < 24) {
      return `${diffHour} საათის წინ`;
    }

    const diffDay = Math.floor(diffHour / 24);

    return `${diffDay} დღის წინ`;
  }

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    this.closeMenu();
    this.closeNotifications();
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    if (window.innerWidth > 900) {
      this.closeMenu();
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const clickedInside = this.elementRef.nativeElement.contains(event.target);

    if (!clickedInside) {
      this.closeMenu();
      this.closeNotifications();
    }
  }

  navigateToAllListings(): void {
    this.closeMenu();
    this.router.navigate(['/listing']);
  }

  navigateTosupport(): void {
    this.closeMenu();
    this.router.navigate(['/support']);
  }

  navigateToLogin(): void {
    this.closeMenu();
    this.router.navigate(['/login']);
  }

  navigateToRegister(): void {
    this.closeMenu();
    this.router.navigate(['/register']);
  }

  navigateToDashboard(): void {
    this.closeMenu();
    this.router.navigate(['/send']);
  }

  navigateToAddRide(): void {
    this.closeMenu();
    this.router.navigate(['/pickup']);
  }

  navigateToProfile(): void {
    this.closeMenu();
    this.router.navigate([this.getRoleProfilePath()]);
  }

  private getRoleProfilePath(): string {
    return this.currentUser?.role === 'driver'
      ? '/driverProfile'
      : '/senderProfile';
  }

  navigateHome(): void {
    this.closeMenu();
    this.router.navigate(['/']);
  }
}