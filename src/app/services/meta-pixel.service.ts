import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

declare const fbq: any;

@Injectable({ providedIn: 'root' })
export class MetaPixelService {
  private readonly isBrowser: boolean;

  constructor(@Inject(PLATFORM_ID) platformId: Object) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  // სტანდარტული ივენთები: Lead, CompleteRegistration, InitiateCheckout, Purchase...
  track(event: string, params?: Record<string, any>): void {
    if (this.isBrowser && typeof fbq !== 'undefined') {
      fbq('track', event, params);
    }
  }

  // შენი საკუთარი სახელის ივენთები
  trackCustom(event: string, params?: Record<string, any>): void {
    if (this.isBrowser && typeof fbq !== 'undefined') {
      fbq('trackCustom', event, params);
    }
  }
}