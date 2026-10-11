import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../services/Admin.service';
import { PickupOffer, TripPickupRequest } from '../../services/Parcel.service';
import { statusMeta, personName, personPhone } from '../admin-labels';

type Tab = 'offers' | 'tripRequests';

@Component({
  selector: 'app-admin-offers',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-offers-component.html',
  styleUrls: ['../admin-shared.scss']
})
export class AdminOffersComponent implements OnInit {
  tab: Tab = 'offers';
  isLoading = false;
  errorMessage = '';

  offers: PickupOffer[] = [];
  tripRequests: TripPickupRequest[] = [];

  statusFilter = 'all';
  page = 1;
  pages = 1;
  total = 0;
  readonly limit = 20;

  meta = statusMeta;
  name = personName;
  phone = personPhone;

  constructor(private admin: AdminService, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.load();
  }

  setTab(tab: Tab): void {
    this.tab = tab;
    this.statusFilter = 'all';
    this.page = 1;
    this.load();
  }

  load(): void {
    this.isLoading = true;
    this.errorMessage = '';
    this.cdr.markForCheck();

    const params = { page: this.page, limit: this.limit, status: this.statusFilter };

    if (this.tab === 'offers') {
      this.admin.getOffers(params).subscribe({
        next: (res) => this.onLoaded(() => (this.offers = res.data || []), res.total, res.pages),
        error: (err) => this.onError(err)
      });
    } else {
      this.admin.getTripRequests(params).subscribe({
        next: (res) => this.onLoaded(() => (this.tripRequests = res.data || []), res.total, res.pages),
        error: (err) => this.onError(err)
      });
    }
  }

  private onLoaded(assign: () => void, total: number, pages: number): void {
    assign();
    this.total = total;
    this.pages = pages;
    this.isLoading = false;
    this.cdr.markForCheck();
  }

  private onError(err: any): void {
    console.error('❌ offers შეცდომა:', err);
    this.errorMessage = err?.error?.message || 'ჩატვირთვა ვერ მოხერხდა';
    this.isLoading = false;
    this.cdr.markForCheck();
  }

  onFilterChange(): void {
    this.page = 1;
    this.load();
  }

  goToPage(p: number): void {
    if (p < 1 || p > this.pages) return;
    this.page = p;
    this.load();
  }

  deleteOffer(o: PickupOffer): void {
    if (!confirm('წავშალო ეს შეთავაზება?')) return;
    this.admin.deleteOffer(o._id).subscribe({
      next: (res) => {
        if (res.success) {
          this.offers = this.offers.filter((x) => x._id !== o._id);
          this.total--;
        } else alert('❌ ' + (res.message || 'წაშლა ვერ მოხერხდა'));
        this.cdr.markForCheck();
      },
      error: (err) => alert('❌ ' + (err?.error?.message || 'წაშლა ვერ მოხერხდა'))
    });
  }

  deleteTripRequest(r: TripPickupRequest): void {
    if (!confirm('წავშალო ეს მოთხოვნა?')) return;
    this.admin.deleteTripRequest(r._id).subscribe({
      next: (res) => {
        if (res.success) {
          this.tripRequests = this.tripRequests.filter((x) => x._id !== r._id);
          this.total--;
        } else alert('❌ ' + (res.message || 'წაშლა ვერ მოხერხდა'));
        this.cdr.markForCheck();
      },
      error: (err) => alert('❌ ' + (err?.error?.message || 'წაშლა ვერ მოხერხდა'))
    });
  }

  parcelRoute(o: PickupOffer): string {
    const p: any = o.parcelId;
    return p && typeof p !== 'string' ? `${p.from} → ${p.to}` : '—';
  }

  tripRoute(r: TripPickupRequest): string {
    const t: any = r.tripId;
    return t && typeof t !== 'string' ? `${t.from} → ${t.to}` : '—';
  }
}