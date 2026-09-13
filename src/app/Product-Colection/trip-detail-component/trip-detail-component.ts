import {
  Component, OnInit, OnDestroy, ChangeDetectorRef,
  ViewChild, TemplateRef, ViewContainerRef, EmbeddedViewRef,
  Renderer2, PLATFORM_ID, Inject
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil, finalize } from 'rxjs/operators';
import { ParcelService, DriverTrip } from '../../services/Parcel.service';
import { SmsVerificationService } from '../../services/smsverifikation.service';
import { ChatModalImprovedComponent } from '../../chat/chat-modal-component/chat-modal-component';
import { SeoService } from '../../services/seo.service'; // ⬅️ SEO — დააზუსტე გზა

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

  isChatOpen = false;
  currentUserId = '';

  lightboxOpen = false;
  lightboxIndex = 0;

  isSendingPickupRequest = false;
  pickupRequestSent = false;

  @ViewChild('chatPortal') chatPortalTemplate!: TemplateRef<any>;
  private chatPortalView: EmbeddedViewRef<any> | null = null;
  private viewportResizeHandler = () => this.updateChatViewportHeight();

  private isBrowser: boolean;

  private destroy$ = new Subject<void>();
  public router: Router;

  constructor(
    private route: ActivatedRoute,
    router: Router,
    private parcelService: ParcelService,
    private smsService: SmsVerificationService,
    private cdr: ChangeDetectorRef,
    private vcRef: ViewContainerRef,
    private renderer: Renderer2,
    private seo: SeoService, // ⬅️ SEO
    @Inject(PLATFORM_ID) platformId: Object
  ) {
    this.router = router;
    this.isBrowser = isPlatformBrowser(platformId);
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
          this.seo.update({ // ⬅️ SEO
            title: 'გვერდი ვერ მოიძებნა | გგზავნა',
            description: 'მოთხოვნილი გვერდი არ არსებობს ან წაშლილია.',
            noindex: true
          });
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.unmountChatFromBody();

    if (!this.isBrowser) {
      return;
    }

    if (window.visualViewport) {
      window.visualViewport.removeEventListener('resize', this.viewportResizeHandler);
      window.visualViewport.removeEventListener('scroll', this.viewportResizeHandler);
    }
    document.body.style.overflow = '';
    document.body.style.position = '';
    document.body.style.width = '';
    document.body.style.top = '';
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
            this.setSeoForTrip(res.data); // ⬅️ SEO — მონაცემი ჩამოსულია
          } else {
            this.errorMessage = res.message || 'მგზავრობა ვერ მოიძებნა';
            this.seo.update({ // ⬅️ SEO
              title: 'მგზავრობა ვერ მოიძებნა | გგზავნა',
              description: 'მოთხოვნილი მგზავრობა არ არსებობს ან წაშლილია.',
              noindex: true
            });
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

          this.seo.update({ // ⬅️ SEO
            title: 'გვერდი ვერ მოიძებნა | გგზავნა',
            description: 'მოთხოვნილი გვერდი ამჟამად მიუწვდომელია.',
            noindex: true
          });

          this.cdr.detectChanges();
        }
      });
  }

  // ⬅️ SEO — ახალი მეთოდი: აყენებს title/description/OG/JSON-LD მარშრუტის მიხედვით
  private setSeoForTrip(trip: DriverTrip): void {
    const from = trip.from || '';
    const to = trip.to || '';
    const pricePerKg = trip.pricePerKg ?? '';
    const availableSpace = trip.availableSpace ?? '';
    const url = `https://ggzavna.ge/trip/${trip._id}`;

    const title = `მგზავრობა ${from}-დან ${to}-ში — ტვირთის გადაზიდვა | გგზავნა`;
    const description =
      `მძღოლი მიემგზავრება ${from}-დან ${to}-ში და იღებს ამანათებს. ` +
      `თავისუფალი ადგილი: ${availableSpace} კგ, ფასი: ${pricePerKg} ₾/კგ.`;

    this.seo.update({
      title,
      description,
      url,
      image: trip.images?.[0],
      type: 'article'
    });

    this.seo.setJsonLd({
      '@context': 'https://schema.org',
      '@type': 'Service',
      serviceType: 'ამანათის გადაზიდვა მძღოლის მიერ',
      provider: { '@type': 'Organization', name: 'გგზავნა', url: 'https://ggzavna.ge' },
      areaServed: [
        { '@type': 'City', name: from },
        { '@type': 'City', name: to }
      ],
      offers: {
        '@type': 'Offer',
        price: pricePerKg,
        priceCurrency: 'GEL',
        description: '₾/კგ ტარიფი'
      }
    });

    this.seo.setBreadcrumb([
      { name: 'მთავარი', url: 'https://ggzavna.ge/' },
      { name: `${from} → ${to}`, url }
    ]);
  }

  goBack(): void {
    if (!this.isBrowser) return;
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

    if (this.isBrowser) {
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
      document.body.style.top = `-${window.scrollY}px`;

      this.updateChatViewportHeight();
      if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', this.viewportResizeHandler);
        window.visualViewport.addEventListener('scroll', this.viewportResizeHandler);
      }
    }

    this.cdr.detectChanges();

    setTimeout(() => {
      this.mountChatToBody();
    });
  }

  closeChat(): void {
    this.isChatOpen = false;
    this.unmountChatFromBody();

    if (this.isBrowser) {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', this.viewportResizeHandler);
        window.visualViewport.removeEventListener('scroll', this.viewportResizeHandler);
      }

      const scrollY = document.body.style.top;
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
      document.body.style.top = '';
      window.scrollTo(0, parseInt(scrollY || '0') * -1);
    }

    this.cdr.detectChanges();
  }

  private mountChatToBody(): void {
    if (!this.isBrowser) return;
    if (this.chatPortalView || !this.chatPortalTemplate) return;
    this.chatPortalView = this.vcRef.createEmbeddedView(this.chatPortalTemplate);
    this.chatPortalView.detectChanges();
    this.chatPortalView.rootNodes.forEach((node: Node) => {
      this.renderer.appendChild(document.body, node);
    });
  }

  private unmountChatFromBody(): void {
    if (!this.chatPortalView) return;
    this.chatPortalView.destroy();
    this.chatPortalView = null;
  }

  private updateChatViewportHeight(): void {
    if (!this.isBrowser) return;

    const vv = window.visualViewport;
    if (!vv) return;
    document.documentElement.style.setProperty('--chat-vh', `${vv.height}px`);
    document.documentElement.style.setProperty('--chat-offset-top', `${vv.offsetTop}px`);
  }

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
            this.pickupRequestSent = true;
          }
          alert('❌ ' + (err.error?.message || 'მოთხოვნის გაგზავნა ვერ მოხერხდა'));
        }
      });
  }

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

  sendEmail(): void {
    if (!this.trip || this.isOwnTrip) return;
    if (!this.isBrowser) return;

    const email = (this.trip as any).driverEmail;
    if (!email) return;
    const subject = encodeURIComponent(`მგზავრობა: ${this.trip.from} → ${this.trip.to}`);
    const body = encodeURIComponent('გამარჯობა, დაინტერესებული ვარ თქვენი მგზავრობით...');
    window.location.href = `mailto:${email}?subject=${subject}&body=${body}`;
  }

  hasEmail(): boolean {
    return !!(this.trip as any)?.driverEmail;
  }

  call(): void {
    if (!this.trip || this.isOwnTrip) return;
    if (!this.isBrowser) return;

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