import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { environment } from '../environment/environment';
import { SmsVerificationService } from './smsverifikation.service';
import { Conversation } from './Socketnotification.service';

export interface ConversationsResponse {
  success: boolean;
  message?: string;
  conversations?: Conversation[];
}

@Injectable({
  providedIn: 'root'
})
export class ChatService {
  private apiUrl = `${environment.apiUrl}/chat`;

  constructor(
    private http: HttpClient,
    private smsService: SmsVerificationService
  ) {}

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

  getConversations(): Observable<ConversationsResponse> {
    try {
      return this.http.get<ConversationsResponse>(`${this.apiUrl}/conversations`, {
        headers: this.getAuthHeaders()
      });
    } catch (err) {
      return throwError(() => err);
    }
  }
}