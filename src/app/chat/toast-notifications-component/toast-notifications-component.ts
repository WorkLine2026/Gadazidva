import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { SocketNotificationService, ChatMessage } from '../../services/Socketnotification.service';

interface ToastItem {
  id: number;
  message: ChatMessage;
}

@Component({
  selector: 'app-toast-notifications',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './toast-notifications-component.html',
  styleUrls: ['./toast-notifications-component.scss']
})
export class ToastNotificationsComponent implements OnInit, OnDestroy {
  toasts: ToastItem[] = [];
  private counter = 0;
  private destroy$ = new Subject<void>();

  constructor(
    private socketService: SocketNotificationService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.socketService.getMessageToast()
      .pipe(takeUntil(this.destroy$))
      .subscribe(msg => this.showToast(msg));
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private showToast(message: ChatMessage): void {
    const id = ++this.counter;
    this.toasts.push({ id, message });
    this.cdr.detectChanges();

    setTimeout(() => this.dismiss(id), 5000);
  }

  dismiss(id: number): void {
    this.toasts = this.toasts.filter(t => t.id !== id);
    this.cdr.detectChanges();
  }

  openChat(toast: ToastItem): void {
    this.dismiss(toast.id);
    this.router.navigate(['/profile']);
  }

  getInitials(name: string): string {
    return (name || '')
      .split(' ')
      .filter(Boolean)
      .map(n => n.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2) || '?';
  }
}