import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject, Observable, throwError } from 'rxjs';
import { tap } from 'rxjs/operators';
import { environment } from '../environment/environment';

// ============ REGISTRATION ============
export interface SendCodeResponse {
  success: boolean;
  message: string;
  userId?: string;
  code?: string;
}

export interface VerifyCodeResponse {
  success: boolean;
  message: string;
  user?: UserProfile;
  token?: string;
}

// ============ PASSWORD RECOVERY ============
export interface SendPasswordCodeResponse {
  success: boolean;
  message: string;
  code?: string;
}

export interface VerifyPasswordCodeResponse {
  success: boolean;
  message: string;
  resetToken: string;
  expirationMinutes: number;
}

export interface ResetPasswordResponse {
  success: boolean;
  message: string;
}

// ============ LOGIN ============
export interface LoginResponse {
  success: boolean;
  message: string;
  user?: UserProfile;
  token?: string;
}

// ============ PROFILE ============
export interface UserProfile {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  personalNumber: string;
  role: 'sender' | 'driver';
  phoneVerified: boolean;
  carModel?: string;
  carPlate?: string;
  driverLicenseNumber?: string;
  createdAt?: string;
}

export interface GetProfileResponse {
  success: boolean;
  message?: string;
  user?: UserProfile;
}

export interface UpdateProfileResponse {
  success: boolean;
  message?: string;
  user?: UserProfile;
}

export interface DeleteAccountResponse {
  success: boolean;
  message?: string;
}

@Injectable({
  providedIn: 'root'
})
export class SmsVerificationService {
  // ✅ environment.apiUrl უკვე '/api' შეიცავს, ამიტომ მხოლოდ '/auth' დამატებული
  private apiUrl = `${environment.apiUrl}/auth`;
  private resetToken: string = '';
  private userPhone: string = '';
  private authToken: string = '';

  // ✅ რეაქტიული auth state — navbar-ი და სხვა კომპონენტები ამას მოუსმენენ
  private isLoggedInSubject = new BehaviorSubject<boolean>(false);
  public isLoggedIn$ = this.isLoggedInSubject.asObservable();

  private currentUserSubject = new BehaviorSubject<UserProfile | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  constructor(private http: HttpClient) {
    this.loadAuthToken();
  }

  // ======================== AUTH HEADERS ========================

  private getAuthHeaders(): HttpHeaders {
    return new HttpHeaders({
      Authorization: `Bearer ${this.authToken}`
    });
  }

  // ======================== LOGIN FLOW ========================

  login(email: string, password: string): Observable<LoginResponse> {
    if (!email || !password) {
      return throwError(() => 'ელფოსტა და პაროლი სავალდებულოა');
    }

    const payload = { email, password };
    return this.http.post<LoginResponse>(`${this.apiUrl}/login`, payload).pipe(
      tap(res => {
        if (res && res.token) {
          this.setAuthToken(res.token);
        }
        if (res && res.user) {
          this.setCurrentUser(res.user);
        }
      })
    );
  }

  setAuthToken(token: string): void {
    this.authToken = token;
    localStorage.setItem('authToken', token);
    this.isLoggedInSubject.next(true);
  }

  getAuthToken(): string {
    return this.authToken;
  }

  private loadAuthToken(): void {
    const token = localStorage.getItem('authToken');
    if (token) {
      this.authToken = token;
      this.isLoggedInSubject.next(true);
      // ✅ ტოკენი არსებობს — მოვძებნოთ მომხმარებლის მონაცემები (გვერდის განახლების შემდეგაც იმუშავებს)
      this.getProfile().subscribe({
        next: (res) => {
          if (res.success && res.user) {
            this.setCurrentUser(res.user);
          }
        },
        error: () => {
          // ტოკენი ვადაგასულია ან არასწორია
          this.clearAuthToken();
        }
      });
    }
  }

  clearAuthToken(): void {
    this.authToken = '';
    localStorage.removeItem('authToken');
    this.isLoggedInSubject.next(false);
    this.currentUserSubject.next(null);
  }

  isAuthenticated(): boolean {
    return !!this.authToken;
  }

  setCurrentUser(user: UserProfile): void {
    this.currentUserSubject.next(user);
  }

  getCurrentUser(): UserProfile | null {
    return this.currentUserSubject.value;
  }

  // ======================== REGISTRATION FLOW ========================

  sendRegistrationCode(formData: any): Observable<SendCodeResponse> {
    if (!formData || !formData.phone) {
      return throwError(() => 'ტელეფონის ნომერი სავალდებულოა');
    }

    const formattedPhone = `995${formData.phone}`;

    const payload = {
      firstName: formData.firstName || '',
      lastName: formData.lastName || '',
      personalNumber: formData.personalNumber || '',
      email: formData.email || '',
      phone: formattedPhone,
      password: formData.password || '',
      role: formData.role || 'sender',
      carModel: formData.carModel || null,
      carPlate: formData.carPlate || null,
      driverLicenseNumber: formData.driverLicenseNumber || null
    };

    return this.http.post<SendCodeResponse>(`${this.apiUrl}/register`, payload);
  }

  verifyRegistrationCode(phone: string, code: string): Observable<VerifyCodeResponse> {
    if (!phone || !code) {
      return throwError(() => 'ტელეფონი და კოდი სავალდებულოა');
    }

    const formattedPhone = phone.startsWith('995') ? phone : `995${phone}`;

    const payload = {
      phone: formattedPhone,
      code: code
    };

    return this.http.post<VerifyCodeResponse>(`${this.apiUrl}/verify-phone`, payload).pipe(
      tap(res => {
        if (res && res.token) {
          this.setAuthToken(res.token);
        }
        if (res && res.user) {
          this.setCurrentUser(res.user);
        }
      })
    );
  }

  // ======================== PASSWORD RECOVERY FLOW ========================

  sendPasswordRecoveryCode(phone: string): Observable<SendPasswordCodeResponse> {
    if (!phone) {
      return throwError(() => 'ტელეფონის ნომერი სავალდებულოა');
    }

    const formattedPhone = phone.startsWith('995') ? phone : `995${phone}`;
    this.userPhone = formattedPhone;

    const payload = { phone: formattedPhone };

    return this.http.post<SendPasswordCodeResponse>(
      `${this.apiUrl}/forgot-password/phone/send-code`,
      payload
    );
  }

  verifyPasswordRecoveryCode(phone: string, code: string): Observable<VerifyPasswordCodeResponse> {
    if (!phone || !code) {
      return throwError(() => 'ტელეფონი და კოდი სავალდებულოა');
    }

    const formattedPhone = phone.startsWith('995') ? phone : `995${phone}`;
    this.userPhone = formattedPhone;

    const payload = {
      phone: formattedPhone,
      code: code
    };

    return this.http.post<VerifyPasswordCodeResponse>(
      `${this.apiUrl}/forgot-password/phone/verify-code`,
      payload
    ).pipe(
      tap(res => {
        if (res && res.resetToken) {
          this.setResetToken(res.resetToken);
        }
      })
    );
  }

  resetPassword(phone: string, newPassword: string): Observable<ResetPasswordResponse> {
    if (!phone || !newPassword) {
      return throwError(() => 'ტელეფონი და პაროლი სავალდებულოა');
    }

    const formattedPhone = phone.startsWith('995') ? phone : `995${phone}`;

    const payload = {
      phone: formattedPhone,
      resetToken: this.resetToken,
      newPassword: newPassword
    };

    return this.http.post<ResetPasswordResponse>(
      `${this.apiUrl}/forgot-password/phone/reset-password`,
      payload
    );
  }

  // ======================== PROFILE FLOW ========================

  getProfile(): Observable<GetProfileResponse> {
    if (!this.authToken) {
      return throwError(() => 'ავტორიზაცია საჭიროა');
    }

    return this.http.get<GetProfileResponse>(`${this.apiUrl}/me`, {
      headers: this.getAuthHeaders()
    }).pipe(
      tap(res => {
        if (res.success && res.user) {
          this.setCurrentUser(res.user);
        }
      })
    );
  }

  updateProfile(data: Partial<UserProfile>): Observable<UpdateProfileResponse> {
    if (!this.authToken) {
      return throwError(() => 'ავტორიზაცია საჭიროა');
    }

    return this.http.put<UpdateProfileResponse>(`${this.apiUrl}/profile`, data, {
      headers: this.getAuthHeaders()
    }).pipe(
      tap(res => {
        if (res.success && res.user) {
          this.setCurrentUser(res.user);
        }
      })
    );
  }

  deleteAccount(): Observable<DeleteAccountResponse> {
    if (!this.authToken) {
      return throwError(() => 'ავტორიზაცია საჭიროა');
    }

    return this.http.delete<DeleteAccountResponse>(`${this.apiUrl}/me`, {
      headers: this.getAuthHeaders()
    });
  }

  // ======================== UTILITY METHODS ========================

  setResetToken(token: string): void {
    this.resetToken = token;
  }

  getResetToken(): string {
    return this.resetToken;
  }

  getUserPhone(): string {
    return this.userPhone;
  }

  clearState(): void {
    this.resetToken = '';
    this.userPhone = '';
  }

  storeRegistrationData(data: any): void {
    (window as any)._regData = data;
  }
}