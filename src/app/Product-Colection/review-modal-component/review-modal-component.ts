import { Component, EventEmitter, Input, Output, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ParcelService } from '../../services/Parcel.service';
import { StarRatingComponent } from '../star-rating-component/star-rating-component';

@Component({
  selector: 'app-review-modal',
  templateUrl: './review-modal-component.html',
  styleUrls: ['./review-modal-component.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, StarRatingComponent]
})
export class ReviewModalComponent {
  @Input() offerId = '';
  @Input() targetName = '';
  @Input() targetRole: 'driver' | 'sender' = 'driver';
  @Output() submitted = new EventEmitter<void>();
  @Output() closed = new EventEmitter<void>();

  rating = 0;
  comment = '';
  isSubmitting = false;
  error: string | null = null;

  readonly ratingLabels: { [key: number]: string } = {
    1: 'ცუდი',
    2: 'არასაკმარისი',
    3: 'საშუალო',
    4: 'კარგი',
    5: 'შესანიშნავი'
  };

  constructor(
    private parcelService: ParcelService,
    private cdr: ChangeDetectorRef
  ) {}

  get roleLabel(): string {
    return this.targetRole === 'driver' ? 'მძღოლი' : 'გამგზავნი';
  }

  submit(): void {
    if (!this.rating || this.isSubmitting) return;

    this.isSubmitting = true;
    this.error = null;
    this.cdr.detectChanges();

    this.parcelService
      .submitOfferReview(this.offerId, this.rating, this.comment.trim() || undefined)
      .subscribe({
        next: (res) => {
          this.isSubmitting = false;
          if (res.success) {
            this.submitted.emit();
          } else {
            this.error = res.message || 'შეფასება ვერ გაიგზავნა';
          }
          this.cdr.detectChanges();
        },
        error: (err) => {
          this.isSubmitting = false;
          this.error = err.error?.message || 'შეფასება ვერ გაიგზავნა';
          this.cdr.detectChanges();
        }
      });
  }

  close(): void {
    this.closed.emit();
  }
}