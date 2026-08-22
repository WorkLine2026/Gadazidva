import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withFetch, withInterceptorsFromDi } from '@angular/common/http';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),

    // 🔑 fetch-ზე დაფუძნებული HttpClient — მუშაობს სწორად SSR-ზეც (Node-ში XHR არ არსებობს)
    provideHttpClient(withFetch(), withInterceptorsFromDi()),

    // 🔑 hydration + event replay — client bootstrap-ი მყისიერად ერთვება,
    // click-ის მოლოდინის გარეშე
    provideClientHydration(withEventReplay())
  ]
};