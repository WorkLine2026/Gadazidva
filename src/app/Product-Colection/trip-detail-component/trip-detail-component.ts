import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil, finalize } from 'rxjs/operators';
import { ParcelService, DriverTrip } from '../../services/Parcel.service';
import { SmsVerificationService } from '../../services/smsverifikation.service';
import { ChatModalImprovedComponent } from '../../chat/chat-modal-component/chat-modal-component';

@Component({
  selector: 'app-trip-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, ChatModalImprovedComponent],
  templateUrl: './trip-detail-component.html',
  styleUrls: ['./trip-detail-component.scss']
})
export class TripDetailComponent implements OnInit, OnDestroy {
  isLoading = false;
  errorMessage = '';
  isAuthenticated = false;
  trip: DriverTrip | null = null;

  // ✅ ჩატის მოდალის მართვა
  isChatOpen = false;
  currentUserId = '';

  // ✅ NEW: ფოტოების Lightbox მდგომარეობა
  lightboxOpen = false;
  lightboxIndex = 0;

  // ✅ NEW: ნივთის შეკვეთის გაგზავნის მდგომარეობა
  isSendingPickupRequest = false;
  pickupRequestSent = false;

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

    if (this.isAuthenticated) {
      const user = this.smsService.getCurrentUser();
      this.currentUserId = user?._id || '';
    }

    this.route.params
      .pipe(takeUntil(this.destroy$))
      .subscribe(params => {

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
    window.history.back();
  }

  get recipientIdSafe(): string {
    const driver = (this.trip as any)?.driverId;
    if (!driver) return '';

    const id = typeof driver === 'object' ? (driver._id || driver.id || '') : driver;
    return String(id).trim();
  }

  get isOwnTrip(): boolean {
    if (!this.trip || !this.currentUserId) return false;

    const recipientId = this.recipientIdSafe.toLowerCase();
    const currentId = String(this.currentUserId).trim().toLowerCase();

    return recipientId === currentId && recipientId !== '';
  }

  // ===== 💬 შეტყობინების მიწერა =====
  openChat(): void {

    if (!this.isAuthenticated) {
      alert('⚠️ შეტყობინების გასაგზავნად გთხოვთ დალოგინდით');
      this.router.navigate(['/login']);
      return;
    }

    if (this.isOwnTrip) {
      alert('⚠️ საკუთარ მგზავრობაზე შეტყობინებას ვერ გააგზავნით');
      return;
    }

    this.isChatOpen = true;
  }

  closeChat(): void {
    this.isChatOpen = false;
  }

  // ============================================================
  // ✅ NEW: ნივთის შეკვეთის გაგზავნა (trip pickup request)
  // ============================================================

  sendPickupRequest(): void {
    if (!this.trip || !this.trip._id) return;

    if (!this.isAuthenticated) {
      alert('⚠️ მოთხოვნის გასაგზავნად გთხოვთ დალოგინდით');
      this.router.navigate(['/login']);
      return;
    }

    if (this.isOwnTrip) {
      alert('⚠️ საკუთარ მგზავრობაზე მოთხოვნას ვერ გააგზავნით');
      return;
    }

    if (this.isSendingPickupRequest || this.pickupRequestSent) return;

    this.isSendingPickupRequest = true;
    this.cdr.detectChanges();

    this.parcelService.sendTripPickupRequest(this.trip._id)
      .pipe(finalize(() => {
        this.isSendingPickupRequest = false;
        this.cdr.detectChanges();
      }))
      .subscribe({
        next: (res) => {
          if (res.success) {
            this.pickupRequestSent = true;
            alert('✅ მოთხოვნა გაეგზავნა მძღოლს — პასუხს შეტყობინებებში მიიღებთ');
          } else {
            alert('❌ ' + (res.message || 'მოთხოვნის გაგზავნა ვერ მოხერხდა'));
          }
        },
        error: (err) => {
          if (err.status === 409) {
            // უკვე გაგზავნილია ადრე — backend შეიძლება ასე დააბრუნოს
            this.pickupRequestSent = true;
          }
          alert('❌ ' + (err.error?.message || 'მოთხოვნის გაგზავნა ვერ მოხერხდა'));
        }
      });
  }

  // ============================================================
  // ✅ NEW: ფოტოების Lightbox
  // ============================================================

  openLightbox(index: number): void {
    this.lightboxIndex = index;
    this.lightboxOpen = true;
  }

  closeLightbox(): void {
    this.lightboxOpen = false;
  }

  nextImage(): void {
    const images = this.trip?.images;
    if (!images || images.length === 0) return;
    this.lightboxIndex = (this.lightboxIndex + 1) % images.length;
  }

  prevImage(): void {
    const images = this.trip?.images;
    if (!images || images.length === 0) return;
    this.lightboxIndex = (this.lightboxIndex - 1 + images.length) % images.length;
  }

  // ===== 📧 იმეილის გაგზავნა =====
  sendEmail(): void {
    if (!this.trip || this.isOwnTrip) return;

    const email = (this.trip as any).driverEmail;
    if (!email) return;

    const subject = encodeURIComponent(`მგზავრობა: ${this.trip.from} → ${this.trip.to}`);
    const body = encodeURIComponent('გამარჯობა, დაინტერესებული ვარ თქვენი მგზავრობით...');
    window.location.href = `mailto:${email}?subject=${subject}&body=${body}`;
  }

  hasEmail(): boolean {
    return !!(this.trip as any)?.driverEmail;
  }

  // ===== 📞 დარეკვა =====
  call(): void {
    if (!this.trip || this.isOwnTrip) return;

    const phone = this.trip?.senderPhone || (this.trip as any)?.personalNumber;
    if (!phone) return;
    window.location.href = `tel:${phone}`;
  }

  hasPhone(): boolean {
    return !!(this.trip?.senderPhone || (this.trip as any)?.personalNumber);
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