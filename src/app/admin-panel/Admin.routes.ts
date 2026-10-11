import { Routes } from '@angular/router';
import { adminGuard } from './Admin.guard';
import { AdminLoginComponent } from './admin-login-component/admin-login-component';
import { AdminLayoutComponent } from './admin-layout-component/admin-layout-component';
import { AdminDashboardComponent } from './admin-dashboard-component/admin-dashboard-component';
import { AdminUsersComponent } from './admin-users-component/admin-users-component';
import { AdminRequestsComponent } from './admin-requests-component/admin-requests-component';
import { AdminTripsComponent } from './admin-trips-component/admin-trips-component';
import { AdminOffersComponent } from './admin-offers-component/admin-offers-component';

export const adminRoutes: Routes = [
  { path: 'admin/login', component: AdminLoginComponent },
  {
    path: 'admin',
    component: AdminLayoutComponent,
    canActivate: [adminGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard', component: AdminDashboardComponent },
      { path: 'users', component: AdminUsersComponent },
      { path: 'requests', component: AdminRequestsComponent },
      { path: 'trips', component: AdminTripsComponent },
      { path: 'offers', component: AdminOffersComponent }
    ]
  }
];