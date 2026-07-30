import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnInit,
  OnDestroy,
  ViewChild,
  ElementRef,
  AfterViewChecked,
  ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { SocketNotificationService, ChatMessage } from '../../services/Socketnotification.service';

@Component({
  selector: 'app-chat-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './chat-modal-component.html',
  styleUrls: ['./chat-modal-component.scss']
})
export class ChatModalImprovedComponent implements OnInit, OnDestroy, AfterViewChecked {
  @Input() requestId!: string;
  @Input() recipientId!: string;
  @Input() recipientName: string = 'მომხმარებელი';
  @Input() currentUserId: string = '';
  @Output() close = new EventEmitter<void>();

  @ViewChild('messagesContainer') private messagesContainer!: ElementRef;

  messages: ChatMessage[] = [];
  newMessage = '';
  isOnline = false;
  isTyping = false;

  private destroy$ = new Subject<void>();
  private typingTimeout: any = null;
  private shouldScrollToBottom = false;
  private lastMessagesLength = 0;

  constructor(
    private socketService: SocketNotificationService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    if (!this.requestId) return;

    if (!this.currentUserId) {
      this.currentUserId = this.socketService.getCurrentUserId();
    }

    // ✅ ვნიშნავთ, რომ ეს საუბარი ახლა ღიაა - toast აღარ გამოჩნდება მასზე
    this.socketService.setActiveConversation(this.requestId);

    this.socketService.registerConversationMeta(this.requestId, this.recipientId, this.recipientName);

    this.socketService.joinRoom(this.requestId);
    this.socketService.loadChatHistory(this.requestId);

    this.socketService.getChatMessages()
      .pipe(takeUntil(this.destroy$))
      .subscribe(messages => {
        this.messages = messages
          .filter(m => m.requestId === this.requestId)
          .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

        this.shouldScrollToBottom = true;
        this.cdr.detectChanges();
      });

    this.socketService.getConnectionStatus()
      .pipe(takeUntil(this.destroy$))
      .subscribe(status => {
        this.isOnline = status;
        this.cdr.detectChanges();
      });

    this.isOnline = this.socketService.isConnected();
  }

  ngAfterViewChecked(): void {
    if (this.shouldScrollToBottom && this.messages.length !== this.lastMessagesLength) {
      this.lastMessagesLength = this.messages.length;
      this.shouldScrollToBottom = false;
      this.scrollToBottom();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();

    // ✅ საუბარი აღარ არის ღია - toast-ები ისევ დაბრუნდება ამ საუბრისთვის
    this.socketService.clearActiveConversation();

    if (this.typingTimeout) {
      clearTimeout(this.typingTimeout);
    }
  }

  sendMessage(): void {
    const text = this.newMessage.trim();
    if (!text) return;

    this.socketService.sendMessage(this.requestId, text, this.recipientId);

    this.newMessage = '';
    this.isTyping = false;
    this.shouldScrollToBottom = true;
  }

  onTyping(): void {
    this.isTyping = true;

    if (this.typingTimeout) {
      clearTimeout(this.typingTimeout);
    }

    this.typingTimeout = setTimeout(() => {
      this.isTyping = false;
    }, 1000);
  }

  onStopTyping(): void {
    this.isTyping = false;

    if (this.typingTimeout) {
      clearTimeout(this.typingTimeout);
    }
  }

  onOverlayClick(): void {
    this.close.emit();
  }

  private scrollToBottom(): void {
    setTimeout(() => {
      const container = this.messagesContainer?.nativeElement;
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    }, 50);
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

  formatTime(date: Date | string): string {
    return new Date(date).toLocaleTimeString('ka-GE', {
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  getDateSeparator(date: Date | string): string {
    const d = new Date(date);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (d.toDateString() === today.toDateString()) return 'დღეს';
    if (d.toDateString() === yesterday.toDateString()) return 'გუშინ';

    return d.toLocaleDateString('ka-GE', {
      day: 'numeric',
      month: 'short'
    });
  }

  isDifferentDay(date1: Date | string, date2: Date | string): boolean {
    return new Date(date1).toDateString() !== new Date(date2).toDateString();
  }

  trackByIndex(index: number): number {
    return index;
  }
}