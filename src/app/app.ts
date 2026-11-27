import { Component, OnInit, signal, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Router, RouterOutlet, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { Capacitor } from '@capacitor/core';
import { NavbarComponent } from "./Main/navbar/navbar";
import { BottomNavbarComponent } from "../app/android-components/bottom-navbar-component/bottom-navbar-component";
import { FooterComponent } from "./Main/footer/footer";
import { ToastNotificationsComponent } from './chat/toast-notifications-component/toast-notifications-component';
import { PullToRefreshDirective } from './android-components/directives/pull-to-refresh.directive';
import { Pushnofication } from './chat/pushnofication/pushnofication';

// Meta Pixel (იტვირთება index.html-იდან)
declare const fbq: any;

@Component({
  selector: 'app-root',
  imports: [
    CommonModule,
    RouterOutlet,
    FooterComponent,
    NavbarComponent,
    BottomNavbarComponent,
    ToastNotificationsComponent,
    PullToRefreshDirective,
    Pushnofication
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App implements OnInit {
  protected readonly title = signal('gadazidva');

  protected readonly isNativeApp = Capacitor.isNativePlatform();

  private readonly isBrowser: boolean;

  constructor(
    private router: Router,
    @Inject(PLATFORM_ID) platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  ngOnInit(): void {
    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe(() => {
        // SSR/prerender-ზე window და document არ არსებობს
        if (!this.isBrowser) {
          return;
        }

        window.scrollTo(0, 0);
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0;

        // Meta Pixel: PageView ყოველ route-ზე (პირველ ჩატვირთვაზეც)
        if (typeof fbq !== 'undefined') {
          fbq('track', 'PageView');
        }
      });
  }
}