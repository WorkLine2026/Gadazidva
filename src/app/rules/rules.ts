import { Component, OnInit, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-rules',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './rules.html',
  styleUrl: './rules.scss',
})
export class RulesComponent implements OnInit {
  constructor() {}

  ngOnInit(): void {
    // Scroll to top when component loads
    window.scrollTo(0, 0);
  }

  /**
   * Scroll to specific section
   */

  /**
   * Scroll back to top
   */
  scrollToTop(): void {
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  }

  /**
   * Print rules
   */
  printRules(): void {
    window.print();
  }

  /**
   * Download rules as PDF (future implementation)
   */
  downloadRulesPDF(): void {
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