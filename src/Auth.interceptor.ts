import { Injectable } from '@angular/core';
import {
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpInterceptor,
  HttpErrorResponse
} from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { Router } from '@angular/router';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  private publicUrls = [
    '/api/parcels/request/',
    '/api/parcels/recent-requests',
    '/api/parcels/driver/recent-trips'
  ];

  constructor(private router: Router) {}

  intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    const token = this.getAuthToken();
    const isPublic = this.publicUrls.some(url => request.url.includes(url));

    console.log('🔍 Interceptor: token-ის შემოწმება');
    console.log(`   Public: ${isPublic ? '✅' : '❌'}`);
    console.log(`   Token: ${token ? '✅ აქვს' : '❌ არ აქვს'}`);
    console.log(`   URL: ${request.url}`);

    if (!isPublic && token) {
      request = request.clone({
        setHeaders: {
          Authorization: `Bearer ${token}`
        }
      });
      console.log('✅ Authorization header დამატებული');
    } else if (!isPublic) {
      console.log('⚠️ Token არ იპოვნა localStorage-ში');
    }

    return next.handle(request).pipe(
      catchError((error: HttpErrorResponse) => {
        if (!isPublic && (error.status === 401 || error.status === 403)) {
          console.error(`❌ ${error.status} Unauthorized/Forbidden`);
          localStorage.removeItem('authToken');
          this.router.navigate(['/login']);
        }
        return throwError(() => error);
      })
    );
  }

  private getAuthToken(): string {
    return localStorage.getItem('authToken') || '';
  }
}