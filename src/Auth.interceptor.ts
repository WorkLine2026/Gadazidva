import { Injectable } from '@angular/core';
import {
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpInterceptor
} from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  intercept(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    // ✅ Token წაკითხვა
    const token = localStorage.getItem('authToken');

    console.log('🔍 Interceptor ჰეი!');
    console.log('Token:', token ? '✅ აქვს' : '❌ არ აქვს');
    console.log('URL:', request.url);

    if (token) {
      // ✅ Header დამატება
      request = request.clone({
        setHeaders: {
          Authorization: `Bearer ${token}`
        }
      });
      console.log('✅ Authorization header დამატებული');
    } else {
      console.warn('⚠️ Token არ იპოვნა localStorage-ში!');
    }

    return next.handle(request);
  }
}