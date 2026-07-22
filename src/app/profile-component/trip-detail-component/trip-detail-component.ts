import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil, finalize } from 'rxjs/operators';
import { ParcelService, DriverTrip } from '../../services/Parcel.service';
import { SmsVerificationService } from '../../services/smsverifikation.service';

@Component({
  selector: 'app-trip-detail',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './trip-detail-component.html',
  styleUrls: ['./trip-detail-component.scss']
})
export class TripDetailComponent implements OnInit, OnDestroy {
  isLoading = false;
  errorMessage = '';
  isAuthenticated = false;
  trip: DriverTrip | null = null;

  private destroy$ = new Subject<void>();
  public router: Router;

  constructor(
    private route: ActivatedRoute,
    router: Router,
    private parcelService: ParcelService,
    private smsService: SmsVerificationService,
    private cdr: ChangeDetectorRef
  ) {
    this.router = router;
  }

  ngOnInit(): void {
    this.isAuthenticated = this.smsService.isAuthenticated();

    this.route.params
      .pipe(takeUntil(this.destroy$))
      .subscribe(params => {
        console.log('🔍 Trip route params:', params);

        // ⚠️ თუ თქვენს routes ფაილში :id-ს ნაცვლად სხვა სახელია (მაგ. :tripId),
        // შესაბამისად შეცვალეთ params['id'] იმ სახელზე
        const tripId = params['id'];

        if (tripId) {
          this.loadTrip(tripId);
        } else {
          console.error('❌ tripId არ მოვიდა route-დან. params:', params);
          this.errorMessage = 'არასწორი ბმული — მგზავრობის ID ვერ მოიძებნა';
          this.cdr.detectChanges();
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadTrip(tripId: string): void {
    this.isLoading = true;
    this.errorMessage = '';
    this.cdr.detectChanges();

    this.parcelService.getTripDetails(tripId)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.isLoading = false;
          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: (res) => {
          console.log('📦 ტრიპის პასუხი backend-დან:', res);

          if (res.success && res.data) {
            this.trip = res.data;
          } else {
            this.errorMessage = res.message || 'მგზავრობა ვერ მოიძებნა';
          }
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('❌ მგზავრობის ჩატვირთვის შეცდომა:', err);

          if (err.status === 404) {
            this.errorMessage = 'ასეთი მგზავრობა არ არსებობს';
          } else if (err.status === 401) {
            this.errorMessage = 'მგზავრობის ნახვა შესაძლებელია მხოლოდ დალოგინების შემდეგ';
          } else if (err.status === 0) {
            this.errorMessage = 'სერვერთან კავშირი ვერ დამყარდა';
          } else {
            this.errorMessage = 'მგზავრობის ჩატვირთვა ვერ ხერხდა (კოდი: ' + err.status + ')';
          }
          this.cdr.detectChanges();
        }
      });
  }

  goBack(): void {
    this.router.navigate(['/']);
  }

  formatDateTime(dateString: string | undefined): string {
    if (!dateString) return '—';
    try {
      const date = new Date(dateString);
      const dateStr = date.toLocaleDateString('ka-GE', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
      const timeStr = date.toLocaleTimeString('ka-GE', {
        hour: '2-digit',
        minute: '2-digit'
      });
      return `${dateStr} - ${timeStr}`;
    } catch {
      return '—';
    }
  }

  getTripStatusLabel(status: string | undefined): string {
    const labels: { [key: string]: string } = {
      'pending': '⏳ დაგეგმილი',
      'active': '🚗 აქტიური',
      'completed': '✅ დასრულებული',
      'cancelled': '❌ გაუქმებული'
    };
    return labels[status || 'pending'] || status || '⏳ დაგეგმილი';
  }

  getStatusColor(status: string | undefined): string {
    const colors: { [key: string]: string } = {
      'pending': '#f59e0b',
      'active': '#10b981',
      'completed': '#3b82f6',
      'cancelled': '#ef4444'
    };
    return colors[status || ''] || '#6b7280';
  }

  getTripEarnings(trip: DriverTrip): string {
    if (!trip.acceptedShippings || trip.acceptedShippings.length === 0) {
      return '0 ₾';
    }
    const total = trip.acceptedShippings.reduce((sum, shipping) => {
      const weight = shipping.parcelDetails?.weight || 0;
      const price = trip.pricePerKg || 0;
      return sum + weight * price;
    }, 0);
    return `${total.toFixed(2)} ₾`;
  }
}