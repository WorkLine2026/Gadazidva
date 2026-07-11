import { ApplicationConfig, importProvidersFrom } from '@angular/core';
import { provideRouter } from '@angular/router';
import { HttpClientModule } from '@angular/common/http';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    // 🔑 HTTP Client - აუცილებელი SMS API მოითხოვნებისთვის
    importProvidersFrom(HttpClientModule)
  ]
};