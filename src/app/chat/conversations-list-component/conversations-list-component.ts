import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnInit,
  OnDestroy,
  ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import {
  SocketNotificationService,
  Conversation
} from '../../services/Socketnotification.service';

export type { Conversation };

@Component({
  selector: 'app-conversations-list',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './conversations-list-component.html',
  styleUrls: ['./conversations-list-component.scss']
})
export class ConversationsListComponent implements OnInit, OnDestroy {

  @Input() currentUserId: string = '';
  @Output() conversationSelected = new EventEmitter<Conversation>();

  conversations: Conversation[] = [];
  filteredConversations: Conversation[] = [];
  totalUnread: number = 0;
  searchQuery: string = '';
  isLoading = true;

  private destroy$ = new Subject<void>();

  constructor(
    private socketService: SocketNotificationService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    // უსაფრთხო reconnect (თუ socket ჯერ არ არის მზად)
    this.socketService.reconnect();

    // საუბრების ჩატვირთვა
    this.socketService.loadConversationsFromServer();

    this.socketService
      .getConversations()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (conversations) => {
          this.isLoading = false;
          this.conversations = conversations || [];
          this.applySearch();
          this.cdr.markForCheck();

          // online სტატუსის მოთხოვნა
          const ids = this.conversations
            .map(c => c.userId)
            .filter(Boolean);

          if (ids.length > 0) {
            this.socketService.requestOnlineStatus(ids);
          }
        },
        error: (error) => {
          console.error('❌ getConversations() შეცდომა:', error);
          this.isLoading = false;
          this.cdr.markForCheck();
        }
      });

    this.socketService
      .getUnreadCount()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (count) => {
          this.totalUnread = count;
          this.cdr.markForCheck();
        },
        error: (error) => {
          console.error('❌ getUnreadCount() შეცდომა:', error);
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ============================================================
  // TRACKBY — ციმციმის მთავარი გამოსწორება
  // ============================================================

  trackByConversation(index: number, conv: Conversation): string {
    // უნიკალური და სტაბილური გასაღები
    return `${conv.conversationId}::${conv.userId}`;
  }

  // ============================================================
  // SEARCH
  // ============================================================

  searchConversations(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.searchQuery = (input.value || '').toLowerCase().trim();
    this.applySearch();
  }

  private applySearch(): void {
    if (!this.searchQuery) {
      this.filteredConversations = [...this.conversations];
    } else {
      this.filteredConversations = this.conversations.filter(conv =>
        (conv.userName || '').toLowerCase().includes(this.searchQuery)
      );
    }
  }

  // ============================================================
  // OPEN CONVERSATION
  // ============================================================

  openConversation(conversation: Conversation): void {
    console.log('🖱️ conversation clicked:', conversation);

    // ჯერ ვხსნით ჩატს
    this.conversationSelected.emit(conversation);

    // წაკითხვად მონიშვნა ცალკე (არ დაბლოკოს გახსნა)
    try {
      if (conversation.conversationId && conversation.userId) {
        this.socketService.markConversationAsRead(
          conversation.conversationId,
          conversation.userId
        );
      }
    } catch (error) {
      console.error('⚠️ საუბრის წაკითხვად მონიშვნა ვერ მოხერხდა:', error);
    }
  }

  // ============================================================
  // HELPERS
  // ============================================================

  getInitials(name: string): string {
    return (name || '')
      .split(' ')
      .filter(Boolean)
      .map(n => n.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2) || '?';
  }

  formatTime(date?: Date | string): string {
    if (!date) return '';

    const now = new Date();
    const msgDate = new Date(date);
    const diffMs = now.getTime() - msgDate.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'ახლა';
    if (diffMins < 60) return `${diffMins}წთ`;
    if (diffHours < 24) return `${diffHours}სთ`;
    if (diffDays < 7) return `${diffDays}დ`;

    return msgDate.toLocaleDateString('ka-GE', {
      month: 'short',
      day: 'numeric'
    });
  }
}