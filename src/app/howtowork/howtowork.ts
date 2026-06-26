import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-howtowork',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './howtowork.html',
  styleUrls: ['./howtowork.scss'],
})
export class HowToWorkComponent implements OnInit {
  constructor(private router: Router) {}

  ngOnInit(): void {
    // კომპონენტის ჩატვირთვისას გვერდი ავტომატურად ავა თავში
    window.scrollTo(0, 0);
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
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  }
}