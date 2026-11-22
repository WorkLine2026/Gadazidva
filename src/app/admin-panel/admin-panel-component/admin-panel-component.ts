import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { environment } from '../../environment/environment';

const API = `${environment.apiUrl}/admin`;
const TOKEN_KEY = 'authToken';

type Tab =
  | 'dashboard' | 'users' | 'requests' | 'trips' | 'offers' | 'tripRequests'
  | 'reviews' | 'notifications' | 'messages' | 'deleted';
type ListKey = Exclude<Tab, 'dashboard'>;

interface ListState {
  items: any[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  search: string;
  filter: string;
  loading: boolean;
}

interface Col { h: string; f: string; }

const STATUS_LABELS_MAP: Record<string, string> = {
  pending: 'მოლოდინში',
  accepted: 'მიღებული',
  'in-transit': 'გზაშია',
  delivered: 'ჩაბარებული',
  cancelled: 'გაუქმებული',
  active: 'აქტიური',
  'in-progress': 'მიმდინარე',
  completed: 'დასრულებული',
  rejected: 'უარყოფილი'
};

const LIST_CFG: Record<ListKey, { path: string; field: string; filterParam: string; search: boolean }> = {
  users: { path: 'users', field: 'users', filterParam: 'role', search: true },
  requests: { path: 'requests', field: 'requests', filterParam: 'status', search: true },
  trips: { path: 'trips', field: 'trips', filterParam: 'status', search: true },
  offers: { path: 'offers', field: 'offers', filterParam: 'status', search: false },
  tripRequests: { path: 'trip-requests', field: 'tripRequests', filterParam: 'status', search: false },
  reviews: { path: 'reviews', field: 'reviews', filterParam: 'targetRole', search: false },
  notifications: { path: 'notifications', field: 'notifications', filterParam: 'seen', search: false },
  messages: { path: 'messages', field: 'messages', filterParam: 'isRead', search: true },
  deleted: { path: 'deleted-users', field: 'items', filterParam: 'deletedBy', search: true }
};

@Component({
  selector: 'app-admin-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-panel-component.html',
  styleUrls: ['./admin-panel-component.scss']
})
export class AdminPanelComponent implements OnInit {
  private http = inject(HttpClient);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  tabs: { key: Tab; label: string; icon: string }[] = [
    { key: 'dashboard', label: 'მიმოხილვა', icon: '📊' },
    { key: 'users', label: 'მომხმარებლები', icon: '👥' },
    { key: 'requests', label: 'განცხადებები', icon: '📦' },
    { key: 'trips', label: 'მგზავრობები', icon: '🚗' },
    { key: 'offers', label: 'წაღების შეთავაზებები', icon: '🤝' },
    { key: 'tripRequests', label: 'მგზავრობის მოთხოვნები', icon: '📨' },
    { key: 'reviews', label: 'შეფასებები', icon: '⭐' },
    { key: 'notifications', label: 'შეტყობინებები', icon: '🔔' },
    { key: 'messages', label: 'ჩატი', icon: '💬' },
    { key: 'deleted', label: 'წაშლილები (არქივი)', icon: '🗄️' }
  ];

  tab: Tab = 'dashboard';

  stats: any = null;
  statsLoading = false;

  lists: Record<ListKey, ListState> = {
    users: this.newList(),
    requests: this.newList(),
    trips: this.newList(),
    offers: this.newList(),
    tripRequests: this.newList(),
    reviews: this.newList(),
    notifications: this.newList(),
    messages: this.newList(),
    deleted: this.newList()
  };

  filters: Record<ListKey, { value: string; label: string }[]> = {
    users: [
      { value: '', label: 'ყველა როლი' },
      { value: 'sender', label: 'გამგზავნი' },
      { value: 'driver', label: 'მძღოლი' },
      { value: 'admin', label: 'ადმინი' }
    ],
    requests: this.statusFilter(['pending', 'accepted', 'in-transit', 'delivered', 'cancelled']),
    trips: this.statusFilter(['pending', 'active', 'in-progress', 'completed', 'cancelled']),
    offers: this.statusFilter(['pending', 'accepted', 'rejected', 'in-transit', 'delivered', 'cancelled']),
    tripRequests: this.statusFilter(['pending', 'accepted', 'rejected']),
    reviews: [
      { value: '', label: 'ყველა' },
      { value: 'driver', label: 'მძღოლის შეფასება' },
      { value: 'sender', label: 'გამგზავნის შეფასება' }
    ],
    notifications: [
      { value: '', label: 'ყველა' },
      { value: 'false', label: 'ნახვის გარეშე' },
      { value: 'true', label: 'ნანახი' }
    ],
    messages: [
      { value: '', label: 'ყველა' },
      { value: 'false', label: 'წაუკითხავი' },
      { value: 'true', label: 'წაკითხული' }
    ],
    deleted: [
      { value: '', label: 'ყველა' },
      { value: 'self', label: 'თვითონ წაშალა' },
      { value: 'admin', label: 'ადმინმა წაშალა' }
    ]
  };

  readonly REQUEST_STATUSES = ['pending', 'accepted', 'in-transit', 'delivered', 'cancelled'];
  readonly TRIP_STATUSES = ['pending', 'active', 'in-progress', 'completed', 'cancelled'];

  readonly STATUS_LABELS = STATUS_LABELS_MAP;
  readonly ROLE_LABELS: Record<string, string> = { sender: 'გამგზავნი', driver: 'მძღოლი', admin: 'ადმინი' };

  readonly PARCEL_COLS: Col[] = [
    { h: 'საიდან', f: 'from' }, { h: 'სად', f: 'to' }, { h: 'თარიღი', f: 'shipDate' },
    { h: 'წონა (კგ)', f: 'weight' }, { h: 'ღირებულება ₾', f: 'value' }, { h: 'სტატუსი', f: 'status' },
    { h: 'გამგზავნის ტელ.', f: 'senderPhone' }, { h: 'მიმღების ტელ.', f: 'recipientPhone' },
    { h: 'აღწერა', f: 'description' }, { h: 'შექმნილია', f: 'createdAt' }
  ];
  readonly TRIP_COLS: Col[] = [
    { h: 'საიდან', f: 'from' }, { h: 'სად', f: 'to' }, { h: 'გასვლა', f: 'departureDate' },
    { h: 'თავისუფალი (კგ)', f: 'availableSpace' }, { h: 'ფასი/კგ', f: 'pricePerKg' }, { h: 'სტატუსი', f: 'status' },
    { h: 'მანქანა', f: 'carModel' }, { h: 'ნომერი', f: 'carPlate' }, { h: 'ტელ.', f: 'senderPhone' },
    { h: 'მიღებული ნივთები', f: 'acceptedShippings' }, { h: 'შექმნილია', f: 'createdAt' }
  ];
  readonly USER_FIELDS: Col[] = [
    { h: 'ID', f: '_id' }, { h: 'სახელი', f: 'firstName' }, { h: 'გვარი', f: 'lastName' },
    { h: 'პირადი ნომერი', f: 'personalNumber' }, { h: 'ელფოსტა', f: 'email' }, { h: 'ტელეფონი', f: 'phone' },
    { h: 'ტელეფონი დადასტურებულია', f: 'phoneVerified' }, { h: 'როლი', f: 'role' },
    { h: 'დაბლოკილია', f: 'isBanned' }, { h: 'ბლოკის მიზეზი', f: 'bannedReason' },
    { h: 'რეიტინგი', f: 'ratingAvg' }, { h: 'შეფასებების რაოდენობა', f: 'ratingCount' },
    { h: 'მანქანა', f: 'carModel' }, { h: 'სახელმწიფო ნომერი', f: 'carPlate' },
    { h: 'მართვის მოწმობის №', f: 'driverLicenseNumber' }, { h: 'განცხადებები', f: 'requestsCount' },
    { h: 'მგზავრობები', f: 'tripsCount' }, { h: 'რეგისტრაცია', f: 'createdAt' }, { h: 'განახლება', f: 'updatedAt' }
  ];
  readonly OFFER_COLS: Col[] = [
    { h: 'სტატუსი', f: 'status' }, { h: 'parcel ID', f: 'parcelId' }, { h: 'driver ID', f: 'driverId' },
    { h: 'sender ID', f: 'senderId' }, { h: 'მძღოლმა დაასრულა', f: 'driverConfirmedComplete' },
    { h: 'გამგზავნმა დაასრულა', f: 'senderConfirmedComplete' }, { h: 'შექმნილია', f: 'createdAt' },
    { h: 'პასუხი', f: 'respondedAt' }, { h: 'დასრულდა', f: 'completedAt' }
  ];
  readonly TRIP_REQ_COLS: Col[] = [
    { h: 'სტატუსი', f: 'status' }, { h: 'trip ID', f: 'tripId' }, { h: 'driver ID', f: 'driverId' },
    { h: 'sender ID', f: 'senderId' }, { h: 'შეტყობინება', f: 'message' },
    { h: 'შექმნილია', f: 'createdAt' }, { h: 'პასუხი', f: 'respondedAt' }
  ];
  readonly REVIEW_COLS: Col[] = [
    { h: 'რეიტინგი', f: 'rating' }, { h: 'კომენტარი', f: 'comment' }, { h: 'ვის შეაფასა (role)', f: 'targetRole' },
    { h: 'reviewer ID', f: 'reviewerId' }, { h: 'target ID', f: 'targetId' }, { h: 'offer ID', f: 'offerId' },
    { h: 'თარიღი', f: 'createdAt' }
  ];
  readonly NOTIF_COLS: Col[] = [
    { h: 'ტიპი', f: 'type' }, { h: 'სათაური', f: 'title' }, { h: 'ტექსტი', f: 'body' },
    { h: 'ნანახია', f: 'seen' }, { h: 'თარიღი', f: 'createdAt' }
  ];
  readonly MSG_COLS: Col[] = [
    { h: 'გამგზავნი', f: 'senderId' }, { h: 'მიმღები', f: 'recipientId' }, { h: 'ტექსტი', f: 'message' },
    { h: 'განცხადება', f: 'requestId' }, { h: 'წაკითხულია', f: 'isRead' }, { h: 'დრო', f: 'timestamp' }
  ];

  // ✅ NEW: ცოცხალი მონაცემების სვეტები (სახელებით, ID-ების ნაცვლად)
  readonly REVIEW_LIVE_COLS: Col[] = [
    { h: 'რეიტინგი', f: 'rating' }, { h: 'კომენტარი', f: 'comment' },
    { h: 'ვინ შეაფასა', f: 'reviewerName' }, { h: 'ტელ.', f: 'reviewerPhone' },
    { h: 'ვის შეაფასა', f: 'targetName' }, { h: 'ტელ.', f: 'targetPhone' },
    { h: 'role', f: 'targetRole' }, { h: 'offer ID', f: 'offerId' }, { h: 'თარიღი', f: 'createdAt' }
  ];
  readonly NOTIF_LIVE_COLS: Col[] = [
    { h: 'ადრესატი', f: 'recipientName' }, { h: 'ტელ.', f: 'recipientPhone' },
    { h: 'ტიპი', f: 'type' }, { h: 'სათაური', f: 'title' }, { h: 'ტექსტი', f: 'body' },
    { h: 'ნანახია', f: 'seen' }, { h: 'parcel ID', f: 'parcelId' }, { h: 'trip ID', f: 'tripId' },
    { h: 'offer ID', f: 'offerId' }, { h: 'request ID', f: 'requestId' }, { h: 'თარიღი', f: 'createdAt' }
  ];
  readonly MSG_LIVE_COLS: Col[] = [
    { h: 'გამგზავნი', f: 'senderName' }, { h: 'მიმღები', f: 'recipientName' },
    { h: 'ტექსტი', f: 'message' }, { h: 'განცხადება', f: 'requestId' },
    { h: 'წაკითხულია', f: 'isRead' }, { h: 'დრო', f: 'timestamp' }
  ];
  readonly OFFER_USER_COLS: Col[] = [
    { h: 'მისი როლი', f: 'role' }, { h: 'ნივთი', f: 'parcelRoute' }, { h: 'ნივთის სტატუსი', f: 'parcelStatus' },
    { h: 'მძღოლი', f: 'driverName' }, { h: 'გამგზავნი', f: 'senderName' }, { h: 'სტატუსი', f: 'status' },
    { h: 'მძღოლმა დაასრულა', f: 'driverConfirmedComplete' }, { h: 'გამგზავნმა დაადასტურა', f: 'senderConfirmedComplete' },
    { h: 'შექმნილია', f: 'createdAt' }, { h: 'პასუხი', f: 'respondedAt' }, { h: 'დასრულდა', f: 'completedAt' }
  ];
  readonly TRIPREQ_USER_COLS: Col[] = [
    { h: 'მისი როლი', f: 'role' }, { h: 'მგზავრობა', f: 'tripRoute' }, { h: 'გასვლა', f: 'tripId.departureDate' },
    { h: 'მძღოლი', f: 'driverName' }, { h: 'გამგზავნი', f: 'senderName' }, { h: 'შეტყობინება', f: 'message' },
    { h: 'სტატუსი', f: 'status' }, { h: 'შექმნილია', f: 'createdAt' }, { h: 'პასუხი', f: 'respondedAt' }
  ];

  readonly DELETED_SECTIONS: { key: string; label: string; cols: Col[] }[] = [
    { key: 'parcels', label: 'განცხადებები', cols: this.PARCEL_COLS },
    { key: 'trips', label: 'მგზავრობები', cols: this.TRIP_COLS },
    { key: 'offers', label: 'შეთავაზებები', cols: this.OFFER_COLS },
    { key: 'tripRequests', label: 'მგზავრობის მოთხოვნები', cols: this.TRIP_REQ_COLS },
    { key: 'reviews', label: 'შეფასებები', cols: this.REVIEW_COLS },
    { key: 'carriedParcels', label: 'წაღებული სხვისი ნივთები', cols: this.PARCEL_COLS },
    { key: 'notifications', label: 'შეტყობინებები (ზარი)', cols: this.NOTIF_COLS }
  ];

  readonly STAT_LABELS: Record<string, string> = {
    parcelsCount: 'განცხადებები',
    deliveredParcelsCount: 'ჩაბარებული განცხადებები',
    tripsCount: 'მგზავრობები',
    completedTripsCount: 'დასრულებული მგზავრობები',
    offersCount: 'შეთავაზებები',
    deliveredOffersCount: 'ჩაბარებული შეთავაზებები',
    tripRequestsCount: 'მგზავრობის მოთხოვნები',
    reviewsCount: 'შეფასებები',
    notificationsCount: 'შეტყობინებები',
    messagesCount: 'ჩატის შეტყობინებები'
  };

  userDetail: any = null;
  userDetailLoading = false;
  userExtras: any = null; // ✅ NEW

  deleted: any = null;
  deletedLoading = false;
  delTab = 'profile';
  msgs: any[] = [];
  msgPage = 1;
  msgTotal = 0;
  msgTotalPages = 1;
  msgLoading = false;
  msgLoaded = false;

  toast: { text: string; err: boolean } | null = null;
  private toastTimer: any;

  ngOnInit(): void {
    this.loadStats();
  }

  // ============================================================
  // გასვლა
  // ============================================================

  logout() {
    localStorage.removeItem(TOKEN_KEY);
    this.router.navigateByUrl('/admin/login');
  }

  // ============================================================
  // დამხმარე ფუნქციები
  // ============================================================

  private newList(): ListState {
    return { items: [], page: 1, limit: 20, total: 0, totalPages: 1, search: '', filter: '', loading: false };
  }

  private statusFilter(values: string[]) {
    return [{ value: '', label: 'ყველა სტატუსი' }, ...values.map((v) => ({ value: v, label: STATUS_LABELS_MAP[v] || v }))];
  }

  private headers(): HttpHeaders {
    return new HttpHeaders({ Authorization: `Bearer ${localStorage.getItem(TOKEN_KEY) || ''}` });
  }

  private call(method: string, url: string, body?: any): Observable<any> {
    return this.http
      .request<any>(method, `${API}/${url}`, { body, headers: this.headers() })
      .pipe(finalize(() => this.cdr.markForCheck()));
  }

  private show(text: string, err = false) {
    this.toast = { text, err };
    this.cdr.markForCheck();
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      this.toast = null;
      this.cdr.markForCheck();
    }, 3500);
  }

  private fail(e: any) {
    if (e?.status === 401) {
      this.logout();
      return;
    }
    this.show(e?.error?.message || 'მოთხოვნა ვერ შესრულდა', true);
  }

  private act(obs: Observable<any>, after?: () => void) {
    obs.subscribe({
      next: (r) => {
        this.show(r?.message || 'შესრულდა');
        if (after) after();
      },
      error: (e) => this.fail(e)
    });
  }

  fullName(u: any): string {
    return u && typeof u === 'object' ? `${u.firstName || ''} ${u.lastName || ''}`.trim() || '—' : '—';
  }

  statusLabel(s: any): string {
    return this.STATUS_LABELS[String(s)] || (s ? String(s) : '—');
  }

  statLabel(k: any): string {
    return this.STAT_LABELS[String(k)] || String(k);
  }

  fmt(v: any): string {
    if (v === null || v === undefined || v === '') return '—';
    if (typeof v === 'boolean') return v ? '✓' : '✗';
    if (Array.isArray(v)) return String(v.length);
    if (typeof v === 'object') return v._id ? String(v._id) : JSON.stringify(v);
    if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v)) return new Date(v).toLocaleString('ka-GE');
    return String(v);
  }

  cell(row: any, path: string): string {
    const v = path.split('.').reduce((o: any, k: string) => (o == null ? undefined : o[k]), row);
    if (path === 'role') return this.ROLE_LABELS[v] || this.fmt(v);
    return this.fmt(v);
  }

  isStatusCol(f: string): boolean {
    return f === 'status';
  }

  // ============================================================
  // ტაბები და სიები
  // ============================================================

  setTab(t: Tab) {
    this.tab = t;
    if (t === 'dashboard') {
      this.loadStats();
    } else {
      this.load(t);
    }
  }

  loadStats() {
    this.statsLoading = true;
    this.call('GET', 'stats').subscribe({
      next: (r) => {
        this.stats = r.stats;
        this.statsLoading = false;
      },
      error: (e) => {
        this.statsLoading = false;
        this.fail(e);
      }
    });
  }

  load(key: ListKey) {
    const s = this.lists[key];
    const c = LIST_CFG[key];
    s.loading = true;

    let params = new HttpParams().set('page', s.page).set('limit', s.limit);
    if (s.filter) params = params.set(c.filterParam, s.filter);
    if (c.search && s.search.trim()) params = params.set('search', s.search.trim());

    this.http
      .get<any>(`${API}/${c.path}`, { headers: this.headers(), params })
      .pipe(finalize(() => this.cdr.markForCheck()))
      .subscribe({
      next: (r) => {
        s.items = r[c.field] || [];
        const p = r.pagination || {};
        s.total = p.total || 0;
        s.totalPages = p.totalPages || 1;
        s.loading = false;
      },
      error: (e) => {
        s.loading = false;
        this.fail(e);
      }
    });
  }

  applyFilters(key: ListKey) {
    this.lists[key].page = 1;
    this.load(key);
  }

  goPage(key: ListKey, delta: number) {
    const s = this.lists[key];
    const next = s.page + delta;
    if (next < 1 || next > s.totalPages) return;
    s.page = next;
    this.load(key);
  }

  L(key: any): ListState {
    return this.lists[key as ListKey];
  }

  F(key: any): { value: string; label: string }[] {
    return this.filters[key as ListKey];
  }

  cfgSearch(key: ListKey): boolean {
    return LIST_CFG[key].search;
  }

  // ============================================================
  // მომხმარებლები
  // ============================================================

  openUser(id: string) {
    if (!id) return; // წაშლილი მომხმარებლის ID ცარიელი შეიძლება იყოს
    this.userDetail = null;
    this.userExtras = null;
    this.userDetailLoading = true;
    this.call('GET', `users/${id}`).subscribe({
      next: (r) => {
        this.userDetail = r;
        this.userDetailLoading = false;
        this.loadUserExtras(id);
      },
      error: (e) => {
        this.userDetailLoading = false;
        this.fail(e);
      }
    });
  }

  private loadUserExtras(id: string) {
    this.call('GET', `users/${id}/extras`).subscribe({
      next: (r) => (this.userExtras = r),
      error: (e) => this.fail(e)
    });
  }

  closeUser() {
    this.userDetail = null;
    this.userExtras = null;
    this.userDetailLoading = false;
  }

  changeRole(u: any, role: string) {
    if (role === u.role) return;
    if (!confirm(`${this.fullName(u)} — role შეიცვალოს: "${this.ROLE_LABELS[role]}"?`)) {
      this.load('users');
      return;
    }
    this.act(this.call('PUT', `users/${u._id}/role`, { role }), () => {
      this.load('users');
      if (this.userDetail?.user?._id === u._id) this.openUser(u._id);
    });
  }

  toggleBan(u: any) {
    const banning = !u.isBanned;
    let reason = '';
    if (banning) {
      const r = prompt(`${this.fullName(u)} — დაბლოკვის მიზეზი (არასავალდებულო):`, '');
      if (r === null) return;
      reason = r;
    } else if (!confirm(`${this.fullName(u)} განიბლოკოს?`)) {
      return;
    }
    this.act(this.call('PUT', `users/${u._id}/ban`, { banned: banning, reason }), () => {
      this.load('users');
      if (this.userDetail?.user?._id === u._id) this.openUser(u._id);
    });
  }

  deleteUser(u: any) {
    if (!confirm(`⚠️ ${this.fullName(u)} და მისი ყველა მონაცემი წაიშლება (არქივში შეინახება). გაგრძელება?`)) return;
    const reason = prompt('წაშლის მიზეზი (არასავალდებულო):', '');
    if (reason === null) return;
    this.act(this.call('DELETE', `users/${u._id}`, { reason }), () => {
      this.closeUser();
      this.load('users');
      this.loadStats();
      if (this.tab === 'deleted') this.load('deleted');
    });
  }

  // ============================================================
  // განცხადებები / მგზავრობები / შეთავაზებები / მოთხოვნები
  // ============================================================

  setRequestStatus(r: any, status: string) {
    if (status === r.status) return;
    this.act(this.call('PUT', `requests/${r._id}/status`, { status }), () => this.load('requests'));
  }

  deleteRequest(r: any) {
    if (!confirm(`განცხადება "${r.from} → ${r.to}" წაიშალოს?`)) return;
    this.act(this.call('DELETE', `requests/${r._id}`), () => {
      this.load('requests');
      this.loadStats();
    });
  }

  setTripStatus(t: any, status: string) {
    if (status === t.status) return;
    this.act(this.call('PUT', `trips/${t._id}/status`, { status }), () => this.load('trips'));
  }

  cancelTrip(t: any) {
    if (!confirm(`მგზავრობა "${t.from} → ${t.to}" გაუქმდეს?`)) return;
    this.act(this.call('PUT', `trips/${t._id}/cancel`), () => this.load('trips'));
  }

  deleteTrip(t: any) {
    if (!confirm(`მგზავრობა "${t.from} → ${t.to}" წაიშალოს?`)) return;
    this.act(this.call('DELETE', `trips/${t._id}`), () => {
      this.load('trips');
      this.loadStats();
    });
  }

  deleteOffer(o: any) {
    if (!confirm('შეთავაზება წაიშალოს?')) return;
    this.act(this.call('DELETE', `offers/${o._id}`), () => {
      this.load('offers');
      this.loadStats();
    });
  }

  deleteTripRequest(r: any) {
    if (!confirm('მოთხოვნა წაიშალოს?')) return;
    this.act(this.call('DELETE', `trip-requests/${r._id}`), () => {
      this.load('tripRequests');
      this.loadStats();
    });
  }

  // ============================================================
  // წაშლილი მომხმარებლების არქივი
  // ============================================================

  openDeleted(id: string) {
    this.deleted = null;
    this.deletedLoading = true;
    this.delTab = 'profile';
    this.msgs = [];
    this.msgPage = 1;
    this.msgTotal = 0;
    this.msgTotalPages = 1;
    this.msgLoaded = false;

    this.call('GET', `deleted-users/${id}`).subscribe({
      next: (r) => {
        this.deleted = r.item;
        this.deletedLoading = false;
      },
      error: (e) => {
        this.deletedLoading = false;
        this.fail(e);
      }
    });
  }

  closeDeleted() {
    this.deleted = null;
    this.deletedLoading = false;
  }

  setDelTab(key: string) {
    this.delTab = key;
    if (key === 'messages' && !this.msgLoaded) this.loadMessages(1);
  }

  loadMessages(page: number) {
    if (!this.deleted) return;
    this.msgLoading = true;
    const params = new HttpParams().set('page', page).set('limit', 50);
    this.http
      .get<any>(`${API}/deleted-users/${this.deleted._id}/messages`, { headers: this.headers(), params })
      .pipe(finalize(() => this.cdr.markForCheck()))
      .subscribe({
        next: (r) => {
          this.msgs = r.messages || [];
          this.msgPage = r.pagination?.page || page;
          this.msgTotal = r.pagination?.total || 0;
          this.msgTotalPages = r.pagination?.totalPages || 1;
          this.msgLoading = false;
          this.msgLoaded = true;
        },
        error: (e) => {
          this.msgLoading = false;
          this.fail(e);
        }
      });
  }

  relatedRows(key: string): any[] {
    return (this.deleted?.related && this.deleted.related[key]) || [];
  }

  msgDirection(m: any): string {
    const sid = m?.senderId?._id || m?.senderId;
    return String(sid) === String(this.deleted?.originalId) ? 'msg-out' : 'msg-in';
  }
}