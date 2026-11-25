import { Component, OnInit, Inject, PLATFORM_ID, Input } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';

@Component({
  selector: 'app-rules',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './rules.html',
  styleUrl: './rules.scss',
})
export class RulesComponent implements OnInit {
  private readonly isBrowser: boolean;

  /** true = მოდალში ჩასმული რეჟიმი (საკუთარი scroll container-ით) */
  @Input() embedded = false;

  constructor(@Inject(PLATFORM_ID) platformId: Object) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  ngOnInit(): void {
    if (this.isBrowser && !this.embedded) {
      window.scrollTo(0, 0);
    }
  }

  scrollToTop(): void {
    if (!this.isBrowser) return;

    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  }

  printRules(): void {
    if (!this.isBrowser) return;

    window.print();
  }

  downloadRulesPDF(): void {
    if (!this.isBrowser) return;

    // TODO: Implement PDF download functionality
    alert('PDF ჩამოტვირთვა მალე იქნება ხელმისაწვდომი');
  }

  onTocClick(event: Event, sectionId: string): void {
    event.preventDefault();
    this.scrollToSection(sectionId);
  }

  scrollToSection(sectionId: string): void {
    if (!this.isBrowser) return;

    const element = document.getElementById(sectionId);
    if (!element) return;

    if (this.embedded) {
      // მოდალში: უახლოესი scroll container-ი სქროლდება, არა window
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }

    const headerOffset = 80;
    const elementPosition = element.getBoundingClientRect().top + window.pageYOffset;

    window.scrollTo({
      top: elementPosition - headerOffset,
      behavior: 'smooth',
    });
  }
}