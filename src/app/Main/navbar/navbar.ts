import { 
  Component, 
  HostListener, 
  ViewChild, 
  ElementRef, 
  ViewEncapsulation, 
  OnInit, 
  OnDestroy,
  ChangeDetectorRef 
} from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { SmsVerificationService, UserProfile } from '../../services/smsverifikation.service';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './navbar.html',
  styleUrl: './navbar.scss',
  encapsulation: ViewEncapsulation.ShadowDom
})
export class NavbarComponent implements OnInit, OnDestroy {
  @ViewChild('hamburger') hamburger!: ElementRef;
  @ViewChild('navWrapper') navWrapper!: ElementRef;

  isMenuOpen = false;
  isLoggedIn = false;
  currentUser: UserProfile | null = null;

  private subscriptions: Subscription[] = [];

  constructor(
    private router: Router,
    private smsService: SmsVerificationService,
    private cdr: ChangeDetectorRef,       // აიძულებს Angular-ს იზოლირებული კომპონენტის განახლებას
    private elementRef: ElementRef        // საჭიროა Shadow DOM-ის შიგნით კლიკების სწორი შემოწმებისთვის
  ) {}

  ngOnInit(): void {
    // ✅ ავტორიზაციის სტატუსის მოსმენა და მყისიერი ასახვა
    this.subscriptions.push(
      this.smsService.isLoggedIn$.subscribe({
        next: (status) => {
          this.isLoggedIn = status;
          console.log('🔍 [Navbar] isLoggedIn$ განახლდა:', status);
          this.cdr.detectChanges(); 
        }
      })
    );

    // ✅ მომხმარებლის პროფილის მოსმენა და მყისიერი ასახვა
    this.subscriptions.push(
      this.smsService.currentUser$.subscribe({
        next: (user) => {
          this.currentUser = user;
          console.log('🔍 [Navbar] currentUser$ განახლდა:', user, '| role:', user?.role);
          this.cdr.detectChanges(); 
        }
      })
    );
  }

  ngOnDestroy(): void {
    // მემორი ლიქების თავიდან ასაცილებლად
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  /**
   * მომხმარებლის ინიციალები ავატარისთვის
   */
  getUserInitials(): string {
    if (!this.currentUser) return '';
    const first = this.currentUser.firstName?.charAt(0) ?? '';
    const last = this.currentUser.lastName?.charAt(0) ?? '';
    return `${first}${last}`.toUpperCase();
  }

  toggleMenu(): void {
    this.isMenuOpen = !this.isMenuOpen;

    if (this.hamburger) {
      this.hamburger.nativeElement.classList.toggle('active', this.isMenuOpen);
    }
    if (this.navWrapper) {
      this.navWrapper.nativeElement.classList.toggle('active', this.isMenuOpen);
    }
    this.cdr.detectChanges();
  }

  closeMenu(): void {
    this.isMenuOpen = false;

    if (this.hamburger) {
      this.hamburger.nativeElement.classList.remove('active');
    }
    if (this.navWrapper) {
      this.navWrapper.nativeElement.classList.remove('active');
    }
    this.cdr.detectChanges();
  }

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    this.closeMenu();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    // იმის გამო, რომ Shadow DOM ჩართულია, გარე დოკუმენტიდან კლასით ძებნა არ მუშაობდა.
    // ახლა ვამოწმებთ, კლიკი მოხდა თუ არა უშუალოდ კომპონენტის შიგნით.
    const clickedInside = this.elementRef.nativeElement.contains(event.target);

    if (!clickedInside) {
      this.closeMenu();
    }
  }

  navigateToAllListings(): void {
    this.closeMenu();
    console.log('🔍 [Navbar] navigateToAllListings → /listing');
    this.router.navigate(['/listing']);
  } 
  
  navigateTosupport(): void {
    this.closeMenu();
    console.log('🔍 [Navbar] navigateToAllListings → /support');
    this.router.navigate(['/support']);
  }

  navigateToLogin(): void {
    this.closeMenu();
    console.log('🔍 [Navbar] navigateToLogin → /login');
    this.router.navigate(['/login']);
  }

  navigateToRegister(): void {
    this.closeMenu();
    console.log('🔍 [Navbar] navigateToRegister → /register');
    this.router.navigate(['/register']);
  }

  navigateToDashboard(): void {
    this.closeMenu();
    console.log('🔍 [Navbar] navigateToDashboard → /send');
    this.router.navigate(['/send']);
  }

  navigateToAddRide(): void {
    this.closeMenu();
    console.log('🔍 [Navbar] navigateToAddRide → /pickup');
    this.router.navigate(['/pickup']);
  }

  navigateToProfile(): void {
    this.closeMenu();

    // ✅ როლის მიხედვით სწორ პროფილზე გადასვლა
    const target = this.currentUser?.role === 'driver' ? '/driverProfile' : '/senderProfile';
    console.log('🔍 [Navbar] navigateToProfile | currentUser:', this.currentUser, '| role:', this.currentUser?.role, '| მიდის →', target);
    this.router.navigate([target]);
  }

  navigateHome(): void {
    this.closeMenu();
    console.log('🔍 [Navbar] navigateHome → /');
    this.router.navigate(['/']);
  }
}