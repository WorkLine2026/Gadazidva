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

import {
  SocketNotificationService,
  ChatMessage
} from '../../services/Socketnotification.service';

@Component({
  selector: 'app-chat-modal',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule
  ],
  templateUrl: './chat-modal-component.html',
  styleUrls: ['./chat-modal-component.scss']
})
export class ChatModalImprovedComponent
  implements OnInit, OnDestroy, AfterViewChecked {

  @Input() requestId!: string;
  @Input() recipientId!: string;
  @Input() recipientName: string = 'მომხმარებელი';
  @Input() currentUserId: string = '';

  @Output() close =
    new EventEmitter<void>();

  @ViewChild('messagesContainer')
  private messagesContainer!: ElementRef;

  messages: ChatMessage[] = [];

  newMessage = '';

  isOnline = false;

  isTyping = false;

  pendingDeleteId: string | null = null;

  deleteError: string | null = null;

  private destroy$ =
    new Subject<void>();

  private typingTimeout: ReturnType<typeof setTimeout> | null = null;

  private deleteErrorTimeout: ReturnType<typeof setTimeout> | null = null;

  private pendingDeleteTimeout: ReturnType<typeof setTimeout> | null = null;

  private scrollTimeout: ReturnType<typeof setTimeout> | null = null;

  private lastTypingEmitAt = 0;

  private shouldScrollToBottom = false;

  private lastMessagesLength = 0;

  // ============================================================
  // 💬 KEYBOARD-AWARE VIEWPORT (mobile fix)
  // ============================================================
  // visualViewport-ი ერთადერთია, რომელიც რეალურად აღრიცხავს
  // მობილურის ეკრანულ კლავიატურას. --chat-vh / --chat-offset-top
  // CSS ცვლადებს ვაყენებთ document-ის root-ზე, რომ SCSS-მა
  // შეძლოს ჩატის სიმაღლის დინამიური მორგება კლავიატურის
  // გახსნა/დახურვაზე.

  private viewportResizeHandler = () => this.updateViewportHeight();

  private updateViewportHeight(): void {
    const vv = (window as any).visualViewport;

    if (!vv) {
      return;
    }

    document.documentElement.style.setProperty(
      '--chat-vh',
      `${vv.height}px`
    );

    document.documentElement.style.setProperty(
      '--chat-offset-top',
      `${vv.offsetTop}px`
    );
  }

  constructor(
    private socketService: SocketNotificationService,
    private cdr: ChangeDetectorRef
  ) {}

  // ============================================================
  // INIT
  // ============================================================

  ngOnInit(): void {

    const safeRequestId =
      String(this.requestId || '').trim();

    const safeRecipientId =
      String(this.recipientId || '').trim();

    if (!safeRequestId) {

      console.error(
        '❌ ChatModal: requestId არ არსებობს'
      );

      return;
    }

    if (!safeRecipientId) {

      console.error(
        '❌ ChatModal: recipientId არ არსებობს'
      );

      return;
    }

    this.requestId =
      safeRequestId;

    this.recipientId =
      safeRecipientId;

    if (!this.currentUserId) {

      this.currentUserId =
        this.socketService.getCurrentUserId();
    }

    console.log(
      '💬 Opening chat:',
      {
        requestId: this.requestId,
        recipientId: this.recipientId,
        recipientName: this.recipientName,
        currentUserId: this.currentUserId
      }
    );

    // ----------------------------------------------------------
    // 💬 keyboard-aware viewport — ჩართვა
    // ----------------------------------------------------------

    this.updateViewportHeight();

    if ((window as any).visualViewport) {

      (window as any).visualViewport.addEventListener(
        'resize',
        this.viewportResizeHandler
      );

      (window as any).visualViewport.addEventListener(
        'scroll',
        this.viewportResizeHandler
      );
    }

    // ----------------------------------------------------------
    // 💬 body scroll lock — მთავარი გვერდი აღარ იძვრება,
    // სანამ ჩატი ღიაა
    // ----------------------------------------------------------

    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';
    document.body.style.top = `-${window.scrollY}px`;

    // ----------------------------------------------------------
    // safety-net: თუ socket ჯერ არ შექმნილა (constructor-ის პირველი
    // მცდელობა ავტორიზაციის token-ის მზადყოფნას გაუსწრო) ან
    // disconnected-ია, აქვე ვცდით ინიციალიზაცია/reconnect-ს.
    // joinRoom()/loadChatHistory() თავად დაელოდება 'connect'
    // ივენთს, თუ სოკეტი ჯერ არ დაკავშირებულა — ასე რომ ეს მხოლოდ
    // დამატებითი გარანტიაა, არა აუცილებელი წინაპირობა.
    // ----------------------------------------------------------

    this.socketService.ensureConnected();

    // ----------------------------------------------------------
    // ჯერ active conversation
    // ----------------------------------------------------------

    this.socketService.setActiveConversation(
      this.requestId,
      this.recipientId
    );

    this.socketService.registerConversationMeta(
      this.requestId,
      this.recipientId,
      this.recipientName
    );

    // ----------------------------------------------------------
    // socket room
    // ----------------------------------------------------------

    this.socketService.joinRoom(
      this.requestId,
      this.recipientId
    );

    // ----------------------------------------------------------
    // history
    // ----------------------------------------------------------

    this.socketService.loadChatHistory(
      this.requestId,
      this.recipientId
    );

    // ----------------------------------------------------------
    // online status
    // ----------------------------------------------------------

    this.socketService.requestOnlineStatus([
      this.recipientId
    ]);

    this.socketService
      .getOnlineUsers()
      .pipe(
        takeUntil(this.destroy$)
      )
      .subscribe(
        onlineSet => {

          this.isOnline =
            onlineSet.has(
              this.recipientId
            );

          this.cdr.markForCheck();
        }
      );

    // ----------------------------------------------------------
    // messages
    // ----------------------------------------------------------

    this.socketService
      .getChatMessages()
      .pipe(
        takeUntil(this.destroy$)
      )
      .subscribe(
        messages => {

          const currentId =
            this.normalizeId(
              this.currentUserId
            );

          const recipientId =
            this.normalizeId(
              this.recipientId
            );

          this.messages =
            messages
              .filter(message => {

                const messageRequestId =
                  String(
                    message.requestId || ''
                  );

                if (
                  messageRequestId !==
                  this.requestId
                ) {
                  return false;
                }

                const senderId =
                  this.normalizeId(
                    message.senderId
                  );

                const receiverId =
                  this.normalizeId(
                    message.recipientId
                  );

                return (
                  (
                    senderId === currentId &&
                    receiverId === recipientId
                  ) ||
                  (
                    senderId === recipientId &&
                    receiverId === currentId
                  )
                );
              })
              .sort(
                (a, b) =>
                  new Date(a.timestamp).getTime() -
                  new Date(b.timestamp).getTime()
              );

          this.shouldScrollToBottom =
            true;

          this.cdr.markForCheck();
        }
      );

    // ----------------------------------------------------------
    // typing
    // ----------------------------------------------------------

    this.socketService
      .getTypingIndicator()
      .pipe(
        takeUntil(this.destroy$)
      )
      .subscribe(
        event => {

          if (
            event.requestId !==
            this.requestId
          ) {
            return;
          }

          if (
            this.normalizeId(
              event.senderId
            ) !==
            this.normalizeId(
              this.recipientId
            )
          ) {
            return;
          }

          this.isTyping =
            event.isTyping;

          this.cdr.markForCheck();
        }
      );
  }

  // ============================================================
  // AFTER VIEW CHECKED
  // ============================================================

  ngAfterViewChecked(): void {

    if (
      !this.shouldScrollToBottom
    ) {
      return;
    }

    if (
      this.messages.length ===
      this.lastMessagesLength
    ) {
      return;
    }

    this.lastMessagesLength =
      this.messages.length;

    this.shouldScrollToBottom =
      false;

    this.scrollToBottom();
  }

  // ============================================================
  // DESTROY
  // ============================================================

  ngOnDestroy(): void {

    this.onStopTyping();

    this.destroy$.next();
    this.destroy$.complete();

    if (this.typingTimeout) {

      clearTimeout(
        this.typingTimeout
      );

      this.typingTimeout = null;
    }

    if (this.deleteErrorTimeout) {

      clearTimeout(
        this.deleteErrorTimeout
      );

      this.deleteErrorTimeout = null;
    }

    if (this.pendingDeleteTimeout) {

      clearTimeout(
        this.pendingDeleteTimeout
      );

      this.pendingDeleteTimeout = null;
    }

    if (this.scrollTimeout) {

      clearTimeout(
        this.scrollTimeout
      );

      this.scrollTimeout = null;
    }

    // ----------------------------------------------------------
    // 💬 keyboard-aware viewport — გამორთვა
    // ----------------------------------------------------------

    if ((window as any).visualViewport) {

      (window as any).visualViewport.removeEventListener(
        'resize',
        this.viewportResizeHandler
      );

      (window as any).visualViewport.removeEventListener(
        'scroll',
        this.viewportResizeHandler
      );
    }

    // ----------------------------------------------------------
    // 💬 body scroll lock — აღდგენა
    // ----------------------------------------------------------

    const scrollY = document.body.style.top;

    document.body.style.overflow = '';
    document.body.style.position = '';
    document.body.style.width = '';
    document.body.style.top = '';

    if (scrollY) {
      window.scrollTo(0, parseInt(scrollY, 10) * -1);
    }

    this.socketService.clearActiveConversation();
  }

  // ============================================================
  // SEND
  // ============================================================

  sendMessage(): void {

    const text =
      String(
        this.newMessage || ''
      ).trim();

    if (!text) {
      return;
    }

    const clientId =
      this.socketService.sendMessage(
        this.requestId,
        text,
        this.recipientId
      );

    if (!clientId) {
      return;
    }

    this.newMessage = '';

    this.onStopTyping();

    this.shouldScrollToBottom =
      true;
  }

  // ============================================================
  // RETRY
  // ============================================================

  retryMessage(
    message: ChatMessage
  ): void {

    if (!message.clientId) {
      return;
    }

    this.socketService.retryMessage(
      message.clientId
    );

    this.shouldScrollToBottom =
      true;
  }

  // ============================================================
  // TYPING
  // ============================================================

  onTyping(): void {

    const now =
      Date.now();

    if (
      now -
      this.lastTypingEmitAt >
      2000
    ) {

      this.lastTypingEmitAt =
        now;

      this.socketService.notifyTyping(
        this.requestId,
        this.recipientId
      );
    }

    if (this.typingTimeout) {

      clearTimeout(
        this.typingTimeout
      );
    }

    this.typingTimeout =
      setTimeout(() => {

        this.onStopTyping();

      }, 1500);
  }

  onStopTyping(): void {

    if (this.typingTimeout) {

      clearTimeout(
        this.typingTimeout
      );

      this.typingTimeout = null;
    }

    if (
      this.lastTypingEmitAt !== 0
    ) {

      this.socketService.notifyStopTyping(
        this.requestId,
        this.recipientId
      );
    }

    this.lastTypingEmitAt = 0;

    this.isTyping = false;
  }

  // ============================================================
  // OVERLAY
  // ============================================================

  onOverlayClick(): void {
    this.close.emit();
  }

  // ============================================================
  // DELETE
  // ============================================================

  canDelete(
    message: ChatMessage
  ): boolean {

    return (
      this.normalizeId(
        message.senderId
      ) ===
      this.normalizeId(
        this.currentUserId
      ) &&
      !!message._id
    );
  }

  async requestDelete(
    message: ChatMessage
  ): Promise<void> {

    if (!message._id) {
      return;
    }

    // ----------------------------------------------------------
    // მეორე დაჭერა = დადასტურება
    // ----------------------------------------------------------

    if (
      this.pendingDeleteId ===
      message._id
    ) {

      if (
        this.pendingDeleteTimeout
      ) {

        clearTimeout(
          this.pendingDeleteTimeout
        );

        this.pendingDeleteTimeout =
          null;
      }

      const messageId =
        message._id;

      this.pendingDeleteId =
        null;

      this.deleteError =
        null;

      const result =
        await this.socketService
          .deleteMessage(
            messageId
          );

      if (!result.success) {

        this.showDeleteError(
          result.error ||
          'შეტყობინების წაშლა ვერ მოხერხდა'
        );
      }

      return;
    }

    // ----------------------------------------------------------
    // პირველი დაჭერა
    // ----------------------------------------------------------

    if (
      this.pendingDeleteTimeout
    ) {

      clearTimeout(
        this.pendingDeleteTimeout
      );
    }

    this.pendingDeleteId =
      message._id;

    this.pendingDeleteTimeout =
      setTimeout(() => {

        if (
          this.pendingDeleteId ===
          message._id
        ) {

          this.pendingDeleteId =
            null;

          this.cdr.markForCheck();
        }

        this.pendingDeleteTimeout =
          null;

      }, 3000);
  }

  // ============================================================
  // DELETE ERROR
  // ============================================================

  private showDeleteError(
    message: string
  ): void {

    this.deleteError =
      message;

    this.cdr.markForCheck();

    if (
      this.deleteErrorTimeout
    ) {

      clearTimeout(
        this.deleteErrorTimeout
      );
    }

    this.deleteErrorTimeout =
      setTimeout(() => {

        this.deleteError =
          null;

        this.cdr.markForCheck();

      }, 3000);
  }

  // ============================================================
  // SCROLL
  // ============================================================

  private scrollToBottom(): void {

    if (this.scrollTimeout) {

      clearTimeout(
        this.scrollTimeout
      );
    }

    this.scrollTimeout =
      setTimeout(() => {

        const container =
          this.messagesContainer
            ?.nativeElement;

        if (container) {

          container.scrollTop =
            container.scrollHeight;
        }

        this.scrollTimeout =
          null;

      }, 50);
  }

  // ============================================================
  // HELPERS
  // ============================================================

  private normalizeId(
    id: any
  ): string {

    if (!id) {
      return '';
    }

    if (
      typeof id === 'object'
    ) {

      return String(
        id._id ||
        id.id ||
        ''
      );
    }

    return String(id);
  }

  getInitials(
    name: string
  ): string {

    return (
      name || ''
    )
      .split(' ')
      .filter(Boolean)
      .map(
        part =>
          part.charAt(0)
      )
      .join('')
      .toUpperCase()
      .slice(0, 2) || '?';
  }

  formatTime(
    date: Date | string
  ): string {

    return new Date(
      date
    ).toLocaleTimeString(
      'ka-GE',
      {
        hour: '2-digit',
        minute: '2-digit'
      }
    );
  }

  getDateSeparator(
    date: Date | string
  ): string {

    const d =
      new Date(date);

    const today =
      new Date();

    const yesterday =
      new Date(today);

    yesterday.setDate(
      yesterday.getDate() - 1
    );

    if (
      d.toDateString() ===
      today.toDateString()
    ) {

      return 'დღეს';
    }

    if (
      d.toDateString() ===
      yesterday.toDateString()
    ) {

      return 'გუშინ';
    }

    return d.toLocaleDateString(
      'ka-GE',
      {
        day: 'numeric',
        month: 'short'
      }
    );
  }

  isDifferentDay(
    date1: Date | string,
    date2: Date | string
  ): boolean {

    return (
      new Date(date1)
        .toDateString() !==
      new Date(date2)
        .toDateString()
    );
  }

  trackByIndex(
    index: number,
    message: ChatMessage
  ): string | number {

    return (
      message._id ||
      message.clientId ||
      index
    );
  }
}