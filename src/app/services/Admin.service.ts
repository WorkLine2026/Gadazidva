import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../environment/environment';
import { SmsVerificationService, UserProfile } from './smsverifikation.service';
import { ParcelRequest, DriverTrip, PickupOffer, TripPickupRequest } from './Parcel.service';

export interface AdminUser extends UserProfile {
  isBanned?: boolean;
  bannedReason?: string;
}

export interface PagedResponse<T> {
  success: boolean;
  data: T[];
  total: number;
  page: number;
  pages: number;
  message?: string;
}

export type StatusCounts = Record<string, number>;

export interface AdminStats {
  users: { total: number; senders: number; drivers: number; admins: number; blocked: number; newLast7Days: number };
  requests: { total: number; byStatus: StatusCounts; newLast7Days: number; totalValue: number };
  trips: { total: number; byStatus: StatusCounts; newLast7Days: number };
  offers: { total: number; byStatus: StatusCounts };
  tripRequests: { total: number; byStatus: StatusCounts };
  recent: { requests: ParcelRequest[]; trips: DriverTrip[]; users: AdminUser[] };
}

export interface AdminUserDetails {
  success: boolean;
  user: AdminUser;
  requests: ParcelRequest[];
  trips: DriverTrip[];
  offers: { asDriver: number; asSender: number };
}

export interface SimpleResponse {
  success: boolean;
  message?: string;
}

@Injectable({ providedIn: 'root' })
export class AdminService {
  private apiUrl = `${environment.apiUrl}/admin`;

  constructor(private http: HttpClient, private sms: SmsVerificationService) {}

  private get headers(): HttpHeaders {
    return new HttpHeaders({ Authorization: `Bearer ${this.sms.getAuthToken()}` });
  }

  private toParams(p: Record<string, any>): HttpParams {
    let params = new HttpParams();
    Object.entries(p).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '' && v !== 'all') params = params.set(k, String(v));
    });
    return params;
  }

  /**
   * backend აბრუნებს: { success, <key>: [...], pagination: { total, page, totalPages } }
   * აქ ვაქცევთ ერთიან PagedResponse-ად, რომ კომპონენტებს არ უნდა აინტერესებდეთ key-ის სახელი.
   */
  private list<T>(path: string, key: string, p: Record<string, any>): Observable<PagedResponse<T>> {
    return this.http
      .get<any>(`${this.apiUrl}/${path}`, { headers: this.headers, params: this.toParams(p) })
      .pipe(
        map((res) => ({
          success: res.success,
          data: (res[key] || []) as T[],
          total: res.pagination?.total ?? 0,
          page: res.pagination?.page ?? 1,
          pages: res.pagination?.totalPages ?? 1,
          message: res.message
        }))
      );
  }

  // ---------- Stats ----------
  getStats(): Observable<{ success: boolean; stats: AdminStats }> {
    return this.http.get<{ success: boolean; stats: AdminStats }>(`${this.apiUrl}/stats`, { headers: this.headers });
  }

  // ---------- Users ----------
  getUsers(p: { page?: number; limit?: number; search?: string; role?: string }) {
    return this.list<AdminUser>('users', 'users', p);
  }
  getUserDetails(id: string): Observable<AdminUserDetails> {
    return this.http.get<AdminUserDetails>(`${this.apiUrl}/users/${id}`, { headers: this.headers });
  }
  setUserRole(id: string, role: string): Observable<SimpleResponse> {
    return this.http.put<SimpleResponse>(`${this.apiUrl}/users/${id}/role`, { role }, { headers: this.headers });
  }
  setUserBanned(id: string, banned: boolean, reason?: string): Observable<SimpleResponse> {
    return this.http.put<SimpleResponse>(`${this.apiUrl}/users/${id}/ban`, { banned, reason }, { headers: this.headers });
  }
  deleteUser(id: string): Observable<SimpleResponse> {
    return this.http.delete<SimpleResponse>(`${this.apiUrl}/users/${id}`, { headers: this.headers });
  }

  // ---------- Parcel requests ----------
  getRequests(p: { page?: number; limit?: number; search?: string; status?: string }) {
    return this.list<ParcelRequest>('requests', 'requests', p);
  }
  setRequestStatus(id: string, status: string): Observable<SimpleResponse> {
    return this.http.put<SimpleResponse>(`${this.apiUrl}/requests/${id}/status`, { status }, { headers: this.headers });
  }
  deleteRequest(id: string): Observable<SimpleResponse> {
    return this.http.delete<SimpleResponse>(`${this.apiUrl}/requests/${id}`, { headers: this.headers });
  }

  // ---------- Trips ----------
  getTrips(p: { page?: number; limit?: number; search?: string; status?: string }) {
    return this.list<DriverTrip>('trips', 'trips', p);
  }
  setTripStatus(id: string, status: string): Observable<SimpleResponse> {
    return this.http.put<SimpleResponse>(`${this.apiUrl}/trips/${id}/status`, { status }, { headers: this.headers });
  }
  deleteTrip(id: string): Observable<SimpleResponse> {
    return this.http.delete<SimpleResponse>(`${this.apiUrl}/trips/${id}`, { headers: this.headers });
  }

  // ---------- Offers ----------
  getOffers(p: { page?: number; limit?: number; status?: string }) {
    return this.list<PickupOffer>('offers', 'offers', p);
  }
  deleteOffer(id: string): Observable<SimpleResponse> {
    return this.http.delete<SimpleResponse>(`${this.apiUrl}/offers/${id}`, { headers: this.headers });
  }
  getTripRequests(p: { page?: number; limit?: number; status?: string }) {
    return this.list<TripPickupRequest>('trip-requests', 'tripRequests', p);
  }
  deleteTripRequest(id: string): Observable<SimpleResponse> {
    return this.http.delete<SimpleResponse>(`${this.apiUrl}/trip-requests/${id}`, { headers: this.headers });
  }
}