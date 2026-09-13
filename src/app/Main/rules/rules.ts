import { Component, OnInit, Inject, PLATFORM_ID } from '@angular/core';
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

  constructor(@Inject(PLATFORM_ID) platformId: Object) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  ngOnInit(): void {
    // Scroll to top when component loads
    if (this.isBrowser) {
      window.scrollTo(0, 0);
    }
  }

  /**
   * Scroll back to top
   */
  scrollToTop(): void {
    if (!this.isBrowser) return;

    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  }

  /**
   * Print rules
   */
  printRules(): void {
    if (!this.isBrowser) return;

    window.print();
  }

  /**
   * Download rules as PDF (future implementation)
   */
  downloadRulesPDF(): void {
    if (!this.isBrowser) return;

    // TODO: Implement PDF download functionality
    alert('PDF ჩამოტვირთვა მალე იქნება ხელმისაწვდომი');
  }

  /**
   * Handle TOC link click - prevent default hash jump, use smooth scroll instead
   */
  onTocClick(event: Event, sectionId: string): void {
    event.preventDefault();
    this.scrollToSection(sectionId);
  }

  /**
   * Scroll to specific section
   */
  scrollToSection(sectionId: string): void {
    if (!this.isBrowser) return;

    const element = document.getElementById(sectionId);
    if (element) {
      // თუ გაქვთ fixed header, აქ offset-ს გამოვაკლებთ, რომ სათაური header-ქვეშ არ დაიმალოს
      const headerOffset = 80; // შეცვალეთ თქვენი header-ის სიმაღლის მიხედვით
      const elementPosition = element.getBoundingClientRect().top + window.pageYOffset;
      const offsetPosition = elementPosition - headerOffset;

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth',
      });
    }
  }
}