import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SupprotTeamService } from '../../services/supprot-team.service';

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
  readonly isSending = signal(false);
  readonly statusMessage = signal<string | null>(null);
  readonly isError = signal(false);

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
    const text = this.problemText().trim();
    if (!text) {
      return;
    }

    this.isSending.set(true);
    this.statusMessage.set(null);
    this.isError.set(false);

    this.supprotTeamService.sendProblem(text).subscribe({
      next: () => {
        this.problemText.set('');
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