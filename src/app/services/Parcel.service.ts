import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

// ===== INTERFACES =====

export interface DriverTrip {
  from: string;
  to: string;
  departureDate: string; // ISO DateTime "2024-07-15T14:30"
  availableSpace: number; // kg
  pricePerKg: number;
  carModel?: string;
  carPlate?: string;
  comments?: string;
}

export interface AvailableShipping {
  _id: string;
  parcelDetails: {
    from: string;
    to: string;
    description: string;
    weight: number;
    value: number;
    shipDate?: string;
  };
  senderName: string;
  senderPhone: string;
  senderEmail?: string;
  status: string; // 'pending', 'accepted', 'delivered'
  createdAt: string;
}

export interface CreateTripResponse {
  success: boolean;
  tripId?: string;
  message?: string;
}

export interface GetAvailableShippingsResponse {
  success: boolean;
  shippings?: AvailableShipping[];
  message?: string;
}

export interface AcceptShippingResponse {
  success: boolean;
  shippingId?: string;
  message?: string;
}

export interface ParcelRequest {
  from: string;
  to: string;
  shipDate: string;
  description: string;
  weight: number;
  value: number;
  notes?: string;
  senderPhone: string;
  recipientPhone: string;
}

export interface CreateRequestResponse {
  success: boolean;
  requestId?: string;
  message?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ParcelService {

  getUserRequests(): Observable<any> {
  const token = localStorage.getItem('authToken');
  return this.http
    .get<any>(
      `${this.apiUrl}/parcels/my-requests`,
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    )
    .pipe(catchError(this.handleError));
    throw new Error('Method not implemented.');
}
 
  private apiUrl = 'http://localhost:3000/api';

  constructor(private http: HttpClient) {}

  // ========================================
  // ===== SENDER (გაგზავნის განცხადება) =====
  // ========================================

  /**
   * მხოლოდ განცხადების დადება - ფული ამოჭრის გარეშე
   * @param request - გაგზავნის განცხადება
   * @returns Observable<CreateRequestResponse>
   */
  createParcelRequest(
    request: ParcelRequest
  ): Observable<CreateRequestResponse> {
    const payload = {
      from: request.from,
      to: request.to,
      shipDate: request.shipDate,
      description: request.description,
      weight: request.weight,
      value: request.value,
      notes: request.notes || '',
      senderPhone: request.senderPhone,
      recipientPhone: request.recipientPhone,
      status: 'pending',
      createdAt: new Date().toISOString()
    };

    return this.http
      .post<CreateRequestResponse>(
        `${this.apiUrl}/parcels/request`,
        payload
      )
      .pipe(catchError(this.handleError));
  }

  // ========================================
  // ===== DRIVER (ტრიპი და გაგზავნები) =====
  // ========================================

  /**
   * ტრიპის შექმნა
   * @param trip - მძღოლის ტრიპი
   * @returns Observable<CreateTripResponse>
   */
  createTrip(trip: DriverTrip): Observable<CreateTripResponse> {
    const payload = {
      from: trip.from,
      to: trip.to,
      departureDate: trip.departureDate,
      availableSpace: trip.availableSpace,
      pricePerKg: trip.pricePerKg,
      carModel: trip.carModel || '',
      carPlate: trip.carPlate || '',
      comments: trip.comments || '',
      status: 'active'
    };

    return this.http
      .post<CreateTripResponse>(`${this.apiUrl}/driver/create-trip`, payload)
      .pipe(catchError(this.handleError));
  }

  /**
   * ხელმისაწვდომი გაგზავნების მიღება
   * @param from - საიდან ქალაქი
   * @param to - სად ქალაქი
   * @param departureDate - გამგზავნის თარიღი
   * @returns Observable<GetAvailableShippingsResponse>
   */
  getAvailableShippings(
    from: string,
    to: string,
    departureDate: string
  ): Observable<GetAvailableShippingsResponse> {
    return this.http
      .get<GetAvailableShippingsResponse>(
        `${this.apiUrl}/driver/available-shippings?from=${from}&to=${to}&departureDate=${departureDate}`
      )
      .pipe(catchError(this.handleError));
  }

  /**
   * გაგზავნის მიღება/დამტკიცება
   * @param shippingId - გაგზავნის ID
   * @returns Observable<AcceptShippingResponse>
   */
  acceptShipping(shippingId: string): Observable<AcceptShippingResponse> {
    return this.http
      .post<AcceptShippingResponse>(
        `${this.apiUrl}/driver/accept-shipping/${shippingId}`,
        {}
      )
      .pipe(catchError(this.handleError));
  }

  // ========================================
  // ===== VALIDATION METHODS =====
  // ========================================

  /**
   * მარშრუტის ვალიდაცია
   * @param from - საიდან
   * @param to - სად
   * @returns true თუ ვალიდი
   */
  isValidRoute(from: string, to: string): boolean {
    if (!from || !to) return false;
    if (from === to) return false;
    return true;
  }

  /**
   * წონის ვალიდაცია
   * @param weight - წონა კგ-ში
   * @returns true თუ ვალიდი
   */
  isValidWeight(weight: number): boolean {
    return weight >= 0.1 && weight <= 300;
  }

  /**
   * ღირებულების ვალიდაცია
   * @param value - ღირებულება
   * @returns true თუ ვალიდი
   */
  isValidValue(value: number): boolean {
    return value >= 1 && value <= 1000000;
  }

  /**
   * ტელეფონის ვალიდაცია (ქართული ფორმატი)
   * @param phone - ტელეფონი
   * @returns true თუ ვალიდი
   */
  isValidPhone(phone: string): boolean {
    const georgianPhoneRegex = /^(\+995|0)(5\d{8}|\d{9})$/;
    return georgianPhoneRegex.test(phone);
  }

  /**
   * თარიღის ვალიდაცია
   * @param shipDate - გაგზავნის თარიღი
   * @returns true თუ ვალიდი
   */
  isValidShipDate(shipDate: string): boolean {
    const selectedDate = new Date(shipDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return selectedDate >= today;
  }

  // ========================================
  // ===== UTILITY METHODS =====
  // ========================================

  /**
   * ფასის ფორმატირება ქართული ლარით
   * @param price - ფასი ნომრად
   * @returns ფორმატირებული ფასი (მაგ. "125.50 ₾")
   */
  formatPrice(price: number): string {
    if (!price) return '—';
    return `${price.toFixed(2)} ₾`;
  }

  /**
   * თარიღის ფორმატირება ქართული ფორმატით
   * @param dateString - თარიღი string-ად
   * @returns ფორმატირებული თარიღი
   */
  formatDate(dateString: string): string {
    if (!dateString) return '—';
    const date = new Date(dateString);
    return date.toLocaleDateString('ka-GE', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  // ========================================
  // ===== ERROR HANDLING =====
  // ========================================

  /**
   * შეცდომების დამუშავება
   * @param error - HttpErrorResponse
   * @returns Observable throwError
   */
  private handleError(error: HttpErrorResponse) {
    let errorMessage = 'შეცდომა: სერვერთან კავშირი ვერ შედგა';

    if (error.error instanceof ErrorEvent) {
      errorMessage = `შეცდომა: ${error.error.message}`;
    } else {
      errorMessage = error.error?.message || `შეცდომა: ${error.status}`;
    }

    console.error('API Error:', errorMessage);
    return throwError(() => ({
      error: { message: errorMessage },
      status: error.status
    }));
  }
}