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
    // ადმინ-ლოგინი: არც token ემატება, არც 401-ზე გადამისამართება
    if (request.url.includes('/admin/login')) {
      return next.handle(request);
    }

    const token = this.getAuthToken();
    const isPublic = this.publicUrls.some(url => request.url.includes(url));
    const isAdminCall = request.url.includes('/api/admin');

    if (!isPublic && token) {
      request = request.clone({
        setHeaders: {
          Authorization: `Bearer ${token}`
        }
      });
    }

    return next.handle(request).pipe(
      catchError((error: HttpErrorResponse) => {
        if (!isPublic && (error.status === 401 || error.status === 403)) {
          console.error(`❌ ${error.status} Unauthorized/Forbidden`);
          localStorage.removeItem('authToken');
          this.router.navigate([isAdminCall ? '/admin/login' : '/login']);
        }
        return throwError(() => error);
      })
    );
  }

  private getAuthToken(): string {
    return localStorage.getItem('authToken') || '';
  }
}