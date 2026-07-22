import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { ParcelService, ParcelRequest, DriverTrip } from '../services/Parcel.service';

interface Step {
  id: number;
  title: string;
  description: string;
}

interface Badge {
  icon: string;
  text: string;
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './home.html',
  styleUrls: ['./home.scss'],
})
export class HomeComponent implements OnInit, OnDestroy {
  // ============ Steps და Badges ============
  steps: Step[] = [
    {
      id: 1,
      title: 'დარეგისტრირდი',
      description: 'სწრაფი და უსაფრთხო ავტორიზაცია',
    },
    {
      id: 2,
      title: 'შეავსე ფორმა',
      description: 'მიუთითე მონაცემები სულ რამდენიმე წამში',
    },
    {
      id: 3,
      title: 'დაიწყე მგზავრობა',
      description: 'იპოვე სასურველი მძღოლი ან გაგზავნე ამანათი',
    },
  ];

  steps1: Step[] = [
    {
      id: 1,
      title: 'დარეგისტრირდი',
      description: 'სწრაფი და უსაფრთხო ავტორიზაცია',
    },
    {
      id: 2,
      title: 'შეავსე ფორმა',
      description: 'მიუთითე მონაცემები სულ რამდენიმე წამში',
    },
    {
      id: 3,
      title: 'და გააგზავნე ამანათი',
      description: 'იპოვე სასურველი მძღოლი ან გაგზავნე ამანათი',
    },
  ];

  badges: Badge[] = [
    {
      icon: '✓',
      text: '100% დაზღვეული ტრანზაქციები',
    },
    {
      icon: '🔒',
      text: 'შენი მონაცემები სრულად დაცულია',
    },
    {
      icon: '⚡',
      text: 'სწრაფი მიწოდების სერვისი',
    },
    {
      icon: '💳',
      text: 'გადახდის მოხერხებული მეთოდები',
    },
  ];

  // ============ განცხადებები და მგზავრობები ============
  recentRequests: ParcelRequest[] = [];
  recentTrips: DriverTrip[] = [];
  isLoadingRequests = false;
  isLoadingTrips = false;

  private destroy$ = new Subject<void>();

  constructor(
    private router: Router,
    private parcelService: ParcelService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadRecentRequests();
    this.loadRecentTrips();

    // ✅ ახალი განცხადებების რეალ-ტაიმ მოსმენა
    this.parcelService.tripCreated()
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        console.log('🔄 ახალი განცხადება დაემატა, რელოდ...');
        this.loadRecentRequests();
        this.loadRecentTrips();
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ============ გამგზავნის განცხადებების ჩაკრება (PUBLIC) ============
  private loadRecentRequests(): void {
    this.isLoadingRequests = true;
    this.cdr.detectChanges();

    // ✅ PUBLIC endpoint - auth არ სჭირდება
    this.parcelService.getRecentRequests().subscribe({
      next: (res: any) => {
        this.isLoadingRequests = false;

        if (res.success && res.requests) {
          // მხოლოდ 6 ბოლო განცხადება
          this.recentRequests = res.requests.slice(0, 6);
        } else {
          this.recentRequests = [];
        }

        this.cdr.detectChanges();
      },
      error: (err) => {
        this.isLoadingRequests = false;
        this.recentRequests = [];
        console.error('განცხადებების ჩაკრება ვერ ხერხდა:', err);
        this.cdr.detectChanges();
      }
    });
  }

  // ============ მძღოლის მგზავრობების ჩაკრება (PUBLIC) ============
  private loadRecentTrips(): void {
    this.isLoadingTrips = true;
    this.cdr.detectChanges();

    // ✅ PUBLIC endpoint - auth არ სჭირდება
    this.parcelService.getRecentTrips().subscribe({
      next: (res: any) => {
        this.isLoadingTrips = false;

        if (res.success && res.trips) {
          // მხოლოდ 6 ბოლო მგზავრობა
          this.recentTrips = res.trips.slice(0, 6);
        } else {
          this.recentTrips = [];
        }

        this.cdr.detectChanges();
      },
      error: (err) => {
        this.isLoadingTrips = false;
        this.recentTrips = [];
        console.error('მგზავრობების ჩაკრება ვერ ხერხდა:', err);
        this.cdr.detectChanges();
      }
    });
  }

  // ============ დეტალების ნახვა ============

  /**
   * გამგზავნის განცხადების დეტალებზე გადასვლა
   */
  viewRequest(requestId: string | undefined): void {
    if (!requestId) {
      console.error('❌ განცხადების ID არ გაითვალა');
      return;
    }
    this.router.navigate(['/request', requestId]);
  }

  /**
   * მძღოლის მგზავრობის დეტალებზე გადასვლა
   */
  viewTrip(tripId: string | undefined): void {
    if (!tripId) {
      console.error('❌ მგზავრობის ID არ გაითვალა');
      return;
    }
    this.router.navigate(['/trip', tripId]);
  }

  // ============ დამხმარე ფუნქციები ============
  formatDate(dateString: string | undefined): string {
    if (!dateString) return '—';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('ka-GE', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return '—';
    }
  }

  formatDateTime(dateString: string | undefined): string {
    if (!dateString) return '—';
    try {
      const date = new Date(dateString);
      return (
        date.toLocaleDateString('ka-GE') +
        ' ' +
        date.toLocaleTimeString('ka-GE', { hour: '2-digit', minute: '2-digit' })
      );
    } catch {
      return '—';
    }
  }

  getStatusLabel(status: string): string {
    const labels: { [key: string]: string } = {
      'pending': '⏳ მოლოდინი',
      'accepted': '✅ მიღებული',
      'in-transit': '🚚 გზაში',
      'delivered': '📍 დაბრუნებული'
    };
    return labels[status] || status;
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

  // ============ კარუსელის სქროლი ============
  scrollCarousel(track: HTMLElement, direction: 1 | -1): void {
    if (!track) return;

    const firstCard = track.querySelector(
      '.request-card-home, .trip-card-home'
    ) as HTMLElement | null;

    // fallback width თუ ბარათი ჯერ არ არის დარენდერებული
    const cardWidth = firstCard ? firstCard.offsetWidth + 24 : 300; // 24px = $spacing-xl gap

    track.scrollBy({ left: direction * cardWidth * 2, behavior: 'smooth' });
  }
}