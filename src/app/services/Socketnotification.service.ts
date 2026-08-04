import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import io, { Socket } from 'socket.io-client';
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
}

export interface Conversation {
  conversationId: string; // requestId
  userId: string;         // მეორე მხარის id
  userName: string;       // მეორე მხარის სახელი
  lastMessage?: string;
  lastMessageTime?: Date;
  unreadCount: number;
  isOnline?: boolean;
}

export interface NotificationData {
  type: 'request' | 'trip' | 'message' | 'status_update';
  title: string;
  body: string;
  requestId?: string;
  tripId?: string;
  data?: any;
}

// ✅ NEW: წაშლის event-ის payload backend-იდან
export interface MessageDeletedPayload {
  messageId: string;
  requestId: string;
  senderId: string;
  recipientId?: string;
}

@Injectable({
  providedIn: 'root'
})
export class SocketNotificationService {
  private socket: Socket | null = null;

  private chatMessages$ = new BehaviorSubject<ChatMessage[]>([]);
  private conversations$ = new BehaviorSubject<Conversation[]>([]);
  private notifications$ = new BehaviorSubject<NotificationData[]>([]);
  private connectionStatus$ = new BehaviorSubject<boolean>(false);
  private unreadCount$ = new BehaviorSubject<number>(0);

  // ✅ ტოსტისთვის: ცალკე stream ახალი (სხვისი) მესიჯებისთვის
  private messageToast$ = new Subject<ChatMessage>();

  // ✅ NEW: სტრიმი, რომელიც აცნობებს კომპონენტებს კონკრეტული მესიჯის წაშლაზე
  private messageDeleted$ = new Subject<MessageDeletedPayload>();

  // ✅ ტრეკავს რომელი კონკრეტული საუბარია ამჟამად ღია ჩატის მოდალში
  private activeConversationKey: string | null = null;

  // key: `${requestId}:${otherUserId}` -> otherUserName
  private conversationNames = new Map<string, string>();
  // key: requestId -> otherUserId (recipient fallback-ისთვის)
  private roomRecipients = new Map<string, string>();

  // Backend-იდან საწყისად ჩატვირთული საუბრები
  private seedConversations: Conversation[] = [];
  private hasLoadedSeed = false;

  constructor(
    private smsService: SmsVerificationService,
    private chatService: ChatService
  ) {
    this.initializeSocket();
  }

  /**
   * ✅ იცავს კოდს, თუ სადმე ID ობიექტის სახით მოვიდა
   * (მაგ. Mongoose populate()-ის შედეგად) string-ის ნაცვლად.
   * მაგ: { _id: "68a...", firstName: "..." } -> "68a..."
   */
  private normalizeId(id: any): string {
    if (!id) return '';
    if (typeof id === 'string') return id;
    if (typeof id === 'object') return id._id || id.id || '';
    return String(id);
  }

  private initializeSocket(): void {
    const token = this.smsService.getAuthToken();
    if (!token) {
      console.warn('⚠️ SocketNotificationService: token ვერ მოიძებნა');
      return;
    }

    console.log('🔌 SocketNotificationService: socket initialize-ში');

    this.socket = io(environment.socketUrl, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5
    });

    this.registerEvents();

    // ✅ badge-ს რომ ჰქონდეს მონაცემი ჯერ კიდევ სანამ conversations მოდალი გაიხსნება
    this.loadConversationsFromServer();
  }

  /**
   * ✅ საჯარო მეთოდი, რომ login-ის შემდეგ (თუ service token-ის გარეშე შეიქმნა)
   * თავიდან ავამუშავოთ socket-ი და ჩავტვირთოთ საუბრები.
   */
  reinitializeAfterLogin(): void {
    if (this.socket?.connected) return;
    this.initializeSocket();
  }

  private registerEvents(): void {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('✅ Socket connected');
      this.connectionStatus$.next(true);
    });

    this.socket.on('disconnect', () => {
      console.log('❌ Socket disconnected');
      this.connectionStatus$.next(false);
    });

    this.socket.on('messages_history', (messages: ChatMessage[]) => {
      console.log('📥 messages_history event:', messages.length);
      this.mergeChatMessages(messages);
    });

    this.socket.on('message', (message: ChatMessage) => {
      console.log('💬 message event:', message);
      this.addChatMessage(message);
    });

    this.socket.on('receive_message', (message: ChatMessage) => {
      console.log('📨 receive_message event:', message);
      this.addChatMessage(message);
    });

    this.socket.on('message_read', (messageId: string) => {
      console.log('✓ message_read:', messageId);
      const updated = this.chatMessages$.value.map(m =>
        m._id === messageId ? { ...m, isRead: true } : m
      );
      this.chatMessages$.next(updated);
      this.rebuildConversations();
    });

    // ✅ NEW: სხვა/ჩვენი მხრიდან წაშლილი მესიჯის მოსმენა და ლოკალურად ამოღება
    this.socket.on('message_deleted', (payload: MessageDeletedPayload) => {
      console.log('🗑️ message_deleted event:', payload);
      this.removeChatMessage(payload.messageId);
      this.messageDeleted$.next(payload);
    });

    this.socket.on('notification', (data: NotificationData) => {
      console.log('🔔 notification event:', data);
      this.notifications$.next([data, ...this.notifications$.value]);
      this.showPushNotification(data);
    });

    this.socket.on('message_error', (err: { message: string }) => {
      console.error('🚨 message_error:', err?.message);
    });

    this.socket.on('error', (error: any) => {
      console.error('🚨 Socket error:', error);
    });
  }

  connect(userId: string): void {
    if (!this.socket) {
      console.warn('⚠️ Socket არ არის initialized');
      return;
    }

    console.log('🔗 Socket connect(userId):', userId);

    if (!this.socket.connected) {
      this.socket.auth = {
        ...(this.socket.auth || {}),
        userId
      };
      this.socket.connect();
    }
  }

  disconnect(): void {
    if (this.socket) {
      console.log('🔌 Socket disconnect()');
      this.socket.disconnect();
    }
  }

  reconnect(): void {
    if (this.socket && !this.socket.connected) {
      console.log('🔄 Socket reconnect()');
      this.socket.connect();
    }
  }

  isConnected(): boolean {
    return !!this.socket?.connected;
  }

  getCurrentUserId(): string {
    return this.normalizeId(this.smsService.getCurrentUser()?._id);
  }

  /**
   * ✅ ქმნის უნიკალურ გასაღებს ორ მომხმარებელს შორის საუბრისთვის,
   * ერთი requestId-ის ფარგლებში.
   */
  getConversationKey(requestId: string, otherUserId: string): string {
    const currentUserId = this.getCurrentUserId();
    const safeOtherUserId = this.normalizeId(otherUserId);
    const ids = [currentUserId, safeOtherUserId].filter(Boolean).sort();
    return `${requestId}::${ids.join('::')}`;
  }

  /**
   * ✅ FIXED: ახლა otherUserId-საც უგზავნის backend-ს, რომ სწორი,
   * ორ-მხრიანი room შეიქმნას (წინააღმდეგ შემთხვევაში ერთსა და იმავე
   * requestId-ზე სხვადასხვა წყვილის საუბრები ერევა ერთმანეთში).
   */
  joinRoom(requestId: string, otherUserId?: string): void {
    const safeOtherUserId = this.normalizeId(otherUserId);
    console.log('🚪 joinRoom:', { requestId, otherUserId: safeOtherUserId });
    this.socket?.emit('join_room', { requestId, otherUserId: safeOtherUserId || undefined });
  }

  /**
   * ✅ FIXED: ახლა otherUserId-საც უგზავნის backend-ს fetchPairHistory-სთვის,
   * რომ ისტორია მხოლოდ ამ კონკრეტულ წყვილს დაუბრუნდეს.
   */
  loadChatHistory(requestId: string, otherUserId?: string): void {
    const safeOtherUserId = this.normalizeId(otherUserId);
    console.log('📜 loadChatHistory:', { requestId, otherUserId: safeOtherUserId });
    this.socket?.emit('load_messages', { requestId, otherUserId: safeOtherUserId || undefined });
  }

  /**
   * ✅ Profile-ის გახსნისას - ჩავტვირთავს ყველა საუბარს backend-იდან
   */
  loadConversationsFromServer(): void {
    console.log('📡 loadConversationsFromServer() START');

    this.chatService.getConversations().subscribe({
      next: (res) => {
        console.log('📥 RAW response /chat/conversations:', res);

        if (res.success && res.conversations) {
          console.log('✅ conversations count:', res.conversations.length);

          this.seedConversations = res.conversations.map(c => ({
            ...c,
            userId: this.normalizeId(c.userId),
            lastMessageTime: c.lastMessageTime ? new Date(c.lastMessageTime) : undefined
          }));

          console.log('🌱 seedConversations set:', this.seedConversations);

          this.hasLoadedSeed = true;
          this.rebuildConversations();
          this.recalculateGlobalUnreadCount(true);

          console.log('✅ loadConversationsFromServer() COMPLETE');
        } else {
          console.warn('⚠️ res.success ან res.conversations ცარიელია:', res);
        }
      },
      error: (err) => {
        console.error('❌ loadConversationsFromServer() ERROR:', err);
      }
    });
  }

  sendMessage(requestId: string, message: string, recipientId?: string): void {
    const sender = this.smsService.getCurrentUser();

    // 🔍 დროებითი დიაგნოსტიკური ლოგი — ზუსტად რომელი პირობაა ჩავარდნილი
    console.log('🔍 sendMessage დიაგნოსტიკა:', {
      hasSender: !!sender,
      sender,
      hasSocket: !!this.socket,
      socketConnected: this.socket?.connected,
      hasToken: !!this.smsService.getAuthToken()
    });

    if (!sender || !this.socket?.connected) {
      console.warn('⚠️ sendMessage: user ან socket ვერ მოიძებნა');
      return;
    }

    // ✅ ID-ების ნორმალიზება — თუ ობიექტი მოვიდა, ავიღოთ მისი _id
    const safeRecipientId = this.normalizeId(recipientId);
    const targetRecipientId = safeRecipientId || this.roomRecipients.get(requestId) || '';

    console.log('📤 sendMessage:', { requestId, recipientId: targetRecipientId, message: message.slice(0, 30) });

    const msgObj: ChatMessage = {
      requestId,
      senderId: this.normalizeId(sender._id),
      senderName: `${sender.firstName} ${sender.lastName}`,
      recipientId: targetRecipientId,
      message,
      timestamp: new Date(),
      isRead: false
    };

    this.socket.emit('send_message', msgObj);

    // ლოკალურ სტეიტშიც ვამატებთ
    this.addChatMessage(msgObj);
  }

  markMessageAsRead(messageId: string): void {
    this.socket?.emit('mark_as_read', { messageId });
  }

  markConversationAsRead(requestId: string, otherUserId: string): void {
    const safeOtherUserId = this.normalizeId(otherUserId);
    console.log('✓ markConversationAsRead:', { requestId, otherUserId: safeOtherUserId });

    const currentUserId = this.getCurrentUserId();
    let changed = false;

    const updated = this.chatMessages$.value.map(m => {
      const isIncomingFromOther =
        m.requestId === requestId &&
        m.senderId === safeOtherUserId &&
        m.senderId !== currentUserId &&
        !m.isRead;

      if (isIncomingFromOther) {
        changed = true;
        if (m._id) this.markMessageAsRead(m._id);
        return { ...m, isRead: true };
      }
      return m;
    });

    const seedKey = `${requestId}:${safeOtherUserId}`;
    this.seedConversations = this.seedConversations.map(c =>
      `${c.conversationId}:${c.userId}` === seedKey ? { ...c, unreadCount: 0 } : c
    );

    if (changed) {
      this.chatMessages$.next(updated);
    }
    this.rebuildConversations();
    this.recalculateGlobalUnreadCount();
  }

  registerConversationMeta(requestId: string, otherUserId: string, otherUserName: string): void {
    if (!requestId) return;

    // ✅ ID ნორმალიზება — თუ ობიექტი მოვიდა (populate-ის შედეგად), ავიღოთ _id
    const safeOtherUserId = this.normalizeId(otherUserId);

    if (safeOtherUserId) {
      this.roomRecipients.set(requestId, safeOtherUserId);
    }

    const key = `${requestId}:${safeOtherUserId}`;
    if (otherUserName && otherUserName !== 'მომხმარებელი') {
      this.conversationNames.set(key, otherUserName);
      this.conversationNames.set(requestId, otherUserName);
    }
    this.rebuildConversations();
  }

  sendNotification(recipientId: string, data: NotificationData): void {
    this.socket?.emit('send_notification', { recipientId: this.normalizeId(recipientId), ...data });
  }

  /**
   * ✅ NEW: მოთხოვნა backend-თან კონკრეტული მესიჯის წასაშლელად.
   * ბექენდი ამოწმებს, რომ მხოლოდ სენდერს შეუძლია საკუთარი მესიჯის წაშლა.
   * ლოკალურად UI-დან ამოღება ხდება 'message_deleted' event-ის დაბრუნებისას,
   * რომ ორივე მხარეს (გამგზავნი + მიმღები) ერთდროულად გაუქრეს realtime.
   */
  deleteMessage(messageId: string): void {
    if (!messageId) return;
    console.log('🗑️ deleteMessage მოთხოვნა:', messageId);
    this.socket?.emit('delete_message', { messageId });
  }

  getChatMessages(): Observable<ChatMessage[]> {
    return this.chatMessages$.asObservable();
  }

  getConversations(): Observable<Conversation[]> {
    return this.conversations$.asObservable();
  }

  getNotifications(): Observable<NotificationData[]> {
    return this.notifications$.asObservable();
  }

  getUnreadCount(): Observable<number> {
    return this.unreadCount$.asObservable();
  }

  getConnectionStatus(): Observable<boolean> {
    return this.connectionStatus$.asObservable();
  }

  /**
   * ✅ ტოსტ-პოპაფებისთვის stream.
   */
  getMessageToast(): Observable<ChatMessage> {
    return this.messageToast$.asObservable();
  }

  /**
   * ✅ NEW: წაშლის event-ების stream — თუ კომპონენტს დამატებით
   * რეაქციის გატარება სჭირდება (მაგ. toast "წაიშალა" შეტყობინებაზე).
   */
  getMessageDeleted(): Observable<MessageDeletedPayload> {
    return this.messageDeleted$.asObservable();
  }

  /**
   * ✅ გამოიძახე ChatModal-ის ngOnInit-იდან
   */
  setActiveConversation(requestId: string, otherUserId: string): void {
    this.activeConversationKey = this.getConversationKey(requestId, this.normalizeId(otherUserId));
  }

  /**
   * ✅ გამოიძახე ChatModal-ის ngOnDestroy-დან.
   */
  clearActiveConversation(): void {
    this.activeConversationKey = null;
  }

  clearNotifications(): void {
    this.notifications$.next([]);
  }

  resetUnreadCount(): void {
    this.unreadCount$.next(0);
  }

  private mergeChatMessages(messages: ChatMessage[]): void {
    // ✅ ID-ების ნორმალიზება შემომავალ history-შიც
    const normalizedMessages = messages.map(m => ({
      ...m,
      senderId: this.normalizeId(m.senderId),
      recipientId: m.recipientId ? this.normalizeId(m.recipientId) : m.recipientId
    }));

    const existing = this.chatMessages$.value;
    const combined = [...existing, ...normalizedMessages];
    const unique = this.dedupeMessages(combined);
    this.chatMessages$.next(unique);
    this.rebuildConversations();
    this.recalculateGlobalUnreadCount();
  }

  private addChatMessage(message: ChatMessage): void {
    // ✅ ID-ების ნორმალიზება, სანამ state-ში შევა
    const safeMessage: ChatMessage = {
      ...message,
      senderId: this.normalizeId(message.senderId),
      recipientId: message.recipientId ? this.normalizeId(message.recipientId) : message.recipientId
    };

    const messages = this.chatMessages$.value;
    const exists = messages.some(m =>
      m._id && safeMessage._id
        ? m._id === safeMessage._id
        : m.requestId === safeMessage.requestId &&
          m.senderId === safeMessage.senderId &&
          m.message === safeMessage.message &&
          new Date(m.timestamp).getTime() === new Date(safeMessage.timestamp).getTime()
    );

    if (!exists) {
      this.chatMessages$.next([...messages, safeMessage]);
      this.rebuildConversations();
      this.recalculateGlobalUnreadCount();

      // ✅ toast მხოლოდ სხვისი მესიჯისთვის და თუ ეს ზუსტად ეს საუბარი
      // (requestId + წყვილი) ღია არ არის ჩატში
      const currentUserId = this.getCurrentUserId();
      const isMine = safeMessage.senderId === currentUserId;
      const otherUserId = isMine
        ? (safeMessage.recipientId || this.roomRecipients.get(safeMessage.requestId) || '')
        : safeMessage.senderId;
      const msgKey = this.getConversationKey(safeMessage.requestId, otherUserId);
      const isChatOpen = msgKey === this.activeConversationKey;

      if (!isMine && !isChatOpen) {
        this.messageToast$.next(safeMessage);
      }
    }
  }

  /**
   * ✅ NEW: მესიჯის ლოკალურად ამოღება state-იდან (წაშლის შემდეგ)
   * და conversations/unread-ის თავიდან გამოთვლა.
   */
  private removeChatMessage(messageId: string): void {
    if (!messageId) return;

    const messages = this.chatMessages$.value;
    const filtered = messages.filter(m => m._id !== messageId);

    if (filtered.length !== messages.length) {
      this.chatMessages$.next(filtered);
      this.rebuildConversations();
      this.recalculateGlobalUnreadCount();
    }
  }

  /**
   * ✅ საბოლოო conversations$ = seed (backend) + ცოცხალი socket data
   */
  private rebuildConversations(): void {
    const currentUserId = this.getCurrentUserId();
    if (!currentUserId) {
      this.conversations$.next([]);
      return;
    }

    const grouped = new Map<string, Conversation>();

    // 1) seed-ი (backend history)
    for (const seed of this.seedConversations) {
      const safeUserId = this.normalizeId(seed.userId);
      const key = `${seed.conversationId}:${safeUserId}`;
      grouped.set(key, { ...seed, userId: safeUserId });
      if (safeUserId) {
        this.roomRecipients.set(seed.conversationId, safeUserId);
      }
    }

    // 2) ცოცხალი socket-შეტყობინებები
    for (const msg of this.chatMessages$.value) {
      if (!msg.requestId) continue;

      const isMine = msg.senderId === currentUserId;

      // 💡 recipientId-ის მოძიება + ნორმალიზება (თუ ცარიელია, ავიღოთ roomRecipients-იდან)
      let otherUserId = this.normalizeId(
        isMine ? (msg.recipientId || this.roomRecipients.get(msg.requestId) || '') : msg.senderId
      );

      if (!otherUserId) {
        otherUserId = `unknown_${msg.requestId}`;
      } else if (!otherUserId.startsWith('unknown_')) {
        this.roomRecipients.set(msg.requestId, otherUserId);
      }

      const key = `${msg.requestId}:${otherUserId}`;

      const knownName = this.conversationNames.get(key) || this.conversationNames.get(msg.requestId);
      const otherUserName = isMine
        ? (knownName || grouped.get(key)?.userName || 'მომხმარებელი')
        : (msg.senderName || knownName || 'მომხმარებელი');

      if (!isMine && msg.senderName && otherUserId) {
        this.conversationNames.set(key, msg.senderName);
      }

      const msgTime = new Date(msg.timestamp);
      const isUnread = !isMine && !msg.isRead;
      const existing = grouped.get(key);

      if (!existing) {
        grouped.set(key, {
          conversationId: msg.requestId,
          userId: otherUserId,
          userName: otherUserName,
          lastMessage: msg.message,
          lastMessageTime: msgTime,
          unreadCount: isUnread ? 1 : 0
        });
      } else {
        const existingTime = existing.lastMessageTime?.getTime() || 0;
        if (msgTime.getTime() >= existingTime) {
          existing.lastMessage = msg.message;
          existing.lastMessageTime = msgTime;
          existing.userName = otherUserName;
        }
        if (isUnread) {
          existing.unreadCount = (existing.unreadCount || 0) + 1;
        }
      }
    }

    const list = Array.from(grouped.values()).sort(
      (a, b) => (b.lastMessageTime?.getTime() || 0) - (a.lastMessageTime?.getTime() || 0)
    );

    console.log('🗂️ rebuildConversations: final count:', list.length);
    this.conversations$.next(list);
  }

  private recalculateGlobalUnreadCount(fromSeedOnly: boolean = false): void {
    if (fromSeedOnly && this.chatMessages$.value.length === 0) {
      const seedTotal = this.seedConversations.reduce((sum, c) => sum + (c.unreadCount || 0), 0);
      console.log('📊 unreadCount (from seed):', seedTotal);
      this.unreadCount$.next(seedTotal);
      return;
    }

    const totalFromConversations = this.conversations$.value.reduce(
      (sum, c) => sum + (c.unreadCount || 0), 0
    );

    console.log('📊 unreadCount (recalculated):', totalFromConversations);
    this.unreadCount$.next(totalFromConversations);
  }

  private dedupeMessages(messages: ChatMessage[]): ChatMessage[] {
    const seen = new Set<string>();

    return messages.filter(m => {
      const key = m._id
        ? `id:${m._id}`
        : `x:${m.requestId}:${m.senderId}:${m.message}:${new Date(m.timestamp).getTime()}`;

      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private showPushNotification(data: NotificationData): void {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(data.title, {
        body: data.body,
        icon: '/assets/logo.png',
        badge: '/assets/badge.png',
        tag: data.type,
        requireInteraction: true,
        data
      });
    }
  }
}