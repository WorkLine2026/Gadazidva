import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterOutlet, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { Capacitor } from '@capacitor/core';
import { NavbarComponent } from "./navbar/navbar";
import { BottomNavbarComponent } from "../app/android-components/bottom-navbar-component/bottom-navbar-component";
import { FooterComponent } from "./footer/footer";
import { ToastNotificationsComponent } from './chat/toast-notifications-component/toast-notifications-component';

@Component({
  selector: 'app-root',
  imports: [
    CommonModule,
    RouterOutlet,
    FooterComponent,
    NavbarComponent,
    BottomNavbarComponent,
    ToastNotificationsComponent
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App implements OnInit {
  protected readonly title = signal('gadazidva');
  protected readonly isNativeApp = Capacitor.isNativePlatform();

  constructor(private router: Router) {}

 ngOnInit(): void {
  this.router.events
    .pipe(filter(event => event instanceof NavigationEnd))
    .subscribe(() => {
     
      
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;

      setTimeout(() => {
      }, 100);
    });
}
}
