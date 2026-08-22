import {
  Component,
  OnInit,
  Inject,
  PLATFORM_ID,
  ChangeDetectorRef
} from '@angular/core';

import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterModule } from '@angular/router';

import {
  ParcelService,
  ParcelRequest,
  DriverTrip
} from '../../services/Parcel.service';

@Component({
  selector: 'app-all-listings',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './all-listings-component.html',
  styleUrl: './all-listings-component.scss'
})
export class AllListingsComponent implements OnInit {

  requests: ParcelRequest[] = [];
  trips: DriverTrip[] = [];

  loadingRequests = true;
  loadingTrips = true;

  activeTab: 'requests' | 'trips' = 'requests';

  constructor(
    private parcelService: ParcelService,
    private cdr: ChangeDetectorRef,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  ngOnInit(): void {

    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    console.log('🚀 AllListingsComponent ჩაიტვირთა');

    this.loadRequests();
    this.loadTrips();
  }

  loadRequests(): void {

    console.log('📦 გზავნილების ჩატვირთვა დაიწყო');

    this.loadingRequests = true;

    this.parcelService.getRecentRequests().subscribe({
      next: (res) => {

        console.log('📦 REQUEST RESPONSE:', res);

        this.requests = res.requests ?? res.data ?? [];

        console.log('📦 REQUESTS:', this.requests);

        this.loadingRequests = false;

        this.cdr.detectChanges();
      },

      error: (err) => {

        console.error(
          '❌ გზავნილების ჩატვირთვის შეცდომა:',
          err
        );

        this.requests = [];
        this.loadingRequests = false;

        this.cdr.detectChanges();
      }
    });
  }

  loadTrips(): void {

    console.log('🚗 მგზავრობების ჩატვირთვა დაიწყო');

    this.loadingTrips = true;

    this.parcelService.getRecentTrips().subscribe({
      next: (res) => {

        console.log('🚗 TRIPS RESPONSE:', res);

        this.trips = res.trips ?? res.data ?? [];

        console.log('🚗 TRIPS:', this.trips);

        this.loadingTrips = false;

        this.cdr.detectChanges();
      },

      error: (err) => {

        console.error(
          '❌ მგზავრობების ჩატვირთვის შეცდომა:',
          err
        );

        this.trips = [];
        this.loadingTrips = false;

        this.cdr.detectChanges();
      }
    });
  }

  setTab(tab: 'requests' | 'trips'): void {
    this.activeTab = tab;
  }

  formatDate(date?: string): string {
    return this.parcelService.formatDate(date ?? '');
  }

  formatPrice(price?: number): string {
    return this.parcelService.formatPrice(price ?? 0);
  }
}