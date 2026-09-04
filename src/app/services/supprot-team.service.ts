import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

export interface ContactInfo {
  phoneNumber: string;
  phoneDisplay: string;
  email: string;
}

@Injectable({
  providedIn: 'root',
})
export class SupprotTeamService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = '/api/support/problem'; // საჭიროებისამებრ შეცვალეთ სრული backend URL-ით (მაგ. https://yourdomain.com/api/support/problem)

  private readonly contact: ContactInfo = {
    phoneNumber: '995500000000', // შეცვალეთ რეალურ ნომერზე (საერთაშორისო ფორმატით, +-ის გარეშე)
    phoneDisplay: '+995 500 00 00 00',
    email: 'work.1999line@gmail.com',
  };

  getContact(): ContactInfo {
    return this.contact;
  }

  get viberLink(): string {
    return `viber://chat?number=%2B${this.contact.phoneNumber}`;
  }

  get whatsappLink(): string {
    return `https://wa.me/${this.contact.phoneNumber}`;
  }

  get telegramLink(): string {
    return `https://t.me/${this.contact.phoneNumber}`;
  }

  get telLink(): string {
    return `tel:+${this.contact.phoneNumber}`;
  }

  get mailLink(): string {
    return `mailto:${this.contact.email}`;
  }

  /**
   * აგზავნის მომხმარებლის პრობლემას backend-ზე,
   * საიდანაც ის Gmail-ის საშუალებით მხარდაჭერის გუნდამდე მიდის.
   */
  sendProblem(text: string): Observable<{ success: boolean; message: string }> {
    return this.http.post<{ success: boolean; message: string }>(this.apiUrl, { text });
  }
}