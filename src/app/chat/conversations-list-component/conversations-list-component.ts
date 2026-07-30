import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { SocketNotificationService, Conversation } from '../../services/Socketnotification.service';

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
    console.log('🚀 ConversationsListComponent ngOnInit - დაწყება');

    // ✅ საწყისი ჩატვირთვა backend-იდან
    console.log('📡 loadConversationsFromServer() ჩემილი...');
    this.socketService.loadConversationsFromServer();

    this.socketService.getConversations()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (conversations) => {
          console.log('✅ getConversations() პასუხი:', conversations);
          console.log('📊 რაოდენობა:', conversations.length);
          this.isLoading = false;
          this.conversations = conversations;
          this.applySearch();
          this.cdr.detectChanges();
        },
        error: (error) => {
          console.error('❌ getConversations() შეცდომა:', error);
          this.isLoading = false;
        }
      });

    this.socketService.getUnreadCount()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (count) => {
          console.log('🔔 getUnreadCount() პასუხი:', count);
          this.totalUnread = count;
          this.cdr.detectChanges();
        },
        error: (error) => {
          console.error('❌ getUnreadCount() შეცდომა:', error);
        }
      });

    console.log('🏁 ConversationsListComponent ngOnInit - დასრულდა');
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  searchConversations(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.searchQuery = input.value.toLowerCase();
    this.applySearch();
  }

  private applySearch(): void {
    if (!this.searchQuery) {
      this.filteredConversations = [...this.conversations];
    } else {
      this.filteredConversations = this.conversations.filter(conv =>
        conv.userName.toLowerCase().includes(this.searchQuery)
      );
    }
  }

  openConversation(conversation: Conversation): void {
    this.socketService.markConversationAsRead(conversation.conversationId, conversation.userId);
    this.conversationSelected.emit(conversation);
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

  formatTime(date?: Date): string {
    if (!date) return '';

    const now = new Date();
    const diffMs = now.getTime() - new Date(date).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'ახლა';
    if (diffMins < 60) return `${diffMins}წთ`;
    if (diffHours < 24) return `${diffHours}სთ`;
    if (diffDays < 7) return `${diffDays}დ`;

    return new Date(date).toLocaleDateString('ka-GE', { month: 'short', day: 'numeric' });
  }
}