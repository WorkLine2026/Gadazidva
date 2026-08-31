import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-delete-account-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './delete-account-modal-component.html',
  styleUrls: ['./delete-account-modal-component.scss']
})
export class DeleteAccountModalComponent {
  /** მომხმარებლის ელფოსტა, რომლის ხელახლა შეყვანითაც დასტურდება წაშლა */
  @Input() userEmail = '';

  /** მშობელი კომპონენტიდან — request მიმდინარეობს თუ არა */
  @Input() isDeleting = false;

  /** სერვერიდან დაბრუნებული შეცდომა (თუ delete მოთხოვნამ ჩაიშალა) */
  @Input() errorMessage: string | null = null;

  /** დადასტურდა — მშობელმა უნდა გამოიძახოს რეალური deleteAccount() */
  @Output() confirmDelete = new EventEmitter<void>();

  /** მომხმარებელმა გააუქმა/დახურა მოდალი */
  @Output() cancelled = new EventEmitter<void>();

  step: 'warning' | 'confirmEmail' = 'warning';
  emailInput = '';
  private localError: string | null = null;

  get displayError(): string | null {
    return this.errorMessage || this.localError;
  }

  proceedToEmailConfirm(): void {
    this.step = 'confirmEmail';
    this.localError = null;
  }

  backToWarning(): void {
    this.step = 'warning';
    this.emailInput = '';
    this.localError = null;
  }

  onBackdropClick(): void {
    if (!this.isDeleting) {
      this.cancel();
    }
  }

  cancel(): void {
    this.step = 'warning';
    this.emailInput = '';
    this.localError = null;
    this.cancelled.emit();
  }

  submit(): void {
    if (this.isDeleting) return;

    if (this.emailInput.trim().toLowerCase() !== this.userEmail.trim().toLowerCase()) {
      this.localError = 'ელფოსტა არასწორია — სცადეთ თავიდან';
      return;
    }

    this.localError = null;
    this.confirmDelete.emit();
  }
}