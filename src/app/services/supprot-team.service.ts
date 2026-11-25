import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../environment/environment';

export interface ContactInfo {
  phoneNumber: string;
  phoneDisplay: string;
  email: string;
}

export interface ProblemPayload {
  text: string;
  email: string;
  phone: string;
}

@Injectable({
  providedIn: 'root',
})
export class SupprotTeamService {
  private readonly http = inject(HttpClient);

  private readonly apiUrl = `${environment.apiUrl}/support/problem`;

  private readonly contact: ContactInfo = {
    phoneNumber: '+995555649476', // შეცვალეთ რეალურ ნომერზე
    phoneDisplay: '+995 555 64 94 76',
    email: 'Ggzavna.info@gmail.com',
  };

  // მხოლოდ ციფრები, "+"-ის გარეშე: 995555649476
  private get digits(): string {
    return this.contact.phoneNumber.replace(/\D/g, '');
  }

  getContact(): ContactInfo {
    return this.contact;
  }

  get viberLink(): string {
    return `viber://chat?number=%2B${this.digits}`;
  }

  get whatsappLink(): string {
    return `https://wa.me/${this.digits}`;
  }

  get telegramLink(): string {
    return `https://t.me/+${this.digits}`;
  }

  get telLink(): string {
    return `tel:+${this.digits}`;
  }

  get mailLink(): string {
    return `mailto:${this.contact.email}`;
  }

  /**
   * აგზავნის მომხმარებლის პრობლემას, იმეილს და ტელეფონს backend-ზე,
   * საიდანაც ის Gmail-ის საშუალებით მხარდაჭერის გუნდამდე მიდის.
   */
  sendProblem(payload: ProblemPayload): Observable<{ success: boolean; message: string }> {
    return this.http.post<{ success: boolean; message: string }>(this.apiUrl, payload);
  }
}