import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-star-rating',
  templateUrl: './star-rating-component.html',
  styleUrls: ['./star-rating-component.scss'],
  standalone: true,
  imports: [CommonModule]
})
export class StarRatingComponent {
  @Input() value = 0;
  @Input() readonly = false;
  @Input() size: 'sm' | 'md' | 'lg' = 'lg';
  @Output() valueChange = new EventEmitter<number>();

  stars = [1, 2, 3, 4, 5];
  hover = 0;

  get displayValue(): number {
    return this.hover || Math.round(this.value);
  }

  select(star: number): void {
    if (this.readonly) return;
    this.value = star;
    this.valueChange.emit(star);
  }

  onEnter(star: number): void {
    if (!this.readonly) this.hover = star;
  }

  onLeave(): void {
    this.hover = 0;
  }
}