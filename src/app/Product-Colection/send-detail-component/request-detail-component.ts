import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil, finalize } from 'rxjs/operators';
import { ParcelService, ParcelRequest, AcceptedShipping, DriverTrip } from '../../services/Parcel.service';
import { SmsVerificationService } from '../../services/smsverifikation.service';
import { ChatModalImprovedComponent } from '../../chat/chat-modal-component/chat-modal-component';


type RequestStatus = 'pending' | 'accepted' | 'in-transit' | 'delivered';

interface UnifiedRequest {
  originalRequest: ParcelRequest | null;
  acceptedShipping: AcceptedShipping | null;
  driverTrip: DriverTrip | null;
  isPending: boolean;
  isAccepted: boolean;
  isInTransit: boolean;
  isDelivered: boolean;
}

@Component({
  selector: 'app-request-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, ChatModalImprovedComponent], 
  templateUrl: './request-detail-component.html',
  styleUrls: ['./request-detail-component.scss']
})
export class RequestDetailComponent implements OnInit, OnDestroy {
  isLoading = false;
  errorMessage = '';
  currentTab: 'original' | 'accepted' | 'trip' = 'original';
  isAuthenticated = false;
  statusOptions: RequestStatus[] = ['pending', 'accepted', 'in-transit', 'delivered'];

  // 💬 ჩატის მდგომარეობა
  isChatOpen = false;
  currentUserId = '';

  // ✅ NEW: ფოტოების Lightbox მდგომარეობა
  lightboxOpen = false;
  lightboxIndex = 0;

  // ✅ NEW: მიმდინარე request-ის id, pull-to-refresh-ს რომ იცოდეს რა ჩატვირთოს ხელახლა
  private currentRequestId: string | null = null;

  // 🚚 ნივთის წაღების მოთხოვნის მდგომარეობა
  isSendingPickupRequest = false;
  pickupRequestSent = false;

  unifiedRequest: UnifiedRequest = {
    originalRequest: null,
    acceptedShipping: null,
    driverTrip: null,
    isPending: false,
    isAccepted: false,
    isInTransit: false,
    isDelivered: false
  };

  private destroy$ = new Subject<void>();

  constructor(
    private route: ActivatedRoute,
    public router: Router,
    private parcelService: ParcelService,
    private smsService: SmsVerificationService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.isAuthenticated = this.smsService.isAuthenticated();

    if (this.isAuthenticated) {
      const user = this.smsService.getCurrentUser();
      this.currentUserId = user?._id || '';
    }

    this.route.params
      .pipe(takeUntil(this.destroy$))
      .subscribe(params => {
        const requestId = params['id'];

        if (requestId) {
          this.loadUnifiedRequest(requestId);
        } else {
          console.error('❌ requestId არ მოვიდა route-დან. params:', params);
          this.errorMessage = 'არასწორი ბმული — განცხადების ID ვერ მოიძებნა';
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * ✅ Pull-to-refresh handler.
   * იმეორებს იმავე request-ის ჩატვირთვას, რომელიც ამჟამად ეკრანზეა
   * (currentRequestId, რომელიც loadUnifiedRequest-ში ინახება).
   */
  onRefresh(done: () => void): void {
    if (!this.currentRequestId) {
      done();
      return;
    }

    this.parcelService.getParcelRequest(this.currentRequestId)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.cdr.detectChanges();
          done();
        })
      )
      .subscribe({
        next: (res) => {
          if (res.success && res.data) {
            this.unifiedRequest.originalRequest = res.data;
            this.updateRequestStatus(res.data.status);
          }
        },
        error: (err) => {
          console.error('❌ Refresh-ის შეცდომა:', err);
        }
      });
  }

  get recipientIdSafe(): string {
  const sender = this.unifiedRequest.originalRequest?.senderId as any;
  if (!sender) return '';
  
  const id = typeof sender === 'object' ? (sender._id || sender.id || '') : sender;
  return String(id).trim();
}

get isOwnRequest(): boolean {
  if (!this.unifiedRequest.originalRequest || !this.currentUserId) return false;

  const recipientId = this.recipientIdSafe.toLowerCase();
  const currentId = String(this.currentUserId).trim().toLowerCase();


  return recipientId === currentId && recipientId !== '';
}



  openChat(): void {

  if (!this.isAuthenticated) {
    alert('⚠️ შეტყობინების გასაგზავნად გთხოვთ დალოგინდით');
    this.router.navigate(['/login']);
    return;
  }

  if (this.isOwnRequest) {
    alert('⚠️ საკუთარ განცხადებაზე შეტყობინებას ვერ გააგზავნით');
    return;
  }

  this.isChatOpen = true;
}

  closeChat(): void {
    this.isChatOpen = false;
  }

  // ============================================================
  // 🚚 NEW: ნივთის წაღების მოთხოვნა
  // ============================================================

  requestPickup(): void {
    if (!this.isAuthenticated) {
      alert('⚠️ ნივთის წაღების მოთხოვნისთვის გთხოვთ დალოგინდით');
      this.router.navigate(['/login']);
      return;
    }

    if (this.isOwnRequest) {
      alert('⚠️ საკუთარი განცხადების წაღებას ვერ ითხოვთ');
      return;
    }

    const requestId = this.unifiedRequest.originalRequest?._id;
    if (!requestId) return;

    this.isSendingPickupRequest = true;
    this.cdr.detectChanges();

    this.parcelService.requestPickup(requestId)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.isSendingPickupRequest = false;
          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: (res) => {
          if (res.success) {
            this.pickupRequestSent = true;
            alert('✅ მოთხოვნა გაგზავნილია — გამგზავნმა უნდა დაადასტუროს პროფილიდან');
          } else {
            alert('❌ ' + (res.message || 'მოთხოვნის გაგზავნა ვერ მოხერხდა'));
          }
        },
        error: (err) => {
          console.error('❌ ნივთის წაღების მოთხოვნის შეცდომა:', err);
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
    const images = this.unifiedRequest.originalRequest?.images;
    if (!images || images.length === 0) return;
    this.lightboxIndex = (this.lightboxIndex + 1) % images.length;
  }

  prevImage(): void {
    const images = this.unifiedRequest.originalRequest?.images;
    if (!images || images.length === 0) return;
    this.lightboxIndex = (this.lightboxIndex - 1 + images.length) % images.length;
  }

  private loadUnifiedRequest(requestId: string): void {
    this.isLoading = true;
    this.errorMessage = '';
    this.currentRequestId = requestId; // ✅ ვინახავთ refresh-ისთვის

    this.parcelService.getParcelRequest(requestId)
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
            this.unifiedRequest.originalRequest = res.data;
            this.updateRequestStatus(res.data.status);

            const requestStatus = res.data.status || '';
            if (['accepted', 'in-transit', 'delivered'].includes(requestStatus)) {
              this.loadAcceptedShippingAndTrip(requestId);
            }
          } else {
            this.errorMessage = res.message || 'განცხადება ვერ მოიძებნა';
          }
        },
        error: (err) => {
          console.error('❌ განცხადების ჩატვირთვის შეცდომა:', err);

          if (err.status === 404) {
            this.errorMessage = 'ასეთი განცხადება არ არსებობს';
          } else if (err.status === 0) {
            this.errorMessage = 'სერვერთან კავშირი ვერ დამყარდა — გადაამოწმეთ ინტერნეტი ან სერვერი';
          } else {
            this.errorMessage = `განცხადების ჩატვირთვა ვერ ხერხდა (კოდი: ${err.status})`;
          }
        }
      });
  }

  private loadAcceptedShippingAndTrip(requestId: string): void {
  }

  updateStatus(newStatus: string): void {
    if (!this.isAuthenticated) {
      alert('⚠️ სტატუსის განახლებისთვის ჯერ დალოგინდით');
      this.router.navigate(['/login']);
      return;
    }

    const requestId = this.unifiedRequest.originalRequest?._id;
    if (!requestId) return;

    this.isLoading = true;

    this.parcelService.updateParcelStatus(requestId, newStatus)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.isLoading = false;
          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: (res) => {
          if (res.success) {
            this.unifiedRequest.originalRequest = res.data || null;
            this.updateRequestStatus(newStatus);
            alert('✅ სტატუსი წარმატებით განახლდა');
          } else {
            alert('❌ ' + (res.message || 'სტატუსის განახლება ვერ ხერხდა'));
          }
        },
        error: (err) => {
          alert('❌ სტატუსის განახლება ვერ ხერხდა');
          console.error('შეცდომა:', err);
        }
      });
  }

  republishRequest(): void {
    if (!this.isAuthenticated) {
      alert('⚠️ განცხადების გამოქვეყნებისთვის ჯერ დალოგინდით');
      this.router.navigate(['/login']);
      return;
    }

    const requestId = this.unifiedRequest.originalRequest?._id;
    if (!requestId) return;

    if (confirm('დარწმუნებული ხართ რომ გსურთ განცხადების თავიდან გამოქვეყნება?')) {
      this.isLoading = true;

      this.parcelService.republishRequest(requestId)
        .pipe(
          takeUntil(this.destroy$),
          finalize(() => {
            this.isLoading = false;
            this.cdr.detectChanges();
          })
        )
        .subscribe({
          next: (res) => {
            if (res.success) {
              alert('✅ განცხადება წარმატებით გამოქვეყნდა');
              this.loadUnifiedRequest(requestId);
            } else {
              alert('❌ ' + (res.message || 'განცხადების გამოქვეყნება ვერ ხერხდა'));
            }
          },
          error: (err) => {
            alert('❌ განცხადების გამოქვეყნება ვერ ხერხდა');
            console.error('შეცდომა:', err);
          }
        });
    }
  }

  viewDriverTrip(): void {
    if (this.unifiedRequest.driverTrip?._id) {
      this.router.navigate(['/trip', this.unifiedRequest.driverTrip._id]);
    }
  }

  goBack(): void {
    this.router.navigate(['/']);
  }

  private updateRequestStatus(status: string | undefined): void {
    this.unifiedRequest.isPending = status === 'pending';
    this.unifiedRequest.isAccepted = status === 'accepted';
    this.unifiedRequest.isInTransit = status === 'in-transit';
    this.unifiedRequest.isDelivered = status === 'delivered';
  }

  formatDate(dateString: string | undefined): string {
    if (!dateString) return '—';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('ka-GE', {
        year: 'numeric',
        month: 'long',
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

  getStatusLabel(status: string | undefined): string {
    const labels: { [key: string]: string } = {
      'pending': '⏳ მოლოდინი',
      'accepted': '✅ მიღებული',
      'in-transit': '🚚 გზაში',
      'delivered': '📍 ჩაბარებული'
    };
    return labels[status || ''] || status || '—';
  }

  getStatusColor(status: string | undefined): string {
    const colors: { [key: string]: string } = {
      'pending': '#f59e0b',
      'accepted': '#10b981',
      'in-transit': '#3b82f6',
      'delivered': '#8b5cf6'
    };
    return colors[status || ''] || '#6b7280';
  }

  getStatusIcon(status: string | undefined): string {
    const icons: { [key: string]: string } = {
      'pending': '⏳',
      'accepted': '✅',
      'in-transit': '🚚',
      'delivered': '📍'
    };
    return icons[status || ''] || '❓';
  }

  get originalRequest(): ParcelRequest | null {
    return this.unifiedRequest.originalRequest;
  }

  get acceptedShipping(): AcceptedShipping | null {
    return this.unifiedRequest.acceptedShipping;
  }

  get driverTrip(): DriverTrip | null {
    return this.unifiedRequest.driverTrip;
  }

  get isPending(): boolean {
    return this.unifiedRequest.isPending;
  }

  get isAccepted(): boolean {
    return this.unifiedRequest.isAccepted;
  }

  get isInTransit(): boolean {
    return this.unifiedRequest.isInTransit;
  }

  get isDelivered(): boolean {
    return this.unifiedRequest.isDelivered;
  }
}