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
  scrollToSection(sectionId: string): void {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }
  }

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
}