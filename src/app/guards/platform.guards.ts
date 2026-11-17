import { CanMatchFn } from '@angular/router';
import { Capacitor } from '@capacitor/core';

// true მხოლოდ Android/iOS აპლიკაციაში
export const nativeOnlyMatch: CanMatchFn = () => Capacitor.isNativePlatform();

// true მხოლოდ ვებში
export const webOnlyMatch: CanMatchFn = () => !Capacitor.isNativePlatform();