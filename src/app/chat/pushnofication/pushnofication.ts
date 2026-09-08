import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';

// ⚠️ დაარეგულირეთ იმპორტის გზა თქვენი პროექტის სტრუქტურის მიხედვით
import {
  NotificationData,
  SocketNotificationService
} from '../../services/Socketnotification.service';

interface ToastItem {
  id: string;
  data: NotificationData;
  startedAt: number;
  remaining: number;
  timeoutRef: ReturnType<typeof setTimeout> | null;
  paused: boolean;
}

// ⚠️ თუ ამ მნიშვნელობას შეცვლით, განაახლეთ იგივე დრო
// pushnofication.scss-ში `gz-toast-timer`-ის animation-duration-შიც
const TOAST_LIFETIME_MS = 6500;
const MAX_VISIBLE_TOASTS = 4;

@Component({
  selector: 'app-pushnofication',
  standalone: true,
  imports: [CommonModule],
  styleUrl: './pushnofication.scss',
  templateUrl: './pushnofication.html',
})
export class Pushnofication implements OnInit, OnDestroy {

  // ⚠️ შეცვლილია plain array-დან signal-ზე — Zoneless Angular-ში
  // (ng-version 22.1.4) plain property-ის მუტაცია არ იწვევს
  // ავტომატურ re-render-ს. signal.update()/set() კი იწვევს.
  readonly toasts = signal<ToastItem[]>([]);

  private toastSub: Subscription | null = null;

  constructor(
    private notificationService: SocketNotificationService,
    private router: Router
  ) {}

  ngOnInit(): void {
    // ჩატის (message) toast-ს საკუთარი ხე აქვს (getMessageToast) — აქ
    // ვისმენთ მხოლოდ ზოგად შეტყობინებებს: მოთხოვნა, დასტური, უარყოფა და ა.შ.
    this.toastSub = this.notificationService
      .getNotificationToast()
      .subscribe(data => this.pushToast(data));
  }

  ngOnDestroy(): void {
    this.toastSub?.unsubscribe();
    this.toasts().forEach(toast => {
      if (toast.timeoutRef) {
        clearTimeout(toast.timeoutRef);
      }
    });
  }

  private pushToast(data: NotificationData): void {
    const id = `t_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const toast: ToastItem = {
      id,
      data,
      startedAt: Date.now(),
      remaining: TOAST_LIFETIME_MS,
      timeoutRef: null,
      paused: false
    };

    // ახალი toast ყოველთვის თავში ჩნდება, ძველები კი ქვემოთ ინაცვლებენ
    this.toasts.update(current => [toast, ...current].slice(0, MAX_VISIBLE_TOASTS));

    this.armTimer(toast);
  }

  private armTimer(toast: ToastItem): void {
    toast.timeoutRef = setTimeout(() => {
      this.dismiss(toast.id);
    }, toast.remaining);
  }

  pause(toast: ToastItem): void {
    if (toast.paused || !toast.timeoutRef) {
      return;
    }

    clearTimeout(toast.timeoutRef);
    toast.timeoutRef = null;
    toast.remaining -= Date.now() - toast.startedAt;
    toast.paused = true;
  }

  resume(toast: ToastItem): void {
    if (!toast.paused) {
      return;
    }

    toast.paused = false;
    toast.startedAt = Date.now();
    this.armTimer(toast);
  }

  dismiss(id: string): void {
    const toast = this.toasts().find(item => item.id === id);

    if (toast?.timeoutRef) {
      clearTimeout(toast.timeoutRef);
    }

    this.toasts.update(current => current.filter(item => item.id !== id));
  }

  onToastClick(toast: ToastItem): void {
    this.dismiss(toast.id);
    this.navigateFor(toast.data);
  }

  /**
   * ⚠️ ეს არის ნაგულისხმევი ნავიგაცია — ამჟამად ყველა ტიპი პროფილზე
   * (`/profile`) გადადის, სადაც "შემოსული მოთხოვნები" და "მიმდინარე
   * მიწოდებები" ჩანს. საჭიროების შემთხვევაში დაამატეთ ცალკე route
   * თითოეული ტიპისთვის (მაგ. requestId/offerId/tripId param-ებით).
   */
  private navigateFor(data: NotificationData): void {
    if (data.type === 'message') {
      return;
    }

    this.router.navigate(['/profile']);
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

  accentFor(type: NotificationData['type']): 'orange' | 'teal' | 'navy' | 'red' {
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
      default:
        return 'navy';
    }
  }

  trackById(_: number, toast: ToastItem): string {
    return toast.id;
  }
}