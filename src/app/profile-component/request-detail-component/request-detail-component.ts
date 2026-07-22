import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil, finalize } from 'rxjs/operators';
import { ParcelService, ParcelRequest, AcceptedShipping, DriverTrip } from '../../services/Parcel.service';
import { SmsVerificationService } from '../../services/smsverifikation.service';

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
  imports: [CommonModule, FormsModule],
  templateUrl: './request-detail-component.html',
  styleUrls: ['./request-detail-component.scss']
})
export class RequestDetailComponent implements OnInit, OnDestroy {
  isLoading = false;
  errorMessage = '';
  currentTab: 'original' | 'accepted' | 'trip' = 'original';
  isAuthenticated = false;
  statusOptions: RequestStatus[] = ['pending', 'accepted', 'in-transit', 'delivered'];

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
  public router: Router;

  constructor(
    private route: ActivatedRoute,
    router: Router,
    private parcelService: ParcelService,
    private smsService: SmsVerificationService,
    private cdr: ChangeDetectorRef // ✅ დაემატა
  ) {
    this.router = router;
  }

  ngOnInit(): void {
    this.isAuthenticated = this.smsService.isAuthenticated();
    console.log('🔐 RequestDetailComponent - დალოგინება:', this.isAuthenticated);

    this.route.params
      .pipe(takeUntil(this.destroy$))
      .subscribe(params => {
        console.log('🔍 Route params:', params);

        const requestId = params['id'];

        if (requestId) {
          this.loadUnifiedRequest(requestId);
        } else {
          console.error('❌ requestId არ მოვიდა route-დან. params:', params);
          this.errorMessage = 'არასწორი ბმული — განცხადების ID ვერ მოიძებნა';
          this.cdr.detectChanges(); // ✅
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadUnifiedRequest(requestId: string): void {
    this.isLoading = true;
    this.errorMessage = '';
    this.cdr.detectChanges(); // ✅ spinner-ის ჩვენება დაუყოვნებლივ

    this.parcelService.getParcelRequest(requestId)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.isLoading = false;
          this.cdr.detectChanges(); // ✅ КРИТИЧНО: spinner-ის დამალვა
        })
      )
      .subscribe({
        next: (res) => {
          console.log('📦 პასუხი backend-დან:', res);

          if (res.success && res.data) {
            this.unifiedRequest.originalRequest = res.data;
            this.updateRequestStatus(res.data.status);

            if (
              res.data.status === 'accepted' ||
              res.data.status === 'in-transit' ||
              res.data.status === 'delivered'
            ) {
              this.loadAcceptedShippingAndTrip(requestId);
            }
          } else {
            this.errorMessage = res.message || 'განცხადება ვერ მოიძებნა';
          }

          this.cdr.detectChanges(); // ✅ template-ის განახლება
        },
        error: (err) => {
          console.error('❌ განცხადების ჩატვირთვის შეცდომა:', err);

          if (err.status === 404) {
            this.errorMessage = 'ასეთი განცხადება არ არსებობს';
          } else if (err.status === 0) {
            this.errorMessage = 'სერვერთან კავშირი ვერ დამყარდა — გადაამოწმეთ ინტერნეტი ან სერვერი';
          } else {
            this.errorMessage = 'განცხადების ჩატვირთვა ვერ ხერხდა (კოდი: ' + err.status + ')';
          }

          this.cdr.detectChanges(); // ✅
        }
      });
  }

  private loadAcceptedShippingAndTrip(requestId: string): void {
    console.log('🔄 მიღებული შეკვეთის მონაცემი...');
    // TODO: აქ უნდა დაემატოს რეალური API call driverTrip-ის ჩასატვირთად
  }

  updateStatus(newStatus: string): void {
    if (!this.isAuthenticated) {
      alert('⚠️ სტატუსის განახლებისთვის ჯერ დალოგინდით');
      this.router.navigate(['/login']);
      return;
    }

    if (!this.unifiedRequest.originalRequest?._id) return;

    this.isLoading = true;
    this.cdr.detectChanges(); // ✅

    this.parcelService.updateParcelStatus(
      this.unifiedRequest.originalRequest._id,
      newStatus
    )
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.isLoading = false;
          this.cdr.detectChanges(); // ✅
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
          this.cdr.detectChanges(); // ✅
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

    if (!this.unifiedRequest.originalRequest?._id) return;

    if (confirm('დარწმუნებული ხართ რომ გამოქვეყნეთ მას თავიდან?')) {
      this.isLoading = true;
      this.cdr.detectChanges(); // ✅

      this.parcelService.republishRequest(this.unifiedRequest.originalRequest._id)
        .pipe(
          takeUntil(this.destroy$),
          finalize(() => {
            this.isLoading = false;
            this.cdr.detectChanges(); // ✅
          })
        )
        .subscribe({
          next: (res) => {
            if (res.success) {
              alert('✅ განცხადება წარმატებით გამოქვეყნდა');
              this.loadUnifiedRequest(this.unifiedRequest.originalRequest!._id!);
            } else {
              alert('❌ ' + (res.message || 'განცხადების გამოქვეყნება ვერ ხერხდა'));
            }
            this.cdr.detectChanges(); // ✅
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
      'delivered': '📍 დაბრუნებული'
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