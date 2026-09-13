import { inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export function isBrowser(): boolean {
  return isPlatformBrowser(inject(PLATFORM_ID));
}