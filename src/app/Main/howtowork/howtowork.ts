import { Component, OnInit, Inject, PLATFORM_ID } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CommonModule, isPlatformBrowser } from '@angular/common';

@Component({
  selector: 'app-howtowork',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './howtowork.html',
  styleUrls: ['./howtowork.scss'],
})
export class HowToWorkComponent implements OnInit {
  private readonly isBrowser: boolean;

  constructor(
    private router: Router,
    @Inject(PLATFORM_ID) platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  ngOnInit(): void {
    // კომპონენტის ჩატვირთვისას გვერდი ავტომატურად ავა თავში
    if (this.isBrowser) {
      window.scrollTo(0, 0);
    }
  }

  /**
   * ავტორიზაციის/რეგისტრაციის გვერდზე გადასვლა
   */
  navigateToDashboard(): void {
    this.router.navigate(['/auth/register']);
  }

  /**
   * გვერდის თავში რბილად (smooth) აყოლება
   */
  scrollToTop(): void {
    if (this.isBrowser) {
      window.scrollTo({
        top: 0,
        behavior: 'smooth',
      });
    }
  }
}