import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withFetch, withInterceptorsFromDi } from '@angular/common/http';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';

import { provideTranslateService } from '@ngx-translate/core';
import { provideTranslateHttpLoader } from '@ngx-translate/http-loader';

import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),

    // 🔑 HttpClient — მუშაობს სწორად SSR-ზეც
    provideHttpClient(
      withFetch(),
      withInterceptorsFromDi()
    ),

    // 🌐 Translation
    provideTranslateService({
      loader: provideTranslateHttpLoader({
        prefix: './assets/i18n/',
        suffix: '.json'
      })
    }),

    // 🔑 hydration + event replay
    provideClientHydration(
      withEventReplay()
    )
  ]
};