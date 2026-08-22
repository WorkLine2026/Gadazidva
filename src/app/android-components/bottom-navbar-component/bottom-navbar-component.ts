import {
  Component,
  OnInit,
  OnDestroy,
  ViewEncapsulation,
  ChangeDetectorRef
} from '@angular/core';

import { Router, NavigationEnd } from '@angular/router';

import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';

import {
  SmsVerificationService,
  UserProfile
} from '../../services/smsverifikation.service';


@Component({
  selector: 'app-bottom-navbar',
  standalone: true,

  imports: [
    CommonModule,
    RouterModule
  ],

  templateUrl: './bottom-navbar-component.html',

  styleUrl: './bottom-navbar-component.scss',

  encapsulation: ViewEncapsulation.ShadowDom
})
export class BottomNavbarComponent
  implements OnInit, OnDestroy {

  // ==========================================
  // USER
  // ==========================================

  isLoggedIn = false;

  currentUser: UserProfile | null = null;


  // ==========================================
  // ADD MENU
  // ==========================================

  isAddMenuOpen = false;


  // ==========================================
  // SUBSCRIPTIONS
  // ==========================================

  private subscriptions: Subscription[] = [];


  // ==========================================
  // CONSTRUCTOR
  // ==========================================

  constructor(
    private router: Router,
    private smsService: SmsVerificationService,
    private cdr: ChangeDetectorRef
  ) {}


  // ==========================================
  // INIT
  // ==========================================

  ngOnInit(): void {

    // Login status

    this.subscriptions.push(

      this.smsService.isLoggedIn$.subscribe({

        next: (status) => {

          this.isLoggedIn = status;

          // თუ logout მოხდა,
          // მენიუ აუცილებლად დაიხუროს

          if (!status) {
            this.isAddMenuOpen = false;
          }

          this.cdr.detectChanges();
        }

      })

    );


    // Current user

    this.subscriptions.push(

      this.smsService.currentUser$.subscribe({

        next: (user) => {

          this.currentUser = user;

          this.cdr.detectChanges();
        }

      })

    );


    // Navigation listener

    this.subscriptions.push(

      this.router.events
        .pipe(
          filter(
            event =>
              event instanceof NavigationEnd
          )
        )
        .subscribe(() => {

          // ახალი გვერდის გახსნისას
          // plus menu დაიხუროს

          this.isAddMenuOpen = false;


          // გვერდის თავში ასვლა

          if (typeof window !== 'undefined') {

            window.scrollTo({
              top: 0,
              left: 0,
              behavior: 'auto'
            });

          }

        })

    );

  }


  // ==========================================
  // DESTROY
  // ==========================================

  ngOnDestroy(): void {

    this.subscriptions.forEach(
      sub => sub.unsubscribe()
    );

  }


  // ==========================================
  // PLUS MENU
  // ==========================================

  toggleAddMenu(): void {

    this.isAddMenuOpen =
      !this.isAddMenuOpen;

  }


  closeAddMenu(): void {

    this.isAddMenuOpen = false;

  }


  // ==========================================
  // NAVIGATION
  // ==========================================

  navigateHome(): void {

    this.closeAddMenu();

    this.router.navigate(['/']);

  }


  navigateToDashboard(): void {

    this.closeAddMenu();

    this.router.navigate(['/send']);

  }


  navigateToAddRide(): void {

    this.closeAddMenu();

    this.router.navigate(['/pickup']);

  }


  navigateToProfile(): void {

    this.closeAddMenu();

    this.router.navigate(['/profile']);

  }


  navigateToLogin(): void {

    this.closeAddMenu();

    this.router.navigate(['/login']);

  }


  // ==========================================
  // USER INITIALS
  // ==========================================

  getUserInitials(): string {

    if (!this.currentUser) {
      return '';
    }


    const first =
      this.currentUser.firstName?.charAt(0) ?? '';


    const last =
      this.currentUser.lastName?.charAt(0) ?? '';


    return `${first}${last}`.toUpperCase();

  };

    navigateToAllListings(): void {

    this.closeAddMenu();

    this.router.navigate(['/listing']);

  };

}