import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { ParcelService, ParcelRequest, DriverTrip } from '../../services/Parcel.service';
import { SmsVerificationService } from '../../services/smsverifikation.service';
import { SeoService } from '../../services/seo.service';

interface Step {
  id: number;
  title: string;
  description: string;
}

interface TrustItem {
  icon: string;
  title: string;
  text: string;
}

interface Faq {
  question: string;
  answer: string;
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './home.html',
  styleUrls: ['./home.scss'],
})
export class HomeComponent implements OnInit, OnDestroy {
  // ============ სტატიკური კონტენტი ============

  readonly cities: string[] = [
    'თბილისი', 'ბათუმი', 'ქუთაისი', 'რუსთავი', 'გორი', 'ზუგდიდი', 'ფოთი',
    'თელავი', 'ახალციხე', 'ოზურგეთი', 'სამტრედია', 'სიღნაღი', 'მცხეთა',
    'ბორჯომი', 'ზესტაფონი', 'ხაშური', 'სენაკი', 'მარნეული',
  ];

  readonly tags: string[] = [
    '📦 ამანათები', '🛋️ ავეჯი', '💻 ტექნიკა', '📺 ტელევიზორები', '🚲 ველოსიპედები', '🪑 ნებისმიერი ნივთი',
  ];

  readonly steps: Step[] = [
    { id: 1, title: 'დარეგისტრირდი', description: 'ტელეფონის ნომრით, დაახლოებით 1–2 წუთში.' },
    { id: 2, title: 'შეავსე მარშრუტი', description: 'მიუთითე საიდან, სად, წონა და ნივთის აღწერა.' },
    { id: 3, title: 'შეთანხმდი მძღოლთან', description: 'აირჩიე მძღოლი ან დაელოდე შეთავაზებას და ჩატში დააზუსტეთ დეტალები.' },
  ];

  /** მხოლოდ ის, რაც პლატფორმას რეალურად აქვს (ხილულ FAQ-თან თანხვედრაშია). */
  readonly trust: TrustItem[] = [
    { icon: '🆓', title: 'უფასოა', text: 'რეგისტრაცია და სარგებლობა ამჟამად უფასოა' },
    { icon: '👀', title: 'ხედავ მძღოლს', text: 'პროფილი და მგზავრობის დეტალები არჩევანამდე' },
    { icon: '💬', title: 'პირდაპირი ჩატი', text: 'დეტალებს მძღოლთან პლატფორმაზევე აზუსტებ' },
    { icon: '🤝', title: 'შენ წყვეტ', text: 'ფასზე და პირობებზე თავად თანხმდებით' },
  ];

  /** ერთი წყარო: ეკრანზეც და JSON-LD-შიც იგივე ტექსტია (Google-ის მოთხოვნა). */
  readonly faqs: Faq[] = [
    {
      question: 'რამდენი ღირს ამანათის გაგზავნა?',
      answer:
        'ფასს ადგენს მძღოლი და ის დამოკიდებულია მარშრუტზე, ამანათის წონასა და ზომაზე. ვინაიდან მძღოლი ამ მიმართულებით ისედაც მგზავრობს, ფასი შეიძლება უფრო ხელმისაწვდომი იყოს, თუმცა კონკრეტული თანხა მხარეთა შეთანხმებაზეა დამოკიდებული.',
    },
    {
      question: 'უსაფრთხოა თუ არა ჩემი ამანათი?',
      answer:
        'პლატფორმა გამგზავნსა და მძღოლს აკავშირებს და თავად არ ახორციელებს გადაზიდვას. გადაწყვეტილებამდე გაეცანი მძღოლის პროფილსა და მგზავრობის დეტალებს, ზუსტად აღწერე ამანათი და განსაკუთრებით ძვირფასი ან მყიფე ნივთები წინასწარი შეთანხმების გარეშე არ გააგზავნო. დეტალური პირობები იხილე „წესებში“.',
    },
    {
      question: 'რისი გაგზავნა არ შეიძლება?',
      answer: 'კანონით აკრძალული და საშიში ნივთები არ იგზავნება. სრული სია იხილე „წესებში“.',
    },
    {
      question: 'მხოლოდ მცირე ზომის ნივთის გაგზავნა შემიძლია?',
      answer:
        'დიახ. მინიმალური ლიმიტი არ არსებობს: შეგიძლია გააგზავნო კონვერტი ან გასაღები, ისევე როგორც დიდი ტვირთი, თუ მძღოლი დათანხმდება და საბარგულში ადგილი ექნება.',
    },
    {
      question: 'რა დრო სჭირდება მიწოდებას?',
      answer:
        'დამოკიდებულია მძღოლის მგზავრობის გრაფიკზე, მარშრუტსა და გზის პირობებზე. ზუსტ დროს მძღოლთან შეთანხმებისას დააზუსტებ.',
    },
    {
      question: 'როგორ ხდება ანგარიშსწორება?',
      answer:
        'ანგარიშსწორება ხდება უშუალოდ გამგზავნსა და მძღოლს შორის, წინასწარი შეთანხმებით (მაგ. ნაღდი ანგარიშსწორებით ჩაბარებისას). პლატფორმა თანხას ამჟამად არ ახორციელებს და არ ინახავს.',
    },
    {
      question: 'აქვს თუ არა პლატფორმას საკომისიო?',
      answer:
        'ამჟამად პლატფორმით სარგებლობა უფასოა. მომავალში საკომისიო თუ დაწესდა, მომხმარებლებს წინასწარ გავაფრთხილებთ.',
    },
    {
      question: 'რა ვქნა, თუ მძღოლი დათქმულ დროს არ გამოჩნდა?',
      answer:
        'დაუკავშირდი მძღოლს ჩატით ან ტელეფონით. თუ კავშირი ვერ დამყარდა, შეგიძლია შეკვეთა გააუქმო და სხვა მძღოლი აირჩიო. პრობლემის შემთხვევაში მოგვმართე მხარდაჭერის გუნდს.',
    },
  ];

  // ============ მდგომარეობა ============

  recentRequests: ParcelRequest[] = [];
  recentTrips: DriverTrip[] = [];
  isLoadingRequests = false;
  isLoadingTrips = false;
  requestsFailed = false;
  tripsFailed = false;

  isLoggedIn = false;

  searchFrom = '';
  searchTo = '';

  readonly skeletons = [1, 2, 3];

  private destroy$ = new Subject<void>();

  constructor(
    private router: Router,
    private parcelService: ParcelService,
    private smsService: SmsVerificationService,
    private cdr: ChangeDetectorRef,
    private seo: SeoService
  ) {}

  ngOnInit(): void {
    this.setSeo();
    this.loadRecentRequests();
    this.loadRecentTrips();

    this.smsService.isLoggedIn$.pipe(takeUntil(this.destroy$)).subscribe((status) => {
      this.isLoggedIn = status;
      this.cdr.detectChanges();
    });

    this.parcelService
      .tripCreated()
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
      title: 'ამანათის გაგზავნა და გადაზიდვა საქართველოში | გგზავნა',
      description:
        'გააგზავნე ამანათი, ავეჯი, ტექნიკა ან ნებისმიერი ნივთი საქართველოს ნებისმიერ ქალაქში. იპოვე მძღოლი, რომელიც უკვე მიდის შენთვის სასურველი მიმართულებით. რეგისტრაცია უფასოა.',
      url: 'https://www.ggzavna.ge/',
    });

    this.seo.setJsonLd([
      {
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: 'გგზავნა',
        url: 'https://www.ggzavna.ge',
        logo: 'https://www.ggzavna.ge/assets/logo.png',
        description: 'ამანათის გაგზავნისა და ნივთის გადაზიდვის P2P პლატფორმა საქართველოში',
      },
      {
        '@context': 'https://schema.org',
        '@type': 'Service',
        name: 'ამანათის გაგზავნა და გადაზიდვა',
        url: 'https://www.ggzavna.ge/',
        provider: { '@type': 'Organization', name: 'გგზავნა' },
        areaServed: { '@type': 'Country', name: 'საქართველო' },
        serviceType: [
          'ამანათის გაგზავნა',
          'ნივთის გაგზავნა',
          'ნივთის გადაზიდვა',
          'ავეჯის გადაზიდვა',
          'ტექნიკის გადაზიდვა',
          'ტელევიზორის გაგზავნა',
          'ველოსიპედის გაგზავნა',
          'დოკუმენტის გაგზავნა',
        ],
        description:
          'პლატფორმა, რომელიც გამგზავნს აკავშირებს მძღოლებთან, რომლებიც უკვე მიემგზავრებიან საქართველოს ქალაქებს შორის.',
      },
      {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        // ეკრანზე ხილულ FAQ-ს ემთხვევა (იგივე მასივი)
        mainEntity: this.faqs.map((f) => ({
          '@type': 'Question',
          name: f.question,
          acceptedAnswer: { '@type': 'Answer', text: f.answer },
        })),
      },
    ]);
  }

  // ============ მონაცემების ჩატვირთვა ============

  loadRecentRequests(): void {
    this.isLoadingRequests = true;
    this.requestsFailed = false;
    this.cdr.detectChanges();

    this.parcelService.getRecentRequests().subscribe({
      next: (res: any) => {
        this.recentRequests = res?.success && res.requests ? res.requests.slice(0, 6) : [];
        this.isLoadingRequests = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('განცხადებების ჩატვირთვა ვერ მოხერხდა:', err);
        this.recentRequests = [];
        this.requestsFailed = true;
        this.isLoadingRequests = false;
        this.cdr.detectChanges();
      },
    });
  }

  loadRecentTrips(): void {
    this.isLoadingTrips = true;
    this.tripsFailed = false;
    this.cdr.detectChanges();

    this.parcelService.getRecentTrips().subscribe({
      next: (res: any) => {
        this.recentTrips = res?.success && res.trips ? res.trips.slice(0, 6) : [];
        this.isLoadingTrips = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('მგზავრობების ჩატვირთვა ვერ მოხერხდა:', err);
        this.recentTrips = [];
        this.tripsFailed = true;
        this.isLoadingTrips = false;
        this.cdr.detectChanges();
      },
    });
  }

  // ============ CTA და ძიება ============

  /** გამგზავნი: შესულს → /send, სტუმარს → /register */
  startAsSender(): void {
    this.isLoggedIn
      ? this.router.navigate(['/send'])
      : this.router.navigate(['/register'], { queryParams: { role: 'sender' } });
  }

  /** მძღოლი: შესულს → /pickup, სტუმარს → /register */
  startAsDriver(): void {
    this.isLoggedIn
      ? this.router.navigate(['/pickup'])
      : this.router.navigate(['/register'], { queryParams: { role: 'driver' } });
  }

  /** /listing გვერდმა უნდა წაიკითხოს ?from=&to= (იხ. ინსტრუქცია) */
  search(): void {
    const queryParams: Record<string, string> = {};
    if (this.searchFrom) queryParams['from'] = this.searchFrom;
    if (this.searchTo) queryParams['to'] = this.searchTo;
    this.router.navigate(['/listing'], { queryParams });
  }

  swapCities(): void {
    [this.searchFrom, this.searchTo] = [this.searchTo, this.searchFrom];
  }

  viewRequest(requestId: string | undefined): void {
    if (requestId) this.router.navigate(['/request', requestId]);
  }

  viewTrip(tripId: string | undefined): void {
    if (tripId) this.router.navigate(['/trip', tripId]);
  }

  // ============ დამხმარე ფუნქციები ============

  /** კონფიდენციალურობა: "გიორგი მამულაშვილი" → "გიორგი მ." */
  shortName(fullName: string | undefined, fallback: string): string {
    const parts = (fullName ?? '').trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return fallback;
    return parts.length > 1 ? `${parts[0]} ${parts[1].charAt(0)}.` : parts[0];
  }

  /** "დაემატა" — ფარდობითი დრო (ახლახან, 3 საათის წინ, ...) */
  timeAgo(dateString: string | undefined): string {
    if (!dateString) return '—';
    const diffSec = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000);
    if (isNaN(diffSec)) return '—';
    if (diffSec < 60) return 'ახლახან';
    const min = Math.floor(diffSec / 60);
    if (min < 60) return `${min} წუთის წინ`;
    const hour = Math.floor(min / 60);
    if (hour < 24) return `${hour} საათის წინ`;
    const day = Math.floor(hour / 24);
    return day < 30 ? `${day} დღის წინ` : this.formatDate(dateString);
  }

  formatDate(dateString: string | undefined): string {
    if (!dateString) return '—';
    const date = new Date(dateString);
    return isNaN(date.getTime())
      ? '—'
      : date.toLocaleDateString('ka-GE', { year: 'numeric', month: 'short', day: 'numeric' });
  }

  formatDateTime(dateString: string | undefined): string {
    if (!dateString) return '—';
    const date = new Date(dateString);
    return isNaN(date.getTime())
      ? '—'
      : date.toLocaleDateString('ka-GE', { day: 'numeric', month: 'short' }) +
          ', ' +
          date.toLocaleTimeString('ka-GE', { hour: '2-digit', minute: '2-digit' });
  }

  trackById(index: number, item: { _id?: string }): string | number {
    return item._id ?? index;
  }

  scrollCarousel(track: HTMLElement, direction: 1 | -1): void {
    if (!track) return;
    const firstCard = track.querySelector('.listing-card') as HTMLElement | null;
    const cardWidth = firstCard ? firstCard.offsetWidth + 22 : 300;
    track.scrollBy({ left: direction * cardWidth * 2, behavior: 'smooth' });
  }
}