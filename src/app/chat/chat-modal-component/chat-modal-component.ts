import {
  Component,
  OnInit,
  OnDestroy,
  AfterViewChecked,
  ElementRef,
  EventEmitter,
  Input,
  Output,
  ViewChild
} from '@angular/core';

import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { io, Socket } from 'socket.io-client';

import { environment } from '../../environment/environment';


/* =========================================================
   MESSAGE TYPES
   ========================================================= */

interface ChatMessage {
  _id: string;

  requestId: string;

  senderId: string;
  senderName?: string;

  recipientId: string;

  message: string;

  timestamp: string | Date;

  isRead?: boolean;

  status?: 'sending' | 'sent' | 'failed';
}


/* =========================================================
   COMPONENT
   ========================================================= */

@Component({
  selector: 'app-chat-modal',

  standalone: true,

  imports: [
    CommonModule,
    FormsModule
  ],

  templateUrl: './chat-modal-component.html',

  styleUrls: [
    './chat-modal-component.scss'
  ]
})
export class ChatModalImprovedComponent
  implements
    OnInit,
    OnDestroy,
    AfterViewChecked {


  /* =======================================================
     INPUTS
     ======================================================= */

  @Input()
  requestId!: string;


  @Input()
  recipientId!: string;


  @Input()
  recipientName: string = 'მომხმარებელი';


  @Input()
  currentUserId: string = '';


  /* =======================================================
     OUTPUT
     ======================================================= */

  @Output()
  close = new EventEmitter<void>();


  /* =======================================================
     VIEW
     ======================================================= */

  @ViewChild('messagesContainer')
  private messagesContainer!: ElementRef<HTMLDivElement>;


  /* =======================================================
     SOCKET
     ======================================================= */

  private socket: Socket | null = null;


  /* =======================================================
     STATE
     ======================================================= */

  messages: ChatMessage[] = [];

  newMessage = '';

  isOnline = false;

  isTyping = false;

  deleteError = '';

  pendingDeleteId: string | null = null;


  /* =======================================================
     INTERNAL STATE
     ======================================================= */

  private shouldScrollToBottom = false;

  private destroyed = false;

  private typingTimeout: ReturnType<typeof setTimeout> | null = null;

  private deleteTimeout: ReturnType<typeof setTimeout> | null = null;


  /* =======================================================
     LIFECYCLE
     ======================================================= */

  ngOnInit(): void {

    this.destroyed = false;

    /*
     * მხოლოდ body overflow-ს ვკეტავთ.
     *
     * ❌ აღარ ვიყენებთ:
     * body.position = fixed
     * body.top = -scrollY
     *
     * ეს იყო მობილურზე scroll-ის ერთ-ერთი პრობლემა.
     */

    document.body.style.overflow = 'hidden';

    this.initializeSocket();
  }


  ngAfterViewChecked(): void {

    if (
      this.shouldScrollToBottom &&
      this.messagesContainer
    ) {

      this.shouldScrollToBottom = false;

      this.scrollToBottom();
    }
  }


  ngOnDestroy(): void {

    this.destroyed = true;

    /* =====================================================
       CLEAR TIMERS
       ===================================================== */

    if (this.typingTimeout) {
      clearTimeout(this.typingTimeout);
      this.typingTimeout = null;
    }

    if (this.deleteTimeout) {
      clearTimeout(this.deleteTimeout);
      this.deleteTimeout = null;
    }


    /* =====================================================
       STOP TYPING
       ===================================================== */

    this.stopTyping();


    /* =====================================================
       SOCKET CLEANUP
       ===================================================== */

    if (this.socket) {

      this.socket.off('connect');

      this.socket.off('disconnect');

      this.socket.off('connect_error');

      this.socket.off('messages_history');

      this.socket.off('message');

      this.socket.off('receive_message');

      this.socket.off('message_deleted');

      this.socket.off('message_error');

      this.socket.off('user_online');

      this.socket.off('user_offline');

      this.socket.off('typing');

      this.socket.off('stop_typing');

      this.socket.disconnect();

      this.socket = null;
    }


    /* =====================================================
       BODY RESTORE
       ===================================================== */

    document.body.style.overflow = '';
  }


  /* =========================================================
     SOCKET INITIALIZATION
     ========================================================= */

  private initializeSocket(): void {

    if (!this.requestId) {

      console.error(
        '❌ Chat: requestId არ არის'
      );

      return;
    }


    if (!this.currentUserId) {

      console.error(
        '❌ Chat: currentUserId არ არის'
      );

      return;
    }


    /*
     * environment.socketUrl უნდა იყოს მაგალითად:
     *
     * http://localhost:3000
     */

    const socketUrl =
      environment.socketUrl;


    if (!socketUrl) {

      console.error(
        '❌ Chat: environment.socketUrl არ არის'
      );

      return;
    }


    /*
     * Token
     *
     * შენს backend-ზე Socket authentication
     * handshake.auth.token-ით მოდის.
     */

    const token =
      this.getAuthToken();


    if (!token) {

      console.warn(
        '⚠️ Chat: authentication token ვერ მოიძებნა'
      );
    }


    /* =====================================================
       CREATE SOCKET
       ===================================================== */

    this.socket = io(
      socketUrl,
      {
        transports: [
          'websocket',
          'polling'
        ],

        auth: {
          token
        },

        autoConnect: true,

        reconnection: true,

        reconnectionAttempts: Infinity,

        reconnectionDelay: 1000,

        reconnectionDelayMax: 5000
      }
    );


    /* =====================================================
       CONNECT
       ===================================================== */

    this.socket.on(
      'connect',
      () => {

        if (this.destroyed) {
          return;
        }


        console.log(
          '✅ Chat socket connected:',
          this.socket?.id
        );


        this.joinChatRoom();

        this.checkRecipientOnline();

      }
    );


    /* =====================================================
       DISCONNECT
       ===================================================== */

    this.socket.on(
      'disconnect',
      (reason: string) => {

        if (this.destroyed) {
          return;
        }


        console.warn(
          '⚠️ Chat socket disconnected:',
          reason
        );

        this.isOnline = false;
      }
    );


    /* =====================================================
       CONNECTION ERROR
       ===================================================== */

    this.socket.on(
      'connect_error',
      (error: Error) => {

        console.error(
          '❌ Chat socket connection error:',
          error
        );

      }
    );


    /* =====================================================
       MESSAGE HISTORY
       ===================================================== */

    this.socket.on(
      'messages_history',
      (history: any[]) => {

        if (this.destroyed) {
          return;
        }


        this.messages =
          this.normalizeMessages(history);


        this.shouldScrollToBottom = true;

      }
    );


    /* =====================================================
       MESSAGE
       ===================================================== */

    this.socket.on(
      'message',
      (message: any) => {

        this.handleIncomingMessage(
          message
        );

      }
    );


    /* =====================================================
       RECEIVE MESSAGE
       ===================================================== */

    this.socket.on(
      'receive_message',
      (message: any) => {

        this.handleIncomingMessage(
          message
        );

      }
    );


    /* =====================================================
       MESSAGE DELETED
       ===================================================== */

    this.socket.on(
      'message_deleted',
      (payload: any) => {

        if (this.destroyed) {
          return;
        }


        const messageId =
          payload?.messageId ||
          payload?._id;


        if (!messageId) {
          return;
        }


        this.messages =
          this.messages.filter(
            message =>
              message._id !== messageId
          );


        if (
          this.pendingDeleteId === messageId
        ) {

          this.pendingDeleteId = null;

        }


        this.deleteError = '';

      }
    );


    /* =====================================================
       MESSAGE ERROR
       ===================================================== */

    this.socket.on(
      'message_error',
      (payload: any) => {

        if (this.destroyed) {
          return;
        }


        this.deleteError =
          payload?.message ||
          'შეტყობინების ოპერაცია ვერ შესრულდა';


        /*
         * თუ რომელიმე sending message გვაქვს,
         * failed მდგომარეობაში გადავიყვანოთ.
         */

        const sendingMessage =
          this.messages.find(
            message =>
              message.status === 'sending'
          );


        if (sendingMessage) {

          sendingMessage.status =
            'failed';

        }

      }
    );


    /* =====================================================
       ONLINE
       ===================================================== */

    this.socket.on(
      'user_online',
      (userId: string) => {

        if (
          String(userId) ===
          String(this.recipientId)
        ) {

          this.isOnline = true;

        }

      }
    );


    /* =====================================================
       OFFLINE
       ===================================================== */

    this.socket.on(
      'user_offline',
      (userId: string) => {

        if (
          String(userId) ===
          String(this.recipientId)
        ) {

          this.isOnline = false;

        }

      }
    );


    /* =====================================================
       TYPING
       ===================================================== */

    this.socket.on(
      'typing',
      (payload: any) => {

        const senderId =
          payload?.senderId ||
          payload?.userId;


        if (
          String(senderId) ===
          String(this.recipientId)
        ) {

          this.isTyping = true;

        }

      }
    );


    /* =====================================================
       STOP TYPING
       ===================================================== */

    this.socket.on(
      'stop_typing',
      (payload: any) => {

        const senderId =
          payload?.senderId ||
          payload?.userId;


        if (
          !senderId ||
          String(senderId) ===
          String(this.recipientId)
        ) {

          this.isTyping = false;

        }

      }
    );

  }


  /* =========================================================
     JOIN ROOM
     ========================================================= */

  private joinChatRoom(): void {

    if (
      !this.socket ||
      !this.socket.connected
    ) {
      return;
    }


    if (!this.requestId) {
      return;
    }


    this.socket.emit(
      'join_room',
      {
        requestId:
          this.requestId,

        otherUserId:
          this.recipientId
      }
    );


    /*
     * დამატებით load_messages-საც ვაგზავნით.
     *
     * Backend ორივეს უჭერს მხარს.
     */

    this.socket.emit(
      'load_messages',
      {
        requestId:
          this.requestId,

        otherUserId:
          this.recipientId
      }
    );

  }


  /* =========================================================
     ONLINE CHECK
     ========================================================= */

  private checkRecipientOnline(): void {

    if (
      !this.socket ||
      !this.socket.connected
    ) {
      return;
    }


    /*
     * თუ backend-ს user_online event აქვს,
     * ის აქ განაახლებს მდგომარეობას.
     *
     * საწყისად false.
     */

    this.isOnline = false;

  }


  /* =========================================================
     INCOMING MESSAGE
     ========================================================= */

  private handleIncomingMessage(
    rawMessage: any
  ): void {

    if (this.destroyed) {
      return;
    }


    const message =
      this.normalizeMessage(
        rawMessage
      );


    if (!message) {
      return;
    }


    /*
     * მხოლოდ მიმდინარე request-ის ჩატში
     * ვაჩვენებთ.
     */

    if (
      String(message.requestId) !==
      String(this.requestId)
    ) {
      return;
    }


    /*
     * მხოლოდ ამ ორ მომხმარებელს შორის
     * არსებული მესიჯი.
     */

    const sender =
      String(message.senderId);

    const recipient =
      String(message.recipientId);


    const current =
      String(this.currentUserId);

    const other =
      String(this.recipientId);


    const belongsToConversation =
      (
        sender === current &&
        recipient === other
      ) ||
      (
        sender === other &&
        recipient === current
      );


    if (
      !belongsToConversation
    ) {
      return;
    }


    /*
     * თუ უკვე არსებობს იგივე ID,
     * დუბლიკატი არ დავამატოთ.
     */

    if (message._id) {

      const existingIndex =
        this.messages.findIndex(
          item =>
            item._id === message._id
        );


      if (existingIndex !== -1) {

        this.messages[
          existingIndex
        ] = {
          ...this.messages[existingIndex],
          ...message,
          status: 'sent'
        };


        this.shouldScrollToBottom =
          true;

        return;
      }

    }


    /*
     * თუ ეს ჩვენი pending message-ის
     * server version არის, შევცვალოთ.
     */

    const pendingIndex =
      this.messages.findIndex(
        item =>
          item.status === 'sending' &&
          item.senderId ===
            message.senderId &&
          item.message ===
            message.message
      );


    if (
      pendingIndex !== -1 &&
      message.senderId ===
        this.currentUserId
    ) {

      this.messages[
        pendingIndex
      ] = {
        ...message,
        status: 'sent'
      };


      this.shouldScrollToBottom =
        true;

      return;
    }


    /* =====================================================
       ADD NEW MESSAGE
       ===================================================== */

    this.messages.push({
      ...message,
      status: 'sent'
    });


    this.shouldScrollToBottom =
      true;

  }


  /* =========================================================
     SEND MESSAGE
     ========================================================= */

  sendMessage(): void {

    const text =
      this.newMessage.trim();


    if (!text) {
      return;
    }


    if (!this.requestId) {

      this.deleteError =
        'ჩატის ID ვერ მოიძებნა';

      return;
    }


    if (!this.recipientId) {

      this.deleteError =
        'მიმღები ვერ მოიძებნა';

      return;
    }


    if (!this.currentUserId) {

      this.deleteError =
        'მომხმარებლის ID ვერ მოიძებნა';

      return;
    }


    /*
     * საკუთარ თავთან გაგზავნა არ შეიძლება.
     */

    if (
      String(this.currentUserId) ===
      String(this.recipientId)
    ) {

      this.deleteError =
        'საკუთარ თავთან შეტყობინების გაგზავნა შეუძლებელია';

      return;
    }


    if (
      !this.socket ||
      !this.socket.connected
    ) {

      this.deleteError =
        'ჩატთან კავშირი არ არის';

      return;
    }


    /* =====================================================
       CLEAR ERROR
       ===================================================== */

    this.deleteError = '';


    /* =====================================================
       TEMPORARY MESSAGE
       ===================================================== */

    const temporaryId =
      `temp_${Date.now()}_${Math.random()
        .toString(36)
        .substring(2, 9)}`;


    const temporaryMessage: ChatMessage = {

      _id:
        temporaryId,

      requestId:
        this.requestId,

      senderId:
        this.currentUserId,

      senderName:
        '',

      recipientId:
        this.recipientId,

      message:
        text,

      timestamp:
        new Date(),

      status:
        'sending'
    };


    this.messages.push(
      temporaryMessage
    );


    this.newMessage = '';


    this.shouldScrollToBottom =
      true;


    /* =====================================================
       SEND TO SERVER
       ===================================================== */

    try {

      this.socket.emit(
        'send_message',
        {
          requestId:
            this.requestId,

          senderId:
            this.currentUserId,

          senderName:
            '',

          recipientId:
            this.recipientId,

          message:
            text,

          timestamp:
            new Date().toISOString()
        }
      );


      /*
       * თუ რამდენიმე წამში server response არ მოვიდა,
       * sending → failed.
       */

      setTimeout(() => {

        if (this.destroyed) {
          return;
        }


        const index =
          this.messages.findIndex(
            message =>
              message._id ===
              temporaryId
          );


        if (index !== -1) {

          if (
            this.messages[index].status ===
            'sending'
          ) {

            this.messages[index].status =
              'failed';

          }

        }

      }, 10000);


    } catch (error) {

      console.error(
        '❌ send_message error:',
        error
      );


      const index =
        this.messages.findIndex(
          message =>
            message._id ===
            temporaryId
        );


      if (index !== -1) {

        this.messages[index].status =
          'failed';

      }

    }

  }


  /* =========================================================
     RETRY MESSAGE
     ========================================================= */

  retryMessage(
    message: ChatMessage
  ): void {

    if (
      !message.message.trim()
    ) {
      return;
    }


    /*
     * წავშალოთ failed version.
     */

    this.messages =
      this.messages.filter(
        item =>
          item._id !== message._id
      );


    /*
     * ჩავდოთ ტექსტი input-ში.
     */

    this.newMessage =
      message.message;


    /*
     * ავტომატურად გავაგზავნოთ.
     */

    setTimeout(() => {

      if (!this.destroyed) {

        this.sendMessage();

      }

    }, 0);

  }


  /* =========================================================
     DELETE MESSAGE
     ========================================================= */

  requestDelete(
    message: ChatMessage
  ): void {

    if (
      !this.canDelete(message)
    ) {
      return;
    }


    this.deleteError = '';


    /*
     * პირველი დაჭერა —
     * confirmation მდგომარეობა.
     */

    if (
      this.pendingDeleteId !==
      message._id
    ) {

      this.pendingDeleteId =
        message._id;


      if (this.deleteTimeout) {

        clearTimeout(
          this.deleteTimeout
        );

      }


      this.deleteTimeout =
        setTimeout(() => {

          if (
            this.pendingDeleteId ===
            message._id
          ) {

            this.pendingDeleteId =
              null;

          }

        }, 4000);


      return;
    }


    /*
     * მეორე დაჭერა —
     * რეალურად წაშლა.
     */

    this.deleteMessage(
      message
    );

  }


  /* =========================================================
     DELETE MESSAGE
     ========================================================= */

  private deleteMessage(
    message: ChatMessage
  ): void {

    if (
      !this.socket ||
      !this.socket.connected
    ) {

      this.deleteError =
        'ჩატთან კავშირი არ არის';

      this.pendingDeleteId =
        null;

      return;
    }


    if (
      !message._id ||
      message._id.startsWith('temp_')
    ) {

      this.messages =
        this.messages.filter(
          item =>
            item._id !==
            message._id
        );


      this.pendingDeleteId =
        null;

      return;
    }


    this.socket.emit(
      'delete_message',
      {
        messageId:
          message._id
      }
    );


    /*
     * დროებით აქედანაც ვშლით,
     * backend-ის message_deleted event
     * კი საბოლოოდ დაადასტურებს.
     */

    this.messages =
      this.messages.filter(
        item =>
          item._id !==
          message._id
      );


    this.pendingDeleteId =
      null;


    if (this.deleteTimeout) {

      clearTimeout(
        this.deleteTimeout
      );

      this.deleteTimeout =
        null;

    }

  }


  /* =========================================================
     CAN DELETE
     ========================================================= */

  canDelete(
    message: ChatMessage
  ): boolean {

    return (
      String(message.senderId) ===
      String(this.currentUserId)
    );

  }


  /* =========================================================
     TYPING
     ========================================================= */

  onTyping(): void {

    if (
      !this.socket ||
      !this.socket.connected
    ) {
      return;
    }


    this.socket.emit(
      'typing',
      {
        requestId:
          this.requestId,

        recipientId:
          this.recipientId,

        senderId:
          this.currentUserId
      }
    );


    this.isTyping = false;


    if (this.typingTimeout) {

      clearTimeout(
        this.typingTimeout
      );

    }


    this.typingTimeout =
      setTimeout(() => {

        this.onStopTyping();

      }, 1200);

  }


  /* =========================================================
     STOP TYPING
     ========================================================= */

  onStopTyping(): void {

    if (this.typingTimeout) {

      clearTimeout(
        this.typingTimeout
      );

      this.typingTimeout =
        null;

    }


    if (
      !this.socket ||
      !this.socket.connected
    ) {
      return;
    }


    this.socket.emit(
      'stop_typing',
      {
        requestId:
          this.requestId,

        recipientId:
          this.recipientId,

        senderId:
          this.currentUserId
      }
    );

  }


  private stopTyping(): void {

    this.onStopTyping();

  }


  /* =========================================================
     OVERLAY / CLOSE
     ========================================================= */

  onOverlayClick(): void {

    this.close.emit();

  }


  /* =========================================================
     SCROLL
     ========================================================= */

  private scrollToBottom(): void {

    if (
      !this.messagesContainer
    ) {
      return;
    }


    const element =
      this.messagesContainer.nativeElement;


    /*
     * requestAnimationFrame საჭიროა,
     * რომ Angular-მა ჯერ DOM-ში
     * ახალი message ჩასვას.
     */

    requestAnimationFrame(() => {

      if (this.destroyed) {
        return;
      }


      element.scrollTop =
        element.scrollHeight;

    });

  }


  /* =========================================================
     TRACK BY
     ========================================================= */

  trackByIndex(
    index: number,
    message: ChatMessage
  ): string {

    return (
      message?._id ||
      `${index}_${message?.timestamp}`
    );

  }


  /* =========================================================
     INITIALS
     ========================================================= */

  getInitials(
    name: string
  ): string {

    if (!name) {
      return 'მ';
    }


    const cleanName =
      name.trim();


    if (!cleanName) {
      return 'მ';
    }


    const parts =
      cleanName
        .split(/\s+/)
        .filter(Boolean);


    if (parts.length === 1) {

      return parts[0]
        .substring(0, 2)
        .toUpperCase();

    }


    return (
      parts[0].charAt(0) +
      parts[1].charAt(0)
    ).toUpperCase();

  }


  /* =========================================================
     FORMAT TIME
     ========================================================= */

  formatTime(
    timestamp: string | Date
  ): string {

    if (!timestamp) {
      return '';
    }


    const date =
      new Date(timestamp);


    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return '';
    }


    return new Intl.DateTimeFormat(
      'ka-GE',
      {
        hour: '2-digit',
        minute: '2-digit'
      }
    ).format(date);

  }


  /* =========================================================
     DATE SEPARATOR
     ========================================================= */

  getDateSeparator(
    timestamp: string | Date
  ): string {

    if (!timestamp) {
      return '';
    }


    const date =
      new Date(timestamp);


    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return '';
    }


    const today =
      new Date();


    const yesterday =
      new Date();


    yesterday.setDate(
      yesterday.getDate() - 1
    );


    if (
      this.isSameCalendarDay(
        date,
        today
      )
    ) {

      return 'დღეს';

    }


    if (
      this.isSameCalendarDay(
        date,
        yesterday
      )
    ) {

      return 'გუშინ';

    }


    return new Intl.DateTimeFormat(
      'ka-GE',
      {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      }
    ).format(date);

  }


  /* =========================================================
     DIFFERENT DAY
     ========================================================= */

  isDifferentDay(
    first: string | Date,
    second: string | Date
  ): boolean {

    if (!first || !second) {
      return false;
    }


    const firstDate =
      new Date(first);


    const secondDate =
      new Date(second);


    return !this.isSameCalendarDay(
      firstDate,
      secondDate
    );

  }


  /* =========================================================
     SAME CALENDAR DAY
     ========================================================= */

  private isSameCalendarDay(
    first: Date,
    second: Date
  ): boolean {

    return (
      first.getFullYear() ===
        second.getFullYear() &&

      first.getMonth() ===
        second.getMonth() &&

      first.getDate() ===
        second.getDate()
    );

  }


  /* =========================================================
     NORMALIZE HISTORY
     ========================================================= */

  private normalizeMessages(
    history: any[]
  ): ChatMessage[] {

    if (
      !Array.isArray(history)
    ) {
      return [];
    }


    return history

      .map(message =>
        this.normalizeMessage(
          message
        )
      )

      .filter(
        (
          message
        ): message is ChatMessage =>
          message !== null
      )

      .sort(
        (
          a,
          b
        ) =>
          new Date(a.timestamp).getTime() -
          new Date(b.timestamp).getTime()
      );

  }


  /* =========================================================
     NORMALIZE MESSAGE
     ========================================================= */

  private normalizeMessage(
    raw: any
  ): ChatMessage | null {

    if (!raw) {
      return null;
    }


    const id =
      raw._id ||
      raw.id ||
      '';


    const requestId =
      raw.requestId ||
      this.requestId ||
      '';


    const senderId =
      this.toIdString(
        raw.senderId
      );


    const recipientId =
      this.toIdString(
        raw.recipientId ||
        raw.receiverId ||
        raw.to
      );


    const messageText =
      raw.message ??
      raw.text ??
      '';


    const timestamp =
      raw.timestamp ||
      raw.createdAt ||
      new Date();


    /*
     * მინიმალური ვალიდაცია.
     */

    if (!messageText) {
      return null;
    }


    return {

      _id:
        id ||
        `message_${Date.now()}_${Math.random()
          .toString(36)
          .substring(2, 8)}`,

      requestId,

      senderId,

      senderName:
        raw.senderName ||
        '',

      recipientId,

      message:
        String(messageText),

      timestamp,

      isRead:
        raw.isRead ?? false,

      status:
        raw.status === 'failed'
          ? 'failed'
          : 'sent'

    };

  }


  /* =========================================================
     ID NORMALIZATION
     ========================================================= */

  private toIdString(
    value: any
  ): string {

    if (!value) {
      return '';
    }


    if (
      typeof value === 'string'
    ) {

      return value;

    }


    if (
      typeof value === 'object'
    ) {

      if (value._id) {

        return String(
          value._id
        );

      }

      if (value.id) {

        return String(
          value.id
        );

      }

      if (
        typeof value.toString ===
        'function'
      ) {

        return String(
          value.toString()
        );

      }

    }


    return String(value);

  }


  /* =========================================================
     AUTH TOKEN
     ========================================================= */

  private getAuthToken(): string {

    /*
     * პირველ რიგში ყველაზე გავრცელებული
     * სახელები შევამოწმოთ.
     */

    const possibleKeys = [

      'token',

      'authToken',

      'accessToken',

      'jwt',

      'access_token'

    ];


    for (
      const key of possibleKeys
    ) {

      const value =
        localStorage.getItem(key);


      if (value) {

        return value
          .replace(/^Bearer\s+/i, '')
          .trim();

      }

    }


    return '';

  }

}