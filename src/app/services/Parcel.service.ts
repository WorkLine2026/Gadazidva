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

  /**
   * ✅ SmsVerificationService-დან token მოიტანეთ
   */
  private getAuthHeaders(): HttpHeaders {
    const token = this.smsService.getAuthToken();
    console.log('🔍 ParcelService token-ის მოპოვება:', token ? '✅ აქვს' : '❌ არ აქვს');
    
    if (!token) {
      throw new Error('ავტორიზაცია საჭიროა');
    }

    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    });
  }

  /**
   * ✅ უსაფრთხოების შემოწმება თუ token არის
   */
  private ensureAuthenticated(): void {
    if (!this.smsService.isAuthenticated()) {
      throw new Error('ავტორიზაცია საჭიროა');
    }
  }

  tripCreated(): Observable<DriverTrip> {
    return this.tripCreated$.asObservable();
  }

  notifyTripCreated(trip: DriverTrip): void {
    this.tripCreated$.next(trip);
  }

  // ============ PUBLIC REQUESTS (HOME PAGE) ============

  getRecentRequests(): Observable<RequestsResponse> {
    return this.http.get<RequestsResponse>(`${this.apiUrl}/recent-requests`);
  }

  // ============ PARCEL REQUESTS ============

  createParcelRequest(data: ParcelRequest): Observable<TripResponse> {
    try {
      this.ensureAuthenticated();
      return this.http.post<TripResponse>(`${this.apiUrl}/request`, data, {
        headers: this.getAuthHeaders()
      });
    } catch (err) {
      return throwError(() => err);
    }
  }

  getUserRequests(): Observable<RequestsResponse> {
    try {
      this.ensureAuthenticated();
      return this.http.get<RequestsResponse>(`${this.apiUrl}/my-requests`, {
        headers: this.getAuthHeaders()
      });
    } catch (err) {
      return throwError(() => err);
    }
  }

  /**
   * ✅ PUBLIC - ავტორიზაციის გარეშე განცხადების დაძებნა
   */
  getParcelRequest(requestId: string): Observable<ApiResponse<ParcelRequest>> {
    return this.http.get<ApiResponse<ParcelRequest>>(
      `${this.apiUrl}/request/${requestId}`
    );
  }

  /**
   * ✅ PROTECTED - მხოლოდ sender შეუძლია status update-ი
   */
  updateParcelStatus(requestId: string, status: string): Observable<ApiResponse<ParcelRequest>> {
    try {
      this.ensureAuthenticated();
      return this.http.put<ApiResponse<ParcelRequest>>(
        `${this.apiUrl}/request/${requestId}/status`,
        { status },
        { headers: this.getAuthHeaders() }
      );
    } catch (err) {
      return throwError(() => err);
    }
  }

  republishRequest(requestId: string): Observable<ApiResponse<ParcelRequest>> {
    try {
      this.ensureAuthenticated();
      return this.http.post<ApiResponse<ParcelRequest>>(
        `${this.apiUrl}/request/${requestId}/republish`,
        {},
        { headers: this.getAuthHeaders() }
      );
    } catch (err) {
      return throwError(() => err);
    }
  }

  // ============ PUBLIC TRIPS (HOME PAGE) ============

  getRecentTrips(): Observable<TripsResponse> {
    return this.http.get<TripsResponse>(`${this.driverUrl}/recent-trips`);
  }

  /**
   * ✅ PUBLIC - ავტორიზაციის გარეშე ტრიპის დეტალების ნახვა
   * (ისევე როგორც getParcelRequest() არის public)
   */
  getTripDetails(tripId: string): Observable<ApiResponse<DriverTrip>> {
    return this.http.get<ApiResponse<DriverTrip>>(`${this.driverUrl}/trip/${tripId}`);
  }

  // ============ DRIVER TRIPS ============

  createTrip(data: DriverTrip): Observable<TripResponse> {
    try {
      this.ensureAuthenticated();
      return this.http.post<TripResponse>(`${this.driverUrl}/create-trip`, data, {
        headers: this.getAuthHeaders()
      });
    } catch (err) {
      return throwError(() => err);
    }
  }

  getDriverTrips(): Observable<TripsResponse> {
    try {
      this.ensureAuthenticated();
      return this.http.get<TripsResponse>(`${this.driverUrl}/my-trips`, {
        headers: this.getAuthHeaders()
      });
    } catch (err) {
      return throwError(() => err);
    }
  }

  getTrip(tripId: string): Observable<ApiResponse<DriverTrip>> {
    try {
      this.ensureAuthenticated();
      return this.http.get<ApiResponse<DriverTrip>>(
        `${this.driverUrl}/${tripId}`,
        { headers: this.getAuthHeaders() }
      );
    } catch (err) {
      return throwError(() => err);
    }
  }

  updateTrip(tripId: string, data: Partial<DriverTrip>): Observable<ApiResponse<DriverTrip>> {
    try {
      this.ensureAuthenticated();
      return this.http.put<ApiResponse<DriverTrip>>(
        `${this.driverUrl}/${tripId}`,
        data,
        { headers: this.getAuthHeaders() }
      );
    } catch (err) {
      return throwError(() => err);
    }
  }

  cancelTrip(tripId: string): Observable<ApiResponse<DriverTrip>> {
    try {
      this.ensureAuthenticated();
      return this.http.put<ApiResponse<DriverTrip>>(
        `${this.driverUrl}/${tripId}/cancel`,
        {},
        { headers: this.getAuthHeaders() }
      );
    } catch (err) {
      return throwError(() => err);
    }
  }

  completeTrip(tripId: string): Observable<ApiResponse<DriverTrip>> {
    try {
      this.ensureAuthenticated();
      return this.http.put<ApiResponse<DriverTrip>>(
        `${this.driverUrl}/${tripId}/complete`,
        {},
        { headers: this.getAuthHeaders() }
      );
    } catch (err) {
      return throwError(() => err);
    }
  }

  // ============ AVAILABLE SHIPPINGS ============

  getAvailableShippings(
    from: string,
    to: string,
    departureDate: string
  ): Observable<ShippingsResponse> {
    try {
      this.ensureAuthenticated();
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
    } catch (err) {
      return throwError(() => err);
    }
  }

  acceptShipping(shippingId: string): Observable<ApiResponse<AcceptedShipping>> {
    try {
      this.ensureAuthenticated();
      return this.http.post<ApiResponse<AcceptedShipping>>(
        `${this.apiUrl}/${shippingId}/accept`,
        {},
        { headers: this.getAuthHeaders() }
      );
    } catch (err) {
      return throwError(() => err);
    }
  }

  rejectShipping(shippingId: string, reason?: string): Observable<ApiResponse<null>> {
    try {
      this.ensureAuthenticated();
      return this.http.post<ApiResponse<null>>(
        `${this.apiUrl}/${shippingId}/reject`,
        { reason },
        { headers: this.getAuthHeaders() }
      );
    } catch (err) {
      return throwError(() => err);
    }
  }

  pickupShipping(shippingId: string): Observable<ApiResponse<AcceptedShipping>> {
    try {
      this.ensureAuthenticated();
      return this.http.post<ApiResponse<AcceptedShipping>>(
        `${this.apiUrl}/${shippingId}/pickup`,
        {},
        { headers: this.getAuthHeaders() }
      );
    } catch (err) {
      return throwError(() => err);
    }
  }

  deliverShipping(shippingId: string): Observable<ApiResponse<AcceptedShipping>> {
    try {
      this.ensureAuthenticated();
      return this.http.post<ApiResponse<AcceptedShipping>>(
        `${this.apiUrl}/${shippingId}/deliver`,
        {},
        { headers: this.getAuthHeaders() }
      );
    } catch (err) {
      return throwError(() => err);
    }
  }

  // ============ DRIVER STATS & ANALYTICS ============

  getDriverStats(): Observable<StatsResponse> {
    try {
      this.ensureAuthenticated();
      return this.http.get<StatsResponse>(`${this.driverUrl}/stats`, {
        headers: this.getAuthHeaders()
      });
    } catch (err) {
      return throwError(() => err);
    }
  }

  getEarningsReport(period?: 'week' | 'month' | 'all'): Observable<ApiResponse<any>> {
    try {
      this.ensureAuthenticated();
      const params = period ? `?period=${period}` : '';

      return this.http.get<ApiResponse<any>>(
        `${this.driverUrl}/earnings${params}`,
        { headers: this.getAuthHeaders() }
      );
    } catch (err) {
      return throwError(() => err);
    }
  }

  getDriverReviews(): Observable<ApiResponse<any>> {
    try {
      this.ensureAuthenticated();
      return this.http.get<ApiResponse<any>>(`${this.driverUrl}/reviews`, {
        headers: this.getAuthHeaders()
      });
    } catch (err) {
      return throwError(() => err);
    }
  }

  // ============ RATINGS ============

  rateDriver(driverId: string, rating: number, comment?: string): Observable<ApiResponse<null>> {
    try {
      this.ensureAuthenticated();
      return this.http.post<ApiResponse<null>>(
        `${environment.apiUrl}/drivers/${driverId}/rate`,
        { rating, comment },
        { headers: this.getAuthHeaders() }
      );
    } catch (err) {
      return throwError(() => err);
    }
  }

  rateSender(senderId: string, rating: number, comment?: string): Observable<ApiResponse<null>> {
    try {
      this.ensureAuthenticated();
      return this.http.post<ApiResponse<null>>(
        `${environment.apiUrl}/senders/${senderId}/rate`,
        { rating, comment },
        { headers: this.getAuthHeaders() }
      );
    } catch (err) {
      return throwError(() => err);
    }
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