import { Injectable } from '@angular/core';
import { Subject, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class PullToRefreshService {
  private refreshSource = new Subject<() => Promise<void> | void>();
  private isRefreshingSource = new Subject<boolean>();

  // მინიმალური ხანგრძლივობა (ms), რომლის განმავლობაშიც loader უნდა დარჩეს ხილული,
  // რომ მომხმარებელმა რეალურად დაინახოს spinner — თუნდაც refresh მყისიერად დასრულდეს.
  private readonly minVisibleDuration = 500;

  refresh$: Observable<() => Promise<void> | void> = this.refreshSource.asObservable();
  isRefreshing$: Observable<boolean> = this.isRefreshingSource.asObservable();

  private registeredCallback: (() => Promise<void> | void) | null = null;

  /**
   * გამოიძახება directive-დან, როცა მომხმარებელმა gesture გააკეთა.
   * გადასცემს callback-ს, რომელიც უნდა დასრულდეს (Promise) სანამ loader გაითიშება.
   */
  async triggerRefresh(): Promise<void> {
    this.isRefreshingSource.next(true);

    // ვაძლევთ ბრაუზერს ერთ frame-ს, რომ Angular-მა ცვლილება რეალურად დახატოს ეკრანზე,
    // სანამ სინქრონული ან სწრაფი callback-ი დაიწყება (თორემ next(true)/next(false)
    // ერთ change detection ციკლში მოხვდება და spinner საერთოდ არ გამოჩნდება).
    await this.waitFrame();

    const startTime = Date.now();

    try {
      if (this.registeredCallback) {
        await this.registeredCallback();
      } else {
        // თუ აქტიურ გვერდს არ დაურეგისტრირებია საკუთარი refresh ლოგიკა,
        // fallback-ად ვაკეთებთ სრულ გვერდის reload-ს.
        await this.fallbackReload();
        return; // reload-ის შემდეგ JS კონტექსტი ისედაც განახლდება
      }
    } catch (e) {
      console.error('Refresh callback failed', e);
    }

    // თუ callback-მა ძალიან სწრაფად შეასრულა სამუშაო, spinner-ს მაინც
    // ვაჩვენებთ მინიმუმ minVisibleDuration-ის განმავლობაში, რომ არ "აციმციმდეს".
    const elapsed = Date.now() - startTime;
    if (elapsed < this.minVisibleDuration) {
      await this.delay(this.minVisibleDuration - elapsed);
    }

    this.isRefreshingSource.next(false);
  }

  /**
   * აქტიური გვერდი ამ მეთოდით არეგისტრირებს საკუთარ "როგორ განვაახლო" ლოგიკას.
   * ngOnInit-ში გამოიძახება, ngOnDestroy-ში unregisterRefresh().
   */
  registerRefresh(callback: () => Promise<void> | void): void {
    this.registeredCallback = callback;
  }

  unregisterRefresh(): void {
    this.registeredCallback = null;
  }

  private waitFrame(): Promise<void> {
    return new Promise(resolve => requestAnimationFrame(() => resolve()));
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private fallbackReload(): Promise<void> {
    return new Promise(() => {
      // window.location.reload() წყვეტს JS ეგზეკუციას, ამიტომ ეს Promise
      // განზრახ არ resolve-დება — გვერდი უბრალოდ თავიდან ჩაიტვირთება.
      window.location.reload();
    });
  }
}