import { Routes } from '@angular/router';
import { adminGuard } from './Admin.guard';

// app.routes.ts-ში გამოიყენება ასე: ...adminRoutes
export const adminRoutes: Routes = [
  {
    path: 'admin/login',
    loadComponent: () =>
      import('./admin-login-component/admin-login-component').then(
        (m) => m.AdminLoginComponent
      )
  },
  {
    path: 'admin',
    canActivate: [adminGuard],
    loadComponent: () =>
      import('./admin-panel-component/admin-panel-component').then(
        (m) => m.AdminPanelComponent
      )
  }
];