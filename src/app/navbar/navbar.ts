import { Component, HostListener, ViewChild, ElementRef, ViewEncapsulation } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './navbar.html',
  styleUrl: './navbar.scss',
  encapsulation: ViewEncapsulation.ShadowDom
})
export class NavbarComponent {
  @ViewChild('hamburger') hamburger!: ElementRef;
  @ViewChild('navWrapper') navWrapper!: ElementRef;

  isMenuOpen = false;
  isLoggedIn = false; // შენი ავტენტიკაციის ლოგიკა

  constructor(private router: Router) {}

  /**
   * ჰამბურგერ მენიუს გახსნა/დახურვა
   */
  toggleMenu(): void {
    this.isMenuOpen = !this.isMenuOpen;

    if (this.hamburger) {
      this.hamburger.nativeElement.classList.toggle('active', this.isMenuOpen);
    }
    if (this.navWrapper) {
      this.navWrapper.nativeElement.classList.toggle('active', this.isMenuOpen);
    }
  }

  /**
   * მენიუს დახურვა ლინკზე დაჭერის შემდეგ
   */
  closeMenu(): void {
    this.isMenuOpen = false;

    if (this.hamburger) {
      this.hamburger.nativeElement.classList.remove('active');
    }
    if (this.navWrapper) {
      this.navWrapper.nativeElement.classList.remove('active');
    }
  }

  /**
   * მენიუს დახურვა ESC ღილაკის დაჭერისას
   */
  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    this.closeMenu();
  }

  /**
   * მობილური მენიუს დახურვა ბეკგროუნდზე დაჭერის შემდეგ
   */
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    const navbar = document.querySelector('.navbar');

    if (navbar && !navbar.contains(target)) {
      this.closeMenu();
    }
  }

  /**
   * შესვლის ღილაკი
   */
  navigateToLogin(): void {
    this.closeMenu();
    this.router.navigate(['/login']);
  }

  /**
   * რეგისტრაციის ღილაკი
   */
  navigateToRegister(): void {
    this.closeMenu();
    this.router.navigate(['/register']);
  }

  /**
   * გაგზავნის ღილაკი
   */
  navigateToDashboard(): void {
    this.closeMenu();
    this.router.navigate(['/dashboard']);
  }

  /**
   * რეისის დამატების ღილაკი
   */
  navigateToAddRide(): void {
    this.closeMenu();
    this.router.navigate(['/dashboard']);
  }

  /**
   * ლოგოზე დაჭერა - მთავარ გვერდზე
   */
  navigateHome(): void {
    this.closeMenu();
    this.router.navigate(['/']);
  }
}