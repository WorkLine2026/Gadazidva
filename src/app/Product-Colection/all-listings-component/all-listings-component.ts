import {
  Component,
  OnInit,
  Inject,
  PLATFORM_ID,
  ChangeDetectorRef
} from '@angular/core';

import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

import {
  ParcelService,
  ParcelRequest,
  DriverTrip
} from '../../services/Parcel.service';

type ListingTab = 'all' | 'requests' | 'trips';
type SortOption = 'date-desc' | 'date-asc' | 'price-asc' | 'price-desc';

interface ListingFilters {
  search: string;
  fromCity: string;
  toCity: string;
  dateFrom: string;
  dateTo: string;
  minWeight: number | null;
  maxWeight: number | null;
  minPrice: number | null;
  maxPrice: number | null;
  onlyWithPhotos: boolean;
  sort: SortOption;
}

@Component({
  selector: 'app-all-listings',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './all-listings-component.html',
  styleUrl: './all-listings-component.scss'
})
export class AllListingsComponent implements OnInit {

  requests: ParcelRequest[] = [];
  trips: DriverTrip[] = [];

  filteredRequests: ParcelRequest[] = [];
  filteredTrips: DriverTrip[] = [];

  loadingRequests = true;
  loadingTrips = true;

  activeTab: ListingTab = 'all';
  filtersOpen = false;

  cities: string[] = [];

  filters: ListingFilters = this.getEmptyFilters();

  constructor(
    private parcelService: ParcelService,
    private cdr: ChangeDetectorRef,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  ngOnInit(): void {
    this.cities = this.parcelService.GEORGIAN_CITIES_AND_TOWNS;

    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    this.loadRequests();
    this.loadTrips();
  }

  private getEmptyFilters(): ListingFilters {
    return {
      search: '',
      fromCity: '',
      toCity: '',
      dateFrom: '',
      dateTo: '',
      minWeight: null,
      maxWeight: null,
      minPrice: null,
      maxPrice: null,
      onlyWithPhotos: false,
      sort: 'date-desc'
    };
  }

  loadRequests(): void {
    this.loadingRequests = true;

    this.parcelService.getRecentRequests().subscribe({
      next: (res) => {
        this.requests = res.requests ?? res.data ?? [];
        this.loadingRequests = false;
        this.applyFilters();
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('❌ გზავნილების ჩატვირთვის შეცდომა:', err);
        this.requests = [];
        this.loadingRequests = false;
        this.applyFilters();
        this.cdr.detectChanges();
      }
    });
  }

  loadTrips(): void {
    this.loadingTrips = true;

    this.parcelService.getRecentTrips().subscribe({
      next: (res) => {
        this.trips = res.trips ?? res.data ?? [];
        this.loadingTrips = false;
        this.applyFilters();
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('❌ მგზავრობების ჩატვირთვის შეცდომა:', err);
        this.trips = [];
        this.loadingTrips = false;
        this.applyFilters();
        this.cdr.detectChanges();
      }
    });
  }

  setTab(tab: ListingTab): void {
    this.activeTab = tab;
  }

  toggleFilters(): void {
    this.filtersOpen = !this.filtersOpen;
  }

  swapCities(): void {
    const from = this.filters.fromCity;
    this.filters.fromCity = this.filters.toCity;
    this.filters.toCity = from;
    this.applyFilters();
  }

  resetFilters(): void {
    this.filters = this.getEmptyFilters();
    this.applyFilters();
  }

  get activeFilterCount(): number {
    const f = this.filters;
    let count = 0;
    if (f.search) count++;
    if (f.fromCity) count++;
    if (f.toCity) count++;
    if (f.dateFrom) count++;
    if (f.dateTo) count++;
    if (f.minWeight !== null) count++;
    if (f.maxWeight !== null) count++;
    if (f.minPrice !== null) count++;
    if (f.maxPrice !== null) count++;
    if (f.onlyWithPhotos) count++;
    return count;
  }

  applyFilters(): void {
    const f = this.filters;
    const search = f.search.trim().toLowerCase();

    let requests = [...this.requests];
    let trips = [...this.trips];

    if (f.fromCity) {
      requests = requests.filter(r => r.from === f.fromCity);
      trips = trips.filter(t => t.from === f.fromCity);
    }

    if (f.toCity) {
      requests = requests.filter(r => r.to === f.toCity);
      trips = trips.filter(t => t.to === f.toCity);
    }

    if (search) {
      requests = requests.filter(r =>
        (r.description ?? '').toLowerCase().includes(search) ||
        r.from.toLowerCase().includes(search) ||
        r.to.toLowerCase().includes(search)
      );
      trips = trips.filter(t =>
        (t.comments ?? '').toLowerCase().includes(search) ||
        t.from.toLowerCase().includes(search) ||
        t.to.toLowerCase().includes(search)
      );
    }

    if (f.dateFrom) {
      const from = new Date(f.dateFrom).getTime();
      requests = requests.filter(r => new Date(r.shipDate).getTime() >= from);
      trips = trips.filter(t => new Date(t.departureDate).getTime() >= from);
    }

    if (f.dateTo) {
      const to = new Date(f.dateTo).getTime();
      requests = requests.filter(r => new Date(r.shipDate).getTime() <= to);
      trips = trips.filter(t => new Date(t.departureDate).getTime() <= to);
    }

    if (f.minWeight !== null) {
      requests = requests.filter(r => r.weight >= f.minWeight!);
    }
    if (f.maxWeight !== null) {
      requests = requests.filter(r => r.weight <= f.maxWeight!);
    }

    if (f.minPrice !== null) {
      requests = requests.filter(r => r.value >= f.minPrice!);
      trips = trips.filter(t => (t.pricePerKg ?? 0) >= f.minPrice!);
    }
    if (f.maxPrice !== null) {
      requests = requests.filter(r => r.value <= f.maxPrice!);
      trips = trips.filter(t => (t.pricePerKg ?? 0) <= f.maxPrice!);
    }

    if (f.onlyWithPhotos) {
      requests = requests.filter(r => !!r.images && r.images.length > 0);
      trips = trips.filter(t => !!t.images && t.images.length > 0);
    }

    this.filteredRequests = this.sortRequests(requests, f.sort);
    this.filteredTrips = this.sortTrips(trips, f.sort);
  }

  private sortRequests(list: ParcelRequest[], sort: SortOption): ParcelRequest[] {
    const sorted = [...list];
    switch (sort) {
      case 'date-asc':
        return sorted.sort((a, b) => new Date(a.shipDate).getTime() - new Date(b.shipDate).getTime());
      case 'price-asc':
        return sorted.sort((a, b) => a.value - b.value);
      case 'price-desc':
        return sorted.sort((a, b) => b.value - a.value);
      case 'date-desc':
      default:
        return sorted.sort((a, b) => new Date(b.shipDate).getTime() - new Date(a.shipDate).getTime());
    }
  }

  private sortTrips(list: DriverTrip[], sort: SortOption): DriverTrip[] {
    const sorted = [...list];
    switch (sort) {
      case 'date-asc':
        return sorted.sort((a, b) => new Date(a.departureDate).getTime() - new Date(b.departureDate).getTime());
      case 'price-asc':
        return sorted.sort((a, b) => (a.pricePerKg ?? 0) - (b.pricePerKg ?? 0));
      case 'price-desc':
        return sorted.sort((a, b) => (b.pricePerKg ?? 0) - (a.pricePerKg ?? 0));
      case 'date-desc':
      default:
        return sorted.sort((a, b) => new Date(b.departureDate).getTime() - new Date(a.departureDate).getTime());
    }
  }

  formatDate(date?: string): string {
    return this.parcelService.formatDate(date ?? '');
  }

  formatPrice(price?: number): string {
    return this.parcelService.formatPrice(price ?? 0);
  }
}