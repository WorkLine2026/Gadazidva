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
  userId?: string;        // 👈 დამატებულია ჩატისთვის და იდენტიფიკაციისთვის
  senderId?: string;      // 👈 დაამატეთ ეს სტრიქონი TS2339 შეცდომის გასასწორებლად
  senderEmail?: string;   // 👈 დამატებულია ელ.ფოსტაზე მიწერისთვის
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
  images?: string[];      // 👈 ატვირთული ფოტოების URL-ები (სერვერიდან დაბრუნებული)
  acceptedDriverId?: string; // 👈 მძღოლი, ვისაც მიენდო ნივთის წაღება
  acceptedOfferId?: string;  // 👈 დამტკიცებული PickupOffer-ის id
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
  images?: string[];      // 👈 ატვირთული მანქანის ფოტოების URL-ები (სერვერიდან დაბრუნებული)
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

// ============ 🚚 PICKUP OFFERS (ნივთის წაღების მოთხოვნები) ============

export interface PickupOfferPersonRef {
  _id: string;
  firstName: string;
  lastName: string;
  phone: string;
  carModel?: string;
  carPlate?: string;
  driverLicenseNumber?: string;
}

export interface PickupOffer {
  _id: string;
  parcelId: string | ParcelRequest;
  driverId: string | PickupOfferPersonRef;
  senderId: string | PickupOfferPersonRef;
  status: 'pending' | 'accepted' | 'rejected' | 'in-transit' | 'delivered' | 'cancelled';
  driverConfirmedComplete: boolean;
  senderConfirmedComplete: boolean;
  createdAt: string;
  updatedAt?: string;
  respondedAt?: string;
  completedAt?: string;
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

export interface OfferResponse extends ApiResponse<PickupOffer> {}

export interface OffersListResponse extends ApiResponse<PickupOffer[]> {
  offers?: PickupOffer[];
}

// ============ 📨 TRIP PICKUP REQUESTS (გამგზავნის მოთხოვნა კონკრეტულ მგზავრობაზე) ============

export interface TripPickupRequest {
  _id: string;
  tripId: string | DriverTrip;
  senderId: string | PickupOfferPersonRef;
  driverId: string | PickupOfferPersonRef;
  message?: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: string;
  respondedAt?: string;
}

export interface TripPickupRequestResponse extends ApiResponse<TripPickupRequest> {}

export interface TripPickupRequestsListResponse extends ApiResponse<TripPickupRequest[]> {
  requests?: TripPickupRequest[];
}

@Injectable({
  providedIn: 'root'
})
export class ParcelService {
  private apiUrl = `${environment.apiUrl}/parcels`;
  private driverUrl = `${environment.apiUrl}/parcels/driver`;

  private tripCreated$ = new Subject<DriverTrip>();

 readonly GEORGIAN_CITIES_AND_TOWNS = [
    // 1. მსხვილი ქალაქები და რეგიონული ცენტრები
    'თბილისი', 'ბათუმი', 'ქუთაისი', 'რუსთავი', 'გორი',
    'ზუგდიდი', 'ფოთი', 'ხაშური', 'სამტრედია', 'სენაკი',
    'ზესტაფონი', 'თელავი', 'ახალციხე', 'ქობულეთი', 'ოზურგეთი',

    // 2. შიდა ქართლი & ქვემო ქართლი
    'კასპი', 'მარნეული', 'გარდაბანი', 'ბოლნისი', 'დმანისი',
    'წალკა', 'თეთრიწყარო', 'ქარელი', 'სურამი', 'აგარა',
    'მცხეთა', 'თიანეთი', 'ჟინვალი', 'ფასანაური',

    // 3. იმერეთი & რაჭა-ლეჩხუმი-ქვემო სვანეთი
    'ტყიბული', 'წყალტუბო', 'ჭიათურა', 'საჩხერე', 'ხონი',
    'ბაღდათი', 'ვანი', 'თერჯოლა', 'ამბროლაური', 'ონი',
    'ცაგერი', 'ლენტეხი', 'კულაში',

    // 4. სამეგრელო-ზემო სვანეთი
    'ჯვარი', 'აბაშა', 'მარტვილი', 'წალენჯიხა', 'მესტია',
    'ჩხოროწყუ', 'ანაკლია',

    // 5. კახეთი
    'საგარეჯო', 'გურჯაანი', 'ყვარელი', 'სიღნაღი',
    'დედოფლისწყარო', 'ლაგოდეხი', 'ახმეტა',

    // 6. სამცხე-ჯავახეთი
    'ახალქალაქი', 'ნინოწმინდა', 'ბორჯომი', 'ვალე',
    'აბასთუმანი', 'ბაკურიანი', 'ადიგენი', 'ასპინძა',

    // 7. გურია & აჭარა
    'ლანჩხუთი', 'ჩოხატაური', 'ურეკი', 'ქედა',
    'შუახევი', 'ხულო', 'ჩაქვი', 'ხელვაჩაური',

    // 8. მცხეთა-მთიანეთი
    'დუშეთი', 'სტეფანწმინდა',

    // 9. აფხაზეთი & ცხინვალის რეგიონი
    'სოხუმი', 'გაგრა', 'გუდაუთა', 'ოჩამჩირე', 'გალი',
    'ტყვარჩელი', 'ახალი ათონი', 'ცხინვალი', 'ჯავა',
    'ქურთას დასახლება', 'ახალგორი', 'ბიჭვინთა', 'gulripshi'
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

    if (!token) {
      throw new Error('ავტორიზაცია საჭიროა');
    }

    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    });
  }

  /**
   * ✅ NEW: ავტორიზაციის header-ები FormData-სთვის (Content-Type არ ეწერება,
   * რომ ბრაუზერმა თავად დააყენოს multipart/form-data სწორი boundary-თი)
   */
  private getAuthHeadersForFormData(): HttpHeaders {
    const token = this.smsService.getAuthToken();

    if (!token) {
      throw new Error('ავტორიზაცია საჭიროა');
    }

    return new HttpHeaders({
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

  /**
   * ✅ UPDATED: ახლა ორივეს იღებს — ჩვეულებრივ ParcelRequest ობიექტს (JSON)
   * ან FormData-ს (როცა ფოტოებია ატვირთული). FormData-ს შემთხვევაში
   * Content-Type header არ ეწერება ხელით — ბრაუზერი თავად აყენებს.
   */
  createParcelRequest(data: ParcelRequest | FormData): Observable<TripResponse> {
    try {
      this.ensureAuthenticated();

      const isFormData = data instanceof FormData;
      const headers = isFormData ? this.getAuthHeadersForFormData() : this.getAuthHeaders();

      return this.http.post<TripResponse>(`${this.apiUrl}/request`, data, {
        headers
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

  /**
   * ✅ PROTECTED - მხოლოდ sender-ს შეუძლია საკუთარი განცხადების წაშლა
   */
  deleteParcelRequest(requestId: string): Observable<ApiResponse<null>> {
    try {
      this.ensureAuthenticated();
      return this.http.delete<ApiResponse<null>>(
        `${this.apiUrl}/request/${requestId}`,
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

  /**
   * ✅ UPDATED: ახლა ორივეს იღებს — ჩვეულებრივ DriverTrip ობიექტს (JSON)
   * ან FormData-ს (როცა მანქანის ფოტოებია ატვირთული).
   */
  createTrip(data: DriverTrip | FormData): Observable<TripResponse> {
    try {
      this.ensureAuthenticated();

      const isFormData = data instanceof FormData;
      const headers = isFormData ? this.getAuthHeadersForFormData() : this.getAuthHeaders();

      return this.http.post<TripResponse>(`${this.driverUrl}/create-trip`, data, {
        headers
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

  /**
   * ✅ PROTECTED - მხოლოდ driver-ს შეუძლია საკუთარი მგზავრობის წაშლა
   */
  deleteTrip(tripId: string): Observable<ApiResponse<null>> {
    try {
      this.ensureAuthenticated();
      return this.http.delete<ApiResponse<null>>(
        `${this.driverUrl}/${tripId}`,
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

  // ============ 🚚 PICKUP OFFERS (ნივთის წაღების მოთხოვნები) ============

  /**
   * მძღოლი ითხოვს კონკრეტული განცხადების (parcel) ნივთის წაღებას.
   * იქმნება PickupOffer სტატუსით 'pending' და გამგზავნისთვის ჩნდება
   * "შემოსული მოთხოვნების" სექციაში პროფილში.
   */
  requestPickup(parcelId: string): Observable<OfferResponse> {
    try {
      this.ensureAuthenticated();
      return this.http.post<OfferResponse>(
        `${this.apiUrl}/${parcelId}/pickup-offer`,
        {},
        { headers: this.getAuthHeaders() }
      );
    } catch (err) {
      return throwError(() => err);
    }
  }

  /**
   * გამგზავნის შემოსული (pending) მოთხოვნები — ვის სურს მისი ნივთის წაღება.
   */
  getIncomingOffers(): Observable<OffersListResponse> {
    try {
      this.ensureAuthenticated();
      return this.http.get<OffersListResponse>(
        `${this.apiUrl}/pickup-offers/incoming`,
        { headers: this.getAuthHeaders() }
      );
    } catch (err) {
      return throwError(() => err);
    }
  }

  /**
   * კონკრეტული შეთავაზების სრული დეტალები (მძღოლის/გამგზავნის მონაცემები).
   */
  getOfferDetails(offerId: string): Observable<OfferResponse> {
    try {
      this.ensureAuthenticated();
      return this.http.get<OfferResponse>(
        `${this.apiUrl}/pickup-offers/${offerId}`,
        { headers: this.getAuthHeaders() }
      );
    } catch (err) {
      return throwError(() => err);
    }
  }

  /**
   * გამგზავნის პასუხი მოთხოვნაზე — დათანხმება ან უარყოფა.
   * დათანხმებისას შეთავაზების სტატუსი 'in-transit'-ზე გადადის.
   */
  respondToOffer(offerId: string, accept: boolean): Observable<OfferResponse> {
    try {
      this.ensureAuthenticated();
      return this.http.put<OfferResponse>(
        `${this.apiUrl}/pickup-offers/${offerId}/respond`,
        { accept },
        { headers: this.getAuthHeaders() }
      );
    } catch (err) {
      return throwError(() => err);
    }
  }

  /**
   * მძღოლი აღნიშნავს, რომ მიწოდება დასრულებულია — მოლოდინშია გამგზავნის დადასტურება.
   */
  markPickupCompleteByDriver(offerId: string): Observable<OfferResponse> {
    try {
      this.ensureAuthenticated();
      return this.http.put<OfferResponse>(
        `${this.apiUrl}/pickup-offers/${offerId}/complete-by-driver`,
        {},
        { headers: this.getAuthHeaders() }
      );
    } catch (err) {
      return throwError(() => err);
    }
  }

  /**
   * გამგზავნი ადასტურებს მიწოდების დასრულებას — შეთავაზება ხდება 'delivered'.
   */
  confirmPickupCompleteBySender(offerId: string): Observable<OfferResponse> {
    try {
      this.ensureAuthenticated();
      return this.http.put<OfferResponse>(
        `${this.apiUrl}/pickup-offers/${offerId}/complete-by-sender`,
        {},
        { headers: this.getAuthHeaders() }
      );
    } catch (err) {
      return throwError(() => err);
    }
  }

  /**
   * მიმდინარე (accepted/in-transit) მიწოდებები — ორივე როლისთვის (სენდერი და დრაივერი).
   */
  getMyInProgressOffers(): Observable<OffersListResponse> {
    try {
      this.ensureAuthenticated();
      return this.http.get<OffersListResponse>(
        `${this.apiUrl}/pickup-offers/my-in-progress`,
        { headers: this.getAuthHeaders() }
      );
    } catch (err) {
      return throwError(() => err);
    }
  }

  /**
   * "ჩემი გაგზავნილი ნივთები" — გამგზავნის დასრულებული (delivered) მიწოდებები.
   */
  getMySentCompleted(): Observable<OffersListResponse> {
    try {
      this.ensureAuthenticated();
      return this.http.get<OffersListResponse>(
        `${this.apiUrl}/pickup-offers/my-sent-completed`,
        { headers: this.getAuthHeaders() }
      );
    } catch (err) {
      return throwError(() => err);
    }
  }

  /**
   * "ჩემი წაღებული ნივთები" — მძღოლის დასრულებული (delivered) მიწოდებები.
   */
  getMyPickedUpCompleted(): Observable<OffersListResponse> {
    try {
      this.ensureAuthenticated();
      return this.http.get<OffersListResponse>(
        `${this.apiUrl}/pickup-offers/my-picked-up-completed`,
        { headers: this.getAuthHeaders() }
      );
    } catch (err) {
      return throwError(() => err);
    }
  }

  // ============ 📨 TRIP PICKUP REQUESTS (გამგზავნის მოთხოვნა კონკრეტულ მგზავრობაზე) ============

  /**
   * გამგზავნი ითხოვს კონკრეტულ მგზავრობაზე (trip) თავისი ნივთის ჩატვირთვას.
   * იქმნება TripPickupRequest სტატუსით 'pending' და მძღოლს მიუვა
   * socket შეტყობინება ("📨 ნივთის შეკვეთის გაგზავნა" ღილაკიდან).
   */
  sendTripPickupRequest(tripId: string, message?: string): Observable<TripPickupRequestResponse> {
    try {
      this.ensureAuthenticated();
      return this.http.post<TripPickupRequestResponse>(
        `${this.driverUrl}/${tripId}/pickup-request`,
        { message },
        { headers: this.getAuthHeaders() }
      );
    } catch (err) {
      return throwError(() => err);
    }
  }

  /**
   * მძღოლის შემოსული (pending) მოთხოვნები — ვის სურს ამ მგზავრობით სარგებლობა.
   */
  getIncomingTripRequests(): Observable<TripPickupRequestsListResponse> {
    try {
      this.ensureAuthenticated();
      return this.http.get<TripPickupRequestsListResponse>(
        `${this.driverUrl}/pickup-requests/incoming`,
        { headers: this.getAuthHeaders() }
      );
    } catch (err) {
      return throwError(() => err);
    }
  }

  /**
   * მძღოლის პასუხი მოთხოვნაზე — დათანხმება ან უარყოფა.
   * ორივე შემთხვევაში გამგზავნს უკან მიუვა socket შეტყობინება.
   */
  respondToTripPickupRequest(requestId: string, accept: boolean): Observable<TripPickupRequestResponse> {
    try {
      this.ensureAuthenticated();
      return this.http.put<TripPickupRequestResponse>(
        `${this.driverUrl}/pickup-requests/${requestId}/respond`,
        { accept },
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
    return this.GEORGIAN_CITIES_AND_TOWNS.includes(from) && this.GEORGIAN_CITIES_AND_TOWNS.includes(to);
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


    getMyTripPickupRequests(): Observable<TripPickupRequestsListResponse> {
    try {
      this.ensureAuthenticated();
      return this.http.get<TripPickupRequestsListResponse>(
        `${this.driverUrl}/pickup-requests/my-sent`,
        { headers: this.getAuthHeaders() }
      );
    } catch (err) {
      return throwError(() => err);
    }
  }

    deleteMyTripPickupRequest(requestId: string): Observable<ApiResponse<null>> {
    try {
      this.ensureAuthenticated();
      return this.http.delete<ApiResponse<null>>(
        `${this.driverUrl}/pickup-requests/${requestId}`,
        { headers: this.getAuthHeaders() }
      );
    } catch (err) {
      return throwError(() => err);
    }
  }

  getMyOutgoingPickupOffers(): Observable<OffersListResponse> {
    try {
      this.ensureAuthenticated();
      return this.http.get<OffersListResponse>(
        `${this.apiUrl}/pickup-offers/my-sent`,
        { headers: this.getAuthHeaders() }
      );
    } catch (err) {
      return throwError(() => err);
    }
  }

  /**
   * ✅ NEW: უარყოფილი pickup-offer-ის წაშლა (მძღოლს ან სენდერს)
   */
  deletePickupOffer(offerId: string): Observable<ApiResponse<null>> {
    try {
      this.ensureAuthenticated();
      return this.http.delete<ApiResponse<null>>(
        `${this.apiUrl}/pickup-offers/${offerId}`,
        { headers: this.getAuthHeaders() }
      );
    } catch (err) {
      return throwError(() => err);
    }
  }


}