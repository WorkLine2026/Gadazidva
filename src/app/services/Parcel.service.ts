import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, Subject, throwError } from 'rxjs';
import { environment } from '../environment/environment';
import { SmsVerificationService } from './smsverifikation.service';

export interface ParcelDetails {
  value: any;
  to: any;
  from: any;
  weight: number;
  dimensions?: string;
  description?: string;
}

export interface AvailableShipping {
  _id: string;
  from: string;
  to: string;
  parcelDetails: ParcelDetails;
  senderId?: string;
  senderName?: string;
  senderPhone?: string;
  createdAt?: string;
  status?: string;
}

export interface ParcelRequest {
  _id?: string;
  from: string;
  to: string;
  shipDate: string;
  description: string;
  weight: number;
  value: number;
  senderPhone: string;
  recipientPhone: string;
  notes?: string;
  status?: 'pending' | 'accepted' | 'in-transit' | 'delivered';
  createdAt?: string;
  // ✅ დამატებული ველი home component-ისთვის
  senderName?: string;
}

export interface AcceptedShipping {
  _id?: string;
  from?: string;
  to?: string;
  parcelDetails?: ParcelDetails;
  senderId?: string;
  senderName?: string;
  senderPhone?: string;
  createdAt?: string;
}

export interface DriverTrip {
  _id: string;
  driverId: string;
  from: string;
  to: string;
  departureDate: string;
  availableSpace?: number;
  pricePerKg?: number;
  personalNumber?: string;
  senderPhone?: string;
  carModel?: string;
  carPlate?: string;
  comments?: string;
  status?: 'pending' | 'active' | 'completed' | 'cancelled';
  acceptedShippings?: AcceptedShipping[];
  createdAt?: string;
  updatedAt?: string;
  // ✅ დამატებული ველი home component-ისთვის
  driverName?: string;
}

export interface DriverStats {
  completedTrips: number;
  averageRating: number;
  reviewCount: number;
  currentEarnings: number;
  earningsTrend: string;
  hasActiveTrip: boolean;
  activeTrip?: {
    from: string;
    to: string;
    distance: number;
    estimatedTime: number;
  };
}

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
  requestId?: string;
}

export interface TripResponse extends ApiResponse<DriverTrip> {
  tripId?: string;
  requestId?: string;
}

export interface TripsResponse extends ApiResponse<DriverTrip[]> {
  trips?: DriverTrip[];
}

export interface StatsResponse extends ApiResponse<DriverStats> {
  stats?: DriverStats;
}

export interface ShippingsResponse extends ApiResponse<AvailableShipping[]> {
  shippings?: AvailableShipping[];
}

export interface RequestsResponse extends ApiResponse<ParcelRequest[]> {
  requests?: ParcelRequest[];
}

@Injectable({
  providedIn: 'root'
})
export class ParcelService {
  private apiUrl = `${environment.apiUrl}/parcels`;
  private driverUrl = `${environment.apiUrl}/parcels/driver`;

  // ✅ RxJS Subject - ტრიპის შექმნის ნოტიფიკაციებისთვის
  private tripCreated$ = new Subject<DriverTrip>();

  readonly GEORGIAN_CITIES = [
    'თბილისი', 'ბათუმი', 'ქუთაისი', 'გორი', 'დუშეთი',
    'ზუგდიდი', 'სოხუმი', 'თელავი', 'გორიცხე', 'ხელვაჩაური',
    'სარპი', 'პოტი', 'მცხეთა', 'სიღნაღი', 'ხაშური'
  ];

  constructor(
    private http: HttpClient,
    private smsService: SmsVerificationService
  ) {}

  // ✅ SmsVerificationService-დან token მოიტანეთ
  private getAuthToken(): string {
    const token = localStorage.getItem('authToken');
    console.log('🔍 ParcelService token-ის მოპოვება:', token ? '✅ აქვს' : '❌ არ აქვს');
    return token || '';
  }

  private getAuthHeaders(): HttpHeaders {
    const token = this.getAuthToken();
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    });
  }

  // ✅ ტრიპის შექმნის ნოტიფიკაციის Observable
  tripCreated(): Observable<DriverTrip> {
    return this.tripCreated$.asObservable();
  }

  // ✅ ტრიპის შექმნის აცნობება ყველა listener-ს
  notifyTripCreated(trip: DriverTrip): void {
    this.tripCreated$.next(trip);
  }

  // ============ PUBLIC REQUESTS (HOME PAGE) ============

  // ✅ PUBLIC - auth არ სჭირდება
  getRecentRequests(): Observable<RequestsResponse> {
    return this.http.get<RequestsResponse>(`${this.apiUrl}/recent-requests`);
  }

  // ============ PARCEL REQUESTS ============

  createParcelRequest(data: ParcelRequest): Observable<TripResponse> {
    const token = this.getAuthToken();
    if (!token) {
      return throwError(() => new Error('ავტორიზაცია საჭიროა'));
    }

    return this.http.post<TripResponse>(`${this.apiUrl}/request`, data, {
      headers: this.getAuthHeaders()
    });
  }

  getUserRequests(): Observable<RequestsResponse> {
    const token = this.getAuthToken();
    if (!token) {
      return throwError(() => new Error('ავტორიზაცია საჭიროა'));
    }

    return this.http.get<RequestsResponse>(`${this.apiUrl}/my-requests`, {
      headers: this.getAuthHeaders()
    });
  }

  getParcelRequest(requestId: string): Observable<ApiResponse<ParcelRequest>> {
    const token = this.getAuthToken();
    if (!token) {
      return throwError(() => new Error('ავტორიზაცია საჭიროა'));
    }

    return this.http.get<ApiResponse<ParcelRequest>>(`${this.apiUrl}/request/${requestId}`, {
      headers: this.getAuthHeaders()
    });
  }

  updateParcelStatus(requestId: string, status: string): Observable<ApiResponse<ParcelRequest>> {
    const token = this.getAuthToken();
    if (!token) {
      return throwError(() => new Error('ავტორიზაცია საჭიროა'));
    }

    return this.http.put<ApiResponse<ParcelRequest>>(
      `${this.apiUrl}/request/${requestId}/status`,
      { status },
      { headers: this.getAuthHeaders() }
    );
  }

  republishRequest(requestId: string): Observable<ApiResponse<ParcelRequest>> {
    const token = this.getAuthToken();
    if (!token) {
      return throwError(() => new Error('ავტორიზაცია საჭიროა'));
    }

    return this.http.post<ApiResponse<ParcelRequest>>(
      `${this.apiUrl}/request/${requestId}/republish`,
      {},
      { headers: this.getAuthHeaders() }
    );
  }

  // ============ PUBLIC TRIPS (HOME PAGE) ============

  // ✅ PUBLIC - auth არ სჭირდება
  getRecentTrips(): Observable<TripsResponse> {
    return this.http.get<TripsResponse>(`${this.driverUrl}/recent-trips`);
  }

  // ============ DRIVER TRIPS ============

  createTrip(data: DriverTrip): Observable<TripResponse> {
    const token = this.getAuthToken();
    if (!token) {
      return throwError(() => new Error('ავტორიზაცია საჭიროა'));
    }

    return this.http.post<TripResponse>(`${this.driverUrl}/create-trip`, data, {
      headers: this.getAuthHeaders()
    });
  }

  getDriverTrips(): Observable<TripsResponse> {
    const token = this.getAuthToken();
    if (!token) {
      return throwError(() => new Error('ავტორიზაცია საჭიროა'));
    }

    return this.http.get<TripsResponse>(`${this.driverUrl}/my-trips`, {
      headers: this.getAuthHeaders()
    });
  }

  getTrip(tripId: string): Observable<ApiResponse<DriverTrip>> {
    const token = this.getAuthToken();
    if (!token) {
      return throwError(() => new Error('ავტორიზაცია საჭიროა'));
    }

    return this.http.get<ApiResponse<DriverTrip>>(`${this.driverUrl}/${tripId}`, {
      headers: this.getAuthHeaders()
    });
  }

  updateTrip(tripId: string, data: Partial<DriverTrip>): Observable<ApiResponse<DriverTrip>> {
    const token = this.getAuthToken();
    if (!token) {
      return throwError(() => new Error('ავტორიზაცია საჭიროა'));
    }

    return this.http.put<ApiResponse<DriverTrip>>(`${this.driverUrl}/${tripId}`, data, {
      headers: this.getAuthHeaders()
    });
  }

  cancelTrip(tripId: string): Observable<ApiResponse<DriverTrip>> {
    const token = this.getAuthToken();
    if (!token) {
      return throwError(() => new Error('ავტორიზაცია საჭიროა'));
    }

    return this.http.put<ApiResponse<DriverTrip>>(
      `${this.driverUrl}/${tripId}/cancel`,
      {},
      { headers: this.getAuthHeaders() }
    );
  }

  completeTrip(tripId: string): Observable<ApiResponse<DriverTrip>> {
    const token = this.getAuthToken();
    if (!token) {
      return throwError(() => new Error('ავტორიზაცია საჭიროა'));
    }

    return this.http.put<ApiResponse<DriverTrip>>(
      `${this.driverUrl}/${tripId}/complete`,
      {},
      { headers: this.getAuthHeaders() }
    );
  }

  // ============ AVAILABLE SHIPPINGS ============

  getAvailableShippings(
    from: string,
    to: string,
    departureDate: string
  ): Observable<ShippingsResponse> {
    const token = this.getAuthToken();
    if (!token) {
      return throwError(() => new Error('ავტორიზაცია საჭიროა'));
    }

    const params = new HttpParams()
      .set('from', from)
      .set('to', to)
      .set('departureDate', departureDate);

    return this.http.get<ShippingsResponse>(
      `${this.apiUrl}/available-shippings`,
      {
        headers: this.getAuthHeaders(),
        params
      }
    );
  }

  acceptShipping(shippingId: string): Observable<ApiResponse<AcceptedShipping>> {
    const token = this.getAuthToken();
    if (!token) {
      return throwError(() => new Error('ავტორიზაცია საჭიროა'));
    }

    return this.http.post<ApiResponse<AcceptedShipping>>(
      `${this.apiUrl}/${shippingId}/accept`,
      {},
      { headers: this.getAuthHeaders() }
    );
  }

  rejectShipping(shippingId: string, reason?: string): Observable<ApiResponse<null>> {
    const token = this.getAuthToken();
    if (!token) {
      return throwError(() => new Error('ავტორიზაცია საჭიროა'));
    }

    return this.http.post<ApiResponse<null>>(
      `${this.apiUrl}/${shippingId}/reject`,
      { reason },
      { headers: this.getAuthHeaders() }
    );
  }

  pickupShipping(shippingId: string): Observable<ApiResponse<AcceptedShipping>> {
    const token = this.getAuthToken();
    if (!token) {
      return throwError(() => new Error('ავტორიზაცია საჭიროა'));
    }

    return this.http.post<ApiResponse<AcceptedShipping>>(
      `${this.apiUrl}/${shippingId}/pickup`,
      {},
      { headers: this.getAuthHeaders() }
    );
  }

  deliverShipping(shippingId: string): Observable<ApiResponse<AcceptedShipping>> {
    const token = this.getAuthToken();
    if (!token) {
      return throwError(() => new Error('ავტორიზაცია საჭიროა'));
    }

    return this.http.post<ApiResponse<AcceptedShipping>>(
      `${this.apiUrl}/${shippingId}/deliver`,
      {},
      { headers: this.getAuthHeaders() }
    );
  }

  // ============ DRIVER STATS & ANALYTICS ============

  getDriverStats(): Observable<StatsResponse> {
    const token = this.getAuthToken();
    if (!token) {
      return throwError(() => new Error('ავტორიზაცია საჭიროა'));
    }

    return this.http.get<StatsResponse>(`${this.driverUrl}/stats`, {
      headers: this.getAuthHeaders()
    });
  }

  getEarningsReport(period?: 'week' | 'month' | 'all'): Observable<ApiResponse<any>> {
    const token = this.getAuthToken();
    if (!token) {
      return throwError(() => new Error('ავტორიზაცია საჭიროა'));
    }

    const params = period ? `?period=${period}` : '';

    return this.http.get<ApiResponse<any>>(
      `${this.driverUrl}/earnings${params}`,
      { headers: this.getAuthHeaders() }
    );
  }

  getDriverReviews(): Observable<ApiResponse<any>> {
    const token = this.getAuthToken();
    if (!token) {
      return throwError(() => new Error('ავტორიზაცია საჭიროა'));
    }

    return this.http.get<ApiResponse<any>>(`${this.driverUrl}/reviews`, {
      headers: this.getAuthHeaders()
    });
  }

  // ============ RATINGS ============

  rateDriver(driverId: string, rating: number, comment?: string): Observable<ApiResponse<null>> {
    const token = this.getAuthToken();
    if (!token) {
      return throwError(() => new Error('ავტორიზაცია საჭიროა'));
    }

    return this.http.post<ApiResponse<null>>(
      `${environment.apiUrl}/drivers/${driverId}/rate`,
      { rating, comment },
      { headers: this.getAuthHeaders() }
    );
  }

  rateSender(senderId: string, rating: number, comment?: string): Observable<ApiResponse<null>> {
    const token = this.getAuthToken();
    if (!token) {
      return throwError(() => new Error('ავტორიზაცია საჭიროა'));
    }

    return this.http.post<ApiResponse<null>>(
      `${environment.apiUrl}/senders/${senderId}/rate`,
      { rating, comment },
      { headers: this.getAuthHeaders() }
    );
  }

  // ============ VALIDATION HELPERS ============

  isValidRoute(from: string, to: string): boolean {
    if (!from || !to) return false;
    if (from === to) return false;
    return this.GEORGIAN_CITIES.includes(from) && this.GEORGIAN_CITIES.includes(to);
  }

  isValidWeight(weight: number): boolean {
    if (!weight || isNaN(weight)) return false;
    return weight >= 0.1 && weight <= 300;
  }

  isValidValue(value: number): boolean {
    if (!value || isNaN(value)) return false;
    return value >= 1 && value <= 1000000;
  }

  isValidPhone(phone: string): boolean {
    if (!phone) return false;
    const phoneRegex = /^(\+995\s?)?5\d{2}\s?\d{3}\s?\d{3}$/;
    return phoneRegex.test(phone.replace(/\s/g, ''));
  }

  isValidShipDate(dateString: string): boolean {
    if (!dateString) return false;
    const shipDate = new Date(dateString);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return shipDate >= today;
  }

  formatDate(dateString: string): string {
    if (!dateString) return '—';
    try {
      const date = new Date(dateString);
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      return `${day}.${month}.${year}`;
    } catch {
      return '—';
    }
  }

  formatPrice(price: number): string {
    if (!price || isNaN(price)) return '—';
    return `${price.toLocaleString('ka-GE')} ₾`;
  }
}