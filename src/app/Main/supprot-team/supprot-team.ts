import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SupprotTeamService } from '../../services/supprot-team.service';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// მიიღებს: 555649476, 555 64 94 76, +995555649476, 995 555 64 94 76
const PHONE_REGEX = /^(\+?995)?\d{9}$/;

@Component({
  imports: [FormsModule],
  selector: 'app-supprot-team',
  styleUrl: './supprot-team.scss',
  templateUrl: './supprot-team.html',
})
export class SupprotTeam {
  private readonly supprotTeamService = inject(SupprotTeamService);

  readonly contact = this.supprotTeamService.getContact();

  readonly problemText = signal('');
  readonly email = signal('');
  readonly phone = signal('');

  readonly isSending = signal(false);
  readonly statusMessage = signal<string | null>(null);
  readonly isError = signal(false);

  readonly isEmailValid = computed(() => EMAIL_REGEX.test(this.email().trim()));

  readonly isPhoneValid = computed(() =>
    PHONE_REGEX.test(this.phone().replace(/[\s\-()]/g, '')),
  );

  readonly canSubmit = computed(
    () =>
      !!this.problemText().trim() &&
      this.isEmailValid() &&
      this.isPhoneValid() &&
      !this.isSending(),
  );

  get viberLink(): string {
    return this.supprotTeamService.viberLink;
  }

  get whatsappLink(): string {
    return this.supprotTeamService.whatsappLink;
  }

  get telegramLink(): string {
    return this.supprotTeamService.telegramLink;
  }

  get telLink(): string {
    return this.supprotTeamService.telLink;
  }

  get mailLink(): string {
    return this.supprotTeamService.mailLink;
  }

  sendProblem(): void {
    if (!this.canSubmit()) {
      return;
    }

    this.isSending.set(true);
    this.statusMessage.set(null);
    this.isError.set(false);

    this.supprotTeamService
      .sendProblem({
        text: this.problemText().trim(),
        email: this.email().trim(),
        phone: this.phone().trim(),
      })
      .subscribe({
        next: () => {
          this.problemText.set('');
          this.email.set('');
          this.phone.set('');
          this.statusMessage.set('შეტყობინება წარმატებით გაიგზავნა ✅');
          this.isError.set(false);
          this.isSending.set(false);
        },
        error: () => {
          this.statusMessage.set('შეტყობინების გაგზავნა ვერ მოხერხდა ❌ სცადეთ თავიდან');
          this.isError.set(true);
          this.isSending.set(false);
        },
      });
  }
}