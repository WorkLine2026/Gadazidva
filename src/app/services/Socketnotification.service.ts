import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { take } from 'rxjs/operators';
import { io, Socket } from 'socket.io-client';

import { environment } from '../environment/environment';
import { SmsVerificationService } from './smsverifikation.service';
import { ChatService } from '../services/Chat.Service';

export interface ChatMessage {
  _id?: string;

  requestId: string;

  senderId: string;
  senderName: string;

  recipientId?: string;

  message: string;

  timestamp: Date | string;

  isRead?: boolean;

  clientId?: string;

  status?: 'sending' | 'sent' | 'failed';
}

export interface Conversation {
  conversationId: string;
  userId: string;
  userName: string;

  lastMessage?: string;
  lastMessageTime?: Date;

  unreadCount: number;

  isOnline?: boolean;
}

export interface NotificationData {
  type:
    | 'request'
    | 'trip'
    | 'message'
    | 'status_update'
    | 'pickup_offer'
    | 'pickup_offer_accepted'
    | 'pickup_offer_rejected'
    | 'pickup_offer_driver_completed'
    | 'pickup_offer_sender_confirmed'
    | 'trip_pickup_request'           // ✅ ახალი — მიდის მძღოლთან, როცა გამგზავნი აგზავნის მოთხოვნას
    | 'trip_pickup_request_accepted'  // ✅ ახალი — მიდის გამომგზავნთან, თუ მძღოლმა დაათანხმა
    | 'trip_pickup_request_rejected'; // ✅ ახალი — მიდის გამომგზავნთან, თუ მძღოლმა უარყო

  title: string;
  body: string;

  requestId?: string;
  tripId?: string;
  offerId?: string;
  parcelId?: string;

  data?: any;
}

export interface MessageDeletedPayload {
  messageId: string;
  requestId: string;
  senderId: string;
  recipientId?: string;
}

export interface TypingIndicator {
  requestId: string;
  senderId: string;
  isTyping: boolean;
}

export interface DeleteMessageResult {
  success: boolean;
  error?: string;
}

interface SendMessageAck {
  success: boolean;
  message?: ChatMessage;
  error?: string;
}

const MAX_STORED_NOTIFICATIONS = 50;

// ==============================================================
// INIT RETRY CONFIG
// ==============================================================
// თუ ავტორიზაციის token ჯერ არ არის მზად (constructor-ი socket-ის
// შექმნაზე ადრე გამოიძახება root-level სერვისებში), ვცდით თავიდან
// ინტერვალით, სანამ ტოკენი არ გამოჩნდება ან ლიმიტს არ მივაღწევთ.
const INIT_RETRY_DELAY_MS = 500;
const INIT_RETRY_MAX_ATTEMPTS = 40; // 40 * 500ms = 20 წამი

@Injectable({
  providedIn: 'root'
})
export class SocketNotificationService {

  private socket: Socket | null = null;

  private initialized = false;

  private chatMessages$ =
    new BehaviorSubject<ChatMessage[]>([]);

  private conversations$ =
    new BehaviorSubject<Conversation[]>([]);

  private notifications$ =
    new BehaviorSubject<NotificationData[]>([]);

  private connectionStatus$ =
    new BehaviorSubject<boolean>(false);

  private unreadCount$ =
    new BehaviorSubject<number>(0);

  private onlineUsers$ =
    new BehaviorSubject<Set<string>>(new Set());

  private typingIndicator$ =
    new Subject<TypingIndicator>();

  private messageToast$ =
    new Subject<ChatMessage>();

  private messageDeleted$ =
    new Subject<MessageDeletedPayload>();

  // ============================================================
  // ACTIVE CONVERSATION
  // ============================================================

  private activeConversationKey: string | null = null;

  private activeRequestId: string | null = null;

  private activeOtherUserId: string | null = null;

  // ============================================================
  // ROOM DATA
  // ============================================================

  private roomRecipients =
    new Map<string, string>();

  private conversationNames =
    new Map<string, string>();

  // ============================================================
  // SERVER CONVERSATIONS
  // ============================================================

  private seedConversations: Conversation[] = [];

  // ============================================================
  // ONLINE USERS
  // ============================================================

  private trackedOnlineIds =
    new Set<string>();

  // ============================================================
  // VISIBILITY
  // ============================================================

  private visibilityHandler: (() => void) | null = null;

  // ============================================================
  // INIT RETRY STATE
  // ============================================================

  private initRetryTimeout:
    ReturnType<typeof setTimeout> | null = null;

  private initRetryAttempts = 0;

  // ============================================================
  // CONSTRUCTOR
  // ============================================================

  constructor(
    private smsService: SmsVerificationService,
    private chatService: ChatService
  ) {
    this.initializeSocket();
  }

  // ============================================================
  // ID HELPERS
  // ============================================================

  private normalizeId(id: any): string {

    if (!id) {
      return '';
    }

    if (typeof id === 'string') {
      return id;
    }

    if (typeof id === 'object') {
      return String(
        id._id ||
        id.id ||
        ''
      );
    }

    return String(id);
  }

  private generateClientId(): string {

    return `c_${Date.now()}_${Math.random()
      .toString(36)
      .slice(2, 10)}`;
  }

  // ============================================================
  // SOCKET INITIALIZATION
  // ============================================================

  private initializeSocket(): void {

    const token =
      this.smsService.getAuthToken();

    if (!token) {

      this.initRetryAttempts++;

      if (
        this.initRetryAttempts >
        INIT_RETRY_MAX_ATTEMPTS
      ) {

        console.warn(
          '⚠️ Socket: token ვერ მოიძებნა, ' +
          'მცდელობების ლიმიტი ამოიწურა. ' +
          'reinitializeAfterLogin() უნდა გამოიძახოთ login-ის შემდეგ.'
        );

        this.initRetryAttempts = 0;

        return;
      }

      console.warn(
        `⚠️ Socket: token ჯერ არ არის მზად, ` +
        `ვცდი თავიდან ${INIT_RETRY_DELAY_MS}ms-ში ` +
        `(მცდელობა ${this.initRetryAttempts}/${INIT_RETRY_MAX_ATTEMPTS})`
      );

      if (this.initRetryTimeout) {
        clearTimeout(this.initRetryTimeout);
      }

      this.initRetryTimeout = setTimeout(() => {

        this.initRetryTimeout = null;

        this.initializeSocket();

      }, INIT_RETRY_DELAY_MS);

      return;
    }

    // token მოიძებნა — retry counter/timeout გავასუფთაოთ
    this.initRetryAttempts = 0;

    if (this.initRetryTimeout) {
      clearTimeout(this.initRetryTimeout);
      this.initRetryTimeout = null;
    }

    if (this.socket) {

      if (!this.socket.connected) {

        this.socket.auth = {
          token
        };

        this.socket.connect();
      }

      return;
    }

    this.socket = io(
      environment.socketUrl,
      {
        auth: {
          token
        },

        transports: [
          'websocket',
          'polling'
        ],

        reconnection: true,

        reconnectionAttempts: Infinity,

        reconnectionDelay: 1000,

        reconnectionDelayMax: 5000,

        timeout: 10000,

        autoConnect: true
      }
    );

    this.initialized = true;

    this.registerEvents();

    this.registerVisibilityReconnect();
  }

  // ============================================================
  // ENSURE CONNECTED (public safety-net helper)
  // ============================================================
  // Component-ებმა (მაგ. chat modal-ის ngOnInit-ში) შეუძლიათ ამის
  // გამოძახება, რომ დარწმუნდნენ socket-ის ინიციალიზაცია/დაკავშირება
  // უკვე დაწყებულია, თუნდაც constructor-ის პირველი მცდელობა ვერ
  // მოესწრო (token ჯერ არ იყო მზად).
  // ============================================================

  // ============================================================
  // LOGIN REINITIALIZE
  // ============================================================

  reinitializeAfterLogin(): void {

    const token =
      this.smsService.getAuthToken();

    if (!token) {

      console.warn(
        '⚠️ reinitializeAfterLogin: token არ არსებობს'
      );

      return;
    }

    if (!this.socket) {

      this.initializeSocket();

      return;
    }

    this.socket.auth = {
      token
    };

    if (!this.socket.connected) {
      this.socket.connect();
    }
  }

  // ============================================================
  // SOCKET EVENTS
  // ============================================================

  private registerEvents(): void {

    if (!this.socket) {
      return;
    }

    // ==========================================================
    // CONNECT
    // ==========================================================

    this.socket.on(
      'connect',
      () => {

        console.log(
          '🟢 Chat Socket connected:',
          this.socket?.id
        );

        this.connectionStatus$.next(true);

        // conversations განვაახლოთ
        this.loadConversationsFromServer();

        // თუ ჩატი გახსნილი იყო,
        // ისევ შევუერთდეთ ოთახს
        if (
          this.activeRequestId &&
          this.activeOtherUserId
        ) {

          this.joinRoom(
            this.activeRequestId,
            this.activeOtherUserId
          );

          this.loadChatHistory(
            this.activeRequestId,
            this.activeOtherUserId
          );
        }

        // online status
        if (
          this.trackedOnlineIds.size > 0
        ) {

          this.requestOnlineStatus(
            Array.from(
              this.trackedOnlineIds
            )
          );
        }
      }
    );

    // ==========================================================
    // CONNECT ERROR
    // ==========================================================

    this.socket.on(
      'connect_error',
      error => {

        console.error(
          '❌ Chat Socket connect_error:',
          error
        );

        this.connectionStatus$.next(false);
      }
    );

    // ==========================================================
    // DISCONNECT
    // ==========================================================

    this.socket.on(
      'disconnect',
      reason => {

        console.warn(
          '🔴 Chat Socket disconnected:',
          reason
        );

        this.connectionStatus$.next(false);
      }
    );

    // ==========================================================
    // CHAT HISTORY
    // ==========================================================

    this.socket.on(
      'messages_history',
      (messages: ChatMessage[]) => {

        console.log(
          '📥 messages_history:',
          messages?.length || 0
        );

        this.mergeChatMessages(
          Array.isArray(messages)
            ? messages
            : []
        );
      }
    );

    // ==========================================================
    // NEW MESSAGE
    // ==========================================================

    this.socket.on(
      'message',
      (message: ChatMessage) => {

        console.log(
          '📨 incoming message:',
          message
        );

        this.addChatMessage(
          message
        );
      }
    );

    // ==========================================================
    // OLD BACKEND COMPATIBILITY
    // ==========================================================

    this.socket.on(
      'receive_message',
      (message: ChatMessage) => {

        console.log(
          '📨 receive_message:',
          message
        );

        this.addChatMessage(
          message
        );
      }
    );

    // ==========================================================
    // MESSAGE READ
    // ==========================================================

    this.socket.on(
      'message_read',
      (messageId: string) => {

        if (!messageId) {
          return;
        }

        const updated =
          this.chatMessages$
            .value
            .map(message => {

              if (
                message._id ===
                messageId
              ) {

                return {
                  ...message,
                  isRead: true
                };
              }

              return message;
            });

        this.chatMessages$.next(
          updated
        );

        this.rebuildConversations();

        this.recalculateGlobalUnreadCount();
      }
    );

    // ==========================================================
    // MESSAGE DELETE
    // ==========================================================

    this.socket.on(
      'message_deleted',
      (payload: MessageDeletedPayload) => {

        if (
          !payload?.messageId
        ) {
          return;
        }

        this.removeChatMessage(
          payload.messageId
        );

        this.messageDeleted$.next(
          payload
        );
      }
    );

    // ==========================================================
    // ONLINE STATUS
    // ==========================================================

    this.socket.on(
      'user_status',
      ({
        userId,
        isOnline
      }: {
        userId: string;
        isOnline: boolean;
      }) => {

        const id =
          this.normalizeId(
            userId
          );

        if (!id) {
          return;
        }

        const current =
          new Set(
            this.onlineUsers$.value
          );

        if (isOnline) {

          current.add(id);

        } else {

          current.delete(id);
        }

        this.onlineUsers$.next(
          current
        );

        this.rebuildConversations();
      }
    );

    // ==========================================================
    // TYPING
    // ==========================================================

    this.socket.on(
      'typing_indicator',
      (payload: TypingIndicator) => {

        if (!payload) {
          return;
        }

        this.typingIndicator$.next({
          requestId:
            String(
              payload.requestId || ''
            ),

          senderId:
            this.normalizeId(
              payload.senderId
            ),

          isTyping:
            !!payload.isTyping
        });
      }
    );

    // ==========================================================
    // NOTIFICATION
    // ==========================================================

    this.socket.on(
      'notification',
      (data: NotificationData) => {

        if (!data) {
          return;
        }

        const updated = [
          data,
          ...this.notifications$.value
        ].slice(
          0,
          MAX_STORED_NOTIFICATIONS
        );

        this.notifications$.next(
          updated
        );

        this.showPushNotification(
          data
        );
      }
    );

    // ==========================================================
    // MESSAGE ERROR
    // ==========================================================

    this.socket.on(
      'message_error',
      (error: any) => {

        console.error(
          '🚨 message_error:',
          error
        );
      }
    );

    // ==========================================================
    // SOCKET ERROR
    // ==========================================================

    this.socket.on(
      'error',
      (error: any) => {

        console.error(
          '🚨 Socket error:',
          error
        );
      }
    );
  }

  // ============================================================
  // VISIBILITY RECONNECT
  // ============================================================

  private registerVisibilityReconnect(): void {

    if (
      typeof document === 'undefined'
    ) {
      return;
    }

    if (this.visibilityHandler) {
      return;
    }

    this.visibilityHandler = () => {

      if (
        document.visibilityState !==
        'visible'
      ) {
        return;
      }

      const token =
        this.smsService.getAuthToken();

      if (!token) {
        return;
      }

      if (!this.socket) {

        this.initializeSocket();

        return;
      }

      this.socket.auth = {
        token
      };

      if (!this.socket.connected) {

        console.log(
          '🔄 Reconnecting chat socket...'
        );

        this.socket.connect();

        return;
      }

      this.loadConversationsFromServer();

      if (
        this.activeRequestId &&
        this.activeOtherUserId
      ) {

        this.joinRoom(
          this.activeRequestId,
          this.activeOtherUserId
        );

        this.loadChatHistory(
          this.activeRequestId,
          this.activeOtherUserId
        );
      }
    };

    document.addEventListener(
      'visibilitychange',
      this.visibilityHandler
    );
  }

  // ============================================================
  // CONNECTION
  // ============================================================

  connect(userId?: string): void {

    const token =
      this.smsService.getAuthToken();

    if (!token) {

      console.warn(
        '⚠️ connect: token არ არსებობს'
      );

      return;
    }

    if (!this.socket) {

      this.initializeSocket();

      return;
    }

    this.socket.auth = {
      token,

      ...(userId
        ? { userId }
        : {})
    };

    if (!this.socket.connected) {
      this.socket.connect();
    }
  }

  disconnect(): void {

    if (!this.socket) {
      return;
    }

    this.socket.disconnect();
  }

  reconnect(): void {

    const token =
      this.smsService.getAuthToken();

    if (!token) {
      return;
    }

    if (!this.socket) {

      this.initializeSocket();

      return;
    }

    this.socket.auth = {
      token
    };

    if (!this.socket.connected) {
      this.socket.connect();
    }
  }

  isConnected(): boolean {

    return !!this.socket?.connected;
  }

  getCurrentUserId(): string {

    return this.normalizeId(
      this.smsService
        .getCurrentUser()?._id
    );
  }

  // ============================================================
  // CONVERSATION KEY
  // ============================================================

  getConversationKey(
    requestId: string,
    otherUserId: string
  ): string {

    const currentUserId =
      this.getCurrentUserId();

    const otherId =
      this.normalizeId(
        otherUserId
      );

    const ids = [
      currentUserId,
      otherId
    ]
      .filter(Boolean)
      .sort();

    return `${requestId}::${ids.join('::')}`;
  }

  // ============================================================
  // JOIN ROOM
  // ============================================================

  joinRoom(
    requestId: string,
    otherUserId?: string
  ): void {

    if (!requestId) {
      return;
    }

    const otherId =
      this.normalizeId(
        otherUserId
      );

    if (otherId) {

      this.roomRecipients.set(
        requestId,
        otherId
      );
    }

    if (!this.socket) {

      console.warn(
        '⚠️ joinRoom: socket ვერ შეიქმნა (ავტორიზაცია ჯერ არ არის მზად)'
      );

      return;
    }

    if (!this.socket.connected) {

      console.warn(
        '⚠️ joinRoom: socket ჯერ არ არის დაკავშირებული, ' +
        'ველოდები connect ივენთს და ავტომატურად ვცდი თავიდან'
      );

      this.socket.once(
        'connect',
        () => {

          this.joinRoom(
            requestId,
            otherId
          );
        }
      );

      return;
    }

    console.log(
      '🚪 Joining conversation:',
      {
        requestId,
        otherUserId: otherId
      }
    );

    this.socket.emit(
      'join_room',
      {
        requestId,

        otherUserId:
          otherId || undefined
      }
    );
  }

  // ============================================================
  // LOAD CHAT HISTORY
  // ============================================================

  loadChatHistory(
    requestId: string,
    otherUserId?: string
  ): void {

    if (!requestId) {
      return;
    }

    const otherId =
      this.normalizeId(
        otherUserId
      );

    if (otherId) {

      this.roomRecipients.set(
        requestId,
        otherId
      );
    }

    if (!this.socket) {

      console.warn(
        '⚠️ loadChatHistory: socket ვერ შეიქმნა (ავტორიზაცია ჯერ არ არის მზად)'
      );

      return;
    }

    if (!this.socket.connected) {

      console.warn(
        '⚠️ loadChatHistory: socket ჯერ არ არის დაკავშირებული, ' +
        'ველოდები connect ივენთს და ავტომატურად ვცდი თავიდან'
      );

      this.socket.once(
        'connect',
        () => {

          this.loadChatHistory(
            requestId,
            otherId
          );
        }
      );

      return;
    }

    this.socket.emit(
      'load_messages',
      {
        requestId,

        otherUserId:
          otherId || undefined
      }
    );
  }

  // ============================================================
  // SEND MESSAGE
  // ============================================================

  sendMessage(
    requestId: string,
    message: string,
    recipientId?: string
  ): string | null {

    const text =
      String(
        message || ''
      ).trim();

    if (
      !requestId ||
      !text
    ) {
      return null;
    }

    const sender =
      this.smsService.getCurrentUser();

    if (!sender) {

      console.error(
        '❌ sendMessage: current user ვერ მოიძებნა'
      );

      return null;
    }

    if (
      !this.socket ||
      !this.socket.connected
    ) {

      console.error(
        '❌ sendMessage: socket disconnected'
      );

      return null;
    }

    const senderId =
      this.normalizeId(
        sender._id
      );

    if (!senderId) {

      console.error(
        '❌ sendMessage: senderId არ არსებობს'
      );

      return null;
    }

    const safeRecipientId =
      this.normalizeId(
        recipientId
      );

    const targetRecipientId =
      safeRecipientId ||
      this.roomRecipients.get(
        requestId
      ) ||
      '';

    if (!targetRecipientId) {

      console.error(
        '❌ sendMessage: recipientId ვერ განისაზღვრა'
      );

      return null;
    }

    if (
      senderId ===
      targetRecipientId
    ) {

      console.error(
        '❌ sendMessage: საკუთარ თავთან გაგზავნა დაბლოკილია'
      );

      return null;
    }

    const clientId =
      this.generateClientId();

    const senderName =
      `${sender.firstName || ''} ${sender.lastName || ''}`
        .trim() ||
      'მომხმარებელი';

    const optimisticMessage: ChatMessage = {

      requestId,

      senderId,

      senderName,

      recipientId:
        targetRecipientId,

      message:
        text,

      timestamp:
        new Date(),

      isRead:
        false,

      clientId,

      status:
        'sending'
    };

    this.addChatMessage(
      optimisticMessage
    );

    const payload = {

      requestId,

      senderId,

      senderName,

      recipientId:
        targetRecipientId,

      message:
        text,

      timestamp:
        optimisticMessage.timestamp,

      clientId
    };

    const handleAck = (
      err: any,
      ack?: SendMessageAck
    ) => {

      if (err) {

        console.error(
          '❌ send_message ACK error:',
          err
        );

        this.markMessageStatus(
          clientId,
          'failed'
        );

        return;
      }

      if (!ack) {

        console.error(
          '❌ send_message: ACK არ მოვიდა'
        );

        this.markMessageStatus(
          clientId,
          'failed'
        );

        return;
      }

      if (
        ack.success &&
        ack.message
      ) {

        this.replaceOptimisticMessage(
          clientId,
          ack.message
        );

      } else {

        console.error(
          '❌ send_message rejected:',
          ack.error
        );

        this.markMessageStatus(
          clientId,
          'failed'
        );
      }
    };

    const socketAny =
      this.socket as any;

    if (
      typeof socketAny.timeout ===
      'function'
    ) {

      socketAny
        .timeout(10000)
        .emit(
          'send_message',
          payload,
          handleAck
        );

    } else {

      let settled = false;

      const timer =
        setTimeout(() => {

          if (settled) {
            return;
          }

          settled = true;

          handleAck(
            new Error('timeout')
          );

        }, 10000);

      this.socket.emit(
        'send_message',
        payload,
        (ack: SendMessageAck) => {

          if (settled) {
            return;
          }

          settled = true;

          clearTimeout(timer);

          handleAck(
            null,
            ack
          );
        }
      );
    }

    return clientId;
  }

  // ============================================================
  // RETRY
  // ============================================================

  retryMessage(
    clientId: string
  ): void {

    if (!clientId) {
      return;
    }

    const target =
      this.chatMessages$
        .value
        .find(
          message =>
            message.clientId ===
            clientId
        );

    if (!target) {
      return;
    }

    this.chatMessages$.next(
      this.chatMessages$
        .value
        .filter(
          message =>
            message.clientId !==
            clientId
        )
    );

    this.rebuildConversations();

    this.sendMessage(
      target.requestId,
      target.message,
      target.recipientId
    );
  }

  // ============================================================
  // MESSAGE STATUS
  // ============================================================

  private markMessageStatus(
    clientId: string,
    status:
      | 'sending'
      | 'sent'
      | 'failed'
  ): void {

    const messages =
      this.chatMessages$.value;

    const index =
      messages.findIndex(
        message =>
          message.clientId ===
          clientId
      );

    if (index === -1) {
      return;
    }

    const updated = [
      ...messages
    ];

    updated[index] = {
      ...updated[index],
      status
    };

    this.chatMessages$.next(
      updated
    );

    this.rebuildConversations();
  }

  // ============================================================
  // REPLACE OPTIMISTIC MESSAGE
  // ============================================================

  private replaceOptimisticMessage(
    clientId: string,
    serverMessage: ChatMessage
  ): void {

    const normalized =
      this.normalizeMessage(
        serverMessage
      );

    normalized.status =
      'sent';

    normalized.clientId =
      serverMessage.clientId ||
      clientId;

    const messages =
      this.chatMessages$.value;

    const index =
      messages.findIndex(
        message =>
          message.clientId ===
          clientId
      );

    if (index === -1) {

      const duplicate =
        messages.some(
          message =>
            !!message._id &&
            !!normalized._id &&
            message._id ===
            normalized._id
        );

      if (!duplicate) {

        this.chatMessages$.next([
          ...messages,
          normalized
        ]);
      }

      this.rebuildConversations();

      this.recalculateGlobalUnreadCount();

      return;
    }

    const updated = [
      ...messages
    ];

    updated[index] =
      normalized;

    this.chatMessages$.next(
      updated
    );

    this.rebuildConversations();

    this.recalculateGlobalUnreadCount();
  }

  // ============================================================
  // READ MESSAGE
  // ============================================================

  markMessageAsRead(
    messageId: string
  ): void {

    if (
      !messageId ||
      !this.socket ||
      !this.socket.connected
    ) {
      return;
    }

    this.socket.emit(
      'mark_as_read',
      {
        messageId
      }
    );
  }

  // ============================================================
  // READ CONVERSATION
  // ============================================================

  markConversationAsRead(
    requestId: string,
    otherUserId: string
  ): void {

    const safeOtherId =
      this.normalizeId(
        otherUserId
      );

    const currentUserId =
      this.getCurrentUserId();

    if (
      !requestId ||
      !safeOtherId
    ) {
      return;
    }

    let changed = false;

    const updated =
      this.chatMessages$
        .value
        .map(message => {

          const incoming =
            message.requestId ===
              requestId &&

            this.normalizeId(
              message.senderId
            ) ===
              safeOtherId &&

            this.normalizeId(
              message.senderId
            ) !==
              currentUserId &&

            !message.isRead;

          if (!incoming) {
            return message;
          }

          changed = true;

          if (message._id) {

            this.markMessageAsRead(
              message._id
            );
          }

          return {
            ...message,
            isRead: true
          };
        });

    if (changed) {

      this.chatMessages$.next(
        updated
      );
    }

    this.seedConversations =
      this.seedConversations.map(
        conversation => {

          if (
            conversation.conversationId ===
              requestId &&

            this.normalizeId(
              conversation.userId
            ) ===
              safeOtherId
          ) {

            return {
              ...conversation,
              unreadCount: 0
            };
          }

          return conversation;
        }
      );

    this.rebuildConversations();

    this.recalculateGlobalUnreadCount();
  }

  // ============================================================
  // ACTIVE CONVERSATION
  // ============================================================

  setActiveConversation(
    requestId: string,
    otherUserId: string
  ): void {

    const safeOtherId =
      this.normalizeId(
        otherUserId
      );

    if (!requestId) {
      return;
    }

    this.activeRequestId =
      requestId;

    this.activeOtherUserId =
      safeOtherId;

    this.activeConversationKey =
      this.getConversationKey(
        requestId,
        safeOtherId
      );

    if (safeOtherId) {

      this.roomRecipients.set(
        requestId,
        safeOtherId
      );
    }

    console.log(
      '🟢 Active conversation:',
      {
        requestId,
        otherUserId: safeOtherId,
        key: this.activeConversationKey
      }
    );
  }

  clearActiveConversation(): void {

    this.activeConversationKey =
      null;

    this.activeRequestId =
      null;

    this.activeOtherUserId =
      null;
  }

  // ============================================================
  // CONVERSATION META
  // ============================================================

  registerConversationMeta(
    requestId: string,
    otherUserId: string,
    otherUserName: string
  ): void {

    if (!requestId) {
      return;
    }

    const safeOtherId =
      this.normalizeId(
        otherUserId
      );

    if (safeOtherId) {

      this.roomRecipients.set(
        requestId,
        safeOtherId
      );
    }

    const key =
      `${requestId}:${safeOtherId}`;

    if (
      otherUserName &&
      otherUserName !==
        'მომხმარებელი'
    ) {

      this.conversationNames.set(
        key,
        otherUserName
      );

      this.conversationNames.set(
        requestId,
        otherUserName
      );
    }

    this.rebuildConversations();
  }

  // ============================================================
  // LOAD CONVERSATIONS
  // ============================================================

  loadConversationsFromServer(): void {

    this.chatService
      .getConversations()
      .pipe(take(1))
      .subscribe({

        next: res => {

          if (
            !res?.success ||
            !Array.isArray(
              res.conversations
            )
          ) {

            console.warn(
              '⚠️ conversations response არასწორია:',
              res
            );

            return;
          }

          this.seedConversations =
            res.conversations
              .map(
                (conversation: any): Conversation | null => {

                  const conversationId =
                    this.normalizeId(
                      conversation.conversationId
                    );

                  const userId =
                    this.normalizeId(
                      conversation.userId
                    );

                  if (
                    !conversationId ||
                    !userId
                  ) {
                    return null;
                  }

                  const normalized: Conversation = {

                    conversationId,

                    userId,

                    userName:
                      conversation.userName ||
                      'მომხმარებელი',

                    lastMessage:
                      conversation.lastMessage ||
                      '',

                    lastMessageTime:
                      conversation.lastMessageTime
                        ? new Date(
                            conversation.lastMessageTime
                          )
                        : undefined,

                    unreadCount:
                      Number(
                        conversation.unreadCount
                      ) || 0,

                    isOnline:
                      !!conversation.isOnline
                  };

                  this.roomRecipients.set(
                    conversationId,
                    userId
                  );

                  const key =
                    `${conversationId}:${userId}`;

                  if (
                    normalized.userName &&
                    normalized.userName !==
                      'მომხმარებელი'
                  ) {

                    this.conversationNames.set(
                      key,
                      normalized.userName
                    );

                    this.conversationNames.set(
                      conversationId,
                      normalized.userName
                    );
                  }

                  return normalized;
                }
              )
              .filter(
                (
                  conversation
                ): conversation is Conversation =>
                  conversation !== null
              );

          this.rebuildConversations();

          this.recalculateGlobalUnreadCount(
            true
          );

          const ids =
            this.seedConversations
              .map(
                conversation =>
                  conversation.userId
              )
              .filter(Boolean);

          if (ids.length) {

            this.requestOnlineStatus(
              ids
            );
          }
        },

        error: error => {

          console.error(
            '❌ conversations API error:',
            error
          );
        }
      });
  }

  // ============================================================
  // ONLINE STATUS REQUEST
  // ============================================================

  requestOnlineStatus(
    userIds: string[]
  ): void {

    const ids = [
      ...new Set(
        userIds
          .map(
            id =>
              this.normalizeId(id)
          )
          .filter(Boolean)
      )
    ];

    if (ids.length === 0) {
      return;
    }

    // ids ყოველთვის ვინახავთ tracked სიაში, რომ 'connect'
    // ივენთმა (registerEvents-ში) ავტომატურად გამოითხოვოს
    // ონლაინ სტატუსი ხელახლა, თუნდაც socket ჯერ არ იყოს მზად
    ids.forEach(
      id =>
        this.trackedOnlineIds.add(id)
    );

    if (
      !this.socket ||
      !this.socket.connected
    ) {

      console.warn(
        '⚠️ requestOnlineStatus: socket ჯერ არ არის დაკავშირებული, ' +
        'სტატუსი გამოითხოვება connect-ის შემდეგ ავტომატურად'
      );

      return;
    }

    this.socket.emit(
      'get_online_status',
      ids,
      (onlineIds: string[]) => {

        const current =
          new Set(
            this.onlineUsers$.value
          );

        ids.forEach(
          id =>
            current.delete(id)
        );

        (onlineIds || [])
          .map(
            id =>
              this.normalizeId(id)
          )
          .filter(Boolean)
          .forEach(
            id =>
              current.add(id)
          );

        this.onlineUsers$.next(
          current
        );

        this.rebuildConversations();
      }
    );
  }

  // ============================================================
  // IS ONLINE
  // ============================================================

  isUserOnline(
    userId: string
  ): boolean {

    return this.onlineUsers$
      .value
      .has(
        this.normalizeId(
          userId
        )
      );
  }

  // ============================================================
  // TYPING
  // ============================================================

  notifyTyping(
    requestId: string,
    recipientId: string
  ): void {

    const safeRecipient =
      this.normalizeId(
        recipientId
      );

    if (
      !requestId ||
      !safeRecipient ||
      !this.socket ||
      !this.socket.connected
    ) {
      return;
    }

    this.socket.emit(
      'typing',
      {
        requestId,

        recipientId:
          safeRecipient
      }
    );
  }

  notifyStopTyping(
    requestId: string,
    recipientId: string
  ): void {

    const safeRecipient =
      this.normalizeId(
        recipientId
      );

    if (
      !requestId ||
      !safeRecipient ||
      !this.socket ||
      !this.socket.connected
    ) {
      return;
    }

    this.socket.emit(
      'stop_typing',
      {
        requestId,

        recipientId:
          safeRecipient
      }
    );
  }

  // ============================================================
  // DELETE MESSAGE
  // ============================================================

  deleteMessage(
    messageId: string
  ): Promise<DeleteMessageResult> {

    return new Promise(
      resolve => {

        if (
          !messageId ||
          !this.socket ||
          !this.socket.connected
        ) {

          resolve({
            success: false,

            error:
              'ინტერნეტთან კავშირი არ არის'
          });

          return;
        }

        let settled = false;

        const finish = (
          result: DeleteMessageResult
        ) => {

          if (settled) {
            return;
          }

          settled = true;

          resolve(result);
        };

        const timer =
          setTimeout(() => {

            finish({
              success: false,

              error:
                'სერვერისგან პასუხი ვერ მოვიდა'
            });

          }, 10000);

        this.socket!.emit(
          'delete_message',
          {
            messageId
          },
          (ack: DeleteMessageResult) => {

            clearTimeout(timer);

            finish(
              ack || {
                success: false,

                error:
                  'პასუხი ვერ მოვიდა სერვერიდან'
              }
            );
          }
        );
      }
    );
  }

  // ============================================================
  // NOTIFICATIONS
  // ============================================================

  sendNotification(
    recipientId: string,
    data: NotificationData
  ): void {

    const id =
      this.normalizeId(
        recipientId
      );

    if (
      !id ||
      !this.socket ||
      !this.socket.connected
    ) {
      return;
    }

    this.socket.emit(
      'send_notification',
      {
        recipientId: id,
        ...data
      }
    );
  }

  clearNotifications(): void {

    this.notifications$.next(
      []
    );
  }

  resetUnreadCount(): void {

    this.unreadCount$.next(
      0
    );
  }

  // ============================================================
  // OBSERVABLES
  // ============================================================

  getChatMessages():
    Observable<ChatMessage[]> {

    return this.chatMessages$
      .asObservable();
  }

  getConversations():
    Observable<Conversation[]> {

    return this.conversations$
      .asObservable();
  }

  getNotifications():
    Observable<NotificationData[]> {

    return this.notifications$
      .asObservable();
  }

  getUnreadCount():
    Observable<number> {

    return this.unreadCount$
      .asObservable();
  }

  getConnectionStatus():
    Observable<boolean> {

    return this.connectionStatus$
      .asObservable();
  }

  getMessageToast():
    Observable<ChatMessage> {

    return this.messageToast$
      .asObservable();
  }

  getMessageDeleted():
    Observable<MessageDeletedPayload> {

    return this.messageDeleted$
      .asObservable();
  }

  getOnlineUsers():
    Observable<Set<string>> {

    return this.onlineUsers$
      .asObservable();
  }

  getTypingIndicator():
    Observable<TypingIndicator> {

    return this.typingIndicator$
      .asObservable();
  }

  // ============================================================
  // MESSAGE NORMALIZATION
  // ============================================================

  private normalizeMessage(
    message: ChatMessage
  ): ChatMessage {

    return {

      ...message,

      _id:
        message._id
          ? String(message._id)
          : undefined,

      requestId:
        String(
          message.requestId || ''
        ),

      senderId:
        this.normalizeId(
          message.senderId
        ),

      recipientId:
        message.recipientId
          ? this.normalizeId(
              message.recipientId
            )
          : undefined,

      senderName:
        message.senderName ||
        'მომხმარებელი',

      message:
        String(
          message.message || ''
        ),

      timestamp:
        message.timestamp
          ? new Date(
              message.timestamp
            )
          : new Date(),

      isRead:
        !!message.isRead
    };
  }

  // ============================================================
  // MERGE HISTORY
  // ============================================================

  private mergeChatMessages(
    messages: ChatMessage[]
  ): void {

    const normalized =
      messages.map(
        message =>
          this.normalizeMessage(
            message
          )
      );

    const existing =
      this.chatMessages$.value;

    const combined = [
      ...existing,
      ...normalized
    ];

    const unique =
      this.dedupeMessages(
        combined
      );

    unique.sort(
      (a, b) =>
        new Date(
          a.timestamp
        ).getTime() -
        new Date(
          b.timestamp
        ).getTime()
    );

    this.chatMessages$.next(
      unique
    );

    this.rebuildConversations();

    this.recalculateGlobalUnreadCount();
  }

  // ============================================================
  // ADD MESSAGE
  // ============================================================

  private addChatMessage(
    message: ChatMessage
  ): void {

    const safeMessage =
      this.normalizeMessage(
        message
      );

    if (!safeMessage.status) {

      safeMessage.status =
        'sent';
    }

    const messages =
      this.chatMessages$.value;

    // ----------------------------------------------------------
    // ID DUPLICATE
    // ----------------------------------------------------------

    if (safeMessage._id) {

      const index =
        messages.findIndex(
          message =>
            message._id ===
            safeMessage._id
        );

      if (index !== -1) {

        const updated = [
          ...messages
        ];

        updated[index] = {
          ...updated[index],
          ...safeMessage
        };

        this.chatMessages$.next(
          updated
        );

        this.rebuildConversations();

        this.recalculateGlobalUnreadCount();

        return;
      }
    }

    // ----------------------------------------------------------
    // CLIENT ID
    // ----------------------------------------------------------

    if (safeMessage.clientId) {

      const index =
        messages.findIndex(
          message =>
            message.clientId ===
            safeMessage.clientId
        );

      if (index !== -1) {

        const updated = [
          ...messages
        ];

        updated[index] = {
          ...safeMessage,
          status: 'sent'
        };

        this.chatMessages$.next(
          updated
        );

        this.rebuildConversations();

        this.recalculateGlobalUnreadCount();

        return;
      }
    }

    // ----------------------------------------------------------
    // FALLBACK DUPLICATE
    // ----------------------------------------------------------

    const duplicate =
      messages.some(
        existing => {

          if (
            existing.requestId !==
            safeMessage.requestId
          ) {
            return false;
          }

          if (
            existing.senderId !==
            safeMessage.senderId
          ) {
            return false;
          }

          if (
            existing.message !==
            safeMessage.message
          ) {
            return false;
          }

          const existingTime =
            new Date(
              existing.timestamp
            ).getTime();

          const newTime =
            new Date(
              safeMessage.timestamp
            ).getTime();

          return Math.abs(
            existingTime -
            newTime
          ) < 5000;
        }
      );

    if (duplicate) {
      return;
    }

    // ----------------------------------------------------------
    // ADD
    // ----------------------------------------------------------

    this.chatMessages$.next([
      ...messages,
      safeMessage
    ]);

    this.rebuildConversations();

    this.recalculateGlobalUnreadCount();

    // ----------------------------------------------------------
    // TOAST
    // ----------------------------------------------------------

    const currentUserId =
      this.getCurrentUserId();

    const isMine =
      safeMessage.senderId ===
      currentUserId;

    const otherUserId =
      isMine
        ? (
            safeMessage.recipientId ||
            this.roomRecipients.get(
              safeMessage.requestId
            ) ||
            ''
          )
        : safeMessage.senderId;

    const key =
      this.getConversationKey(
        safeMessage.requestId,
        otherUserId
      );

    const chatIsOpen =
      key ===
      this.activeConversationKey;

    if (
      !isMine &&
      !chatIsOpen
    ) {

      this.messageToast$.next(
        safeMessage
      );
    }
  }

  // ============================================================
  // REMOVE MESSAGE
  // ============================================================

  private removeChatMessage(
    messageId: string
  ): void {

    if (!messageId) {
      return;
    }

    const messages =
      this.chatMessages$.value;

    const filtered =
      messages.filter(
        message =>
          message._id !==
          messageId
      );

    if (
      filtered.length ===
      messages.length
    ) {
      return;
    }

    this.chatMessages$.next(
      filtered
    );

    this.rebuildConversations();

    this.recalculateGlobalUnreadCount();
  }

  // ============================================================
  // REBUILD CONVERSATIONS
  // ============================================================

  private rebuildConversations(): void {

    const currentUserId =
      this.getCurrentUserId();

    if (!currentUserId) {

      this.conversations$.next(
        []
      );

      return;
    }

    const grouped =
      new Map<
        string,
        Conversation
      >();

    // ==========================================================
    // 1. SERVER CONVERSATIONS
    // ==========================================================

    for (
      const seed
      of this.seedConversations
    ) {

      const conversationId =
        String(
          seed.conversationId || ''
        );

      const userId =
        this.normalizeId(
          seed.userId
        );

      if (
        !conversationId ||
        !userId
      ) {
        continue;
      }

      const key =
        `${conversationId}:${userId}`;

      grouped.set(
        key,
        {
          ...seed,

          conversationId,

          userId,

          userName:
            seed.userName ||
            'მომხმარებელი',

          lastMessage:
            seed.lastMessage ||
            '',

          lastMessageTime:
            seed.lastMessageTime
              ? new Date(
                  seed.lastMessageTime
                )
              : undefined,

          unreadCount:
            Number(
              seed.unreadCount
            ) || 0
        }
      );

      this.roomRecipients.set(
        conversationId,
        userId
      );
    }

    // ==========================================================
    // 2. CHAT MESSAGES
    // ==========================================================

    for (
      const message
      of this.chatMessages$.value
    ) {

      if (
        !message.requestId
      ) {
        continue;
      }

      const senderId =
        this.normalizeId(
          message.senderId
        );

      const recipientId =
        this.normalizeId(
          message.recipientId
        );

      const isMine =
        senderId ===
        currentUserId;

      let otherUserId =
        '';

      if (isMine) {

        otherUserId =
          recipientId ||
          this.roomRecipients.get(
            message.requestId
          ) ||
          '';

      } else {

        otherUserId =
          senderId;
      }

      if (!otherUserId) {
        continue;
      }

      this.roomRecipients.set(
        message.requestId,
        otherUserId
      );

      const key =
        `${message.requestId}:${otherUserId}`;

      const existing =
        grouped.get(key);

      const knownName =
        this.conversationNames.get(
          key
        ) ||
        this.conversationNames.get(
          message.requestId
        );

      let userName =
        knownName ||
        existing?.userName ||
        'მომხმარებელი';

      if (
        !isMine &&
        message.senderName
      ) {

        userName =
          message.senderName;

        this.conversationNames.set(
          key,
          message.senderName
        );
      }

      const msgTime =
        new Date(
          message.timestamp
        );

      const unread =
        !isMine &&
        !message.isRead;

      if (!existing) {

        grouped.set(
          key,
          {
            conversationId:
              message.requestId,

            userId:
              otherUserId,

            userName,

            lastMessage:
              message.message,

            lastMessageTime:
              msgTime,

            unreadCount:
              unread
                ? 1
                : 0,

            isOnline:
              this.onlineUsers$
                .value
                .has(
                  otherUserId
                )
          }
        );

      } else {

        const existingTime =
          existing.lastMessageTime
            ? new Date(
                existing.lastMessageTime
              ).getTime()
            : 0;

        // ბოლო მესიჯი
        if (
          msgTime.getTime() >=
          existingTime
        ) {

          existing.lastMessage =
            message.message;

          existing.lastMessageTime =
            msgTime;

          existing.userName =
            userName;
        }

        // unread
        //
        // აქ მნიშვნელოვანია:
        // seed-ის unreadCount-ს ვუმატებთ მხოლოდ
        // იმ incoming მესიჯებს, რომლებიც seed-ში
        // უკვე არ არის წარმოდგენილი.
        if (unread) {

          existing.unreadCount =
            (
              existing.unreadCount ||
              0
            ) + 1;
        }
      }
    }

    // ==========================================================
    // 3. ONLINE + SORT
    // ==========================================================

    const online =
      this.onlineUsers$.value;

    const conversations: Conversation[] =
      Array.from(
        grouped.values()
      )
        .filter(
          (
            conversation
          ): conversation is Conversation =>
            !!conversation &&
            !!conversation.conversationId &&
            !!conversation.userId
        )
        .map(
          conversation => {

            return {
              ...conversation,

              isOnline:
                online.has(
                  conversation.userId
                )
            };
          }
        )
        .sort(
          (a, b) => {

            const timeA =
              a.lastMessageTime
                ? new Date(
                    a.lastMessageTime
                  ).getTime()
                : 0;

            const timeB =
              b.lastMessageTime
                ? new Date(
                    b.lastMessageTime
                  ).getTime()
                : 0;

            return timeB - timeA;
          }
        );

    this.conversations$.next(
      conversations
    );
  }

  // ============================================================
  // GLOBAL UNREAD
  // ============================================================

  private recalculateGlobalUnreadCount(
    fromSeedOnly: boolean = false
  ): void {

    if (
      fromSeedOnly &&
      this.chatMessages$.value.length === 0
    ) {

      const count =
        this.seedConversations.reduce(
          (
            total,
            conversation
          ) =>
            total +
            (
              Number(
                conversation.unreadCount
              ) || 0
            ),
          0
        );

      this.unreadCount$.next(
        count
      );

      return;
    }

    const total =
      this.conversations$
        .value
        .reduce(
          (
            sum,
            conversation
          ) =>
            sum +
            (
              Number(
                conversation.unreadCount
              ) || 0
            ),
          0
        );

    this.unreadCount$.next(
      total
    );
  }

  // ============================================================
  // DEDUPE
  // ============================================================

  private dedupeMessages(
    messages: ChatMessage[]
  ): ChatMessage[] {

    const seen =
      new Set<string>();

    const result:
      ChatMessage[] = [];

    for (
      const message
      of messages
    ) {

      let id = '';

      if (message._id) {

        id =
          `id:${message._id}`;

      } else if (
        message.clientId
      ) {

        id =
          `client:${message.clientId}`;

      } else {

        id =
          `x:${message.requestId}:` +
          `${message.senderId}:` +
          `${message.message}:` +
          `${new Date(
            message.timestamp
          ).getTime()}`;
      }

      if (
        seen.has(id)
      ) {
        continue;
      }

      seen.add(id);

      result.push(
        message
      );
    }

    return result;
  }

  // ============================================================
  // PUSH NOTIFICATION
  // ============================================================

  private showPushNotification(
    data: NotificationData
  ): void {

    if (
      typeof window ===
      'undefined'
    ) {
      return;
    }

    if (
      !('Notification' in window)
    ) {
      return;
    }

    if (
      Notification.permission !==
      'granted'
    ) {
      return;
    }

    try {

      new Notification(
        data.title,
        {
          body:
            data.body,

          icon:
            '/assets/logo.png',

          badge:
            '/assets/badge.png',

          tag:
            data.type,

          requireInteraction:
            true,

          data
        }
      );

    } catch (error) {

      console.warn(
        '⚠️ Notification error:',
        error
      );
    }
  }// ============================================================
// ENSURE CONNECTED (ახალი მეთოდი)
// ============================================================

ensureConnected(): void {
  const token = this.smsService.getAuthToken();

  if (!token) {
    console.warn('⚠️ ensureConnected: token არ არსებობს');
    return;
  }

  if (!this.socket) {
    this.initializeSocket();
    return;
  }

  this.socket.auth = { token };

  if (!this.socket.connected) {
    console.log('🔄 ensureConnected → reconnecting...');
    this.socket.connect();
  }
}
}