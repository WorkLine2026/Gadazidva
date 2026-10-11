import { Component, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { SmsVerificationService } from '../../services/smsverifikation.service';

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './admin-layout-component.html',
  styleUrls: ['./admin-layout-component.scss']
})
export class AdminLayoutComponent {
  sidebarOpen = true;

  navItems = [
    { label: 'მთავარი', icon: '📊', route: '/admin/dashboard' },
    { label: 'მომხმარებლები', icon: '👥', route: '/admin/users' },
    { label: 'განცხადებები', icon: '📦', route: '/admin/requests' },
    { label: 'მგზავრობები', icon: '🚗', route: '/admin/trips' },
    { label: 'შეთავაზებები', icon: '🤝', route: '/admin/offers' }
  ];

  constructor(
    private router: Router,
    private smsService: SmsVerificationService,
    private cdr: ChangeDetectorRef
  ) {}

  toggleSidebar(): void {
    this.sidebarOpen = !this.sidebarOpen;
    this.cdr.markForCheck();
  }

  logout(): void {
    this.smsService.clearAuthToken();
    this.router.navigate(['/admin/login']);
    this.cdr.markForCheck();
  }

  get currentUserName(): string {
    const user = this.smsService.getCurrentUser();
    return user ? `${user.firstName} ${user.lastName}` : 'ადმინისტრატორი';
  }
}