import { Component, OnInit, OnDestroy, ChangeDetectorRef, Inject, PLATFORM_ID } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { ParcelService, ParcelRequest, DriverTrip } from '../../services/Parcel.service';
import { SeoService } from '../../services/seo.service'; // ⚠️ დააზუსტე გზა შენი ფოლდერების მიხედვით

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
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './home.html',
  styleUrls: ['./home.scss'],
})
export class HomeComponent implements OnInit, OnDestroy {
  // ============ Steps და Badges ============
  // ⚠️ steps1 წაშლილია — იყო იდენტური steps-ის დუბლირება, ორივე გამოჩნდებოდა template-ში
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
  private readonly isBrowser: boolean;

  constructor(
    private router: Router,
    private parcelService: ParcelService,
    private cdr: ChangeDetectorRef,
    private seo: SeoService,
    @Inject(PLATFORM_ID) platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  ngOnInit(): void {
    this.setSeo();
    this.loadRecentRequests();
    this.loadRecentTrips();

    // ✅ ახალი განცხადებების რეალ-ტაიმ მოსმენა
    this.parcelService.tripCreated()
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.loadRecentRequests();
        this.loadRecentTrips();
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ============ SEO ============
  private setSeo(): void {
    this.seo.update({
      title: 'გგზავნა — გააგზავნე ნებისმიერი ნივთი საქართველოს ნებისმიერ ქალაქში',
      description:
        'იპოვე მძღოლი რამდენიმე წუთში და გააგზავნე ამანათი, ავეჯი, ტექნიკა თუ ველოსიპედი — სწრაფად, უსაფრთხოდ და დაბალ ფასად მთელს საქართველოში.',
      url: 'https://ggzavna.ge/',
    });

    this.seo.setJsonLd([
      {
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: 'გგზავნა',
        url: 'https://ggzavna.ge',
        logo: 'https://ggzavna.ge/assets/logo.png',
        description: 'P2P ამანათების გადაზიდვის პლატფორმა საქართველოში',
      },
      {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: [
          {
            '@type': 'Question',
            name: 'რამდენი ღირს ამანათის გაგზავნა?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'ფასი დამოკიდებულია მარშრუტის მანძილზე, ამანათის წონასა და ზომაზე. ვინაიდან მძღოლი ამ მიმართულებით ისედაც მგზავრობს, ტარიფები სტანდარტულ საკურიერო მომსახურებებთან შედარებით ბევრად უფრო დაბალია.',
            },
          },
          {
            '@type': 'Question',
            name: 'უსაფრთხოა თუ არა ჩემი ამანათი?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'დიახ. ყველა მომხმარებელი და მძღოლი გადის იდენტიფიკაციას, თითოეული გზავნილი დაზღვეულია, და შესაძლებელია რეალურ დროში თვალის დევნება რუკაზე.',
            },
          },
          {
            '@type': 'Question',
            name: 'მხოლოდ მცირე ზომის ნივთის გაგზავნა შემიძლია?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'დიახ, არანაირი მინიმალური ლიმიტი არ არსებობს — შეგიძლიათ გაგზავნოთ როგორც პატარა კონვერტი, ისე დიდი ზომის ტვირთი.',
            },
          },
          {
            '@type': 'Question',
            name: 'რა დრო სჭირდება მიწოდებას?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'მძღოლი პირდაპირ მიემართება დანიშნულების ადგილისკენ, ამიტომ მიწოდება ხშირად სულ რამდენიმე საათში სრულდება.',
            },
          },
          {
            '@type': 'Question',
            name: 'რა საკომისიო აქვს პლატფორმას?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'პლატფორმა თითოეული წარმატებული ტრანზაქციიდან იტოვებს მინიმალურ საკომისიოს (3-5%), რომელიც ხმარდება დაზღვევასა და სერვისის მხარდაჭერას.',
            },
          },
        ],
      },
    ]);
  }

  // ============ გამგზავნის განცხადებების ჩაკრება (PUBLIC) ============
  private loadRecentRequests(): void {
    this.isLoadingRequests = true;
    this.cdr.detectChanges();

    this.parcelService.getRecentRequests().subscribe({
      next: (res: any) => {
        this.isLoadingRequests = false;

        if (res.success && res.requests) {
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

    this.parcelService.getRecentTrips().subscribe({
      next: (res: any) => {
        this.isLoadingTrips = false;

        if (res.success && res.trips) {
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

  viewRequest(requestId: string | undefined): void {
    if (!requestId) {
      console.error('❌ განცხადების ID არ გაითვალა');
      return;
    }
    this.router.navigate(['/request', requestId]);
  }

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

  /**
   * გვერდის თავში რბილად (smooth) აყოლება — გამოიყენება how-cta სექციის ღილაკებზე
   */
  scrollToTop(): void {
    if (this.isBrowser) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  // ============ კარუსელის სქროლი ============
  scrollCarousel(track: HTMLElement, direction: 1 | -1): void {
    if (!track) return;

    const firstCard = track.querySelector(
      '.request-card-home, .trip-card-home'
    ) as HTMLElement | null;

    const cardWidth = firstCard ? firstCard.offsetWidth + 24 : 300;

    track.scrollBy({ left: direction * cardWidth * 2, behavior: 'smooth' });
  }
}